// Server-only ClickUp helpers. The personal API token is decrypted only here, used for
// one request at a time, and never returned to the browser.

import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/crypto";
import type { ClickUpSettings } from "./clickup-sync";

const API = "https://api.clickup.com/api/v2";

export class ClickUpError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

export interface ClickUpAccountRow {
  user_id: string;
  token_enc: string;
  clickup_user_id: number | null;
  clickup_username: string | null;
  clickup_email: string | null;
  teams: { id: string; name: string }[];
  team_id: string | null;
  settings: ClickUpSettings;
  last_sync: string | null;
  last_error: string | null;
}

/** One ClickUp API call. Errors come back as plain-language messages. */
export async function cu<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: token, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const text = await r.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    /* not JSON */
  }
  if (r.ok) return data as T;
  const code = typeof data.ECODE === "string" ? data.ECODE : undefined;
  const err = typeof data.err === "string" ? data.err : "";
  if (r.status === 429) throw new ClickUpError("ClickUp is busy (too many requests). It will try again shortly.", 429, code);
  if (r.status === 401 && code?.startsWith("OAUTH_"))
    throw new ClickUpError("ClickUp didn't accept the API token. Copy it again from ClickUp → Settings → Apps and reconnect.", 401, code);
  throw new ClickUpError(err || `ClickUp error ${r.status}`, r.status, code);
}

/** A task that no longer exists (or was moved somewhere the token can't see). */
export const isGone = (e: unknown) => e instanceof ClickUpError && (e.status === 404 || (!!e.code && e.code.startsWith("ITEM_")));

export async function getClickUpAccount(supabase: SupabaseClient): Promise<ClickUpAccountRow | null> {
  const { data } = await supabase.from("canvas_clickup_accounts").select("*").maybeSingle();
  return (data as ClickUpAccountRow | null) ?? null;
}

export const tokenOf = (acc: ClickUpAccountRow) => decrypt(acc.token_enc);

/** The table is missing until 0002_clickup.sql has been run. */
export function missingTable(message: string) {
  return /canvas_clickup_accounts|schema cache|does not exist/i.test(message)
    ? "ClickUp isn't set up in the database yet. In Supabase → SQL Editor, run supabase/migrations/0002_clickup.sql."
    : null;
}
