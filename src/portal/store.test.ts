import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPortalStore } from "./store";
import { PortalError } from "./schema";
import { portalRecord } from "./contract";

const fields = {
  requestReference: "TEST-1042",
  item: "Thermal camera",
  vendor: "Synthetic supplier",
  quantity: 2,
  currency: "USD",
  unitPrice: 2450,
  costCenter: "ENG-240",
  justification:
    "Validate the thermal behavior of our next engineering prototype.",
};
const quote = {
  name: "quote.txt",
  contentType: "text/plain",
  bytes: new TextEncoder().encode(
    "Synthetic quote: two units at USD 2450 each.",
  ),
};

test("v1 receipt uses decimal strings and attachment metadata; file order does not create a duplicate", () => {
  const store = createPortalStore(":memory:");
  try {
    const justification = { ...quote, name: "justification.txt" };
    const input = { ...fields, requestReference: "relay:case_demo:draft:1" };
    const first = store.create(input, [quote, justification]);
    const retry = store.create(input, [justification, quote]);
    assert.equal(first.draft.id, retry.draft.id);
    const wire = portalRecord(first.draft);
    assert.equal(wire.fields.unitPrice, "2450.00");
    assert.equal(wire.attachments[0].fileName, "quote.txt");
    assert.equal(wire.attachments[0].sizeBytes, quote.bytes.length);
    assert.equal("requestReference" in wire.fields, false);
  } finally {
    store.close();
  }
});

test("saved drafts and original attachment bytes survive reopening the database", () => {
  const directory = mkdtempSync(join(tmpdir(), "relay-store-"));
  const filename = join(directory, "portal.sqlite");
  let store = createPortalStore(filename);
  try {
    const created = store.create(fields, [quote]);
    assert.equal(created.reused, false);
    store.close();
    store = createPortalStore(filename);
    const saved = store.get(created.draft.id)!;
    assert.deepEqual(saved.fields, fields);
    assert.equal(saved.status, "draft");
    assert.deepEqual(
      store.attachment(saved.attachments[0].id)?.bytes,
      quote.bytes,
    );
    assert.equal(store.find(fields.requestReference)?.id, saved.id);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test("retries return the same draft; changed fields or attachment bytes cannot reuse its reference", () => {
  const store = createPortalStore(":memory:");
  try {
    const first = store.create(fields, [quote]);
    const retry = store.create(fields, [quote]);
    assert.equal(retry.draft.id, first.draft.id);
    assert.equal(retry.reused, true);
    assert.throws(
      () => store.create({ ...fields, unitPrice: 2500 }, [quote]),
      (error) => error instanceof PortalError && error.status === 409,
    );
    assert.throws(
      () =>
        store.create(fields, [
          { ...quote, bytes: new TextEncoder().encode("Changed quote") },
        ]),
      (error) => error instanceof PortalError && error.status === 409,
    );
    assert.equal(store.list().length, 1);
    assert.equal(store.get(first.draft.id)?.fields.unitPrice, 2450);
  } finally {
    store.close();
  }
});
test("invalid amounts, missing accounting information and unsupported attachments never create a draft", () => {
  const store = createPortalStore(":memory:");
  try {
    for (const input of [
      { ...fields, unitPrice: 1.001 },
      { ...fields, quantity: -1 },
      { ...fields, costCenter: "" },
      { ...fields, currency: "INVALID" },
    ]) {
      assert.throws(() => store.create(input, [quote]), PortalError);
    }
    assert.throws(() => store.create(fields, []), PortalError);
    assert.throws(
      () =>
        store.create(fields, [
          { ...quote, name: "quote.html", contentType: "text/html" },
        ]),
      PortalError,
    );
    assert.throws(
      () =>
        store.create(fields, [
          { ...quote, bytes: new Uint8Array(5 * 1024 * 1024 + 1) },
        ]),
      PortalError,
    );
    assert.equal(store.list().length, 0);
  } finally {
    store.close();
  }
});
