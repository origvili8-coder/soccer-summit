import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { DETAIL_GROUP, formationSlots, positionFit, type Detail } from "./formations";
import { simulateMatch, type MatchEvent, type MatchStats, type Side, type SimPlayer } from "./sim";
import { publishNews } from "./news.server";

type DB = SupabaseClient<Database>;
type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
export type XIEntry = { id: string; pos: Detail };
type Applied = Record<string, { g: number; a: number; y: number; r: number; s: number }>;
export type MatchExtra = {
  xi: Record<Side, XIEntry[]>;
  bench: Record<Side, string[]>;
  subs: Record<Side, number>;
  applied: Applied;
};
export const MAX_SUBS = 3;

function pickXI(players: PlayerRow[], formation: string, lineup: Record<string, string>): XIEntry[] {
  const eligible = players.filter((p) => p.suspended_matches <= 0);
  const byId = new Map(eligible.map((p) => [p.id, p]));
  const used = new Set<string>();
  const slots = formationSlots(formation);
  const xi: (XIEntry | null)[] = slots.map((s) => {
    const id = lineup[String(s.index)];
    if (id && byId.has(id) && !used.has(id)) { used.add(id); return { id, pos: s.pos }; }
    return null;
  });
  slots.forEach((s, i) => {
    if (xi[i]) return;
    const cand = eligible
      .filter((p) => !used.has(p.id))
      .sort((a, b) => b.rating * positionFit(b.detailed_position, s.pos) - a.rating * positionFit(a.detailed_position, s.pos))[0];
    if (cand) { used.add(cand.id); xi[i] = { id: cand.id, pos: s.pos }; }
  });
  return xi.filter((x): x is XIEntry => !!x);
}

function pickBench(players: PlayerRow[], team: TeamRow, xi: XIEntry[]): string[] {
  const inXI = new Set(xi.map((x) => x.id));
  const ok = (p: PlayerRow) => p.suspended_matches <= 0 && !inXI.has(p.id);
  const saved = ((team.bench ?? []) as string[]).filter((id) => players.some((p) => p.id === id && ok(p)));
  if (saved.length) return saved.slice(0, 5);
  return players.filter(ok).sort((a, b) => b.rating - a.rating).slice(0, 5).map((p) => p.id);
}

function toSim(xi: XIEntry[], byId: Map<string, PlayerRow>): SimPlayer[] {
  return xi.flatMap((x) => {
    const p = byId.get(x.id);
    if (!p) return [];
    return [{ id: p.id, name: p.name, position: DETAIL_GROUP[x.pos], rating: Math.round(p.rating * positionFit(p.detailed_position, x.pos)) }];
  });
}

/** Players on the pitch at the end of `uptoMinute` (after reds and subs). */
export function onPitch(extra: MatchExtra, events: MatchEvent[], side: Side, uptoMinute: number): XIEntry[] {
  let xi = [...extra.xi[side]];
  for (const e of events) {
    if (e.minute > uptoMinute || e.side !== side) continue;
    if (e.type === "red") xi = xi.filter((x) => x.id !== e.playerId);
    if (e.type === "sub") xi = xi.map((x) => (x.id === e.outId ? { id: e.playerId!, pos: x.pos } : x));
  }
  return xi;
}

