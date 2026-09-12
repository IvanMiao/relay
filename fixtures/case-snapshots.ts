import type { CaseSnapshot, DraftAction } from "../src/lib/contracts";

/** Layout fixtures only. No artifact bytes or destination records exist yet. */
const timestamp = "2026-09-12T12:00:00.000Z";
const quote = {
  id: "artifact_demo_quote", fileName: "quote.txt", mediaType: "text/plain",
  sizeBytes: 5,
  sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  url: "/api/artifacts/artifact_demo_quote",
};
const fields = {
  item: "Non-catalog test instrument", vendor: "Demo Instruments",
  quantity: 1, currency: "EUR", unitPrice: "1200.00",
  costCenter: "DEMO-ENG", justification: "Required for prototype signal validation.",
};
const base: CaseSnapshot = {
  contractVersion: 1, mode: "fixture", id: "case_demo_001", version: 1,
  createdAt: timestamp, updatedAt: timestamp,
  requestText: "Prepare a purchase draft for a test instrument using the attached quote.",
  stage: "discover", status: "running",
  facts: {
    fields: { ...fields, costCenter: null, justification: null },
    businessPurpose: "Prototype signal validation", entity: "Demo Labs France",
    requestedByDate: null, quote, missingFields: ["costCenter", "justification"],
  },
  currentTask: "task_route", blocker: null,
  people: [], evidence: [], clarifications: [],
  tasks: [
    { id: "task_route", title: "Confirm the current coordinator", status: "in_progress",
      dependsOn: [], ownerPersonId: null, requiredInputs: [], completionEvidenceIds: [] },
    { id: "task_materials", title: "Complete the materials", status: "ready",
      dependsOn: ["task_route"], ownerPersonId: null,
      requiredInputs: ["costCenter", "justification"], completionEvidenceIds: [] },
    { id: "task_draft", title: "Create and verify the draft", status: "ready",
      dependsOn: ["task_materials"], ownerPersonId: null,
      requiredInputs: ["draft_authorization"], completionEvidenceIds: [] },
  ],
  pendingAction: null, browserObservation: null, receipt: null,
  events: [{ id: "event_1", occurredAt: timestamp, kind: "case_created",
    summary: "Synthetic case created for interface development.", evidenceIds: [] }],
};

const waiting: CaseSnapshot = {
  ...base, version: 2, stage: "prepare", status: "waiting_for_reply",
  currentTask: "task_materials",
  blocker: { code: "missing_information", message: "Waiting for material requirements and cost center.", taskId: "task_materials" },
  people: [{ personId: "person_carol", name: "Carol", role: "delegate",
    scope: "Coordinate Demo Labs France equipment requests; no budget approval authority.",
    validFrom: "2026-09-01T00:00:00.000Z", validUntil: "2026-09-30T23:59:59.000Z",
    evidenceIds: ["evidence_delegation"], status: "confirmed" }],
  evidence: [{ id: "evidence_delegation", title: "Synthetic handover and delegation record",
    sourceUrl: "/api/artifacts/artifact_demo_delegation",
    excerpt: "Bob replaced Alice as coordinator. Carol covers equipment coordination during September 2026.",
    sourceVersion: "demo-v1", status: "confirmed",
    effectiveFrom: "2026-09-01T00:00:00.000Z", effectiveUntil: "2026-09-30T23:59:59.000Z",
    retrievedAt: timestamp }],
  tasks: base.tasks.map(task => task.id === "task_route"
    ? { ...task, status: "completed", completionEvidenceIds: ["evidence_delegation"] }
    : task.id === "task_materials" ? { ...task, status: "waiting_for_information" } : task),
  clarifications: [{ id: "clarification_demo_001", recipientPersonId: "person_carol",
    question: "Which supporting material and cost center are required?",
    evidenceIds: ["evidence_delegation"], deliveryStatus: "delivered",
    externalMessageId: "demo_message_001", reply: null }],
  events: [...base.events,
    { id: "event_2", occurredAt: timestamp, kind: "authorization_recorded",
      summary: "Demo requester allowed this question to Carol in the local test thread.", evidenceIds: [] },
    { id: "event_3", occurredAt: timestamp, kind: "clarification_updated",
      summary: "Question delivered in the synthetic participant thread.", evidenceIds: ["evidence_delegation"] }],
};

