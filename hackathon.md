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

### 2026-10-11/12 — M4: Full benchmark run (v1) + real provider-reliability findings
- Built `bench/run-agent-bench.ts`: runs the real agent against every seeded case, independently re-verifies "fixed" by re-running the full suite from scratch (never trusts the agent's self-report), writes `evidence/agent-bench-<label>.json`.
- **Hit three more real constraints while running it, each fixed, each genuine recovery/debugging evidence (not staged):**
  1. The model (gpt-oss-120b) would sometimes verify a real PASS via `run_tests`, then stop with a prose wrap-up instead of calling `finish`, burning the remaining attempt budget on nudges. Fixed: a no-tool-call turn immediately following a verified PASS is now treated as an implicit `finish` -- still goes through the same re-verify + anti-cheat gate, never trusted blindly. Added turn-by-turn `GREENLIGHT_DEBUG` logging (finish_reason, content, tool_calls) since this failure mode was otherwise silent.
  2. **Groq's free tier has a 200,000 tokens/day (TPD) cap per model**, hit after 9 of 10 cases in the first full run. The run crashed uncaught (no per-case error isolation in the benchmark script) -- fixed by catching per-case and recording `status: "error"` instead of killing the whole batch.
  3. Added retry-after-aware backoff (parses Groq's "try again in Xm Ys" from the 429 body, capped at 20 min) instead of our short fixed exponential schedule. **Then verified empirically that this doesn't actually help a TPD cap**: watched the same case hit the wall twice in a row (612s wait, then 1121s wait, with *usage still climbing* in between) -- this is a real multi-hour daily limit, not a short burst limit, so waiting it out isn't practical mid-hackathon.
  4. Tried `openai/gpt-oss-20b` (a separate model = separate quota bucket) as a same-day workaround for the one blocked case. Confirmed it has its own quota, but it's materially less reliable at emitting valid JSON tool-call arguments (`400 Failed to parse tool call arguments as JSON` on 8 of 10 cases) and once hallucinated a tool name (`search_file`) that was never declared. Reverted to `gpt-oss-120b` as the real model; `20b` is not a viable substitute.
- **v1 results (9 of 10 cases actually attempted; 10th blocked by the TPD cap above, not run):**

  | case | difficulty | status | attempts | cost |
  |---|---|---|---|---|
  | easy-capitalize | easy | fixed ✓ | 5 | $0.0028 |
  | easy-clamp | easy | fixed ✓ | 5 | $0.0026 |
  | easy-sum | easy | fixed ✓ | 5 | $0.0027 |
  | easy-completed-filter | easy | fixed ✓ | 5 | $0.0029 |
  | medium-slugify-shared-helper | medium | fixed ✓ | 5 | $0.0024 |
  | hard-shared-isplainobject | hard | fixed ✓ | 5 | $0.0029 |
  | medium-retry-missing-await | medium | budget_exceeded ✗ | 8 | $0.0044 |
  | hard-validate-partial-flag-ignored | hard | budget_exceeded ✗ | 8 | $0.0048 |
  | flaky-retry-backoff-explosion | flaky | budget_exceeded ✗ | 8 | $0.0039 |
  | medium-update-store-bug | medium | **not run (quota)** | 0 | $0 |

  **6/9 attempted cases fixed and independently verified green** (all easy cases + 2 of 3 mediums + the hard shared-helper case). The agent reliably handles cross-file bugs and a genuinely shared-root-cause hard case; it does not yet recover from a timeout-class failure (flaky case) or from a validation-logic hard case within an 8-attempt budget -- real, useful signal for M5.
  - Saved to `evidence/agent-bench-v1.json`. Note: the live process crashed on the 10th case (finding #2 above) before writing its own JSON; the file was reconstructed from the actual captured terminal transcript of that run (same numbers, not re-run or guessed) once the crash was understood, and the 10th case is marked `blocked_by_quota` rather than omitted or faked.
- **Relevant for the cfo.ai business plan (M7):** at $0.003-0.005/attempt, a real paid-tier run costs roughly $0.03-0.04 per resolved issue even at this small scale -- worth comparing against engineer time directly. The free-tier daily cap is also a real constraint on "run this unattended at scale" that a serious deployment would need a paid tier for.

**Planned next:** M5 — diagnose the 3 non-fixed cases via neatlogs (why did retry-missing-await, hard-validate-partial-flag-ignored, and the flaky case fail?), improve the agent (prompts/tools/context) into v2, rerun the same 10 cases, and record the before/after comparison. Then M3's remaining formal recovery items (resume-from-state.json) if time allows -- most of M3's spirit (backoff, anti-cheat, budget handling) already landed opportunistically during M2/M4.

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
