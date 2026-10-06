import type { Pos } from "./formations";

export type SimPlayer = { id: string; name: string; position: Pos; rating: number };
export type Side = "home" | "away";
export type MatchEvent = {
  minute: number;
  type: "goal" | "yellow" | "red" | "save" | "miss" | "foul" | "attack" | "sub";
  side: Side;
  playerId?: string | undefined;
  playerName?: string | undefined;
  assistId?: string | undefined;
  assistName?: string | undefined;
  text: string;
};
export type MatchStats = {
  possession: [number, number];
  possRaw?: [number, number];
  shots: [number, number];
  onTarget: [number, number];
  fouls: [number, number];
  newsId?: string | null;
};
export type SubRecord = { minute: number; side: Side; outId: string; inId: string; outName: string; inName: string };

function pick<T>(arr: T[], weight: (t: T) => number): T | undefined {
  const total = arr.reduce((s, t) => s + weight(t), 0);
  if (!arr.length || total <= 0) return arr[0];
  let r = Math.random() * total;
  for (const t of arr) {
    r -= weight(t);
    if (r <= 0) return t;
  }
  return arr[arr.length - 1];
}

const SCORE_W: Record<Pos, number> = { GK: 0.05, DEF: 1, MID: 3, FWD: 6 };
const ASSIST_W: Record<Pos, number> = { GK: 0.2, DEF: 1.2, MID: 4, FWD: 3 };
const FOUL_W: Record<Pos, number> = { GK: 0.3, DEF: 4, MID: 3, FWD: 1.5 };

/** Tactical style derived from a formation: attack, defence and midfield control multipliers. */
export function formationStyle(formation: string) {
  const lines = formation.split("-").map((n) => parseInt(n, 10)).filter((n) => n > 0);
  const d = lines[0] ?? 4;
  const f = lines.length > 1 ? lines[lines.length - 1]! : 2;
  const m = Math.max(0, 10 - d - f);
  return {
    attack: 1 + 0.16 * (f - 2) + 0.04 * (m - 4),
    defence: 1 + 0.14 * (d - 4) - 0.05 * (f - 2),
    control: 1 + 0.09 * (m - 3),
  };
}

function strength(ps: SimPlayer[]) {
  if (!ps.length) return 30;
  return ps.reduce((s, p) => s + p.rating, 0) / 11;
}

export type SimInit = {
  startMinute: number;
  score: [number, number];
  stats: { possRaw: [number, number]; shots: [number, number]; onTarget: [number, number]; fouls: [number, number] };
  yellows: Map<string, number>;
  events: MatchEvent[];
};

