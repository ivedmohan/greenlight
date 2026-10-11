import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// gemini-3.8-flash paid-tier pricing (through 2026-12-31) as of this build
// (https://ai.google.dev/gemini-api/docs/pricing): $0.75 / MTok input,
// $3.75 / MTok output. The hackathon runs on the free tier (cost is $0
// there) -- this estimate is what a run WOULD cost if billed, used for the
// --max-cost budget and the cfo.ai unit-economics math.
const INPUT_USD_PER_TOKEN = 0.75 / 1_000_000;
const OUTPUT_USD_PER_TOKEN = 3.75 / 1_000_000;

export interface RunState {
  runId: string;
  repoDir: string;
  testCmd: string;
  maxIterations: number;
  maxCostUsd: number;
  attempt: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  hypotheses: { attempt: number; summary: string; verdict: string }[];
  recoveries: { attempt: number; kind: string; detail: string }[];
  status: "running" | "fixed" | "gave_up" | "budget_exceeded";
}

export function newRunState(opts: {
  runId: string;
  repoDir: string;
  testCmd: string;
  maxIterations: number;
  maxCostUsd: number;
}): RunState {
  return {
    ...opts,
    attempt: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    hypotheses: [],
    recoveries: [],
    status: "running",
  };
}

export function recordUsage(state: RunState, inputTokens: number, outputTokens: number): void {
  state.inputTokens += inputTokens;
  state.outputTokens += outputTokens;
  state.costUsd = state.inputTokens * INPUT_USD_PER_TOKEN + state.outputTokens * OUTPUT_USD_PER_TOKEN;
}

export function overBudget(state: RunState): boolean {
  return state.attempt >= state.maxIterations || state.costUsd >= state.maxCostUsd;
}

export function persistState(state: RunState, runsDir: string): void {
  const dir = path.join(runsDir, state.runId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "state.json"), JSON.stringify(state, null, 2));
}
