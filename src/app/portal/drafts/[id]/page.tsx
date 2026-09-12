import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle,
  DownloadSimple,
  FileText,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";
import { AppHeader, Badge } from "@/components/ui";
import { portalStore } from "@/portal/store";
export const dynamic = "force-dynamic";
export default async function DraftDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const draft = portalStore().get((await params).id);
  if (!draft) notFound();
  return (
    <>
      <AppHeader active="drafts" />
      <main id="main-content" tabIndex={-1} className="receipt-main">
        <Link href="/portal/drafts" className="back-link">
          <ArrowLeft size={16} />
          All saved drafts
        </Link>
        <div className="saved-heading">
          <span className="saved-check">
            <CheckCircle size={42} weight="fill" />
          </span>
          <span className="eyebrow">SAVED IN THE TEST PORTAL</span>
          <h1>
            The next step
            <br />
            starts with a complete draft.
          </h1>
          <p>
            Your record and original attachments have been retrieved from
            storage.
          </p>
          <Badge tone="amber">
            Draft saved · Awaiting organizational review
          </Badge>
        </div>
        <section className="saved-record">
          <div className="section-heading">
            <div>
              <span className="small-mono">{draft.id}</span>
              <h2>{draft.fields.item}</h2>
            </div>
            <FileText size={28} weight="thin" />
          </div>
          <dl className="review-fields">
            <div>
              <dt>Request reference</dt>
              <dd>{draft.requestReference}</dd>
            </div>
            <div>
              <dt>Vendor</dt>
              <dd>{draft.fields.vendor}</dd>
            </div>
            <div>
              <dt>Quantity</dt>
              <dd>{draft.fields.quantity}</dd>
            </div>
            <div>
              <dt>Unit price</dt>
              <dd>
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: draft.fields.currency,
                }).format(draft.fields.unitPrice)}
              </dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: draft.fields.currency,
                }).format(draft.fields.unitPrice * draft.fields.quantity)}
              </dd>
            </div>
            <div>
              <dt>Cost center</dt>
              <dd>{draft.fields.costCenter}</dd>
            </div>
            <div>
              <dt>Justification</dt>
              <dd>{draft.fields.justification}</dd>
            </div>
            <div>
              <dt>Saved at</dt>
              <dd>
                {new Date(draft.createdAt)
                  .toISOString()
                  .replace("T", " ")
                  .slice(0, 19)}{" "}
                UTC
              </dd>
            </div>
          </dl>
          <h3 className="attachment-heading">Original attachments</h3>
          {draft.attachments.map((file) => (
            <a
              key={file.id}
              href={file.url}
              className="attachment-card"
              download
            >
              <span className="file-symbol">
                <FileText size={23} />
              </span>
              <span>
                <strong>{file.name}</strong>
                <small>
                  {file.size} bytes · SHA-256 {file.sha256.slice(0, 12)}…
                </small>
              </span>
              <DownloadSimple size={20} />
            </a>
          ))}
          <div className="source-note">
            <ShieldCheck size={20} />
            <p>
              This page confirms a saved draft. It does not grant budget
              approval or confirm order issuance. Agent verification is a
              separate case step.
            </p>
          </div>
          <Link href="/" className="button button-primary">
            Back to Relay
            <ArrowUpRight size={17} />
          </Link>
        </section>
      </main>
    </>
  );
}
