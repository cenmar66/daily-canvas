import { requireOwner } from "@/lib/auth";
import { audit } from "@/lib/canvas/google";

/**
 * Forget the ClickUp token. Planner tasks (including ones that came from ClickUp) stay;
 * links are kept so reconnecting picks up where it left off. To revoke the token itself,
 * regenerate it in ClickUp → Settings → Apps.
 */
export async function POST() {
  const auth = await requireOwner();
  if ("denied" in auth) return auth.denied;
  await auth.supabase.from("canvas_clickup_accounts").delete().not("user_id", "is", null);
  await audit(auth.supabase, "clickup", "disconnect", "ok");
  return Response.json({ ok: true });
}
