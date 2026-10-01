import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bootstrapOwner, ownerExists } from "@/lib/league.functions";
import { usernameToEmail } from "@/lib/formations";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "כניסה — ליגת העל מנג'ר" },
      { name: "description", content: "התחברו לניהול הקבוצה שלכם בליגת העל: הרכבים, העברות ומשחקים חיים." },
      { property: "og:title", content: "ליגת העל מנג'ר" },
      { property: "og:description", content: "משחק ניהול קבוצות כדורגל אונליין בליגת העל הישראלית." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const checkOwner = useServerFn(ownerExists);
  const createOwner = useServerFn(bootstrapOwner);
  const owner = useQuery({ queryKey: ["owner-exists"], queryFn: () => checkOwner() });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const setup = owner.data && !owner.data.exists;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (setup) await createOwner({ data: { username, password, displayName } });
      const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
      if (error) throw new Error("שם משתמש או סיסמה שגויים");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden pitch-bg lg:block">
        <div className="absolute inset-8 rounded-sm border-2 border-pitch-line" />
        <div className="absolute inset-x-8 top-1/2 h-0.5 bg-pitch-line" />
        <div className="absolute left-1/2 top-1/2 size-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-pitch-line" />
        <div className="absolute inset-0 bg-gradient-to-l from-background via-background/40 to-transparent" />
        <div className="absolute bottom-16 right-16 max-w-md">
          <p className="text-sm font-bold tracking-widest text-neon">עונת 2026/27</p>
          <h1 className="mt-2 text-6xl font-black leading-none">ליגת העל<br />מנג'ר</h1>
          <p className="mt-4 text-muted-foreground">הרכבים, העברות, ומשחקים חיים מול המאמנים האחרים בליגה.</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="glass w-full max-w-sm space-y-5 p-8">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground neon-glow">
              <Trophy className="size-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{setup ? "הקמת הליגה" : "כניסת מאמנים"}</h2>
              <p className="text-xs text-muted-foreground">
                {setup ? "צרו את חשבון מנהל הליגה הראשון" : "התחברו עם הפרטים שקיבלתם ממנהל הליגה"}
              </p>
            </div>
          </div>
          {setup && (
            <div className="space-y-1.5">
              <Label>שם תצוגה</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="אורי" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>שם משתמש</Label>
            <Input dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="uri" required autoComplete="username" />
          </div>
          <div className="space-y-1.5">
            <Label>סיסמה</Label>
            <Input dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="current-password" />
          </div>
          <Button type="submit" className="w-full font-bold" disabled={busy || owner.isLoading}>
            {busy ? "רגע..." : setup ? "צור והתחבר" : "התחברות"}
          </Button>
        </form>
      </div>
    </div>
  );
}
