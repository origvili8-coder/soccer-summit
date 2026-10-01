import type { Pos } from "./formations";

export type SimPlayer = { id: string; name: string; position: Pos; rating: number };
export type Side = "home" | "away";
export type MatchEvent = {
  minute: number;
  type: "goal" | "yellow" | "red" | "save" | "miss" | "foul" | "attack";
  side: Side;
  playerId?: string;
  playerName?: string;
  assistId?: string;
  assistName?: string;
  text: string;
};
export type MatchStats = {
  possession: [number, number];
  shots: [number, number];
  onTarget: [number, number];
  fouls: [number, number];
};

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

function strength(ps: SimPlayer[]) {
  if (!ps.length) return 30;
  return ps.reduce((s, p) => s + p.rating, 0) / 11;
}

export function simulateMatch(homeXI: SimPlayer[], awayXI: SimPlayer[]) {
  const on: Record<Side, SimPlayer[]> = { home: [...homeXI], away: [...awayXI] };
  const yellows = new Map<string, number>();
  const events: MatchEvent[] = [];
  const score: [number, number] = [0, 0];
  const stats: MatchStats = { possession: [0, 0], shots: [0, 0], onTarget: [0, 0], fouls: [0, 0] };
  const si = (s: Side) => (s === "home" ? 0 : 1);
  const other = (s: Side): Side => (s === "home" ? "away" : "home");

  for (let minute = 1; minute <= 90; minute++) {
    const hs = strength(on.home) * 1.04; // home advantage
    const as = strength(on.away);
    const pHome = hs / (hs + as);
    const side: Side = Math.random() < pHome ? "home" : "away";
    stats.possession[si(side)]++;

    if (Math.random() < 0.16) {
      const att = on[side];
      const def = on[other(side)];
      const ratio = strength(att) / Math.max(strength(def), 1);
      const shooter = pick(att, (p) => SCORE_W[p.position] * p.rating);
      if (!shooter) continue;
      stats.shots[si(side)]++;
      if (Math.random() < 0.42 * Math.min(ratio, 1.4)) {
        stats.onTarget[si(side)]++;
        const gk = def.find((p) => p.position === "GK");
        const goalP = 0.33 * ratio * (gk ? 80 / Math.max(gk.rating, 40) : 1.6);
        if (Math.random() < goalP) {
          score[si(side)]++;
          const assister =
            Math.random() < 0.72 ? pick(att.filter((p) => p.id !== shooter.id), (p) => ASSIST_W[p.position] * p.rating) : undefined;
          events.push({
            minute,
            type: "goal",
            side,
            playerId: shooter.id,
            playerName: shooter.name,
            assistId: assister?.id,
            assistName: assister?.name,
            text: `שער! ${shooter.name}${assister ? ` (בישול: ${assister.name})` : ""}`,
          });
        } else {
          events.push({
            minute,
            type: "save",
            side,
            playerId: shooter.id,
            playerName: shooter.name,
            text: `הצלה! ${gk?.name ?? "השוער"} עוצר את ${shooter.name}`,
          });
        }
      } else {
        events.push({ minute, type: "miss", side, playerId: shooter.id, playerName: shooter.name, text: `${shooter.name} מחטיא` });
      }
    } else if (Math.random() < 0.05) {
      const fouler = pick(on[side], (p) => FOUL_W[p.position]);
      if (!fouler) continue;
      stats.fouls[si(side)]++;
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
  const tot = stats.possession[0] + stats.possession[1] || 1;
  stats.possession = [Math.round((stats.possession[0] / tot) * 100), 100 - Math.round((stats.possession[0] / tot) * 100)];
  return { events, score, stats };
}
