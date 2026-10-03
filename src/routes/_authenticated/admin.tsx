import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty } from "@/components/PageHeader";
import { PlayerAvatar, PosBadge, TeamLogo } from "@/components/PlayerAvatar";
import { fileToDataUrl, useMatches, useMe, usePlayers, useProfiles, useRounds, useTeams, type Player, type Team } from "@/lib/data";
import { DETAILED, DETAIL_GROUP, DETAIL_LABEL, formatMoney, type Detail } from "@/lib/formations";
import { activateNextRound, adminPlayMatch, createManager, deleteManager, updateManager } from "@/lib/league.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "פאנל ניהול — ליגת העל מנג'ר" },
      { name: "description", content: "ניהול קבוצות, שחקנים, מנג'רים ומחזורים." },
      { property: "og:title", content: "פאנל ניהול — ליגת העל מנג'ר" },
      { property: "og:description", content: "ניהול קבוצות, שחקנים, מנג'רים ומחזורים." },
    ],
  }),
  component: AdminPage,
});

const inp = "rounded-lg bg-secondary px-3 py-2 text-sm";
const btn = "rounded-lg bg-neon px-4 py-2 text-sm font-bold text-background disabled:opacity-50";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section className="glass space-y-3 p-4"><h2 className="text-lg font-black">{title}</h2>{children}</section>;
}

function useRun() {
  const qc = useQueryClient();
  return async (fn: () => PromiseLike<{ error: { message: string } | null } | unknown>, ok?: string) => {
    try {
      const r = (await fn()) as { error?: { message: string } | null } | undefined;
      if (r && typeof r === "object" && "error" in r && r.error) throw new Error(r.error.message);
      if (ok) toast.success(ok);
      qc.invalidateQueries();
      return true;
    } catch (e) { toast.error((e as Error).message); return false; }
  };
}

