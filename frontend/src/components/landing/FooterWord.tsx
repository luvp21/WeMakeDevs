import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function FooterWord() {
  const reduce = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} aria-hidden className="relative w-full overflow-hidden pt-6 select-none">
      <div className="mx-auto flex max-w-[1200px] items-end justify-between px-4 sm:px-6">
        {/* Soft stroke outline English "Vaani" */}
        <div
          className={cn(
            "relative font-mono text-6xl sm:text-7xl lg:text-9xl font-extrabold tracking-tighter text-transparent transition-all duration-700 ease-out select-none cursor-default group",
            inView || reduce ? "translate-y-[32%] opacity-100" : "translate-y-[55%] opacity-0"
          )}
          style={{
            WebkitTextStroke: "1.5px var(--line-strong)",
          }}
        >
          <span className="transition-all duration-300 group-hover:text-primary/10 group-hover:[webkit-text-stroke-color:var(--primary)]">
            Vaani
          </span>
        </div>

        {/* Soft stroke outline Devanagari "वाणी" */}
        <div
          className={cn(
            "relative font-devanagari text-6xl sm:text-7xl lg:text-9xl font-bold tracking-widest text-transparent transition-all duration-700 ease-out select-none cursor-default group",
            inView || reduce ? "translate-y-[32%] opacity-100" : "translate-y-[55%] opacity-0"
          )}
          style={{
            WebkitTextStroke: "1.5px var(--line-strong)",
          }}
        >
          <span className="transition-all duration-300 group-hover:text-primary/10 group-hover:[webkit-text-stroke-color:var(--primary)]">
            वाणी
          </span>
        </div>
      </div>
    </div>
  );
}

export function BackToTop() {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })}
      aria-label="Back to top"
      className="fixed bottom-6 right-6 z-40 flex size-9 items-center justify-center rounded border border-line-strong bg-card text-foreground shadow-sm transition-all hover:bg-accent hover:-translate-y-0.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-ring"
    >
      <ArrowUp className="size-4" />
    </button>
  );
}
