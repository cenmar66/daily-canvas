import { randomUUID } from "node:crypto";
import { addDays, localDateOf, zonedTimeToUtc } from "@/lib/canvas/dates";
import { cu, getClickUpAccount, isGone, tokenOf } from "@/lib/canvas/clickup";
import {
  DEFAULT_SETTINGS,
  closedStatus,
  dateToCuDue,
  decideClickUp,
  fromClickUp,
  importQuery,
  toClickUp,
  wantsImport,
  type CUStatus,
  type CUTask,
} from "@/lib/canvas/clickup-sync";
import { audit } from "@/lib/canvas/google";
import { placementId, stableId } from "@/lib/canvas/ids";
import type { Task, TaskLink } from "@/lib/canvas/types";
import { fail, guard } from "../_auth";

export const maxDuration = 60;

/**
 * Two-way sync between linked planner tasks and ClickUp, then bring in new ClickUp tasks
 * that match your rule. Nothing is ever deleted on either side; a task changed in both
 * places since the last sync is flagged for you to choose.
 */
export async function POST() {
  const g = await guard(12);
  if ("denied" in g) return g.denied;
  const { supabase, userId } = g;
  const acc = await getClickUpAccount(supabase).catch(() => null);
  if (!acc) return Response.json({ error: "Connect ClickUp first (Settings → ClickUp)." }, { status: 400 });
  if (!acc.team_id) return Response.json({ error: "Choose a ClickUp workspace first (Settings → ClickUp)." }, { status: 400 });

  const settings = { ...DEFAULT_SETTINGS, ...acc.settings };
  const { data: prefs } = await supabase.from("canvas_preferences").select("timezone").maybeSingle();
  const tz = (prefs?.timezone as string) ?? "UTC";
  const today = localDateOf(new Date(), tz);
  const endOfToday = zonedTimeToUtc(addDays(today, 1), "00:00", tz).getTime();
  const me = acc.clickup_user_id;
  const result = { exported: 0, imported: 0, updatedLocal: 0, updatedRemote: 0, conflicts: 0, errors: [] as string[] };

  try {
    const token = tokenOf(acc);

    // ClickUp tasks that match the rule (also used as a snapshot for linked tasks).
    const snapshot = new Map<string, CUTask>();
    if (settings.importEnabled) {
      for (let page = 0; page < 5; page++) {
        const q = importQuery(settings, me, endOfToday, page);
        const r = await cu<{ tasks: CUTask[]; last_page?: boolean }>(token, `/team/${encodeURIComponent(acc.team_id)}/task?${q}`);
        for (const t of r.tasks ?? []) snapshot.set(String(t.id), t);
        if (r.last_page !== false || (r.tasks ?? []).length < 100) break;
      }
    }

    const statusCache = new Map<string, CUStatus[]>();
    const statusesFor = async (listId: string | undefined) => {
      if (!listId) return [];
      if (!statusCache.has(listId)) {
        const l = await cu<{ statuses?: CUStatus[] }>(token, `/list/${encodeURIComponent(listId)}`);
        statusCache.set(listId, l.statuses ?? []);
      }
      return statusCache.get(listId)!;
    };

    const { data: linkRows } = await supabase.from("canvas_task_links").select("*").is("deleted_at", null).eq("provider", "clickup");
    const links = (linkRows ?? []) as TaskLink[];
    const ids = links.map((l) => l.task_id);
    const { data: taskRows } = ids.length ? await supabase.from("canvas_tasks").select("*").in("id", ids) : { data: [] };
    const tasks = new Map(((taskRows ?? []) as Task[]).map((t) => [t.id, t]));
    const now = () => new Date().toISOString();
    const updateLink = (id: string, patch: Partial<TaskLink>) => supabase.from("canvas_task_links").update(patch).eq("id", id);

    for (const link of links.slice(0, 80)) {
      const task = tasks.get(link.task_id);
      if (!task || task.deleted_at) continue;
      try {
        let remote: CUTask | undefined = link.external_id ? snapshot.get(link.external_id) : undefined;
        if (link.external_id && !remote) {
          try {
            remote = await cu<CUTask>(token, `/task/${encodeURIComponent(link.external_id)}`);
          } catch (e) {
            if (!isGone(e)) throw e;
          }
        }
        const d = decideClickUp(link, task, remote, tz);

        if (d.kind === "create") {
          const listId = settings.targetListId;
          if (!listId) {
            result.errors.push(`${task.title}: choose a ClickUp list for new tasks (Settings → ClickUp).`);
            continue;
          }
          let created = await cu<CUTask>(token, `/list/${encodeURIComponent(listId)}/task`, {
            method: "POST",
            body: JSON.stringify({
              name: task.title.slice(0, 1000),
              description: task.notes ? task.notes.slice(0, 8000) : undefined,
              due_date: dateToCuDue(task.due_date, tz),
              due_date_time: false,
              assignees: me ? [me] : [],
            }),
          });
          if (task.status === "done") {
            const closed = closedStatus(await statusesFor(listId));
            if (closed) created = await cu<CUTask>(token, `/task/${encodeURIComponent(created.id)}`, { method: "PUT", body: JSON.stringify({ status: closed.status }) });
          }
          await updateLink(link.id, { external_id: String(created.id), list_id: listId, remote_updated: created.date_updated ?? null, local_version_synced: task.version, state: "linked", conflict: null, last_synced_at: now() });
          result.exported++;
        } else if (d.kind === "push") {
          const statuses = await statusesFor(remote!.list?.id);
          const res = await cu<CUTask>(token, `/task/${encodeURIComponent(link.external_id!)}`, { method: "PUT", body: JSON.stringify(toClickUp(task, tz, statuses, remote!.status)) });
          await updateLink(link.id, { remote_updated: res.date_updated ?? null, local_version_synced: task.version, state: "linked", conflict: null, last_synced_at: now() });
          result.updatedRemote++;
        } else if (d.kind === "pull") {
          const patch = fromClickUp(remote!, task, tz, today);
          let version = task.version;
          if (Object.keys(patch).length) {
            const { data: row, error } = await supabase.from("canvas_tasks").update(patch).eq("id", task.id).select("version").single();
            if (error) throw new Error(error.message);
            version = row.version as number;
            if (patch.status) {
              await supabase.from("canvas_task_events").insert({ id: randomUUID(), task_id: task.id, kind: patch.status === "done" ? "completed" : "reopened", at: now(), local_date: today, data: { source: "clickup" } });
            }
          }
          await updateLink(link.id, { remote_updated: remote!.date_updated ?? null, local_version_synced: version, state: "linked", conflict: null, last_synced_at: now() });
          result.updatedLocal++;
        } else if (d.kind === "mark") {
          await updateLink(link.id, { remote_updated: remote!.date_updated ?? null, local_version_synced: task.version, state: "linked", conflict: null, last_synced_at: now() });
        } else if (d.kind === "conflict") {
          if (link.state !== "conflict") {
            const done = remote!.status?.type === "closed" || remote!.status?.type === "done";
            await updateLink(link.id, { state: "conflict", conflict: { remote: { title: remote!.name, status: done ? "completed" : "needsAction" } } });
          }
          result.conflicts++;
        } else if (d.kind === "broken") {
          if (link.state !== "broken") await updateLink(link.id, { state: "broken" });
        }
      } catch (e) {
        result.errors.push(`${task.title}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Bring in new matching tasks.
    if (settings.importEnabled) {
      const linked = new Set(links.map((l) => l.external_id).filter(Boolean));
      for (const r of snapshot.values()) {
        if (linked.has(String(r.id)) || !wantsImport(r, settings.rule, me, today, tz)) continue;
        // Deterministic ids: bringing in the same ClickUp task twice can't make two tasks.
        const taskId = stableId("clickup", userId, String(r.id));
        const { data: existing } = await supabase.from("canvas_tasks").select("id").eq("id", taskId).maybeSingle();
        if (existing) continue;
        const due = r.due_date ? localDateOf(Number(r.due_date), tz) : null;
        const { data: row, error } = await supabase
          .from("canvas_tasks")
          .insert({ id: taskId, section: settings.section, title: r.name.trim().slice(0, 1000), notes: (r.text_content ?? "").slice(0, 8000), due_date: due, origin_date: today, source: "clickup" })
          .select("version")
          .single();
        if (error) {
          result.errors.push(`Bring in "${r.name}": ${error.message}`);
          continue;
        }
        await supabase.from("canvas_task_placements").insert({ id: placementId(taskId, today), task_id: taskId, date: today, section: settings.section, position: 950 + result.imported });
        await supabase.from("canvas_task_events").insert({ id: stableId("created", taskId), task_id: taskId, kind: "created", at: now(), local_date: today, data: { source: "clickup" } });
        await supabase.from("canvas_task_links").insert({
          id: stableId("link", "clickup", taskId),
          task_id: taskId,
          provider: "clickup",
          list_id: r.list?.id ?? null,
          external_id: String(r.id),
          remote_updated: r.date_updated ?? null,
          local_version_synced: row.version,
          state: "linked",
          last_synced_at: now(),
        });
        result.imported++;
      }
    }

    await supabase.from("canvas_clickup_accounts").update({ last_sync: now(), last_error: result.errors[0] ?? null }).eq("user_id", userId);
    await audit(supabase, "clickup", "sync", result.errors.length ? "error" : "ok", { ...result, message: result.errors[0] });
    return Response.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase.from("canvas_clickup_accounts").update({ last_error: message }).eq("user_id", userId);
    await audit(supabase, "clickup", "sync", "error", { message });
    return fail(e);
  }
}
