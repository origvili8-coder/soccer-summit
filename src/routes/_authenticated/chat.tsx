import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty } from "@/components/PageHeader";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useMe, useMessages, useOffers, usePlayers, useProfiles, useTeams, type Offer } from "@/lib/data";
import { formatMoney } from "@/lib/formations";
import { sendOffer } from "@/lib/offers";
import { useServerFn } from "@tanstack/react-start";
import { announceTransfer } from "@/lib/league.functions";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "צ'אט ומשא ומתן — ליגת העל מנג'ר" },
      { name: "description", content: "צ'אט בזמן אמת בין מנג'רים עם כרטיסי הצעות העברה." },
      { property: "og:title", content: "צ'אט ומשא ומתן — ליגת העל מנג'ר" },
      { property: "og:description", content: "צ'אט בזמן אמת בין מנג'רים עם כרטיסי הצעות העברה." },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { data: me } = useMe();
  const { data: profiles = [] } = useProfiles();
  const { data: messages = [] } = useMessages();
  const { data: offers = [] } = useOffers();
  const { data: players = [] } = usePlayers();
  const { data: teams = [] } = useTeams();
  const qc = useQueryClient();
  const announce = useServerFn(announceTransfer);
  const [peer, setPeer] = useState<string | null>(null);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const others = profiles.filter((p) => p.id !== me?.userId);
  const thread = messages.filter((m) => (m.sender_id === peer && m.recipient_id === me?.userId) || (m.recipient_id === peer && m.sender_id === me?.userId));
  const peerProfile = profiles.find((p) => p.id === peer);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [thread.length]);

  const send = async () => {
    if (!text.trim() || !peer || !me) return;
    const { error } = await supabase.from("messages").insert({ sender_id: me.userId, recipient_id: peer, body: text.trim() });
    if (error) return toast.error(error.message);
    setText("");
    qc.invalidateQueries({ queryKey: ["messages"] });
  };

  const act = async (o: Offer, accept: boolean) => {
    const { error } = accept ? await supabase.rpc("accept_offer", { _offer_id: o.id }) : await supabase.rpc("cancel_or_reject_offer", { _offer_id: o.id });
    if (error) return toast.error(error.message);
    toast.success(accept ? "העסקה בוצעה!" : "ההצעה נדחתה");
    if (accept) announce({ data: { offerId: o.id } }).catch(() => {});
    qc.invalidateQueries();
  };

  const offerFromChat = async () => {
    if (!peerProfile?.team_id || !me?.profile?.team_id) return toast.error("לשני הצדדים צריכה להיות קבוצה");
    const theirs = players.filter((p) => p.team_id === peerProfile.team_id);
    const name = prompt(`איזה שחקן? (${theirs.map((p) => p.name).join(", ")})`);
    const p = theirs.find((x) => x.name === name?.trim());
    if (!p) return toast.error("שחקן לא נמצא");
    const v = prompt("סכום (₪)", String(p.asking_price || 1_000_000));
    if (!v) return;
    try { await sendOffer(p, me.profile.team_id, me.userId, peerProfile.id, parseInt(v, 10) || 0); qc.invalidateQueries(); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <PageHeader kicker="LIVE CHAT" title="צ'אט ומשא ומתן" />
      <div className="grid h-[70vh] gap-4 md:grid-cols-[240px_1fr]">
        <div className="glass space-y-1 overflow-y-auto p-2">
          {others.map((p) => (
            <button key={p.id} onClick={() => setPeer(p.id)} className={`flex w-full items-center gap-2 rounded-lg p-2 text-start ${peer === p.id ? "bg-neon/15" : "hover:bg-secondary"}`}>
              <PlayerAvatar name={p.display_name} />
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{p.display_name}</div>
                <div className="truncate text-xs text-muted-foreground">{teams.find((t) => t.id === p.team_id)?.name ?? "ללא קבוצה"}</div>
              </div>
            </button>
          ))}
        </div>
        {!peer ? <Empty>בחר מנג'ר כדי להתחיל שיחה.</Empty> : (
          <div className="glass flex min-h-0 flex-col">
            <div className="flex items-center justify-between border-b border-border p-3">
              <b>{peerProfile?.display_name}</b>
              <button onClick={offerFromChat} className="rounded-lg bg-gold/20 px-3 py-1 text-xs font-bold text-gold">💰 הצעת העברה</button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {thread.map((m) => {
                const mine = m.sender_id === me?.userId;
                const o = m.offer_id ? offers.find((x) => x.id === m.offer_id) : undefined;
                const pl = o && players.find((p) => p.id === o.player_id);
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                    <div className={`pop-in max-w-[75%] rounded-xl p-3 text-sm ${mine ? "bg-neon/15" : "bg-secondary"}`}>
                      {o ? (
                        <div className="space-y-2">
                          <div className="text-xs font-bold text-gold">הצעת העברה</div>
                          <div className="flex items-center gap-2">
                            <PlayerAvatar src={pl?.avatar_url} name={pl?.name ?? "?"} />
                            <div><b>{pl?.name}</b><div className="tabular text-neon">{formatMoney(o.amount)}</div></div>
                          </div>
                          {o.status === "pending" ? (
                            <div className="flex gap-2">
                              {o.seller_team_id === me?.profile?.team_id && (
                                <button onClick={() => act(o, true)} className="rounded bg-neon px-3 py-1 text-xs font-bold text-background">אשר עסקה</button>
                              )}
                              <button onClick={() => act(o, false)} className="rounded bg-destructive/30 px-3 py-1 text-xs font-bold">{mine ? "בטל" : "דחה"}</button>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">{({ accepted: "✅ בוצעה", rejected: "❌ נדחתה", cancelled: "בוטלה" } as Record<string, string>)[o.status]}</div>
                          )}
                        </div>
                      ) : m.body}
                      <div className="mt-1 text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 border-t border-border p-3">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="כתוב הודעה..." className="flex-1 rounded-lg bg-secondary px-3 py-2 text-sm" />
              <button className="rounded-lg bg-neon px-4 text-sm font-bold text-background">שלח</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
