# Demo video script (≤3:00)

No website needed — this is a terminal tool plus real GitHub activity and three dashboards. Record your screen through these beats; a single take works if you rehearse the tab-switching once.

**Before recording, open these 5 tabs (all verified links — click each to confirm it loads before you hit record):**
1. Terminal, `cd` into the `greenlight` repo
2. https://github.com/ivedmohan/greenlight-demo — the live demo repo (red CI on `main`)
3. https://github.com/ivedmohan/greenlight-demo/pull/1 — the real PR Greenlight opened (green CI)
4. neatlogs trace (a real recovery example): https://app.neatlogs.com/traces/273a0a6d6872099b4b84a809031a7241?orgId=6d5f49e5-c0b3-4460-8dc7-729c8ff6fa6a&projectId=73ddd324-c4e6-48fd-8667-2db6335ae52d
5. Your cfo.ai Decision Dashboard (app.cfo.ai)

Have `evidence/` open in an editor too, for the before/after table.

---

## 0:00–0:20 — The problem

> "CI goes red, and someone has to stop what they're doing, find the bug, fix it, and verify it. Greenlight does that whole loop autonomously — reproduce, locate, patch, verify, commit — no human in the loop."

Show: README.md title + one-line pitch on screen.

## 0:20–1:10 — The real thing: a red repo, fixed live, closed with a real PR

Switch to tab 2 — **github.com/ivedmohan/greenlight-demo**. Show the red ✗ on the `main` branch's latest commit (click into the Actions tab if it's not visible on the repo homepage).

> "This is a plain public repo with a real GitHub Actions check. capitalize() has a bug, and CI is genuinely red right now — not simulated."

Switch to the terminal (tab 1). Either:
- **(a) Run it live:** `npx tsx src/index.ts run --repo <path-to-a-fresh-clone> --max-iterations 6 --max-cost 1` — takes about 2 minutes; narrate the tool calls as they print (`graph_search` → `read_file` → `apply_edit` → `run_tests` → `finish`).
- **(b) Show the already-captured transcript** (faster, zero quota) — this exact run already happened: 5 attempts, $0.0166, result `"status":"fixed"`. Read the summary line out loud from `hackathon.md`'s M6 section.

Then switch to tab 3 — **the real PR**: https://github.com/ivedmohan/greenlight-demo/pull/1. Point at the PR body (written by Greenlight, explaining root cause + fix + verification) and the **green check** on its own CI run.

> "That PR is real — opened by the agent, not me, and its own CI run passed."

## 1:10–1:35 — A real recovery (not staged)

Switch to tab 4, the neatlogs trace for a harder case (`hard-shared-isplainobject`). Point down the step list:

> "The agent doesn't always get it right first try — here it guessed the wrong file [point at the red ERROR span for `read_file({"path":"src/objects.ts"})`], got an error back, and corrected itself on the very next call [point at the next `read_file`, now the right path]. Nobody coded 'if wrong file, retry' — it just does that because that's what the error told it to do."

## 1:35–2:05 — neatlogs: before vs. after

Show the before/after table (`hackathon.md` M5 or `evidence/agent-bench-v1.json`):

> "We ran the same 10-case benchmark on two models. Switching from gpt-oss-120b to qwen3.8-27b took us from 6 of 9 fixed to 8 of 9 — real traces, real improvement, not a guess."

## 2:05–2:30 — Entire: how it locates code, and how it was built

Quick terminal command (or show `evidence/entire-graph-sample.txt`):
```
entire graph search --repo . --query "agent loop that fixes failing tests" --format text --top-k 5
```
> "This is the code graph `graph_search` calls into — ranked, real source, not a grep. Every commit in both repos also has an Entire checkpoint, pushed and visible on GitHub."

## 2:30–2:50 — cfo.ai: the business case

Switch to tab 5:

> "We fed cfo.ai our real measured cost — $0.0165 per fix — and it built the business case: $3-per-fix or $79/repo/month pricing, 90%+ contribution margins, and revenue scenarios from 50 to 1,000 repos — $76K year-one cash at 200 repos on subscription. It also flagged the real open risk honestly: willingness to pay is unproven."

## 2:50–3:00 — Recap

> "Greenlight: red CI in, a real verified PR out, fully traced, built on a real code graph, with a real business case behind it. Repo's at github.com/ivedmohan/greenlight."

Show the repo URL full-screen for the last 2-3 seconds.
