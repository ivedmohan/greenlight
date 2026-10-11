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

**Planned next:** M1 — seed the benchmark repos (10 buggy cases).

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
