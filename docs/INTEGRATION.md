# Integration results — September 12, 2026

The missing case API, business tools, persistence/worker and browser executor are now implemented on `feat/relay-ui`.

## Verified end to end

A real OpenAI session handled case `case_1e5c481a-bf98-4184-a234-131240d3f2ca`:

1. Read synthetic policy and handover/delegation evidence; resolved Carol as the current cover.
2. Proposed a targeted question; local requester authorized delivery to the synthetic participant thread.
3. Incorporated the actual test reply in the same remote session; prepared cost center ENG-240 and a grounded technical justification.
4. Waited for separate draft authorization.
5. Launched isolated Chrome, filled the portal's accessible form controls, uploaded original quote bytes and clicked Save draft.
6. Reopened **PO-EB5902C6**, verified all authorized fields, downloaded and verified the original 323-byte attachment, then recorded the verified receipt.
7. UI refresh recovered the same completed request. The record remains a draft awaiting organizational review.

The browser test used the agent executor's individual form actions; it did not use the portal's sample-fill shortcut or a direct API write to create this draft.

## Additional checks

- 17 automated tests passed: UI transport mapping, correlation and stale revisions, event and tool deduplication, decline/pause boundaries, expired reviews, durable case/session/job recovery and lease takeover, receipt mismatch rejection, portal persistence and validation, and SDK event handling.
- TypeScript, production build and formatting passed.
- `check-portal.mjs` independently verified real receipt metadata, exact original attachment bytes/hash, retry returning the same ID, modified content returning 409, invalid decimals returning 422, foreign origin returning 403 and absent lookup returning null.
- `check-recovery.ts` simulated loss of the save response in an isolated case store, reopened the existing portal draft, verified the bytes and asserted no new draft was created. The real saved case was not changed.
- Official OpenAI SDK 7.15.0 and real session/tool/continuation probe verified using local credentials. Keys are excluded from Git and browser processes.

## Limits

This is a local, single-user, synthetic procurement prototype. The participant thread is local; no external messages are sent. The constrained browser executor uses accessible labels, not model-generated arbitrary browser code. Cases, jobs and files persist in SQLite. If a save cannot be reconciled, the system stops for investigation instead of issuing a blind retry. Live collaboration platforms, production access control and actual purchase-order issuance are not implemented.

See [RUNBOOK.md](RUNBOOK.md) for setup, demonstration and recovery behavior.
