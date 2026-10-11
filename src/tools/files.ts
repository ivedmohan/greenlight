import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function resolveInRepo(repoDir: string, relPath: string): string {
  const resolved = path.resolve(repoDir, relPath);
  if (!resolved.startsWith(path.resolve(repoDir) + path.sep) && resolved !== path.resolve(repoDir)) {
    throw new Error(`Path '${relPath}' escapes the repo directory`);
  }
  return resolved;
}

export function readFile(repoDir: string, relPath: string, range?: { start: number; end: number }): string {
  const full = resolveInRepo(repoDir, relPath);
  const content = readFileSync(full, "utf8");
  if (!range) return content;
  const lines = content.split("\n");
  return lines.slice(Math.max(0, range.start - 1), range.end).join("\n");
}

/**
 * Exact search/replace edit. Fails loudly if `oldStr` isn't found exactly
 * once, so the caller (the agent) has to re-read the file and regenerate
 * the edit instead of silently patching the wrong occurrence.
 */
export function applyEdit(repoDir: string, relPath: string, oldStr: string, newStr: string): void {
  const full = resolveInRepo(repoDir, relPath);
  const content = readFileSync(full, "utf8");
  const occurrences = content.split(oldStr).length - 1;
  if (occurrences === 0) {
    throw new Error(`old string not found in ${relPath}`);
  }
  if (occurrences > 1) {
    throw new Error(`old string found ${occurrences} times in ${relPath}; must match exactly once`);
  }
  writeFileSync(full, content.replace(oldStr, newStr), "utf8");
}