export function simulateMatch(
  homeXI: SimPlayer[],
  awayXI: SimPlayer[],
  formations: { home: string; away: string } = { home: "4-4-2", away: "4-4-2" },
  init?: SimInit,
) {
  const on: Record<Side, SimPlayer[]> = { home: [...homeXI], away: [...awayXI] };
  const yellows = new Map(init?.yellows ?? []);
  const events: MatchEvent[] = [...(init?.events ?? [])];
  const score: [number, number] = init ? [...init.score] : [0, 0];
  const raw = init
    ? { possRaw: [...init.stats.possRaw] as [number, number], shots: [...init.stats.shots] as [number, number], onTarget: [...init.stats.onTarget] as [number, number], fouls: [...init.stats.fouls] as [number, number] }
    : { possRaw: [0, 0] as [number, number], shots: [0, 0] as [number, number], onTarget: [0, 0] as [number, number], fouls: [0, 0] as [number, number] };
  const style = { home: formationStyle(formations.home), away: formationStyle(formations.away) };
  const si = (s: Side) => (s === "home" ? 0 : 1);
  const other = (s: Side): Side => (s === "home" ? "away" : "home");

  for (let minute = init?.startMinute ?? 1; minute <= 90; minute++) {
    const hs = strength(on.home) * 1.04 * style.home.control;
    const as = strength(on.away) * style.away.control;
    const side: Side = Math.random() < hs / (hs + as) ? "home" : "away";
    raw.possRaw[si(side)]++;
    const opp = other(side);
    const tactical = style[side].attack / Math.max(style[opp].defence, 0.5);

    if (Math.random() < 0.16 * tactical) {
      const att = on[side];
      const def = on[opp];
      const ratio = strength(att) / Math.max(strength(def), 1);
      const shooter = pick(att, (p) => SCORE_W[p.position] * p.rating);
      if (!shooter) continue;
      raw.shots[si(side)]++;
      if (Math.random() < 0.42 * Math.min(ratio, 1.4)) {
        raw.onTarget[si(side)]++;
        const gk = def.find((p) => p.position === "GK");
        const goalP = 0.33 * ratio * Math.sqrt(tactical) * (gk ? 80 / Math.max(gk.rating, 40) : 1.6);
        if (Math.random() < goalP) {
          score[si(side)]++;
          const assister =
            Math.random() < 0.72 ? pick(att.filter((p) => p.id !== shooter.id), (p) => ASSIST_W[p.position] * p.rating) : undefined;
          events.push({
            minute, type: "goal", side,
            playerId: shooter.id, playerName: shooter.name,
            assistId: assister?.id, assistName: assister?.name,
            text: `שער! ${shooter.name}${assister ? ` (בישול: ${assister.name})` : ""}`,
          });
        } else {
          events.push({ minute, type: "save", side, playerId: shooter.id, playerName: shooter.name, text: `הצלה! ${gk?.name ?? "השוער"} עוצר את ${shooter.name}` });
        }
      } else {
        events.push({ minute, type: "miss", side, playerId: shooter.id, playerName: shooter.name, text: `${shooter.name} מחטיא` });
      }
    } else if (Math.random() < 0.05) {
      const fouler = pick(on[side], (p) => FOUL_W[p.position]);
      if (!fouler) continue;
      raw.fouls[si(side)]++;
      const r = Math.random();
      if (r < 0.025) {
        on[side] = on[side].filter((p) => p.id !== fouler.id);
        events.push({ minute, type: "red", side, playerId: fouler.id, playerName: fouler.name, text: `כרטיס אדום! ${fouler.name} מורחק` });
      } else if (r < 0.32) {
        const y = (yellows.get(fouler.id) ?? 0) + 1;
        yellows.set(fouler.id, y);
        events.push({ minute, type: "yellow", side, playerId: fouler.id, playerName: fouler.name, text: `כרטיס צהוב ל${fouler.name}` });
        if (y === 2) {
          on[side] = on[side].filter((p) => p.id !== fouler.id);
          events.push({ minute, type: "red", side, playerId: fouler.id, playerName: fouler.name, text: `צהוב שני! ${fouler.name} מורחק` });
        }
      } else {
        events.push({ minute, type: "foul", side, playerId: fouler.id, playerName: fouler.name, text: `עבירה של ${fouler.name}` });
      }
    } else if (Math.random() < 0.12) {
      events.push({ minute, type: "attack", side, text: "התקפה מסוכנת" });
    }
  }
  const tot = raw.possRaw[0] + raw.possRaw[1] || 1;
  const hp = Math.round((raw.possRaw[0] / tot) * 100);
  const stats: MatchStats = { possession: [hp, 100 - hp], possRaw: raw.possRaw, shots: raw.shots, onTarget: raw.onTarget, fouls: raw.fouls };
  return { events, score, stats };
}

/* ---------- Replay timeline (shared by client & server) ---------- */
export const MINUTE_MS = 1000; // 90 game minutes = 90 seconds
export const SUB_PAUSE_MS = 5000;

export function matchDurationMs(subs: SubRecord[] | null | undefined) {
  return 90 * MINUTE_MS + (subs?.length ?? 0) * SUB_PAUSE_MS;
}

/** Converts real elapsed ms into game time, accounting for 5s freezes at each substitution. */
export function replayClock(elapsed: number, subs: SubRecord[] | null | undefined) {
  const sorted = [...(subs ?? [])].sort((a, b) => a.minute - b.minute);
  let pausedBefore = 0;
  for (const s of sorted) {
    const start = s.minute * MINUTE_MS + pausedBefore;
    if (elapsed < start) break;
    if (elapsed < start + SUB_PAUSE_MS) return { gameMs: s.minute * MINUTE_MS, pausedSub: s };
    pausedBefore += SUB_PAUSE_MS;
  }
  return { gameMs: Math.min(90 * MINUTE_MS, Math.max(0, elapsed - pausedBefore)), pausedSub: null as SubRecord | null };
}
