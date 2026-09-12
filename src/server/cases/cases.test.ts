import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCaseStore, CaseError, hash } from "./store";
import { createCase, replyCase, authorizeCase, controlCase } from "./service";
import { dispatchTool } from "./tools";
import { verifyRecord } from "./browser";
import { QUOTE_ID } from "./context";
import type { DraftAction, PortalDraft } from "../../lib/contracts";

const request = () => ({
  eventId: randomUUID(),
  requestText: "Purchase a thermal camera for prototype validation.",
  quoteArtifactId: QUOTE_ID,
});

test("case/session, job phase and tool results survive restart; lease takeover preserves one job", () => {
  const dir = mkdtempSync(join(tmpdir(), "relay-case-test-"));
  const file = join(dir, "cases.sqlite");
  let store = createCaseStore(file);
  try {
    const c = createCase(store, request()).record.snapshot;
    const original = store.claim("first-worker")!;
    store.jobPhase(original, "active");
    store.update(
      c.id,
      (r) => {
        r.sessionId = "persisted-session";
      },
      false,
    );
    store.tool("call-1", "fingerprint", c.id, () => ({ saved: true }));
    store.queue(c.id, "reply", "The reply is persisted too.");
    assert.equal(store.claim("second-worker"), undefined);
    store.close();
    store = createCaseStore(file);
    assert.equal(store.get(c.id).sessionId, "persisted-session");
    assert.deepEqual(
      store.tool("call-1", "fingerprint", c.id, () => {
        throw new Error("Must not execute twice");
      }),
      { saved: true },
    );
    const recovered = store.claim("restarted-worker", Date.now() + 61000)!;
    assert.equal(recovered.id, original.id);
    assert.equal(recovered.phase, "active");
    assert.equal(store.owns(original), false);
    store.finish(recovered);
    assert.equal(store.claim("restarted-worker")?.kind, "reply");
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
async function prepared() {
  const store = createCaseStore(":memory:"),
    input = request();
  const { record } = createCase(store, input),
    id = record.snapshot.id;
  const job = store.claim("test")!;
  let call = 0;
  async function tool(name: string, args: unknown, callId = String(++call)) {
    return dispatchTool(
      store,
      job,
      { turn_id: "turn1", call_id: callId, name, arguments: args },
      "session1",
    );
  }
  await tool("resolve_route", {
    personId: "carol",
    evidenceIds: ["policy_2026", "handover_bob", "delegation_carol"],
    explanation:
      "Carol holds the dated equipment coordination delegation during Bob's absence.",
  });
  await tool("propose_question", {
    question: "Which cost center and technical justification should be used?",
  });
  return { store, id, job, tool, input };
}
test("create events are idempotent across retries and versions; changed event content conflicts", () => {
  const store = createCaseStore(":memory:"),
    input = request();
  try {
    const first = createCase(store, input),
      retry = createCase(store, input);
    assert.equal(first.record.snapshot.id, retry.record.snapshot.id);
    assert.equal(store.list().length, 1);
    assert.throws(
      () =>
        createCase(store, {
          ...input,
          requestText: "Different purchase request",
        }),
      (e) => e instanceof CaseError && e.code === "idempotency_conflict",
    );
  } finally {
    store.close();
  }
});
test("contact requires current review; replies correlate to the delivered question; immutable approval controls execution", async () => {
  const { store, id, tool } = await prepared();
  try {
    let c = store.get(id).snapshot;
    const authorization = {
      eventId: randomUUID(),
      actionId: c.pendingAction!.id,
      expectedVersion: c.version,
      decision: "allow",
    };
    assert.throws(
      () =>
        authorizeCase(store, id, {
          ...authorization,
          expectedVersion: c.version - 1,
        }),
      (e) => e instanceof CaseError && e.code === "stale_version",
    );
    c = authorizeCase(store, id, authorization).snapshot;
    assert.equal(c.status, "waiting_for_reply");
    assert.equal(
      authorizeCase(store, id, authorization).snapshot.version,
      c.version,
    );
    const reply = {
      messageId: randomUUID(),
      clarificationId: c.clarifications[0].id,
      expectedVersion: c.version,
      text: "Use ENG-240. Thermal validation of our next prototype needs accurate temperature measurements.",
    };
    assert.throws(
      () => replyCase(store, id, { ...reply, clarificationId: "wrong" }),
      CaseError,
    );
    c = replyCase(store, id, reply).snapshot;
    assert.equal(replyCase(store, id, reply).snapshot.version, c.version);
    const bad = await tool("prepare_draft", {
      costCenter: "MADE-UP",
      justification: reply.text,
      evidenceIds: ["reply_" + reply.messageId],
    });
    assert.equal(bad.success, false);
    await tool("prepare_draft", {
      costCenter: "ENG-240",
      justification: reply.text,
      evidenceIds: ["reply_" + reply.messageId],
    });
    c = store.get(id).snapshot;
    const exact = structuredClone(c.pendingAction);
    authorizeCase(store, id, {
      eventId: randomUUID(),
      actionId: c.pendingAction!.id,
      expectedVersion: c.version,
      decision: "allow",
    });
    assert.equal(hash(store.get(id).approved), hash(exact));
    assert.equal(store.get(id).snapshot.pendingAction, null);
    assert.equal(store.get(id).snapshot.receipt, null);
  } finally {
    store.close();
  }
});
test("decline and pause block actions; resume cannot restore rejected authorization", async () => {
  const { store, id, tool } = await prepared();
  try {
    let c = store.get(id).snapshot,
      old = c.pendingAction!.id;
    c = authorizeCase(store, id, {
      eventId: randomUUID(),
      actionId: old,
      expectedVersion: c.version,
      decision: "decline",
    }).snapshot;
    assert.equal(c.status, "paused");
    assert.equal(c.pendingAction, null);
    assert.equal(store.get(id).approved, null);
    assert.equal(
      (
        await tool("propose_question", {
          question: "Please confirm the cost center and purpose.",
        })
      ).success,
      false,
    );
    c = controlCase(store, id, {
      eventId: randomUUID(),
      expectedVersion: store.get(id).snapshot.version,
      action: "resume",
    }).snapshot;
    assert.equal(c.pendingAction, null);
    await tool("propose_question", {
      question: "Please confirm the cost center and purpose.",
    });
    assert.notEqual(store.get(id).snapshot.pendingAction?.id, old);
  } finally {
    store.close();
  }
});
test("expired review is rejected and duplicate tool call does not propose twice", async () => {
  const { store, id, tool } = await prepared();
  try {
    const c = store.update(id, (r) => {
      r.snapshot.pendingAction!.expiresAt = "2000-01-01T00:00:00Z";
    }).snapshot;
    assert.throws(
      () =>
        authorizeCase(store, id, {
          eventId: randomUUID(),
          actionId: c.pendingAction!.id,
          expectedVersion: c.version,
          decision: "allow",
        }),
      (e) => e instanceof CaseError && e.code === "action_expired",
    );
    const before = store.get(id).snapshot.clarifications.length;
    await tool(
      "propose_question",
      {
        question:
          "Which cost center and technical justification should be used?",
      },
      "2",
    );
    assert.equal(store.get(id).snapshot.clarifications.length, before);
  } finally {
    store.close();
  }
});
test("receipt verification rejects changed fields and attachment hashes", () => {
  const fields = {
    item: "Camera",
    vendor: "Demo",
    quantity: 1,
    currency: "USD",
    unitPrice: "2450.00",
    costCenter: "ENG-240",
    justification: "Prototype validation testing",
  };
  const attachment = {
    id: "a",
    fileName: "quote.txt",
    mediaType: "text/plain",
    sizeBytes: 4,
    sha256: "hash",
    url: "/api/artifacts/a",
  };
  const action: DraftAction = {
    id: "a1",
    type: "create_draft",
    reviewedVersion: 2,
    expiresAt: new Date().toISOString(),
    payload: {
      fields,
      attachments: [attachment],
      destination: "/portal/new",
      requestReference: "r1",
    },
  };
  const record: PortalDraft = {
    id: "po1",
    requestReference: "r1",
    status: "draft",
    url: "/portal/drafts/po1",
    createdAt: new Date().toISOString(),
    fields,
    attachments: [attachment],
  };
  verifyRecord(action, record);
  assert.throws(
    () =>
      verifyRecord(action, {
        ...record,
        fields: { ...fields, unitPrice: "999" },
      }),
    /field/,
  );
  assert.throws(
    () =>
      verifyRecord(action, {
        ...record,
        attachments: [{ ...attachment, sha256: "changed" }],
      }),
    /attachments/,
  );
});
