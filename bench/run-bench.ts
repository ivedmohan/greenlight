#!/usr/bin/env tsx
/**
 * Applies each bench/cases/<project>/<case-id>/bug.patch to a fresh copy of
 * bench/repos/<project>, runs that project's test suite, and checks the
 * observed failing tests against meta.json's expectation.
 *
 * Usage: tsx bench/run-bench.ts
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { cp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const REPOS_DIR = path.join(__dirname, "repos");
const CASES_DIR = path.join(__dirname, "cases");
const WORK_DIR = path.join(ROOT, "runs", "bench-verify");

interface CaseMeta {
  id: string;
  project: string;
  difficulty: string;
  description: string;
  expected_failing_tests?: string[];
  expected_failing_test_names?: string[];
  expected_failure_mode?: string;
}

interface CaseResult {
  id: string;
  project: string;
  difficulty: string;
  pass: boolean;
  detail: string;
  elapsedMs: number;
}

function findCases(): { project: string; id: string; dir: string }[] {
  const out: { project: string; id: string; dir: string }[] = [];
  for (const project of readdirSync(CASES_DIR)) {
    const projectDir = path.join(CASES_DIR, project);
    for (const id of readdirSync(projectDir)) {
      const dir = path.join(projectDir, id);
      if (existsSync(path.join(dir, "meta.json"))) {
        out.push({ project, id, dir });
      }
    }
  }
  return out;
}

async function prepareWorkingCopy(project: string, caseId: string): Promise<string> {
  const dest = path.join(WORK_DIR, project, caseId);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  const golden = path.join(REPOS_DIR, project);
  await cp(golden, dest, {
    recursive: true,
    filter: (src) => !src.includes(`${path.sep}node_modules${path.sep}`) && !src.endsWith(`${path.sep}node_modules`),
  });
  const goldenNodeModules = path.join(golden, "node_modules");
  if (existsSync(goldenNodeModules)) {
    symlinkSync(goldenNodeModules, path.join(dest, "node_modules"));
  }
  return dest;
}

function applyPatch(dir: string, patchFile: string): void {
  execSync(`patch -p0 < ${JSON.stringify(patchFile)}`, { cwd: dir, stdio: "pipe" });
}

function runTests(dir: string): { stdout: string; ok: boolean; elapsedMs: number } {
  const start = Date.now();
  try {
    const stdout = execSync("npx vitest run --testTimeout=5000", {
      cwd: dir,
      stdio: "pipe",
      timeout: 60_000,
    }).toString();
    return { stdout, ok: true, elapsedMs: Date.now() - start };
  } catch (err: any) {
    const stdout = (err.stdout?.toString() ?? "") + (err.stderr?.toString() ?? "");
    return { stdout, ok: false, elapsedMs: Date.now() - start };
  }
}

function extractFailingTestFiles(vitestOutput: string): Set<string> {
  const files = new Set<string>();
  const lines = vitestOutput.split("\n");
  for (const line of lines) {
    const m = line.match(/FAIL\s+(test\/[^\s]+\.test\.ts)/);
    if (m) files.add(m[1]);
  }
  return files;
}

async function runCase(c: { project: string; id: string; dir: string }): Promise<CaseResult> {
  const meta: CaseMeta = JSON.parse(readFileSync(path.join(c.dir, "meta.json"), "utf8"));
  const workDir = await prepareWorkingCopy(c.project, c.id);
  applyPatch(workDir, path.join(c.dir, "bug.patch"));
  const { stdout, elapsedMs } = runTests(workDir);

  const actualFailingFiles = extractFailingTestFiles(stdout);
  const expectedFailingFiles = new Set(meta.expected_failing_tests ?? []);

  const setsMatch =
    actualFailingFiles.size === expectedFailingFiles.size &&
    [...actualFailingFiles].every((f) => expectedFailingFiles.has(f));

  return {
    id: c.id,
    project: c.project,
    difficulty: meta.difficulty,
    pass: setsMatch,
    detail: setsMatch
      ? `ok (${[...actualFailingFiles].join(", ") || "none"})`
      : `expected [${[...expectedFailingFiles].join(", ")}] got [${[...actualFailingFiles].join(", ")}]`,
    elapsedMs,
  };
}

async function main() {
  const cases = findCases().sort((a, b) => a.id.localeCompare(b.id));
  const results: CaseResult[] = [];
  for (const c of cases) {
    process.stdout.write(`Running ${c.project}/${c.id}... `);
    const result = await runCase(c);
    results.push(result);
    console.log(result.pass ? "PASS" : "FAIL");
  }

  console.log("\n--- Bench results ---");
  console.log(
    results
      .map(
        (r) =>
          `${r.pass ? "✓" : "✗"} [${r.difficulty.padEnd(8)}] ${r.project}/${r.id} (${r.elapsedMs}ms) ${
            r.pass ? "" : "-- " + r.detail
          }`
      )
      .join("\n")
  );

  const failures = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failures.length}/${results.length} cases match their expectation.`);
  if (failures.length > 0) {
    console.log("Failing cases:");
    for (const f of failures) console.log(`  - ${f.project}/${f.id}: ${f.detail}`);
    process.exitCode = 1;
  }
}

main();
