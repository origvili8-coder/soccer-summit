import { cn } from "@/lib/utils";

export function PlayerAvatar({ src, name, className }: { src?: string | null | undefined; name: string; className?: string }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <div
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-xs font-bold text-muted-foreground",
        className,
      )}
    >
      {src ? <img src={src} alt={name} className="size-full object-cover" /> : initials}
    </div>
  );
}

export function TeamLogo({ src, name, color, className }: { src?: string | null | undefined; name: string; color?: string | undefined; className?: string }) {
  return (
    <div
      className={cn("flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg text-xs font-black", className)}
      style={{ background: src ? undefined : color ?? undefined, color: "oklch(0.15 0.02 255)" }}
    >
      {src ? <img src={src} alt={name} className="size-full object-cover" /> : name.slice(0, 2)}
    </div>
  );
}

const POS_STYLE: Record<string, string> = {
  GK: "bg-gold/20 text-gold",
  DEF: "bg-cyan/20 text-cyan",
  MID: "bg-neon/20 text-neon",
  FWD: "bg-destructive/25 text-destructive",
};
export function PosBadge({ pos }: { pos: string }) {
  return <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold tabular", POS_STYLE[pos])}>{pos}</span>;
}
