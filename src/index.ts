#!/usr/bin/env node
import { Command } from "commander";
import { initTracing, shutdownTracing } from "./tracing.js";

const program = new Command();

program
  .name("greenlight")
  .description("Autonomous agent that fixes a failing test suite and opens a PR");

program
  .command("run")
  .description("Run Greenlight against a repo with a failing test command")
  .requiredOption("--repo <path>", "path to the target repo")
  .option("--test <cmd>", "test command to run (auto-detected if omitted)")
  .option("--max-iterations <n>", "max fix attempts", "5")
  .option("--max-cost <usd>", "max budget in USD", "1")
  .action(async (opts) => {
    await initTracing("greenlight", [`repo:${opts.repo}`]);
    try {
      // TODO(M2): wire up src/agent/loop.ts
      console.log("Greenlight agent loop not implemented yet. Options:", opts);
    } finally {
      await shutdownTracing();
    }
  });

program.parseAsync(process.argv);
