import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Empty } from "@/components/PageHeader";
import { useNews } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/news")({
  head: () => ({
    meta: [
      { title: "חדשות הליגה — ליגת העל מנג'ר" },
      { name: "description", content: "ידיעות על העברות ותוצאות מפתיעות בליגה." },
      { property: "og:title", content: "חדשות הליגה — ליגת העל מנג'ר" },
      { property: "og:description", content: "ידיעות על העברות ותוצאות מפתיעות בליגה." },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  const { data: news = [] } = useNews();
  return (
    <div>
      <PageHeader kicker="NEWS" title="חדשות הליגה" />
      {news.length === 0 ? <Empty>עוד אין חדשות. העברות ותוצאות מפתיעות יופיעו כאן.</Empty> : (
        <div className="grid gap-4 md:grid-cols-2">
          {news.map((n) => (
            <article key={n.id} className="glass pop-in p-5">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className={`rounded px-2 py-0.5 font-bold ${n.kind.startsWith("transfer") ? "bg-gold/20 text-gold" : "bg-neon/20 text-neon"}`}>
                  {n.kind.startsWith("transfer") ? "העברה" : "הפתעה"}
                </span>
                <span className="text-muted-foreground">{new Date(n.created_at).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}</span>
              </div>
              <h2 className="text-lg font-black">{n.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{n.body}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
