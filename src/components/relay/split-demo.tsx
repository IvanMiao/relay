"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowsSplit,
  Check,
  CheckCircle,
  FileText,
  Tray,
  PaperPlaneTilt,
  Pause,
  Play,
  Plus,
  ShoppingBag,
  SpinnerGap,
  X,
} from "@phosphor-icons/react";
import { Brand, Badge, Dialog, money, safeHref } from "../ui";
import { useRelayCase } from "./use-relay-case";
import type { CaseSnapshot } from "./view-model";
import "./split-demo.css";

const defaultRequest =
  "I need a precision thermal camera for thermal validation of our next hardware prototype. Please help me prepare the purchase request using this quote.";
const exampleReply =
  "Use ENG-240. We need non-contact temperature mapping to identify heat buildup and validate the thermal performance of our next hardware prototype. Attach the original quote and this technical justification. Finance still needs to approve the budget.";
const stepLabels = [
  "Request",
  "Find the owner",
  "Clarify",
  "Your review",
  "Save & verify",
];
type Review = {
  action: NonNullable<CaseSnapshot["pendingAction"]>;
  version: number;
};

function reviewFields(payload: Record<string, unknown>) {
  const fields = (payload.fields || payload) as Record<string, unknown>;
  const labels: Record<string, string> = {
    item: "Item",
    vendor: "Supplier",
    quantity: "Quantity",
    currency: "Currency",
    unitPrice: "Unit price",
    costCenter: "Cost center",
    justification: "Technical justification",
  };
  return Object.entries(labels)
    .filter(([key]) => fields[key] !== undefined)
    .map(([key, label]) => ({ label, value: String(fields[key]) }));
}

