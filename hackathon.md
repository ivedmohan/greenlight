# Greenlight — neatHack build log

## Project

**Name:** Greenlight
**One-sentence purpose:** An autonomous agent that turns a red CI run into a merged-ready pull request, with no human in the loop.
**Problem:** Engineers lose time triaging and fixing routine test failures; Greenlight handles the reproduce → locate → patch → verify → recover loop end to end.

## Team

- zoro (solo, so far)

## Stack

- TypeScript / Node.js 20+, Google Gemini (`@google/genai`, `gemini-3.8-flash`) for the agent's own LLM calls
- neatlogs (tracing) — TS SDK
- Entire (build checkpoints) + entire-graph (runtime code graph)
- cfo.ai (business plan)
- GitHub Actions + Octokit (real red-CI → PR demo)

## Build log

### 2026-10-11 — M0: Setup
- Repo initialized, public GitHub repo created under `ivedmohan`.
- Entire CLI 0.11.4 installed via Homebrew; `entire enable` + `entire login` pending (human step).
- Neatlogs API key wired into `.env` (gitignored); project ID `73ddd324-c4e6-48fd-8667-2db6335ae52d`.
- Project scaffolded: `src/` (agent, tools, tracing), `bench/`, `evidence/`.
- Noted doc discrepancies vs. the original build brief:
  - Entire checkpoints are git refs at `refs/entire/checkpoints/<shard>/<id>` (linked via `Entire-Checkpoint` commit trailer), not a `entire/checkpoints/v1` branch.
  - entire-graph's search command is `entire graph query "<text>"`, not `entire graph search`. Setup is `entire graph init-agents --repo .` then `entire graph index`.

- `entire login` completed (human step); `entire auth status` confirms logged in as `github:ivedmohan`, checkpoints syncing to `origin`.

### 2026-10-11 — M1: Benchmark repos
- Built two golden seed projects under `bench/repos/`:
  - `stringkit` — TS utility library (capitalize, slugify, truncate, sum/clamp, array helpers, deepEqual, merge, retryWithBackoff). 8 test files, 36/36 tests passing.
  - `tasks-api` — tiny Express CRUD API for tasks, tested with supertest. 1 test file, 13/13 tests passing.
- Seeded 10 bug cases under `bench/cases/<project>/<id>/` (a `bug.patch` unified diff + `meta.json` with the difficulty and the *observed*, not assumed, failing tests):
  - `easy-capitalize` (stringkit) — `slice(0)` vs `slice(1)` duplicates the first char.
  - `easy-clamp` (stringkit) — off-by-one at the max boundary.
  - `easy-sum` (stringkit) — reduce starts at 1 instead of 0.
  - `medium-slugify-shared-helper` (stringkit) — bug is in `internal/normalize.ts`, not `slugify.ts`.
  - `medium-retry-missing-await` (stringkit) — missing `await` breaks error handling in `retryWithBackoff`.
  - `hard-shared-isplainobject` (stringkit) — one shared-helper bug breaks two unrelated test files at once (`compare.test.ts` + `merge.test.ts`); fix must go in the shared helper.
  - `flaky-retry-backoff-explosion` (stringkit) — backoff formula explodes, causing genuine test **timeouts** (verified at `--testTimeout=3000`, all 3 tests time out), not just wrong assertions.
  - `easy-completed-filter` (tasks-api) — query-string boolean not coerced before filtering.
  - `medium-update-store-bug` (tasks-api) — `updateTask()` returns a non-persisted copy; route code is correct, bug is cross-file.
  - `hard-validate-partial-flag-ignored` (tasks-api) — shared validation ignores the `partial` flag, breaking PATCH while CREATE still needs the required-title check; fix must be conditional.
- Wrote `bench/run-bench.ts`: for every case, copies the golden project, applies its patch, runs the real test suite, and checks observed failing test files against `meta.json`. **Ran it: 10/10 cases match their expectation** (verified, not assumed — see terminal output captured during the build session).
- Wrote `bench/README.md` documenting the layout, patch format/apply convention (`patch -p0`), and how to add a case.
- Noted deviation from the original case list in the build brief: case descriptions/exact bugs were adjusted from the initial plan where the first attempt didn't reproduce the intended failure (e.g. `compare.ts`'s array-handling had to be simplified so the `hard-shared-isplainobject` bug could actually manifest through the shared helper) — every case in this log reflects what was actually verified to fail, not the original plan.

