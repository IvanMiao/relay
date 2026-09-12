import assert from "node:assert/strict";
import test from "node:test";
import { OpenAIAgentsRuntime } from "../src/server/agent/openai-agents.mjs";

const complete = { type: "agent.session.turn.completed", session_id: "sess_demo",
  turn: { id: "turn_demo", subagent_id: null } };
function setup(events, actions = []) {
  const log = [];
  const stream = {
    controller: { abort() { log.push("abort"); } },
    async *[Symbol.asyncIterator]() { yield* events; },
  };
  const sessions = {
    async create(payload) { log.push({ create: payload }); return stream; },
    async retrieve() { log.push("retrieve"); return { required_actions: actions }; },
    events: {
      async stream() { log.push("subscribe"); return stream; },
      async create(id, payload) { log.push({ id, ...payload }); },
    },
  };
  const runtime = new OpenAIAgentsRuntime({ beta: { agents: { sessions } } });
  const hooks = { async onSession(id) { log.push(`persist:${id}`); },
    async executeTool({ action }) { log.push(`execute:${action.call_id}`); return { success: true, output: "{}" }; } };
  return { runtime, log, hooks };
}
const input = { model: "test-model", instructions: "test", tools: [], input: "test" };

test("persists session before dispatch and uses freshly retrieved pending calls", async () => {
  const { runtime, log, hooks } = setup([
    { type: "agent.session.requires_action", session_id: "sess_demo",
      session: { required_actions: [{ call_id: "stale_call" }] } }, complete,
  ], [{ type: "function_call", name: "probe", arguments: {}, turn_id: "turn_demo", call_id: "current_call" }]);
  const result = await runtime.start(input, hooks);
  assert.equal(result.outcome, "turn_completed");
  assert(log.indexOf("persist:sess_demo") < log.indexOf("execute:current_call"));
  assert(!log.includes("execute:stale_call"));
  const sent = log.find(entry => entry.events);
  assert.equal(sent.events[0].turn_id, "turn_demo");
  assert.equal(sent.events[0].call_id, "current_call");
  assert.equal(log[0].create.environment.type, "none");
  assert.equal(log.at(-1), "abort");
});

test("subscribes before follow-up and preserves session identity", async () => {
  const { runtime, log, hooks } = setup([complete]);
  await runtime.continue({ sessionId: "sess_demo", text: "new reply" }, hooks);
  assert.equal(log[0], "subscribe");
  assert.equal(log[1].id, "sess_demo");
  assert.equal(log[1].events[0].type, "agent.session.input.message");
});

test("idle or truncated stream never means success", async () => {
  const { runtime, hooks } = setup([{ type: "agent.session.idle", session_id: "sess_demo" }]);
  await assert.rejects(runtime.start(input, hooks), /without a completed turn/);
});

test("does not turn an uncertain tool execution into a false failure result or retry", async () => {
  const { runtime, log, hooks } = setup([
    { type: "agent.session.requires_action", session_id: "sess_demo" }, complete,
  ], [{ type: "function_call", name: "probe", arguments: {}, turn_id: "turn_demo", call_id: "call_demo" }]);
  let attempts = 0;
  hooks.executeTool = async () => { attempts++; throw new Error("Save outcome unknown"); };
  await assert.rejects(runtime.start(input, hooks), /Save outcome unknown/);
  assert.equal(attempts, 1);
  assert(!log.some(entry => entry.events));
  assert.equal(log.at(-1), "abort");
});

test("rejects cross-session events and root-turn failures", async () => {
  const foreign = setup([{ ...complete, session_id: "sess_other" }]);
  await assert.rejects(foreign.runtime.continue({ sessionId: "sess_demo", text: "reply" }, foreign.hooks), /different session/);
  const failed = setup([{ ...complete, type: "agent.session.turn.failed" }]);
  await assert.rejects(failed.runtime.start(input, failed.hooks), /did not complete/);
});
