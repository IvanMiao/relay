# Relay local demo

Relay now runs the complete synthetic procurement workflow with the real OpenAI Agents API and an isolated browser executor.

## Start

Requirements: Node 22.13+, npm, Google Chrome, and a server-side OpenAI application key with Agents API access. This machine's existing `.env` is configured; keys and local databases are ignored by Git.

```sh
npm ci
npm run dev -- --port 3100
```

The command starts both Next.js and the durable case worker. Open http://127.0.0.1:3100. For a fresh checkout, copy `.env.example` to `.env` or `.env.local` and fill `OPENAI_API_KEY`. Do not commit the key.

The browser executor opens a fresh headless Chrome context, does not use personal browser profiles, and only allows requests to the local portal. It does not inherit the OpenAI key. Set `RELAY_BROWSER_CHANNEL` if using a different installed Playwright browser channel; the default is `chrome`.

For a production-mode local check, run `npm run build`, then `npm start -- --port 3100` and `npm run worker` in separate terminals. `RELAY_BASE_URL` must match the portal port; it defaults to http://127.0.0.1:3100 and is restricted to loopback for this prototype.

## Three-minute walkthrough

The homepage is a two-person observer view: Alex's procurement workspace on the left, Carol's local demo inbox on the right. Use a browser wider than 800 px for side-by-side presentation; smaller screens stack the two labeled roles. The original diagnostic workspace is available at `/workspace`.

1. Click **New demo** if a previous request is displayed, then **Ask Relay to handle it**. The attached synthetic Northstar camera quote is $2,450.
2. Relay reads policy and handover evidence. Explain the path: old guide → Alice → Bob on leave → Carol covering. **View evidence** opens the actual sources.
3. As Alex, click **Review message**, then **Allow message**. The right inbox stays empty until authorization succeeds.
4. As Carol on the right, click **Use example reply**, review/edit it, then **Send reply**. This confirms ENG-240 and the required materials. The example only fills the composer; it does not send automatically.
5. Watch the same agent session carry the reply back to Alex's materials. As Alex, click **Review purchase draft**, inspect all fields and the original attachment, then **Allow draft creation**.
6. The execution section appears below both people. It shows actual captured browser observations and persisted actions as Relay fills the portal, uploads the original quote, saves the draft, reopens it, and checks its fields and downloaded attachment hash.
7. **Open saved draft** shows the verified result. Both sides retain the conversation after completion and refresh. The outcome is a draft awaiting organizational review, never an approved or issued order.

Model turns take time. The role cue and stages follow real persisted state, with no scripted success timer. Messages are local demo deliveries, not Slack/email. The detailed workspace retains a separately labeled UI preview for offline inspection.

## State and recovery

- `data/cases.sqlite`: cases, OpenAI session mapping, durable input/job queue, tool results, reviewed authorization records and immutable artifacts.
- `data/portal.sqlite`: destination drafts and original attachment bytes, independently persisted.
- Pausing prevents new browser actions. A save already in flight may finish; the worker reads it back before resuming.
- Declining clears pending authorization. Resume creates a new proposal; it cannot restore the rejected permission.
- An expired unused execution authorization requires fresh review.
- After a worker lease expires, the saved job is recovered before another job for the same case can run. Remote session state and pending calls are retrieved without blindly resending input.
- Once saving has begun, an unknown outcome triggers lookup by the stable request reference. If there is no provable result, the case reports a reconciliation blocker rather than clicking save again. Manual investigation is required if the destination remains ambiguous.
- An interrupted session creation before its ID was saved is reported; explicit resume can start a fresh session. This may leave an unused remote session, but cannot execute unrecorded browser tools.

## Checks

```sh
npm test
npm run typecheck
npm run build
npm run format:check
npm run check:agents
```

The last command makes real API calls with a random token and proves same-session continuation. The other automated checks run without an API key.

After completing a browser-created case:

```sh
node scripts/check-portal.mjs YOUR_REQUEST_REFERENCE
node --import tsx scripts/check-recovery.ts YOUR_CASE_ID
```

Recovery uses an isolated copy of the saved case with the save result marked unknown. It verifies the existing portal record and asserts that no draft was added. It does not modify the original case.

## Prototype boundaries

One synthetic equipment quote and one dated company scenario are supported. The September 10–18, 2026 delegation is evaluated against the server's actual date; outside that window Bob is the available coordinator. The model chooses workflow tools and prepares questions/justifications; a constrained executor implements browser interaction with stable accessible labels. This is not a general-purpose vision-driven browser operator.

The local participant thread simulates communication. Production authentication, multiple organizations, live Slack/Teams connectors, real procurement integrations and budget/order approval are outside this prototype. Deploying this unauthenticated local demo publicly is not part of its operating model.

### Split-screen integration check (September 12)

A fresh request completed through both role panels: message review and delivery, Carol's persisted reply, Alex's draft review, actual portal save, and field/attachment verification. Result: `PO-0BD82461` for `case_3ccf7331-6a17-4c3a-8350-0e35548aa2f9`. The model ended one execution turn before taking an action; **Retry from saved state** resumed successfully with the same reviewed authorization. This intermittent model stop remains a visible recovery path, not a guaranteed uninterrupted demo. Responsive checks at 320, 375, 414 and 768 px found no horizontal overflow.
