import { execFileSync } from "node:child_process";

function run(args: string[], cwd: string, timeoutMs = 30_000): string {
  return execFileSync("entire", args, { cwd, encoding: "utf8", timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 });
}

export function graphIndex(repoDir: string): void {
  run(["graph", "index", "--repo", "."], repoDir, 60_000);
}

/** LOCATE: ranked candidate fix sites for a plain-language description of the bug. */
export function graphSearch(repoDir: string, query: string, topK = 8): string {
  return run(["graph", "search", "--repo", ".", "--query", query, "--format", "text", "--profile", "full", "--top-k", String(topK)], repoDir);
}

/** LOCATE (follow-up): resolve the declarations of symbols named in failing test/build output. */
export function graphExplain(repoDir: string, failureOutput: string): string {
  return execFileSync("entire", ["graph", "explain", "--repo", "."], {
    cwd: repoDir,
    input: failureOutput,
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 10 * 1024 * 1024,
  });
}

export interface VerifyVerdict {
  raw: string;
  verdict: "PASS" | "FAIL" | "NO_EFFECT" | "UNKNOWN";
  newlyPassing: string[];
  newlyFailing: string[];
}

/**
 * Record the pristine-tree baseline on the ORIGINAL (buggy) checkout, before
 * any edits. Must use a reporter that prints every individual test name
 * (vitest's default reporter only names FAILING tests individually and
 * summarizes passing files, which breaks the later diff) -- see bench note.
 */
export function graphVerifyRecordBaseline(repoDir: string, testCmd: string, baselinePath: string): string {
  return run(["graph", "verify", "--repo", ".", "--test", testCmd, "--record-baseline", baselinePath], repoDir, 60_000);
}

export function graphVerify(repoDir: string, testCmd: string, baselinePath: string): VerifyVerdict {
  let raw: string;
  try {
    raw = run(["graph", "verify", "--repo", ".", "--test", testCmd, "--pre-edit-baseline", baselinePath], repoDir, 60_000);
  } catch (err: any) {
    raw = (err.stdout?.toString() ?? "") + (err.stderr?.toString() ?? "");
  }

  const newlyPassingMatch = raw.match(/NEWLY PASSING \(\d+\): (.+)/);
  const newlyFailingMatch = raw.match(/NEWLY FAILING \(\d+\): (.+)/);

  let verdict: VerifyVerdict["verdict"] = "UNKNOWN";
  if (/VERDICT: PASS/.test(raw)) verdict = "PASS";
  else if (/VERDICT: NO EFFECT/.test(raw)) verdict = "NO_EFFECT";
  else if (/VERDICT: FAIL|NEWLY FAILING/.test(raw)) verdict = "FAIL";

  return {
    raw,
    verdict,
    newlyPassing: newlyPassingMatch ? newlyPassingMatch[1].split(", ").map((s) => s.trim()) : [],
    newlyFailing: newlyFailingMatch ? newlyFailingMatch[1].split(", ").map((s) => s.trim()) : [],
  };
}
