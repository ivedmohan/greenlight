# Unit economics

Real numbers from the v1 benchmark run (`agent-bench-v1.json`), model `qwen/qwen3.8-27b` on Groq. Every figure below is computed from actual `prompt_tokens`/`completion_tokens` pulled from neatlogs via `get_trace_context`, not estimated.

## Success rate

- **9 of 10** seeded bug cases were actually attempted (1 blocked mid-run by Groq's shared daily token quota — see `hackathon.md` M4/M5).
- **8 of 9 attempted cases fixed and independently re-verified green** (88.9%) — the agent's own "fixed" claim is never trusted; a separate, fresh `npx vitest run` confirms the full suite passes before counting a case as solved.
- The one attempted failure is the flaky/timeout case — a real, consistent weak spot (also failed on `gpt-oss-120b`), not cherry-picked.

## Cost per fix

| case | difficulty | prompt tokens | completion tokens | cost (qwen pricing: $0.80/$4.00 per MTok) |
|---|---|---:|---:|---:|
| easy-capitalize | easy | 19,952 | 341 | $0.0173 |
| easy-clamp | easy | 17,892 | 266 | $0.0154 |
| easy-sum | easy | 18,544 | 375 | $0.0163 |
| hard-shared-isplainobject | hard | 18,623 | 409 | $0.0165 |
| medium-retry-missing-await | medium | 12,072 | 277 | $0.0108 |
| medium-slugify-shared-helper | medium | 16,961 | 358 | $0.0150 |
| easy-completed-filter | easy | 16,725 | 333 | $0.0147 |
| hard-validate-partial-flag-ignored | hard | 28,849 | 683 | $0.0258 |

- **Average cost per successful fix: ~$0.0165** (range $0.011–$0.026, harder cases cost more due to more locate/patch/verify iterations).
- **Actual run cost today: $0** — Groq's free tier covers all of this; the table above is what it WOULD cost on the paid tier, which is the right number to model pricing against (a real deployment will eventually need the paid tier once past the free daily quota).
- Model choice matters a lot here: the same benchmark on `gpt-oss-120b` (cheaper at $0.15/$0.60 per MTok) would cost roughly 5-7x less per fix, but fixed 2 fewer cases (6/9 vs 8/9). There's a real capability/cost tradeoff to model as a pricing lever (e.g., try a cheap model first, escalate to a stronger one on repeated failure).

## Time per fix

Full agent-run duration (clone → index → reproduce → locate → patch → verify → commit), end to end: **100-250 seconds** per case (most of that is 4-6 sequential LLM calls at ~20-35s each on Groq; tool calls themselves are sub-second).

## Comparison to a human fixing the same bug

For small, well-scoped bugs like these (a failing test with a clear assertion diff, codebase already set up), a reasonable engineer-time estimate is 10-20 minutes per fix including locating the bug, writing the patch, and verifying — longer if unfamiliar with the code, shorter for a trivial one-liner once found. At a loaded cost of ~$50-75/hr for a software engineer, that's **roughly $8-25 per fix** in human time.

Greenlight's ~$0.0165/fix is **roughly 500-1500x cheaper** than a human at this task class, and runs unattended, in parallel, at any hour — the real value isn't replacing an engineer's judgment on hard problems, it's clearing the long tail of small, well-defined test failures that interrupt a human's flow without needing their attention at all.

## Caveats (be honest about these in the pitch)

- This is a *small, curated benchmark* (10 seeded bugs in two small TS projects), not a measure of real-world coverage across arbitrary codebases.
- The flaky/timeout case shows a genuine current limitation: the agent doesn't yet have a strategy specific to "the test timed out" vs. "the assertion failed."
- Free-tier quotas (Groq's 200K tokens/day, shared across models) are a real constraint for "run this unattended at scale" — a production deployment needs the paid tier, which is exactly the cost model above.
