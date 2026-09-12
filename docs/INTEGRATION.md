# Integration — September 12, 2026

Integrated agent commits: `70ebb06` (v1 contracts) and `7a1ff5a` (OpenAI adapter), on `feat/relay-ui`.

## Completed

- Preserve the teammate's v1 wire contract; keep the UI presentation model separate.
- Map task IDs, nested facts, delivered clarification IDs, contact review, draft review, evidence, and verified receipts. Fixture receipts cannot be presented as live results.
- Send creation/authorization event IDs, requestText, and a registered quote artifact ID. Preserve operation IDs for network retries within the current page.
- Match portal multipart payloads, decimal price strings, attachment metadata, structured errors, and absent-reference lookup. Retain previous database records.
- Accept colon-containing request references. Compare attachment multisets so reordered uploads remain idempotent.
- Install the official OpenAI SDK and include the teammate's offline adapter tests in `npm test`.

## Verified locally

- Eleven tests pass, covering adapter snapshots, clarification correlation, exact action payloads, durable portal records, attachment bytes, retries, validation and OpenAI stream protocol handling.
- TypeScript and production build pass.
- Browser saved synthetic draft `PO-32384A24`, reference `relay:integration:v1`, using the actual portal form and sample-file shortcut. This was a manual integration test, not autonomous agent execution.
- `node scripts/check-portal.mjs relay:integration:v1` passed: v1 response, exact attachment bytes/hash, repeated save returning the same ID, modified save returning 409, invalid decimal returning 422, foreign origin returning 403, absent lookup returning null.
- Existing local draft records remain readable.
- Browser connection displays an explicit missing-case-endpoint error and remains in preview.
- Installed SDK exposes `beta.agents.sessions`. No API key is configured locally, so real OpenAI connectivity is unverified.

## Required for live end-to-end integration

The latest remote agent commit explicitly leaves these unimplemented:

1. `/api/cases` and case read/reply/authorization/control routes, runtime validation, persisted case/session mapping and event deduplication.
2. Context artifact bytes and `/api/artifacts/:id`; fixture references alone are not files.
3. A durable, serialized case worker with business tools and server-side authorization checks.
4. The browser executor, uncertain-save reconciliation and receipt verification against authorized fields and attachment bytes.
5. Server-side `OPENAI_API_KEY`, followed by `npm run check:agents` and a live case walkthrough.

The adapter, UI and portal are integrated; this is not yet a working autonomous procurement agent. A passing SDK mock test does not establish real API access or business completion.
