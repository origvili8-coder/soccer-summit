import { supabase } from "@/integrations/supabase/client";
import type { Player } from "./data";
import { formatMoney } from "./formations";

export async function sendOffer(p: Player, myTeamId: string, userId: string, sellerUserId: string | undefined, amount: number) {
  const { data, error } = await supabase
    .from("transfer_offers")
    .insert({ player_id: p.id, buyer_team_id: myTeamId, seller_team_id: p.team_id!, amount, created_by: userId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (sellerUserId) {
    await supabase.from("messages").insert({ sender_id: userId, recipient_id: sellerUserId, body: `הצעה על ${p.name}: ${formatMoney(amount)}`, offer_id: data.id });
  }
}
