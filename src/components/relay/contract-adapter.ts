import type { CaseSnapshot as WireCase } from "../../lib/contracts";
import type { CaseSnapshot } from "./view-model";

/** Keep transport semantics intact while adapting to the existing presentation. */
export function fromContract(data: unknown): CaseSnapshot {
  const envelope = data as { case?: unknown };
  const c = (envelope?.case ?? data) as WireCase;
  if (
    c?.contractVersion !== 1 ||
    !["fixture", "live"].includes(c.mode) ||
    !c.id ||
    !Number.isInteger(c.version) ||
    !c.facts?.fields ||
    !c.facts.quote ||
    !Array.isArray(c.tasks) ||
    !Array.isArray(c.people) ||
    !Array.isArray(c.evidence) ||
    !Array.isArray(c.events) ||
    !Array.isArray(c.clarifications)
  ) {
    throw new Error("The case response does not match API contract v1.");
  }
  const person = (id: string) =>
    c.people.find((p) => p.personId === id)?.name ?? id;
  const question = c.clarifications.find(
    (q) => q.deliveryStatus === "delivered" && !q.reply,
  );
  const action = c.pendingAction;
  const f = c.facts.fields;
  return {
    id: c.id,
    version: c.version,
    title: f.item || "Purchase request",
    stage: c.stage,
    status: c.status,
    facts: {
      item: f.item ?? "Not confirmed",
      vendor: f.vendor ?? "Not confirmed",
      quantity: f.quantity ?? 0,
      currency: f.currency ?? "USD",
      unitPrice: Number(f.unitPrice ?? 0),
      costCenter: f.costCenter,
      justification: f.justification,
      quoteArtifactId: c.facts.quote.id,
    },
    currentTask:
      c.tasks.find((t) => t.id === c.currentTask)?.title ??
      (c.status === "completed"
        ? "Draft verified. Ready for organizational review."
        : "Preparing the next step."),
    blocker: c.blocker?.message ?? null,
    people: c.people.map((p) => ({
      id: p.personId,
      name: p.name,
      role: p.role,
      initials: p.name
        .split(/\s+/)
        .map((n) => n[0])
        .slice(0, 2)
        .join(""),
      note: p.scope,
      evidenceIds: p.evidenceIds,
    })),
    tasks: c.tasks.map((t) => ({
      id: t.id,
      label: t.title,
      status:
        t.status === "completed"
          ? "done"
          : ["failed", "waiting_for_information"].includes(t.status)
            ? "missing"
            : "pending",
      detail: t.status.replaceAll("_", " "),
    })),
    evidence: c.evidence.map((e) => ({
      id: e.id,
      title: e.title,
      kind: e.sourceVersion,
      date: e.effectiveFrom ?? e.retrievedAt,
      status: e.status,
      excerpt: e.excerpt,
      url: c.mode === "live" ? e.sourceUrl : undefined,
    })),
    pendingAction: action
      ? {
          id: action.id,
          type: action.type,
          reviewedVersion: action.reviewedVersion,
          title:
            action.type === "contact_person"
              ? "Contact " + person(action.payload.recipientPersonId)
              : "Create purchase draft",
          destination:
            action.type === "contact_person"
              ? "Local demo thread · " +
                person(action.payload.recipientPersonId)
              : action.payload.destination,
          payload: action.payload,
        }
      : question && c.status === "waiting_for_reply"
        ? {
            id: question.id,
            type: "clarification",
            title: "Reply to " + person(question.recipientPersonId),
            recipient: person(question.recipientPersonId),
            question: question.question,
            payload: {},
            reviewedVersion: c.version,
          }
        : null,
    events: c.events.map((e) => ({
      id: e.id,
      timestamp: e.occurredAt,
      title: e.summary,
      detail: e.kind.replaceAll("_", " "),
    })),
    browserObservation: c.browserObservation
      ? {
          url: c.browserObservation.screenshot.url,
          observedAt: c.browserObservation.observedAt,
        }
      : undefined,
    receipt: c.receipt
      ? {
          id: c.receipt.record.id,
          url: c.mode === "live" ? c.receipt.record.url : undefined,
          status: "draft",
          verifiedAt: c.receipt.verifiedAt,
          attachmentsChecked: c.receipt.record.attachments.length,
          simulated: c.mode === "fixture",
        }
      : null,
  };
}

export function liveSnapshot(data: unknown) {
  const envelope = data as { case?: WireCase };
  const c = envelope?.case ?? (data as WireCase);
  const snapshot = fromContract(data);
  if (c.mode !== "live")
    throw new Error(
      "The backend returned a fixture. Live mode requires actual execution.",
    );
  return snapshot;
}
