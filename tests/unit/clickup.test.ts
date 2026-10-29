import { describe, expect, it } from "vitest";
import { closedStatus, cuDueToDate, dateToCuDue, decideClickUp, fromClickUp, importQuery, openStatus, toClickUp, wantsImport, type CUStatus, type CUTask } from "@/lib/canvas/clickup-sync";
import type { TaskLink } from "@/lib/canvas/types";
import { task } from "./fixtures";

const TZ = "America/Los_Angeles";
const TODAY = "2026-10-29";
const ms = (iso: string) => String(new Date(iso).getTime());

const statuses: CUStatus[] = [
  { status: "complete", type: "closed", orderindex: 3 },
  { status: "in progress", type: "custom", orderindex: 1 },
  { status: "to do", type: "open", orderindex: 0 },
];

const remote = (over: Partial<CUTask> = {}): CUTask => ({
  id: "cu1",
  name: "Call the adjuster",
  status: { status: "to do", type: "open" },
  date_updated: "1000",
  due_date: ms("2026-10-29T19:00:00Z"),
  list: { id: "L1" },
  assignees: [{ id: 42 }],
  ...over,
});

const link = (over: Partial<TaskLink> = {}): TaskLink => ({
  id: "l",
  task_id: "t",
  provider: "clickup",
  list_id: "L1",
  external_id: "cu1",
  remote_etag: null,
  remote_updated: "1000",
  local_version_synced: 3,
  state: "linked",
  conflict: null,
  last_synced_at: null,
  created_at: "",
  updated_at: "",
  version: 1,
  deleted_at: null,
  ...over,
});

describe("ClickUp dates", () => {
  it("reads a ClickUp due moment as a date in your time zone", () => {
    expect(cuDueToDate(ms("2026-10-30T03:00:00Z"), TZ)).toBe("2026-10-29"); // 8pm Pacific
    expect(cuDueToDate(null, TZ)).toBeNull();
  });
  it("sends a planner date as midday that day, which reads back as the same date", () => {
    const due = dateToCuDue("2026-11-02", TZ)!;
    expect(cuDueToDate(due, TZ)).toBe("2026-11-02");
    expect(dateToCuDue(null, TZ)).toBeNull();
  });
});

describe("ClickUp sync decisions", () => {
  const t = task("t", { title: "Call the adjuster", version: 3, due_date: "2026-10-29" });

  it("creates when not yet sent; nothing to do when nothing changed", () => {
    expect(decideClickUp(link({ external_id: null }), t, undefined, TZ).kind).toBe("create");
    expect(decideClickUp(link(), t, remote(), TZ).kind).toBe("none");
  });
  it("sends a check-off made here; brings in one made in ClickUp", () => {
    expect(decideClickUp(link(), { ...t, version: 4, status: "done" }, remote(), TZ).kind).toBe("push");
    expect(decideClickUp(link(), t, remote({ status: { status: "complete", type: "closed" }, date_updated: "2000" }), TZ).kind).toBe("pull");
  });
  it("flags a real clash, but not when both sides agree", () => {
    expect(decideClickUp(link(), { ...t, version: 4, title: "Call adjuster today" }, remote({ name: "Call adjuster ASAP", date_updated: "2000" }), TZ).kind).toBe("conflict");
    expect(decideClickUp(link(), { ...t, version: 4, status: "done" }, remote({ status: { status: "complete", type: "closed" }, date_updated: "2000" }), TZ).kind).toBe("mark");
  });
  it("never deletes: a task gone or archived in ClickUp just marks the link broken", () => {
    expect(decideClickUp(link(), t, undefined, TZ).kind).toBe("broken");
    expect(decideClickUp(link(), t, remote({ archived: true }), TZ).kind).toBe("broken");
  });
});

describe("ClickUp statuses", () => {
  it("completes with the closed status and reopens to the first open one", () => {
    expect(closedStatus(statuses)?.status).toBe("complete");
    expect(openStatus(statuses)?.status).toBe("to do");
  });
  it("only changes status when done-ness differs", () => {
    const done = task("t", { title: "X", status: "done" });
    expect(toClickUp(done, TZ, statuses, { status: "to do", type: "open" }).status).toBe("complete");
    expect(toClickUp(done, TZ, statuses, { status: "complete", type: "closed" }).status).toBeUndefined();
    const open = task("t", { title: "X", status: "open" });
    expect(toClickUp(open, TZ, statuses, { status: "in progress", type: "custom" }).status).toBeUndefined();
    expect(toClickUp(open, TZ, statuses, { status: "complete", type: "closed" }).status).toBe("to do");
  });
  it("pulls a completion with its date and reopening clears it", () => {
    const t = task("t", { title: "Call the adjuster", due_date: "2026-10-29" });
    const p = fromClickUp(remote({ status: { status: "complete", type: "closed" }, date_closed: ms("2026-10-29T18:00:00Z") }), t, TZ, TODAY);
    expect(p).toMatchObject({ status: "done", completed_on: TODAY, completed_at: "2026-10-29T18:00:00.000Z" });
    expect(fromClickUp(remote(), { ...t, status: "done" }, TZ, TODAY)).toMatchObject({ status: "open", completed_at: null });
  });
});

describe("Bringing ClickUp tasks in", () => {
  it("default rule: assigned to me and due today or earlier", () => {
    expect(wantsImport(remote(), "assigned_due", 42, TODAY, TZ)).toBe(true);
    expect(wantsImport(remote({ due_date: ms("2026-11-05T19:00:00Z") }), "assigned_due", 42, TODAY, TZ)).toBe(false);
    expect(wantsImport(remote({ assignees: [{ id: 7 }] }), "assigned_due", 42, TODAY, TZ)).toBe(false);
    expect(wantsImport(remote({ due_date: ms("2026-10-20T19:00:00Z") }), "assigned_due", 42, TODAY, TZ)).toBe(true); // overdue
  });
  it("other rules, and never closed, archived or subtasks", () => {
    expect(wantsImport(remote({ due_date: null }), "assigned", 42, TODAY, TZ)).toBe(true);
    expect(wantsImport(remote({ assignees: [] }), "due", 42, TODAY, TZ)).toBe(true);
    expect(wantsImport(remote({ status: { status: "complete", type: "closed" } }), "assigned", 42, TODAY, TZ)).toBe(false);
    expect(wantsImport(remote({ archived: true }), "assigned", 42, TODAY, TZ)).toBe(false);
    expect(wantsImport(remote({ parent: "p" }), "assigned", 42, TODAY, TZ)).toBe(false);
  });
  it("narrows the ClickUp search to the rule and scope", () => {
    const q = importQuery({ rule: "assigned_due", scope: { type: "list", id: "L9" } }, 42, 123, 0);
    expect(q.getAll("assignees[]")).toEqual(["42"]);
    expect(q.get("due_date_lt")).toBe("123");
    expect(q.getAll("list_ids[]")).toEqual(["L9"]);
    expect(q.get("include_closed")).toBe("false");
    const all = importQuery({ rule: "assigned", scope: { type: "team" } }, 42, 123, 2);
    expect(all.get("due_date_lt")).toBeNull();
    expect(all.get("page")).toBe("2");
  });
});
