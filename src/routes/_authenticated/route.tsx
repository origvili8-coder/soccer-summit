import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, LayoutDashboard, Newspaper, LogOut, MessagesSquare, Repeat, Shield, Shirt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, useTeams } from "@/lib/data";
import { formatMoney } from "@/lib/formations";
import { TeamLogo } from "@/components/PlayerAvatar";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/" });
    return { user: data.user };
  },
  component: AppShell,
});

const NAV = [
  { to: "/dashboard", label: "טבלה", icon: LayoutDashboard },
  { to: "/fixtures", label: "מחזורים", icon: CalendarDays },
  { to: "/squad", label: "סגל וטקטיקה", icon: Shirt },
  { to: "/transfers", label: "שוק העברות", icon: Repeat },
  { to: "/chat", label: "צ'אט ומשא ומתן", icon: MessagesSquare },
  { to: "/news", label: "חדשות", icon: Newspaper },
] as const;

function AppShell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const me = useMe();
  const teams = useTeams();
  const myTeam = teams.data?.find((t) => t.id === me.data?.profile?.team_id);

  useEffect(() => {
    const ch = supabase
      .channel("league-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        qc.invalidateQueries({ queryKey: ["matches"] });
        qc.invalidateQueries({ queryKey: ["players"] });
        qc.invalidateQueries({ queryKey: ["rounds"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "transfer_offers" }, () => {
        qc.invalidateQueries({ queryKey: ["offers"] });
        qc.invalidateQueries({ queryKey: ["players"] });
        qc.invalidateQueries({ queryKey: ["teams"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "news" }, () => {
        qc.invalidateQueries({ queryKey: ["news"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["messages"] });
        qc.invalidateQueries({ queryKey: ["offers"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const linkCls =
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground";
  const activeCls = "!bg-primary/15 !text-neon";

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-l border-sidebar-border bg-sidebar p-4 backdrop-blur md:flex">
        <div className="mb-6 px-2">
          <p className="text-[10px] font-bold tracking-[0.3em] text-neon">ISRAELI PREMIER LEAGUE</p>
          <p className="font-display text-xl font-black">ליגת העל מנג'ר</p>
        </div>
        {myTeam && (
          <div className="glass mb-4 flex items-center gap-3 p-3">
            <TeamLogo src={myTeam.logo_url} name={myTeam.name} color={myTeam.color} className="size-10" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{myTeam.name}</p>
              <p className="text-xs text-neon tabular">{formatMoney(myTeam.budget)}</p>
            </div>
          </div>
        )}
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={linkCls} activeProps={{ className: activeCls }}>
              <n.icon className="size-4" /> {n.label}
            </Link>
          ))}
          {me.data?.isAdmin && (
            <Link to="/admin" className={linkCls} activeProps={{ className: activeCls }}>
              <Shield className="size-4" /> פאנל ניהול
            </Link>
          )}
        </nav>
        <div className="border-t border-sidebar-border pt-3">
          <p className="px-2 text-xs text-muted-foreground">
            {me.data?.profile?.display_name} {me.data?.isAdmin && "· מנהל ליגה"}
          </p>
          <button onClick={signOut} className={linkCls + " mt-1 w-full"}>
            <LogOut className="size-4" /> התנתקות
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-1 overflow-x-auto border-b border-border bg-sidebar p-2 backdrop-blur md:hidden">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={linkCls + " shrink-0 py-2"} activeProps={{ className: activeCls }}>
              <n.icon className="size-4" /> {n.label}
            </Link>
          ))}
          {me.data?.isAdmin && (
            <Link to="/admin" className={linkCls + " shrink-0 py-2"} activeProps={{ className: activeCls }}>
              <Shield className="size-4" /> ניהול
            </Link>
          )}
          <button onClick={signOut} className={linkCls + " shrink-0 py-2"} aria-label="התנתקות">
            <LogOut className="size-4" />
          </button>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
