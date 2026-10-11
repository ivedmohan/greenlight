import { spawnSync } from "node:child_process";

const ALLOWED_COMMANDS = new Set(["npm", "npx", "node"]);

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

export function runCommand(repoDir: string, cmd: string, timeoutMs = 30_000): CommandResult {
  const [bin, ...args] = cmd.trim().split(/\s+/);
  if (!ALLOWED_COMMANDS.has(bin)) {
    throw new Error(`Command '${bin}' is not allow-listed. Allowed: ${[...ALLOWED_COMMANDS].join(", ")}`);
  }

  const result = spawnSync(bin, args, {
    cwd: repoDir,
    timeout: timeoutMs,
    encoding: "utf8",
    shell: false,
  });

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status,
    timedOut: result.signal === "SIGTERM" && result.status === null,
  };
}
