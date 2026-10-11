# Bench

Seeded buggy repos used to measure Greenlight's reliability with real before/after numbers instead of vibes.

## Layout

```
bench/
├── repos/<project>/        golden, all-tests-passing seed project
├── cases/<project>/<id>/   one bug case:
│     bug.patch               unified diff, golden -> buggy
│     meta.json               difficulty, description, expected failing tests
└── run-bench.ts            verifies every case's patch actually produces the expected failures
```

## Seed projects

- **`stringkit`** — a small TS utility library (capitalize, slugify, truncate, sum/clamp, array helpers, deepEqual, merge, retryWithBackoff). 8 test files, 36 tests, all passing on `main`.
- **`tasks-api`** — a tiny Express CRUD API for tasks, tested with supertest against the app directly (no real server/port). 1 test file, 13 tests, all passing on `main`.

## Patch format

Patches are generated with `diff -u <golden-file> <buggy-file>`, with the diff header paths rewritten to be relative to the project root (e.g. `src/capitalize.ts`). Apply them with:

```bash
cd bench/repos/<project>   # or a copy of it
patch -p0 < ../../cases/<project>/<case-id>/bug.patch
```

`-p0` (not `-p1`) because the paths in the patch are already project-root-relative with no extra leading directory component.

## The 10 cases

| id | project | difficulty | what's wrong |
|---|---|---|---|
| `easy-capitalize` | stringkit | easy | `capitalize()` duplicates the first char instead of dropping it (`slice(0)` vs `slice(1)`) |
| `easy-clamp` | stringkit | easy | `clamp()` off-by-one at the max boundary |
| `easy-sum` | stringkit | easy | `sum()` reduce starts at 1 instead of 0 |
| `medium-slugify-shared-helper` | stringkit | medium | bug lives in `internal/normalize.ts`, not in `slugify.ts` — the file most obviously related to the failing test is NOT where the fix goes |
| `medium-retry-missing-await` | stringkit | medium | missing `await` on an inner async call breaks error handling |
| `hard-shared-isplainobject` | stringkit | hard | one shared helper (`isPlainObject`) bug breaks two unrelated test files (`compare.test.ts` and `merge.test.ts`) at once; the fix must go in the shared helper, not one call site |
| `flaky-retry-backoff-explosion` | stringkit | flaky | backoff formula explodes, causing genuine test **timeouts**, not just wrong assertions — exercises the agent's timeout-recovery path |
| `easy-completed-filter` | tasks-api | easy | query-string boolean isn't coerced before being passed to the store's filter |
| `medium-update-store-bug` | tasks-api | medium | `updateTask()` returns a non-persisted copy; the route code calling it is correct — cross-file root cause |
| `hard-validate-partial-flag-ignored` | tasks-api | hard | shared validation function ignores the `partial` flag for the required-title check, breaking PATCH while CREATE still needs to require a title — the fix must be conditional, not a blanket removal |

## Adding a new case

1. Copy the golden project to a scratch dir (outside `bench/`, e.g. under `runs/`, which is gitignored).
2. Introduce the bug, run the project's tests, and read the actual output — don't guess which tests fail.
3. `diff -u bench/repos/<project>/<file> <scratch>/<file> | sed 's|bench/repos/<project>/||; s|<scratch>/||' > bench/cases/<project>/<id>/bug.patch`
4. Write `meta.json` with the **observed** failing test names, not the intended ones.
5. Revert the scratch copy, then run `tsx bench/run-bench.ts` and confirm the new case passes.

## Running the verification

```bash
npx tsx bench/run-bench.ts
```

For each case this copies the golden project to `runs/bench-verify/<project>/<id>/` (symlinking in `node_modules` from the golden project so it doesn't reinstall for every case), applies the patch, runs the test suite, and checks the observed failing test files against `meta.json`. Exits non-zero if any case doesn't match.
