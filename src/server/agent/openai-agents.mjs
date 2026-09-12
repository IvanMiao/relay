/** Server-only Agents API adapter. Does not authorize actions or mark cases complete.
 * SDK reference: https://developers.openai.com/api/docs/guides/agents-api/sessions
 */
export async function createOpenAIAgentsRuntime() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error(
      "Set OPENAI_API_KEY in your server environment or .env.local.",
    );
  }
  const { default: OpenAI } = await import("openai");
  // Automatic POST retries could duplicate input after an ambiguous response.
  return new OpenAIAgentsRuntime(
    new OpenAI({ maxRetries: 0, timeout: 30_000 }),
  );
}

export class OpenAIAgentsRuntime {
  constructor(client) {
    if (!client.beta?.agents?.sessions) {
      throw new Error(
        "Installed OpenAI SDK does not expose beta.agents.sessions. Update openai.",
      );
    }
    this.sessions = client.beta.agents.sessions;
  }

  async start({ model, instructions, tools, input, signal }, hooks) {
    const stream = await this.sessions.create(
      {
        agent: { model, instructions, tools, reasoning: { effort: "low" } },
        environment: { type: "none" },
        input,
        stream: true,
      },
      { signal },
    );
    return this.consume(stream, null, hooks, signal);
  }

  async continue({ sessionId, text, signal }, hooks) {
    // Subscribe before sending to avoid missing the start of a short turn.
    const stream = await this.sessions.events.stream(sessionId, { signal });
    try {
      await this.sessions.events.create(
        sessionId,
        {
          events: [
            {
              type: "agent.session.input.message",
              input: [
                { role: "user", content: [{ type: "input_text", text }] },
              ],
            },
          ],
        },
        { signal },
      );
      return await this.consume(stream, sessionId, hooks, signal);
    } finally {
      stream.controller.abort();
    }
  }

  async cancel(sessionId) {
    await this.sessions.events.create(sessionId, {
      events: [{ type: "agent.session.input.cancel" }],
    });
  }

  async recover({ sessionId, signal }, hooks) {
    // Subscribe first; streams do not replay. Reconcile persisted state and pending
    // calls before listening, without resending the original input message.
    const stream = await this.sessions.events.stream(sessionId, { signal });
    try {
      await this.savedItems(sessionId);
      const session = await this.sessions.retrieve(sessionId, { signal });
      if (session.status === "idle")
        return { sessionId, outcome: "reconciled_idle" };
      if (session.status === "failed")
        throw new Error("Saved agent session is failed.");
      const recovered = {
        controller: stream.controller,
        async *[Symbol.asyncIterator]() {
          if (session.required_actions?.length)
            yield {
              type: "agent.session.requires_action",
              session_id: sessionId,
            };
          yield* stream;
        },
      };
      return await this.consume(recovered, sessionId, hooks, signal);
    } finally {
      stream.controller.abort();
    }
  }

  async retrieve(sessionId) {
    return this.sessions.retrieve(sessionId);
  }

  async savedItems(sessionId) {
    const items = [];
    // SDK paginator retrieves all pages, including after a disconnected stream.
    for await (const item of this.sessions.items.list(sessionId, {
      order: "asc",
      limit: 100,
    })) {
      items.push(item);
    }
    return items;
  }

  async consume(stream, sessionId, hooks, signal) {
    try {
      for await (const event of stream) {
        signal?.throwIfAborted();
        const observedSessionId = event.session_id ?? event.session?.id;
        if (sessionId && observedSessionId && sessionId !== observedSessionId) {
          throw new Error("Agents API event belongs to a different session.");
        }
        if (!sessionId && observedSessionId) {
          sessionId = observedSessionId;
          // Await durable case/session mapping before executing any tools.
          await hooks.onSession(sessionId);
        }
        await hooks.onEvent?.(event);
        if (event.type === "agent.session.requires_action") {
          if (!sessionId)
            throw new Error("Required action arrived without a session ID.");
          const session = await this.sessions.retrieve(sessionId, { signal });
          if (!Array.isArray(session.required_actions)) {
            throw new Error("Agents API response is missing required_actions.");
          }
          for (const action of session.required_actions) {
            signal?.throwIfAborted();
            if (action.type !== "function_call") {
              throw new Error(`Unsupported required action: ${action.type}`);
            }
            if (!action.turn_id || !action.call_id || !action.name) {
              throw new Error("Malformed function call; execution stopped.");
            }
            // Application dispatcher MUST validate arguments, enforce permissions,
            // serialize per case and persist/reuse results by session/turn/call.
            // Do not catch dispatcher errors and pretend the side effect failed:
            // an interrupted save may have succeeded and needs reconciliation.
            const outcome = await hooks.executeTool({ sessionId, action });
            if (
              !outcome ||
              (outcome.success === true
                ? typeof outcome.output !== "string"
                : outcome.success !== false ||
                  typeof outcome.error !== "string")
            ) {
              throw new Error(
                "Tool dispatcher must return a serialized success or error result.",
              );
            }
            await this.sessions.events.create(
              sessionId,
              {
                events: [
                  {
                    type: "agent.session.input.tool_result",
                    turn_id: action.turn_id,
                    call_id: action.call_id,
                    ...(outcome.success
                      ? { success: true, output: outcome.output }
                      : { success: false, error: outcome.error }),
                  },
                ],
              },
              { signal },
            );
          }
        }
        if (
          [
            "error",
            "agent.session.failed",
            "agent.session.environment.failed",
          ].includes(event.type)
        ) {
          throw new Error(`Agents API lifecycle failure: ${event.type}`);
        }
        if (event.turn?.subagent_id === null) {
          if (
            [
              "agent.session.turn.failed",
              "agent.session.turn.cancelled",
            ].includes(event.type)
          ) {
            throw new Error(`Agents API turn did not complete: ${event.type}`);
          }
          if (event.type === "agent.session.turn.completed") {
            if (!sessionId || !event.turn.id)
              throw new Error("Completed turn lacks identity.");
            return {
              sessionId,
              turnId: event.turn.id,
              outcome: "turn_completed",
            };
          }
        }
      }
      throw new Error(
        "Stream ended without a completed turn. Retrieve session and saved items before retrying.",
      );
    } finally {
      stream.controller.abort();
    }
  }
}
