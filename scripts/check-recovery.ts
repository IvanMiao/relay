import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { caseStore, createCaseStore } from "../src/server/cases/store";
import { executeDraft, portalBase } from "../src/server/cases/browser";

async function main() {
  const caseId = process.argv[2];
  if (!caseId) throw new Error("Pass a verified synthetic case ID.");
  const source = caseStore(),
    saved = source.get(caseId);
  assert(saved.snapshot.receipt && saved.approved);
  const expected = saved.snapshot.receipt.record.id;
  // Simulate losing the save response in an isolated case store. The real case
  // and portal record remain unchanged; reconciliation may only reopen/read.
  const dir = mkdtempSync(join(tmpdir(), "relay-recovery-"));
  const store = createCaseStore(join(dir, "cases.sqlite"));
  try {
    const fixture = structuredClone(saved);
    fixture.snapshot.receipt = null;
    fixture.snapshot.status = "running";
    fixture.execution = { actionId: fixture.approved!.id, phase: "saving" };
    store.create({ eventId: "recovery-check" }, fixture);
    const job = store.claim("recovery-check")!;
    const before = await fetch(portalBase() + "/api/portal/drafts").then((r) =>
      r.json(),
    );
    const result = await executeDraft(store, job);
    const after = await fetch(portalBase() + "/api/portal/drafts").then((r) =>
      r.json(),
    );
    assert.equal(result?.record.id, expected);
    assert.deepEqual(
      after.drafts.map((d: { id: string }) => d.id),
      before.drafts.map((d: { id: string }) => d.id),
    );
    assert.equal(store.get(caseId).snapshot.status, "completed");
    console.log(
      `PASS: uncertain-save recovery reopened ${expected}, verified bytes and created no duplicate.`,
    );
  } finally {
    store.close();
    source.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
void main();
