import { cn } from "@/lib/utils";

export function SlideVisual() {
  return (
    <div className="flex h-full flex-col justify-center gap-2 bg-[#FBFBFD] px-6 text-foreground">
      <span className="font-mono text-sm text-muted-foreground">vercel/ms</span>
      <span className="text-2xl font-semibold leading-tight sm:text-3xl">
        Fetching data, <span className="text-primary">the simple way</span>
      </span>
    </div>
  );
}

export function CodeVisual() {
  const lines = [
    ["async function ", "getUser", "(id) {"],
    ["  const res = await ", "fetch", "(`/api/users/${id}`);"],
    ["  return res.json();"],
    ["}"],
  ];
  return (
    <pre className="flex h-full flex-col justify-center gap-1 bg-[#FBFBFD] px-5 font-mono text-[11px] leading-6 text-foreground sm:text-xs">
      {lines.map((parts, i) => (
        <span
          key={i}
          className={cn(
            "block rounded px-2 py-0.5 transition-colors",
            i === 1 && "bg-highlight-soft border-l-2 border-highlight text-foreground font-semibold"
          )}
        >
          {parts.map((part, j) => (
            <span key={j} className={cn(j === 1 && "text-primary font-semibold")}>
              {part}
            </span>
          ))}
        </span>
      ))}
    </pre>
  );
}

export function DiagramVisual() {
  return (
    <div className="flex h-full items-center justify-center gap-3 bg-[#FBFBFD] px-4 font-mono text-[11px] text-foreground sm:text-xs">
      <span className="rounded-md border border-line-strong bg-card px-3 py-2 shadow-xs">your app</span>
      <span className="flex flex-col items-center text-primary font-medium">
        <span className="text-[10px] tracking-wide">GET /api/users</span>
        <span aria-hidden className="tracking-tighter">{"------>"}</span>
      </span>
      <span className="rounded-md border border-primary/50 bg-primary-soft px-3 py-2 text-primary font-semibold">
        API
      </span>
    </div>
  );
}

export const VISUALS = [SlideVisual, CodeVisual, DiagramVisual];
