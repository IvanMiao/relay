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
- Live-agent connection adapter for the shared case API; missing endpoints produce an explicit error.
- [New procurement draft](http://127.0.0.1:3100/portal/new), attachment upload, field validation, persistent records, duplicate prevention, and [saved drafts](http://127.0.0.1:3100/portal/drafts).

The OpenAI Agents API adapter and offline protocol tests are integrated. Company-context tools, the case API/worker, and autonomous browser executor are **not implemented on this branch**. Preview transitions do not run an agent, send messages, or create drafts. The **Use sample details** control in the portal explicitly loads synthetic form data and a test attachment.

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

**Status:** Product UI and persistent portal implemented; v1 contracts and fixtures merged. Real OpenAI session/tool/continuation probe passed. The case worker and browser executor remain missing, so the full live workflow is not yet available.

See [integration results and remaining work](docs/INTEGRATION.md).

[Agents API runtime and probe](docs/AGENT-RUNTIME.md).
