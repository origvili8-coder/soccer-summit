import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { MATCH_DURATION_MS, useMatches, useMe, usePlayers, useRounds, useTeams } from "@/lib/data";
import { setReady, adminPlayMatch, makeSubstitution } from "@/lib/league.functions";
import { formationSlots } from "@/lib/formations";
import { PlayerAvatar, TeamLogo } from "@/components/PlayerAvatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MatchEvent } from "@/lib/sim";

export const Route = createFileRoute("/_authenticated/match/$matchId")({
  head: () => ({
    meta: [
      { title: "מרכז המשחק — ליגת העל מנג'ר" },
      { name: "description", content: "משחק חי עם מגרש וירטואלי, סטטיסטיקות ועדכונים בזמן אמת." },
      { property: "og:title", content: "מרכז המשחק — ליגת העל מנג'ר" },
      { property: "og:description", content: "משחק חי בזמן אמת." },
    ],
  }),
  component: MatchCenter,
});

const ICON: Record<MatchEvent["type"], string> = {
  goal: "⚽", yellow: "🟨", red: "🟥", save: "🧤", miss: "↗", foul: "✋", attack: "⚡", sub: "🔄",
};

function MatchCenter() {
  const { matchId } = Route.useParams();
  const matches = useMatches();
  const teams = useTeams();
  const players = usePlayers();
  const rounds = useRounds();
  const me = useMe();
  const qc = useQueryClient();
  const ready = useServerFn(setReady);
  const force = useServerFn(adminPlayMatch);
  const subFn = useServerFn(makeSubstitution);
  const [replayStart, setReplayStart] = useState<number | null>(null);
  const [subOut, setSubOut] = useState("");
  const [subIn, setSubIn] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const m = matches.data?.find((x) => x.id === matchId);
  const home = teams.data?.find((t) => t.id === m?.home_team_id);
  const away = teams.data?.find((t) => t.id === m?.away_team_id);
  const round = rounds.data?.find((r) => r.id === m?.round_id);
  const pmap = useMemo(() => new Map((players.data ?? []).map((p) => [p.id, p])), [players.data]);

  const startMs = replayStart ?? (m?.started_at ? new Date(m.started_at).getTime() : 0);
  const elapsed = startMs ? now - startMs : 0;
  const isReplay = replayStart !== null && elapsed < MATCH_DURATION_MS;
  const minute = m?.status === "finished" ? Math.min(90, Math.floor((elapsed / MATCH_DURATION_MS) * 90)) : 0;
  const isLive = m?.status === "finished" && elapsed < MATCH_DURATION_MS;
  const shown = (m?.events ?? []).filter((e) => !isLive || e.minute <= minute);
  const score = isLive
    ? [shown.filter((e) => e.type === "goal" && e.side === "home").length, shown.filter((e) => e.type === "goal" && e.side === "away").length]
    : [m?.home_score ?? 0, m?.away_score ?? 0];
  const frac = isLive ? minute / 90 : 1;
  const st = m?.stats ?? {};
  const scale = (v?: [number, number]) => (v ? ([Math.round(v[0] * frac), Math.round(v[1] * frac)] as [number, number]) : ([0, 0] as [number, number]));
  const shots = scale(st.shots);
  const onT = scale(st.onTarget);
  const fouls = scale(st.fouls);
  const poss = st.possession ?? [50, 50];

  // Notification popup for big events
  const [popup, setPopup] = useState<MatchEvent | null>(null);
  const lastCount = useRef(0);
  useEffect(() => {
    const big = shown.filter((e) => e.type === "goal" || e.type === "red" || e.type === "yellow");
    if (isLive && big.length > lastCount.current) {
      setPopup(big[big.length - 1]!);
      const t = setTimeout(() => setPopup(null), 3200);
      lastCount.current = big.length;
      return () => clearTimeout(t);
    }
    lastCount.current = big.length;
    return undefined;
  }, [shown.length, isLive]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!m || !home || !away) return <p className="text-muted-foreground">טוען משחק...</p>;

  const myTeam = me.data?.profile?.team_id;
  const mySide = myTeam === home.id ? "home" : myTeam === away.id ? "away" : null;

  async function onReady() {
    setBusy(true);
    try {
      const r = await ready({ data: { matchId } });
      if (r.started) toast.success("שתי הקבוצות מוכנות — המשחק מתחיל!");
      qc.invalidateQueries({ queryKey: ["matches"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function onForce() {
    setBusy(true);
    try {
      await force({ data: { matchId } });
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Ball position on the pitch
  const last = shown[shown.length - 1];
  const t = now / 1000;
  let bx = 50 + Math.sin(t * 0.9) * 18 + Math.sin(t * 2.3) * 6;
  let by = 50 + Math.cos(t * 0.7) * 22;
  if (isLive && last && minute - last.minute < 2) {
    const toward = last.side === "home" ? 90 : 10;
    if (["goal", "save", "miss", "attack"].includes(last.type)) {
      bx = toward + (last.side === "home" ? -4 : 4) * Math.sin(t * 3);
      by = 50 + Math.sin(t * 2) * (last.type === "goal" ? 3 : 12);
    }
  }
  if (!isLive) { bx = 50; by = 50; }

  type XI = { id: string; pos: string }[];
  const extra = st as unknown as { xi?: { home: XI; away: XI }; bench?: { home: string[]; away: string[] }; subs?: { home: number; away: number } };
  const pitchNow = (side: "home" | "away", evs: MatchEvent[]) => {
    let xi = [...(extra.xi?.[side] ?? [])];
    for (const e of evs) {
      if (e.side !== side) continue;
      if (e.type === "red") xi = xi.filter((x) => x.id !== e.playerId);
      if (e.type === "sub") xi = xi.map((x) => (x.id === e.outId ? { id: e.playerId!, pos: x.pos } : x));
    }
    return xi;
  };
  const tokens = (["home", "away"] as const).flatMap((side) => {
    const team = side === "home" ? home : away;
    const slots = formationSlots(team.formation);
    const full = extra.xi?.[side] ?? [];
    return pitchNow(side, shown).map((x) => {
      const idx = full.findIndex((f) => f.pos === x.pos && (f.id === x.id || !pitchNow(side, shown).some((o) => o.id === f.id)));
      const sl = slots[Math.max(0, idx)] ?? { x: 50, y: 50 };
      const drift = isLive ? (bx - 50) * 0.25 + Math.sin(t * 1.3 + sl.x) * 1.5 : 0;
      const depth = sl.y * 0.46;
      const left = side === "home" ? 3 + depth + drift : 97 - depth + drift;
      const top = 8 + sl.x * 0.84 + (isLive ? Math.cos(t + sl.y) * 1.5 : 0);
      return { id: x.id, side, left, top, color: team.color };
    });
  });
  const live = isLive && !isReplay;
  const benchAvail = mySide && extra.bench ? extra.bench[mySide].filter((id) => !(m.events ?? []).some((e) => e.type === "sub" && e.playerId === id)) : [];
  const onNow = mySide ? pitchNow(mySide, shown) : [];
  async function doSub() {
    if (!subOut || !subIn) return toast.error("בחר שחקן יוצא ונכנס");
    setBusy(true);
    try {
      await subFn({ data: { matchId, outId: subOut, inId: subIn } });
      toast.success("החילוף בוצע!");
      setSubOut(""); setSubIn("");
      qc.invalidateQueries();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div>
      <Link to="/fixtures" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> חזרה למחזורים
      </Link>

      {/* Scoreboard */}
      <div className="glass relative overflow-hidden p-6">
        <div className="flex items-center justify-between gap-4">
          <TeamSide name={home.name} logo={home.logo_url} color={home.color} label="בית" />
          <div className="text-center">
            {m.status === "scheduled" ? (
              <p className="text-4xl font-black text-muted-foreground">VS</p>
            ) : (
              <p className="flex gap-3 text-6xl font-black tabular"><span>{score[0]}</span><span>:</span><span>{score[1]}</span></p>
            )}
            <p className={cn("mt-1 text-sm font-bold", isLive ? "text-destructive" : "text-muted-foreground")}>
              {m.status === "scheduled" ? `מחזור ${round?.number ?? ""}` : isReplay ? `⟲ שידור חוזר ${minute}'` : isLive ? `● LIVE ${minute}'` : "סיום · 90'"}
            </p>
            {m.status === "finished" && !isLive && (
              <Button size="sm" variant="secondary" className="mt-2" onClick={() => { lastCount.current = 0; setReplayStart(Date.now()); }}>▶ צפה בשידור חוזר</Button>
            )}
          </div>
          <TeamSide name={away.name} logo={away.logo_url} color={away.color} label="חוץ" />
        </div>
        {m.status === "finished" && (
          <div className="mx-auto mt-6 max-w-xl space-y-2 text-xs">
            <StatBar label="החזקת כדור %" a={poss[0]} b={poss[1]} />
            <StatBar label="בעיטות" a={shots[0]} b={shots[1]} />
            <StatBar label="למסגרת" a={onT[0]} b={onT[1]} />
            <StatBar label="עבירות" a={fouls[0]} b={fouls[1]} />
          </div>
        )}
      </div>

      {m.status === "scheduled" ? (
        <div className="glass mt-6 p-8 text-center">
          <h2 className="text-xl font-bold">חדר הלבשה — הכנה למשחק</h2>
          <p className="mt-1 text-sm text-muted-foreground">שני המאמנים צריכים ללחוץ "מוכן" כדי שהמשחק יתחיל. קבוצה בלי מאמן מוכנה אוטומטית.</p>
          <div className="mt-6 flex justify-center gap-10">
            {[{ t: home, r: m.home_ready }, { t: away, r: m.away_ready }].map(({ t: tm, r }) => (
              <div key={tm.id} className="flex items-center gap-2 text-sm font-bold">
                {r ? <CheckCircle2 className="size-5 text-neon" /> : <Circle className="size-5 text-muted-foreground" />}
                {tm.name}
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-center gap-3">
            {mySide && (
              <Button size="lg" className="neon-glow px-10 font-black" disabled={busy || round?.status !== "active" || (mySide === "home" ? m.home_ready : m.away_ready)} onClick={onReady}>
                {(mySide === "home" ? m.home_ready : m.away_ready) ? "ממתין ליריב..." : "מוכן! התחל משחק"}
              </Button>
            )}
            {me.data?.isAdmin && (
              <Button size="lg" variant="secondary" disabled={busy || round?.status !== "active"} onClick={onForce}>
                שחק עכשיו (מנהל)
              </Button>
            )}
          </div>
          {round?.status !== "active" && <p className="mt-3 text-xs text-destructive">המחזור אינו פעיל — המשחק נעול.</p>}
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Pitch */}
          <div className="glass relative overflow-hidden p-3">
            <div style={{ perspective: "1100px" }}>
            <div className="relative aspect-[16/10] rounded-lg pitch-bg shadow-2xl" dir="ltr" style={{ transform: "rotateX(38deg) scale(0.92)", transformOrigin: "50% 60%", transformStyle: "preserve-3d" }}>
              <div className="absolute inset-3 rounded-sm border-2 border-pitch-line" />
              <div className="absolute inset-y-3 left-1/2 w-0.5 bg-pitch-line" />
              <div className="absolute left-1/2 top-1/2 size-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-pitch-line" style={{ aspectRatio: 1, height: "auto" }} />
              <div className="absolute left-3 top-1/2 h-[44%] w-[14%] -translate-y-1/2 border-2 border-l-0 border-pitch-line" />
              <div className="absolute right-3 top-1/2 h-[44%] w-[14%] -translate-y-1/2 border-2 border-r-0 border-pitch-line" />
              <div className="absolute left-3 top-1/2 h-[20%] w-[5%] -translate-y-1/2 border-2 border-l-0 border-pitch-line" />
              <div className="absolute right-3 top-1/2 h-[20%] w-[5%] -translate-y-1/2 border-2 border-r-0 border-pitch-line" />
              <div className="absolute left-2 top-2 rounded bg-background/60 px-2 py-0.5 text-xs font-bold">{home.name} ←</div>
              <div className="absolute right-2 top-2 rounded bg-background/60 px-2 py-0.5 text-xs font-bold">→ {away.name}</div>
              {tokens.map((tk) => {
                const pl = pmap.get(tk.id);
                return (
                  <div key={tk.side + tk.id} className="absolute -translate-x-1/2 -translate-y-full transition-all duration-700 ease-out" style={{ left: `${tk.left}%`, top: `${tk.top}%`, transform: "translate(-50%,-100%) rotateX(-38deg)", transformOrigin: "50% 100%" }}>
                    <div className="flex flex-col items-center">
                      <div className="rounded-full border-2 shadow-lg" style={{ borderColor: tk.color }}>
                        <PlayerAvatar src={pl?.avatar_url} name={pl?.name ?? ""} className="size-7" />
                      </div>
                      <span className="mt-0.5 max-w-16 truncate rounded bg-background/70 px-1 text-[8px] font-bold">{pl?.name.split(" ").slice(-1)[0]}</span>
                      <div className="h-1 w-5 rounded-full bg-background/50 blur-[1px]" />
                    </div>
                  </div>
                );
              })}
              <div
                className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow-[0_0_14px_4px] shadow-foreground/40 transition-all duration-500 ease-out"
                style={{ left: `${bx}%`, top: `${by}%` }}
              />
              {popup && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="glass animate-pop flex items-center gap-4 px-6 py-4" dir="rtl">
                    <PlayerAvatar src={popup.playerId ? pmap.get(popup.playerId)?.avatar_url : null} name={popup.playerName ?? ""} className="size-16 border-2 border-neon" />
                    <div>
                      <p className={cn("text-3xl font-black", popup.type === "goal" ? "neon-text" : popup.type === "red" ? "text-card-red" : "text-card-yellow")}>
                        {popup.type === "goal" ? "גוללל!" : popup.type === "red" ? "כרטיס אדום" : "כרטיס צהוב"}
                      </p>
                      <p className="font-bold">{popup.playerName}</p>
                      {popup.assistName && <p className="text-xs text-muted-foreground">בישול: {popup.assistName}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${(minute / 90) * 100}%` }} />
            </div>
          </div>
            {live && mySide && extra.xi && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-secondary/60 p-3 text-sm" dir="rtl">
                <b>🔄 חילוף ({extra.subs?.[mySide] ?? 0}/3)</b>
                <select value={subOut} onChange={(e) => setSubOut(e.target.value)} className="rounded bg-background px-2 py-1">
                  <option value="">יוצא...</option>
                  {onNow.map((x) => <option key={x.id} value={x.id}>{pmap.get(x.id)?.name} ({x.pos})</option>)}
                </select>
                <select value={subIn} onChange={(e) => setSubIn(e.target.value)} className="rounded bg-background px-2 py-1">
                  <option value="">נכנס...</option>
                  {benchAvail.map((id) => <option key={id} value={id}>{pmap.get(id)?.name} ({pmap.get(id)?.detailed_position})</option>)}
                </select>
                <Button size="sm" disabled={busy || (extra.subs?.[mySide] ?? 0) >= 3} onClick={doSub}>בצע חילוף</Button>
              </div>
            )}
          </div>
          {/* Feed */}
          <div className="glass flex max-h-[560px] flex-col p-4">
            <p className="mb-3 text-xs font-bold text-muted-foreground">עדכונים חיים</p>
            <ul className="flex-1 space-y-2 overflow-y-auto">
              {[...shown].reverse().filter((e) => e.type !== "attack" || isLive).map((e, i) => {
                const p = e.playerId ? pmap.get(e.playerId) : undefined;
                const big = e.type === "goal" || e.type === "red" || e.type === "yellow";
                return (
                  <li key={`${e.minute}-${i}`} className={cn("flex items-center gap-3 rounded-lg p-2 animate-in fade-in slide-in-from-top-2", big && "bg-accent/60", e.type === "goal" && "neon-glow")}>
                    <span className="w-8 text-xs font-bold text-muted-foreground tabular">{e.minute}'</span>
                    <span className="text-base">{ICON[e.type]}</span>
                    {e.playerName && big && <PlayerAvatar src={p?.avatar_url} name={e.playerName} className="size-8" />}
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm", big && "font-bold")}>{e.text}</p>
                      <p className="text-[10px] text-muted-foreground">{e.side === "home" ? home.name : away.name}</p>
                    </div>
                  </li>
                );
              })}
              {shown.length === 0 && <li className="text-sm text-muted-foreground">שריקת פתיחה...</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamSide({ name, logo, color, label }: { name: string; logo: string | null; color: string; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2 text-center">
      <TeamLogo src={logo} name={name} color={color} className="size-16 rounded-xl text-lg" />
      <p className="text-lg font-black">{name}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function StatBar({ label, a, b }: { label: string; a: number; b: number }) {
  const total = a + b || 1;
  return (
    <div>
      <div className="mb-1 flex justify-between font-bold tabular">
        <span>{a}</span>
        <span className="text-muted-foreground">{label}</span>
        <span>{b}</span>
      </div>
      <div className="flex h-1.5 gap-1 overflow-hidden rounded-full">
        <div className="rounded-full bg-neon" style={{ width: `${(a / total) * 100}%` }} />
        <div className="rounded-full bg-cyan" style={{ width: `${(b / total) * 100}%` }} />
      </div>
    </div>
  );
}
