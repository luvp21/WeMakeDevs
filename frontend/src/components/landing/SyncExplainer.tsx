import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { Check, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const SCRIPT = ["Toh", "yahan", "par", "dekho", "hum", "ek", "function", "banaya", "hai", "jo", "API", "se", "data", "fetch", "karta", "hai"];
export const HEARD = ["to", "yahaam", "para", "dekho", "hama", "eka", "function", "banaayaa", "hai", "jo", "API", "se", "data", "fetch", "karataa", "hai"];
export const CUTS = [
  { index: 0, time: "16.16s", label: "Beat 1 starts at “Toh”" },
  { index: 4, time: "18.26s", label: "Beat 2 starts at “hum”" },
  { index: 9, time: "20.66s", label: "Beat 3 starts at “jo”" },
];

// React does not know the &approx; entity, so it showed up as literal text.
const APPROX = "\u2248";

export const STEP_MS = 550;
export const HOLD_TICKS = 4;
export const TOTAL_DURATION = 5; // seconds

export function isExact(i: number): boolean {
  return SCRIPT[i].toLowerCase() === HEARD[i].toLowerCase();
}

export function SyncExplainer() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });

  const [step, setStep] = useState(reduce ? SCRIPT.length : 0);
  const [playing, setPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [muted, setMuted] = useState(false);

  const isPaused = reduce || !playing || !inView || isHovered;

  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setStep((s) => (s >= SCRIPT.length + HOLD_TICKS ? 0 : s + 1));
    }, STEP_MS);

    return () => clearInterval(timer);
  }, [isPaused]);

  const activeStep = Math.min(step, SCRIPT.length);
  const progress = Math.min(activeStep / SCRIPT.length, 1);
  const currentSec = Math.min(TOTAL_DURATION, Math.round(progress * TOTAL_DURATION));
  const reached = CUTS.filter((cut) => activeStep >= cut.index);

  function replay() {
    setStep(0);
    setPlaying(true);
  }

  function handleScrub(e: React.MouseEvent<HTMLDivElement>) {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, clickX / rect.width));
    const targetStep = Math.round(fraction * SCRIPT.length);
    setStep(targetStep);
  }

  return (
    <div
      ref={ref}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex w-full flex-col gap-5 rounded-md border border-line-strong bg-card p-5 font-mono shadow-xs sm:p-6"
    >
      <div className="flex flex-col gap-5">
        {/* Script Row */}
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-semibold text-muted-foreground">Script (what you meant to say)</span>
          <div className="flex flex-wrap gap-1.5">
            {SCRIPT.map((word, i) => {
              const matched = i < activeStep;
              const current = i === activeStep && activeStep < SCRIPT.length;
              const isCut = CUTS.some((cut) => cut.index === i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setStep(i)}
                  className={cn(
                    "relative rounded-md border px-2.5 py-1 text-xs sm:text-sm transition-all duration-150 text-left cursor-pointer",
                    matched && "border-success/40 bg-success-soft text-foreground",
                    current && "border-primary bg-primary-soft text-primary shadow-xs ring-1 ring-primary/30",
                    !matched && !current && "border-line-strong text-muted-foreground/70 hover:border-line-strong/80 hover:text-foreground"
                  )}
                >
                  {word}
                  {isCut && (
                    <span
                      className="absolute -top-1 -right-1 size-2.5 rounded-full bg-highlight shadow-xs ring-2 ring-card"
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Transcript Row */}
        <div className="flex flex-col gap-2.5 pt-1">
          <span className="text-xs font-semibold text-muted-foreground">Transcript (what the mic actually heard)</span>
          <div className="flex flex-wrap gap-1.5">
            {HEARD.map((word, i) => {
              const matched = i < activeStep;
              const current = i === activeStep && activeStep < SCRIPT.length;
              const exactMatch = matched && isExact(i);

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setStep(i)}
                  className={cn(
                    "flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs sm:text-sm transition-all duration-150 text-left cursor-pointer",
                    matched && "border-success/40 bg-success-soft text-foreground",
                    current && "border-highlight bg-highlight-soft text-highlight-foreground shadow-xs ring-1 ring-highlight/30",
                    !matched && !current && "border-line-strong text-muted-foreground/60 hover:border-line-strong/80 hover:text-foreground"
                  )}
                >
                  <span>{word}</span>
                  {/* A slot of fixed size, so a chip is the same width before and after it is
                      matched. Otherwise the tick appearing reflows the lines and the whole
                      card grows and shrinks while it plays. */}
                  <span className="flex size-3.5 shrink-0 items-center justify-center text-xs leading-none">
                    {matched ? (
                      exactMatch ? (
                        <Check className="size-3 text-success" aria-label="exact match" />
                      ) : (
                        <span aria-label="fuzzy match" className="text-highlight-foreground">
                          {APPROX}
                        </span>
                      )
                    ) : exactMatch ? null : (
                      <span className="text-muted-foreground/40">{APPROX}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cuts Found Inset Box: the three cuts sit side by side across the full width */}
      <div className="flex flex-col gap-2.5 rounded-lg border border-line-strong bg-secondary/50 p-4 text-xs sm:text-sm">
        <span className="font-semibold text-muted-foreground">Cuts found</span>
        <ul className="grid gap-2 font-mono md:grid-cols-3">
          {CUTS.map((cut) => {
            const isFound = reached.includes(cut);
            return (
              <li
                key={cut.index}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md border border-line-strong bg-card px-3 py-2 transition-opacity duration-300",
                  isFound ? "opacity-100 text-foreground" : "opacity-40 text-muted-foreground"
                )}
              >
                <span>{cut.label}</span>
                <span className={cn("tabular font-mono", isFound ? "text-highlight-foreground font-semibold" : "text-muted-foreground")}>
                  {isFound ? cut.time : ". . ."}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Caption & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-strong pt-3.5 text-xs text-muted-foreground">
        <p className="select-none">
          A real take. A tick is an exact match, {APPROX} is a fuzzy one.
        </p>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause" : "Play"}
            className="border-line-strong hover:bg-accent cursor-pointer"
          >
            {playing && !isHovered ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={replay}
            aria-label="Replay"
            className="border-line-strong hover:bg-accent cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Audio Timeline Scrubber Bar */}
      <div className="flex items-center gap-3 rounded-lg border border-line-strong bg-secondary/60 px-3.5 py-2 font-mono text-xs text-muted-foreground select-none">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="flex size-6 items-center justify-center rounded text-foreground hover:bg-accent transition-colors cursor-pointer"
          aria-label={playing ? "Pause timeline" : "Play timeline"}
        >
          {playing && !isHovered ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </button>

        <span className="w-12 tabular text-right">00:00:0{currentSec}</span>

        {/* Progress Track */}
        <div
          ref={progressBarRef}
          onClick={handleScrub}
          className="group relative flex-1 h-2 rounded-full bg-secondary border border-line-strong cursor-pointer flex items-center"
          aria-label="Audio timeline progress"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-150"
            style={{ width: `${progress * 100}%` }}
          />
          <div
            className="absolute size-3.5 rounded-full bg-primary border-2 border-background shadow-xs -translate-x-1/2 group-hover:scale-125 transition-transform"
            style={{ left: `${progress * 100}%` }}
          />
        </div>

        <span className="w-12 tabular">00:00:0{TOTAL_DURATION}</span>

        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}

