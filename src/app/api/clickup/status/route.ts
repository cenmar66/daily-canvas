import { requireOwner } from "@/lib/auth";
import { getClickUpAccount, missingTable } from "@/lib/canvas/clickup";
import { DEFAULT_SETTINGS } from "@/lib/canvas/clickup-sync";

export async function GET() {
  const auth = await requireOwner();
  if ("denied" in auth) return auth.denied;
  let setupError: string | null = null;
  const { error } = await auth.supabase.from("canvas_clickup_accounts").select("user_id").limit(1);
  if (error) setupError = missingTable(error.message) ?? error.message;
  const acc = setupError ? null : await getClickUpAccount(auth.supabase);
  return Response.json(
    {
      ready: !setupError && !!process.env.ENCRYPTION_KEY,
      setupError: setupError ?? (process.env.ENCRYPTION_KEY ? null : "ENCRYPTION_KEY isn't set in Vercel."),
      connected: !!acc,
      username: acc?.clickup_username ?? null,
      email: acc?.clickup_email ?? null,
      teams: acc?.teams ?? [],
      teamId: acc?.team_id ?? null,
      settings: { ...DEFAULT_SETTINGS, ...(acc?.settings ?? {}) },
      lastSync: acc?.last_sync ?? null,
      lastError: acc?.last_error ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
