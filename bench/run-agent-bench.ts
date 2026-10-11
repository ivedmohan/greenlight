#!/usr/bin/env tsx
/**
 * Runs the ACTUAL Greenlight agent (src/agent/loop.ts) against every seeded
 * bench case, independently re-verifies the result (never trusts the
 * agent's self-report), and writes a results table to evidence/.
 *
 * Usage: tsx bench/run-agent-bench.ts [--only project/case-id] [--label v1]
 */
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { CASES_DIR, ROOT, type CaseMeta, materializeCase } from "./lib/prepare.js";
import { runAgent } from "../src/agent/loop.js";

const WORK_DIR = path.join(ROOT, "runs", "agent-bench");
const EVIDENCE_DIR = path.join(ROOT, "evidence");

interface AgentCaseResult {
  project: string;
  id: string;
  difficulty: string;
  status: string;
  attempts: number;
  costUsd: number;
  commitSha?: string;
  independentlyVerifiedGreen: boolean;
  runId: string;
  summary: string;
}

function findCases(): { project: string; id: string; dir: string }[] {
  const out: { project: string; id: string; dir: string }[] = [];
  for (const project of readdirSync(CASES_DIR)) {
    const projectDir = path.join(CASES_DIR, project);
    for (const id of readdirSync(projectDir)) {
      const dir = path.join(projectDir, id);
      if (existsSync(path.join(dir, "meta.json"))) out.push({ project, id, dir });
    }
  }
  return out;
}

function independentlyVerify(repoDir: string): boolean {
  try {
    execFileSync("npx", ["vitest", "run"], { cwd: repoDir, stdio: "pipe", timeout: 30_000 });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const onlyIdx = args.indexOf("--only");
  const only = onlyIdx >= 0 ? args[onlyIdx + 1] : undefined;
  const labelIdx = args.indexOf("--label");
  const label = labelIdx >= 0 ? args[labelIdx + 1] : "v1";

  let cases = findCases().sort((a, b) => `${a.project}/${a.id}`.localeCompare(`${b.project}/${b.id}`));
  if (only) cases = cases.filter((c) => `${c.project}/${c.id}` === only);

  const results: AgentCaseResult[] = [];

  for (const c of cases) {
    const meta: CaseMeta = JSON.parse(readFileSync(path.join(c.dir, "meta.json"), "utf8"));
    const runId = `agentbench-${label}-${c.project}-${c.id}`;
    const repoDir = path.join(WORK_DIR, label, c.project, c.id);

    console.log(`\n=== ${c.project}/${c.id} (${meta.difficulty}) ===`);
    await materializeCase(c.project, c.id, repoDir, { gitInit: true });

    let result: Awaited<ReturnType<typeof runAgent>>;
    try {
      result = await runAgent({
        repoDir,
        testCmd: "npm test",
        maxIterations: 8,
        maxCostUsd: 0.5,
        runId,
      });
    } catch (err: any) {
      // A single case crashing (e.g. a provider's daily quota exhausted
      // mid-batch) must not take down the rest of the benchmark -- record
      // it honestly as "error" and keep going.
      console.log(`  -> ERROR: ${err.message?.slice(0, 300)}`);
      results.push({
        project: c.project,
        id: c.id,
        difficulty: meta.difficulty,
        status: "error",
        attempts: 0,
        costUsd: 0,
        independentlyVerifiedGreen: false,
        runId,
        summary: `Crashed: ${err.message?.slice(0, 500)}`,
      });
      continue;
    }

    const verifiedGreen = result.status === "fixed" ? independentlyVerify(repoDir) : false;

    console.log(
      `  -> status=${result.status} attempts=${result.attempts} cost=$${result.costUsd.toFixed(4)} independently_verified_green=${verifiedGreen}`
    );

    results.push({
      project: c.project,
      id: c.id,
      difficulty: meta.difficulty,
      status: result.status,
      attempts: result.attempts,
      costUsd: result.costUsd,
      commitSha: result.commitSha,
      independentlyVerifiedGreen: verifiedGreen,
      runId,
      summary: result.summary,
    });
  }

  if (!existsSync(EVIDENCE_DIR)) mkdirSync(EVIDENCE_DIR, { recursive: true });
  const outPath = path.join(EVIDENCE_DIR, `agent-bench-${label}.json`);
  writeFileSync(outPath, JSON.stringify(results, null, 2));

  const fixed = results.filter((r) => r.status === "fixed" && r.independentlyVerifiedGreen);
  console.log(`\n--- Agent bench (${label}) summary ---`);
  for (const r of results) {
    const mark = r.status === "fixed" && r.independentlyVerifiedGreen ? "✓" : "✗";
    console.log(`${mark} [${r.difficulty.padEnd(8)}] ${r.project}/${r.id}: ${r.status} (${r.attempts} attempts, $${r.costUsd.toFixed(4)})`);
  }
  console.log(`\n${fixed.length}/${results.length} cases fixed and independently verified green.`);
  console.log(`Results written to ${path.relative(ROOT, outPath)}`);
}

main();
