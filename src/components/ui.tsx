"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowsSplit,
  X,
  CheckCircle,
  Circle,
  WarningCircle,
} from "@phosphor-icons/react";

export function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={"brand " + (small ? "brand-small" : "")}>
      <ArrowsSplit size={small ? 22 : 28} weight="bold" aria-hidden="true" />
      <span>
        relay<span className="brand-period">.</span>
      </span>
    </span>
  );
}
export function AppHeader({
  active = "requests",
  actions,
}: {
  active?: "requests" | "drafts";
  actions?: ReactNode;
}) {
  return (
    <header className="app-header">
      <Link href="/" className="brand-link" aria-label="Relay home">
        <Brand />
      </Link>
      <nav aria-label="Main navigation">
        <Link
          href="/"
          aria-current={active === "requests" ? "page" : undefined}
        >
          Workspace
        </Link>
        <Link
          href="/portal/drafts"
          aria-current={active === "drafts" ? "page" : undefined}
        >
          Saved drafts
        </Link>
      </nav>
      <div className="header-actions">
        {actions || (
          <span className="environment-label">TEST PROCUREMENT PORTAL</span>
        )}
        <span
          className="user-avatar"
          title="Alex Lee · Demo requester"
          aria-label="Alex Lee · Demo requester"
        >
          AL
        </span>
      </div>
    </header>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "green" | "amber" | "neutral" | "red";
}) {
  return <span className={"badge badge-" + tone}>{children}</span>;
}
export function StepIcon({ status }: { status: string }) {
  return status === "done" || status === "confirmed" ? (
    <CheckCircle
      className="success-ink"
      size={19}
      weight="fill"
      aria-hidden="true"
    />
  ) : status === "missing" ? (
    <WarningCircle className="waiting-ink" size={19} aria-hidden="true" />
  ) : (
    <Circle className="muted-ink" size={19} aria-hidden="true" />
  );
}
export function Dialog({
  title,
  open,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={"dialog " + (wide ? "dialog-wide" : "")}
      onCancel={(e) => {
        e.preventDefault();
        closeRef.current();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeRef.current();
      }}
      aria-label={title}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function TextLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link className="text-link" href={href}>
      {children}
      <ArrowUpRight size={15} />
    </Link>
  );
}
export function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    value,
  );
}
export function safeHref(url?: string) {
  if (!url) return undefined;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return url;
  } catch {
    /* Invalid sources are displayed without a link. */
  }
  return undefined;
}
