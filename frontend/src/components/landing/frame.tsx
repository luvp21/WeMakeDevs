import React from "react";
import { cn } from "@/lib/utils";

export function Crosshair({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "absolute z-10 flex size-2.5 items-center justify-center font-mono text-[11px] leading-none text-muted-foreground select-none pointer-events-none",
        className
      )}
    >
      +
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
      {/* 1200px centered column with 1px side borders */}
      <div
        className={cn(
          "relative mx-auto min-h-full max-w-[1200px] border-x border-line-strong bg-background",
          innerClassName
        )}
      >
        {/* Crosshair marks at the top corners of the section if it has a top border */}
        {!noBorderTop && (
          <>
            <Crosshair className="-top-1.25 -left-1.25" />
            <Crosshair className="-top-1.25 -right-1.25" />
          </>
        )}

        {/* Section Label Bar if label is provided */}
        {label && (
          <div className="flex h-8 items-center justify-between border-b border-line-strong px-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground sm:px-6">
            <span>{label}</span>
            <span aria-hidden>+</span>
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
