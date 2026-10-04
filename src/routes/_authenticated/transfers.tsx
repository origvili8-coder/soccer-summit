import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, Empty } from "@/components/PageHeader";
import { PlayerAvatar, PosBadge, TeamLogo } from "@/components/PlayerAvatar";
import { useMe, usePlayers, useProfiles, useSettings, useTeams, type Player } from "@/lib/data";
import { formatMoney } from "@/lib/formations";
import { sendOffer } from "@/lib/offers";

export const Route = createFileRoute("/_authenticated/transfers")({
  head: () => ({
    meta: [
      { title: "שוק העברות — ליגת העל מנג'ר" },
      { name: "description", content: "חיפוש שחקנים ברשימת ההעברות והגשת הצעות רכש." },
      { property: "og:title", content: "שוק העברות — ליגת העל מנג'ר" },
      { property: "og:description", content: "חיפוש שחקנים ברשימת ההעברות והגשת הצעות רכש." },
    ],
  }),
  component: TransfersPage,
});

function TransfersPage() {
  const { data: me } = useMe();
  const { data: players = [] } = usePlayers();
  const { data: teams = [] } = useTeams();
  const { data: profiles = [] } = useProfiles();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [pos, setPos] = useState("");
  const [all, setAll] = useState(false);
  const myTeam = me?.profile?.team_id;
  const teamName = (id: string | null) => teams.find((t) => t.id === id);

  const list = players.filter(
    (p) => p.team_id && p.team_id !== myTeam && (all || p.transfer_listed) && (!pos || p.position === pos) && p.name.includes(q),
  ).sort((a, b) => b.rating - a.rating);

  const { data: settings } = useSettings();
  const offer = async (p: Player, loan = false) => {
    if (!myTeam || !me) return toast.error("אין לך קבוצה");
    let loanRounds: number | undefined;
    if (loan) {
      const r = prompt(`השאלת ${p.name} — לכמה מחזורים?`, "3");
      if (!r) return;
      loanRounds = Math.max(1, parseInt(r, 10) || 1);
    }
    const v = prompt(loan ? `דמי השאלה עבור ${p.name} (₪)` : `הצעה עבור ${p.name} (₪)`, String(loan ? 300_000 : p.asking_price || 1_000_000));
    if (!v) return;
    try {
      const seller = profiles.find((x) => x.team_id === p.team_id);
      await sendOffer(p, myTeam, me.userId, seller?.id, parseInt(v, 10) || 0, loanRounds);
      toast.success("ההצעה נשלחה");
      qc.invalidateQueries();
      if (seller) nav({ to: "/chat" });
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <PageHeader kicker="TRANSFER HUB" title="שוק העברות" actions={myTeam && <span className="glass rounded-lg px-3 py-2 text-sm tabular">תקציב: <b className="text-neon">{formatMoney(teamName(myTeam)?.budget ?? 0)}</b></span>} />
      {settings && !settings.transfer_window_open && <div className="glass mb-4 border border-destructive/50 p-3 text-sm font-bold text-destructive">🔒 חלון ההעברות סגור כרגע — לא ניתן לשלוח הצעות.</div>}
      <div className="mb-4 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש שחקן" className="glass rounded-lg px-3 py-2 text-sm" />
        <select value={pos} onChange={(e) => setPos(e.target.value)} className="glass rounded-lg px-3 py-2 text-sm">
          <option value="">כל העמדות</option><option>GK</option><option>DEF</option><option>MID</option><option>FWD</option>
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> הצג את כל השחקנים בליגה (הצעה ישירה)</label>
      </div>
      {list.length === 0 ? <Empty>אין שחקנים תואמים.</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const t = teamName(p.team_id);
            return (
              <div key={p.id} className="glass flex items-center gap-3 p-3">
                <PlayerAvatar src={p.avatar_url} name={p.name} className="size-12" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{p.name}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <PosBadge pos={p.position} /> {p.rating}
                    {t && <><TeamLogo src={t.logo_url} name={t.short_name} color={t.color} className="size-5 text-[8px]" />{t.name}</>}
                  </div>
                  {p.transfer_listed && <div className="text-xs text-gold tabular">{formatMoney(p.asking_price)}</div>}
                </div>
                {myTeam && !p.loan_from_team_id && settings?.transfer_window_open !== false && (
                  <div className="flex flex-col gap-1">
                    <button onClick={() => offer(p)} className="rounded-lg bg-neon px-3 py-1.5 text-xs font-bold text-background">הצעת קנייה</button>
                    <button onClick={() => offer(p, true)} className="rounded-lg bg-cyan/20 px-3 py-1.5 text-xs font-bold text-cyan">הצעת השאלה</button>
                  </div>
                )}
                {p.loan_from_team_id && <span className="text-[11px] text-cyan">בהשאלה</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
