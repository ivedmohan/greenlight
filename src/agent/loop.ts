import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { execSync, spawnSync } from "node:child_process";
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { wrapOpenAI } from "neatlogs/openai";
import { span, trace } from "neatlogs";
import { TOOLS, SYSTEM_PROMPT } from "./prompts.js";
import { newRunState, recordUsage, overBudget, persistState, type RunState } from "./state.js";
import { graphIndex, graphSearch, graphExplain, graphVerifyRecordBaseline, graphVerify } from "../tools/graph.js";
import { readFile, applyEdit } from "../tools/files.js";
import { gitDiff, gitRevertAll, gitCommitAll } from "../tools/git.js";
import { findCheatingInDiff } from "../verify.js";

// Groq hosts an OpenAI-compatible Chat Completions API -- reuse the OpenAI
// SDK (and neatlogs' OpenAI wrapper) pointed at Groq's base URL instead of
// a separate SDK/integration.
const client = wrapOpenAI(
  new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" })
);
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const RUNS_DIR = path.resolve(process.cwd(), "runs");

const OPENAI_TOOLS: ChatCompletionTool[] = TOOLS.map((t) => ({
  type: "function",
  function: { name: t.name, description: t.description, parameters: t.parameters as Record<string, unknown> },
}));

/**
 * vitest's default reporter embeds a nondeterministic duration ("1ms" vs
 * "0ms") in each FAILING test's displayed name, and only names PASSING
 * tests at file granularity. Both break entire graph verify's baseline
 * diff (flaky id mismatches, and no per-test pass tracking) -- force the
 * verbose reporter, which prints a stable id per test with no timing.
 * testCmd is often "npm test", which doesn't literally say "vitest", so
 * check the repo's own package.json script instead of the command string.
 */
function toVerboseTestCmd(repoDir: string, testCmd: string): string {
  if (/--reporter/.test(testCmd)) return testCmd;

  let usesVitest = /vitest/.test(testCmd);
  if (!usesVitest) {
    try {
      const pkg = JSON.parse(readFileSync(path.join(repoDir, "package.json"), "utf8"));
      usesVitest = Object.values(pkg.scripts ?? {}).some((s) => typeof s === "string" && /vitest/.test(s));
    } catch {
      // no package.json / not JSON -- leave testCmd untouched
    }
  }
  if (!usesVitest) return testCmd;

  if (/^npm\s+(test\b|run\s+\S+)/.test(testCmd)) return `${testCmd} -- --reporter=verbose`;
  return `${testCmd} --reporter=verbose`;
}

/**
 * Groq's 429 messages embed how long to wait, e.g. "Please try again in
 * 13m53.76s" or "Please try again in 850ms". Parse it so we wait exactly
 * that long instead of guessing with a short exponential schedule --
 * capped at 20 minutes so a single run can't hang indefinitely.
 */
function parseRetryAfterMs(message: string): number | null {
  const m = message.match(/try again in\s+(?:(\d+)m)?\s*([\d.]+)(ms|s)/i);
  if (!m) return null;
  const minutes = m[1] ? parseInt(m[1], 10) : 0;
  const value = parseFloat(m[2]);
  const seconds = m[3].toLowerCase() === "ms" ? value / 1000 : value;
  const totalMs = (minutes * 60 + seconds) * 1000;
  return Math.min(Math.ceil(totalMs) + 1000, 20 * 60 * 1000);
}

function ensureGitRepo(repoDir: string): void {
  if (!existsSync(path.join(repoDir, ".git"))) {
    execSync("git init -q", { cwd: repoDir });
    execSync("git add -A", { cwd: repoDir });
    execSync('git -c user.email=greenlight@local -c user.name=greenlight commit -q -m "baseline (pre-greenlight)"', {
      cwd: repoDir,
    });
  }
}

export interface AgentRunOptions {
  repoDir: string;
  testCmd: string;
  maxIterations: number;
  maxCostUsd: number;
  runId: string;
}

export interface AgentRunResult {
  status: RunState["status"];
  summary: string;
  attempts: number;
  costUsd: number;
  commitSha?: string;
}

const toolImpl: Record<string, (repoDir: string, args: any, ctx: { baselinePath: string; testCmd: string; lastFailureOutput: string }) => string> = {
  graph_search: (repoDir, args) => graphSearch(repoDir, args.query),
  graph_explain: (repoDir, _args, ctx) => graphExplain(repoDir, ctx.lastFailureOutput),
  read_file: (repoDir, args) => readFile(repoDir, args.path, args.start && args.end ? { start: args.start, end: args.end } : undefined),
  apply_edit: (repoDir, args) => {
    applyEdit(repoDir, args.path, args.old_str, args.new_str);
    return `edit applied to ${args.path}`;
  },
  run_tests: (repoDir, _args, ctx) => {
    const verdict = graphVerify(repoDir, ctx.testCmd, ctx.baselinePath);
    return verdict.raw;
  },
  revert_last_edit: (repoDir) => {
    gitRevertAll(repoDir);
    return "reverted all uncommitted changes to baseline";
  },
};

