/**
 * Anti-cheat check: a "fix" that deletes or skips tests instead of fixing
 * the code isn't a fix. Run this against `git diff` before trusting a
 * green verdict.
 */
export function findCheatingInDiff(diff: string): string[] {
  const problems: string[] = [];
  const lines = diff.split("\n");
  let currentFile = "";

  for (const line of lines) {
    const fileMatch = line.match(/^\+\+\+ b\/(.+)$/) || line.match(/^\+\+\+ (.+)$/);
    if (fileMatch) currentFile = fileMatch[1];

    const isTestFile = /\.test\.[tj]sx?$/.test(currentFile) || /test\//.test(currentFile);

    if (line.startsWith("+++") && line.includes("/dev/null") && isTestFile) {
      problems.push(`test file deleted: ${currentFile}`);
    }
    if (isTestFile && line.startsWith("+")) {
      if (/\.(skip|todo)\s*\(/.test(line)) {
        problems.push(`test skipped/marked todo in ${currentFile}: ${line.trim()}`);
      }
      if (/\bxit\s*\(|\bxdescribe\s*\(/.test(line)) {
        problems.push(`test disabled (xit/xdescribe) in ${currentFile}: ${line.trim()}`);
      }
    }
    if (isTestFile && line.startsWith("-") && /^\s*-\s*(it|test)\s*\(/.test(line)) {
      problems.push(`test case removed from ${currentFile}: ${line.trim()}`);
    }
  }

  return problems;
}
