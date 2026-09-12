import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { caseStore, event, type Job } from "./store";
import { seedContext } from "./context";
import { agentTools, dispatchTool, instructions } from "./tools";
import { createOpenAIAgentsRuntime } from "../agent/openai-agents.mjs";
import { executeDraft } from "./browser";

const store = caseStore(),
  owner = "worker_" + randomUUID();
seedContext(store);
let stopping = false,
  active: Job | undefined;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
const beat = setInterval(() => store.beat(owner, active), 3000);
store.beat(owner);
console.log(
  "Relay worker ready: durable case queue and isolated portal browser.",
);
async function work(job: Job) {
  if (store.get(job.case_id).snapshot.status === "paused") {
    store.finish(job);
    return;
  }
  const runtime = await createOpenAIAgentsRuntime();
  const abort = new AbortController();
  const deadline = setTimeout(
    () => abort.abort(new Error("Agent turn timed out.")),
    180000,
  );
  let cancelRequested = false;
  const watch = setInterval(() => {
    if (
      !store.owns(job) ||
      store.get(job.case_id).snapshot.status === "paused" ||
      stopping
    ) {
      if (!cancelRequested) {
        cancelRequested = true;
        abort.abort();
        const sessionId = store.get(job.case_id).sessionId;
        if (sessionId) void runtime.cancel(sessionId).catch(() => {});
      }
    }
  }, 500);
  const hooks = {
    async onSession(sessionId: string) {
      store.update(
        job.case_id,
        (r) => {
          r.sessionId = sessionId;
        },
        false,
      );
      store.jobPhase(job, "active");
    },
    async onEvent(_event: unknown) {},
    async executeTool({
      sessionId,
      action,
    }: {
      sessionId: string;
      action: {
        turn_id: string;
        call_id: string;
        name: string;
        arguments: unknown;
      };
    }) {
      if (abort.signal.aborted) throw new Error("Case execution interrupted.");
      return dispatchTool(store, job, action, sessionId);
    },
  };
  try {
    const current = store.get(job.case_id);
    // An interrupted write is reconciled directly before asking the model to do
    // anything else; this path can only read an existing record after 'saving'.
    if (
      job.kind === "resume" &&
      current.approved &&
      current.execution &&
      current.execution.phase !== "preparing"
    ) {
      await executeDraft(store, job);
    } else if (job.phase !== "pending" && current.sessionId) {
      await runtime.recover(
        { sessionId: current.sessionId, signal: abort.signal },
        hooks,
      );
    } else {
      const input = `Application event ${job.id} (${job.kind}). ${job.input}\nRead current persisted context before deciding. Never treat this event as permission beyond the stored authorization.`;
      if (current.sessionId) {
        const session = await runtime.retrieve(current.sessionId);
        if (session.status !== "idle") {
          await runtime.recover(
            { sessionId: current.sessionId, signal: abort.signal },
            hooks,
          );
          if (store.get(job.case_id).snapshot.status !== "running") return;
        }
        store.jobPhase(job, "sending");
        await runtime.continue(
          { sessionId: current.sessionId, text: input, signal: abort.signal },
          hooks,
        );
      } else {
        if (job.phase !== "pending")
          throw new Error(
            "Session creation was interrupted before its ID was recorded. Resume explicitly to start fresh.",
          );
        store.jobPhase(job, "sending");
        await runtime.start(
          {
            model: process.env.OPENAI_AGENT_MODEL || "gpt-6-astra",
            instructions,
            tools: agentTools,
            input,
            signal: abort.signal,
          },
          hooks,
        );
      }
    }
    const result = store.get(job.case_id).snapshot;
    if (result.status === "running")
      throw new Error(
        "The agent stopped before proposing the next action. Resume to continue from saved context.",
      );
    console.log(`Relay ${job.case_id}: ${result.status}`);
  } catch (error) {
    const err = error as { status?: number; code?: string; message?: string };
    // SDK request bodies may include credentials; only emit our safe message or HTTP status.
    const message = err.status
      ? `Agent request failed (HTTP ${err.status}). Check API access and resume.`
      : error instanceof Error && !error.constructor.name.includes("API")
        ? error.message
        : "Agent connection interrupted. Resume to reconcile saved work.";
    console.error(`Relay ${job.case_id}: ${message}`);
    store.update(job.case_id, (r) => {
      if (r.snapshot.status === "paused" || r.snapshot.receipt) return;
      // A finished proposal remains reviewable even if the trailing model stream disconnects.
      if (
        ["waiting_for_reply", "waiting_for_authorization"].includes(
          r.snapshot.status,
        )
      )
        return;
      r.snapshot.status = "failed";
      r.snapshot.blocker = {
        code:
          r.execution?.phase === "saving"
            ? "reconciliation_required"
            : "execution_error",
        message,
        taskId: r.snapshot.currentTask,
      };
      event(r.snapshot, "error", message);
    });
  } finally {
    clearInterval(watch);
    clearTimeout(deadline);
    store.finish(job);
  }
}
async function main() {
  try {
    while (!stopping) {
      active = store.claim(owner);
      if (active) {
        try {
          await work(active);
        } catch {
          console.error(
            "Worker could not initialize this job; check server configuration.",
          );
          store.update(active.case_id, (r) => {
            if (r.snapshot.status !== "paused" && !r.snapshot.receipt) {
              r.snapshot.status = "failed";
              r.snapshot.blocker = {
                code: "execution_error",
                message:
                  "Worker could not initialize. Check server configuration and resume.",
                taskId: r.snapshot.currentTask,
              };
              event(r.snapshot, "error", r.snapshot.blocker.message);
            }
          });
          store.finish(active);
        }
      } else await delay(500);
      active = undefined;
    }
  } finally {
    clearInterval(beat);
    store.close();
  }
}
void main();
