import type { ReactNode } from "react";

export function PageHeader({ kicker, title, actions }: { kicker: string; title: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold tracking-[0.25em] text-neon">{kicker}</p>
        <h1 className="text-3xl font-black">{title}</h1>
      </div>
      {actions}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="glass p-10 text-center text-sm text-muted-foreground">{children}</div>;
}
