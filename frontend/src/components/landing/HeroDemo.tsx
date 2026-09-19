import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

// The hero shows the product's one real trick: a spoken line advances word by
// word, and the visual on screen cuts on the exact word a beat starts. The
// line and its beat boundaries come from a real recorded take of the vercel/ms
// walkthrough (see whisper-real-data.test.ts), not invented copy.
const WORDS = ["Toh", "yahan", "par", "dekho", "hum", "ek", "function", "banaya", "hai", "jo", "API", "se", "data", "fetch", "karta", "hai"];
const BEAT_STARTS = [0, 4, 9];
const BEAT_LABELS = ["Slide", "Code", "Diagram"];
const WORD_MS = 360;
const HOLD_TICKS = 5;
const EASE = [0.16, 1, 0.3, 1] as const;

const BARS = Array.from({ length: 56 }, (_, i) => {
  const v = Math.sin(i * 1.7) * 0.5 + Math.sin(i * 0.55 + 1) * 0.35 + 0.65;
  return Math.max(0.18, Math.min(1, v));
});

function beatAt(position: number): number {
  let beat = 0;
  BEAT_STARTS.forEach((start, index) => {
    if (position >= start) beat = index;
  });
  return beat;
}

function SlideVisual() {
  return (
    <div className="flex h-full flex-col justify-center gap-2 px-6">
      <span className="text-sm text-muted-foreground">vercel/ms</span>
      <span className="text-2xl font-semibold leading-tight sm:text-3xl">
        Fetching data, <span className="text-primary">the simple way</span>
      </span>
    </div>
  );
}

function CodeVisual() {
  const lines = [
    ["async function ", "getUser", "(id) {"],
    ["  const res = await ", "fetch", "(`/api/users/${id}`);"],
    ["  return res.json();"],
    ["}"],
  ];
  return (
    <pre className="flex h-full flex-col justify-center gap-0.5 px-5 font-mono text-[11px] leading-6 sm:text-xs">
      {lines.map((parts, i) => (
        <span key={i} className={cn("block rounded px-2", i === 1 && "bg-highlight/15")}>
          {parts.map((part, j) => (
            <span key={j} className={cn(j === 1 && "text-primary")}>
              {part}
            </span>
          ))}
        </span>
      ))}
    </pre>
  );
}

function DiagramVisual() {
  return (
    <div className="flex h-full items-center justify-center gap-3 px-4 font-mono text-[11px] sm:text-xs">
      <span className="rounded-md border bg-card px-3 py-2">your app</span>
      <span className="flex flex-col items-center text-primary">
        <span>GET /api/users</span>
        <span aria-hidden>{"------>"}</span>
      </span>
      <span className="rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-primary">API</span>
    </div>
  );
}

const VISUALS = [SlideVisual, CodeVisual, DiagramVisual];

export function HeroDemo() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const [tick, setTick] = useState(reduce ? WORDS.length : 0);

  useEffect(() => {
    if (reduce || !inView) return;
    const timer = setInterval(() => {
      setTick((t) => (t >= WORDS.length + HOLD_TICKS ? 0 : t + 1));
    }, WORD_MS);
    return () => clearInterval(timer);
  }, [reduce, inView]);

  // tick counts words spoken so far; the word being spoken is tick - 1.
  const position = Math.min(tick, WORDS.length) - 1;
  const beat = beatAt(Math.max(position, 0));
  const Visual = VISUALS[beat];
  const progress = Math.min(tick / WORDS.length, 1);

  return (
    <div ref={ref} className="overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between border-b px-4 py-2.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-2 font-mono">
          <span className="size-1.5 animate-pulse rounded-full bg-destructive" />
          take-1.webm
        </span>
        <span className="tabular">{(16.16 + progress * 6.8).toFixed(2)}s</span>
      </div>

      <div className="relative aspect-video border-b bg-background">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={beat}
            className="absolute inset-0"
            initial={reduce ? false : { opacity: 0, filter: "blur(8px)", scale: 0.985 }}
            animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, filter: "blur(6px)" }}
            transition={{ duration: 0.32, ease: EASE }}
          >
            <Visual />
          </motion.div>
        </AnimatePresence>
        <span className="absolute right-3 bottom-3 rounded-md bg-card/90 px-2 py-1 text-[11px] text-muted-foreground backdrop-blur">
          Beat {beat + 1} &middot; {BEAT_LABELS[beat]}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-2 gap-y-1.5 px-4 pt-4 text-base leading-snug sm:text-lg" aria-label="Spoken line">
        {WORDS.map((word, i) => {
          const spoken = i < position;
          const current = i === position;
          return (
            <span
              key={i}
              className={cn(
                "rounded px-1 transition-colors duration-150",
                spoken && "text-foreground",
                current && "bg-highlight/25 text-highlight",
                !spoken && !current && "text-muted-foreground/60",
              )}
            >
              {word}
            </span>
          );
        })}
      </div>

      <div className="px-4 pt-4 pb-4">
        <div className="relative flex h-12 items-center gap-[3px]" aria-hidden>
          {BARS.map((height, i) => (
            <span
              key={i}
              className={cn(
                "w-full rounded-full transition-colors duration-150",
                i / BARS.length < progress ? "bg-primary" : "bg-muted",
              )}
              style={{ height: `${height * 100}%` }}
            />
          ))}
          {BEAT_STARTS.map((start, i) => {
            const reached = position >= start;
            return (
              <motion.span
                key={start}
                className="absolute inset-y-[-6px] w-px bg-highlight"
                style={{ left: `${(start / WORDS.length) * 100}%` }}
                initial={false}
                animate={{ opacity: reached ? 1 : 0.25, scaleY: reached ? 1 : 0.7 }}
                transition={{ duration: 0.25, ease: EASE }}
              >
                <span className="absolute -top-4 left-1 text-[10px] whitespace-nowrap text-highlight">cut {i + 1}</span>
              </motion.span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
