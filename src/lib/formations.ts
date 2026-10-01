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

export type Slot = { index: number; role: Pos; x: number; y: number };

/** y: 0 = own goal (bottom), 100 = opponent goal (top). x: 0-100 across. */
export function formationSlots(formation: string): Slot[] {
  const lines = formation.split("-").map((n) => parseInt(n, 10)).filter((n) => n > 0);
  const slots: Slot[] = [{ index: 0, role: "GK", x: 50, y: 7 }];
  const minY = 27;
  const maxY = 84;
  const step = lines.length > 1 ? (maxY - minY) / (lines.length - 1) : 0;
  let idx = 1;
  lines.forEach((count, li) => {
    const role: Pos = li === 0 ? "DEF" : li === lines.length - 1 ? "FWD" : "MID";
    const y = minY + step * li;
    for (let i = 0; i < count; i++) {
      const x = count === 1 ? 50 : 12 + (76 / (count - 1)) * i;
      slots.push({ index: idx++, role, x, y });
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
