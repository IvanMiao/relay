import test from "node:test";
import assert from "node:assert/strict";
import { caseSnapshots } from "../../../fixtures/case-snapshots";
import { fromContract, liveSnapshot } from "./contract-adapter";

test("all teammate snapshots render, including completion with no current task", () => {
  for (const wire of Object.values(caseSnapshots)) {
    const view = fromContract({ case: wire });
    assert.equal(view.id, wire.id);
    assert.equal(view.version, wire.version);
    assert.equal(typeof view.currentTask, "string");
  }
  assert.equal(fromContract(caseSnapshots.completed).receipt?.simulated, true);
  assert.equal(fromContract(caseSnapshots.completed).receipt?.url, undefined);
  assert.throws(() => liveSnapshot(caseSnapshots.completed), /fixture/);
});

test("reply targets delivered clarification and reviews retain the exact nested payload", () => {
  const waiting = fromContract(caseSnapshots.waitingForReply);
  assert.equal(waiting.pendingAction?.id, "clarification_demo_001");
  assert.equal(waiting.pendingAction?.type, "clarification");
  const wire = { ...caseSnapshots.actionReview, mode: "live" as const };
  assert.deepEqual(
    liveSnapshot(wire).pendingAction?.payload,
    wire.pendingAction?.payload,
  );
  const contact = {
    ...wire,
    pendingAction: {
      id: "contact_1",
      type: "contact_person" as const,
      reviewedVersion: wire.version,
      expiresAt: "2026-09-30T12:00:00Z",
      payload: {
        clarificationId: "q1",
        recipientPersonId: "person_carol",
        channel: "demo_thread" as const,
        text: "Which cost center?",
        evidenceIds: ["evidence_delegation"],
      },
    },
  };
  assert.equal(liveSnapshot(contact).pendingAction?.type, "contact_person");
  assert.match(liveSnapshot(contact).pendingAction?.destination ?? "", /Carol/);
});