const action: DraftAction = {
  id: "action_demo_draft", reviewedVersion: 3,
  expiresAt: "2026-09-12T13:00:00.000Z", type: "create_draft",
  payload: { destination: "/portal/new", requestReference: "relay:case_demo_001:draft:1",
    fields, attachments: [quote] },
};
const review: CaseSnapshot = {
  ...waiting, version: 3, stage: "review", status: "waiting_for_authorization",
  facts: { ...waiting.facts, fields, missingFields: [] },
  currentTask: "task_draft", pendingAction: action,
  blocker: { code: "authorization_required", message: "Review the fields and quote before creating a draft.", taskId: "task_draft" },
  evidence: [...waiting.evidence, { id: "evidence_reply", title: "Synthetic participant confirmation",
    sourceUrl: "/api/artifacts/artifact_demo_reply", sourceVersion: "demo-v1",
    excerpt: "Use DEMO-ENG and attach a technical justification for prototype signal validation.",
    status: "confirmed", effectiveFrom: null, effectiveUntil: null, retrievedAt: timestamp }],
  clarifications: waiting.clarifications.map(question => ({ ...question,
    reply: { messageId: "reply_demo_001", text: "Use DEMO-ENG and include the technical justification.", receivedAt: timestamp } })),
  tasks: waiting.tasks.map(task => task.id === "task_materials"
    ? { ...task, status: "completed", completionEvidenceIds: ["evidence_reply"] }
    : task.id === "task_draft" ? { ...task, status: "waiting_for_authorization" } : task),
  events: [...waiting.events, { id: "event_4", occurredAt: timestamp, kind: "action_proposed",
    summary: "Synthetic reply incorporated; draft payload is ready for review.", evidenceIds: ["evidence_reply"] }],
};
const execution: CaseSnapshot = {
  ...review, version: 4, stage: "execute", status: "running", pendingAction: null, blocker: null,
  tasks: review.tasks.map(task => task.id === "task_draft" ? { ...task, status: "in_progress" } : task),
  events: [...review.events, { id: "event_5", occurredAt: timestamp, kind: "authorization_recorded",
    summary: "Fixture state: draft creation authorized; executor may start.", evidenceIds: [] }],
};
const error: CaseSnapshot = {
  ...execution, version: 5, status: "failed",
  blocker: { code: "reconciliation_required", message: "Save response was lost. Look up the request reference before retrying.", taskId: "task_draft" },
  tasks: execution.tasks.map(task => task.id === "task_draft" ? { ...task, status: "failed" } : task),
  events: [...execution.events, { id: "event_6_error", occurredAt: timestamp, kind: "error",
    summary: "Fixture state: save outcome is uncertain; no verified receipt exists.", evidenceIds: [] }],
};
const completed: CaseSnapshot = {
  ...execution, version: 5, stage: "verify", status: "completed", currentTask: null,
  evidence: [...execution.evidence, { id: "evidence_receipt", title: "Synthetic verified draft",
    sourceUrl: "/portal/drafts/draft_demo_001", excerpt: "Draft fields and attachment bytes match the reviewed action.",
    sourceVersion: "demo-v1", status: "confirmed", effectiveFrom: null, effectiveUntil: null, retrievedAt: timestamp }],
  tasks: execution.tasks.map(task => task.id === "task_draft"
    ? { ...task, status: "completed", completionEvidenceIds: ["evidence_receipt"] } : task),
  receipt: {
    record: { id: "draft_demo_001", requestReference: action.payload.requestReference,
      status: "draft", url: "/portal/drafts/draft_demo_001", fields,
      attachments: [{ ...quote, id: "portal_attachment_demo_001", url: "/api/portal/attachments/portal_attachment_demo_001" }], createdAt: timestamp },
    verifiedAt: timestamp, verifiedActionId: action.id, fieldsMatch: true,
    attachmentsMatch: true, nextStep: "organizational_review",
  },
  events: [...execution.events, { id: "event_6_success", occurredAt: timestamp, kind: "draft_verified",
    summary: "Fixture state: draft verified; organizational review is still required.", evidenceIds: ["evidence_receipt"] }],
};

/** Error and completed are alternative outcomes, not consecutive transitions.
 * Clone before editing; fixed timestamps are intentional and never authorize live work.
 */
export const caseSnapshots = {
  discovery: base, waitingForReply: waiting, actionReview: review, execution, error, completed,
} satisfies Record<string, CaseSnapshot>;
