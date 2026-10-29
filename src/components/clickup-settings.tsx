"use client";

import { ExternalLink, KeyRound, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SETTINGS, type ImportRule } from "@/lib/canvas/clickup-sync";
import { TASK_SECTION_TITLES } from "@/lib/canvas/sections";
import { clickUpApi, refreshClickUpStatus, runClickUpSync, useClickUpStatus } from "./clickup-client";
import { useCanvas } from "./provider";
import { ConflictLinks } from "./settings";
import { Card, Row, Toggle } from "./settings-ui";

type Space = { id: string; name: string; lists: { id: string; name: string }[] };

const RULES: { value: ImportRule; label: string }[] = [
  { value: "assigned_due", label: "Assigned to me and due today or earlier" },
  { value: "due", label: "Due today or earlier (anyone's)" },
  { value: "assigned", label: "Everything assigned to me" },
];

export function ClickUpCard() {
  const { mode, toast, sync } = useCanvas();
  const cu = useClickUpStatus();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [spaces, setSpaces] = useState<Space[] | null>(null);
  const s = { ...DEFAULT_SETTINGS, ...cu.settings };
  const { store, rev } = useCanvas();
  const conflicts = useMemo(() => store.all("canvas_task_links").some((l) => l.provider === "clickup" && l.state === "conflict" && !l.deleted_at), [store, rev]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cu.connected && cu.teamId) clickUpApi.hierarchy().then((r) => setSpaces(r.spaces)).catch(() => setSpaces([]));
  }, [cu.connected, cu.teamId]);

  if (mode !== "cloud") {
    return (
      <Card title="ClickUp" id="clickup">
        <p className="text-sm" style={{ color: "var(--dc-muted)" }}>
          ClickUp needs you signed in with cloud sync (this is a local-only dev session).
        </p>
      </Card>
    );
  }

  const save = async (body: Record<string, unknown>) => {
    try {
      await clickUpApi.saveSettings(body);
      await refreshClickUpStatus();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save");
    }
  };

  if (!cu.loaded) return null;

  if (!cu.connected) {
    return (
      <Card title="ClickUp" id="clickup">
        <p className="text-sm" style={{ color: "var(--dc-muted)" }}>
          Your ClickUp tasks for today show up in your planner, and ticking one off here completes it in ClickUp (and the other way round).
        </p>
        {cu.setupError ? (
          <p className="rounded-lg p-3 text-sm" style={{ background: "#fbf0dc", color: "#6b4a12" }}>
            {cu.setupError}
          </p>
        ) : (
          <>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>
                In ClickUp, click your avatar → <b>Settings</b> → <b>Apps</b>.
              </li>
              <li>
                Under <b>API Token</b>, click <b>Generate</b> (or <b>Copy</b>). It starts with <code>pk_</code>.
              </li>
              <li>Paste it below. It&apos;s stored encrypted on the server and never shown again.</li>
            </ol>
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await clickUpApi.connect(token.trim());
                  setToken("");
                  await refreshClickUpStatus();
                  toast("ClickUp connected");
                } catch (err) {
                  toast(err instanceof Error ? err.message : "Couldn't connect");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="relative min-w-60 flex-1">
                <span className="sr-only">ClickUp API token</span>
                <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--dc-muted)" }} />
                <input
                  className="dc-field w-full pl-9"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="pk_…"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
              </label>
              <button className="dc-btn dc-btn-primary" disabled={busy || !token.trim()}>
                {busy ? "Checking…" : "Connect ClickUp"}
              </button>
            </form>
          </>
        )}
      </Card>
    );
  }

  const listOptions = (spaces ?? []).flatMap((sp) => sp.lists.map((l) => ({ id: l.id, name: `${sp.name} › ${l.name}` })));
  const scopeValue = s.scope.type === "team" ? "team" : `${s.scope.type}:${s.scope.id}`;

  return (
    <Card title="ClickUp" id="clickup">
      <p className="text-sm">
        Connected as <b>{cu.username ?? cu.email ?? "you"}</b>
        {cu.teamId && cu.teams.length > 0 && <> · {cu.teams.find((t) => t.id === cu.teamId)?.name}</>}
      </p>

      {cu.teams.length > 1 && (
        <Row label="Workspace">
          <select className="dc-field w-auto" value={cu.teamId ?? ""} onChange={(e) => void save({ teamId: e.target.value })}>
            {!cu.teamId && <option value="">Choose a workspace…</option>}
            {cu.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Row>
      )}

      {cu.teamId && (
        <>
          <Row label="Bring ClickUp tasks into my planner" hint="Matching tasks appear on today's page. Checked every 5 minutes while the app is open.">
            <Toggle on={s.importEnabled} onChange={(v) => void save({ importEnabled: v })} label="Bring in ClickUp tasks" />
          </Row>
          {s.importEnabled && (
            <>
              <Row label="Which tasks">
                <select className="dc-field w-auto" value={s.rule} onChange={(e) => void save({ rule: e.target.value })}>
                  {RULES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </Row>
              <Row label="From">
                <select
                  className="dc-field w-auto max-w-72"
                  value={scopeValue}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "team") return void save({ scope: { type: "team" } });
                    const [type, id] = v.split(":");
                    const name = type === "space" ? spaces?.find((x) => x.id === id)?.name : listOptions.find((x) => x.id === id)?.name;
                    void save({ scope: { type, id, name } });
                  }}
                >
                  <option value="team">The whole workspace</option>
                  {s.scope.type !== "team" && !spaces && <option value={scopeValue}>{s.scope.name ?? "Loading…"}</option>}
                  {(spaces ?? []).map((sp) => (
                    <optgroup key={sp.id} label={sp.name}>
                      <option value={`space:${sp.id}`}>All of {sp.name}</option>
                      {sp.lists.map((l) => (
                        <option key={l.id} value={`list:${l.id}`}>
                          {l.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Row>
              <Row label="Put them in">
                <select className="dc-field w-auto" value={s.section} onChange={(e) => void save({ section: e.target.value })}>
                  {(["work", "must", "personal", "comms"] as const).map((k) => (
                    <option key={k} value={k}>
                      {TASK_SECTION_TITLES[k]}
                    </option>
                  ))}
                </select>
              </Row>
            </>
          )}
          <Row label="“Add to ClickUp” sends tasks to" hint="Turn on “Add to ClickUp” in any task's details to send it.">
            <select
              className="dc-field w-auto max-w-72"
              value={s.targetListId ?? ""}
              onChange={(e) => {
                const l = listOptions.find((x) => x.id === e.target.value);
                void save(l ? { targetListId: l.id, targetListName: l.name } : { targetListId: null });
              }}
            >
              <option value="">Choose a list…</option>
              {s.targetListId && !listOptions.some((l) => l.id === s.targetListId) && <option value={s.targetListId}>{s.targetListName ?? "Saved list"}</option>}
              {listOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Row>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="dc-btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const r = await runClickUpSync(sync);
                setBusy(false);
                if (!r) toast(cu.lastError ?? "ClickUp sync didn't finish. Try again in a minute.");
                else toast(`ClickUp: ${r.imported} brought in, ${r.exported} sent, ${r.updatedLocal + r.updatedRemote} updated${r.conflicts ? `, ${r.conflicts} need a look` : ""}`);
              }}
            >
              <RefreshCw size={15} className={busy ? "animate-spin" : ""} /> Sync ClickUp now
            </button>
            <a className="dc-btn" href="https://app.clickup.com" target="_blank" rel="noreferrer">
              <ExternalLink size={15} /> Open ClickUp
            </a>
          </div>
        </>
      )}

      {conflicts && <ConflictLinks provider="clickup" />}
      <ul className="space-y-0.5 text-xs" style={{ color: "var(--dc-muted)" }}>
        <li>Last synced: {cu.lastSync ? new Date(cu.lastSync).toLocaleString() : "not yet"}</li>
        {cu.lastError && <li style={{ color: "#a33" }}>Last problem: {cu.lastError}</li>}
        <li>Synced both ways: title, done / not done, due date. Notes are copied in once. Nothing is ever deleted on either side.</li>
      </ul>
      <button
        className="dc-btn self-start"
        onClick={async () => {
          if (!window.confirm("Disconnect ClickUp? Your planner keeps every task, including ones that came from ClickUp.")) return;
          await clickUpApi.disconnect().catch(() => {});
          await refreshClickUpStatus();
          toast("ClickUp disconnected");
        }}
      >
        Disconnect ClickUp
      </button>
    </Card>
  );
}
