"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Paperclip,
  ShieldCheck,
  UploadSimple,
  X,
  CheckCircle,
} from "@phosphor-icons/react";
import { AppHeader, Badge, money } from "./ui";
import {
  MAX_ATTACHMENTS,
  MAX_FILE_BYTES,
  type DraftFields,
  type PortalDraft,
} from "@/portal/schema";

const sample = {
  item: "Precision thermal camera",
  vendor: "Northstar Instruments",
  quantity: "1",
  currency: "USD",
  unitPrice: "2450",
  costCenter: "ENG-240",
  justification:
    "Thermal validation of the next hardware prototype. This non-catalog camera supports controlled heat testing in the engineering lab.",
};
const initial = {
  item: "",
  vendor: "",
  quantity: "1",
  currency: "USD",
  unitPrice: "",
  costCenter: "",
  justification: "",
};
export function PortalForm({ reference }: { reference: string }) {
  const router = useRouter();
  const [values, setValues] = useState({
    ...initial,
    requestReference: reference,
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>(
    {},
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sampleLoaded, setSampleLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const update = (key: keyof typeof values, value: string) => {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  };
  function addFiles(files: File[]) {
    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      setError("You can attach up to three files.");
      return;
    }
    if (files.some((file) => file.size === 0 || file.size > MAX_FILE_BYTES)) {
      setError("Files must be non-empty and at most 5 MB each.");
      return;
    }
    setAttachments((previous) => [...previous, ...files]);
    setError("");
  }
  async function loadSample() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/sample-quote.txt");
      if (!response.ok)
        throw new Error("The sample quote could not be loaded.");
      const file = new File([await response.blob()], "QT-2026-084.txt", {
        type: "text/plain",
      });
      setValues((previous) => ({ ...previous, ...sample }));
      setAttachments([file]);
      setErrors({});
      setSampleLoaded(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setErrors({});
    try {
      const form = new FormData();
      Object.entries(values).forEach(([key, value]) => form.set(key, value));
      attachments.forEach((file) => form.append("attachments", file));
      const response = await fetch("/api/portal/drafts", {
        method: "POST",
        body: form,
      });
      const body = await response.json();
      if (!response.ok) {
        setErrors(body.fields || {});
        throw new Error(body.error || "Could not save the draft.");
      }
      const draft = body.draft as PortalDraft;
      setBusy(false);
      router.push(draft.url);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  function field(
    key: keyof typeof values,
    label: string,
    options: {
      type?: string;
      placeholder?: string;
      min?: string;
      step?: string;
      maxLength?: number;
    } = {},
  ) {
    return (
      <div className="form-field">
        <label htmlFor={key}>{label}</label>
        <input
          id={key}
          name={key}
          value={values[key]}
          onChange={(e) => update(key, e.target.value)}
          required
          disabled={busy}
          aria-invalid={!!errors[key]}
          aria-describedby={errors[key] ? key + "-error" : undefined}
          {...options}
        />
        {errors[key] && (
          <span id={key + "-error"} className="error-text">
            {errors[key]![0]}
          </span>
        )}
      </div>
    );
  }
  return (
    <>
      <AppHeader />
      <main id="main-content" tabIndex={-1} className="portal-main">
        <Link href="/" className="back-link">
          <ArrowLeft size={16} />
          Back to request
        </Link>
        <div className="portal-title">
          <div>
            <span className="eyebrow">TEST PROCUREMENT PORTAL</span>
            <h1>
              Make room for
              <br />
              what comes next.
            </h1>
            <p>A complete purchase draft, ready for the right review.</p>
          </div>
          <Badge>Draft creation only</Badge>
        </div>
        <div className="portal-layout">
          <form className="purchase-form" onSubmit={save}>
            <div className="section-heading">
              <h2>Purchase details</h2>
              <button
                type="button"
                className="inline-action"
                disabled={busy}
                onClick={loadSample}
              >
                {sampleLoaded ? "Reload sample" : "Use sample details"}
                <ArrowRight size={15} />
              </button>
            </div>
            {sampleLoaded && (
              <p className="sample-note">
                <CheckCircle size={15} />
                Synthetic sample filled. The quote is attached.
              </p>
            )}
            {error && (
              <div className="alert alert-error" role="alert">
                {error}
              </div>
            )}
            <fieldset disabled={busy}>
              <legend className="sr-only">Purchase information</legend>
              <div className="form-grid">
                <div className="span-two">
                  {field("item", "Item", {
                    placeholder: "What do you need to purchase?",
                    maxLength: 200,
                  })}
                </div>
                {field("vendor", "Vendor", {
                  placeholder: "Supplier name",
                  maxLength: 160,
                })}
                {field("requestReference", "Request reference", {
                  placeholder: "REQ-1042",
                  maxLength: 80,
                })}
                {field("quantity", "Quantity", {
                  type: "number",
                  min: "1",
                  step: "1",
                })}
                <div className="form-field">
                  <label htmlFor="currency">Currency</label>
                  <select
                    id="currency"
                    name="currency"
                    value={values.currency}
                    onChange={(e) => update("currency", e.target.value)}
                  >
                    <option value="USD">USD — US dollar</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="GBP">GBP — British pound</option>
                  </select>
                </div>
                {field("unitPrice", "Unit price", {
                  type: "number",
                  min: "0.01",
                  step: "0.01",
                  placeholder: "0.00",
                })}
                {field("costCenter", "Cost center", {
                  placeholder: "Confirmed accounting code",
                  maxLength: 80,
                })}
                <div className="form-field span-two">
                  <label htmlFor="justification">Business justification</label>
                  <textarea
                    id="justification"
                    name="justification"
                    value={values.justification}
                    onChange={(e) => update("justification", e.target.value)}
                    rows={3}
                    required
                    minLength={20}
                    maxLength={5000}
                    placeholder="What will this purchase help your team do?"
                    aria-invalid={!!errors.justification}
                  />
                  {errors.justification && (
                    <span className="error-text">
                      {errors.justification[0]}
                    </span>
                  )}
                </div>
              </div>
            </fieldset>
            <div className="attachment-heading">
              <h3>Supporting materials</h3>
              <span className="small-mono">{attachments.length} / 3 FILES</span>
            </div>
            <label
              className="upload-zone"
              htmlFor="attachments"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!busy) addFiles(Array.from(e.dataTransfer.files));
              }}
            >
              <UploadSimple size={26} />
              <strong>Choose files or drop them here</strong>
              <span>
                Quote attachment · PDF, TXT, PNG or JPG · Up to 5 MB each
              </span>
              <input
                ref={inputRef}
                className="file-input"
                id="attachments"
                name="attachments"
                type="file"
                accept=".pdf,.txt,.png,.jpg,.jpeg"
                multiple
                disabled={busy}
                onChange={(e) => {
                  addFiles(Array.from(e.target.files || []));
                  e.target.value = "";
                }}
              />
            </label>
            {attachments.map((file, i) => (
              <div className="uploaded-file" key={file.name + i}>
                <FileText size={19} />
                <span>
                  {file.name}
                  <small>{(file.size / 1024).toFixed(1)} KB</small>
                </span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={"Remove " + file.name}
                  disabled={busy}
                  onClick={() =>
                    setAttachments((previous) =>
                      previous.filter((_, index) => index !== i),
                    )
                  }
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <div className="form-footer">
              <p>
                <ShieldCheck size={17} />
                Saving a draft does not place an order.
              </p>
              <button
                type="submit"
                className="button button-primary"
                disabled={busy}
              >
                {busy ? "Saving draft…" : "Save draft"}
                <ArrowRight size={17} />
              </button>
            </div>
          </form>
          <aside className="purchase-summary">
            <div className="summary-illustration">
              <div className="document-stack">
                <div />
                <div />
                <div>
                  <FileText size={40} weight="thin" />
                </div>
              </div>
              <span className="small-mono">THE NEXT STEP, PREPARED.</span>
            </div>
            <h2>
              Ready for review.
              <br />
              Nothing committed.
            </h2>
            <p>
              Keep the details and supporting materials together in one
              persistent record.
            </p>
            <dl>
              <div>
                <dt>Estimated total</dt>
                <dd>
                  {money(
                    (Number(values.quantity) || 0) *
                      (Number(values.unitPrice) || 0),
                    values.currency,
                  )}
                </dd>
              </div>
              <div>
                <dt>Attachments</dt>
                <dd>
                  {attachments.length} file{attachments.length === 1 ? "" : "s"}
                </dd>
              </div>
              <div>
                <dt>After saving</dt>
                <dd>Organizational review</dd>
              </div>
            </dl>
            <div className="summary-note">
              <Paperclip size={18} />
              <p>
                Your original files are stored with the draft and available when
                it is reopened.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
