# OpenAI Agents API — Assessment for Relay

**Checked:** September 12, 2026

**Method:** Official OpenAI documentation and API reference, including fetched page contents. No live API request, account-entitlement check, benchmark, or billing test was performed.

**Decision:** Recommend Agents API for Relay's persistent case coordinator, with an application-controlled browser executor and explicit business state.

## 1. What is new

The official changelog dates the **Agents API public beta to September 10, 2026**. It exposes an OpenAI-managed Codex harness with session orchestration, context compaction, recovery, and connections to application tools and MCP servers. This is a distinct runtime from the Agents SDK and direct Responses API integration. [Official changelog](https://developers.openai.com/api/docs/changelog).

| Option | Responsibility split | Fit for Relay |
| --- | --- | --- |
| Agents API | OpenAI manages the harness and saved agent sessions; Relay provides tools and business controls | Recommended for work that continues across replies and handoffs |
| Agents SDK | Relay runs the SDK and controls deployment, storage, and runtime integration | Alternative when application-owned orchestration is required |
| Responses API | Relay integrates model responses and manages the surrounding execution loop | Fallback or a separately scoped component when more direct control is needed |

These alternatives have different state and environment lifecycles. They should not be described as interchangeable resources. [Official runtime comparison](https://developers.openai.com/api/docs/guides/agents).

## 2. Recommended product feature

**Live Case Handoff: start once, continue with the evidence already collected.**

For Relay, the valuable capability is continuing the same purchase case after a person replies, an operational contact changes, or the employee leaves and returns to the interface.

The feature combines three product behaviors:

1. **Continue:** Retain the request's model context while Relay stores explicit facts, tasks, and evidence.
2. **Adapt:** Incorporate a verified handover or new requirement and revise affected work.
3. **Finish visibly:** Execute the authorized application step and retrieve the resulting business record.

OpenAI supplies the persistent session infrastructure. The ownership rules, case lifecycle, and definition of a completed purchase step are Relay product logic, not built-in procurement capabilities.

## 3. Verified capability mapping

| Official capability | Relay use | Relay must still implement |
| --- | --- | --- |
| Saved sessions and asynchronous turns | Keep one execution context per case | Case-to-session mapping, tenant isolation, business records |
| Follow-up input and mid-turn steering | Continue after a reply or incorporate a correction | Authenticate and correlate external replies; reconcile changes |
| Function tools and required actions | Search company context, prepare materials, operate approved systems | Actual tool handlers, authorization, retry and side-effect controls |
| MCP connections | Connect approved workplace tools | Connector credentials, source permissions, tool allowlists |
| Events, saved items, and webhooks | Show progress and recover disconnected interfaces | Signature verification, inbound queue, duplicate handling, UI state |
| Optional sandbox and artifact work | Process quotes and produce request materials | Appropriate environment setup, access limits, artifact retention |

Sources: [Agents API overview](https://developers.openai.com/api/docs/guides/agents-api/overview), [session lifecycle](https://developers.openai.com/api/docs/guides/agents-api/sessions), [configuration](https://developers.openai.com/api/docs/guides/agents-api/configuration), and [function tools](https://developers.openai.com/api/docs/guides/agents-api/tools/functions).

## 4. Integration contract

### Session creation

Use the current OpenAI SDK's `client.beta.agents.sessions.create(...)` entry point. The documented HTTP surface uses `/v1/agents/sessions` with `OpenAI-Beta: agents=v1`; SDKs add the beta header.

The quickstart requires an application key with `api.agents.read`, `api.agents.write`, and `api.responses.write`. Keep it on the Relay backend and outside any agent-controlled sandbox. Validate actual project access before committing the prototype to this runtime. The official quickstart uses `gpt-6-astra`; keep model selection configurable and check the chosen model's availability and latency. [Quickstart](https://developers.openai.com/api/docs/guides/agents-api/quickstart).

A minimal Relay session can use `environment.type: "none"` and application-hosted function handlers, including a separately managed browser worker. This avoids assuming that the session automatically supplies a browser. Sessions without an environment require initial input. If an agent sandbox is needed later, choose and configure an OpenAI-hosted or self-hosted environment explicitly. [Configuration](https://developers.openai.com/api/docs/guides/agents-api/configuration).

### Messages and tools

- Append a new reply as `agent.session.input.message` to the existing session. Input starts a turn when idle or steers the active turn.
- For function execution, inspect the session's current `required_actions` rather than treating any historical tool-call item as pending.
- Return `agent.session.input.tool_result` with the pending action's `turn_id` and `call_id`, preserving success or error status.
- Save side-effect results durably by session, turn, and call. If execution may already have succeeded, reconcile the destination before repeating it.

The first behavior is documented in [sessions](https://developers.openai.com/api/docs/guides/agents-api/sessions); tool execution and recovery are documented in [functions](https://developers.openai.com/api/docs/guides/agents-api/tools/functions).

### Waiting for a person

A request for human clarification should create a pending Relay task and return that fact promptly to the agent. It should not keep a function handler open for days. Other independent tasks may continue. The reply is later authenticated, stored, and appended to the same session.

Relay must own reminder times, escalation rules, communication permissions, and inbound message delivery. Session persistence does not itself provide these business workflows.

## 5. Computer use: a strong execution feature

The official computer-use guide explicitly covers filling forms and operating browser or desktop interfaces. It recommends code execution for GPT-6 Astra, while retaining a structured `computer` tool alternative. Existing function or MCP UI tools are also supported integration approaches. [Computer use](https://developers.openai.com/api/docs/guides/tools-computer-use).

For Relay, expose an isolated browser worker through application function tools. The agent receives current page observations, chooses bounded UI actions or a browser script, and inspects the resulting state. A final read-back verifies the saved draft and attachments.

The browser worker is Relay infrastructure. An Agents API session does not imply a provisioned GUI, an authenticated ERP account, or a browser that survives process loss. Restoring conversation state does not restore login state. Keep browser recovery separate from case recovery. [Computer-use state guidance](https://developers.openai.com/api/docs/guides/tools-computer-use#preserve-state-and-return-observations).

Use API handlers when they provide a reliable supported operation. Use computer use where the UI is the available execution path. Both routes must enforce the same actor permissions and business-action authorization.

## 6. Events and recovery details

Stream the first session creation or subscribe before sending follow-up input. After a disconnect, retrieve the session and saved items; event streams do not replay missed events. A completed turn can contain failed tools, and idle does not mean the procurement objective succeeded. [Session recovery](https://developers.openai.com/api/docs/guides/agents-api/sessions).

For webhooks, distinguish the documented webhook name `agent.session.action_required` from the function-flow event `agent.session.requires_action`. A webhook identifies the session and action category; retrieve current `required_actions` for call details. Verify signatures before processing events. [Session webhooks](https://developers.openai.com/api/docs/guides/agents-api/sessions/webhooks).

For a later pilot, persist incoming Slack/Teams events before attempting session delivery. Add provider-event deduplication, per-case coordination, and destination reconciliation for uncertain writes. These are proposed Relay requirements, not automatic guarantees of the API.

## 7. Enterprise boundaries and uncertainties

- **Data controls:** The current Agents API overview specifies US-only data residency and no ZDR support. A self-hosted sandbox does not change those API-level limitations. Confirm company requirements before processing real internal materials. [Overview](https://developers.openai.com/api/docs/guides/agents-api/overview).
- **Authority:** Policy precedence, delegated authority, purchasing approval, and source ACLs are Relay responsibilities. A model output cannot grant a permission.
- **Audit:** Keep explicit business events, evidence versions, action authorizations, and destination receipts. Model conversation history alone is insufficient for this requirement.
- **Access:** Public beta documentation does not verify the specific team's key permissions, model access, quotas, or deployed SDK version. No live availability claim is made here.
- **Cost and speed:** Measure with the actual case and tool chain. No completion-time or cost-per-case estimate has been validated.

## 8. Prototype decision and fallback

Spend the first 15 implementation minutes verifying session creation, a function call, and a follow-up on the same session. Then build the procurement case around that proven path.

The decisive demonstration is a new requirement arriving after the case has paused, followed by verified browser execution without restating the original request. Keep automatic reminder scheduling, multi-agent delegation, additional purchasing systems, and voice interaction outside the two-hour target.

If Agents API access cannot be established, use a direct Responses integration with Relay-owned state and disclose the substitution. That fallback can prove the product workflow, but it must not be presented as a live demonstration of the new managed Agents API.
