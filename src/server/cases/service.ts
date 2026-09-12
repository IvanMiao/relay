import { z } from "zod";
import { CaseError, event, type CaseStore } from "./store";
import { newCase, QUOTE_ID } from "./context";

const id = z.string().trim().min(1).max(160);
const revision = z.number().int().positive();
export const createSchema = z
  .object({
    eventId: id,
    requestText: z.string().trim().min(10).max(5000),
    quoteArtifactId: id,
  })
  .strict();
export const replySchema = z
  .object({
    messageId: id,
    clarificationId: id,
    expectedVersion: revision,
    text: z.string().trim().min(2).max(5000),
  })
  .strict();
export const authorizationSchema = z
  .object({
    eventId: id,
    actionId: id,
    expectedVersion: revision,
    decision: z.enum(["allow", "decline"]),
  })
  .strict();
export const controlSchema = z
  .object({
    eventId: id,
    expectedVersion: revision,
    action: z.enum(["pause", "resume"]),
  })
  .strict();
export function createCase(store: CaseStore, raw: unknown) {
  const input = createSchema.parse(raw);
  if (input.quoteArtifactId !== QUOTE_ID)
    throw new CaseError(
      422,
      "validation_failed",
      "Select the registered Northstar demo quote.",
    );
  return store.create(input, newCase(input.requestText, store));
}
export function replyCase(store: CaseStore, caseId: string, raw: unknown) {
  const input = replySchema.parse(raw);
  return store.input(
    caseId,
    input.messageId,
    input,
    input.expectedVersion,
    (r) => {
      const c = r.snapshot,
        q = c.clarifications.find((q) => q.id === input.clarificationId);
      if (
        c.status !== "waiting_for_reply" ||
        !q ||
        q.deliveryStatus !== "delivered" ||
        q.reply
      )
        throw new CaseError(
          409,
          "invalid_state",
          "This question is not waiting for a reply.",
        );
      q.reply = {
        messageId: input.messageId,
        text: input.text,
        receivedAt: new Date().toISOString(),
      };
      const artifact = store.saveArtifact(
        "reply_" + input.messageId,
        "participant-reply.txt",
        "text/plain",
        new TextEncoder().encode(input.text),
      );
      const evidenceId = "reply_" + input.messageId;
      c.evidence.push({
        id: evidenceId,
        title: "Local participant reply",
        sourceUrl: artifact.url,
        excerpt: input.text,
        sourceVersion: input.messageId,
        status: "confirmed",
        effectiveFrom: null,
        effectiveUntil: null,
        retrievedAt: new Date().toISOString(),
      });
      c.status = "running";
      c.blocker = null;
      event(
        c,
        "clarification_updated",
        "Participant reply saved; continuing the same agent session.",
        [evidenceId],
      );
      store.queue(caseId, "reply", input.text);
    },
  );
}
export function authorizeCase(store: CaseStore, caseId: string, raw: unknown) {
  const input = authorizationSchema.parse(raw);
  return store.input(
    caseId,
    input.eventId,
    input,
    input.expectedVersion,
    (r) => {
      const c = r.snapshot,
        action = c.pendingAction;
      if (
        c.status !== "waiting_for_authorization" ||
        !action ||
        action.id !== input.actionId ||
        action.reviewedVersion !== input.expectedVersion
      )
        throw new CaseError(
          409,
          "invalid_state",
          "This action is no longer available for review.",
        );
      if (Date.parse(action.expiresAt) <= Date.now())
        throw new CaseError(
          409,
          "action_expired",
          "The action expired. Pause and resume to prepare a fresh review.",
        );
      if (input.decision === "allow" && action.type === "contact_person") {
        const recipient = c.people.find(
          (p) => p.personId === action.payload.recipientPersonId,
        );
        if (
          !recipient ||
          (recipient.validFrom &&
            Date.parse(recipient.validFrom) > Date.now()) ||
          (recipient.validUntil &&
            Date.parse(recipient.validUntil) < Date.now())
        )
          throw new CaseError(
            409,
            "action_expired",
            "The coordinator's delegation is no longer valid. Pause and resume to resolve the current owner.",
          );
      }
      store.approval(caseId, action, input.decision);
      c.pendingAction = null;
      event(
        c,
        "authorization_recorded",
        input.decision === "allow"
          ? "Requester allowed the exact reviewed action."
          : "Requester declined the action. No new execution is authorized.",
      );
      if (input.decision === "decline") {
        r.lastDeclined = action;
        r.approved = null;
        c.status = "paused";
        c.blocker = {
          code: "authorization_required",
          message: "Action declined. Resume to prepare a new proposal.",
          taskId: c.currentTask,
        };
        return;
      }
      if (action.type === "contact_person") {
        const q = c.clarifications.find(
          (q) => q.id === action.payload.clarificationId,
        );
        if (!q)
          throw new CaseError(
            409,
            "invalid_state",
            "The question no longer exists.",
          );
        q.deliveryStatus = "delivered";
        q.externalMessageId = "demo_" + action.id;
        c.status = "waiting_for_reply";
        c.stage = "prepare";
        c.currentTask = "materials";
        c.blocker = {
          code: "missing_information",
          message:
            "Waiting for a reply in the local participant thread. No external message was sent.",
          taskId: "materials",
        };
        c.tasks.find((t) => t.id === "materials")!.status =
          "waiting_for_information";
        event(
          c,
          "clarification_updated",
          "Question delivered to the local demo thread.",
          action.payload.evidenceIds,
        );
      } else {
        r.approved = structuredClone(action);
        r.execution = { actionId: action.id, phase: "preparing" };
        c.stage = "execute";
        c.status = "running";
        c.blocker = null;
        c.currentTask = "draft";
        c.tasks.find((t) => t.id === "draft")!.status = "in_progress";
        store.queue(
          caseId,
          "execute",
          "Execute the approved draft action through the browser, then verify it.",
        );
      }
    },
  );
}
export function controlCase(store: CaseStore, caseId: string, raw: unknown) {
  const input = controlSchema.parse(raw);
  return store.input(
    caseId,
    input.eventId,
    input,
    input.expectedVersion,
    (r) => {
      const c = r.snapshot;
      if (c.status === "completed")
        throw new CaseError(
          409,
          "invalid_state",
          "The draft is already verified.",
        );
      if (
        input.action === "resume" &&
        r.approved &&
        r.execution?.phase === "preparing" &&
        Date.parse(r.approved.expiresAt) <= Date.now()
      ) {
        r.approved = null;
        r.execution = null;
        event(
          c,
          "control_updated",
          "Unused execution authorization expired; a fresh review is required.",
        );
      }
      if (input.action === "pause") {
        if (c.status !== "paused") r.resumeStatus = c.status;
        c.status = "paused";
        event(
          c,
          "control_updated",
          "Paused. In-flight writes will be reconciled before continuing.",
        );
      } else {
        if (!["paused", "failed"].includes(c.status))
          throw new CaseError(
            409,
            "invalid_state",
            "This request is not paused or failed.",
          );
        if (c.receipt) {
          c.status = "completed";
          c.stage = "verify";
          c.blocker = null;
          return;
        }
        if (c.pendingAction?.type === "contact_person") {
          const recipientId = c.pendingAction.payload.recipientPersonId;
          const person = c.people.find((p) => p.personId === recipientId);
          if (
            !person ||
            (person.validUntil && Date.parse(person.validUntil) < Date.now())
          ) {
            c.pendingAction = null;
            c.people = [];
            c.currentTask = "route";
            c.tasks.find((t) => t.id === "route")!.status = "in_progress";
          }
        }
        if (
          c.pendingAction &&
          Date.parse(c.pendingAction.expiresAt) > Date.now()
        ) {
          c.status = "waiting_for_authorization";
        } else if (
          c.clarifications.some(
            (q) => q.deliveryStatus === "delivered" && !q.reply,
          )
        )
          c.status = "waiting_for_reply";
        else {
          c.pendingAction = null;
          c.status = "running";
          store.queue(
            caseId,
            "resume",
            "Resume this case from its saved state. Do not reuse declined authorization. Reconcile any uncertain save first.",
          );
        }
        c.blocker = null;
        event(
          c,
          "control_updated",
          "Resumed from the saved request and authorization history.",
        );
      }
    },
  );
}
