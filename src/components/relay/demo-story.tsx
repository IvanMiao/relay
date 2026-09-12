import type { ReactNode } from "react";
import {
  ArrowRight,
  Check,
  FileText,
  ArrowsSplit,
} from "@phosphor-icons/react";
import { Badge } from "../ui";
import type { CaseSnapshot } from "./view-model";

export function StorySetup({
  form,
  saved,
  onContinue,
  error,
}: {
  form: ReactNode;
  saved: string | null;
  onContinue: () => void;
  error: string;
}) {
  return (
    <section className="story-setup" aria-label="The problem Relay solves">
      <div className="story-opening">
        <span className="eyebrow">THE PROBLEM · NO CLEAR OWNER</span>
        <h1>
          Alex has the quote.
          <br />
          But who owns the next step?
        </h1>
        <p>
          He needs a <strong>$2,450 thermal camera</strong> to test a hardware
          prototype. Before a purchase request can move, someone has to confirm
          the process and the missing paperwork.
        </p>
      </div>
      <div className="story-dead-end" aria-label="Why the request is stuck">
        <article>
          <span className="story-source">
            <FileText size={16} />
            The purchasing guide
          </span>
          <h2>“Contact Alice.”</h2>
          <Badge tone="amber">Outdated owner</Badge>
          <p>Alice has handed equipment purchasing over to Bob.</p>
        </article>
        <ArrowRight className="story-route-arrow" size={22} />
        <article>
          <span className="story-source">The handover record</span>
          <h2>“Bob took over.”</h2>
          <Badge tone="amber">On leave · Sep 10–18</Badge>
          <p>
            The new owner is unavailable. His title doesn’t tell Alex who
            covers.
          </p>
        </article>
        <ArrowRight className="story-route-arrow" size={22} />
        <article className="story-blocked">
          <span className="story-source">Alex’s purchase request</span>
          <h2>Still no way forward.</h2>
          <p>
            Who should he ask next? Which budget code? What supporting
            documents?
          </p>
          <strong>Alex becomes the person chasing everyone.</strong>
        </article>
      </div>
      <div className="story-takeover">
        <div className="story-promise">
          <span className="eyebrow">
            <ArrowsSplit size={17} /> WHAT RELAY TAKES OVER
          </span>
          <h2>
            Find the owner. <br />
            Carry the context. <br />
            Finish the paperwork.
          </h2>
          <p>
            Relay checks the current records, asks the available coordinator
            only for what’s missing, then fills and verifies the purchase draft.
          </p>
          <p className="story-control">
            Alex reviews outgoing messages and draft creation. People keep the
            decisions; Relay handles the handoffs.
          </p>
        </div>
        <div className="story-start">
          <h3>Try the handoff, from both sides.</h3>
          <p>
            Play Alex on the left and the coordinator on the right. Their
            workspaces share one request.
          </p>
          {form}
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          {saved && (
            <button className="text-link story-resume" onClick={onContinue}>
              {saved}
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
      <p className="story-scenario-note">
        Demo setup: synthetic company records and a local inbox. The agent,
        replies, form entry and saved draft are real. The dated cover applies
        September 10–18, 2026.
      </p>
    </section>
  );
}

export function getStoryBeat(c: CaseSnapshot, live: boolean) {
  const person = c.people[0]?.name.split(" ")[0] || "the coordinator";
  const replied = c.conversations?.some((q) => q.reply);
  if (!live)
    return {
      act: 0,
      label: "THE HANDOFF",
      title: "Give Relay the request, not a list of people to chase.",
      why: "Start with Alex’s quote and the reason for the purchase. Relay will work out who can help.",
    };
  if (c.status === "completed")
    return {
      act: 2,
      label: "THE RESULT",
      title: "A stuck request is now a verified purchase draft.",
      why: `Relay found ${person}, carried their reply back to Alex, and saved the completed paperwork in the purchasing system.`,
    };
  if (c.status === "paused" || c.status === "failed")
    return {
      act:
        c.stage === "execute" || c.stage === "verify" || c.stage === "review"
          ? 2
          : replied
            ? 1
            : 0,
      label: c.status === "paused" ? "PAUSED" : "NEEDS ATTENTION",
      title: "The request is saved. This step needs to continue.",
      why: "The conversation and reviewed actions are preserved. Use the control in Alex’s workspace to resume from the saved state.",
    };
  if (c.stage === "execute" || c.stage === "verify")
    return {
      act: 2,
      label: "DO THE PAPERWORK",
      title: "The answers become a draft in the purchasing system.",
      why: "Alex has authorized creation. Relay now enters the reviewed fields, attaches the original quote, and checks the saved result.",
    };
  if (c.pendingAction?.type === "create_draft")
    return {
      act: 2,
      label: "DO THE PAPERWORK",
      title: `${person} answered. Alex doesn’t have to copy it all over.`,
      why: "Relay turned the reply into the budget code and technical justification. Alex reviews the prepared draft before Relay creates it.",
    };
  if (c.status === "waiting_for_reply" || replied)
    return {
      act: 1,
      label: "CARRY THE CONTEXT",
      title: replied
        ? `${person} replied. The request moves back to Alex.`
        : `${person} gets one question, with all the context.`,
      why: replied
        ? "The same request keeps the reply. Relay is using it to fill the missing purchase details."
        : "The quote, reason for buying and targeted question arrive together. The coordinator only needs to supply the missing details.",
    };
  if (c.people.length)
    return {
      act: 0,
      label: "FIND THE OWNER",
      title: `The guide points to Alice. Relay found ${person}.`,
      why:
        c.people[0].id === "carol"
          ? "An approved handover points to Bob. His dated leave coverage points to Carol. Relay checked both before asking Alex to contact her."
          : "Relay checked the approved handover and current availability. The contact comes from evidence, not the old guide or a job title.",
    };
  return {
    act: 0,
    label: "FIND THE OWNER",
    title: "The guide names Alice. Relay checks who owns it today.",
    why: "Relay is checking the current policy, Alice’s handover and Bob’s leave coverage. Alex stays with the purchase request.",
  };
}
export function StoryChapter({ c, live }: { c: CaseSnapshot; live: boolean }) {
  const beat = getStoryBeat(c, live);
  const done = live && c.status === "completed";
  return (
    <div className="story-chapter">
      <nav aria-label="The Relay story">
        <ol>
          {["Find the owner", "Carry the context", "Do the paperwork"].map(
            (name, i) => (
              <li
                key={name}
                className={
                  done || i < beat.act ? "done" : i === beat.act ? "active" : ""
                }
                aria-current={!done && i === beat.act ? "step" : undefined}
              >
                <span>
                  {done || i < beat.act ? <Check size={12} /> : `0${i + 1}`}
                </span>
                {name}
              </li>
            ),
          )}
        </ol>
      </nav>
      <div className="story-beat" key={beat.title}>
        <span className="eyebrow">
          {c.status === "completed" && live ? "DONE" : `0${beat.act + 1}`} /{" "}
          {beat.label}
        </span>
        <h1>{beat.title}</h1>
        <p>{beat.why}</p>
      </div>
    </div>
  );
}
export function StoryOutcome({ c }: { c: CaseSnapshot }) {
  if (c.status !== "completed" || !c.receipt) return null;
  return (
    <section
      className="story-outcome"
      aria-label="What changed because of Relay"
    >
      <div>
        <span className="eyebrow">BEFORE RELAY</span>
        <h2>
          A quote, an outdated guide,
          <br />
          and someone to chase.
        </h2>
      </div>
      <ArrowRight size={24} />
      <div>
        <span className="eyebrow">NOW, IN THE SAME REQUEST</span>
        <ul>
          <li>
            <Check size={15} />
            <span>
              <strong>{c.people[0]?.name || "Coordinator"}</strong> — verified
              current contact
            </span>
          </li>
          <li>
            <Check size={15} />
            <span>
              <strong>{c.facts.costCenter}</strong> + technical justification —
              added from the reply
            </span>
          </li>
          <li>
            <Check size={15} />
            <span>
              <strong>{c.receipt.id}</strong> — draft saved, original quote
              verified
            </span>
          </li>
        </ul>
        <p>
          Ready for organizational review. Budget approval remains with Finance.
        </p>
      </div>
    </section>
  );
}
