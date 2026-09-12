import { chromium, type Page } from "playwright";
import { createHash, randomUUID } from "node:crypto";
import type { DraftAction, PortalDraft } from "../../lib/contracts";
import { CaseError, event, hash, type CaseStore, type Job } from "./store";

export function portalBase() {
  const base = new URL(process.env.RELAY_BASE_URL || "http://127.0.0.1:3100");
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) ||
    base.protocol !== "http:"
  )
    throw new Error("The prototype executor requires a loopback HTTP portal.");
  return base.origin;
}
function destination(path: string, base: string, prefix: string) {
  const url = new URL(path, base);
  if (url.origin !== base || !url.pathname.startsWith(prefix))
    throw new Error("Unexpected portal destination.");
  return url.href;
}
export function verifyRecord(action: DraftAction, record: PortalDraft) {
  const expected = action.payload;
  if (
    record.status !== "draft" ||
    record.requestReference !== expected.requestReference
  )
    throw new Error("Saved record identity or status differs from approval.");
  for (const key of Object.keys(
    expected.fields,
  ) as (keyof typeof expected.fields)[]) {
    const a = expected.fields[key],
      b = record.fields[key];
    if (key === "unitPrice" ? Number(a) !== Number(b) : a !== b)
      throw new Error("Saved field differs from approval: " + key);
  }
  const signatures = (
    items: {
      fileName: string;
      mediaType: string;
      sizeBytes: number;
      sha256: string;
    }[],
  ) =>
    items
      .map((a) =>
        JSON.stringify([a.fileName, a.mediaType, a.sizeBytes, a.sha256]),
      )
      .sort();
  if (
    JSON.stringify(signatures(expected.attachments)) !==
    JSON.stringify(signatures(record.attachments))
  )
    throw new Error("Saved attachments differ from the approved files.");
}
async function lookup(
  action: DraftAction,
  base: string,
): Promise<PortalDraft | null> {
  const response = await fetch(
    base +
      "/api/portal/drafts?requestReference=" +
      encodeURIComponent(action.payload.requestReference),
    {
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
      redirect: "error",
    },
  );
  if (!response.ok)
    throw new Error("Unable to reconcile the portal request reference.");
  const value = await response.json();
  if (!("draft" in value))
    throw new Error("Portal lookup response is invalid.");
  return value.draft;
}
export async function executeDraft(store: CaseStore, job: Job) {
  const original = store.get(job.case_id);
  if (original.snapshot.receipt) return original.snapshot.receipt;
  const action = original.approved;
  if (!action)
    throw new CaseError(403, "forbidden", "No approved draft action exists.");
  const fingerprint = hash(action),
    base = portalBase();
  const guard = () => {
    const r = store.get(job.case_id);
    if (!store.owns(job))
      throw new Error("Worker lease lost; execution stopped.");
    if (r.snapshot.status === "paused")
      throw new CaseError(
        409,
        "invalid_state",
        "Case paused; no new browser action dispatched.",
      );
    if (!r.approved || hash(r.approved) !== fingerprint)
      throw new CaseError(
        403,
        "forbidden",
        "Authorization changed; browser execution stopped.",
      );
    return r;
  };
  guard();
  let record = await lookup(action, base);
  if (!record && original.execution?.phase === "saving")
    throw new Error(
      "Previous save is uncertain and no record is visible yet. Resume to reconcile; no second save was attempted.",
    );
  if (!record && Date.parse(action.expiresAt) <= Date.now())
    throw new CaseError(
      409,
      "action_expired",
      "Draft execution authorization expired. A fresh review is required.",
    );
  const browser = await chromium.launch({
    channel: process.env.RELAY_BROWSER_CHANNEL || "chrome",
    headless: true,
    env: Object.fromEntries(
      ["PATH", "HOME", "TMPDIR", "LANG"].flatMap((k) =>
        process.env[k] ? [[k, process.env[k]!]] : [],
      ),
    ),
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      serviceWorkers: "block",
    });
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      return url.origin === base
        ? route.continue()
        : route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const observe = async (summary: string) => {
      const bytes = await page.screenshot({ fullPage: true });
      const screenshot = store.saveArtifact(
        "browser_" + randomUUID(),
        "portal-observation.png",
        "image/png",
        bytes,
      );
      store.update(job.case_id, (r) => {
        r.snapshot.browserObservation = {
          screenshot,
          pageUrl: page.url(),
          observedAt: new Date().toISOString(),
          summary,
        };
        event(r.snapshot, "execution_updated", summary);
      });
    };
    const act = async (operation: () => Promise<unknown>) => {
      guard();
      await operation();
    };
    if (!record) {
      await act(() =>
        page.goto(
          base +
            "/portal/new?requestReference=" +
            encodeURIComponent(action.payload.requestReference),
        ),
      );
      await observe("Opened the test purchasing form in an isolated browser.");
      const labels = {
        item: "Item",
        vendor: "Vendor",
        quantity: "Quantity",
        currency: "Currency",
        unitPrice: "Unit price",
        costCenter: "Cost center",
        justification: "Justification",
      };
      for (const [key, label] of Object.entries(labels)) {
        const value = String(
          action.payload.fields[key as keyof typeof action.payload.fields],
        );
        await act(() =>
          key === "currency"
            ? page.getByLabel(label, { exact: true }).selectOption(value)
            : page.getByLabel(label, { exact: true }).fill(value),
        );
      }
      await act(() =>
        page
          .getByLabel("Request reference", { exact: true })
          .fill(action.payload.requestReference),
      );
      const attachments = action.payload.attachments.map((a) => {
        const stored = store.artifact(a.id);
        if (
          !stored ||
          stored.ref.sha256 !== a.sha256 ||
          stored.ref.sizeBytes !== a.sizeBytes
        )
          throw new Error("Approved attachment bytes changed or disappeared.");
        return {
          name: a.fileName,
          mimeType: a.mediaType,
          buffer: Buffer.from(stored.bytes),
        };
      });
      await act(() =>
        page
          .getByLabel("Attachments", { exact: true })
          .setInputFiles(attachments),
      );
      await observe(
        "Filled the reviewed fields and uploaded the original quote. Save has not been clicked.",
      );
      guard();
      store.update(job.case_id, (r) => {
        r.execution = { actionId: action.id, phase: "saving" };
        event(
          r.snapshot,
          "execution_updated",
          "Saving one authorized draft through the portal's Save draft control.",
        );
      });
      // From this point a crash is an uncertain write: lookup before any future save.
      await page
        .getByRole("button", { name: "Save draft", exact: true })
        .click();
      try {
        await page.waitForURL("**/portal/drafts/*", { timeout: 15000 });
      } catch {
        record = await lookup(action, base);
        if (!record)
          throw new Error(
            "Save did not produce a readable receipt; reconciliation is required before retry.",
          );
      }
      record ??= await lookup(action, base);
      if (!record)
        throw new Error(
          "Saved draft could not be found by its request reference.",
        );
      store.update(job.case_id, (r) => {
        r.execution = {
          actionId: action.id,
          phase: "saved",
          recordId: record!.id,
        };
      });
    }
    // Read-back continues even if pause arrived while save was in flight; no further writes occur.
    await page.goto(destination(record.url, base, "/portal/drafts/"));
    await page.getByText(record.id, { exact: true }).waitFor();
    verifyRecord(action, record);
    for (const a of record.attachments) {
      const response = await fetch(
        destination(a.url, base, "/api/portal/attachments/"),
        { signal: AbortSignal.timeout(15000), redirect: "error" },
      );
      if (!response.ok)
        throw new Error("Saved attachment could not be downloaded.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (
        bytes.length !== a.sizeBytes ||
        createHash("sha256").update(bytes).digest("hex") !== a.sha256
      )
        throw new Error("Downloaded attachment failed byte verification.");
    }
    await observe(
      "Reopened the saved draft. Fields and downloaded attachment hashes match the authorized payload.",
    );
    const verifiedRecord = record;
    return store.update(job.case_id, (r) => {
      if (!r.approved || hash(r.approved) !== fingerprint)
        throw new Error("Authorization changed during verification.");
      r.execution = {
        actionId: action.id,
        phase: "verified",
        recordId: verifiedRecord.id,
      };
      r.snapshot.receipt = {
        record: verifiedRecord,
        verifiedAt: new Date().toISOString(),
        verifiedActionId: action.id,
        fieldsMatch: true,
        attachmentsMatch: true,
        nextStep: "organizational_review",
      };
      r.snapshot.stage = "verify";
      if (r.snapshot.status !== "paused") r.snapshot.status = "completed";
      r.snapshot.blocker = null;
      r.snapshot.currentTask = null;
      r.snapshot.tasks.find((t) => t.id === "draft")!.status = "completed";
      event(
        r.snapshot,
        "draft_verified",
        "Draft verified against the approved fields and original files. Organizational approval is still required.",
      );
    }).snapshot.receipt;
  } finally {
    await browser.close();
  }
}
