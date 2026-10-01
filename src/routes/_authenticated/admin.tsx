import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Empty } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "admin — ליגת העל מנג'ר" }, { name: "description", content: "ליגת העל מנג'ר" }, { property: "og:title", content: "ליגת העל מנג'ר" }, { property: "og:description", content: "ליגת העל מנג'ר" }] }),
  component: () => (
    <div>
      <PageHeader kicker="COMING NEXT" title="בבנייה" />
      <Empty>המסך הזה ייבנה בשלב הבא.</Empty>
    </div>
  ),
});
