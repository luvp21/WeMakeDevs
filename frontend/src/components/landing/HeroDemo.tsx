import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { VISUALS } from "./beat-visuals";
import { Waveform } from "./Waveform";
import { CornerMarks } from "@/components/ui/corner-marks";

export const WORDS = [
  "Toh", "yahan", "par", "dekho", "hum", "ek", "function", "banaya",
  "hai", "jo", "API", "se", "data", "fetch", "karta", "hai"
];
export const BEAT_STARTS = [0, 4, 9];
export const BEAT_LABELS = ["Slide", "Code", "Diagram"];
export const WORD_MS = 360;
export const HOLD_TICKS = 5;
const EASE = [0.16, 1, 0.3, 1] as const;

export function beatAt(position: number): number {
  let beat = 0;
  BEAT_STARTS.forEach((start, index) => {
    if (position >= start) beat = index;
  });
  return beat;
}

export function HeroDemo() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  
  const [tick, setTick] = useState(reduce ? WORDS.length : 0);
  const [userPaused, setUserPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isPaused = reduce || !inView || userPaused || isHovered;

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setTick((t) => (t >= WORDS.length + HOLD_TICKS ? 0 : t + 1));
    }, WORD_MS);
    return () => clearInterval(timer);
  }, [isPaused]);

  // tick counts words spoken so far; the word being spoken is position = tick - 1
  const position = Math.min(tick, WORDS.length) - 1;
  const beat = beatAt(Math.max(position, 0));
  const Visual = VISUALS[beat];
  const progress = Math.min(tick / WORDS.length, 1);

  const handleWordClick = (index: number) => {
    setTick(index + 1);
  };

  const handleWaveformScrub = (fraction: number) => {
    const targetWord = Math.min(WORDS.length, Math.max(1, Math.round(fraction * WORDS.length)));
    setTick(targetWord);
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={ref}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative overflow-hidden rounded-md border border-line-strong bg-card shadow-xs transition-shadow hover:shadow-md"
      >
        <CornerMarks inside />
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-line-strong px-4 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-2 font-mono">
            <span className={cn("size-2 rounded-full bg-destructive", !isPaused && "animate-pulse")} />
            take-1.webm
          </span>
          <span className="font-mono tabular">{(16.16 + progress * 6.8).toFixed(2)}s</span>
        </div>

        {/* 16:9 Canvas */}
        <div className="relative aspect-video border-b border-line-strong bg-[#FBFBFD]">
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

          <span className="absolute bottom-3 right-3 rounded-md border border-line-strong bg-card/90 px-2 py-1 font-mono text-[11px] text-muted-foreground backdrop-blur">
            Beat {beat + 1} &middot; {BEAT_LABELS[beat]}
          </span>
        </div>

        {/* Spoken words row */}
        <div
          className="flex flex-wrap gap-x-1.5 gap-y-1 px-4 pt-4 text-base leading-snug sm:text-lg"
          aria-label="Spoken line"
        >
          {WORDS.map((word, i) => {
            const spoken = i < position;
            const current = i === position;
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleWordClick(i)}
                className={cn(
                  "rounded px-1 text-left font-mono transition-colors focus-visible:outline-2 focus-visible:outline-ring cursor-pointer",
                  spoken && "text-foreground font-normal",
                  current && "bg-highlight-soft text-foreground font-semibold border-b-2 border-highlight",
                  !spoken && !current && "text-muted-foreground/60"
                )}
              >
                {word}
              </button>
            );
          })}
        </div>

        {/* Waveform & Play/Pause controls */}
        <div className="flex items-center gap-3 px-4 pt-3 pb-4">
          <button
            type="button"
            onClick={() => setUserPaused((p) => !p)}
            aria-label={userPaused ? "Play recording" : "Pause recording"}
            className="flex size-7 shrink-0 items-center justify-center rounded-md border border-line-strong bg-secondary text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring cursor-pointer"
          >
            {userPaused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          </button>
          <div className="flex-1">
            <Waveform progress={progress} position={position} onScrub={handleWaveformScrub} />
          </div>
        </div>
      </div>

      <p className="text-center font-mono text-[11px] text-muted-foreground select-none">
        Hover to pause. Click a word or the waveform to jump.
      </p>
    </div>
  );
}