export async function runAgent(opts: AgentRunOptions): Promise<AgentRunResult> {
  const state = newRunState({
    runId: opts.runId,
    repoDir: opts.repoDir,
    testCmd: opts.testCmd,
    maxIterations: opts.maxIterations,
    maxCostUsd: opts.maxCostUsd,
  });

  return trace({ name: "greenlight-run", kind: "AGENT" }, async (activeSpan) => {
    activeSpan.setAttribute("run_id", opts.runId);
    activeSpan.setAttribute("repo", opts.repoDir);

    ensureGitRepo(opts.repoDir);

    const indexSpan = span({ kind: "TOOL", toolName: "graph_index" }, async (dir: string) => graphIndex(dir));
    await indexSpan(opts.repoDir);

    const verboseTestCmd = toVerboseTestCmd(opts.repoDir, opts.testCmd);
    const baselinePath = path.join(RUNS_DIR, opts.runId, "baseline.json");

    const recordBaselineSpan = span({ kind: "TOOL", toolName: "graph_verify_record_baseline" }, async () =>
      graphVerifyRecordBaseline(opts.repoDir, verboseTestCmd, baselinePath)
    );
    const baselineSummary = await recordBaselineSpan();

    if (/0 failing/.test(baselineSummary)) {
      activeSpan.setAttribute("outcome", "nothing_to_fix");
      return { status: "gave_up", summary: "Nothing to fix: all tests already pass.", attempts: 0, costUsd: 0 };
    }

    // The baseline summary is just a one-line pass/fail count -- run the
    // real command once more to capture actual error messages/stack traces
    // for the agent's initial context (and for graph_explain to resolve).
    const reproduceSpan = span({ kind: "TOOL", toolName: "reproduce" }, async (cmd: string) => {
      const [bin, ...args] = cmd.split(/\s+/);
      const result = spawnSync(bin, args, { cwd: opts.repoDir, encoding: "utf8" });
      return `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim().slice(0, 6000);
    });
    let lastFailureOutput = await reproduceSpan(verboseTestCmd);

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Repo: ${opts.repoDir}\nTest command: ${opts.testCmd}\n\nBaseline summary: ${baselineSummary}\n\nFull failing test output:\n${lastFailureOutput}\n\nFind the root cause and fix it. Start with graph_search.`,
      },
    ];

    let noToolUseStreak = 0;
    let lastRunTestsPassed = false;

    while (true) {
      state.attempt++;
      persistState(state, RUNS_DIR);

      if (overBudget(state)) {
        state.status = "budget_exceeded";
        persistState(state, RUNS_DIR);
        activeSpan.setAttribute("outcome", "budget_exceeded");
        return {
          status: "budget_exceeded",
          summary: `Exceeded budget (attempts=${state.attempt}, cost=$${state.costUsd.toFixed(4)}) without a verified fix.`,
          attempts: state.attempt,
          costUsd: state.costUsd,
        };
      }

      let response: OpenAI.Chat.Completions.ChatCompletion | undefined;
      let lastApiError: any;
      const MAX_RETRIES = 5;
      for (let retry = 0; retry < MAX_RETRIES; retry++) {
        try {
          response = await client.chat.completions.create({
            model: MODEL,
            messages,
            tools: OPENAI_TOOLS,
          });
          break;
        } catch (err: any) {
          lastApiError = err;
          const status = err.status ?? err.response?.status;
          const retryable = status === 503 || status === 429 || status >= 500;
          if (!retryable || retry === MAX_RETRIES - 1) throw err;

          // Groq's quota errors carry "try again in Xm Ys" / "Xs" in the
          // message -- honor that instead of our own short exponential
          // schedule, which is far too short for a token-per-day limit.
          const quotaWait = parseRetryAfterMs(err.error?.message || err.message || "");
          const delayMs = quotaWait ?? Math.min(1000 * 2 ** retry, 20_000);

          state.recoveries.push({
            attempt: state.attempt,
            kind: quotaWait ? "api_quota_wait" : "api_error_backoff",
            detail: `status=${status}, retry ${retry + 1}/${MAX_RETRIES} after ${Math.round(delayMs / 1000)}s: ${(err.error?.message || err.message || "").slice(0, 200)}`,
          });
          persistState(state, RUNS_DIR);
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
      if (!response) throw lastApiError;

      const usage = response.usage;
      recordUsage(state, usage?.prompt_tokens ?? 0, usage?.completion_tokens ?? 0);
      persistState(state, RUNS_DIR);

      const choice = response.choices[0];
      if (!choice?.message) throw new Error("Groq returned no choice/message");
      messages.push(choice.message);

      const toolCalls = (choice.message.tool_calls ?? []).filter(
        (c): c is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall => c.type === "function"
      );

      if (process.env.GREENLIGHT_DEBUG) {
        console.error(
          `\n[turn ${state.attempt}] finish_reason=${choice.finish_reason} content=${JSON.stringify((choice.message.content || "").slice(0, 300))} tool_calls=${JSON.stringify((choice.message.tool_calls ?? []).map((c: any) => ({ type: c.type, name: c.function?.name, args: c.function?.arguments?.slice(0, 200) })))}`
        );
      }

      let finishRequested: { status: "fixed" | "gave_up"; summary: string } | null = null;
      const toolMessages: ChatCompletionMessageParam[] = [];

      if (toolCalls.length === 0) {
        // The model sometimes wraps up with a prose summary instead of
        // actually calling finish. If the last run_tests already confirmed
        // PASS and nothing has changed since, don't waste budget nudging --
        // treat this as an implicit finish (still goes through the same
        // re-verify + anti-cheat gate below, never trusted blindly).
        if (lastRunTestsPassed) {
          finishRequested = { status: "fixed", summary: choice.message.content?.trim() || "Fix verified by run_tests (PASS); agent stopped without explicitly calling finish." };
        } else {
          noToolUseStreak++;
          if (noToolUseStreak >= 2) {
            state.status = "gave_up";
            persistState(state, RUNS_DIR);
            activeSpan.setAttribute("outcome", "stalled_no_tool_use");
            return { status: "gave_up", summary: "Agent stopped calling tools without finishing.", attempts: state.attempt, costUsd: state.costUsd };
          }
          messages.push({ role: "user", content: "Please continue using tools (run_tests or finish) -- don't just describe what you'd do." });
          continue;
        }
      }
      noToolUseStreak = 0;

      for (const call of toolCalls) {
        const name = call.function.name;
        let args: any = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          if (process.env.GREENLIGHT_DEBUG) console.error(`\n[tool] ${name}: ERROR malformed JSON args: ${call.function.arguments}`);
          toolMessages.push({ role: "tool", tool_call_id: call.id, content: "ERROR: arguments were not valid JSON" });
          continue;
        }

        if (name === "finish") {
          finishRequested = args as { status: "fixed" | "gave_up"; summary: string };
          toolMessages.push({ role: "tool", tool_call_id: call.id, content: "acknowledged" });
          continue;
        }

        const toolSpan = span({ kind: "TOOL", toolName: name }, async (a: any) =>
          toolImpl[name](opts.repoDir, a, { baselinePath, testCmd: verboseTestCmd, lastFailureOutput })
        );

        try {
          const result = await toolSpan(args);
          if (process.env.GREENLIGHT_DEBUG) {
            console.error(`\n[tool] ${name}(${JSON.stringify(args)})\n  -> ${result.slice(0, 500)}`);
          }
          if (name === "run_tests") {
            lastFailureOutput = result;
            lastRunTestsPassed = /VERDICT: PASS/.test(result);
          } else if (name === "apply_edit" || name === "revert_last_edit") {
            lastRunTestsPassed = false; // state changed since the last verdict
          }
          toolMessages.push({ role: "tool", tool_call_id: call.id, content: result });
        } catch (err: any) {
          const recoverySpan = span({ kind: "GUARDRAIL", toolName: `recovery:${name}_error` }, async (msg: string) => msg);
          await recoverySpan(err.message);
          state.recoveries.push({ attempt: state.attempt, kind: `${name}_error`, detail: err.message });
          persistState(state, RUNS_DIR);
          toolMessages.push({ role: "tool", tool_call_id: call.id, content: `ERROR: ${err.message}` });
        }
      }

      if (finishRequested) {
        state.hypotheses.push({ attempt: state.attempt, summary: finishRequested.summary, verdict: finishRequested.status });

        if (finishRequested.status === "fixed") {
          const verifySpan = span({ kind: "GUARDRAIL", toolName: "final_verify" }, async () =>
            graphVerify(opts.repoDir, verboseTestCmd, baselinePath)
          );
          const verdict = await verifySpan();
          const diffSpan = span({ kind: "GUARDRAIL", toolName: "anti_cheat_diff_check" }, async () => gitDiff(opts.repoDir));
          const diff = await diffSpan();
          const cheats = findCheatingInDiff(diff);

          if (verdict.verdict === "PASS" && cheats.length === 0) {
            const commitSha = gitCommitAll(opts.repoDir, `Greenlight fix: ${finishRequested.summary.slice(0, 72)}`);
            state.status = "fixed";
            persistState(state, RUNS_DIR);
            activeSpan.setAttribute("outcome", "fixed");
            activeSpan.setAttribute("attempts", state.attempt);
            return { status: "fixed", summary: finishRequested.summary, attempts: state.attempt, costUsd: state.costUsd, commitSha };
          }

          const reason = cheats.length > 0 ? `Rejected: diff looks like it disables tests instead of fixing code: ${cheats.join("; ")}` : `Rejected: verify did not return PASS: ${verdict.raw}`;
          state.recoveries.push({ attempt: state.attempt, kind: "unverified_finish_rejected", detail: reason });
          persistState(state, RUNS_DIR);
          messages.push(...toolMessages);
          messages.push({ role: "user", content: `Your claimed fix was rejected: ${reason}\nKeep trying.` });
          continue;
        }

        state.status = "gave_up";
        persistState(state, RUNS_DIR);
        activeSpan.setAttribute("outcome", "gave_up");
        return { status: "gave_up", summary: finishRequested.summary, attempts: state.attempt, costUsd: state.costUsd };
      }

      messages.push(...toolMessages);
    }
  });
}
