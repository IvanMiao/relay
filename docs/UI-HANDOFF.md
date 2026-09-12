# Relay — UI and Procurement Portal Handoff

**Branch:** feat/relay-ui

**Implemented:** The project initiator's development track. The agent teammate can build on this scaffold without recreating the interface or purchasing destination.

## Start

Use Node.js 22.13+ and run npm ci, then npm run dev -- --port 3100. Open http://127.0.0.1:3100. No OpenAI key is required for this track.

The UI uses Next.js App Router, React, TypeScript, local Geist fonts, Phosphor icons, and a single CSS token system. The portal uses Node's built-in SQLite support. Package versions are locked.

## Pages

| Route | Purpose |
| --- | --- |
| / | Request workspace and Relay companion |
| /portal/new | Actual test procurement form |
| /portal/new?requestReference=YOUR_CASE_REF | Form with an explicit reference for one draft operation |
| /portal/drafts | Persisted draft list |
| /portal/drafts/:id | Saved fields and original attachments |
| /sample-quote.txt | Clearly labeled synthetic quote fixture |

The workspace defaults to a synthetic case. Its preview controls expose discovery, input, review, execution, failure, and receipt states. Reply, decline, and pause/resume interactions persist in browser storage. These transitions perform no real agent actions. Preview receipts do not appear in the portal's saved records.

The portal **Use sample details** button explicitly fills the form and attaches the sample quote. It is for manual setup and UI testing. An agent computer-use demonstration must interact with the actual form and its fields, not invoke this shortcut as evidence of autonomous form completion.

## Connect the agent track

Implement the case endpoints from TWO-PERSON-PLAN.md under src/app/api/cases/. Keep agent tools and case storage in src/server/. The portal owns its separate records in src/portal/; do not write into these tables from the case backend.

src/lib/contracts.ts is the frozen v1 wire contract from the agent branch. The UI uses contract-adapter.ts to translate it into a separate presentation model. All six teammate fixtures are covered by adapter tests; fixture results cannot connect as live execution.

The adapter in src/components/relay/use-relay-case.ts calls:

| Operation | Request |
| --- | --- |
| Create case | POST /api/cases with eventId, requestText, and required quoteArtifactId |
| Read case | GET /api/cases/:id once per second while connected |
| Reply | POST /api/cases/:id/replies with messageId, clarificationId, expectedVersion, text |
| Authorize or decline | POST /api/cases/:id/authorizations with eventId, actionId, expectedVersion, decision: allow/decline |
| Pause or resume | POST /api/cases/:id/control with eventId, expectedVersion, action: pause/resume |

Success responses follow `{ case: CaseSnapshot }` and JSON errors use `{ error: { code, message, fieldErrors? } }`. Stale action reviews return 409. Current-task IDs, delivered clarification IDs, contact actions, nested draft fields and verified receipts are mapped by the adapter. Network retries in the current page retain operation IDs; a page reload does not preserve an unresolved outbound request.

The UI freezes the payload and case version when a review opens. It disables confirmation if polling discovers a newer revision. The backend must independently enforce the same authorization boundary.

Click **Connect agent** to create a case or load an existing ID. The adapter remembers the selected case ID for refresh and reconnects through the backend. It does not silently replace a failed live connection with preview data. A disconnected initial load shows a reconnection screen, not a fabricated case.

To display the real quote, supply facts.quote.id and implement GET /api/artifacts/:id. New-request artifact upload is not implemented in this UI track; the connection dialog accepts a registered quote artifact ID, or an existing case can supply one. Do not treat the visible preview quote as an artifact uploaded to the agent.

## Procurement destination contract

POST /api/portal/drafts accepts **multipart form data**: `payload` is JSON `{ requestReference, fields }`, with repeated `attachments` files. Flat form fields remain accepted for compatibility with earlier local records/tests. The following rules apply inside the payload:

