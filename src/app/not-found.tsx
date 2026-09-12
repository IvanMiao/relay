import Link from "next/link";
import { AppHeader } from "@/components/ui";
export default function NotFound() {
  return (
    <>
      <AppHeader />
      <main id="main-content" tabIndex={-1} className="empty-state">
        <h1>This record isn’t here.</h1>
        <p>It may not have been saved, or the link may be incorrect.</p>
        <Link href="/portal/drafts" className="button button-primary">
          View saved drafts
        </Link>
      </main>
    </>
  );
}
