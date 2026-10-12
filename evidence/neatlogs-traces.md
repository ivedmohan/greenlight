# neatlogs trace evidence

Project: **Ved's project** (`73ddd324-c4e6-48fd-8667-2db6335ae52d`), model `qwen/qwen3.8-27b`, workflow `greenlight-bench`. Pulled via the neatlogs MCP server (`search_traces`, `get_trace_context`) connected directly to this Claude Code session -- not screenshots, live queries against real ingested data.

Dashboard: https://app.neatlogs.com/?orgId=6d5f49e5-c0b3-4460-8dc7-729c8ff6fa6a&projectId=73ddd324-c4e6-48fd-8667-2db6335ae52d

Open any trace directly at (verified, not guessed):
`https://app.neatlogs.com/traces/<trace_id>?orgId=6d5f49e5-c0b3-4460-8dc7-729c8ff6fa6a&projectId=73ddd324-c4e6-48fd-8667-2db6335ae52d`

e.g. the recovery trace: https://app.neatlogs.com/traces/273a0a6d6872099b4b84a809031a7241?orgId=6d5f49e5-c0b3-4460-8dc7-729c8ff6fa6a&projectId=73ddd324-c4e6-48fd-8667-2db6335ae52d

## v1 benchmark traces (8 of 9 attempted cases; see hackathon.md for why 1 case has no trace)

| case | status | trace_id |
|---|---|---|
| easy-capitalize | fixed | `34ba0ac6257c80346d152ef9c62e6b1c` |
| easy-clamp | fixed | `dcb7682c83201f5adf9ea7008284e7bc` |
| easy-sum | fixed | `2e5d1966039867c373a532bcc4264368` |
| hard-shared-isplainobject | fixed (+ real recovery, see below) | `273a0a6d6872099b4b84a809031a7241` |
| medium-retry-missing-await | fixed | `32318d6d4a80f036709814102a198a20` |
| medium-slugify-shared-helper | fixed | `030c7647ee577ca40d0c4bc03e60fdba` |
| easy-completed-filter | fixed | `543ac5e7b24eceec42eccd49dab11254` |
| hard-validate-partial-flag-ignored | fixed | `fa7bc3b79690e9625df46e623e8349eb` |

## Recovery evidence (real, not staged)

Trace `273a0a6d6872099b4b84a809031a7241` (`hard-shared-isplainobject`):

1. Agent's first move: `read_file({"path":"src/objects.ts"})` -- a plausible but wrong guess at where `isPlainObject` lives.
2. Tool result: `ERROR: ENOENT: no such file or directory, open '.../src/objects.ts'`, surfaced back to the model as a tool error (ordinary error-handling path in `src/agent/loop.ts`, no special-casing for this).
3. Agent's very next action: `read_file({"path":"src/internal/normalize.ts"})` -- the correct file -- followed by the actual fix and a verified PASS.

neatlogs' own automatic detections tagged this trace `Execution Failed` and `Slow LLM Response` without any detection rules configured for this project (confirmed via `mcp__neatlogs__triage_list`, which currently returns zero cards -- nothing was manually set up).

## Before/after comparison

See `hackathon.md` (M4 and M5 sections) and `agent-bench-v1.json` for the full table. Headline: switching the agent's model from `gpt-oss-120b` to `qwen/qwen3.8-27b` took the same 10-case benchmark from **6/9 fixed** to **8/9 fixed** (two previously-`budget_exceeded` cases -- `medium-retry-missing-await` and `hard-validate-partial-flag-ignored` -- now pass).

## Trace retrieval method (for judges to reproduce)

```
# via the neatlogs MCP server connected to Claude Code (.mcp.json in this repo)
search_traces(query: "greenlight-run", workflow_name: "greenlight-bench")
get_trace_context(trace_id: "<id>")
```
