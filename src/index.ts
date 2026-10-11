#!/usr/bin/env node
import "dotenv/config";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Command } from "commander";
import { initTracing, shutdownTracing } from "./tracing.js";
import { runAgent } from "./agent/loop.js";
import { materializeCase } from "../bench/lib/prepare.js";

const program = new Command();

program
  .name("greenlight")
  .description("Autonomous agent that fixes a failing test suite and opens a PR");

program
  .command("run")
  .description("Run Greenlight against a repo with a failing test command")
  .option("--repo <path>", "path to the target repo")
  .option("--case <project/id>", "shortcut: materialize a bench case (e.g. stringkit/easy-capitalize) into runs/<run-id>/workspace and run against it")
  .option("--test <cmd>", "test command to run", "npm test")
  .option("--max-iterations <n>", "max fix attempts", "5")
  .option("--max-cost <usd>", "max budget in USD", "1")
  .action(async (opts) => {
    const runId = `run-${Date.now()}-${randomUUID().slice(0, 8)}`;
    await initTracing("greenlight", [`run:${runId}`]);

    try {
      let repoDir: string;
      if (opts.case) {
        const [project, caseId] = String(opts.case).split("/");
        if (!project || !caseId) throw new Error("--case must be <project>/<case-id>, e.g. stringkit/easy-capitalize");
        repoDir = path.resolve(process.cwd(), "runs", runId, "workspace");
        await materializeCase(project, caseId, repoDir, { gitInit: true });
        console.log(`Materialized bench case ${opts.case} into ${repoDir}`);
      } else if (opts.repo) {
        repoDir = path.resolve(process.cwd(), opts.repo);
      } else {
        throw new Error("Pass either --repo <path> or --case <project>/<id>");
      }

      const result = await runAgent({
        repoDir,
        testCmd: opts.test,
        maxIterations: Number(opts.maxIterations),
        maxCostUsd: Number(opts.maxCost),
        runId,
      });

      console.log("\n--- Greenlight run result ---");
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.status === "fixed" ? 0 : 1;
    } finally {
      await shutdownTracing();
    }
  });

program.parseAsync(process.argv);
