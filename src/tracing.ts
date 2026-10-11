import { init, shutdown, flush } from "neatlogs";

let initialized = false;

export async function initTracing(workflowName: string, tags: string[] = []) {
  if (initialized) return;
  await init({
    apiKey: process.env.NEATLOGS_API_KEY,
    workflowName,
    tags,
  });
  initialized = true;
}

export async function flushTracing() {
  if (!initialized) return;
  await flush();
}

export async function shutdownTracing() {
  if (!initialized) return;
  await flush();
  await shutdown();
  initialized = false;
}
