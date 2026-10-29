import { cu, getClickUpAccount, tokenOf } from "@/lib/canvas/clickup";
import { fail, guard } from "../_auth";

type Named = { id: string; name: string };

/** Spaces and lists in the chosen workspace, for the "bring in from" and "send to" pickers. */
export async function GET() {
  const g = await guard(20);
  if ("denied" in g) return g.denied;
  try {
    const acc = await getClickUpAccount(g.supabase);
    if (!acc?.team_id) return Response.json({ spaces: [] });
    const token = tokenOf(acc);
    const { spaces } = await cu<{ spaces: Named[] }>(token, `/team/${encodeURIComponent(acc.team_id)}/space?archived=false`);
    const out = await Promise.all(
      (spaces ?? []).slice(0, 30).map(async (s) => {
        const [{ folders }, { lists }] = await Promise.all([
          cu<{ folders: (Named & { lists?: Named[] })[] }>(token, `/space/${encodeURIComponent(s.id)}/folder?archived=false`),
          cu<{ lists: Named[] }>(token, `/space/${encodeURIComponent(s.id)}/list?archived=false`),
        ]);
        return {
          id: String(s.id),
          name: s.name,
          lists: [
            ...(lists ?? []).map((l) => ({ id: String(l.id), name: l.name })),
            ...(folders ?? []).flatMap((f) => (f.lists ?? []).map((l) => ({ id: String(l.id), name: `${f.name} › ${l.name}` }))),
          ],
        };
      }),
    );
    return Response.json({ spaces: out });
  } catch (e) {
    return fail(e);
  }
}
