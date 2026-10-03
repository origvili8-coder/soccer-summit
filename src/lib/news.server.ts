import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Writes a Hebrew sports-news item using AI; falls back to a plain headline if AI is unavailable. */
export async function publishNews(admin: SupabaseClient<Database>, kind: string, facts: string, fallbackTitle: string) {
  let title = fallbackTitle;
  let body = facts;
  try {
    const key = process.env["LOVABLE_API_KEY"];
    if (key) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: 'אתה כתב ספורט ישראלי בסגנון ספורט5/ONE. כתוב ידיעה קצרה ודרמטית בעברית על בסיס העובדות בלבד. החזר JSON בלבד: {"title": "...", "body": "..."} — כותרת עד 10 מילים, גוף 2-3 משפטים.' },
            { role: "user", content: facts },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (res.ok) {
        const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}") as { title?: string; body?: string };
        if (parsed.title) title = parsed.title;
        if (parsed.body) body = parsed.body;
      } else console.error("news AI failed", res.status);
    }
  } catch (e) {
    console.error("news AI error", e);
  }
  await admin.from("news").insert({ kind, title, body });
}
