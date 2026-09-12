import type { CaseSnapshot, PreviewScene } from "@/lib/contracts";

export const previewScenes: { id: PreviewScene; label: string }[] = [
  { id: "discovery", label: "Finding the process" },
  { id: "reply", label: "Waiting for input" },
  { id: "review", label: "Ready for review" },
  { id: "execution", label: "Browser execution" },
  { id: "error", label: "Needs attention" },
  { id: "complete", label: "Verified receipt" },
];
export function makePreview(scene: PreviewScene = "reply"): CaseSnapshot {
  const review = ["review", "execution", "complete"].includes(scene);
  const value: CaseSnapshot = {
    id: "REQ-1042",
    version: 1,
    title: "Precision thermal camera",
    stage:
      scene === "discovery"
        ? "discover"
        : scene === "review"
          ? "review"
          : scene === "complete"
            ? "verify"
            : scene === "execution"
              ? "execute"
              : "prepare",
    status:
      scene === "reply"
        ? "waiting_for_reply"
        : scene === "review"
          ? "waiting_for_authorization"
          : scene === "error"
            ? "failed"
            : scene === "complete"
              ? "completed"
              : "running",
    facts: {
      item: "Precision thermal camera",
      vendor: "Northstar Instruments",
      quantity: 1,
      currency: "USD",
      unitPrice: 2450,
      costCenter: review ? "ENG-240" : null,
      justification: "Thermal validation of the next hardware prototype.",
    },
    currentTask:
      scene === "discovery"
        ? "Finding the right path for this purchase."
        : scene === "reply"
          ? "One detail, then we can move forward."
          : scene === "review"
            ? "Your draft is ready for a final look."
            : scene === "execution"
              ? "Preparing the purchase in your portal."
              : scene === "error"
                ? "The portal needs your attention."
                : "The draft is saved and checked.",
    blocker:
      scene === "reply"
        ? "Confirm the cost center for this equipment."
        : scene === "error"
          ? "The purchasing session expired. Open the portal to sign in before resuming."
          : null,
    people: [
      {
        id: "carol",
        name: "Carol Chen",
        role: "Covering coordinator",
        initials: "CC",
        note: "Covering for Bob through Sep 18",
        evidenceIds: ["delegation", "handover"],
      },
    ],
    tasks: [
      {
        id: "quote",
        label: "Supplier quote",
        status: "done",
        detail: "QT-2026-084 · attached",
      },
      {
        id: "justification",
        label: "Business justification",
        status: "done",
        detail: "Thermal validation for the hardware team",
      },
      {
        id: "owner",
        label: "Current coordinator",
        status: scene === "discovery" ? "pending" : "done",
        detail: "Carol Chen · delegation confirmed",
      },
      {
        id: "cost",
        label: "Cost center",
        status: review ? "done" : "missing",
        detail: review
          ? "ENG-240 · confirmed in preview"
          : "Waiting for confirmation",
      },
    ],
    evidence: [
      {
        id: "policy",
        title: "Non-catalog purchasing",
        kind: "Procurement policy",
        date: "2026-09-01",
        status: "confirmed",
        excerpt:
          "Synthetic policy: non-catalog equipment requests require a supplier quote, business justification and confirmed cost center before a draft is prepared. Drafts remain subject to budget review.",
      },
      {
        id: "handover",
        title: "Equipment purchasing handover",
        kind: "Approved handover",
        date: "2026-09-05",
        status: "confirmed",
        excerpt:
          "Synthetic handover: Bob Patel succeeds Alice Morgan as the equipment procurement coordinator from September 5, 2026. This change does not grant budget approval authority.",
      },
      {
        id: "delegation",
        title: "September coverage",
        kind: "Scoped delegation",
        date: "2026-09-10",
        status: "confirmed",
        excerpt:
          "Synthetic delegation: Carol Chen covers equipment procurement coordination for Bob Patel from September 10 through September 18, 2026. The delegation covers intake and draft preparation only.",
      },
      {
        id: "legacy",
        title: "Equipment buying guide",
        kind: "Archived guide",
        date: "2026-03-12",
        status: "superseded",
        excerpt:
          "Synthetic archived guide: contact Alice Morgan for equipment procurement. The operational contact in this guide has been superseded by the September 5 approved handover.",
      },
    ],
    pendingAction:
      scene === "reply"
        ? {
            id: "question-1",
            type: "clarification",
            title: "Confirm the cost center",
            recipient: "You",
            question: "Which cost center should this purchase use?",
            payload: {},
            reviewedVersion: 1,
          }
        : scene === "review"
          ? {
              id: "draft-1",
              type: "create_draft",
              title: "Create a purchase draft",
              destination: "/portal/new",
              payload: {
                item: "Precision thermal camera",
                vendor: "Northstar Instruments",
                quantity: 1,
                currency: "USD",
                unitPrice: 2450,
                costCenter: "ENG-240",
                quote: "QT-2026-084",
              },
              reviewedVersion: 1,
            }
          : null,
    events: [
      {
        id: "created",
        timestamp: "2026-09-12T09:00:00Z",
        title: "Request received",
        detail:
          "A thermal camera for hardware validation. Supplier quote attached.",
      },
      {
        id: "policy-found",
        timestamp: "2026-09-12T09:01:00Z",
        title: "Purchase requirements found",
        detail:
          "Quote, justification and a confirmed cost center are required.",
      },
      {
        id: "owner-changed",
        timestamp: "2026-09-12T09:02:00Z",
        title: "The right person, found",
        detail:
          "The old guide names Alice. The approved handover points to Bob, with Carol covering this week.",
      },
    ],
    receipt:
      scene === "complete"
        ? {
            id: "SAMPLE-PO-1042",
            status: "draft",
            verifiedAt: "2026-09-12T09:05:00Z",
            attachmentsChecked: 1,
            simulated: true,
          }
        : null,
  };
  if (scene === "discovery") {
    value.events = value.events.slice(0, 1);
    value.people = [];
    value.evidence = [];
  }
  return value;
}
