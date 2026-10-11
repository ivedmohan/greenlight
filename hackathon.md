# Greenlight — neatHack build log

## Project

**Name:** Greenlight
**One-sentence purpose:** An autonomous agent that turns a red CI run into a merged-ready pull request, with no human in the loop.
**Problem:** Engineers lose time triaging and fixing routine test failures; Greenlight handles the reproduce → locate → patch → verify → recover loop end to end.

## Team

- zoro (solo, so far)

## Stack

- TypeScript / Node.js 20+, Anthropic SDK
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

**Planned next:** M2 — agent v1 end-to-end (reproduce → locate → patch → verify → commit loop, traced in neatlogs) against one easy case locally.

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
