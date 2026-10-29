import { requireOwner } from "@/lib/auth";
import { ClickUpError, missingTable } from "@/lib/canvas/clickup";
import { rateLimited } from "@/lib/canvas/google";

/** Signed-in owner + a light rate limit. */
export async function guard(limit = 30) {
  const auth = await requireOwner();
  if ("denied" in auth) return auth;
  const { data } = await auth.supabase.auth.getClaims();
  const userId = data?.claims?.sub as string;
  if (rateLimited(`cu:${userId}`, limit)) return { denied: Response.json({ error: "Too many requests. Try again in a minute." }, { status: 429 }) };
  if (!process.env.ENCRYPTION_KEY) return { denied: Response.json({ error: "ENCRYPTION_KEY isn't set in Vercel, so the ClickUp token can't be stored safely." }, { status: 503 }) };
  return { supabase: auth.supabase, userId };
}

export function fail(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  const status = e instanceof ClickUpError ? (e.status === 401 ? 400 : e.status === 429 ? 429 : 502) : 500;
  return Response.json({ error: missingTable(message) ?? message }, { status });
}
