# Relay

Relay moves non-standard purchase requests through changing company processes, people, and systems—with evidence for every handoff and a verified result for every action.

## Run locally

Use Node.js 22.13 or newer.

~~~sh
npm ci
npm run dev -- --port 3100
~~~

Open [Relay](http://127.0.0.1:3100). The workspace starts in explicitly labeled **UI preview** mode. The procurement portal saves actual local draft records and attachment bytes.

## What works

- Baseten-inspired request workspace with mobile layouts, process route, materials checklist, activity history, and source evidence.
- Preview reply, action review, decline, pause/resume, and refresh persistence.
- Persisted live case API, same-session OpenAI continuation, authorization checks, durable jobs and browser execution with receipt verification.
- [New procurement draft](http://127.0.0.1:3100/portal/new), attachment upload, field validation, persistent records, duplicate prevention, and [saved drafts](http://127.0.0.1:3100/portal/drafts).

The real agent now reads company evidence, resolves the current coordinator, proposes a local-thread question, continues after the participant reply, obtains draft authorization, operates the actual portal form in an isolated browser, and verifies the resulting fields and attachment bytes. The explicit UI preview remains available and performs no agent actions.

See the [runbook and demo walkthrough](docs/RUNBOOK.md). Google Chrome and a server-side OpenAI application key are required for the live workflow; `npm run dev` starts both the web app and worker.

The local portal uses SQLite at data/portal.sqlite, or RELAY_PORTAL_DB if configured. It has no production authentication: use synthetic data and local hosting. A hosted pilot needs authentication and suitable persistent storage.

## Validation

~~~sh
npm run typecheck
npm test
npm run build
~~~

See the [UI handoff](docs/UI-HANDOFF.md) for routes, payloads, browser verification, and integration instructions.

## Product documents

- [Product requirements document](docs/PRD.md): problem, core experience, scope, acceptance criteria, and a two-hour prototype plan.
- [OpenAI Agents API assessment](docs/OPENAI-AGENTS-API.md): official capabilities checked on September 12, 2026, the recommended integration, and implementation boundaries.
- [Design direction](docs/DESIGN-DIRECTION.md): Baseten reference study and Relay requirements for layout, typography, components, illustrations, and motion.
- [Two-person development plan](docs/TWO-PERSON-PLAN.md): individual ownership, integration contracts, checkpoints, and ready-to-use development briefs.
- [Frozen API contract v1](docs/API-CONTRACT.md): case APIs, portal integration, authorization and retry rules. Shared types: [contracts.ts](src/lib/contracts.ts); UI examples: [case snapshots](fixtures/case-snapshots.ts).

**Status:** Complete local synthetic-data workflow verified against the real OpenAI Agents API and actual browser-operated portal. See [integration evidence](docs/INTEGRATION.md) and the [runbook](docs/RUNBOOK.md).
