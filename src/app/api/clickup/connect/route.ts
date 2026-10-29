import { audit } from "@/lib/canvas/google";
import { ClickUpError, cu } from "@/lib/canvas/clickup";
import { DEFAULT_SETTINGS } from "@/lib/canvas/clickup-sync";
import { encrypt } from "@/lib/crypto";
import { fail, guard } from "../_auth";

/** Check a personal API token with ClickUp, then store it encrypted. The token is never sent back. */
export async function POST(request: Request) {
  const g = await guard(10);
  if ("denied" in g) return g.denied;
  const { supabase, userId } = g;
  const body = (await request.json().catch(() => ({}))) as { token?: unknown };
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!/^pk_[A-Za-z0-9_]{10,}$/.test(token)) {
    return Response.json({ error: "That doesn't look like a ClickUp personal API token (it starts with pk_)." }, { status: 400 });
  }
  try {
    const { user } = await cu<{ user: { id: number; username?: string; email?: string } }>(token, "/user");
    const { teams } = await cu<{ teams: { id: string; name: string }[] }>(token, "/team");
    const list = (teams ?? []).map((t) => ({ id: String(t.id), name: t.name }));
    const { error } = await supabase.from("canvas_clickup_accounts").upsert(
      {
        user_id: userId,
        token_enc: encrypt(token),
        clickup_user_id: user.id,
        clickup_username: user.username ?? null,
        clickup_email: user.email ?? null,
        teams: list,
        team_id: list.length === 1 ? list[0].id : null,
        settings: DEFAULT_SETTINGS,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    await audit(supabase, "clickup", "connect", "ok", { workspaces: list.length });
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof ClickUpError && e.status === 401) {
      return Response.json({ error: "ClickUp didn't accept that token. Copy it again from ClickUp → Settings → Apps → API Token." }, { status: 400 });
    }
    return fail(e);
  }
}
