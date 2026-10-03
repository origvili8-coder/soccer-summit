import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { MatchEvent, MatchStats } from "./sim";

export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type Player = Database["public"]["Tables"]["players"]["Row"];
export type Round = Database["public"]["Tables"]["rounds"]["Row"];
export type Match = Omit<Database["public"]["Tables"]["matches"]["Row"], "events" | "stats"> & {
  events: MatchEvent[];
  stats: Partial<MatchStats>;
};
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Offer = Database["public"]["Tables"]["transfer_offers"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];

export type News = Database["public"]["Tables"]["news"]["Row"];
export const useNews = () =>
  useQuery({ queryKey: ["news"], queryFn: () => q<News[]>(supabase.from("news").select("*").order("created_at", { ascending: false }).limit(50)) });

export const MATCH_DURATION_MS = 90_000;

async function q<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return null;
      const [{ data: profile }, { data: isAdmin }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      ]);
      return { userId: user.id, profile: profile as Profile | null, isAdmin: !!isAdmin };
    },
  });
}

export const useTeams = () =>
  useQuery({ queryKey: ["teams"], queryFn: () => q<Team[]>(supabase.from("teams").select("*").order("name")) });
export const usePlayers = () =>
  useQuery({ queryKey: ["players"], queryFn: () => q<Player[]>(supabase.from("players").select("*").order("name")) });
export const useRounds = () =>
  useQuery({ queryKey: ["rounds"], queryFn: () => q<Round[]>(supabase.from("rounds").select("*").order("number")) });
export const useMatches = () =>
  useQuery({
    queryKey: ["matches"],
    queryFn: async () => (await q<unknown[]>(supabase.from("matches").select("*").order("created_at"))) as Match[],
  });
export const useProfiles = () =>
  useQuery({ queryKey: ["profiles"], queryFn: () => q<Profile[]>(supabase.from("profiles").select("*").order("username")) });
export const useOffers = () =>
  useQuery({
    queryKey: ["offers"],
    queryFn: () => q<Offer[]>(supabase.from("transfer_offers").select("*").order("created_at", { ascending: false })),
  });
export const useMessages = () =>
  useQuery({ queryKey: ["messages"], queryFn: () => q<Message[]>(supabase.from("messages").select("*").order("created_at")) });

/** A finished match is still "live" while its replay is running. */
export function matchPhase(m: Match, now = Date.now()): "scheduled" | "live" | "finished" {
  if (m.status !== "finished") return "scheduled";
  if (m.started_at && now - new Date(m.started_at).getTime() < MATCH_DURATION_MS) return "live";
  return "finished";
}

export type StandingRow = {
  team: Team;
  mp: number; w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number;
  form: ("W" | "D" | "L")[];
};

export function computeStandings(teams: Team[], matches: Match[]): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    teams.map((t) => [t.id, { team: t, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, form: [] }]),
  );
  const now = Date.now();
  for (const m of matches) {
    if (matchPhase(m, now) !== "finished") continue;
    const h = rows.get(m.home_team_id);
    const a = rows.get(m.away_team_id);
    if (!h || !a) continue;
    h.mp++; a.mp++;
    h.gf += m.home_score; h.ga += m.away_score;
    a.gf += m.away_score; a.ga += m.home_score;
    if (m.home_score > m.away_score) { h.w++; a.l++; h.pts += 3; h.form.push("W"); a.form.push("L"); }
    else if (m.home_score < m.away_score) { a.w++; h.l++; a.pts += 3; a.form.push("W"); h.form.push("L"); }
    else { h.d++; a.d++; h.pts++; a.pts++; h.form.push("D"); a.form.push("D"); }
  }
  return [...rows.values()]
    .map((r) => ({ ...r, gd: r.gf - r.ga, form: r.form.slice(-5) }))
    .sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.team.name.localeCompare(y.team.name));
}

export async function fileToDataUrl(file: File, size = 160): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = URL.createObjectURL(file);
  });
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const s = Math.min(img.width, img.height);
  ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  return c.toDataURL("image/jpeg", 0.85);
}
