import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

for (const file of [".env.local", ".env"])
  if (existsSync(file)) loadEnvFile(file);
const args = process.argv.slice(2);
const portIndex = args.findIndex((a) => a === "--port" || a === "-p");
const port = portIndex >= 0 ? args[portIndex + 1] : "3100";
const env = {
  ...process.env,
  RELAY_BASE_URL: process.env.RELAY_BASE_URL || `http://127.0.0.1:${port}`,
};
const next = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    ...(portIndex >= 0 ? args : ["--port", port, ...args]),
  ],
  { stdio: "inherit", env },
);
const worker = spawn(
  process.execPath,
  ["--import", "tsx", "src/server/cases/worker.ts"],
  { stdio: "inherit", env },
);
let closing = false;
function close() {
  if (closing) return;
  closing = true;
  next.kill("SIGTERM");
  worker.kill("SIGTERM");
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
next.on("exit", close);
worker.on("exit", close);
