import React from "react";
import { cn } from "@/lib/utils";

// A "+" drawn from two 1px lines, so it can sit exactly on the intersection of
// two grid lines (a text glyph can't be placed to the pixel). The 11px box has
// its centre 5.5px in, so `top: -6px` puts the centre on the 1px section border
// (0.5px above the column's padding edge) and `left/right: -6px` puts it on the
// column's 1px side border.
export function Crosshair({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute z-10 size-[11px] select-none", className)}>
      <span className="absolute top-[5px] left-0 h-px w-full bg-muted-foreground" />
      <span className="absolute top-0 left-[5px] h-full w-px bg-muted-foreground" />
    </div>
  );
}

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  id?: string;
  label?: string;
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  noBorderTop?: boolean;
}

export function Section({
  id,
  label,
  children,
  className,
  innerClassName,
  noBorderTop = false,
  ...props
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "relative w-full scroll-mt-16 bg-sidebar/50",
        !noBorderTop && "border-t border-line-strong",
        className
      )}
      {...props}
    >
      {/* 1480px centered column with 1px side borders */}
      <div
        className={cn(
          "relative mx-auto min-h-full max-w-[1480px] border-x border-line-strong bg-background",
          innerClassName
        )}
      >
        {/* Crosshair marks at the top corners of the section if it has a top border */}
        {!noBorderTop && (
          <>
            <Crosshair className="-top-[6px] -left-[6px]" />
            <Crosshair className="-top-[6px] -right-[6px]" />
          </>
        )}

        {/* Section Label Bar if label is provided */}
        {label && (
          <div className="flex h-11 items-center justify-between border-b border-line-strong px-4 font-mono text-sm font-medium uppercase tracking-wider text-foreground sm:h-12 sm:px-6 sm:text-base">
            <span>{label}</span>
            <span aria-hidden className="text-muted-foreground">+</span>
          </div>
        )}

        {children}
      </div>
    </section>
  );
}

export function GridFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full bg-sidebar font-mono bg-hatch">
      {children}
    </div>
  );
}