function AdminPage() {
  const { data: me } = useMe();
  const [tab, setTab] = useState<"teams" | "players" | "managers" | "rounds">("teams");
  if (me && !me.isAdmin) return <Empty>רק מנהל הליגה יכול לגשת למסך זה.</Empty>;
  const tabs = { teams: "קבוצות", players: "שחקנים", managers: "מנג'רים", rounds: "מחזורים" } as const;
  return (
    <div>
      <PageHeader kicker="ADMIN CONTROL" title="פאנל ניהול" />
      <div className="mb-4 flex gap-2">
        {Object.entries(tabs).map(([k, v]) => (
          <button key={k} onClick={() => setTab(k as typeof tab)} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === k ? "bg-neon text-background" : "glass"}`}>{v}</button>
        ))}
      </div>
      {tab === "teams" && <TeamsAdmin />}
      {tab === "players" && <PlayersAdmin />}
      {tab === "managers" && <ManagersAdmin />}
      {tab === "rounds" && <RoundsAdmin />}
    </div>
  );
}

function TeamsAdmin() {
  const { data: teams = [] } = useTeams();
  const run = useRun();
  const [f, setF] = useState({ name: "", short_name: "", color: "#39ff88", budget: 10_000_000, logo_url: "" });
  const save = async () => {
    if (!f.name) return;
    if (await run(() => supabase.from("teams").insert({ ...f, short_name: f.short_name || f.name.slice(0, 3), logo_url: f.logo_url || null }), "הקבוצה נוצרה"))
      setF({ ...f, name: "", short_name: "", logo_url: "" });
  };
  const upd = (t: Team, patch: Partial<Team>) => run(() => supabase.from("teams").update(patch).eq("id", t.id));
  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <Card title="קבוצה חדשה">
        <input className={inp + " w-full"} placeholder="שם הקבוצה" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className={inp + " w-full"} placeholder="קיצור" value={f.short_name} onChange={(e) => setF({ ...f, short_name: e.target.value })} />
        <label className="flex items-center gap-2 text-sm">צבע <input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} /></label>
        <label className="block text-sm">תקציב (₪)<input type="number" className={inp + " w-full"} value={f.budget} onChange={(e) => setF({ ...f, budget: +e.target.value })} /></label>
        <label className="block text-sm">סמל<input type="file" accept="image/*" onChange={async (e) => e.target.files?.[0] && setF({ ...f, logo_url: await fileToDataUrl(e.target.files[0], 128) })} /></label>
        <button className={btn} onClick={save}>צור קבוצה</button>
      </Card>
      <Card title={`קבוצות (${teams.length})`}>
        {teams.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-secondary/50 p-2">
            <TeamLogo src={t.logo_url} name={t.short_name} color={t.color} />
            <b className="flex-1">{t.name}</b>
            <span className="text-xs text-muted-foreground">תקציב</span>
            <input type="number" defaultValue={t.budget} className={inp + " w-36"} onBlur={(e) => +e.target.value !== t.budget && upd(t, { budget: +e.target.value })} />
            <span className="w-16 text-xs tabular text-neon">{formatMoney(t.budget)}</span>
            <label className="cursor-pointer text-xs underline">סמל<input hidden type="file" accept="image/*" onChange={async (e) => e.target.files?.[0] && upd(t, { logo_url: await fileToDataUrl(e.target.files[0], 128) })} /></label>
            <button className="text-xs text-destructive" onClick={() => confirm(`למחוק את ${t.name}?`) && run(() => supabase.from("teams").delete().eq("id", t.id), "נמחקה")}>מחק</button>
          </div>
        ))}
      </Card>
    </div>
  );
}

function PlayersAdmin() {
  const { data: teams = [] } = useTeams();
  const { data: players = [] } = usePlayers();
  const run = useRun();
  const [filter, setFilter] = useState("");
  const blank = { name: "", detailed_position: "CM" as Detail, rating: 70, team_id: "", avatar_url: "" };
  const [f, setF] = useState(blank);
  const save = async () => {
    if (!f.name) return;
    if (await run(() => supabase.from("players").insert({ ...f, position: DETAIL_GROUP[f.detailed_position], team_id: f.team_id || null, avatar_url: f.avatar_url || null }), "השחקן נוסף"))
      setF({ ...blank, team_id: f.team_id, detailed_position: f.detailed_position });
  };
  const upd = (p: Player, patch: Partial<Player>) => run(() => supabase.from("players").update(patch).eq("id", p.id));
  const shown = players.filter((p) => !filter || p.team_id === filter || (filter === "free" && !p.team_id));
  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <Card title="שחקן חדש">
        <input className={inp + " w-full"} placeholder="שם השחקן" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <select className={inp + " w-full"} value={f.detailed_position} onChange={(e) => setF({ ...f, detailed_position: e.target.value as Detail })}>
          {DETAILED.map((d) => <option key={d} value={d}>{d} — {DETAIL_LABEL[d]}</option>)}
        </select>
        <label className="block text-sm">רייטינג<input type="number" min={1} max={99} className={inp + " w-full"} value={f.rating} onChange={(e) => setF({ ...f, rating: +e.target.value })} /></label>
        <select className={inp + " w-full"} value={f.team_id} onChange={(e) => setF({ ...f, team_id: e.target.value })}>
          <option value="">שחקן חופשי</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <label className="block text-sm">תמונת פנים<input type="file" accept="image/*" onChange={async (e) => e.target.files?.[0] && setF({ ...f, avatar_url: await fileToDataUrl(e.target.files[0]) })} /></label>
        {f.avatar_url && <PlayerAvatar src={f.avatar_url} name={f.name} className="size-14" />}
        <button className={btn} onClick={save}>הוסף שחקן</button>
      </Card>
      <Card title={`מאגר שחקנים (${players.length})`}>
        <select className={inp} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">כולם</option><option value="free">חופשיים</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div className="max-h-[60vh] space-y-1 overflow-y-auto">
          {shown.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-secondary/50 p-2 text-sm">
              <label className="cursor-pointer" title="החלף תמונה">
                <PlayerAvatar src={p.avatar_url} name={p.name} />
                <input hidden type="file" accept="image/*" onChange={async (e) => e.target.files?.[0] && upd(p, { avatar_url: await fileToDataUrl(e.target.files[0]) })} />
              </label>
              <b className="min-w-24 flex-1">{p.name}</b>
              <PosBadge pos={p.position} />
              <select className={inp} value={p.detailed_position} onChange={(e) => upd(p, { detailed_position: e.target.value, position: DETAIL_GROUP[e.target.value as Detail] })}>
                {DETAILED.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <input type="number" defaultValue={p.rating} className={inp + " w-16"} onBlur={(e) => +e.target.value !== p.rating && upd(p, { rating: +e.target.value })} />
              <select className={inp} value={p.team_id ?? ""} onChange={(e) => upd(p, { team_id: e.target.value || null })}>
                <option value="">חופשי</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.short_name}</option>)}
              </select>
              <span className="text-xs tabular text-muted-foreground">⚽{p.goals} 🅰{p.assists} 🟨{p.yellow_cards} 🟥{p.red_cards}</span>
              {p.suspended_matches > 0 && <button className="text-xs text-destructive" onClick={() => upd(p, { suspended_matches: 0 })}>מושעה ✕</button>}
              <button className="text-xs text-destructive" onClick={() => confirm(`למחוק את ${p.name}?`) && run(() => supabase.from("players").delete().eq("id", p.id))}>מחק</button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ManagersAdmin() {
  const { data: teams = [] } = useTeams();
  const { data: profiles = [] } = useProfiles();
  const { data: me } = useMe();
  const run = useRun();
  const create = useServerFn(createManager);
  const update = useServerFn(updateManager);
  const del = useServerFn(deleteManager);
  const [f, setF] = useState({ username: "", password: "", displayName: "", teamId: "" });
  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <Card title="מנג'ר חדש">
        <input className={inp + " w-full"} placeholder="שם משתמש (אנגלית, למשל uri)" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} />
        <input className={inp + " w-full"} placeholder="סיסמה (6+ תווים)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <input className={inp + " w-full"} placeholder="שם תצוגה (אורי)" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} />
        <select className={inp + " w-full"} value={f.teamId} onChange={(e) => setF({ ...f, teamId: e.target.value })}>
          <option value="">ללא קבוצה</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button className={btn} onClick={async () => { if (await run(() => create({ data: { ...f, teamId: f.teamId || null } }), "המנג'ר נוצר")) setF({ username: "", password: "", displayName: "", teamId: "" }); }}>צור מנג'ר</button>
      </Card>
      <Card title="משתמשים">
        {profiles.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-secondary/50 p-2 text-sm">
            <PlayerAvatar name={p.display_name} />
            <div className="flex-1"><b>{p.display_name}</b> <span className="text-xs text-muted-foreground">@{p.username}</span></div>
            {p.id !== me?.userId && (<>
              <select className={inp} value={p.team_id ?? ""} onChange={(e) => run(() => update({ data: { userId: p.id, teamId: e.target.value || null } }), "עודכן")}>
                <option value="">ללא קבוצה</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button className="text-xs underline" onClick={() => { const pw = prompt("סיסמה חדשה"); if (pw) run(() => update({ data: { userId: p.id, teamId: p.team_id, password: pw } }), "הסיסמה עודכנה"); }}>סיסמה</button>
              <button className="text-xs text-destructive" onClick={() => confirm("למחוק משתמש?") && run(() => del({ data: { userId: p.id } }), "נמחק")}>מחק</button>
            </>)}
          </div>
        ))}
      </Card>
    </div>
  );
}

function RoundsAdmin() {
  const { data: rounds = [] } = useRounds();
  const { data: matches = [] } = useMatches();
  const { data: teams = [] } = useTeams();
  const run = useRun();
  const next = useServerFn(activateNextRound);
  const play = useServerFn(adminPlayMatch);
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [roundId, setRoundId] = useState("");
  const tn = (id: string) => teams.find((t) => t.id === id)?.name ?? "?";
  const addRound = () => run(() => supabase.from("rounds").insert({ number: (rounds.at(-1)?.number ?? 0) + 1 }), "מחזור נוצר");
  const addMatch = () => {
    if (!roundId || !home || !away || home === away) return toast.error("בחר מחזור ושתי קבוצות שונות");
    run(() => supabase.from("matches").insert({ round_id: roundId, home_team_id: home, away_team_id: away }), "משחק נוסף");
  };
  return (
    <div className="space-y-4">
      <Card title="שליטה במחזורים">
        <div className="flex flex-wrap gap-2">
          <button className={btn} onClick={addRound}>+ מחזור חדש</button>
          <button className="rounded-lg bg-gold/20 px-4 py-2 text-sm font-bold text-gold" onClick={() => run(() => next(), "המחזור הבא נפתח")}>סגור מחזור נוכחי ופתח את הבא</button>
        </div>
        <p className="text-xs text-muted-foreground">מחזור חדש ייפתח רק כשכל משחקי המחזור הפעיל הסתיימו.</p>
        <div className="flex flex-wrap gap-2">
          <select className={inp} value={roundId} onChange={(e) => setRoundId(e.target.value)}>
            <option value="">מחזור</option>{rounds.filter((r) => r.status !== "completed").map((r) => <option key={r.id} value={r.id}>מחזור {r.number}</option>)}
          </select>
          <select className={inp} value={home} onChange={(e) => setHome(e.target.value)}><option value="">בית</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <select className={inp} value={away} onChange={(e) => setAway(e.target.value)}><option value="">חוץ</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <button className={btn} onClick={addMatch}>הוסף משחק</button>
        </div>
      </Card>
      {rounds.map((r) => (
        <Card key={r.id} title={`מחזור ${r.number} · ${({ pending: "ממתין", active: "פעיל", completed: "הסתיים" } as Record<string, string>)[r.status]}`}>
          {matches.filter((m) => m.round_id === r.id).map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-lg bg-secondary/50 p-2 text-sm">
              <span className="flex-1">{tn(m.home_team_id)} <b className="tabular">{m.status === "finished" ? `${m.home_score}-${m.away_score}` : "vs"}</b> {tn(m.away_team_id)}</span>
              {m.status !== "finished" && r.status === "active" && <button className="text-xs font-bold text-neon" onClick={() => run(() => play({ data: { matchId: m.id } }), "המשחק שוחק")}>שחק עכשיו</button>}
              {m.status !== "finished" && <button className="text-xs text-destructive" onClick={() => run(() => supabase.from("matches").delete().eq("id", m.id))}>מחק</button>}
            </div>
          ))}
          {r.status === "pending" && <button className="text-xs text-destructive" onClick={() => run(() => supabase.from("rounds").delete().eq("id", r.id))}>מחק מחזור</button>}
        </Card>
      ))}
    </div>
  );
}