async function applyPlayerStats(admin: DB, all: PlayerRow[], events: MatchEvent[], prev: Applied, firstRun: boolean): Promise<Applied> {
  const next: Applied = {};
  for (const p of all) {
    const g = events.filter((e) => e.type === "goal" && e.playerId === p.id).length;
    const a = events.filter((e) => e.type === "goal" && e.assistId === p.id).length;
    const y = events.filter((e) => e.type === "yellow" && e.playerId === p.id).length;
    const r = events.filter((e) => e.type === "red" && e.playerId === p.id).length;
    const old = prev[p.id] ?? { g: 0, a: 0, y: 0, r: 0, s: 0 };
    // Base values before this match's contribution
    const baseY = p.yellow_cards - old.y;
    let baseSusp = p.suspended_matches - old.s;
    if (firstRun && baseSusp > 0) baseSusp -= 1; // suspension served by missing this match
    const newY = baseY + y;
    let s = 0;
    if (r > 0) s += 1;
    if (Math.floor(newY / 5) > Math.floor(baseY / 5)) s += 1;
    next[p.id] = { g, a, y, r, s };
    const susp = baseSusp + s;
    if (g !== old.g || a !== old.a || y !== old.y || r !== old.r || susp !== p.suspended_matches) {
      await admin
        .from("players")
        .update({
          goals: p.goals - old.g + g,
          assists: p.assists - old.a + a,
          yellow_cards: newY,
          red_cards: p.red_cards - old.r + r,
          suspended_matches: susp,
        })
        .eq("id", p.id);
    }
  }
  return next;
}

async function cleanLineups(admin: DB, teams: TeamRow[]) {
  for (const t of teams) {
    const lineup = { ...((t.lineup ?? {}) as Record<string, string>) };
    const { data: susp } = await admin.from("players").select("id").eq("team_id", t.id).gt("suspended_matches", 0);
    const bad = new Set((susp ?? []).map((s) => s.id));
    let changed = false;
    for (const k of Object.keys(lineup)) if (bad.has(lineup[k]!)) { delete lineup[k]; changed = true; }
    const bench = ((t.bench ?? []) as string[]).filter((id) => !bad.has(id));
    if (changed || bench.length !== ((t.bench ?? []) as string[]).length) await admin.from("teams").update({ lineup, bench }).eq("id", t.id);
  }
}

async function loadSides(admin: DB, homeId: string, awayId: string) {
  const [{ data: teams }, { data: players }] = await Promise.all([
    admin.from("teams").select("*").in("id", [homeId, awayId]),
    admin.from("players").select("*").in("team_id", [homeId, awayId]),
  ]);
  const home = teams?.find((t) => t.id === homeId);
  const away = teams?.find((t) => t.id === awayId);
  if (!home || !away) throw new Error("קבוצה חסרה");
  return { home, away, players: players ?? [] };
}

const avg = (xs: SimPlayer[]) => (xs.length ? xs.reduce((s, p) => s + p.rating, 0) / xs.length : 0);

export async function runMatch(admin: DB, matchId: string) {
  const { data: match, error } = await admin.from("matches").select("*").eq("id", matchId).single();
  if (error || !match) throw new Error("המשחק לא נמצא");
  if (match.status === "finished") return;
  const { home, away, players } = await loadSides(admin, match.home_team_id, match.away_team_id);
  const byId = new Map(players.map((p) => [p.id, p]));
  const hp = players.filter((p) => p.team_id === home.id);
  const ap = players.filter((p) => p.team_id === away.id);
  const hXI = pickXI(hp, home.formation, (home.lineup ?? {}) as Record<string, string>);
  const aXI = pickXI(ap, away.formation, (away.lineup ?? {}) as Record<string, string>);
  const homeSim = toSim(hXI, byId);
  const awaySim = toSim(aXI, byId);
  const { events, score, stats } = simulateMatch(homeSim, awaySim);
  const extra: MatchExtra = {
    xi: { home: hXI, away: aXI },
    bench: { home: pickBench(hp, home, hXI), away: pickBench(ap, away, aXI) },
    subs: { home: 0, away: 0 },
    applied: {},
  };

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
      stats: { ...stats, ...extra } as unknown as Json,
    })
    .eq("id", matchId)
    .eq("status", "scheduled")
    .select("id");
  if (!locked?.length) return;

  extra.applied = await applyPlayerStats(admin, [...hp, ...ap], events, {}, true);
  await admin.from("matches").update({ stats: { ...stats, ...extra } as unknown as Json }).eq("id", matchId);
  await cleanLineups(admin, [home, away]);

  const { count } = await admin.from("matches").select("id", { count: "exact", head: true }).eq("round_id", match.round_id).neq("status", "finished");
  if ((count ?? 0) === 0) await admin.from("rounds").update({ status: "completed" }).eq("id", match.round_id);

  // Surprising result → news
  const [hs, as] = [avg(homeSim), avg(awaySim)];
  const winnerWeaker = (score[0] > score[1] && hs + 3 < as) || (score[1] > score[0] && as + 3 < hs);
  const bigWin = Math.abs(score[0] - score[1]) >= 4;
  if (winnerWeaker || bigWin) {
    const scorers = events.filter((e) => e.type === "goal").map((e) => `${e.minute}' ${e.playerName} (${e.side === "home" ? home.name : away.name})`).join(", ");
    await publishNews(
      admin,
      "result",
      `תוצאה מפתיעה בליגת העל: ${home.name} ${score[0]} - ${score[1]} ${away.name}. ממוצע רייטינג: ${home.name} ${hs.toFixed(0)}, ${away.name} ${as.toFixed(0)}. כובשים: ${scorers || "אין"}.`,
      `הפתעה: ${home.name} ${score[0]}-${score[1]} ${away.name}`,
    );
  }
}

