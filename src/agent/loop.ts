import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { execSync, spawnSync } from "node:child_process";
import { GoogleGenAI, type Content, type Part, type FunctionCall } from "@google/genai";
import { wrapGoogleGenAI } from "neatlogs/google-genai";
import { span, trace } from "neatlogs";
import { TOOLS, SYSTEM_PROMPT } from "./prompts.js";
import { newRunState, recordUsage, overBudget, persistState, type RunState } from "./state.js";
import { graphIndex, graphSearch, graphExplain, graphVerifyRecordBaseline, graphVerify } from "../tools/graph.js";
import { readFile, applyEdit } from "../tools/files.js";
import { gitDiff, gitRevertAll, gitCommitAll } from "../tools/git.js";
import { findCheatingInDiff } from "../verify.js";

const genai = wrapGoogleGenAI(new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY }));
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const RUNS_DIR = path.resolve(process.cwd(), "runs");

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

    const contents: Content[] = [
      {
        role: "user",
        parts: [
          {
            text: `Repo: ${opts.repoDir}\nTest command: ${opts.testCmd}\n\nBaseline summary: ${baselineSummary}\n\nFull failing test output:\n${lastFailureOutput}\n\nFind the root cause and fix it. Start with graph_search.`,
          },
        ],
      },
    ];

    let noToolUseStreak = 0;

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

      let response: Awaited<ReturnType<typeof genai.models.generateContent>> | undefined;
      let lastApiError: any;
      for (let retry = 0; retry < 4; retry++) {
        try {
          response = await genai.models.generateContent({
            model: MODEL,
            contents,
            config: {
              systemInstruction: SYSTEM_PROMPT,
              tools: [{ functionDeclarations: TOOLS }],
            },
          });
          break;
        } catch (err: any) {
          lastApiError = err;
          const retryable = err.status === 503 || err.status === 429 || err.status >= 500;
          if (!retryable || retry === 3) throw err;
          const delayMs = 1000 * 2 ** retry;
          state.recoveries.push({ attempt: state.attempt, kind: "api_error_backoff", detail: `status=${err.status}, retry ${retry + 1}/4 after ${delayMs}ms` });
          persistState(state, RUNS_DIR);
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
      if (!response) throw lastApiError;

      const usage = response.usageMetadata;
      recordUsage(state, usage?.promptTokenCount ?? 0, usage?.candidatesTokenCount ?? 0);
      persistState(state, RUNS_DIR);

      const candidateContent = response.candidates?.[0]?.content;
      if (!candidateContent) {
        throw new Error("Gemini returned no candidate content");
      }
      contents.push(candidateContent);

      const functionCalls: FunctionCall[] = response.functionCalls ?? [];

      if (functionCalls.length === 0) {
        noToolUseStreak++;
        if (noToolUseStreak >= 2) {
          state.status = "gave_up";
          persistState(state, RUNS_DIR);
          activeSpan.setAttribute("outcome", "stalled_no_tool_use");
          return { status: "gave_up", summary: "Agent stopped calling tools without finishing.", attempts: state.attempt, costUsd: state.costUsd };
        }
        contents.push({ role: "user", parts: [{ text: "Please continue using tools (run_tests or finish) -- don't just describe what you'd do." }] });
        continue;
      }
      noToolUseStreak = 0;

      const responseParts: Part[] = [];
      let finishRequested: { status: "fixed" | "gave_up"; summary: string } | null = null;

      for (const call of functionCalls) {
        const name = call.name ?? "";
        const args = call.args ?? {};

        if (name === "finish") {
          finishRequested = args as { status: "fixed" | "gave_up"; summary: string };
          responseParts.push({ functionResponse: { name, response: { output: "acknowledged" } } });
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
          if (name === "run_tests") lastFailureOutput = result;
          responseParts.push({ functionResponse: { name, response: { output: result } } });
        } catch (err: any) {
          const recoverySpan = span({ kind: "GUARDRAIL", toolName: `recovery:${name}_error` }, async (msg: string) => msg);
          await recoverySpan(err.message);
          state.recoveries.push({ attempt: state.attempt, kind: `${name}_error`, detail: err.message });
          persistState(state, RUNS_DIR);
          responseParts.push({ functionResponse: { name, response: { error: err.message } } });
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
          contents.push({ role: "user", parts: [...responseParts, { text: `Your claimed fix was rejected: ${reason}\nKeep trying.` }] });
          continue;
        }

        state.status = "gave_up";
        persistState(state, RUNS_DIR);
        activeSpan.setAttribute("outcome", "gave_up");
        return { status: "gave_up", summary: finishRequested.summary, attempts: state.attempt, costUsd: state.costUsd };
      }

      contents.push({ role: "user", parts: responseParts });
    }
  });
}
