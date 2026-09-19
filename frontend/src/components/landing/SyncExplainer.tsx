import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { Check, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Real data: the script line and what Whisper large-v3 (then normalized to
// Latin script) heard on a real recorded take. "≈" pairs are fuzzy matches —
// the transcript spells Hindi words phonetically ("hama" for "hum"), so an
// exact string compare would stall on nearly every word. Cut times are the
// take's real checkpoints (backend/src/lib/sync/whisper-real-data.test.ts).
const SCRIPT = ["Toh", "yahan", "par", "dekho", "hum", "ek", "function", "banaya", "hai", "jo", "API", "se", "data", "fetch", "karta", "hai"];
const HEARD = ["to", "yahaam", "para", "dekho", "hama", "eka", "function", "banaayaa", "hai", "jo", "API", "se", "data", "fetch", "karataa", "hai"];
const CUTS: { index: number; time: string; label: string }[] = [
  { index: 0, time: "16.16s", label: "Beat 1 starts at “Toh”" },
  { index: 4, time: "18.26s", label: "Beat 2 starts at “hum”" },
  { index: 9, time: "20.66s", label: "Beat 3 starts at “jo”" },
];
const STEP_MS = 620;

function isExact(i: number): boolean {
  return SCRIPT[i].toLowerCase() === HEARD[i].toLowerCase();
}

export function SyncExplainer() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const [step, setStep] = useState(reduce ? SCRIPT.length : 0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (reduce || !playing || !inView) return;
    if (step >= SCRIPT.length) return;
    const timer = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [reduce, playing, inView, step]);

  const done = step >= SCRIPT.length;
  const reached = CUTS.filter((cut) => step > cut.index);

  function replay() {
    setStep(0);
    setPlaying(true);
  }

  return (
    <div ref={ref} className="flex flex-col gap-6 rounded-2xl border bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Script (what you meant to say)</span>
          <div className="flex flex-wrap gap-1.5">
            {SCRIPT.map((word, i) => {
              const matched = i < step;
              const current = i === step;
              const isCut = CUTS.some((cut) => cut.index === i);
              return (
                <motion.span
                  key={i}
                  layout={false}
                  className={cn(
                    "relative rounded-md border px-2 py-1 text-sm transition-colors duration-200",
                    matched && "border-success/30 bg-success/10 text-success",
                    current && "border-primary bg-primary/15 text-primary",
                    !matched && !current && "border-border text-muted-foreground",
                  )}
                >
                  {word}
                  {isCut && (
                    <span className="absolute -top-1.5 -right-1.5 size-2.5 rounded-full bg-highlight" aria-hidden />
                  )}
                </motion.span>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Transcript (what the mic actually heard)</span>
          <div className="flex flex-wrap gap-1.5 font-mono">
            {HEARD.map((word, i) => {
              const matched = i < step;
              const current = i === step;
              return (
                <span
                  key={i}
                  className={cn(
                    "flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors duration-200",
                    matched && "border-success/30 bg-success/10 text-success",
                    current && "border-highlight bg-highlight/15 text-highlight",
                    !matched && !current && "border-border text-muted-foreground/70",
                  )}
                >
                  {word}
                  {matched && (isExact(i) ? <Check className="size-3" aria-label="exact match" /> : <span aria-label="fuzzy match">≈</span>)}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl bg-background p-4">
        <span className="text-xs font-medium text-muted-foreground">Cuts found</span>
        <ul className="flex min-h-[4.5rem] flex-col gap-1.5">
          {CUTS.map((cut) => {
            const found = reached.includes(cut);
            return (
              <li
                key={cut.index}
                className={cn(
                  "flex items-center justify-between text-sm transition-opacity duration-300",
                  found ? "opacity-100" : "opacity-25",
                )}
              >
                <span>{cut.label}</span>
                <span className={cn("font-mono tabular", found ? "text-highlight" : "text-muted-foreground")}>
                  {found ? cut.time : "..."}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          A real take. A tick is an exact match, ≈ is a fuzzy one.
        </p>
        <div className="flex gap-1">
          {!done && (
            <Button variant="ghost" size="icon" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause /> : <Play />}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={replay} aria-label="Replay">
            <RotateCcw />
          </Button>
        </div>
      </div>
    </div>
  );
}
