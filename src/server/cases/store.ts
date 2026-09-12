import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import type {
  CaseSnapshot,
  DraftAction,
  PendingAction,
  ArtifactRef,
  ApiErrorCode,
} from "../../lib/contracts";

export class CaseError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode,
    message: string,
    public currentVersion?: number,
  ) {
    super(message);
  }
}
export interface CaseRecord {
  snapshot: CaseSnapshot;
  sessionId: string | null;
  approved: DraftAction | null;
  execution: {
    actionId: string;
    phase: "preparing" | "saving" | "saved" | "verified";
    recordId?: string;
  } | null;
  resumeStatus?: CaseSnapshot["status"];
  lastDeclined?: PendingAction;
}
export interface Job {
  id: string;
  case_id: string;
  kind: string;
  input: string;
  phase: string;
  owner: string;
}
export function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function event(
  c: CaseSnapshot,
  kind: CaseSnapshot["events"][number]["kind"],
  summary: string,
  evidenceIds: string[] = [],
) {
  c.events.push({
    id: randomUUID(),
    occurredAt: new Date().toISOString(),
    kind,
    summary,
    evidenceIds,
  });
}

export function createCaseStore(filename: string) {
  if (filename !== ":memory:")
    mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS cases(id TEXT PRIMARY KEY, record TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS inputs(scope TEXT NOT NULL, id TEXT NOT NULL, fingerprint TEXT NOT NULL, case_id TEXT NOT NULL, PRIMARY KEY(scope,id));
    CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, case_id TEXT NOT NULL, kind TEXT NOT NULL, input TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'queued', phase TEXT NOT NULL DEFAULT 'pending', owner TEXT, lease INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS tool_calls(id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, result TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS artifacts(id TEXT PRIMARY KEY, metadata TEXT NOT NULL, bytes BLOB NOT NULL);
    CREATE TABLE IF NOT EXISTS worker_state(id TEXT PRIMARY KEY, heartbeat INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS approvals(id TEXT PRIMARY KEY, case_id TEXT NOT NULL, payload TEXT NOT NULL, decision TEXT NOT NULL, created_at TEXT NOT NULL);`);
  const get = (id: string): CaseRecord => {
    const row = db.prepare("SELECT record FROM cases WHERE id=?").get(id) as
      { record: string } | undefined;
    if (!row) throw new CaseError(404, "not_found", "Request not found.");
    return JSON.parse(row.record);
  };
  const put = (r: CaseRecord) =>
    db
      .prepare("UPDATE cases SET record=? WHERE id=?")
      .run(JSON.stringify(r), r.snapshot.id);
  const queue = (caseId: string, kind: string, input: string) =>
    db
      .prepare("INSERT INTO jobs(id,case_id,kind,input) VALUES(?,?,?,?)")
      .run(randomUUID(), caseId, kind, input);
  const tx = <T>(fn: () => T): T => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  const bump = (r: CaseRecord) => {
    r.snapshot.version++;
    r.snapshot.updatedAt = new Date().toISOString();
    if (r.snapshot.pendingAction)
      r.snapshot.pendingAction.reviewedVersion = r.snapshot.version;
    put(r);
  };
  const duplicate = (scope: string, id: string, fingerprint: string) => {
    const old = db
      .prepare("SELECT * FROM inputs WHERE scope=? AND id=?")
      .get(scope, id) as { fingerprint: string; case_id: string } | undefined;
    if (old && old.fingerprint !== fingerprint)
      throw new CaseError(
        409,
        "idempotency_conflict",
        "This event ID was already used for different content.",
      );
    return old ? get(old.case_id) : null;
  };
  return {
    get,
    queue,
    list: () =>
      db
        .prepare("SELECT record FROM cases ORDER BY rowid DESC LIMIT 30")
        .all()
        .map(
          (row) => (JSON.parse(row.record as string) as CaseRecord).snapshot,
        ),
    create(input: { eventId: string }, record: CaseRecord) {
      return tx(() => {
        const fingerprint = hash(input),
          prior = duplicate("requester:local-demo", input.eventId, fingerprint);
        if (prior) return { record: prior, reused: true };
        db.prepare("INSERT INTO cases VALUES(?,?)").run(
          record.snapshot.id,
          JSON.stringify(record),
        );
        db.prepare("INSERT INTO inputs VALUES(?,?,?,?)").run(
          "requester:local-demo",
          input.eventId,
          fingerprint,
          record.snapshot.id,
        );
        queue(record.snapshot.id, "start", record.snapshot.requestText);
        return { record, reused: false };
      });
    },
    update(id: string, fn: (record: CaseRecord) => void, visible = true) {
      return tx(() => {
        const r = get(id);
        fn(r);
        if (visible) bump(r);
        else put(r);
        return r;
      });
    },
    input(
      id: string,
      eventId: string,
      body: unknown,
      version: number,
      fn: (record: CaseRecord) => void,
    ) {
      return tx(() => {
        const fingerprint = hash(body),
          prior = duplicate(id, eventId, fingerprint);
        if (prior) return prior;
        const r = get(id);
        if (r.snapshot.version !== version)
          throw new CaseError(
            409,
            "stale_version",
            "This request changed. Review the latest version.",
            r.snapshot.version,
          );
        fn(r);
        bump(r);
        db.prepare("INSERT INTO inputs VALUES(?,?,?,?)").run(
          id,
          eventId,
          fingerprint,
          id,
        );
        return r;
      });
    },
    approval(caseId: string, action: PendingAction, decision: string) {
      db.prepare("INSERT INTO approvals VALUES(?,?,?,?,?)").run(
        action.id,
        caseId,
        JSON.stringify(action),
        decision,
        new Date().toISOString(),
      );
    },
    tool(
      id: string,
      fingerprint: string,
      caseId: string,
      fn: (r: CaseRecord) => unknown,
    ) {
      return tx(() => {
        const old = db
          .prepare("SELECT * FROM tool_calls WHERE id=?")
          .get(id) as { fingerprint: string; result: string } | undefined;
        if (old) {
          if (old.fingerprint !== fingerprint)
            throw new Error("Tool call content changed.");
          return JSON.parse(old.result);
        }
        const r = get(caseId);
        const result = fn(r);
        bump(r);
        db.prepare("INSERT INTO tool_calls VALUES(?,?,?)").run(
          id,
          fingerprint,
          JSON.stringify(result),
        );
        return result;
      });
    },
    artifact(id: string) {
      const row = db.prepare("SELECT * FROM artifacts WHERE id=?").get(id) as
        { metadata: string; bytes: Uint8Array } | undefined;
      return row
        ? { ref: JSON.parse(row.metadata) as ArtifactRef, bytes: row.bytes }
        : null;
    },
    saveArtifact(
      id: string,
      fileName: string,
      mediaType: string,
      bytes: Uint8Array,
    ): ArtifactRef {
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const ref = {
        id,
        fileName,
        mediaType,
        sizeBytes: bytes.length,
        sha256,
        url: "/api/artifacts/" + encodeURIComponent(id),
      };
      const old = db
        .prepare("SELECT metadata FROM artifacts WHERE id=?")
        .get(id) as { metadata: string } | undefined;
      if (old && JSON.parse(old.metadata).sha256 !== sha256)
        throw new Error("Artifact IDs are immutable.");
      db.prepare("INSERT OR IGNORE INTO artifacts VALUES(?,?,?)").run(
        id,
        JSON.stringify(ref),
        bytes,
      );
      return ref;
    },
    claim(owner: string, now = Date.now()): Job | undefined {
      return tx(() => {
        // A lost worker lease can only resume the saved job, never dispatch a second job for its case.
        db.prepare(
          "UPDATE jobs SET state='queued',owner=NULL WHERE state='running' AND lease<?",
        ).run(now);
        const job = db
          .prepare(
            "SELECT * FROM jobs j WHERE state='queued' AND NOT EXISTS(SELECT 1 FROM jobs active WHERE active.case_id=j.case_id AND active.state='running') ORDER BY rowid LIMIT 1",
          )
          .get() as unknown as Job | undefined;
        if (!job) return;
        db.prepare(
          "UPDATE jobs SET state='running',owner=?,lease=? WHERE id=?",
        ).run(owner, now + 60000, job.id);
        return { ...job, owner };
      });
    },
    jobPhase(job: Job, phase: string) {
      db.prepare("UPDATE jobs SET phase=? WHERE id=? AND owner=?").run(
        phase,
        job.id,
        job.owner,
      );
    },
    finish(job: Job) {
      db.prepare("UPDATE jobs SET state='done' WHERE id=? AND owner=?").run(
        job.id,
        job.owner,
      );
    },
    owns(job: Job) {
      return !!db
        .prepare(
          "SELECT id FROM jobs WHERE id=? AND owner=? AND state='running' AND lease>?",
        )
        .get(job.id, job.owner, Date.now());
    },
    beat(owner: string, job?: Job) {
      db.prepare(
        "INSERT INTO worker_state VALUES(?,?) ON CONFLICT(id) DO UPDATE SET heartbeat=excluded.heartbeat",
      ).run(owner, Date.now());
      if (job)
        db.prepare(
          "UPDATE jobs SET lease=? WHERE id=? AND owner=? AND state='running'",
        ).run(Date.now() + 60000, job.id, owner);
    },
    workerReady() {
      return !!db
        .prepare("SELECT id FROM worker_state WHERE heartbeat>? LIMIT 1")
        .get(Date.now() - 15000);
    },
    close() {
      db.close();
    },
  };
}
export type CaseStore = ReturnType<typeof createCaseStore>;
const globalStore = globalThis as typeof globalThis & {
  relayCases?: CaseStore;
};
export function caseStore() {
  return (globalStore.relayCases ??= createCaseStore(
    process.env.RELAY_CASE_DB || join(process.cwd(), "data", "cases.sqlite"),
  ));
}
