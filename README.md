# Greenlight

> An autonomous agent that takes a repo with a failing test suite / red CI run, figures out why, writes a fix, verifies it, and opens a pull request — no human in the loop.

Built for [neatHack](https://neatlogs.com/hackathon) (Oct 10–12, 2026).

## Status

🚧 Under active development during the hackathon. See [`hackathon.md`](./hackathon.md) for the build log and evidence checklist.

## What it does

1. Point Greenlight at a repo with a failing test command (or a red GitHub Actions run).
2. It reproduces the failure, locates the relevant code via [Entire](https://entire.io)'s code graph, forms a hypothesis, and patches it.
3. It verifies: originally-failing tests pass, the full suite has no new failures, and no tests were deleted/skipped to "cheat" the fix.
4. If verification fails, it retries with a new hypothesis (up to a budget), recovering from tool errors, timeouts, and regressions along the way.
5. On success, it opens a PR with a summary of the root cause, the fix, and the evidence.

Every run is traced end-to-end in [neatlogs](https://neatlogs.com).

## Stack

- TypeScript / Node.js 20+
- Groq (`qwen/qwen3.8-27b` by default, configurable via `GROQ_MODEL`; OpenAI-compatible API via the `openai` SDK) for the agent's own LLM calls + tool use, traced via the neatlogs TypeScript SDK (`wrapOpenAI`)
- [Entire](https://entire.io) for build checkpoints, the `entire-graph` runtime code graph (locate), and `entire graph verify` (adjudicated pass/fail verdicts)
- [cfo.ai](https://cfo.ai) for the business plan (see `evidence/`)

## Quickstart

```bash
npm install
cp .env.example .env   # fill in GOOGLE_API_KEY, NEATLOGS_API_KEY, GITHUB_TOKEN
npm run dev -- run --repo <path-to-repo> --test "npm test"
# or, to try it against a seeded bench case:
npm run dev -- run --case stringkit/easy-capitalize
```

## Project layout

```
src/        agent loop, tools, tracing, recovery, verification
bench/      seeded buggy repos + benchmark runner
evidence/   traces, before/after numbers, business plan, screenshots
hackathon.md  dated build log + submission evidence checklist
```

## Evidence

See [`hackathon.md`](./hackathon.md) for links to traces, benchmark results, and the business plan.
