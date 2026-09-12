"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CaseSnapshot, PreviewScene } from "./view-model";
import { liveSnapshot } from "./contract-adapter";
import { makePreview } from "./preview";

type SavedPreview = {
  snapshot: CaseSnapshot;
  scene: PreviewScene;
  resumeStatus?: CaseSnapshot["status"];
};
const storageKey = "relay-ui-preview-v1";
async function jsonRequest(url: string, body?: unknown, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(12000);
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      (typeof data.error === "string" ? data.error : data.error?.message) ||
        (response.status === 404
          ? "The agent endpoint is not connected yet. Ask your teammate to add the case API, then reconnect."
          : "The agent connection failed. Your last case state is preserved."),
    );
  }
  return response.json();
}
function parseSnapshot(data: unknown): CaseSnapshot {
  const raw = data as { case?: unknown; snapshot?: unknown };
  const value = (raw?.case || raw?.snapshot || data) as CaseSnapshot;
  if (
    !value?.id ||
    !Number.isInteger(value.version) ||
    !Array.isArray(value.tasks) ||
    !Array.isArray(value.evidence) ||
    !Array.isArray(value.people) ||
    !Array.isArray(value.events) ||
    !value.facts ||
    !value.currentTask
  ) {
    throw new Error("The case response does not match the shared UI contract.");
  }
  return value;
}
export function useRelayCase() {
  const [snapshot, setSnapshot] = useState<CaseSnapshot>(() => makePreview());
  const [scene, setScene] = useState<PreviewScene>("reply");
  const [mode, setMode] = useState<"preview" | "live">("preview");
  const [liveId, setLiveId] = useState("");
  const [loadingLive, setLoadingLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const resumeStatus = useRef<CaseSnapshot["status"]>("waiting_for_reply");
  const pausedPoll = useRef(false);
  const eventIds = useRef(new Map<string, string>());
  function stableEvent(operation: string, body: unknown) {
    const key = JSON.stringify([operation, body]);
    if (!eventIds.current.has(key))
      eventIds.current.set(key, crypto.randomUUID());
    return eventIds.current.get(key)!;
  }
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(storageKey) || "null",
      ) as SavedPreview | null;
      if (saved?.snapshot) {
        setSnapshot(parseSnapshot(saved.snapshot));
        setScene(saved.scene);
        resumeStatus.current = saved.resumeStatus || "waiting_for_reply";
      }
      const connection = localStorage.getItem("relay-live-case-id");
      if (connection) {
        setLiveId(connection);
        setMode("live");
        setLoadingLive(true);
      }
    } catch {
      /* An invalid local preview can safely start fresh. */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (mode === "preview" && ready) {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            snapshot,
            scene,
            resumeStatus: resumeStatus.current,
          }),
        );
      } catch {
        /* Storage may be disabled; the current in-memory case remains usable. */
      }
    }
  }, [snapshot, scene, mode, ready]);
  useEffect(() => {
    if (mode !== "live" || !liveId) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        if (!pausedPoll.current) {
          const value = liveSnapshot(
            await jsonRequest(
              "/api/cases/" + encodeURIComponent(liveId),
              undefined,
              abort.signal,
            ),
          );
          if (!abort.signal.aborted && !pausedPoll.current) {
            setSnapshot((previous) =>
              previous.id !== value.id || value.version >= previous.version
                ? value
                : previous,
            );
            setError("");
            setLoadingLive(false);
          }
        }
      } catch (e) {
        if (!abort.signal.aborted) setError((e as Error).message);
      } finally {
        if (!abort.signal.aborted) timer = setTimeout(poll, 1000);
      }
    };
    void poll();
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [mode, liveId]);
  const selectScene = useCallback((next: PreviewScene) => {
    setMode("preview");
    setLiveId("");
    setLoadingLive(false);
    setScene(next);
    setSnapshot(makePreview(next));
    setError("");
    setNotice("");
    try {
      localStorage.removeItem("relay-live-case-id");
    } catch {
      /* Browser storage may be unavailable. */
    }
  }, []);
  const connect = async (
    id: string,
    request?: string,
    quoteArtifactId?: string,
  ) => {
    setBusy(true);
    setError("");
    try {
      let nextId = id.trim();
      if (!nextId) {
        const created = await jsonRequest("/api/cases", {
          eventId: stableEvent("create", [request, quoteArtifactId]),
          requestText: request || snapshot.title,
          quoteArtifactId:
            quoteArtifactId?.trim() || snapshot.facts.quoteArtifactId,
        });
        nextId = created.id || created.case?.id;
        if (!nextId) throw new Error("The agent did not return a case ID.");
      }
      const next = liveSnapshot(
        await jsonRequest("/api/cases/" + encodeURIComponent(nextId)),
      );
      setLiveId(nextId);
      setSnapshot(next);
      setMode("live");
      setNotice("");
      try {
        localStorage.setItem("relay-live-case-id", nextId);
      } catch {
        /* Current live connection still works. */
      }
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const mutate = async (path: string, body: Record<string, unknown>) => {
    const data = await jsonRequest(
      "/api/cases/" + encodeURIComponent(snapshot.id) + "/" + path,
      { expectedVersion: snapshot.version, ...body },
    );
    if (data.case || data.snapshot || data.stage)
      setSnapshot(liveSnapshot(data));
    else
      setSnapshot(
        liveSnapshot(
          await jsonRequest("/api/cases/" + encodeURIComponent(snapshot.id)),
        ),
      );
  };
  const action = async (
    kind: "reply" | "authorize" | "decline" | "pause" | "resume",
    text = "",
    reviewed?: { actionId: string; expectedVersion: number },
  ) => {
    setBusy(true);
    setError("");
    setNotice("");
    pausedPoll.current = true;
    try {
      if (mode === "live") {
        if (kind === "reply")
          await mutate("replies", {
            messageId: stableEvent("reply", [
              snapshot.id,
              snapshot.version,
              snapshot.pendingAction?.id,
              text,
            ]),
            clarificationId: snapshot.pendingAction?.id,
            text,
          });
        else if (kind === "authorize" || kind === "decline")
          await mutate("authorizations", {
            eventId: stableEvent("authorization", [
              snapshot.id,
              reviewed,
              kind,
            ]),
            actionId: reviewed?.actionId || snapshot.pendingAction?.id,
            expectedVersion: reviewed?.expectedVersion ?? snapshot.version,
            decision: kind === "authorize" ? "allow" : "decline",
          });
        else
          await mutate("control", {
            eventId: stableEvent("control", [
              snapshot.id,
              snapshot.version,
              kind,
            ]),
            action: kind,
          });
      } else {
        let next = { ...snapshot, version: snapshot.version + 1 };
        if (kind === "reply") {
          const review = makePreview("review");
          review.facts.costCenter = text.trim();
          if (review.pendingAction)
            review.pendingAction.payload.costCenter = text.trim();
          next = {
            ...review,
            version: next.version,
            events: [
              ...snapshot.events,
              {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                title: "Your reply was added",
                detail: text,
              },
            ],
          };
          setScene("review");
          setNotice(
            "Preview updated. No message was sent to a real coordinator.",
          );
        }
        if (kind === "authorize") {
          next = {
            ...next,
            stage: "execute",
            status: "running",
            pendingAction: null,
            currentTask: "Preview: the browser execution state.",
            blocker: null,
          };
          setScene("execution");
          setNotice(
            "Preview only. No browser action or draft creation was performed.",
          );
        }
        if (kind === "decline") {
          next = {
            ...next,
            status: "paused",
            currentTask: "Draft creation was declined.",
            blocker:
              "Your materials are still here. Resume when you are ready to review.",
          };
          resumeStatus.current = "waiting_for_authorization";
          setNotice("No draft was created.");
        }
        if (kind === "pause") {
          resumeStatus.current = snapshot.status;
          next.status = "paused";
        }
        if (kind === "resume") {
          next.status = resumeStatus.current;
          if (next.pendingAction?.type === "create_draft") {
            next.currentTask = "Your draft is ready for a final look.";
            next.blocker = null;
          }
        }
        if (next.pendingAction)
          next.pendingAction = {
            ...next.pendingAction,
            reviewedVersion: next.version,
          };
        setSnapshot(next);
      }
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
      pausedPoll.current = false;
    }
  };
  return {
    snapshot,
    scene,
    mode,
    ready,
    busy,
    error,
    notice,
    loadingLive,
    selectScene,
    connect,
    action,
    clearError: () => setError(""),
  };
}