### 2026-10-11 — M2: Agent v1 end-to-end
- **Model switch (deliberate, user-requested):** moved from Anthropic Claude to Google Gemini (`@google/genai`, model `gemini-3.8-flash` -- the API itself told us `gemini-2.5-flash` is retired and to use `gemini-3.8-flash`) for the agent's own LLM calls, to run on Gemini's free tier for the hackathon. Traced via `neatlogs/google-genai`'s `wrapGoogleGenAI`. Verified both the SDK's actual exports and the live API's model-availability error rather than assuming either.
- Built the tool-calling agent loop (`src/agent/loop.ts`) with 7 tools (`graph_search`, `graph_explain`, `read_file`, `apply_edit`, `run_tests`, `revert_last_edit`, `finish`), a system prompt enforcing the reproduce→locate→patch→verify cycle and the no-cheating rule, and per-run cost/attempt budget tracking (`src/agent/state.ts`, persisted to `runs/<id>/state.json` after every step).
- **Upgraded LOCATE and VERIFY to real Entire-graph commands** (stronger than the original plan): `entire graph search` for locating fix sites (ranked, with file:line + source), and `entire graph verify --record-baseline` / `--pre-edit-baseline` for an adjudicated PASS/REGRESSION/NO-EFFECT verdict against a pre-edit baseline, instead of hand-parsing test runner output.
- Anti-cheat guardrail (`src/verify.ts`, pulled forward from M3): rejects a claimed fix if the diff skips/deletes tests. A claimed "fixed" is NEVER trusted directly -- it's always re-verified with `entire graph verify` + the diff check before a commit is made.
- **Two real bugs found and fixed while getting this working (both are real recovery/debugging evidence, not staged):**
  1. vitest's default reporter embeds a nondeterministic duration ("1ms" vs "0ms") in each failing test's name and only names passing tests at file granularity -- this broke `entire graph verify`'s baseline diff (a 100%-unchanged tree was misreported as "4 REGRESSIONS" because the timing suffix differed between the baseline run and the re-run). Fixed by forcing `--reporter=verbose` onto the test command (detected via the target repo's own `package.json` script, since `testCmd` is usually just `"npm test"` and doesn't literally say "vitest").
  2. **Command injection**: `gitCommitAll` built the `git commit -m "..."` command via `execSync` on an interpolated string. The LLM's own commit-message summary contained markdown backticks (e.g. `` `src/capitalize.ts` ``), and `/bin/sh` executes backtick-quoted text as command substitution even inside double quotes -- the shell genuinely tried to run `src/capitalize.ts` and `capitalize` as commands on the first real run. Fixed by switching all of `src/tools/git.ts` to `execFileSync` with argument arrays (no shell involved, so no interpolation risk) instead of `execSync` with a built string.
  3. Added exponential backoff (`src/agent/loop.ts`) after hitting a real transient `503 UNAVAILABLE` from the Gemini API during testing.
- **Ran it end-to-end against `stringkit/easy-capitalize`:** graph_search found the bug (score 21.4 vs 9.4 for the next candidate) → read_file → apply_edit → run_tests → `entire graph verify` returned PASS (4 newly passing, 0 regressions) → committed. Full suite re-verified independently afterward: 36/36 passing. Cost: ~$0.014 (gemini-3.8-flash paid-tier equivalent; actual run was on the free tier). 5 attempts used of a 6-attempt budget.
- Added `--case <project>/<id>` convenience flag to the CLI (materializes a bench case into `runs/<run-id>/workspace` via the shared `bench/lib/prepare.ts` helper, extracted from `run-bench.ts` so both share one tested code path).

**Planned next:** M3 — formalize the recovery handlers already touched above (apply_edit-not-found retry, timeout handling, budget exhaustion -> draft report) and resume-from-state.json. Then M4 — run the full 10-case benchmark through the agent and record the "before" numbers.

## Demo

_TBD — added at M8._

## Known limitations & next steps

_TBD._

## Submission checklist

- [ ] Agent improved: before/after neatlogs traces compared
- [ ] Used neatlogs: trace links / screenshots
- [ ] Used Entire: checkpoint refs + entire-graph output
- [ ] Used cfo.ai: business plan (pricing, costs, revenue, runway)
- [ ] Recovers from failures: a traced run showing a failure + recovery
- [ ] Built in public: #neatHack post links
- [ ] Code written during hackathon: dated commits in a public repo
