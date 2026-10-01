import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, CheckCircle2, Radio } from "lucide-react";
import { matchPhase, useMatches, useRounds, useTeams } from "@/lib/data";
import { PageHeader, Empty } from "@/components/PageHeader";
import { TeamLogo } from "@/components/PlayerAvatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/fixtures")({
  head: () => ({
    meta: [
      { title: "מחזורים ותוצאות — ליגת העל מנג'ר" },
      { name: "description", content: "כל מחזורי ליגת העל, תוצאות ומשחקים קרובים." },
      { property: "og:title", content: "מחזורים ותוצאות — ליגת העל מנג'ר" },
      { property: "og:description", content: "כל מחזורי ליגת העל ותוצאות." },
    ],
  }),
  component: Fixtures,
});

const STATUS = {
  pending: { label: "נעול", cls: "bg-muted text-muted-foreground", icon: Lock },
  active: { label: "פעיל", cls: "bg-primary/20 text-neon", icon: Radio },
  completed: { label: "הסתיים", cls: "bg-cyan/20 text-cyan", icon: CheckCircle2 },
} as const;

function Fixtures() {
  const rounds = useRounds();
  const matches = useMatches();
  const teams = useTeams();
  const [sel, setSel] = useState<string | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 5000);
    return () => clearInterval(t);
  }, []);
  const list = rounds.data ?? [];
  const current = sel ?? list.find((r) => r.status === "active")?.id ?? list[list.length - 1]?.id;
  const round = list.find((r) => r.id === current);
  const teamById = new Map((teams.data ?? []).map((t) => [t.id, t]));
  const ms = (matches.data ?? []).filter((m) => m.round_id === current);

  return (
    <div>
      <PageHeader kicker="FIXTURES" title="מחזורים ותוצאות" />
      {list.length === 0 ? (
        <Empty>עדיין לא נקבעו מחזורים.</Empty>
      ) : (
        <>
          <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
            {list.map((r) => {
              const S = STATUS[r.status as keyof typeof STATUS];
              return (
                <button
                  key={r.id}
                  onClick={() => setSel(r.id)}
                  className={cn(
                    "glass flex shrink-0 items-center gap-2 px-4 py-2 text-sm font-bold transition",
                    r.id === current && "neon-glow",
                  )}
                >
                  <S.icon className={cn("size-3.5", r.status === "active" ? "text-neon" : "text-muted-foreground")} />
                  מחזור {r.number}
                </button>
              );
            })}
          </div>
          {round && (
            <div className="mb-4 flex items-center gap-2 text-sm">
              <span className={cn("rounded-full px-3 py-1 text-xs font-bold", STATUS[round.status as keyof typeof STATUS].cls)}>
                {STATUS[round.status as keyof typeof STATUS].label}
              </span>
              {round.status === "pending" && <span className="text-muted-foreground">המחזור ייפתח רק אחרי שכל משחקי המחזור הקודם יסתיימו.</span>}
            </div>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            {ms.length === 0 && <Empty>אין משחקים במחזור זה.</Empty>}
            {ms.map((m) => {
              const h = teamById.get(m.home_team_id);
              const a = teamById.get(m.away_team_id);
              const phase = matchPhase(m);
              return (
                <Link key={m.id} to="/match/$matchId" params={{ matchId: m.id }} className="glass flex items-center gap-3 p-4 transition hover:bg-accent/50">
                  <div className="flex flex-1 items-center justify-end gap-2 text-sm font-bold">
                    {h?.name}
                    <TeamLogo src={h?.logo_url} name={h?.name ?? "?"} color={h?.color} />
                  </div>
                  <div className="w-24 text-center">
                    {phase === "scheduled" ? (
                      <div>
                        <p className="text-sm font-bold text-muted-foreground">VS</p>
                        <p className="text-[10px] text-muted-foreground">
                          {m.home_ready || m.away_ready ? "ממתין למוכנות" : "טרם שוחק"}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-2xl font-black tabular" dir="ltr">
                          {phase === "live" ? "•" : `${m.home_score} - ${m.away_score}`}
                        </p>
                        <p className={cn("text-[10px] font-bold", phase === "live" ? "text-destructive" : "text-muted-foreground")}>
                          {phase === "live" ? "LIVE" : "סיום"}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 items-center gap-2 text-sm font-bold">
                    <TeamLogo src={a?.logo_url} name={a?.name ?? "?"} color={a?.color} />
                    {a?.name}
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
