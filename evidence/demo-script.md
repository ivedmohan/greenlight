# Demo video script (≤3:00)

No website needed — this is a terminal tool plus three dashboards (neatlogs, Entire/GitHub, cfo.ai). Record your screen through these beats in order; a single take works if you rehearse the tab-switching once.

**Before recording, open these 4 tabs (all verified links, click to confirm they load before you hit record):**
1. Terminal, `cd` into the `greenlight` repo
2. neatlogs trace (the recovery example): https://app.neatlogs.com/traces/273a0a6d6872099b4b84a809031a7241?orgId=6d5f49e5-c0b3-4460-8dc7-729c8ff6fa6a&projectId=73ddd324-c4e6-48fd-8667-2db6335ae52d
3. https://github.com/ivedmohan/greenlight
4. Your cfo.ai Decision Dashboard (app.cfo.ai, the workspace you already built)

Have `evidence/` open in an editor too, for the before/after table.

---

## 0:00–0:20 — The problem

> "CI goes red, and someone has to stop what they're doing, find the bug, fix it, and verify it. Greenlight does that whole loop autonomously — reproduce, locate, patch, verify, commit — no human in the loop."

Show: README.md title + one-line pitch on screen.

## 0:20–1:10 — A real run, including a real recovery

Switch to the neatlogs trace (tab 2). You'll see a clean step list on the left (`greenlight-bench` / 17 steps / 161s) — this is the literal recorded run, nothing staged for the camera. Point your cursor down the list as you narrate:

1. `graph_index` + `graph_verify_record_baseline` — sets up a baseline on the broken tree (34 passing, 2 failing).
2. `qwen/qwen3.8-27b` (LLM) → `graph_search` (TOOL) — finds the likely fix site via Entire's code graph, not grep.
3. **The real recovery moment**: the next LLM call is followed by an `anonymous` TOOL span marked **ERROR** in red — that's `read_file({"path":"src/objects.ts"})`, a wrong guess, failing with ENOENT. Click it open to show the error text on screen. Say: *"this wasn't scripted — the agent guessed wrong, saw the error, and corrected itself on the very next call."*
4. Next LLM call → `read_file` (TOOL, no error this time) — the correct file, `src/internal/normalize.ts`.
5. `apply_edit` → `run_tests` → the output panel at the bottom shows the final JSON: `"status":"fixed"`, verified PASS, zero regressions, committed.

> "Nothing here was staged — this is the actual trace from a benchmark run."

## 1:10–1:45 — neatlogs: before vs. after

Show the before/after table (from `hackathon.md` M5, or `evidence/agent-bench-v1.json`):

> "We ran the same 10-case benchmark on two models. Switching from gpt-oss-120b to qwen3.8-27b took us from 6 of 9 fixed to 8 of 9 — these two cases [point at medium-retry-missing-await, hard-validate-partial-flag-ignored] went from budget_exceeded to fixed. That's a real improvement loop, measured with real traces, not a guess."

## 1:45–2:15 — Entire: how it was built, and how the agent thinks

Switch to GitHub (tab 3):
- Show the repo's commit history (dated, public) and point out the checkpoint refs — *"every commit has a linked Entire checkpoint, pushed and visible right here."*
- Switch to terminal, run (or show pre-captured `evidence/entire-graph-sample.txt`):
  ```
  entire graph search --repo . --query "agent loop that fixes failing tests" --format text --top-k 5
  ```
- Narrate: *"This is the code graph the agent's `graph_search` tool calls — ranked, real source, not a keyword grep. It's also what found the fix site in the trace we just watched."*

## 2:15–2:45 — cfo.ai: turning the benchmark into a business

Switch to cfo.ai Decision Dashboard (tab 4):

> "We fed cfo.ai our real measured cost — $0.0165 per successful fix — and it built out the actual business case: a $3-per-fix or $79-per-repo-per-month pricing model, contribution margins over 90%, and revenue scenarios from 50 to 1,000 paying repos. At 200 repos we're looking at $76K in year-one cash on the subscription model. It also flagged the real risk honestly: willingness to pay is unproven, that's the thing to validate next."

Scroll to show the pricing recommendation + the 3-scenario revenue table.

## 2:45–3:00 — Recap

> "Greenlight: red CI in, verified PR out, fully traced, built on a real code graph, with a real business case behind it. Repo's at github.com/ivedmohan/greenlight."

Show repo URL full-screen for the last 2-3 seconds.

---

## If you want a live run instead of the trace walkthrough

Swap section 2 (0:20–1:10) for a real terminal run:
```bash
cd /path/to/greenlight
npx tsx src/index.ts run --case stringkit/easy-capitalize --max-iterations 6 --max-cost 1
```
This uses a small amount of Groq quota (~$0.003 equivalent) and takes ~2 minutes end to end — tight for a single take, so consider pre-running it once to time your narration, then recording a second take live.
