import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  Plus,
} from "@phosphor-icons/react/dist/ssr";
import { AppHeader, Badge } from "@/components/ui";
import { portalStore } from "@/portal/store";
export const dynamic = "force-dynamic";
export default function Drafts() {
  const drafts = portalStore().list();
  return (
    <>
      <AppHeader active="drafts" />
      <main id="main-content" tabIndex={-1} className="drafts-main">
        <div className="drafts-title">
          <div>
            <span className="eyebrow">TEST PROCUREMENT PORTAL</span>
            <h1>
              Every detail.
              <br />
              Ready to carry forward.
            </h1>
            <p>Saved drafts, with their original supporting materials.</p>
          </div>
          <Link className="button button-primary" href="/portal/new">
            <Plus size={17} />
            New draft
          </Link>
        </div>
        <div className="section-heading">
          <h2>Saved purchase drafts</h2>
          <span className="small-mono">
            {drafts.length} RECORD{drafts.length === 1 ? "" : "S"}
          </span>
        </div>
        {drafts.length ? (
          <div className="draft-list">
            {drafts.map((draft) => (
              <Link className="draft-row" key={draft.id} href={draft.url}>
                <span className="file-symbol">
                  <FileText size={24} />
                </span>
                <span className="draft-name">
                  <strong>{draft.fields.item}</strong>
                  <small>
                    {draft.id} · {draft.fields.vendor}
                  </small>
                </span>
                <span className="draft-amount">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: draft.fields.currency,
                  }).format(draft.fields.unitPrice * draft.fields.quantity)}
                </span>
                <Badge tone="amber">Awaiting review</Badge>
                <ArrowUpRight size={20} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <FileText size={35} weight="thin" />
            </div>
            <h2>A clean slate for the next request.</h2>
            <p>
              Drafts you save in the test portal will appear here. Preview
              receipts are kept separate.
            </p>
            <Link className="button button-primary" href="/portal/new">
              Create your first draft
              <ArrowRight size={17} />
            </Link>
          </div>
        )}
        <p className="source-disclaimer">
          Local prototype · Synthetic data only · Drafts are not issued orders
        </p>
      </main>
    </>
  );
}
