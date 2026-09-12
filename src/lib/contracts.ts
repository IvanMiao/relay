/** Relay prototype wire contract v1. See docs/API-CONTRACT.md for runtime rules.
 * JSON only; these types do not replace server-side input validation.
 */
export const CONTRACT_VERSION = 1 as const;
export type Timestamp = string; // ISO 8601 UTC, e.g. 2026-09-12T12:00:00.000Z
export type Decimal = string; // Non-negative decimal, no exponent or separators.
export type CaseStage =
  "discover" | "prepare" | "review" | "execute" | "verify";
export type CaseStatus =
  | "running"
  | "waiting_for_reply"
  | "waiting_for_authorization"
  | "paused"
  | "failed"
  | "completed";
export type EvidenceStatus =
  "confirmed" | "inferred" | "conflicting" | "unknown" | "superseded";
export type TaskStatus =
  | "ready"
  | "in_progress"
  | "waiting_for_information"
  | "waiting_for_authorization"
  | "completed"
  | "failed"
  | "canceled";

export interface ArtifactRef {
  id: string;
  fileName: string;
  mediaType: string;
  sizeBytes: number;
  sha256: string;
  url: string; // Same-origin /api/artifacts/:id; immutable bytes for this ID.
}

/** All fields are required to create a draft. Currency is an ISO 4217 code. */
export interface DraftFields {
  item: string;
  vendor: string;
  quantity: number; // Positive integer for the prototype.
  currency: string;
  unitPrice: Decimal;
  costCenter: string;
  justification: string;
}

export interface CaseFacts {
  fields: { [K in keyof DraftFields]: DraftFields[K] | null };
  businessPurpose: string | null;
  entity: string | null;
  requestedByDate: string | null; // YYYY-MM-DD
  quote: ArtifactRef;
  missingFields: Array<
    keyof DraftFields | "businessPurpose" | "entity" | "requestedByDate"
  >;
}

export interface Evidence {
  id: string;
  title: string;
  sourceUrl: string;
  excerpt: string;
  sourceVersion: string;
  status: EvidenceStatus;
  effectiveFrom: Timestamp | null;
  effectiveUntil: Timestamp | null;
  retrievedAt: Timestamp;
}

export interface PersonRole {
  personId: string;
  name: string;
  role: "expert" | "coordinator" | "delegate" | "approver";
  scope: string;
  validFrom: Timestamp | null;
  validUntil: Timestamp | null;
  evidenceIds: string[];
  status: EvidenceStatus;
}

export interface CaseTask {
  id: string;
  title: string;
  status: TaskStatus;
  dependsOn: string[];
  ownerPersonId: string | null;
  requiredInputs: string[];
  completionEvidenceIds: string[];
}

export interface Clarification {
  id: string;
  recipientPersonId: string;
  question: string;
  evidenceIds: string[];
  deliveryStatus:
    "pending_authorization" | "pending_delivery" | "delivered" | "failed";
  externalMessageId: string | null;
  reply: { messageId: string; text: string; receivedAt: Timestamp } | null;
}

interface ActionBase {
  id: string;
  reviewedVersion: number; // Equals snapshot.version while this action is pending.
  expiresAt: Timestamp;
}

export interface ContactAction extends ActionBase {
  type: "contact_person";
  payload: {
    clarificationId: string;
    recipientPersonId: string;
    channel: "demo_thread";
    text: string;
    evidenceIds: string[];
  };
}

export interface DraftAction extends ActionBase {
  type: "create_draft";
  payload: {
    destination: "/portal/new";
    requestReference: string; // Stable across retries of this business operation.
    fields: DraftFields;
    attachments: ArtifactRef[]; // Includes the original quote.
  };
}
export type PendingAction = ContactAction | DraftAction;

export interface CaseEvent {
  id: string;
  occurredAt: Timestamp;
  kind:
    | "case_created"
    | "evidence_updated"
    | "clarification_updated"
    | "action_proposed"
    | "authorization_recorded"
    | "execution_updated"
    | "control_updated"
    | "draft_verified"
    | "error";
  summary: string; // Observed business outcome; no hidden reasoning.
  evidenceIds: string[];
}

