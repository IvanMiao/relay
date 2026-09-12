# Relay — Two-Person Development Plan

**Scope:** One working procurement case in a two-hour prototype. The product UI and local portal track is now implemented; see [UI handoff](UI-HANDOFF.md). Both tracks and the live end-to-end integration are now implemented; see [runbook](RUNBOOK.md).

**Current assignment:** You own the agent and execution. Your teammate owns product experience, application setup, and the test procurement portal. The role-based labels below apply throughout this plan.

**Frozen interface:** [API contract v1](API-CONTRACT.md) and [shared TypeScript types](../src/lib/contracts.ts) now define the routes, payloads, field labels, errors, and retry semantics. Use them for implementation; where this earlier plan offers alternatives, the frozen contract takes precedence.

## 1. Shared finish line

An employee starts a non-standard purchase from the procurement page. Relay resolves an outdated contact using valid handover and delegation evidence, asks a targeted question, incorporates a test participant's reply into the same case, and prepares the materials. After draft creation is authorized, the agent operates the actual test portal form, saves one draft, and reopens it to verify the record and attachments.

The demo ends at **draft verified, awaiting organizational review**. It uses clearly labeled synthetic policies, people, messages, and procurement records. Agent decisions, browser actions, persistence, and verification must work.

## 2. Ownership

| Area | Product / portal owner | Agent / execution owner |
| --- | --- | --- |
| Shared setup | Create the web app scaffold; own package files and app configuration | Supply dependency requirements in the first 10 minutes |
| Relay interface | Embedded case panel, current task, people, evidence drawer, materials, action preview, reply input, pause/resume, receipt | Supply persisted case snapshots and validate incoming actions |
| Visual direction | Implement the Baseten-inspired foundation in [Design direction](DESIGN-DIRECTION.md) | Supply concise, factual event descriptions for the UI |
| Test purchasing system | Build form, validation, attachment handling, save action, receipt page, and independent draft storage | Operate the form through browser tools; reopen and verify its result |
| Company context | Render evidence and provide a clearly labeled test-participant reply control | Author one quote, current/old policies, approved handover, and valid delegation fixtures |
| Agent | Render its current state and controls | Own API access, session continuation, context tools, planning, authorization enforcement, and browser tools |
| Persistence | Own portal records only | Own Relay cases, evidence, sessions, events, authorizations, and execution attempts |
| Integration and demo | Own the visible walkthrough and recording | Own diagnosing agent/tool failures and recovery |

Do not write directly into each other's stores. The portal is a destination system; the Relay case is the coordination record. Both can run in the same application, with separate storage modules.

Suggested file ownership if using a Next.js scaffold:

| Owner | Files/directories |
| --- | --- |
| Product / portal owner | Main page, layout, global styles, `src/components/`, `src/app/portal/`, `src/app/api/portal/`, `src/portal/`, package files and configuration |
| Agent / execution owner | `src/app/api/cases/`, `src/app/api/artifacts/`, `src/server/`, `fixtures/` |
| Agent / execution owner maintains; both agree | `src/lib/contracts.ts` |

These paths are frozen in the API contract; coordinate any changes before implementation. Do not independently scaffold two applications or rename shared routes halfway through the build.

## 3. Freeze the interface in the first 10 minutes

### Relay API

| Endpoint | Contract |
| --- | --- |
| `POST /api/cases` | Accept request text and the selected quote artifact; return a persisted case ID immediately |
| `GET /api/cases/:id` | Return the complete current case snapshot |
| `POST /api/cases/:id/replies` | Accept message ID, clarification ID, expected case version, and reply text; correlate to the pending question |
| `POST /api/cases/:id/authorizations` | Accept action ID, expected case version, and allow/decline decision; validate the exact pending payload |
| `POST /api/cases/:id/control` | Accept pause or resume with an event ID; acknowledge the actual state |
| `GET /api/artifacts/:id` | Serve a permitted fixture attachment or browser observation for this demo |

Use one-second polling of case snapshots for the prototype. Keep model-specific events behind the backend. For mutations, return the current snapshot or an accepted response followed by polling; return a conflict when a review is stale. Deduplicate repeated message and control event IDs.

Agree on these snapshot fields before starting the UI:

| Field | Contents |
| --- | --- |
| `id`, `version` | Persistent case identity and monotonically increasing revision |
| `stage` | `discover`, `prepare`, `review`, `execute`, or `verify` |
| `status` | `running`, `waiting_for_reply`, `waiting_for_authorization`, `paused`, `failed`, or `completed` |
| `facts` | Confirmed request fields and missing values |
| `currentTask`, `blocker` | Current operation and unresolved dependency, if any |
| `people` | Named roles with supporting evidence IDs |
| `tasks`, `evidence` | Checklist and sources with explicit status |
| `pendingAction` | Action ID, type, recipient/destination, proposed payload, and reviewed version |
| `events` | Persisted IDs, timestamps, and concise observed outcomes |
| `browserObservation` | Optional screenshot artifact and observation time |
| `receipt` | Verified destination record, or null until verification succeeds |

