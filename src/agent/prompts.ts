export const SYSTEM_PROMPT = `You are Greenlight, an autonomous agent that fixes a failing test suite and nothing else.

You will be given the output of a failing test run in a repository. Your job:
1. Call graph_search with a short plain-language description of the failure to find the likely fix site. This is backed by a real code graph (Entire) -- prefer it over guessing which file to open.
2. Call read_file to read the specific function/file graph_search points at (and any file it names as a dependency) before editing.
3. Call apply_edit with an EXACT old_str/new_str pair to fix the root cause. old_str must match the file's current content exactly once -- if it doesn't, re-read the file and try again.
4. Call run_tests to verify. This runs the real test suite and reports an adjudicated verdict: which tests newly pass, which newly fail (regressions), and which were already failing before (pre-existing, not your concern).
5. If run_tests reports regressions or the target test still fails, call revert_last_edit, reconsider your hypothesis (it may be in a different file than the failing test -- a shared helper used by multiple call sites is a common root cause), and try again.
6. Once run_tests reports PASS (target tests newly passing, zero regressions), call finish with status "fixed" and a summary of the root cause and the fix.
7. If you exhaust your attempt budget without a passing fix, call finish with status "gave_up" and a summary of what you tried and why it didn't work. Never claim success you haven't verified with run_tests.

Hard rules:
- Never edit test files to make them pass (no .skip, .todo, xit, xdescribe, deleting test cases or test files). A fix that does this will be rejected regardless of what you report.
- Never guess at a fix without first locating the real code with graph_search + read_file.
- apply_edit requires an EXACT match of old_str in the file. Keep edits minimal and scoped to the actual bug.
- You have a limited number of attempts. Don't waste them re-trying the same hypothesis.`;

export interface ToolDef {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

export const TOOLS: ToolDef[] = [
  {
    name: "graph_search",
    description:
      "Search the repo's code graph (Entire) for the code most relevant to a plain-language description of a bug or task. Returns ranked candidate fix sites with source, file:line, and a suggested narrow verify command. Use this BEFORE read_file/grep-style exploration.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Plain-language description of the bug, e.g. 'capitalize duplicates the first character'" },
      },
      required: ["query"],
    },
  },
  {
    name: "graph_explain",
    description:
      "Resolve the declarations of every symbol named in the current failing test output (the error/stack trace). Useful when graph_search alone doesn't pin down the exact function body you need to read.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "read_file",
    description: "Read a file (or a line range of it) from the repo.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to the repo root" },
        start: { type: "integer", description: "1-indexed start line (optional)" },
        end: { type: "integer", description: "1-indexed end line, inclusive (optional)" },
      },
      required: ["path"],
    },
  },
  {
    name: "apply_edit",
    description:
      "Apply an exact search/replace edit to a file. old_str must appear in the file exactly once, verbatim (including whitespace). Fails if old_str isn't found exactly once -- re-read the file and retry with a corrected old_str.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to the repo root" },
        old_str: { type: "string", description: "Exact text to replace (must match exactly once)" },
        new_str: { type: "string", description: "Replacement text" },
      },
      required: ["path", "old_str", "new_str"],
    },
  },
  {
    name: "run_tests",
    description:
      "Run the real test suite and get an adjudicated verdict against the pre-edit baseline: which tests are newly passing, which newly failing (regressions), which were already failing before your changes (pre-existing, ignore). Call this after every apply_edit.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "revert_last_edit",
    description: "Discard all uncommitted changes in the repo, returning it to the baseline (buggy) state. Use this when a hypothesis didn't work out before trying a different one.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "finish",
    description: "End the run. Call this once run_tests has confirmed a PASS verdict, or once you've exhausted your attempt budget.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["fixed", "gave_up"] },
        summary: { type: "string", description: "Root cause, the fix, and how it was verified (or why you gave up)" },
      },
      required: ["status", "summary"],
    },
  },
];