export interface BrowserObservation {
  screenshot: ArtifactRef;
  observedAt: Timestamp;
  pageUrl: string;
  summary: string;
}

/** Portal-owned attachment IDs/URLs may differ from Relay artifact IDs/URLs. */
export interface PortalAttachment {
  id: string;
  fileName: string;
  mediaType: string;
  sizeBytes: number;
  sha256: string;
  url: string;
}

/** The destination's persisted record, without a claim of Relay verification. */
export interface PortalDraft {
  id: string;
  requestReference: string;
  status: "draft";
  url: string; // /portal/drafts/:id
  fields: DraftFields;
  attachments: PortalAttachment[];
  createdAt: Timestamp;
}

export interface VerifiedReceipt {
  record: PortalDraft;
  verifiedAt: Timestamp;
  verifiedActionId: string;
  fieldsMatch: true;
  attachmentsMatch: true;
  nextStep: "organizational_review";
}

export interface CaseSnapshot {
  contractVersion: typeof CONTRACT_VERSION;
  mode: "fixture" | "live"; // Live still uses a clearly labeled synthetic portal.
  id: string;
  version: number; // Positive integer; increments on every persisted case change.
  createdAt: Timestamp;
  updatedAt: Timestamp;
  requestText: string;
  stage: CaseStage;
  status: CaseStatus;
  facts: CaseFacts;
  currentTask: string | null; // Task ID.
  blocker: {
    code:
      | "missing_information"
      | "authorization_required"
      | "evidence_conflict"
      | "execution_error"
      | "reconciliation_required";
    message: string;
    taskId: string | null;
  } | null;
  people: PersonRole[];
  tasks: CaseTask[];
  evidence: Evidence[];
  clarifications: Clarification[];
  pendingAction: PendingAction | null;
  events: CaseEvent[]; // Full persisted demo history, oldest first.
  browserObservation: BrowserObservation | null;
  receipt: VerifiedReceipt | null;
}

export interface CreateCaseRequest {
  eventId: string;
  requestText: string;
  quoteArtifactId: string;
}
export interface ReplyRequest {
  messageId: string;
  clarificationId: string;
  expectedVersion: number;
  text: string;
}
export interface AuthorizationRequest {
  eventId: string;
  actionId: string;
  expectedVersion: number;
  decision: "allow" | "decline";
}
export interface ControlRequest {
  eventId: string;
  expectedVersion: number;
  action: "pause" | "resume";
}

export interface CaseResponse {
  case: CaseSnapshot;
}
export type ApiErrorCode =
  | "invalid_request"
  | "not_found"
  | "forbidden"
  | "stale_version"
  | "idempotency_conflict"
  | "invalid_state"
  | "action_expired"
  | "validation_failed"
  | "internal_error";
export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
    currentVersion?: number;
    fieldErrors?: Record<string, string>;
  };
}

/** Multipart field `payload` is JSON; field `attachments` repeats actual files. */
export interface CreatePortalDraftPayload {
  requestReference: string;
  fields: DraftFields;
}
export interface PortalDraftResponse {
  draft: PortalDraft;
}
export interface PortalDraftLookupResponse {
  draft: PortalDraft | null;
}

/** Route table for implementers; handlers and runtime schemas are separate work. */
export interface RelayEndpoints {
  "POST /api/cases": { request: CreateCaseRequest; response: CaseResponse };
  "GET /api/cases/:id": { response: CaseResponse };
  "POST /api/cases/:id/replies": {
    request: ReplyRequest;
    response: CaseResponse;
  };
  "POST /api/cases/:id/authorizations": {
    request: AuthorizationRequest;
    response: CaseResponse;
  };
  "POST /api/cases/:id/control": {
    request: ControlRequest;
    response: CaseResponse;
  };
  "GET /api/artifacts/:id": { response: "binary" };
  "POST /api/portal/drafts": {
    request: CreatePortalDraftPayload;
    response: PortalDraftResponse;
  };
  "GET /api/portal/drafts/:id": { response: PortalDraftResponse };
  "GET /api/portal/drafts?requestReference=:reference": {
    response: PortalDraftLookupResponse;
  };
}
