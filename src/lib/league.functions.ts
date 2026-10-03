import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runMatch } from "./match-runner.server";
import { normalizeUsername, usernameToEmail } from "./formations";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("רק מנהל הליגה מורשה");
}

export const ownerExists = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
  return { exists: (count ?? 0) > 0 };
});

const credSchema = z.object({
  username: z.string().min(2).max(30),
  password: z.string().min(6).max(72),
  displayName: z.string().max(60).default(""),
});

async function createAccount(username: string, password: string, displayName: string, teamId: string | null, role: "admin" | "manager") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const u = normalizeUsername(username);
  if (u.length < 2) throw new Error("שם משתמש לא תקין (אותיות באנגלית/מספרים)");
  const { data: exists } = await supabaseAdmin.from("profiles").select("id").eq("username", u).maybeSingle();
  if (exists) throw new Error("שם המשתמש תפוס");
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: usernameToEmail(u),
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(error?.message ?? "יצירת משתמש נכשלה");
  const id = data.user.id;
  const { error: pe } = await supabaseAdmin.from("profiles").insert({ id, username: u, display_name: displayName || u, team_id: teamId });
  if (pe) throw new Error(pe.message);
  await supabaseAdmin.from("user_roles").insert({ user_id: id, role });
  return { id, username: u };
}

export const bootstrapOwner = createServerFn({ method: "POST" })
  .inputValidator((d) => credSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("כבר קיים מנהל ליגה");
    return createAccount(data.username, data.password, data.displayName, null, "admin");
  });

export const createManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => credSchema.extend({ teamId: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    return createAccount(data.username, data.password, data.displayName, data.teamId, "manager");
  });

export const updateManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ userId: z.string().uuid(), teamId: z.string().uuid().nullable(), password: z.string().min(6).max(72).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.teamId) await supabaseAdmin.from("profiles").update({ team_id: null }).eq("team_id", data.teamId).neq("id", data.userId);
    await supabaseAdmin.from("profiles").update({ team_id: data.teamId }).eq("id", data.userId);
    if (data.password) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("לא ניתן למחוק את עצמך");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.auth.admin.deleteUser(data.userId);
    return { ok: true };
  });

export const setReady = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ matchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: me } = await supabaseAdmin.from("profiles").select("team_id").eq("id", context.userId).single();
    const { data: m } = await supabaseAdmin.from("matches").select("*, rounds(status)").eq("id", data.matchId).single();
    if (!m) throw new Error("המשחק לא נמצא");
    if (m.status === "finished") return { started: true };
    if ((m as any).rounds?.status !== "active") throw new Error("המחזור נעול — יש לסיים את המחזור הקודם");
    const isHome = me?.team_id === m.home_team_id;
    const isAway = me?.team_id === m.away_team_id;
    if (!isHome && !isAway) throw new Error("אינך מאמן באחת הקבוצות");
    // Teams with no manager are auto-ready
    const { data: managers } = await supabaseAdmin.from("profiles").select("team_id").in("team_id", [m.home_team_id, m.away_team_id]);
    const homeManaged = managers?.some((p) => p.team_id === m.home_team_id);
    const awayManaged = managers?.some((p) => p.team_id === m.away_team_id);
    const homeReady = isHome || m.home_ready || !homeManaged;
    const awayReady = isAway || m.away_ready || !awayManaged;
    await supabaseAdmin.from("matches").update({ home_ready: homeReady, away_ready: awayReady }).eq("id", m.id);
    if (homeReady && awayReady) {
      await runMatch(supabaseAdmin, m.id);
      return { started: true };
    }
    return { started: false };
  });

export const adminPlayMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ matchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m } = await supabaseAdmin.from("matches").select("*, rounds(status)").eq("id", data.matchId).single();
    if ((m as any)?.rounds?.status !== "active") throw new Error("ניתן לשחק רק משחקים במחזור הפעיל");
    await runMatch(supabaseAdmin, data.matchId);
    return { ok: true };
  });

export const activateNextRound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: active } = await supabaseAdmin.from("rounds").select("id, number").eq("status", "active");
    for (const r of active ?? []) {
      const { count } = await supabaseAdmin
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("round_id", r.id)
        .neq("status", "finished");
      if ((count ?? 0) > 0) throw new Error(`מחזור ${r.number} עדיין לא הסתיים — כל המשחקים חייבים להסתיים`);
      await supabaseAdmin.from("rounds").update({ status: "completed" }).eq("id", r.id);
    }
    const { data: next } = await supabaseAdmin.from("rounds").select("id, number").eq("status", "pending").order("number").limit(1).maybeSingle();
    if (!next) throw new Error("אין מחזור הבא — צור מחזור חדש");
    const { count: mc } = await supabaseAdmin.from("matches").select("id", { count: "exact", head: true }).eq("round_id", next.id);
    if (!mc) throw new Error(`למחזור ${next.number} אין משחקים`);
    await supabaseAdmin.from("rounds").update({ status: "active" }).eq("id", next.id);
    return { number: next.number };
  });

export const makeSubstitution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ matchId: z.string().uuid(), outId: z.string().uuid(), inId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { substitute } = await import("./match-runner.server");
    const { data: me } = await supabaseAdmin.from("profiles").select("team_id").eq("id", context.userId).single();
    const { data: m } = await supabaseAdmin.from("matches").select("home_team_id, away_team_id").eq("id", data.matchId).single();
    if (!m || !me?.team_id) throw new Error("אינך מאמן במשחק הזה");
    const side = me.team_id === m.home_team_id ? "home" : me.team_id === m.away_team_id ? "away" : null;
    if (!side) throw new Error("אינך מאמן במשחק הזה");
    await substitute(supabaseAdmin, data.matchId, side, data.outId, data.inId);
    return { ok: true };
  });

export const announceTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ offerId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { publishNews } = await import("./news.server");
    const kind = `transfer:${data.offerId}`;
    const { data: exists } = await supabaseAdmin.from("news").select("id").eq("kind", kind).maybeSingle();
    if (exists) return { ok: true };
    const { data: o } = await supabaseAdmin.from("transfer_offers").select("*").eq("id", data.offerId).single();
    if (!o || o.status !== "accepted") throw new Error("העסקה לא בוצעה");
    const [{ data: p }, { data: teams }] = await Promise.all([
      supabaseAdmin.from("players").select("name, detailed_position, rating").eq("id", o.player_id).single(),
      supabaseAdmin.from("teams").select("id, name").in("id", [o.buyer_team_id, o.seller_team_id]),
    ]);
    const buyer = teams?.find((t) => t.id === o.buyer_team_id)?.name ?? "";
    const seller = teams?.find((t) => t.id === o.seller_team_id)?.name ?? "";
    const amount = `₪${(o.amount / 1_000_000).toFixed(1)}M`;
    await publishNews(
      supabaseAdmin,
      kind,
      `העברה רשמית: ${p?.name} (${p?.detailed_position}, רייטינג ${p?.rating}) עובר מ${seller} ל${buyer} תמורת ${amount}.`,
      `רשמי: ${p?.name} עובר ל${buyer}`,
    );
    return { ok: true };
  });