export function SplitDemo() {
  const relay = useRelayCase();
  const { snapshot: c, busy, mode, loadingLive, ready } = relay;
  const live = ready && mode === "live" && !loadingLive;
  const paused = live && c.status === "paused";
  const failed = live && c.status === "failed";
  const complete = live && c.status === "completed";
  const pending = live ? c.pendingAction : null;
  const waitingReply = live && c.status === "waiting_for_reply";
  const coordinator = live ? c.people[0]?.name || "Carol Chen" : "Carol Chen";
  const firstName = coordinator.split(" ")[0];
  const coordinatorInitials = coordinator
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
  const thread = live ? c.conversations || [] : [];
  const [request, setRequest] = useState(defaultRequest);
  const [reply, setReply] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [newDemo, setNewDemo] = useState(false);
  const [screenshotError, setScreenshotError] = useState("");
  const currentStep = !live
    ? 0
    : c.stage === "execute" || c.stage === "verify"
      ? 4
      : c.stage === "review"
        ? 3
        : waitingReply || thread.length
          ? 2
          : 1;
  const alexTurn = live && c.status === "waiting_for_authorization";
  const screenTitle = complete
    ? "A purchase, ready for the next step."
    : "One purchase. Two people. Connected.";
  const cue = !live
    ? "Start as Alex. Relay will find who can help."
    : paused
      ? "Paused. The request and conversation are saved."
      : failed
        ? "Relay needs attention. Review the issue in Alex’s workspace."
        : complete
          ? "Done. The draft is verified and ready for organizational review."
          : waitingReply
            ? `${firstName}’s turn. Reply in the coordinator’s inbox.`
            : alexTurn
              ? pending?.type === "contact_person"
                ? "Alex’s turn. Review the question before Relay sends it."
                : "Alex’s turn. Check the prepared draft and allow creation."
              : currentStep === 4
                ? "Relay is working in the purchasing system below."
                : thread.some((t) => t.reply)
                  ? `${firstName} replied. Relay is updating Alex’s purchase request.`
                  : "Relay is checking the policy, handover and current cover.";
  async function start() {
    if (await relay.connect("", request, "quote_northstar_084")) {
      setNewDemo(false);
      setReply("");
      setReview(null);
    }
  }
  function openReview() {
    if (pending)
      setReview({ action: structuredClone(pending), version: c.version });
  }
  const requestForm = (id: string) => (
    <form
      className="sd-request-form"
      onSubmit={async (e) => {
        e.preventDefault();
        await start();
      }}
    >
      <label htmlFor={id}>What do you need?</label>
      <textarea
        id={id}
        rows={4}
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        minLength={10}
        maxLength={5000}
        required
        disabled={busy}
      />
      <a
        className="sd-quote"
        href="/sample-quote.txt"
        target="_blank"
        rel="noreferrer"
      >
        <FileText size={22} />
        <span>
          <strong>Northstar · Thermal camera</strong>
          <small>QT-2026-084 · $2,450 · Synthetic quote attached</small>
        </span>
        <ArrowUpRight size={16} />
      </a>
      <button
        className="button button-primary full-width"
        disabled={busy || !ready || request.trim().length < 10}
      >
        {busy ? "Starting agent…" : "Ask Relay to handle it"}
        <ArrowRight size={17} />
      </button>
      <p className="sd-fine">
        Starts a real agent session with demo company records.
      </p>
    </form>
  );

  return (
    <div className="sd-shell">
      <header className="sd-header">
        <Link href="/" aria-label="Relay home">
          <Brand />
        </Link>
        <div className="sd-demo-label">
          <span className="sd-dot" />
          TWO-PERSON DEMO<span>Synthetic company · Real agent</span>
        </div>
        <button
          className="button button-secondary"
          onClick={() => {
            relay.clearError();
            setNewDemo(true);
          }}
          disabled={busy || !ready}
        >
          <Plus size={16} />
          New demo
        </button>
      </header>
      <main id="main-content" className="sd-main">
        <div className="sd-intro">
          <div>
            <span className="eyebrow">
              THE WORK HAPPENS IN MORE THAN ONE PLACE
            </span>
            <h1>{screenTitle}</h1>
            <p>
              Alex needs a thermal camera. The purchasing guide points to
              someone who has moved on.
            </p>
          </div>
          <span className="sd-director-label">
            <ArrowsSplit size={18} />
            Both perspectives, one shared request.
          </span>
        </div>
        <ol className="sd-steps" aria-label="Demo progress">
          {stepLabels.map((label, index) => (
            <li
              key={label}
              className={
                complete || index < currentStep
                  ? "done"
                  : index === currentStep
                    ? "current"
                    : ""
              }
              aria-current={
                !complete && index === currentStep ? "step" : undefined
              }
            >
              <span>
                {complete || index < currentStep ? (
                  <Check size={14} />
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              {label}
              {index < 4 && <ArrowRight size={13} />}
            </li>
          ))}
        </ol>
        <div className="sd-cue" key={cue} role="status">
          <span className="sd-dot" />
          {loadingLive ? "Reconnecting to the saved request…" : cue}
          {live && !complete && (
            <button
              className="text-link"
              disabled={busy}
              onClick={() => relay.action(paused ? "resume" : "pause")}
            >
              {paused ? <Play size={13} /> : <Pause size={13} />}{" "}
              {paused ? "Resume" : "Pause"}
            </button>
          )}
        </div>
        {relay.error && (
          <div className="alert error-alert" role="alert">
            <span>{relay.error}</span>
            <button
              className="icon-button"
              aria-label="Dismiss error"
              onClick={relay.clearError}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="sd-split">
          <section
            className={"sd-person sd-alex " + (alexTurn ? "sd-active" : "")}
            aria-label="Alex's procurement workspace"
          >
            <div className="sd-identity">
              <span className="sd-avatar">AL</span>
              <div>
                <h2>Alex Lee</h2>
                <p>Hardware engineer · Purchase requester</p>
              </div>
              {alexTurn && <Badge tone="green">Your turn</Badge>}
            </div>
            <div className="sd-surface">
              <div className="sd-surface-heading">
                <ShoppingBag size={18} />
                <strong>Purchasing workspace</strong>
                <span>
                  {live ? "REQ-" + c.id.slice(-8).toUpperCase() : "NEW REQUEST"}
                </span>
              </div>
              <div className="sd-left-body">
                {!live ? (
                  loadingLive ? (
                    <div className="sd-empty">
                      <SpinnerGap className="sd-spin" size={24} />
                      <h3>Restoring the request</h3>
                      <p>Your saved case will appear here.</p>
                    </div>
                  ) : (
                    requestForm("sd-request")
                  )
                ) : (
                  <>
                    <div className="sd-purchase">
                      <div>
                        <span className="eyebrow">NON-CATALOG EQUIPMENT</span>
                        <h3>{c.facts.item}</h3>
                        <p>
                          {c.facts.vendor} · {c.facts.quantity} unit
                        </p>
                      </div>
                      <strong>
                        {money(
                          c.facts.quantity * c.facts.unitPrice,
                          c.facts.currency,
                        )}
                      </strong>
                    </div>
                    <div className="sd-request-note">
                      <span>Alex’s request</span>
                      <p>{c.requestText || request}</p>
                    </div>
                    <div className="sd-ownership">
                      <div className="sd-row-heading">
                        <h3>Who can move this forward?</h3>
                        {c.evidence.length > 0 && (
                          <button
                            className="text-link"
                            onClick={() => setShowSources(true)}
                          >
                            View evidence <ArrowUpRight size={13} />
                          </button>
                        )}
                      </div>
                      {!c.people.length ? (
                        <p className="sd-investigating">
                          <SpinnerGap className="sd-spin" size={15} />
                          Checking the current policy and handovers…
                        </p>
                      ) : (
                        <>
                          <div className="sd-handover">
                            <div>
                              <span className="sd-initial">AM</span>
                              <strong>Alice</strong>
                              <small>Old guide</small>
                            </div>
                            <ArrowRight size={16} />
                            {c.people[0].id === "carol" && (
                              <>
                                <div>
                                  <span className="sd-initial">BP</span>
                                  <strong>Bob</strong>
                                  <small>On leave</small>
                                </div>
                                <ArrowRight size={16} />
                              </>
                            )}
                            <div className="sd-owner">
                              <span className="sd-initial">
                                {coordinatorInitials}
                              </span>
                              <strong>{firstName}</strong>
                              <small>Current contact</small>
                            </div>
                          </div>
                          <p className="sd-fine">{c.people[0].note}</p>
                        </>
                      )}
                    </div>
                    <div className="sd-materials">
                      <div>
                        <span>Supplier quote</span>
                        <a
                          className="text-link"
                          href={safeHref(
                            "/api/artifacts/" +
                              encodeURIComponent(
                                c.facts.quoteArtifactId ||
                                  "quote_northstar_084",
                              ),
                          )}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Attached <ArrowUpRight size={12} />
                        </a>
                      </div>
                      <div
                        key={c.facts.costCenter || "missing"}
                        className={c.facts.costCenter ? "sd-updated" : ""}
                      >
                        <span>Cost center</span>
                        <strong>
                          {c.facts.costCenter || "Waiting for confirmation"}
                        </strong>
                      </div>
                      <div>
                        <span>Technical justification</span>
                        <strong>
                          {c.facts.justification
                            ? "Prepared from the request"
                            : "To be confirmed"}
                        </strong>
                      </div>
                    </div>
                    <div
                      className="sd-agent-card"
                      key={c.status + String(pending?.id)}
                    >
                      <div className="sd-agent-byline">
                        <ArrowsSplit size={19} />
                        <strong>Relay</strong>
                        <span>
                          {complete ? "VERIFIED" : "WORKING FOR ALEX"}
                        </span>
                      </div>
                      <h3>
                        {complete
                          ? "Your draft is ready."
                          : paused
                            ? "Paused, with context preserved."
                            : pending?.type === "contact_person"
                              ? `I found ${firstName}. Here’s what I’ll ask.`
                              : waitingReply
                                ? `Waiting for ${firstName}’s reply.`
                                : pending?.type === "create_draft"
                                  ? `${firstName} confirmed the requirements.`
                                  : failed
                                    ? "This step needs attention."
                                    : c.currentTask}
                      </h3>
                      {pending?.type === "contact_person" && (
                        <blockquote>{String(pending.payload.text)}</blockquote>
                      )}
                      <p>
                        {complete
                          ? `${c.receipt?.id} · Fields and original attachment verified. Finance approval is still required.`
                          : pending?.type === "create_draft"
                            ? "I’ve filled the missing details and prepared the purchase draft. Please review before I create it."
                            : c.blocker ||
                              "Progress is saved as the agent works."}
                      </p>
                      {alexTurn && (
                        <button
                          className="button button-primary full-width"
                          onClick={openReview}
                          disabled={busy}
                        >
                          {pending?.type === "contact_person"
                            ? "Review message"
                            : "Review purchase draft"}
                          <ArrowRight size={16} />
                        </button>
                      )}
                      {complete && safeHref(c.receipt?.url) && (
                        <Link
                          className="button button-primary full-width"
                          href={c.receipt!.url!}
                        >
                          Open saved draft <ArrowUpRight size={16} />
                        </Link>
                      )}
                      {(failed || paused) && (
                        <button
                          className="button button-secondary"
                          disabled={busy}
                          onClick={() => relay.action("resume")}
                        >
                          {failed ? "Retry from saved state" : "Resume request"}
                          <Play size={14} />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
          <section
            className={
              "sd-person sd-carol " + (waitingReply ? "sd-active" : "")
            }
            aria-label={coordinator + "'s demo inbox"}
          >
            <div className="sd-identity">
              <span className="sd-avatar sd-carol-avatar">
                {coordinatorInitials}
              </span>
              <div>
                <h2>{coordinator}</h2>
                <p>
                  Procurement coordinator ·{" "}
                  {live && c.people[0]?.role === "coordinator"
                    ? "Current owner"
                    : "Covering for Bob"}
                </p>
              </div>
              {waitingReply && <Badge tone="green">Your turn</Badge>}
            </div>
            <div className="sd-surface sd-inbox">
              <div className="sd-surface-heading">
                <Tray size={18} />
                <strong>Work messages</strong>
                <span>DEMO INBOX</span>
              </div>
              <div className="sd-thread-heading">
                <span className="sd-relay-avatar">
                  <ArrowsSplit size={20} />
                </span>
                <div>
                  <strong>Relay</strong>
                  <small>Coordinating Alex’s purchase request</small>
                </div>
                {thread.length > 0 && (
                  <Badge tone="green">
                    {waitingReply ? "Needs reply" : "Connected"}
                  </Badge>
                )}
              </div>
              <div className="sd-messages" aria-label="Delivered messages">
                {!thread.length ? (
                  <div className="sd-empty">
                    <span className="sd-empty-icon">
                      <Tray size={30} />
                    </span>
                    <h3>Waiting for a request.</h3>
                    <p>
                      {live && pending?.type === "contact_person"
                        ? "Alex is reviewing Relay’s question. It appears here after authorization."
                        : "Once Relay finds the current coordinator and Alex approves, the request will arrive here with its context."}
                    </p>
                    <span className="sd-fine">
                      You’ll reply here as {firstName}.
                    </span>
                  </div>
                ) : (
                  thread.map((message, index) => (
                    <div className="sd-exchange" key={message.id}>
                      <article className="sd-message sd-incoming">
                        <div className="sd-message-author">
                          <ArrowsSplit size={16} />
                          <strong>Relay</strong>
                          <span>To {message.recipient}</span>
                        </div>
                        {index === 0 && (
                          <div className="sd-message-context">
                            <span>ON BEHALF OF ALEX</span>
                            <strong>{c.facts.item}</strong>
                            <p>
                              {money(
                                c.facts.quantity * c.facts.unitPrice,
                                c.facts.currency,
                              )}{" "}
                              · {c.facts.vendor}
                            </p>
                            <p>{c.requestText}</p>
                          </div>
                        )}
                        <p>{message.question}</p>
                      </article>
                      {message.reply && (
                        <article className="sd-message sd-outgoing">
                          <div className="sd-message-author">
                            <strong>{message.recipient}</strong>
                            <span>Sent in demo inbox</span>
                          </div>
                          <p>{message.reply.text}</p>
                          <span className="sd-delivered">
                            <Check size={13} />
                            Saved to the shared request
                          </span>
                        </article>
                      )}
                    </div>
                  ))
                )}
                {thread.some((t) => t.reply) && (
                  <div className="sd-thread-receipt">
                    <CheckCircle size={16} />
                    {c.facts.costCenter
                      ? "Reply incorporated into Alex’s purchase request."
                      : "Reply delivered. Relay is continuing the same request."}
                  </div>
                )}
              </div>
              {waitingReply ? (
                <form
                  className="sd-reply"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await relay.action("reply", reply)) setReply("");
                  }}
                >
                  <div className="sd-row-heading">
                    <label htmlFor="sd-carol-reply">Reply as {firstName}</label>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => setReply(exampleReply)}
                      disabled={busy}
                    >
                      Use example reply
                    </button>
                  </div>
                  <textarea
                    id="sd-carol-reply"
                    rows={3}
                    placeholder="Confirm the cost center and required materials…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    required
                    maxLength={5000}
                    disabled={busy}
                  />
                  <div className="sd-reply-footer">
                    <span>Visible to Relay, then carried back to Alex.</span>
                    <button
                      className="button button-primary"
                      disabled={busy || reply.trim().length < 2}
                    >
                      {busy ? "Sending…" : "Send reply"}
                      <PaperPlaneTilt size={16} />
                    </button>
                  </div>
                </form>
              ) : (
                <div className="sd-inbox-footer">
                  <span className="sd-dot" />
                  {paused
                    ? "This request is paused."
                    : complete
                      ? "Handoff complete. No further reply needed."
                      : thread.some((t) => t.reply)
                        ? "Alex can continue without forwarding this conversation."
                        : "Messages stay here. Relay carries the context."}
                </div>
              )}
            </div>
          </section>
        </div>
        {live && (currentStep === 4 || c.browserObservation) && (
          <section
            className="sd-execution"
            aria-label="Real purchasing system execution"
          >
            <div className="sd-execution-heading">
              <div>
                <span className="eyebrow">
                  FROM CONVERSATION TO COMPLETED WORK
                </span>
                <h2>
                  {complete
                    ? "Saved in the purchasing system. Checked by Relay."
                    : "Relay is operating the purchasing system."}
                </h2>
              </div>
              <Badge tone={complete ? "green" : "neutral"}>
                {complete
                  ? "Verified draft"
                  : paused
                    ? "Paused"
                    : failed
                      ? "Needs attention"
                      : "Live execution"}
              </Badge>
            </div>
            <div className="sd-execution-grid">
              <div className="sd-observation">
                {safeHref(c.browserObservation?.url) &&
                screenshotError !== c.browserObservation?.url ? (
                  <a
                    href={safeHref(c.browserObservation?.url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      src={safeHref(c.browserObservation?.url)}
                      alt="Latest actual browser observation of the purchasing portal"
                      onError={() =>
                        setScreenshotError(c.browserObservation!.url)
                      }
                    />
                  </a>
                ) : (
                  <div className="sd-empty">
                    <SpinnerGap
                      className={complete ? "" : "sd-spin"}
                      size={25}
                    />
                    <h3>
                      {complete
                        ? "Browser observation unavailable"
                        : "Waiting for the first browser observation"}
                    </h3>
                    <p>
                      The agent’s captured portal state appears here when
                      available.
                    </p>
                  </div>
                )}
              </div>
              <div className="sd-execution-notes">
                <h3>Actual actions. A verifiable result.</h3>
                <ol>
                  {c.events
                    .filter((e) =>
                      ["execution updated", "draft verified"].includes(
                        e.detail,
                      ),
                    )
                    .map((e) => (
                      <li key={e.id}>
                        <CheckCircle size={15} />
                        <span>{e.title}</span>
                      </li>
                    ))}
                </ol>
                {c.browserObservation && (
                  <p className="sd-fine">
                    Latest captured state ·{" "}
                    {new Date(
                      c.browserObservation.observedAt,
                    ).toLocaleTimeString("en-GB", { timeZone: "UTC" })}{" "}
                    UTC · Click to inspect
                  </p>
                )}
                {complete && (
                  <p className="sd-verified">
                    <CheckCircle size={18} />
                    {c.receipt!.id} · {c.receipt!.attachmentsChecked} original
                    attachment verified
                  </p>
                )}
              </div>
            </div>
          </section>
        )}
        {live && (
          <details className="sd-history">
            <summary>
              View shared case history <span>{c.events.length} events</span>
            </summary>
            <ol>
              {c.events.map((e) => (
                <li key={e.id}>
                  <time>
                    {new Date(e.timestamp).toLocaleTimeString("en-GB", {
                      timeZone: "UTC",
                    })}
                  </time>
                  <span>{e.title}</span>
                </li>
              ))}
            </ol>
          </details>
        )}
        <footer className="sd-footer">
          <span>
            Two perspectives on one case. Demo messages stay local; the agent
            and portal actions are real.
          </span>
          <Link href="/workspace">
            Detailed workspace <ArrowUpRight size={13} />
          </Link>
        </footer>
      </main>
      <Dialog
        title={
          review?.action.type === "contact_person"
            ? "Alex · Review message"
            : "Alex · Review purchase draft"
        }
        open={!!review}
        onClose={() => setReview(null)}
        wide
      >
        <div className="dialog-body">
          <Badge tone="green">ALEX’S AUTHORIZATION</Badge>
          <h3 className="dialog-subtitle">{review?.action.title}</h3>
          <p>
            {review?.action.type === "contact_person"
              ? "Relay will post this question to the coordinator’s local demo inbox."
              : "Relay will create a draft through the purchasing portal. Budget approval and order issuance remain separate."}
          </p>
          <dl className="review-fields">
            <div>
              <dt>Destination</dt>
              <dd>
                {review?.action.destination === "/portal/new"
                  ? "Purchasing portal · New draft"
                  : review?.action.destination}
              </dd>
            </div>
            {review?.action.type === "contact_person" ? (
              <div>
                <dt>Message</dt>
                <dd>{String(review.action.payload.text)}</dd>
              </div>
            ) : (
              <>
                {reviewFields(review?.action.payload || {}).map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
                {Array.isArray(review?.action.payload.attachments) &&
                  review.action.payload.attachments.map(
                    (a: {
                      id: string;
                      fileName: string;
                      sizeBytes: number;
                    }) => (
                      <div key={a.id}>
                        <dt>Original attachment</dt>
                        <dd>
                          {a.fileName} · {a.sizeBytes} bytes
                        </dd>
                      </div>
                    ),
                  )}
              </>
            )}
          </dl>
          {review && (review.version !== c.version || paused) && (
            <p className="error-text" role="alert">
              The request changed. Close this review and check the latest
              proposal.
            </p>
          )}
          {relay.error && (
            <p className="error-text" role="alert">
              {relay.error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="button button-secondary"
              disabled={busy || paused || review?.version !== c.version}
              onClick={async () => {
                if (
                  review &&
                  (await relay.action("decline", "", {
                    actionId: review.action.id,
                    expectedVersion: review.version,
                  }))
                )
                  setReview(null);
              }}
            >
              Decline
            </button>
            <button
              className="button button-primary"
              disabled={
                busy || paused || !review || review.version !== c.version
              }
              onClick={async () => {
                if (
                  review &&
                  (await relay.action("authorize", "", {
                    actionId: review.action.id,
                    expectedVersion: review.version,
                  }))
                )
                  setReview(null);
              }}
            >
              {busy
                ? "Confirming…"
                : review?.action.type === "contact_person"
                  ? "Allow message"
                  : "Allow draft creation"}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </Dialog>
      <Dialog
        title="Evidence behind the handoff"
        open={showSources}
        onClose={() => setShowSources(false)}
        wide
      >
        <div className="dialog-body sd-sources">
          {c.evidence.map((e) => (
            <article key={e.id}>
              <Badge tone={e.status === "confirmed" ? "green" : "neutral"}>
                {e.status === "superseded" ? "Archived" : e.status}
              </Badge>
              <h3>{e.title}</h3>
              <p>{e.excerpt}</p>
              {safeHref(e.url) && (
                <a
                  href={safeHref(e.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-link"
                >
                  Open source <ArrowUpRight size={13} />
                </a>
              )}
            </article>
          ))}
        </div>
      </Dialog>
      <Dialog
        title="Start a new demo as Alex"
        open={newDemo}
        onClose={() => setNewDemo(false)}
      >
        <div className="dialog-body">
          <p>
            A new request gets its own agent session and message thread.
            Existing requests stay saved.
          </p>
          {newDemo && requestForm("sd-new-request")}
          {relay.error && (
            <p className="error-text" role="alert">
              {relay.error}
            </p>
          )}
        </div>
      </Dialog>
    </div>
  );
}
