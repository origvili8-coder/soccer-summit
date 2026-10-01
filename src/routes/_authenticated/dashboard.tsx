import { createFileRoute, Link } from "@tanstack/react-router";
import { computeStandings, matchPhase, useMatches, useMe, usePlayers, useRounds, useTeams } from "@/lib/data";
import { PageHeader, Empty } from "@/components/PageHeader";
import { PlayerAvatar, TeamLogo } from "@/components/PlayerAvatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "טבלת הליגה — ליגת העל מנג'ר" },
      { name: "description", content: "טבלת ליגת העל, מלכי שערים והמשחק הבא של הקבוצה שלך." },
      { property: "og:title", content: "טבלת הליגה — ליגת העל מנג'ר" },
      { property: "og:description", content: "טבלת ליגת העל ומלכי שערים." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const teams = useTeams();
  const matches = useMatches();
  const players = usePlayers();
  const rounds = useRounds();
  const me = useMe();
  const rows = computeStandings(teams.data ?? [], matches.data ?? []);
  const myTeamId = me.data?.profile?.team_id;
  const active = rounds.data?.find((r) => r.status === "active");
  const nextMatch = matches.data?.find(
    (m) => m.round_id === active?.id && (m.home_team_id === myTeamId || m.away_team_id === myTeamId),
  );
  const teamById = new Map((teams.data ?? []).map((t) => [t.id, t]));
  const scorers = [...(players.data ?? [])].filter((p) => p.goals > 0).sort((a, b) => b.goals - a.goals).slice(0, 6);

  return (
    <div>
      <PageHeader kicker="LEAGUE TABLE" title="טבלת ליגת העל" />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="glass overflow-x-auto">
          {rows.length === 0 ? (
            <Empty>עדיין אין קבוצות. מנהל הליגה יוסיף אותן בפאנל הניהול.</Empty>
          ) : (
            <table className="w-full text-sm tabular">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="p-3 text-right">#</th>
                  <th className="p-3 text-right">קבוצה</th>
                  {["MP", "W", "D", "L", "GF", "GA", "GD", "PTS"].map((h) => (
                    <th key={h} className={cn("p-3 text-center", h === "PTS" && "text-neon")}>{h}</th>
                  ))}
                  <th className="hidden p-3 text-center lg:table-cell">כושר</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.team.id} className={cn("border-b border-border/50 transition-colors hover:bg-accent/40", r.team.id === myTeamId && "bg-primary/10")}>
                    <td className="p-3">
                      <span className={cn("inline-block w-6 border-r-2 pr-2 font-bold", i === 0 ? "border-neon" : i < 3 ? "border-cyan" : i >= rows.length - 2 && rows.length > 4 ? "border-destructive" : "border-transparent")}>{i + 1}</span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2.5 font-medium">
                        <TeamLogo src={r.team.logo_url} name={r.team.name} color={r.team.color} className="size-7" />
                        {r.team.name}
                      </div>
                    </td>
                    <td className="p-3 text-center">{r.mp}</td>
                    <td className="p-3 text-center">{r.w}</td>
                    <td className="p-3 text-center">{r.d}</td>
                    <td className="p-3 text-center">{r.l}</td>
                    <td className="p-3 text-center">{r.gf}</td>
                    <td className="p-3 text-center">{r.ga}</td>
                    <td className="p-3 text-center" dir="ltr">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                    <td className="p-3 text-center text-base font-black text-neon">{r.pts}</td>
                    <td className="hidden p-3 lg:table-cell">
                      <div className="flex justify-center gap-1">
                        {r.form.map((f, k) => (
                          <span key={k} className={cn("flex size-5 items-center justify-center rounded text-[10px] font-bold", f === "W" ? "bg-neon/25 text-neon" : f === "D" ? "bg-muted text-muted-foreground" : "bg-destructive/25 text-destructive")}>
                            {f === "W" ? "נ" : f === "D" ? "ת" : "ה"}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="space-y-6">
          <div className="glass p-5">
            <p className="mb-3 text-xs font-bold text-muted-foreground">המשחק הבא שלך {active && `· מחזור ${active.number}`}</p>
            {nextMatch ? (
              <Link to="/match/$matchId" params={{ matchId: nextMatch.id }} className="block">
                <div className="flex items-center justify-between gap-2">
                  {[nextMatch.home_team_id, nextMatch.away_team_id].map((id, k) => {
                    const t = teamById.get(id);
                    return (
                      <div key={id} className={cn("flex flex-1 flex-col items-center gap-2 text-center", k === 1 && "order-3")}>
                        <TeamLogo src={t?.logo_url} name={t?.name ?? "?"} color={t?.color} className="size-12" />
                        <span className="text-sm font-bold">{t?.name}</span>
                      </div>
                    );
                  })}
                  <span className="order-2 text-2xl font-black tabular">
                    {matchPhase(nextMatch) === "scheduled" ? "VS" : `${nextMatch.home_score}-${nextMatch.away_score}`}
                  </span>
                </div>
                <div className="mt-4 rounded-lg bg-primary py-2 text-center text-sm font-bold text-primary-foreground">למרכז המשחק</div>
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">{myTeamId ? "אין משחק במחזור הפעיל." : "לא שויכת לקבוצה עדיין."}</p>
            )}
          </div>
          <div className="glass p-5">
            <p className="mb-3 text-xs font-bold text-muted-foreground">מלכי השערים</p>
            {scorers.length === 0 && <p className="text-sm text-muted-foreground">עוד לא הובקעו שערים.</p>}
            <ul className="space-y-2.5">
              {scorers.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3">
                  <span className="w-4 text-xs text-muted-foreground tabular">{i + 1}</span>
                  <PlayerAvatar src={p.avatar_url} name={p.name} className="size-8" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.team_id ? teamById.get(p.team_id)?.name : "ללא קבוצה"}</p>
                  </div>
                  <span className="font-black text-neon tabular">{p.goals}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