| Field | Rule |
| --- | --- |
| requestReference | Required; 1–80 characters; letters, numbers, dashes, colons, underscores; starts with a letter or number |
| item | 2–200 characters |
| vendor | 2–160 characters |
| quantity | Integer from 1 to 10,000 |
| currency | USD, EUR, or GBP |
| unitPrice | Decimal string, positive, at most 1,000,000, at most two decimal places |
| costCenter | Confirmed value, 2–80 characters |
| justification | 20–5,000 characters |
| attachments | Repeated file field; 1–3 files; non-empty PDF, TXT, PNG, or JPG; at most 5 MB each |

The matching browser labels are **Item**, **Vendor**, **Request reference**, **Quantity**, **Currency**, **Unit price**, **Cost center**, **Justification**, **Attachments**, and **Save draft**. The file input has id="attachments" and name="attachments".

A successful create returns { draft, reused: false } with status 201. An exact retry returns the same draft with reused: true and status 200. A different payload using an existing reference returns 409. Validation returns 422 with error.code, error.message and error.fieldErrors.

Reusing a reference requires the same normalized fields, attachment bytes, names, MIME types, and multiplicity; upload order is irrelevant. Preserve the reference across uncertain retries. Use a new reference for a separate intended draft. The reference is unique in SQLite, and draft plus attachment writes commit in one transaction.

| Read endpoint | Response |
| --- | --- |
| GET /api/portal/drafts | { drafts }, newest first, up to 100 |
| GET /api/portal/drafts?requestReference=... | { draft } (null when absent) |
| GET /api/portal/drafts/:id | { draft } or 404 |
| GET /api/portal/attachments/:id | Original file bytes as a download, or 404 |

Draft records contain id, requestReference, status: draft, createdAt, fields, attachments, and a relative url. Fields publish unitPrice as a decimal string. Each attachment exposes fileName, mediaType, sizeBytes, sha256 and url. Storage serialization is separate, preserving existing local records. The portal does not manufacture an agent verification timestamp.

Use supported destination reads for recovery and verification. The computer-use path must save through the browser form. Direct API creation is available for portal functionality, but is not a demonstration of computer use.

## Verified

- Production build and TypeScript checks.
- Store tests: persistence across reopening, exact original attachment bytes, identical retry, changed fields/bytes conflict, invalid inputs, and unsupported/oversized attachments.
- Browser: preview reply updates the checklist; review contains concrete fields; decline leaves zero portal drafts before manual portal testing; the paused state and supplied value survive reload; resume works.
- Browser: evidence dialog opens, Escape closes it, and missing agent endpoints display an explicit connection failure.
- Browser: sample details and a real sample attachment can be submitted through the portal; the resulting record page displays the stored fields, draft ID, and download.
- HTTP: retrieved attachment matches the original file byte-for-byte; download headers are present; repeated save returns the same ID; changed save returns 409; missing cost center returns 422; unrelated origins return 403; unknown records return 404.
- Responsive workspace geometry checked at 320, 375, 414, and 768 CSS pixels; no overflowing primary controls or horizontal page overflow. Desktop workspace, portal, and receipt were visually inspected; the receipt was also inspected at phone width.

Reduced-motion styles are included. OS-level reduced-motion emulation and a complete assistive-technology audit were not performed. Live model execution, backend business authorization, real messaging, live-session recovery, and autonomous browser completion await the agent teammate.

## Implementation limits

This is a local synthetic-data prototype, bound to loopback by the default scripts. The portal has no production user authentication or tenant boundaries. It supports creation and read-back; edit/delete operations and production procurement submission are outside this track.

The SQLite database and local preview data are excluded from Git. The portal needs persistent writable storage; do not assume the same local SQLite configuration will persist on an ephemeral serverless deployment.

The reference design is implemented through layout, type, rules, restrained green accents, a document-stack visual, and state transitions. There is no decorative animation pretending to be live browser activity.

<!-- Hallmark · pre-emit critique: P4 H4 E4 S5 R4 V4. Editorial design assessment after desktop/mobile inspection, not user-study scores. -->