/** Live substitution: re-simulates the rest of the match from the current minute. */
export async function substitute(admin: DB, matchId: string, side: Side, outId: string, inId: string) {
  const { data: match } = await admin.from("matches").select("*").eq("id", matchId).single();
  if (!match || match.status !== "finished" || !match.started_at) throw new Error("המשחק אינו חי");
  const elapsed = Date.now() - new Date(match.started_at).getTime();
  const minute = Math.floor((elapsed / 90_000) * 90) + 1;
  if (minute >= 89) throw new Error("מאוחר מדי לחילוף");
  const st = match.stats as unknown as MatchStats & MatchExtra;
  if (!st.xi) throw new Error("חילופים לא זמינים למשחק זה");
  const events = match.events as unknown as MatchEvent[];
  if ((st.subs?.[side] ?? 0) >= MAX_SUBS) throw new Error("ניצלת את כל 3 החילופים");
  const usedIn = new Set(events.filter((e) => e.type === "sub" && e.side === side).map((e) => e.playerId));
  if (!st.bench[side].includes(inId) || usedIn.has(inId)) throw new Error("השחקן אינו זמין בספסל");
  const current = onPitch(st, events, side, minute);
  if (!current.some((x) => x.id === outId)) throw new Error("השחקן אינו על המגרש");

  const { home, away, players } = await loadSides(admin, match.home_team_id, match.away_team_id);
  const byId = new Map(players.map((p) => [p.id, p]));
  const pin = byId.get(inId);
  const pout = byId.get(outId);
  if (!pin || !pout) throw new Error("שחקן לא נמצא");

  const kept = events.filter((e) => e.minute <= minute);
  kept.push({ minute, type: "sub", side, playerId: inId, playerName: pin.name, outId, outName: pout.name, text: `חילוף: ${pin.name} נכנס במקום ${pout.name}` });
  const homeOn = onPitch(st, kept, "home", minute);
  const awayOn = onPitch(st, kept, "away", minute);
  const res = simulateMatch(toSim(homeOn, byId), toSim(awayOn, byId), {
    fromMinute: minute + 1,
    events: kept,
    possession: st.possession ?? [50, 50],
  });
  const extra: MatchExtra = { xi: st.xi, bench: st.bench, subs: { ...st.subs, [side]: (st.subs?.[side] ?? 0) + 1 }, applied: st.applied ?? {} };
  const all = players.filter((p) => p.team_id === home.id || p.team_id === away.id);
  extra.applied = await applyPlayerStats(admin, all, res.events, extra.applied, false);
  await admin
    .from("matches")
    .update({
      home_score: res.score[0],
      away_score: res.score[1],
      events: res.events as unknown as Json,
      stats: { ...res.stats, ...extra } as unknown as Json,
    })
    .eq("id", matchId);
  await cleanLineups(admin, [home, away]);
}
