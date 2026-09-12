"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" tabIndex={-1} className="empty-state">
      <h1>Something interrupted this page.</h1>
      <p>
        Your saved drafts remain in local storage. Try loading the page again.
      </p>
      <button className="button button-primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
