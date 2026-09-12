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

1. Click **Connect agent**. Use the selected synthetic Northstar camera quote and submit the request.
2. Relay reads the current and archived policies, Alice-to-Bob handover and Bob-to-Carol delegation. It proposes a question to the available coordinator. Inspect **Sources** and **Activity**.
3. Click **Review message**, read the exact text and local-thread destination, then **Allow action**. No Slack/email message is sent.
4. In the local participant thread, reply: “Use ENG-240. We need non-contact temperature mapping to identify heat buildup and validate the thermal performance of the next hardware prototype. Attach the original supplier quote.”
5. The same agent session incorporates the reply and proposes a purchase draft. Review the amount, cost center, justification and original attachment; allow the action.
6. Relay fills each field and uploads the original bytes through the actual portal form, clicks **Save draft**, reopens the saved page, checks every field and downloads the attachment to verify its SHA-256.
7. Open the saved draft and browser verification image. The outcome is **draft verified, awaiting organizational review**, never an approved or issued purchase order.

Model turns take time; the UI polls real persisted state. It contains no scripted success timer. **UI preview** remains explicitly separate and makes no model calls or writes.

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
