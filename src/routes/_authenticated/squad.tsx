import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty } from "@/components/PageHeader";
import { PlayerAvatar, PosBadge } from "@/components/PlayerAvatar";
import { useMe, usePlayers, useSettings, useTeams, type Player } from "@/lib/data";
import { FORMATIONS, formationSlots, formatMoney, DETAIL_LABEL, type Detail } from "@/lib/formations";

export const Route = createFileRoute("/_authenticated/squad")({
  head: () => ({
    meta: [
      { title: "סגל וטקטיקה — ליגת העל מנג'ר" },
      { name: "description", content: "בחירת מערך, שיבוץ הרכב ורישום שחקנים להעברה." },
      { property: "og:title", content: "סגל וטקטיקה — ליגת העל מנג'ר" },
      { property: "og:description", content: "בחירת מערך, שיבוץ הרכב ורישום שחקנים להעברה." },
    ],
  }),
  component: SquadPage,
});

function SquadPage() {
  const { data: me } = useMe();
  const { data: teams = [] } = useTeams();
  const { data: players = [] } = usePlayers();
  const qc = useQueryClient();
  const team = teams.find((t) => t.id === me?.profile?.team_id);
  const squad = useMemo(() => players.filter((p) => p.team_id === team?.id), [players, team?.id]);
  const [formation, setFormation] = useState("4-3-3");
  const [lineup, setLineup] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [bench, setBench] = useState<string[]>([]);
  const { data: settings } = useSettings();

  useEffect(() => {
    if (!team) return;
    setFormation(team.formation);
    setLineup((team.lineup ?? {}) as Record<string, string>);
    setBench((team.bench ?? []) as string[]);
  }, [team?.id, team?.formation, JSON.stringify(team?.lineup), JSON.stringify(team?.bench)]);

  if (!team) return <Empty>לא שויכה לך קבוצה. פנה למנהל הליגה.</Empty>;

  const slots = formationSlots(formation);
  const byId = new Map(squad.map((p) => [p.id, p]));
  const inXI = new Set(Object.values(lineup));

  const assign = (slot: number, pid: string) => {
    const p = byId.get(pid);
    if (!p || p.suspended_matches > 0) return toast.error("שחקן מושעה לא יכול לשחק");
    const next = Object.fromEntries(Object.entries(lineup).filter(([, v]) => v !== pid));
    next[String(slot)] = pid;
    setLineup(next);
    setBench((b) => b.filter((x) => x !== pid));
    setSelected(null);
  };

  const save = async () => {
    const clean = Object.fromEntries(Object.entries(lineup).filter(([k]) => Number(k) < slots.length));
    const { error } = await supabase.rpc("save_lineup_v2", { _formation: formation, _lineup: clean, _bench: bench.filter((x) => !Object.values(clean).includes(x)) });
    if (error) return toast.error(error.message);
    toast.success("ההרכב נשמר");
    qc.invalidateQueries({ queryKey: ["teams"] });
  };

  const toggleBench = (p: Player) => {
    if (inXI.has(p.id)) return toast.error("השחקן כבר בהרכב");
    if (p.suspended_matches > 0) return toast.error("שחקן מושעה");
    if (!bench.includes(p.id) && bench.length >= 5) return toast.error("ספסל מקסימום 5 שחקנים");
    setBench((b) => (b.includes(p.id) ? b.filter((x) => x !== p.id) : [...b, p.id]));
  };
  const train = async (p: Player) => {
    const cost = settings?.training_cost_per_point ?? 0;
    const v = prompt(`אימון ל${p.name} (רייטינג ${p.rating}). כמה נקודות? כל נקודה עולה ${formatMoney(cost)}`, "1");
    if (!v) return;
    const { error } = await supabase.rpc("train_player", { _player_id: p.id, _points: parseInt(v, 10) || 1 });
    if (error) return toast.error(error.message);
    toast.success("האימון הושלם! הרייטינג עלה");
    qc.invalidateQueries();
  };

  const toggleList = async (p: Player) => {
    let price = p.asking_price;
    if (!p.transfer_listed) {
      const v = prompt("מחיר מבוקש (₪)", String(p.asking_price || 1_000_000));
      if (v === null) return;
      price = Math.max(0, parseInt(v, 10) || 0);
    }
    const { error } = await supabase.rpc("set_transfer_listing", { _player_id: p.id, _listed: !p.transfer_listed, _price: price });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["players"] });
  };

  return (
    <div>
      <PageHeader
        kicker="SQUAD & TACTICS"
        title={team.name}
        actions={
          <div className="flex items-center gap-2">
            <select value={formation} onChange={(e) => setFormation(e.target.value)} className="glass rounded-lg px-3 py-2 text-sm">
              {FORMATIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <button onClick={save} className="neon-glow rounded-lg bg-neon px-4 py-2 text-sm font-bold text-background">שמור הרכב</button>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="pitch-bg relative aspect-[4/3] overflow-hidden rounded-2xl border border-border">
          {slots.map((s) => {
            const p = lineup[String(s.index)] ? byId.get(lineup[String(s.index)]!) : undefined;
            return (
              <button
                key={s.index}
                onClick={() => selected && assign(s.index, selected)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => assign(s.index, e.dataTransfer.getData("pid"))}
                className="absolute flex w-20 -translate-x-1/2 translate-y-1/2 flex-col items-center gap-1"
                style={{ left: `${s.x}%`, bottom: `${s.y}%` }}
              >
                {p ? <PlayerAvatar src={p.avatar_url} name={p.name} className="size-12 border-2 border-neon" /> : (
                  <div className="flex size-12 items-center justify-center rounded-full border-2 border-dashed border-foreground/40 text-[10px] font-bold">{s.pos}</div>
                )}
                <span className="max-w-full truncate rounded bg-background/70 px-1.5 text-[11px] font-bold">{p?.name ?? DETAIL_LABEL[s.pos as Detail]}</span>
              </button>
            );
          })}
        </div>
        <div className="glass max-h-[70vh] space-y-1 overflow-y-auto p-3">
          <p className="mb-2 text-xs text-muted-foreground">גרור שחקן לעמדה, או לחץ עליו ואז על עמדה במגרש. ספסל: {bench.length}/5 · תקציב: {formatMoney(team.budget)} · אימון: {formatMoney(settings?.training_cost_per_point ?? 0)} לנקודה</p>
          {squad.length === 0 && <p className="text-sm text-muted-foreground">אין שחקנים בסגל.</p>}
          {squad.map((p) => (
            <div
              key={p.id}
              draggable={p.suspended_matches === 0}
              onDragStart={(e) => e.dataTransfer.setData("pid", p.id)}
              onClick={() => setSelected(selected === p.id ? null : p.id)}
              className={`flex cursor-pointer items-center gap-2 rounded-lg p-2 ${selected === p.id ? "bg-neon/15" : "hover:bg-secondary"} ${p.suspended_matches ? "opacity-50" : ""}`}
            >
              <PlayerAvatar src={p.avatar_url} name={p.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{p.name} {inXI.has(p.id) && <span className="text-neon">●</span>}</div>
                <div className="flex gap-2 text-[11px] text-muted-foreground tabular">
                  <PosBadge pos={p.position} /> {p.detailed_position} · {p.rating} · ⚽{p.goals} · 🅰{p.assists} · 🟨{p.yellow_cards} · 🟥{p.red_cards}
                  {p.suspended_matches > 0 && <span className="text-destructive">מושעה</span>}
                  {p.loan_from_team_id && <span className="text-cyan">בהשאלה</span>}
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); toggleBench(p); }} className={`rounded px-2 py-1 text-[11px] font-bold ${bench.includes(p.id) ? "bg-cyan/25 text-cyan" : "bg-secondary"}`}>
                {bench.includes(p.id) ? `ספסל ${bench.indexOf(p.id) + 1}` : "ספסל"}
              </button>
              <button onClick={(e) => { e.stopPropagation(); train(p); }} className="rounded bg-neon/15 px-2 py-1 text-[11px] font-bold text-neon">אימון</button>
              <button
                onClick={(e) => { e.stopPropagation(); toggleList(p); }}
                className={`rounded px-2 py-1 text-[11px] font-bold ${p.transfer_listed ? "bg-gold/20 text-gold" : "bg-secondary"}`}
              >
                {p.transfer_listed ? formatMoney(p.asking_price) : "למכירה"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
