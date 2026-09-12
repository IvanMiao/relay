// Initial UI integration contract. The agent teammate maintains this shared file.
export type CaseStage =
  "discover" | "prepare" | "review" | "execute" | "verify";
export type CaseStatus =
  | "running"
  | "waiting_for_reply"
  | "waiting_for_authorization"
  | "paused"
  | "failed"
  | "completed";
export type Evidence = {
  id: string;
  title: string;
  kind: string;
  date: string;
  status: "confirmed" | "superseded" | "unknown";
  excerpt: string;
  url?: string;
};
export type CaseSnapshot = {
  id: string;
  version: number;
  title: string;
  stage: CaseStage;
  status: CaseStatus;
  facts: {
    item: string;
    vendor: string;
    quantity: number;
    currency: string;
    unitPrice: number;
    costCenter: string | null;
    justification: string | null;
    quoteArtifactId?: string;
  };
  currentTask: string;
  blocker: string | null;
  people: {
    id: string;
    name: string;
    role: string;
    initials: string;
    note: string;
    evidenceIds: string[];
  }[];
  tasks: {
    id: string;
    label: string;
    status: "done" | "pending" | "missing";
    detail?: string;
  }[];
  evidence: Evidence[];
  pendingAction: null | {
    id: string;
    type: "clarification" | "create_draft";
    title: string;
    recipient?: string;
    destination?: string;
    question?: string;
    payload: Record<string, unknown>;
    reviewedVersion: number;
  };
  events: { id: string; timestamp: string; title: string; detail: string }[];
  browserObservation?: { url: string; observedAt: string };
  receipt: null | {
    id: string;
    url?: string;
    status: "draft";
    verifiedAt: string;
    attachmentsChecked: number;
    simulated?: boolean;
  };
};
export type PreviewScene =
  "discovery" | "reply" | "review" | "execution" | "error" | "complete";
