import { cn } from "@/lib/utils";

// Four L-shaped corner brackets for a box. The parent must be `relative`; for
// `hover`, it must also carry the `group/box` class, and the brackets appear
// when the box is hovered or has focus inside it. Use `inside` for a parent with
// overflow-hidden, which would clip brackets that sit on its border.
export function CornerMarks({ hover = false, inside = false }: { hover?: boolean; inside?: boolean }) {
  const shown = hover
    ? "opacity-0 transition-opacity duration-200 group-hover/box:opacity-100 group-focus-within/box:opacity-100"
    : "";
  const base = cn("pointer-events-none absolute z-10 size-2.5 border-foreground/80", shown);
  const edge = inside ? "0" : "-1px";
  return (
    <>
      <span aria-hidden className={cn(base, "border-t-2 border-l-2")} style={{ top: edge, left: edge }} />
      <span aria-hidden className={cn(base, "border-t-2 border-r-2")} style={{ top: edge, right: edge }} />
      <span aria-hidden className={cn(base, "border-b-2 border-l-2")} style={{ bottom: edge, left: edge }} />
      <span aria-hidden className={cn(base, "border-b-2 border-r-2")} style={{ bottom: edge, right: edge }} />
    </>
  );
}
