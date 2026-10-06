import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { formationSlots, type Pos } from "./formations";
import { simulateMatch, type SimPlayer } from "./sim";

type DB = SupabaseClient<Database>;
type PlayerRow = Database["public"]["Tables"]["players"]["Row"];

function pickXI(players: PlayerRow[], formation: string, lineup: Record<string, string>): SimPlayer[] {
  const eligible = players.filter((p) => p.suspended_matches <= 0);
  const byId = new Map(eligible.map((p) => [p.id, p]));
  const chosen: PlayerRow[] = [];
  const used = new Set<string>();
  const slots = formationSlots(formation);
  for (const s of slots) {
    const id = lineup[String(s.index)];
    const p = id ? byId.get(id) : undefined;
    if (p && !used.has(p.id)) {
      chosen.push(p);
      used.add(p.id);
    }
  }
  // auto-fill missing slots by role then rating
  for (const s of slots) {
    if (chosen.length >= 11) break;
    const filled = slots.filter((x) => lineup[String(x.index)] && byId.has(lineup[String(x.index)]!)).length;
    if (filled >= 11) break;
  }
  const remainingRoles: Pos[] = slots
    .filter((s) => {
      const id = lineup[String(s.index)];
      return !(id && byId.has(id));
    })
    .map((s) => s.role);
  for (const role of remainingRoles) {
    const cand =
      eligible.filter((p) => !used.has(p.id) && p.position === role).sort((a, b) => b.rating - a.rating)[0] ??
      eligible.filter((p) => !used.has(p.id)).sort((a, b) => b.rating - a.rating)[0];
    if (cand) {
      chosen.push(cand);
      used.add(cand.id);
    }
  }
  return chosen.slice(0, 11).map((p) => ({ id: p.id, name: p.name, position: p.position as Pos, rating: p.rating }));
}

export async function runMatch(admin: DB, matchId: string) {
  const { data: match, error } = await admin.from("matches").select("*").eq("id", matchId).single();
  if (error || !match) throw new Error("המשחק לא נמצא");
  if (match.status === "finished") return;

  const [{ data: teams }, { data: players }] = await Promise.all([
    admin.from("teams").select("*").in("id", [match.home_team_id, match.away_team_id]),
    admin.from("players").select("*").in("team_id", [match.home_team_id, match.away_team_id]),
  ]);
  const home = teams?.find((t) => t.id === match.home_team_id);
  const away = teams?.find((t) => t.id === match.away_team_id);
  if (!home || !away) throw new Error("קבוצה חסרה");
  const hp = (players ?? []).filter((p) => p.team_id === home.id);
  const ap = (players ?? []).filter((p) => p.team_id === away.id);

  const homeXI = pickXI(hp, home.formation, (home.lineup ?? {}) as Record<string, string>);
  const awayXI = pickXI(ap, away.formation, (away.lineup ?? {}) as Record<string, string>);
  const { events, score, stats } = simulateMatch(homeXI, awayXI);

  // Lock the match first (idempotency guard)
  const { data: locked } = await admin
    .from("matches")
    .update({
      status: "finished",
      home_ready: true,
      away_ready: true,
      home_score: score[0],
      away_score: score[1],
      started_at: new Date().toISOString(),
      events: events as unknown as Json,
      stats: stats as unknown as Json,
    })
    .eq("id", matchId)
    .eq("status", "scheduled")
    .select("id");
  if (!locked?.length) return;

  // Player stat & suspension updates
  const all = [...hp, ...ap];
  for (const p of all) {
    const g = events.filter((e) => e.type === "goal" && e.playerId === p.id).length;
    const a = events.filter((e) => e.type === "goal" && e.assistId === p.id).length;
    const y = events.filter((e) => e.type === "yellow" && e.playerId === p.id).length;
    const r = events.filter((e) => e.type === "red" && e.playerId === p.id).length;
    let susp = p.suspended_matches > 0 ? p.suspended_matches - 1 : 0; // served this match
    const newYellows = p.yellow_cards + y;
    if (r > 0) susp += 1;
    if (Math.floor(newYellows / 5) > Math.floor(p.yellow_cards / 5)) susp += 1;
    if (g || a || y || r || susp !== p.suspended_matches) {
      await admin
        .from("players")
        .update({
          goals: p.goals + g,
          assists: p.assists + a,
          yellow_cards: newYellows,
          red_cards: p.red_cards + r,
          suspended_matches: susp,
        })
        .eq("id", p.id);
    }
  }
  // Remove newly suspended players from saved lineups
  for (const t of [home, away]) {
    const lineup = { ...((t.lineup ?? {}) as Record<string, string>) };
    const { data: susp } = await admin.from("players").select("id").eq("team_id", t.id).gt("suspended_matches", 0);
    const bad = new Set((susp ?? []).map((s) => s.id));
    let changed = false;
    for (const k of Object.keys(lineup)) if (bad.has(lineup[k]!)) { delete lineup[k]; changed = true; }
    if (changed) await admin.from("teams").update({ lineup }).eq("id", t.id);
  }

  // Round completion
  const { count } = await admin
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("round_id", match.round_id ?? "")
    .neq("status", "finished");
  if (match.round_id && (count ?? 0) === 0) await admin.from("rounds").update({ status: "completed" }).eq("id", match.round_id);
}