The agent / execution owner supplies fixture snapshots for discovery, waiting for reply, action review, execution, error, and verified completion by minute 20. The product / portal owner renders the same contract with a fixture adapter, then switches to live endpoints. Fixture mode must be visibly labeled and never masquerade as live agent progress.

### Procurement portal contract

Publish a plain working portal by minute 30–35, before styling it further:

- New draft page at `/portal/new`; record page at `/portal/drafts/:id`.
- Stable accessible labels for item, vendor, quantity, currency, unit price, cost center, justification, quote attachment, and “Save draft.”
- A request reference that remains the same across retries of the same draft operation.
- Persistent draft storage, actual attachment bytes and metadata, and a receipt showing saved fields and attachment links.
- Portal API routes to create and retrieve records, including lookup by request reference for duplicate recovery.

Freeze field names and receipt shape together. The receipt needs the actual draft ID, request reference, draft status, destination URL, saved fields, and attachment metadata. Relay adds its verification timestamp only after read-back. The browser fills the form and invokes its save control; a direct backend write cannot be presented as computer use.

The product / portal owner owns portal validation and unique request-reference enforcement. The agent / execution owner owns permission checks, uncertain-action reconciliation, and preventing duplicate execution. A lost response triggers lookup before another save.

## 4. Parallel schedule

| Time | Product / portal owner | Agent / execution owner | Checkpoint |
| --- | --- | --- | --- |
| 0–10 min | Scaffold app and own configuration | Verify credentials, define shared types and fixture fields | App runs; routes and ownership agreed |
| 10–35 min | Build a plain persistent portal; start case panel against fixtures | Prove session creation, one tool call, and continuation; supply snapshot fixtures | Portal saves and reopens a draft; agent access proven |
| 35–60 min | Finish panel, evidence, reply and authorization controls | Implement evidence lookup, case storage, reply continuation, and browser connection | First live case appears in the UI by minute 60 |
| 60–90 min | Connect live endpoints; fix field/interaction mismatches | Drive portal, enforce draft authorization, verify receipt | First complete live run by minute 90 |
| 90–110 min | Refine hierarchy, spacing, status copy, and minimal motion | Fix recovery and failure handling | Decline creates nothing; retry returns the same draft |
| 110–120 min | Record and rehearse the two-minute walkthrough | Check refresh/resume and reset demo fixtures | Demonstrable result; known limitations labeled |

This schedule is a timebox, not a guarantee. Start integration at minute 60 even if individual screens or tools are unfinished.

## 5. Scope and fallback decisions

Keep one purchase, one quote, one ownership/delegation exception, one human reply, and one verified draft. Defer real Slack/Teams installation, reminders, a workflow editor, production authentication, multi-agent orchestration, additional purchasing systems, and a full landing page.

Use only synthetic data in the unauthenticated local prototype. Keep API keys server-side. A pause stops new browser actions; an action already in flight must be reconciled before resuming. Server-side authorization must remain tied to the reviewed fields, destination, and attachments.

If Agents API access is still blocked after 15 minutes, use the disclosed Responses fallback described in the [API assessment](OPENAI-AGENTS-API.md). If browser execution cannot work, a verified API write can demonstrate a reduced scope, explicitly labeled as missing computer use.

Cut elaborate artwork and motion first. Cut the deliberately induced validation-error demo before cutting reply continuation, authorization, or receipt verification. Do not ship a canned success animation as a fallback.

## 6. Individual development briefs

### Brief for the product / portal owner

Build Relay's product experience and controlled procurement portal using the PRD and design direction. Own the application scaffold, configuration, interface components, portal form, portal APIs, and portal record persistence. Publish the functional portal by minute 35. Build Relay screens from the agreed case snapshots so backend work does not block you. Implement the request, evidence, reply, action review, pause/resume, execution, and verified receipt states. Keep the design white, typographically strong, rectangular, and restrained with green accents. Coordinate shared dependencies through your branch. Connect to live case endpoints at minute 60 and own the final demo. Leave agent execution and Relay case storage to your teammate.

### Brief for the agent / execution owner

Build Relay's agent and execution backend using the PRD and API assessment. Own context fixtures, case/session persistence, case endpoints, authorization checks, agent tools, and the isolated browser worker. Supply shared types and fixture snapshots early. Prove session continuation before building the full flow. Resolve the synthetic ownership/delegation exception from evidence, incorporate a correlated human reply, prepare the draft, and wait for authorization. Operate your teammate's portal through actual browser observations and actions. Reopen the saved draft and verify fields and attachments before returning a receipt. Handle declines, pauses, stale reviews, and uncertain saves. Leave the portal's records and UI to your teammate.

## 7. Working together in Git

Create separate branches from the same scaffold commit, for example `feat/relay-ui` and `feat/relay-agent`. Merge the scaffold and shared contract early. The product / portal owner owns dependency/configuration edits; the agent / execution owner requests additions rather than editing the same package files concurrently. Merge or cherry-pick completed work at the checkpoints. Neither person should wait until the final ten minutes to integrate.
