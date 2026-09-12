import { randomUUID } from "node:crypto";
import { createOpenAIAgentsRuntime } from "../src/server/agent/openai-agents.mjs";

// Read-only smoke test: session creation, a function result and same-session recall.
let runtime;
try {
  runtime = await createOpenAIAgentsRuntime();
} catch {
  console.error("Probe not started. Configure OPENAI_API_KEY and install an OpenAI SDK with beta.agents.sessions; see docs/AGENT-RUNTIME.md.");
  process.exit(1);
}
const nonce = randomUUID();
const calls = [];
let sessionId;
const results = new Map(); // Smoke only; production needs a durable call ledger.
const hooks = {
  async onSession(id) { sessionId = id; console.log(`Created session: ${id}`); },
  async executeTool({ sessionId: id, action }) {
    const key = JSON.stringify([id, action.turn_id, action.call_id]);
    if (results.has(key)) return results.get(key);
    if (action.name !== "record_probe" || typeof action.arguments?.token !== "string") {
      throw new Error("Unexpected smoke-test tool call.");
    }
    calls.push({ turnId: action.turn_id, token: action.arguments.token });
    const result = { success: true, output: JSON.stringify({ recorded: true }) };
    results.set(key, result);
    return result;
  },
};
try {
  const first = await runtime.start({
    model: process.env.OPENAI_AGENT_MODEL || "gpt-6-astra",
    instructions: "You are a read-only API connectivity probe. Follow the requested tool call exactly.",
    tools: [{ type: "function", name: "record_probe", description: "Record a test token without external side effects.",
      parameters: { type: "object", properties: { token: { type: "string" } },
        required: ["token"], additionalProperties: false } }],
    input: `Remember this token: ${nonce}. Call record_probe with this token once, then stop.`,
    signal: AbortSignal.timeout(90_000),
  }, hooks);
  if (!calls.some(call => call.turnId === first.turnId && call.token === nonce)) {
    throw new Error("First turn completed without the expected tool call.");
  }
  const second = await runtime.continue({
    sessionId,
    text: "Call record_probe once with the token from the previous message, then stop.",
    signal: AbortSignal.timeout(90_000),
  }, hooks);
  if (second.sessionId !== first.sessionId || second.turnId === first.turnId
    || !calls.some(call => call.turnId === second.turnId && call.token === nonce)) {
    throw new Error("Follow-up did not demonstrate recall in a new turn of the same session.");
  }
  console.log("PASS: created session, executed function, and recalled token in a follow-up turn.");
} catch (error) {
  // Do not print SDK errors wholesale: they may contain request details.
  console.error(`Probe failed (${error?.status ?? error?.name ?? "unknown"}). No live success claimed.`);
  if (sessionId) {
    try { await runtime.cancel(sessionId); }
    catch { console.error("Cancellation was not confirmed; inspect the saved session."); }
  }
  process.exitCode = 1;
} finally {
  if (sessionId) console.log(`Session retained for inspection: ${sessionId}`);
}
