import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CaseSnapshot, Evidence, PersonRole } from "../../lib/contracts";
import type { CaseStore, CaseRecord } from "./store";
import { randomUUID } from "node:crypto";

export const QUOTE_ID = "quote_northstar_084";
export const quoteFields = {
  item: "Precision thermal camera",
  vendor: "Northstar Instruments",
  quantity: 1,
  currency: "USD",
  unitPrice: "2450.00",
};
const documents = [
  {
    id: "policy_2024",
    title: "Non-catalog equipment guide · 2024",
    status: "superseded" as const,
    text: "SYNTHETIC / ARCHIVED. The 2024 equipment guide listed Alice Morgan as procurement coordinator. This guide was replaced by policy_2026 on 2026-09-01. Do not use Alice as current owner.",
  },
  {
    id: "policy_2026",
    title: "Equipment procurement policy · September 2026",
    status: "confirmed" as const,
    text: "SYNTHETIC / CURRENT. For Demo Hardware Lab non-catalog instruments under USD 5000: original supplier quote, confirmed cost center and technical justification are required. The coordinator checks completeness; finance retains budget approval. Create a draft only. Use approved handover and temporary delegation to find the current coordinator. No person may be treated as budget approver solely because they coordinate.",
  },
  {
    id: "handover_bob",
    title: "Approved handover · Alice → Bob",
    status: "confirmed" as const,
    text: "SYNTHETIC / APPROVED. Effective 2026-09-01, Bob Patel replaced departing Alice Morgan as coordinator for Demo Hardware Lab equipment purchases. Approved by Operations. Alice is no longer the owner. Bob is away 2026-09-10 through 2026-09-18; use delegation_carol during that period.",
  },
  {
    id: "delegation_carol",
    title: "Approved cover · Bob → Carol",
    status: "confirmed" as const,
    text: "SYNTHETIC / APPROVED. Carol Chen covers Bob Patel from 2026-09-10T00:00:00Z through 2026-09-18T23:59:59Z for Demo Hardware Lab equipment requests under USD 5000. Scope: requirements, cost-center confirmation and coordination. No budget approval or order issuance authority. Contact Carol through this local demo participant thread, after requester authorization.",
  },
];
export function seedContext(store: CaseStore) {
  const quote = store.saveArtifact(
    QUOTE_ID,
    "QT-2026-084.txt",
    "text/plain",
    readFileSync(join(process.cwd(), "public/sample-quote.txt")),
  );
  const evidence: Evidence[] = documents.map((d) => {
    const ref = store.saveArtifact(
      d.id,
      d.id + ".txt",
      "text/plain",
      new TextEncoder().encode(d.text),
    );
    return {
      id: d.id,
      title: d.title,
      sourceUrl: ref.url,
      excerpt: d.text,
      sourceVersion: d.id,
      status: d.status,
      effectiveFrom: "2026-09-01T00:00:00Z",
      effectiveUntil:
        d.id === "delegation_carol" ? "2026-09-18T23:59:59Z" : null,
      retrievedAt: new Date().toISOString(),
    };
  });
  const people: PersonRole[] = [
    {
      personId: "alice",
      name: "Alice Morgan",
      role: "coordinator",
      scope: "Former equipment coordinator; replaced by Bob.",
      validFrom: null,
      validUntil: "2026-08-31T23:59:59Z",
      evidenceIds: ["policy_2024", "handover_bob"],
      status: "superseded",
    },
    {
      personId: "bob",
      name: "Bob Patel",
      role: "coordinator",
      scope:
        "Equipment coordinator; away September 10–18. Finance approval is separate.",
      validFrom: "2026-09-01T00:00:00Z",
      validUntil: null,
      evidenceIds: ["handover_bob"],
      status: "confirmed",
    },
    {
      personId: "carol",
      name: "Carol Chen",
      role: "delegate",
      scope:
        "Temporary equipment coordinator under USD 5000; no budget approval authority.",
      validFrom: "2026-09-10T00:00:00Z",
      validUntil: "2026-09-18T23:59:59Z",
      evidenceIds: ["handover_bob", "delegation_carol"],
      status: "confirmed",
    },
  ];
  return {
    quote,
    evidence,
    people,
    today: new Date().toISOString(),
    scope: "Demo Hardware Lab; equipment under USD 5000; draft only",
  };
}
export function newCase(requestText: string, store: CaseStore): CaseRecord {
  const { quote } = seedContext(store),
    now = new Date().toISOString();
  const snapshot: CaseSnapshot = {
    contractVersion: 1,
    mode: "live",
    id: "case_" + randomUUID(),
    version: 1,
    createdAt: now,
    updatedAt: now,
    requestText,
    stage: "discover",
    status: "running",
    facts: {
      fields: { ...quoteFields, costCenter: null, justification: null },
      quote,
      businessPurpose: requestText,
      entity: "Demo Hardware Lab",
      requestedByDate: null,
      missingFields: ["costCenter", "justification"],
    },
    currentTask: "route",
    blocker: null,
    people: [],
    evidence: [],
    clarifications: [],
    pendingAction: null,
    browserObservation: null,
    receipt: null,
    tasks: [
      {
        id: "route",
        title: "Find the current coordinator",
        status: "in_progress",
        dependsOn: [],
        ownerPersonId: null,
        requiredInputs: [],
        completionEvidenceIds: [],
      },
      {
        id: "materials",
        title: "Confirm cost center and technical justification",
        status: "ready",
        dependsOn: ["route"],
        ownerPersonId: null,
        requiredInputs: ["costCenter", "justification"],
        completionEvidenceIds: [],
      },
      {
        id: "draft",
        title: "Prepare and verify the purchase draft",
        status: "ready",
        dependsOn: ["materials"],
        ownerPersonId: null,
        requiredInputs: ["draft_authorization"],
        completionEvidenceIds: [],
      },
    ],
    events: [
      {
        id: randomUUID(),
        occurredAt: now,
        kind: "case_created",
        summary:
          "Request saved. Relay is checking the synthetic company context.",
        evidenceIds: [],
      },
    ],
  };
  return { snapshot, sessionId: null, approved: null, execution: null };
}
