"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowsSplit,
  CaretDown,
  CaretRight,
  Check,
  CheckCircle,
  Clock,
  FileText,
  FolderOpen,
  GitBranch,
  LinkSimple,
  MagnifyingGlass,
  PaperPlaneTilt,
  Pause,
  Play,
  Plus,
  ShieldCheck,
  Stack,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import {
  AppHeader,
  Badge,
  Brand,
  Dialog,
  money,
  safeHref,
  StepIcon,
} from "@/components/ui";
import type { CaseSnapshot, Evidence } from "./view-model";
import { previewScenes } from "./preview";
import { useRelayCase } from "./use-relay-case";

function RouteDiagram({ snapshot }: { snapshot: CaseSnapshot }) {
  const stages = [
    { id: "discover", label: "Find the path", icon: MagnifyingGlass },
    { id: "prepare", label: "Gather & confirm", icon: Stack },
    { id: "review", label: "Your review", icon: ShieldCheck },
    { id: "execute", label: "Prepare draft", icon: FileText },
  ];
  const active =
    snapshot.stage === "verify"
      ? 4
      : stages.findIndex((s) => s.id === snapshot.stage);
  return (
    <div className="route-diagram" aria-label="Purchase progress">
      {stages.map((stage, i) => {
        const Icon = stage.icon;
        return (
          <div
            key={stage.id}
            className={
              "route-stop " +
              (i < active ? "is-done" : i === active ? "is-current" : "")
            }
          >
            <div className="route-node">
              {i < active ? (
                <Check size={20} weight="bold" />
              ) : (
                <Icon size={22} weight="regular" />
              )}
            </div>
            <span className="route-label">{stage.label}</span>
            <span className="route-caption">
              {i < active
                ? "Complete"
                : i === active
                  ? snapshot.status === "paused"
                    ? "Paused"
                    : "Current step"
                  : "Up next"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
function EvidenceRows({
  snapshot,
  onOpen,
}: {
  snapshot: CaseSnapshot;
  onOpen: (value: Evidence) => void;
}) {
  return (
    <div className="evidence-list">
      {snapshot.evidence.length ? (
        snapshot.evidence.map((source) => (
          <button
            key={source.id}
            className="evidence-row"
            onClick={() => onOpen(source)}
          >
            <FileText size={20} />
            <span>
              <strong>{source.title}</strong>
              <small>
                {source.kind} · {source.date}
              </small>
            </span>
            <Badge tone={source.status === "confirmed" ? "green" : "neutral"}>
              {source.status === "confirmed"
                ? "Current"
                : source.status === "superseded"
                  ? "Archived"
                  : "Unverified"}
            </Badge>
            <ArrowUpRight size={16} />
          </button>
        ))
      ) : (
        <p className="empty-copy">
          Sources will appear here as the process is established.
        </p>
      )}
    </div>
  );
}
export function Workspace() {
  const relay = useRelayCase();
  const { snapshot, mode, busy } = relay;
  const [tab, setTab] = useState("overview");
  const [source, setSource] = useState<Evidence | null>(null);
  const [showIntegration, setShowIntegration] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewed, setReviewed] = useState<{
    actionId: string;
    expectedVersion: number;
    title: string;
    destination?: string;
    payload: Record<string, unknown>;
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [liveCaseId, setLiveCaseId] = useState("");
  const [requestText, setRequestText] = useState(
    "I need a precision thermal camera for thermal validation of our next hardware prototype.",
  );
  const [quoteArtifactId, setQuoteArtifactId] = useState("");
  const [reply, setReply] = useState("");
  const [localMessage, setLocalMessage] = useState("");
  const isPaused = snapshot.status === "paused";
  const isComplete = snapshot.status === "completed";
  const stageLabel = isPaused
    ? "Paused"
    : isComplete
      ? "Draft verified"
      : snapshot.status === "waiting_for_reply"
        ? "Needs your input"
        : snapshot.status === "waiting_for_authorization"
          ? "Ready for review"
          : snapshot.status === "failed"
            ? "Needs attention"
            : "In progress";
  const submitReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reply.trim() || busy || isPaused) return;
    if (await relay.action("reply", reply.trim())) setReply("");
  };
  if (relay.loadingLive)
    return (
      <>
        <AppHeader />
        <main id="main-content" tabIndex={-1} className="empty-state">
          <h1>Reconnecting to your request.</h1>
          <p>
            {relay.error || "Loading the saved case from your agent backend."}
          </p>
          <button
            className="button button-secondary"
            onClick={() => relay.selectScene("reply")}
          >
            Return to UI preview
          </button>
        </main>
      </>
    );
  return (
    <>
      <AppHeader
        actions={
          <button
            className="connection-button"
            onClick={() => setShowIntegration(true)}
          >
            <LinkSimple size={16} />
            {mode === "preview" ? "Connect agent" : "Agent connected"}
          </button>
        }
      />
      <div className="workspace-shell">
        <aside className="workspace-sidebar">
          <div className="sidebar-workspace">
            <span className="workspace-mark">
              <Stack size={19} />
            </span>
            <span>
              Hardware team<small>Demo workspace</small>
            </span>
          </div>
          <div className="sidebar-section-label">WORKSPACE</div>
          <button
            className="sidebar-nav selected"
            onClick={() => {
              setTab("overview");
              setLocalMessage("");
            }}
          >
            <FolderOpen size={19} />
            Requests<span className="nav-count">1</span>
          </button>
          <Link className="sidebar-nav" href="/portal/drafts">
            <FileText size={19} />
            Saved drafts
          </Link>
          <button className="sidebar-nav" onClick={() => setTab("sources")}>
            <ShieldCheck size={19} />
            Process library
          </button>
          <div className="sidebar-section-label sidebar-gap">YOUR REQUESTS</div>
          <button
            className="case-nav selected"
            onClick={() => setTab("overview")}
          >
            <span className="case-dot" />
            <span>
              {snapshot.title}
              <small>{snapshot.id}</small>
            </span>
          </button>
          <button
            className="new-request-link"
            onClick={() => setShowRequest(true)}
          >
            <Plus size={15} />
            New request
          </button>
          <div className="sidebar-bottom">
            <GitBranch size={20} />
            <p>
              One request.
              <br />
              Every handoff, connected.
            </p>
            <button
              onClick={() => setShowPreview(true)}
              className="preview-toggle"
            >
              {mode === "preview" ? "Preview controls" : "View UI preview"}
              <CaretRight size={14} />
            </button>
          </div>
        </aside>
        <main id="main-content" tabIndex={-1} className="workspace-main">
          <div className="context-bar">
            <span>Workspace</span>
            <CaretRight size={13} />
            <span>Requests</span>
            <CaretRight size={13} />
            <strong>{snapshot.id}</strong>
            <button
              className={"mode-label " + (mode === "live" ? "live-label" : "")}
              onClick={() =>
                mode === "preview"
                  ? setShowPreview(true)
                  : setShowIntegration(true)
              }
            >
              {mode === "preview"
                ? "UI PREVIEW · SYNTHETIC DATA"
                : "LIVE AGENT · TEST PORTAL"}
              <CaretDown size={12} />
            </button>
          </div>
          <div className="request-heading">
            <div>
              <span className="eyebrow">NON-CATALOG PURCHASE</span>
              <h1>{snapshot.title}</h1>
              <p>Keep the request moving. We’ll keep the context.</p>
            </div>
            <Badge
              tone={
                isComplete
                  ? "green"
                  : snapshot.status === "failed"
                    ? "red"
                    : isPaused
                      ? "neutral"
                      : "amber"
              }
            >
              <span className="status-dot" />
              {stageLabel}
            </Badge>
          </div>
          {relay.error && (
            <div className="alert alert-error" role="alert">
              <WarningCircle size={19} />
              <span>{relay.error}</span>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={relay.clearError}
              >
                <X size={18} />
              </button>
            </div>
          )}
          {(relay.notice || localMessage) && (
            <div className="alert" role="status">
              <CheckCircle size={19} />
              <span>{relay.notice || localMessage}</span>
            </div>
          )}
          <div className="work-grid">
            <aside className="relay-panel" aria-label="Relay case companion">
              <div className="relay-panel-heading">
                <Brand small />
                <span className="companion-label">YOUR CASE COMPANION</span>
                {!isComplete && (
                  <button
                    className="icon-button"
                    aria-label={isPaused ? "Resume case" : "Pause case"}
                    disabled={busy}
                    onClick={() => relay.action(isPaused ? "resume" : "pause")}
                  >
                    {isPaused ? <Play size={16} /> : <Pause size={16} />}
                  </button>
                )}
              </div>
              <div className="agent-message">
                <div className="agent-symbol">
                  <ArrowsSplit size={24} weight="bold" />
                </div>
                <span className="eyebrow">
                  {isPaused
                    ? "ON YOUR TERMS"
                    : isComplete
                      ? "READY FOR WHAT’S NEXT"
                      : "LET’S MOVE THIS FORWARD"}
                </span>
                <h2>
                  {isPaused
                    ? "Take your time. It’s all here."
                    : snapshot.currentTask}
                </h2>
                <p>
                  {isPaused
                    ? "Your request and its context are preserved. Resume when you’re ready."
                    : snapshot.blocker ||
                      (isComplete
                        ? "Your purchase still needs organizational review before an order can be issued."
                        : "The details stay connected, from the first question to the saved draft.")}
                </p>
              </div>
              {snapshot.pendingAction?.type === "clarification" &&
                !isPaused && (
                  <form className="reply-section" onSubmit={submitReply}>
                    <label htmlFor="case-reply">
                      {snapshot.pendingAction.question}
                    </label>
                    <textarea
                      id="case-reply"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder={
                        mode === "preview" ? "e.g. ENG-240" : "Add your reply…"
                      }
                      rows={2}
                      required
                      maxLength={5000}
                    />
                    <button
                      className="button button-primary full-width"
                      type="submit"
                      disabled={busy || !reply.trim()}
                    >
                      {busy ? "Sending…" : "Send reply"}
                      <PaperPlaneTilt size={17} />
                    </button>
                    <p className="field-hint">
                      {mode === "preview"
                        ? "Preview input updates this example only."
                        : "Your reply stays with this request."}
                    </p>
                  </form>
                )}
              {(snapshot.pendingAction?.type === "create_draft" ||
                snapshot.pendingAction?.type === "contact_person") &&
                !isPaused && (
                  <div className="review-section">
                    <div className="review-mini">
                      <FileText size={20} />
                      <span>
                        <strong>
                          {snapshot.pendingAction?.title || "Purchase draft"}
                        </strong>
                        <small>
                          {money(
                            snapshot.facts.unitPrice * snapshot.facts.quantity,
                            snapshot.facts.currency,
                          )}{" "}
                          · {snapshot.facts.vendor}
                        </small>
                      </span>
                    </div>
                    <button
                      className="button button-primary full-width"
                      onClick={() => {
                        if (snapshot.pendingAction) {
                          setReviewed({
                            actionId: snapshot.pendingAction.id,
                            expectedVersion: snapshot.version,
                            title: snapshot.pendingAction.title,
                            destination: snapshot.pendingAction.destination,
                            payload: structuredClone(
                              snapshot.pendingAction.payload,
                            ),
                          });
                          setShowReview(true);
                        }
                      }}
                      disabled={busy}
                    >
                      {snapshot.pendingAction?.type === "contact_person"
                        ? "Review message"
                        : "Review draft"}
                      <ArrowRight size={17} />
                    </button>
                    <p className="field-hint">
                      You review the details before anything is created.
                    </p>
                  </div>
                )}
              {isPaused && (
                <div className="review-section">
                  <button
                    className="button button-primary full-width"
                    disabled={busy}
                    onClick={() => relay.action("resume")}
                  >
                    Resume request
                    <Play size={17} />
                  </button>
                </div>
              )}
              {snapshot.stage === "execute" && !isPaused && (
                <div className="execution-section">
                  <div className="execution-status">
                    <span className="activity-indicator" />
                    <strong>
                      {mode === "preview"
                        ? "Execution state preview"
                        : "Working in the portal"}
                    </strong>
                  </div>
                  <p>
                    {mode === "preview"
                      ? "No browser is running in preview mode. Connect the agent to see actual execution."
                      : "Progress and observations are supplied by your agent."}
                  </p>
                  {safeHref(snapshot.browserObservation?.url) && (
                    <a
                      className="text-link"
                      href={safeHref(snapshot.browserObservation?.url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open latest observation
                      <ArrowUpRight size={15} />
                    </a>
                  )}
                  <Link
                    href="/portal/new"
                    className="button button-secondary full-width"
                  >
                    Open purchasing portal
                    <ArrowUpRight size={17} />
                  </Link>
                </div>
              )}
              {snapshot.status === "failed" && (
                <div className="review-section">
                  <Link
                    className="button button-secondary full-width"
                    href="/portal/new"
                  >
                    Open portal
                    <ArrowUpRight size={16} />
                  </Link>
                  <button
                    className="inline-action"
                    onClick={() => relay.action("resume")}
                    disabled={busy}
                  >
                    Try resuming
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}
              {snapshot.receipt && (
                <div className="receipt-section">
                  <CheckCircle
                    size={28}
                    weight="fill"
                    className="success-ink"
                  />
                  <h3>{snapshot.receipt.id}</h3>
                  <p>
                    {snapshot.receipt.attachmentsChecked} attachment checked ·
                    Draft saved
                  </p>
                  {snapshot.receipt.simulated && (
                    <Badge>Sample receipt · no actual record</Badge>
                  )}
                  {safeHref(snapshot.receipt.url) && (
                    <a
                      href={safeHref(snapshot.receipt.url)}
                      className="button button-primary full-width"
                    >
                      Open saved draft
                      <ArrowUpRight size={16} />
                    </a>
                  )}
                </div>
              )}
              {snapshot.people.map((person) => (
                <div className="person-section" key={person.id}>
                  <div className="small-mono">THE RIGHT PERSON</div>
                  <div className="person-row">
                    <span className="person-avatar">{person.initials}</span>
                    <div>
                      <strong>{person.name}</strong>
                      <small>{person.role}</small>
                    </div>
                    <ShieldCheck size={19} className="success-ink" />
                  </div>
                  <p>{person.note}</p>
                  <button
                    className="inline-action"
                    onClick={() => {
                      const evidence = snapshot.evidence.find(
                        (e) => e.id === person.evidenceIds[0],
                      );
                      if (evidence) setSource(evidence);
                      else setTab("sources");
                    }}
                  >
                    Why this person?
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              ))}
              <div className="panel-footer">
                <ShieldCheck size={15} />
                <span>You stay in control of every action.</span>
              </div>
            </aside>
            <section className="request-content">
              <div
                className="request-tabs"
                role="tablist"
                aria-label="Request details"
                onKeyDown={(event) => {
                  const tabs = ["overview", "activity", "sources"];
                  const current = tabs.indexOf(tab);
                  const next =
                    event.key === "ArrowRight"
                      ? (current + 1) % 3
                      : event.key === "ArrowLeft"
                        ? (current + 2) % 3
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? 2
                            : -1;
                  if (next >= 0) {
                    event.preventDefault();
                    setTab(tabs[next]);
                    (
                      event.currentTarget.querySelectorAll("button")[
                        next
                      ] as HTMLButtonElement
                    ).focus();
                  }
                }}
              >
                {[
                  { id: "overview", name: "Overview" },
                  { id: "activity", name: "Activity" },
                  {
                    id: "sources",
                    name: "Sources",
                    count: snapshot.evidence.length,
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    id={"request-tab-" + item.id}
                    role="tab"
                    tabIndex={tab === item.id ? 0 : -1}
                    aria-selected={tab === item.id}
                    aria-controls="request-tab-panel"
                    onClick={() => setTab(item.id)}
                  >
                    {item.name}
                    {item.count !== undefined && <span>{item.count}</span>}
                  </button>
                ))}
              </div>
              <div
                id="request-tab-panel"
                role="tabpanel"
                aria-labelledby={"request-tab-" + tab}
              >
                {tab === "overview" && (
                  <>
                    <section className="journey-section">
                      <div className="section-heading">
                        <h2>Your path to a purchase</h2>
                        <span className="small-mono">ONE STEP AT A TIME</span>
                      </div>
                      <RouteDiagram snapshot={snapshot} />
                      <div className="route-note">
                        <GitBranch size={17} />
                        <span>
                          {snapshot.people.length
                            ? "The process changed. Your request didn’t have to start over."
                            : "Discovering the applicable policy and current coordinator."}
                        </span>
                      </div>
                    </section>
                    <section className="details-section">
                      <div className="section-heading">
                        <h2>The request</h2>
                        <span className="small-mono">{snapshot.id}</span>
                      </div>
                      <dl className="request-facts">
                        <div>
                          <dt>SUPPLIER</dt>
                          <dd>{snapshot.facts.vendor}</dd>
                        </div>
                        <div>
                          <dt>ESTIMATED TOTAL</dt>
                          <dd className="amount">
                            {money(
                              snapshot.facts.unitPrice *
                                snapshot.facts.quantity,
                              snapshot.facts.currency,
                            )}
                            <small>
                              {snapshot.facts.quantity} unit
                              {snapshot.facts.quantity === 1 ? "" : "s"}
                            </small>
                          </dd>
                        </div>
                        <div>
                          <dt>BUSINESS PURPOSE</dt>
                          <dd>
                            {snapshot.facts.justification || "Not supplied yet"}
                          </dd>
                        </div>
                        <div>
                          <dt>COST CENTER</dt>
                          <dd>
                            {snapshot.facts.costCenter || (
                              <span className="missing-value">
                                Confirmation needed
                                <Clock size={15} />
                              </span>
                            )}
                          </dd>
                        </div>
                      </dl>
                      {(mode === "preview" ||
                        snapshot.facts.quoteArtifactId) && (
                        <a
                          href={
                            mode === "preview"
                              ? "/sample-quote.txt"
                              : "/api/artifacts/" +
                                encodeURIComponent(
                                  snapshot.facts.quoteArtifactId!,
                                )
                          }
                          download
                          className="attachment-card"
                        >
                          <span className="file-symbol">
                            <FileText size={24} />
                          </span>
                          <span>
                            <strong>Supplier quote</strong>
                            <small>
                              {mode === "preview"
                                ? "QT-2026-084 · Sample TXT"
                                : "Original quote attachment"}
                            </small>
                          </span>
                          <ArrowUpRight size={20} />
                        </a>
                      )}
                    </section>
                    <section className="materials-section">
                      <div className="section-heading">
                        <h2>A complete request, built together</h2>
                        <span className="small-mono">
                          {
                            snapshot.tasks.filter((t) => t.status === "done")
                              .length
                          }{" "}
                          / {snapshot.tasks.length} READY
                        </span>
                      </div>
                      <div className="materials-list">
                        {snapshot.tasks.map((task) => (
                          <div className="material-row" key={task.id}>
                            <StepIcon status={task.status} />
                            <div>
                              <strong>{task.label}</strong>
                              <small>{task.detail}</small>
                            </div>
                            <span
                              className={
                                "material-status " +
                                (task.status === "missing" ? "waiting-ink" : "")
                              }
                            >
                              {task.status === "done"
                                ? "Ready"
                                : task.status === "missing"
                                  ? "Needed"
                                  : "Pending"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                    <div className="portal-callout">
                      <span className="portal-callout-icon">
                        <FileText size={21} />
                      </span>
                      <div>
                        <strong>
                          Your purchasing system, still in the loop.
                        </strong>
                        <p>
                          Open the test portal to create and inspect a real
                          saved draft.
                        </p>
                      </div>
                      <Link
                        href="/portal/new"
                        className="icon-button"
                        aria-label="Open purchasing portal"
                      >
                        <ArrowUpRight size={22} />
                      </Link>
                    </div>
                  </>
                )}
                {tab === "activity" && (
                  <section className="tab-content">
                    <div className="section-heading">
                      <h2>Every handoff has a history</h2>
                      <Badge>
                        {mode === "preview" ? "Sample history" : "Case history"}
                      </Badge>
                    </div>
                    <div className="activity-timeline">
                      {snapshot.events.map((event, index) => (
                        <article key={event.id}>
                          <span className="timeline-dot">{index + 1}</span>
                          <div>
                            <time>
                              {new Date(event.timestamp).toLocaleTimeString(
                                "en-US",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: "UTC",
                                },
                              )}{" "}
                              UTC
                            </time>
                            <h3>{event.title}</h3>
                            <p>{event.detail}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )}
                {tab === "sources" && (
                  <section className="tab-content">
                    <div className="section-heading">
                      <h2>The context behind the next step</h2>
                    </div>
                    <p className="section-description">
                      Current policies, handovers, and the source of each
                      decision.
                    </p>
                    <EvidenceRows snapshot={snapshot} onOpen={setSource} />
                    <p className="source-disclaimer">
                      {mode === "preview"
                        ? "All documents in this preview are synthetic fixtures."
                        : "Source access and policy authority are enforced by the connected agent backend."}
                    </p>
                  </section>
                )}
              </div>
            </section>
          </div>
          <footer className="workspace-footer">
            <span>CONTEXT CARRIES FORWARD.</span>
            <span>
              {mode === "preview"
                ? "Interface preview · No live agent actions"
                : "Connected to your case backend"}
            </span>
          </footer>
        </main>
      </div>
      <Dialog
        title={source?.title || "Source evidence"}
        open={!!source}
        onClose={() => setSource(null)}
      >
        {source && (
          <div className="dialog-body">
            <div className="source-meta">
              <Badge tone={source.status === "confirmed" ? "green" : "neutral"}>
                {source.status}
              </Badge>
              <span>
                {source.kind} · {source.date}
              </span>
            </div>
            <blockquote>{source.excerpt}</blockquote>
            <div className="source-note">
              <ShieldCheck size={20} />
              <p>
                Operational responsibility and budget approval are separate.
                This source only establishes the scope it explicitly describes.
              </p>
            </div>
            {mode === "preview" && (
              <p className="field-hint">
                Synthetic document for the UI preview.
              </p>
            )}
            {safeHref(source.url) && (
              <a
                href={safeHref(source.url)}
                className="text-link"
                target="_blank"
                rel="noreferrer"
              >
                Open original source
                <ArrowUpRight size={15} />
              </a>
            )}
          </div>
        )}
      </Dialog>
      <Dialog
        title="Review the proposed action"
        open={showReview}
        onClose={() => setShowReview(false)}
      >
        <div className="dialog-body">
          <Badge tone="green">REVIEW ACTION</Badge>
          <h3 className="dialog-subtitle">{reviewed?.title}</h3>
          <p>
            Review the exact destination and contents below. This authorizes
            only the proposed action; budget approval and order issuance remain
            outstanding.
          </p>
          <dl className="review-fields">
            <div>
              <dt>Destination</dt>
              <dd>{reviewed?.destination || "/portal/new"}</dd>
            </div>
            {Object.entries(reviewed?.payload || {}).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>
                  {typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value)}
                </dd>
              </div>
            ))}
          </dl>
          {mode === "preview" && (
            <div className="alert">
              Preview only: confirming changes the example screen and does not
              create a draft.
            </div>
          )}
          {reviewed && snapshot.version !== reviewed.expectedVersion && (
            <p className="error-text" role="alert">
              The case changed after you opened this review. Close it and review
              the updated proposal.
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={async () => {
                if (await relay.action("decline", "", reviewed || undefined))
                  setShowReview(false);
              }}
            >
              Decline
            </button>
            <button
              className="button button-primary"
              disabled={
                busy ||
                !reviewed ||
                snapshot.version !== reviewed.expectedVersion ||
                isPaused
              }
              onClick={async () => {
                if (await relay.action("authorize", "", reviewed || undefined))
                  setShowReview(false);
              }}
            >
              {busy
                ? "Confirming…"
                : mode === "preview"
                  ? "Preview confirmation"
                  : "Allow action"}
              <ArrowRight size={16} />
            </button>
          </div>
          {relay.error && (
            <p role="alert" className="error-text">
              {relay.error}
            </p>
          )}
        </div>
      </Dialog>
      <Dialog
        title="Connect your agent"
        open={showIntegration}
        onClose={() => setShowIntegration(false)}
      >
        <form
          className="dialog-body"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await relay.connect(liveCaseId, requestText, quoteArtifactId))
              setShowIntegration(false);
          }}
        >
          <p>
            Switch from the interface preview to your teammate’s case backend.
            Your existing preview stays saved locally.
          </p>
          <label className="form-label" htmlFor="live-id">
            Existing case ID <span>optional</span>
          </label>
          <input
            id="live-id"
            value={liveCaseId}
            onChange={(e) => setLiveCaseId(e.target.value)}
            placeholder="Leave empty to create a case"
          />
          <label className="form-label" htmlFor="quote-artifact">
            Quote artifact ID
          </label>
          <input
            id="quote-artifact"
            value={quoteArtifactId}
            onChange={(e) => setQuoteArtifactId(e.target.value)}
            required={!liveCaseId.trim()}
            placeholder="Registered quote ID from your backend"
          />
          <label className="form-label" htmlFor="live-request">
            Request
          </label>
          <textarea
            id="live-request"
            rows={4}
            value={requestText}
            onChange={(e) => setRequestText(e.target.value)}
            required
          />
          <p className="field-hint">
            The backend must provide the agreed case API. Connection errors are
            shown without switching to simulated data.
          </p>
          {relay.error && (
            <p role="alert" className="error-text">
              {relay.error}
            </p>
          )}
          <button
            className="button button-primary full-width"
            type="submit"
            disabled={busy}
          >
            {busy ? "Connecting…" : "Connect live workspace"}
            <ArrowRight size={17} />
          </button>
        </form>
      </Dialog>
      <Dialog
        title="Explore the interface states"
        open={showPreview}
        onClose={() => setShowPreview(false)}
      >
        <div className="dialog-body">
          <p>
            These are explicit UI fixtures. No model calls, messages, or browser
            actions run when you choose a state.
          </p>
          <div className="preview-scenes">
            {previewScenes.map((item) => (
              <button
                key={item.id}
                className={
                  relay.scene === item.id && mode === "preview"
                    ? "selected"
                    : ""
                }
                onClick={() => {
                  relay.selectScene(item.id);
                  setShowPreview(false);
                }}
              >
                {item.label}
                <ArrowRight size={17} />
              </button>
            ))}
          </div>
          <button
            className="inline-action"
            onClick={() => {
              relay.selectScene("reply");
              setShowPreview(false);
            }}
          >
            Reset preview
            <ArrowRight size={16} />
          </button>
        </div>
      </Dialog>
      <Dialog
        title="Start a new request"
        open={showRequest}
        onClose={() => setShowRequest(false)}
      >
        <form
          className="dialog-body"
          onSubmit={async (e) => {
            e.preventDefault();
            if (mode === "live") {
              if (await relay.connect("", requestText, quoteArtifactId))
                setShowRequest(false);
            } else {
              setShowRequest(false);
              setShowIntegration(true);
            }
          }}
        >
          <p>
            Tell Relay what you need. It will keep the request, process, and
            people connected.
          </p>
          <label className="form-label" htmlFor="new-request">
            What are you purchasing?
          </label>
          <textarea
            id="new-request"
            value={requestText}
            onChange={(e) => setRequestText(e.target.value)}
            rows={4}
            required
          />
          <button
            className="button button-primary full-width"
            type="submit"
            disabled={busy}
          >
            Continue with agent
            <ArrowRight size={17} />
          </button>
          <Link href="/portal/new" className="inline-action">
            Or create a draft manually
            <ArrowUpRight size={16} />
          </Link>
        </form>
      </Dialog>
    </>
  );
}
