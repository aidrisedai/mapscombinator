export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { env } = await import("./lib/server/env");
  env(); // fail fast on invalid configuration
  if (env().RUN_WORKER_IN_PROCESS === "true") {
    const { startWorker } = await import("./lib/server/worker");
    startWorker();
  }
}
