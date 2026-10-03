export type Pos = "GK" | "DEF" | "MID" | "FWD";

export const FORMATIONS = [
  "4-3-3",
  "4-4-2",
  "4-2-3-1",
  "3-5-2",
  "5-3-2",
  "4-1-4-1",
  "4-3-2-1",
  "3-4-3",
  "4-5-1",
  "5-4-1",
] as const;

export const POS_LABEL: Record<Pos, string> = {
  GK: "שוער",
  DEF: "הגנה",
  MID: "קישור",
  FWD: "התקפה",
};

export const DETAILED = ["GK", "CB", "RB", "LB", "CDM", "CM", "CAM", "RW", "LW", "ST"] as const;
export type Detail = (typeof DETAILED)[number];
export const DETAIL_GROUP: Record<Detail, Pos> = {
  GK: "GK", CB: "DEF", RB: "DEF", LB: "DEF", CDM: "MID", CM: "MID", CAM: "MID", RW: "FWD", LW: "FWD", ST: "FWD",
};
export const DETAIL_LABEL: Record<Detail, string> = {
  GK: "שוער", CB: "בלם", RB: "מגן ימני", LB: "מגן שמאלי", CDM: "קשר אחורי", CM: "קשר מרכזי",
  CAM: "קשר התקפי", RW: "כנף ימין", LW: "כנף שמאל", ST: "חלוץ",
};
/** Rating multiplier for a player (natural position) playing in a slot. */
export function positionFit(natural: string, slot: Detail): number {
  if (natural === slot) return 1;
  const g = DETAIL_GROUP[natural as Detail];
  if (!g) return 0.85;
  if (slot === "GK" || g === "GK") return 0.4;
  if (g === DETAIL_GROUP[slot]) return 0.93;
  return 0.75;
}

function lineDetails(count: number, kind: "DEF" | "MID1" | "MID_D" | "MID_A" | "FWD"): Detail[] {
  const fill = (edge: [Detail, Detail], mid: Detail): Detail[] =>
    count === 1 ? [mid] : count === 2 ? [mid, mid] : [edge[0], ...Array<Detail>(count - 2).fill(mid), edge[1]];
  if (kind === "DEF") return count >= 4 ? fill(["LB", "RB"], "CB") : Array<Detail>(count).fill("CB");
  if (kind === "FWD") return count >= 3 ? fill(["LW", "RW"], "ST") : Array<Detail>(count).fill("ST");
  if (kind === "MID_D") return Array<Detail>(count).fill("CDM");
  if (kind === "MID_A") return count >= 3 ? fill(["LW", "RW"], count === 3 ? "CAM" : "CM") : Array<Detail>(count).fill("CAM");
  // single midfield line
  if (count === 3) return ["CM", "CDM", "CM"];
  if (count >= 4) return fill(["LW", "RW"], "CM").map((d, i, a) => (a.length === 5 && i === 2 ? "CDM" : d));
  return Array<Detail>(count).fill("CM");
}

export type Slot = { index: number; role: Pos; pos: Detail; x: number; y: number };

/** y: 0 = own goal (bottom), 100 = opponent goal (top). x: 0-100 across. */
export function formationSlots(formation: string): Slot[] {
  const lines = formation.split("-").map((n) => parseInt(n, 10)).filter((n) => n > 0);
  const slots: Slot[] = [{ index: 0, role: "GK", pos: "GK", x: 50, y: 7 }];
  const minY = 27;
  const maxY = 84;
  const step = lines.length > 1 ? (maxY - minY) / (lines.length - 1) : 0;
  let idx = 1;
  lines.forEach((count, li) => {
    const role: Pos = li === 0 ? "DEF" : li === lines.length - 1 ? "FWD" : "MID";
    const y = minY + step * li;
    const midLines = lines.length - 2;
    const kind = li === 0 ? "DEF" : li === lines.length - 1 ? "FWD" : midLines === 1 ? "MID1" : li === lines.length - 2 ? "MID_A" : "MID_D";
    const details = lineDetails(count, kind);
    for (let i = 0; i < count; i++) {
      const x = count === 1 ? 50 : 12 + (76 / (count - 1)) * i;
      const pos = details[i] ?? "CM";
      slots.push({ index: idx++, role: DETAIL_GROUP[pos] === "GK" ? role : DETAIL_GROUP[pos], pos, x, y });
    }
  });
  return slots;
}

export function formatMoney(n: number) {
  if (Math.abs(n) >= 1_000_000) return `₪${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (Math.abs(n) >= 1_000) return `₪${Math.round(n / 1000)}K`;
  return `₪${n}`;
}

export const USER_EMAIL_DOMAIN = "managers.iplm.app";
export function usernameToEmail(u: string) {
  const clean = u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return `${clean}@${USER_EMAIL_DOMAIN}`;
}
export function normalizeUsername(u: string) {
  return u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}
