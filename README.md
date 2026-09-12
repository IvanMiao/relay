# Relay

Relay moves non-standard purchase requests through changing company processes, people, and systems—with evidence for every handoff and a verified result for every action.

## Product documents

- [Product requirements document](docs/PRD.md): problem, core experience, scope, acceptance criteria, and a two-hour prototype plan.
- [OpenAI Agents API assessment](docs/OPENAI-AGENTS-API.md): official capabilities checked on September 12, 2026, the recommended integration, and implementation boundaries.
- [Design direction](docs/DESIGN-DIRECTION.md): Baseten reference study and Relay requirements for layout, typography, components, illustrations, and motion.
- [Two-person development plan](docs/TWO-PERSON-PLAN.md): individual ownership, integration contracts, checkpoints, and ready-to-use development briefs.
- [Frozen API contract v1](docs/API-CONTRACT.md): case APIs, portal integration, authorization and retry rules. Shared types: [contracts.ts](src/lib/contracts.ts); UI examples: [case snapshots](fixtures/case-snapshots.ts).
- [Agents API runtime](docs/AGENT-RUNTIME.md): server adapter, local key configuration, and a session/tool/continuation connectivity probe.

**Status:** Shared interface contract, UI fixtures, and an OpenAI Agents API adapter with offline tests. The case worker, browser executor, and application are not implemented; live API connectivity has not yet been validated.
