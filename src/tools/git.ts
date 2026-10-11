import { execFileSync } from "node:child_process";

export function gitDiff(repoDir: string): string {
  return execFileSync("git", ["diff"], { cwd: repoDir, encoding: "utf8" });
}

export function gitRevertAll(repoDir: string): void {
  execFileSync("git", ["checkout", "--", "."], { cwd: repoDir });
}

/**
 * Uses execFileSync (no shell) throughout, NOT execSync -- `message` is
 * LLM-generated and can contain backticks/`$(...)` from markdown-style
 * code formatting, which a shell would interpret as command substitution
 * even inside double quotes.
 */
export function gitCommitAll(repoDir: string, message: string): string {
  execFileSync("git", ["add", "-A"], { cwd: repoDir });
  execFileSync(
    "git",
    ["-c", "user.email=greenlight@local", "-c", "user.name=greenlight", "commit", "-q", "-m", message],
    { cwd: repoDir }
  );
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoDir, encoding: "utf8" }).trim();
}
