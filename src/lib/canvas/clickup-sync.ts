// ClickUp bridge: what to send, what to bring in, and how to compare (pure, unit-tested).
// Same rules as the Google Tasks bridge: change markers on both sides, never delete,
// edits on both sides become a conflict for the person to settle.
//
// Synced both ways for linked tasks: title, done / not done, due date (date only).
// Notes are copied once when a task is brought in, never sent back: ClickUp descriptions
// can hold formatting that plain planner notes would flatten.

import { localDateOf, zonedTimeToUtc } from "./dates";
import { decideWith, type Decision } from "./gtasks";
import type { ISODate, Task, TaskLink, TaskSection } from "./types";

export interface CUStatus {
  status: string;
  type: string; // "open" | "custom" | "done" | "closed"
  orderindex?: number | string;
  color?: string;
}

export interface CUTask {
  id: string;
  name: string;
  text_content?: string | null;
  description?: string | null;
  status: CUStatus;
  date_updated?: string | null;
  date_closed?: string | null;
  due_date?: string | null;
  url?: string;
  list?: { id: string; name?: string };
  assignees?: { id: number }[];
  archived?: boolean;
  parent?: string | null;
}

export type ImportRule = "assigned_due" | "assigned" | "due";
export type ImportScope = { type: "team" } | { type: "space"; id: string; name?: string } | { type: "list"; id: string; name?: string };

export interface ClickUpSettings {
  importEnabled?: boolean;
  rule?: ImportRule;
  scope?: ImportScope;
  section?: TaskSection;
  targetListId?: string | null;
  targetListName?: string | null;
}

export const DEFAULT_SETTINGS: Required<Pick<ClickUpSettings, "importEnabled" | "rule" | "scope" | "section">> = {
  importEnabled: true,
  rule: "assigned_due",
  scope: { type: "team" },
  section: "work",
};

export const IMPORT_SECTIONS: TaskSection[] = ["work", "must", "personal", "comms"];

export const isDoneStatus = (s: CUStatus | undefined) => s?.type === "closed" || s?.type === "done";

/** ClickUp keeps due dates as a moment in time; the planner keeps a date in your time zone. */
export function cuDueToDate(due: string | number | null | undefined, tz: string): ISODate | null {
  if (due === null || due === undefined || due === "") return null;
  const ms = Number(due);
  return Number.isFinite(ms) ? localDateOf(ms, tz) : null;
}

/** A planner date as a ClickUp due date: midday in your time zone, so it lands on the same day everywhere nearby. */
export function dateToCuDue(date: ISODate | null | undefined, tz: string): number | null {
  return date ? zonedTimeToUtc(date, "12:00", tz).getTime() : null;
}

const shapeLocal = (t: Task) => ({ title: t.title.trim(), done: t.status === "done", due: t.due_date ?? null });
const shapeRemote = (r: CUTask, tz: string) => ({ title: (r.name ?? "").trim(), done: isDoneStatus(r.status), due: cuDueToDate(r.due_date, tz) });

export function decideClickUp(link: TaskLink, task: Task, remote: CUTask | undefined, tz: string): Decision {
  const a = shapeLocal(task);
  const b = remote ? shapeRemote(remote, tz) : null;
  const matches = !!b && a.title === b.title && a.done === b.done && a.due === b.due;
  return decideWith(link, task, remote ? { updated: remote.date_updated ?? null, deleted: !!remote.archived } : undefined, matches);
}

/** The list's status that means "complete" (ClickUp's checkmark uses the closed one). */
export function closedStatus(statuses: CUStatus[]): CUStatus | undefined {
  return statuses.find((s) => s.type === "closed") ?? statuses.find((s) => s.type === "done");
}

/** The list's first "not started" status, used when a task is reopened. */
export function openStatus(statuses: CUStatus[]): CUStatus | undefined {
  const sorted = [...statuses].sort((x, y) => Number(x.orderindex ?? 0) - Number(y.orderindex ?? 0));
  return sorted.find((s) => s.type === "open") ?? sorted.find((s) => !isDoneStatus(s));
}

/** Body for updating a ClickUp task from ours. Only changes status when done-ness differs. */
export function toClickUp(task: Task, tz: string, statuses: CUStatus[], current?: CUStatus) {
  const body: { name: string; due_date: number | null; due_date_time: boolean; status?: string } = {
    name: task.title.slice(0, 1000),
    due_date: dateToCuDue(task.due_date, tz),
    due_date_time: false,
  };
  const wantDone = task.status === "done";
  if (wantDone !== isDoneStatus(current)) {
    const target = wantDone ? closedStatus(statuses) : openStatus(statuses);
    if (target) body.status = target.status;
  }
  return body;
}

/** Patch for our task from ClickUp's (status changes also need a ledger event). */
export function fromClickUp(r: CUTask, t: Task, tz: string, today: ISODate): Partial<Task> {
  const s = shapeRemote(r, tz);
  const patch: Partial<Task> = {};
  if (s.title && s.title !== t.title) patch.title = s.title;
  if (s.due !== (t.due_date ?? null)) patch.due_date = s.due;
  if (s.done && t.status !== "done") {
    patch.status = "done";
    patch.completed_at = r.date_closed ? new Date(Number(r.date_closed)).toISOString() : new Date().toISOString();
    patch.completed_on = today;
  } else if (!s.done && t.status === "done") {
    patch.status = "open";
    patch.completed_at = null;
    patch.completed_on = null;
  }
  return patch;
}

/** Should this ClickUp task appear in today's planner? */
export function wantsImport(r: CUTask, rule: ImportRule, me: number | null, today: ISODate, tz: string): boolean {
  if (r.archived || r.parent || isDoneStatus(r.status) || !r.name?.trim()) return false;
  const mine = me !== null && (r.assignees ?? []).some((a) => Number(a.id) === Number(me));
  const due = cuDueToDate(r.due_date, tz);
  const dueByToday = !!due && due <= today;
  if (rule === "assigned") return mine;
  if (rule === "due") return dueByToday;
  return mine && dueByToday;
}

/** Query for ClickUp's "tasks in a workspace" search, narrowed as far as the rule allows. */
export function importQuery(settings: ClickUpSettings, me: number | null, endOfTodayMs: number, page: number): URLSearchParams {
  const rule = settings.rule ?? DEFAULT_SETTINGS.rule;
  const q = new URLSearchParams({ page: String(page), include_closed: "false", subtasks: "false", order_by: "due_date" });
  if (rule !== "due" && me !== null) q.append("assignees[]", String(me));
  if (rule !== "assigned") q.set("due_date_lt", String(endOfTodayMs));
  const scope = settings.scope ?? DEFAULT_SETTINGS.scope;
  if (scope.type === "space") q.append("space_ids[]", scope.id);
  if (scope.type === "list") q.append("list_ids[]", scope.id);
  return q;
}

export const clickUpUrl = (taskId: string) => `https://app.clickup.com/t/${encodeURIComponent(taskId)}`;
