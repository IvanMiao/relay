import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  PortalError,
  validateDraft,
  type PortalDraft,
  type UploadInput,
} from "./schema";

type DraftRow = { id: string; fingerprint: string; record: string };
function openDatabase(filename: string) {
  if (filename !== ":memory:")
    mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(
    "PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS drafts (id TEXT PRIMARY KEY, request_reference TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL, record TEXT NOT NULL, created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, draft_id TEXT NOT NULL REFERENCES drafts(id), name TEXT NOT NULL, content_type TEXT NOT NULL, bytes BLOB NOT NULL);",
  );
  return db;
}
export function createPortalStore(filename: string, connection?: DatabaseSync) {
  const db = connection || openDatabase(filename);
  const decode = (row: unknown): PortalDraft | null =>
    row ? (JSON.parse((row as DraftRow).record) as PortalDraft) : null;
  return {
    list(): PortalDraft[] {
      return db
        .prepare("SELECT record FROM drafts ORDER BY created_at DESC LIMIT 100")
        .all()
        .map((row) => decode(row)!);
    },
    get(id: string) {
      return decode(
        db.prepare("SELECT record FROM drafts WHERE id = ?").get(id),
      );
    },
    find(reference: string) {
      return decode(
        db
          .prepare("SELECT record FROM drafts WHERE request_reference = ?")
          .get(reference),
      );
    },
    attachment(id: string) {
      return db
        .prepare(
          "SELECT name, content_type, bytes FROM attachments WHERE id = ?",
        )
        .get(id) as
        { name: string; content_type: string; bytes: Uint8Array } | undefined;
    },
    create(
      input: unknown,
      files: UploadInput[],
    ): { draft: PortalDraft; reused: boolean } {
      const fields = validateDraft(input, files);
      const fileHashes = files.map((file) => ({
        name: file.name,
        type: file.contentType,
        sha256: createHash("sha256").update(file.bytes).digest("hex"),
      }));
      const fingerprint = createHash("sha256")
        .update(JSON.stringify({ fields, files: fileHashes }))
        .digest("hex");
      db.exec("BEGIN IMMEDIATE");
      try {
        const existing = db
          .prepare(
            "SELECT record, fingerprint FROM drafts WHERE request_reference = ?",
          )
          .get(fields.requestReference) as DraftRow | undefined;
        if (existing) {
          const saved = decode(existing)!;
          const signatures = (
            items: { name: string; type: string; sha256: string }[],
          ) => items.map((a) => JSON.stringify(a)).sort();
          const oldHashes = saved.attachments.map((a) => ({
            name: a.name,
            type: a.contentType,
            sha256: a.sha256,
          }));
          if (
            JSON.stringify(saved.fields) !== JSON.stringify(fields) ||
            JSON.stringify(signatures(oldHashes)) !==
              JSON.stringify(signatures(fileHashes))
          )
            throw new PortalError(
              409,
              "This request reference already belongs to a different draft. Open the existing record or use a new reference.",
            );
          db.exec("COMMIT");
          return { draft: decode(existing)!, reused: true };
        }
        const id = "PO-" + randomUUID().slice(0, 8).toUpperCase();
        const draft: PortalDraft = {
          id,
          requestReference: fields.requestReference,
          status: "draft",
          fields,
          createdAt: new Date().toISOString(),
          url: "/portal/drafts/" + id,
          attachments: files.map((file, index) => {
            const attachmentId = randomUUID();
            return {
              id: attachmentId,
              name: file.name,
              contentType: file.contentType,
              size: file.bytes.length,
              sha256: fileHashes[index].sha256,
              url: "/api/portal/attachments/" + attachmentId,
            };
          }),
        };
        db.prepare("INSERT INTO drafts VALUES (?, ?, ?, ?, ?)").run(
          id,
          fields.requestReference,
          fingerprint,
          JSON.stringify(draft),
          draft.createdAt,
        );
        files.forEach((file, index) =>
          db
            .prepare("INSERT INTO attachments VALUES (?, ?, ?, ?, ?)")
            .run(
              draft.attachments[index].id,
              id,
              file.name,
              file.contentType,
              file.bytes,
            ),
        );
        db.exec("COMMIT");
        return { draft, reused: false };
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    close() {
      db.close();
    },
  };
}

// Cache only the connection. Caching functions also retains old error classes
// across Next.js reloads and can turn intended 409 responses into generic 500s.
const portalGlobal = globalThis as typeof globalThis & {
  relayPortalDatabase?: DatabaseSync;
};
export function portalStore() {
  const filename =
    process.env.RELAY_PORTAL_DB || join(process.cwd(), "data", "portal.sqlite");
  portalGlobal.relayPortalDatabase ??= openDatabase(filename);
  return createPortalStore(filename, portalGlobal.relayPortalDatabase);
}
