import assert from "node:assert/strict";
import { createHash } from "node:crypto";

// Reuse a draft saved through the browser; do not create a synthetic success path.
const base = process.env.RELAY_BASE_URL || "http://127.0.0.1:3100";
const reference = process.argv[2];
if (!reference) throw new Error("Pass the request reference of a browser-saved test draft.");
const lookup = await fetch(base + "/api/portal/drafts?requestReference=" + encodeURIComponent(reference));
assert.equal(lookup.status, 200);
const { draft } = await lookup.json();
assert(draft, "Save the test draft through the browser first.");
assert.equal(typeof draft.fields.unitPrice, "string");
const files = await Promise.all(draft.attachments.map(async a => {
  const response = await fetch(base + a.url);
  assert.equal(response.status, 200);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(bytes.length, a.sizeBytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), a.sha256);
  return { a, bytes };
}));
async function save(fields, origin = base) {
  const body = new FormData();
  body.set("payload", JSON.stringify({ requestReference: reference, fields }));
  for (const { a, bytes } of files) body.append("attachments", new Blob([bytes], { type: a.mediaType }), a.fileName);
  return fetch(base + "/api/portal/drafts", { method: "POST", body, headers: { Origin: origin } });
}
const retry = await save(draft.fields);
assert.equal(retry.status, 200);
assert.equal((await retry.json()).draft.id, draft.id);
const conflict = await save({ ...draft.fields, vendor: "Different test vendor" });
assert.equal(conflict.status, 409);
assert.equal((await conflict.json()).error.code, "idempotency_conflict");
const invalid = await save({ ...draft.fields, unitPrice: "1e3" });
assert.equal(invalid.status, 422);
assert((await invalid.json()).error.fieldErrors.unitPrice);
assert.equal((await save(draft.fields, "https://example.org")).status, 403);
const missing = await fetch(base + "/api/portal/drafts?requestReference=integration-missing-record");
assert.equal(missing.status, 200);
assert.equal((await missing.json()).draft, null);
console.log(`PASS: ${draft.id}; exact attachment bytes, v1 receipt, retry, conflict, validation, origin and absent lookup.`);
