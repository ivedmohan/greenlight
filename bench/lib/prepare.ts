import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { cp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BENCH_ROOT = path.resolve(__dirname, "..");
export const ROOT = path.resolve(BENCH_ROOT, "..");
export const REPOS_DIR = path.join(BENCH_ROOT, "repos");
export const CASES_DIR = path.join(BENCH_ROOT, "cases");

export interface CaseMeta {
  id: string;
  project: string;
  difficulty: string;
  description: string;
  expected_failing_tests?: string[];
  expected_failing_test_names?: string[];
  expected_failure_mode?: string;
}

export function loadCaseMeta(project: string, caseId: string): CaseMeta {
  const metaPath = path.join(CASES_DIR, project, caseId, "meta.json");
  return JSON.parse(readFileSync(metaPath, "utf8"));
}

/**
 * Copies bench/repos/<project> to destDir (symlinking node_modules so we
 * don't reinstall per case), applies the case's bug.patch, and optionally
 * git-inits the result with a baseline commit so an agent can diff/commit
 * its own fixes.
 */
export async function materializeCase(
  project: string,
  caseId: string,
  destDir: string,
  opts: { gitInit?: boolean } = {}
): Promise<string> {
  rmSync(destDir, { recursive: true, force: true });
  mkdirSync(destDir, { recursive: true });

  const golden = path.join(REPOS_DIR, project);
  await cp(golden, destDir, {
    recursive: true,
    filter: (src) => !src.includes(`${path.sep}node_modules${path.sep}`) && !src.endsWith(`${path.sep}node_modules`),
  });

  const goldenNodeModules = path.join(golden, "node_modules");
  if (existsSync(goldenNodeModules)) {
    symlinkSync(goldenNodeModules, path.join(destDir, "node_modules"));
  }

  const patchFile = path.join(CASES_DIR, project, caseId, "bug.patch");
  execSync(`patch -p0 < ${JSON.stringify(patchFile)}`, { cwd: destDir, stdio: "pipe" });

  if (opts.gitInit) {
    execSync("git init -q", { cwd: destDir });
    execSync("git add -A", { cwd: destDir });
    execSync('git -c user.email=greenlight@local -c user.name=greenlight commit -q -m "baseline (buggy)"', {
      cwd: destDir,
    });
  }

  return destDir;
}
