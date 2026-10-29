import { getClickUpAccount } from "@/lib/canvas/clickup";
import { DEFAULT_SETTINGS, IMPORT_SECTIONS, type ClickUpSettings, type ImportRule, type ImportScope } from "@/lib/canvas/clickup-sync";
import type { TaskSection } from "@/lib/canvas/types";
import { fail, guard } from "../_auth";

const RULES: ImportRule[] = ["assigned_due", "assigned", "due"];
const str = (v: unknown, max = 200) => (typeof v === "string" && v.length <= max ? v : undefined);

/** Save the workspace and import choices. Unknown or malformed values are ignored. */
export async function POST(request: Request) {
  const g = await guard();
  if ("denied" in g) return g.denied;
  const { supabase, userId } = g;
  try {
    const acc = await getClickUpAccount(supabase);
    if (!acc) return Response.json({ error: "Connect ClickUp first." }, { status: 400 });
    const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const next: ClickUpSettings = { ...DEFAULT_SETTINGS, ...acc.settings };
    const patch: Record<string, unknown> = {};

    const teamId = str(b.teamId);
    if (teamId && acc.teams.some((t) => t.id === teamId) && teamId !== acc.team_id) {
      patch.team_id = teamId;
      // A new workspace: earlier space/list choices no longer apply.
      next.scope = { type: "team" };
      next.targetListId = null;
      next.targetListName = null;
    }
    if (typeof b.importEnabled === "boolean") next.importEnabled = b.importEnabled;
    if (RULES.includes(b.rule as ImportRule)) next.rule = b.rule as ImportRule;
    if (IMPORT_SECTIONS.includes(b.section as TaskSection)) next.section = b.section as TaskSection;
    const scope = b.scope as Partial<ImportScope> | undefined;
    if (scope && typeof scope === "object") {
      if (scope.type === "team") next.scope = { type: "team" };
      else if ((scope.type === "space" || scope.type === "list") && str(scope.id)) next.scope = { type: scope.type, id: scope.id!, name: str(scope.name) };
    }
    if (b.targetListId === null) {
      next.targetListId = null;
      next.targetListName = null;
    } else if (str(b.targetListId)) {
      next.targetListId = str(b.targetListId)!;
      next.targetListName = str(b.targetListName) ?? null;
    }
    patch.settings = next;
    patch.updated_at = new Date().toISOString();
    const { error } = await supabase.from("canvas_clickup_accounts").update(patch).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
