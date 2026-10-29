"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { ClickUpSettings } from "@/lib/canvas/clickup-sync";
import { useCanvas } from "./provider";

export interface ClickUpStatus {
  loaded: boolean;
  ready: boolean; // database table + ENCRYPTION_KEY in place
  setupError: string | null;
  connected: boolean;
  username: string | null;
  email: string | null;
  teams: { id: string; name: string }[];
  teamId: string | null;
  settings: ClickUpSettings;
  lastSync: string | null;
  lastError: string | null;
}

export interface ClickUpSyncResult {
  exported: number;
  imported: number;
  updatedLocal: number;
  updatedRemote: number;
  conflicts: number;
  errors: string[];
}

const EMPTY: ClickUpStatus = { loaded: false, ready: false, setupError: null, connected: false, username: null, email: null, teams: [], teamId: null, settings: {}, lastSync: null, lastError: null };

let status: ClickUpStatus = EMPTY;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

export async function refreshClickUpStatus() {
  inflight ??= (async () => {
    try {
      const r = await fetch("/api/clickup/status", { cache: "no-store" });
      status = r.ok ? { ...EMPTY, ...(await r.json()), loaded: true } : { ...status, loaded: true };
    } catch {
      status = { ...status, loaded: true };
    } finally {
      inflight = null;
      listeners.forEach((l) => l());
    }
  })();
  return inflight;
}

export function useClickUpStatus(): ClickUpStatus {
  const { mode } = useCanvas();
  const s = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => status,
    () => status,
  );
  useEffect(() => {
    if (mode === "cloud" && !status.loaded && navigator.onLine) void refreshClickUpStatus();
  }, [mode]);
  return mode === "cloud" ? s : { ...EMPTY, loaded: true };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error ?? `Request failed (${r.status})`);
  return body as T;
}

export const clickUpApi = {
  connect: (token: string) => api<{ ok: true }>("/api/clickup/connect", { method: "POST", body: JSON.stringify({ token }) }),
  saveSettings: (body: Record<string, unknown>) => api<{ ok: true }>("/api/clickup/settings", { method: "POST", body: JSON.stringify(body) }),
  hierarchy: () => api<{ spaces: { id: string; name: string; lists: { id: string; name: string }[] }[] }>("/api/clickup/hierarchy"),
  sync: () => api<ClickUpSyncResult>("/api/clickup/sync", { method: "POST" }),
  disconnect: () => api<{ ok: true }>("/api/clickup/disconnect", { method: "POST" }),
};

let running: Promise<ClickUpSyncResult | null> | null = null;

/** Send local changes up, sync with ClickUp on the server, then pull the results down. */
export function runClickUpSync(sync: { syncNow: () => Promise<void> }): Promise<ClickUpSyncResult | null> {
  running ??= (async () => {
    try {
      await sync.syncNow();
      const r = await clickUpApi.sync();
      if (r.imported || r.updatedLocal || r.exported || r.updatedRemote) await sync.syncNow();
      return r;
    } catch {
      return null;
    } finally {
      running = null;
      void refreshClickUpStatus();
    }
  })();
  return running;
}

/**
 * Keeps ClickUp in step without anyone pressing a button: on opening the app, every
 * 5 minutes while it's in view, and a few seconds after a ClickUp-linked task changes.
 */
export function ClickUpAutoSync() {
  const { mode, store, rev, sync } = useCanvas();
  const cu = useClickUpStatus();
  const active = mode === "cloud" && cu.connected && !!cu.teamId;
  const signatures = useRef<Map<string, string> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) return;
    const run = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void runClickUpSync(sync);
    };
    const first = setTimeout(run, 3_000);
    const every = setInterval(run, 5 * 60_000);
    const onShow = () => document.visibilityState === "visible" && run();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [active, sync]);

  // A linked task was ticked, renamed or re-dated here: send it soon.
  useEffect(() => {
    if (!active) return;
    const next = new Map<string, string>();
    for (const l of store.all("canvas_task_links")) {
      if (l.provider !== "clickup" || l.deleted_at) continue;
      const t = store.get("canvas_tasks", l.task_id);
      if (t) next.set(l.id, `${t.title}|${t.status}|${t.due_date ?? ""}|${l.state}|${l.external_id ?? ""}`);
    }
    const prev = signatures.current;
    signatures.current = next;
    if (!prev) return;
    // New links that arrive already linked were brought in by a sync: nothing to send.
    const changed = [...next].some(([id, sig]) => (prev.has(id) ? prev.get(id) !== sig : !sig.includes("|linked|")));
    if (!changed) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => navigator.onLine && void runClickUpSync(sync), 4_000);
  }, [active, rev, store, sync]);

  return null;
}
