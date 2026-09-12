# Relay — Design Direction

**Date:** September 12, 2026

**Status:** Design requirements; no product UI has been implemented or visually tested.

**Reference:** [Baseten homepage](https://www.baseten.co/), selected by the user as a public visual reference for Relay.

## 1. Design intent

Relay should feel precise, calm, and capable of getting operational work completed. Its interface makes the request, the current obstacle, and the next useful action immediately legible.

Adapt Baseten's strong typography, open white space, visible grid, rectangular controls, and technical diagrams to a procurement companion. Relay's own visual subject is a request moving through documents, people, and systems. Use original compositions and product language; Baseten's logo, illustrations, customer logos, and marketing claims are not Relay assets.

## 2. What was observed

The reference was inspected in a live desktop browser at approximately 1280 × 720, using screenshots and computed styles from rendered elements. These observations cover the homepage hero and product section, not Baseten's logged-in product or a complete responsive audit.

| Area | Reference observation | Application to Relay |
| --- | --- | --- |
| Composition | Split hero: large text at left, technical illustration at right; aligned sections divided by fine, often dashed rules | Clear division between case context and the active task; shared alignment across rows |
| Typography | Rendered hero uses `NeueAlteGrotesk`, 88px/80px, weight 600; a product heading uses 48px; hero supporting text uses 24px/32px | Strong neutral grotesque hierarchy, scaled down for operational work |
| Labels and actions | `chivoMono` appears in uppercase action labels; primary buttons are black with white text and square corners | Monospace IDs and compact stage labels; black primary action with precise wording |
| Palette | White and black; visible product surfaces compute to `#F5F8F4`, with green elements at `#19E76E` | White working canvas, lightly tinted supporting surfaces, green used sparingly |
| Illustration | Thin-line isometric volumes, stacked discs, cubes, dashed connectors, small technical labels, green and pale pink accents | Original document bundles and handoff paths labeled with real case roles and stages |
| Modules | One prominent product block above smaller aligned columns; limited reliance on floating, heavily rounded cards | A dominant active task followed by compact evidence and activity rows |
| Motion evidence | Illustration labels changed across observations; action elements expose a 236ms transition with `cubic-bezier(0.5, 0.2, 0.4, 1)` | Restrained transitions tied to state changes; exact Relay behavior specified below |

Animation implementation, full timelines, and reduced-motion behavior were not audited. The sampled visible elements did not expose named CSS animations. No animation library or complete choreography is inferred from the screenshots. Fonts above are observed family names, not a license to redistribute the site's font files.

## 3. Product layout

### Embedded companion: prototype priority

Keep the purchasing page visible. Place a Relay panel beside it, approximately 380–460px wide when space permits. The source page supplies the current request or selected quote; the panel preserves this context as the employee moves through the form.

Order the panel around decisions:

1. **Case header:** Short request title, case ID, current stage, and pause control.
2. **Current task:** One sentence explaining what happens next or what is blocking progress.
3. **Materials and people:** Compact checklist and current coordinator, with evidence links.
4. **Action area:** The relevant next action, such as “Review draft” or “Reply with cost center.”
5. **Activity:** Timestamped outcomes with expandable supporting evidence.

Keep the conversation available as case history. Do not make a blank prompt box the main screen after intake. When the agent is operating the portal, the actual page and a short progress label should explain what is happening.

### Expanded case view

An expanded workbench can use a narrow case list, a dominant work area, and an evidence drawer. Its main work area contains the current blocker, a compact route, the materials checklist, and the result. The evidence drawer opens when needed and identifies the source, applicable date, authority status, and relevant excerpt.

At narrower widths, show one surface at a time with a clear “Back to purchase” control. Preserve the current task and review action above optional history. On mobile, use a single column; no dependency on hovering over a diagram. These are requirements to verify during implementation, not tested breakpoints.

### Brand introduction: later scope

If a landing page is needed, pair the headline **“Keep the request moving.”** with an original handoff illustration and one clear entry action. Follow it with a concrete case walkthrough. The two-hour prototype opens directly into the working purchase scenario.

## 4. Proposed visual foundation

The following values are Relay design choices, informed by the reference. They are not an exported copy of Baseten's complete design system.

| Token or role | Relay proposal |
| --- | --- |
| Canvas | `#FFFFFF` |
| Supporting surface | `#F5F8F4` |
| Primary text and primary action | `#101410` |
| Secondary text | `#586259` |
| Structural rule | `#D8DED6`; use a stronger border where a control boundary needs it |
| Accent fill | `#19E76E`, paired with dark text |
| Confirmed status | `#176B3A` text with `#EAF8EE` surface |
| Waiting status | `#805000` text with `#FFF4DB` surface |
| Error status | `#A32727` text with `#FFF0EF` surface |
| Illustration secondary accent | `#E8CCF3`, used only in supporting artwork |
| Interface typography | Proposed `Geist` or system sans-serif; no dependency on Baseten's font assets |
| Technical labels | Proposed `Geist Mono` or system monospace; IDs, timestamps, short stage labels |
| Type scale | 14–16px body, 12–13px metadata, 24–32px case title; larger display type only on an introduction page |
| Spacing | 4px base; 8, 12, 16, 24, 32, and 48px steps |
| Shape | 0–4px corner radius; crisp rectangular panels and buttons |
| Elevation | Borders first; a small shadow only for overlays requiring separation |

Use dark text on bright green. Color is supplementary: every stage also has a text label and, where useful, an icon. Check final text and control contrast in the implemented interface, including muted text and focus states.

## 5. Components and required states

| Component | Required behavior and presentation |
| --- | --- |
| Current-task block | State the blocker and the smallest next action; show useful preparation continuing separately |
| Process route | Labeled stages with completed, active, pending, blocked, and superseded states; source links remain reachable without hover |
| Responsibility row | Distinguish coordinator, expert, delegate, and approver; expand to the dated authority evidence |
| Evidence row | Title, applicable version/date, evidence status, and open-source action; visibly distinguish a generated summary from an original |
| Materials checklist | Missing, supplied, needs review, and confirmed states; identify the actual attachment version |
| Review panel | Show destination, draft fields, attachments, and remaining business approvals; primary action names the exact operation |
| Execution view | Actual browser observations and timestamped events; show disconnected, paused, and uncertain outcomes explicitly |
| Receipt | Real destination ID, saved state, verification time, attachment checks, and next required review |
| Buttons and inputs | Default, hover, keyboard focus, pressed, disabled, loading, error, and success treatments where applicable |

Use labels such as “Create draft,” “Ask Carol,” “Waiting for cost center,” and “Draft saved — awaiting review.” Avoid a generic “Approve” label when the action only authorizes the agent to fill a draft. A rejected action leaves the prepared case available for correction.

## 6. Illustration direction

Create one reusable visual concept: **the case packet**. A small stack of documents travels between labeled process stages. Its path can change when a verified handover changes the coordinator, while the packet retains its evidence.

Use thin outlines, modest isometric depth, sparse green fills, dashed dependency lines, and compact labels. In the full illustration, source documents feed a request packet, the packet passes through a responsible coordinator, and the destination becomes a verified draft receipt. Keep distinct symbols for people, documents, and systems.

In the working UI, simplify this into an accessible route component driven by case data. Do not use decorative connector positions as the only explanation of authority. Retain a list or text alternative. Never display invented throughput numbers, completion metrics, customer logos, or fabricated screenshots in the artwork.

For the two-hour prototype, use the simpler route and document icon. Commission or generate the polished isometric artwork after the workflow works.

## 7. Motion specification

These are proposed Relay behaviors, not claims about Baseten's implementation. Prefer opacity and transforms; preserve stable reading and click targets. Use a shared easing such as `cubic-bezier(0.22, 1, 0.36, 1)` for entrances and a short ease-out for feedback.

| Trigger | Proposed motion | Meaning |
| --- | --- | --- |
| Panel opens | 180–240ms opacity and up to 8px translation | A new working surface is available |
| Reply is received | New activity row enters once over 160–220ms | A real event arrived |
| Valid coordinator changes | Brief transition between old and new responsibility rows; retain the old entry in history | The responsibility evidence changed |
| A tool starts | Small activity indicator beside the named operation | Work is in progress, with no promise of success |
| Draft is retrieved and checked | Receipt appears with a single check transition | The destination result was verified |
| Action fails or is uncertain | Stable inline explanation; remove the running indicator when execution has stopped | The user can understand and resolve the state |

Do not animate fictional browser activity or move a request into “completed” before verification. Avoid decorative infinite loops in the case panel. When `prefers-reduced-motion` is enabled, remove spatial movement and provide immediate state updates. Announce meaningful status changes accessibly without announcing every tool observation.

## 8. Implementation acceptance checklist

- The first case screen makes the request, current blocker, responsible contact, and next action easy to locate.
- The purchasing page remains usable beside the panel at the supported desktop width.
- A reviewer can open the evidence for a changed owner or requirement without searching the full conversation.
- The main action names its real effect and offers a concrete preview.
- Keyboard users can review, correct, pause, and resume; overlays restore focus to the invoking control.
- Narrow layouts preserve the current task and action without horizontal scrolling of essential content.
- Reduced-motion mode retains all task information.
- Empty, loading, disconnected, blocked, declined, failed, uncertain, and verified states have explicit copy.
- A verified draft is visually distinct from an approved or issued purchase order.
- The demo clearly identifies synthetic data and test systems.

Scope order: working case layout → review and evidence → verified execution feedback → visual consistency → optional brand illustration and motion polish. The prototype must demonstrate real work before investing in presentation beyond the shared visual foundation.

<!-- Design-spec self-review: product fit 5/5, hierarchy 4/5, evidence 4/5, restraint 4/5, requirements clarity 4/5, verification honesty 5/5. These are editorial assessments of the specification, not scores from an implemented UI or user study. -->
