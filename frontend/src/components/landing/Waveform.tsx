import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export const BARS = Array.from({ length: 56 }, (_, i) => {
  const v = Math.sin(i * 1.7) * 0.5 + Math.sin(i * 0.55 + 1) * 0.35 + 0.65;
  return Math.max(0.18, Math.min(1, v));
});

export const BEAT_STARTS = [0, 4, 9];
const EASE = [0.16, 1, 0.3, 1] as const;

interface WaveformProps {
  progress: number; // 0..1
  position: number; // current word index (-1..15)
  onScrub?: (fraction: number) => void;
  className?: string;
}

export function Waveform({ progress, position, onScrub, className }: WaveformProps) {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onScrub) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const frac = Math.max(0, Math.min(1, x / rect.width));
    onScrub(frac);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onScrub) return;
    if (e.key === "ArrowRight") {
      const nextFrac = Math.min(1, progress + 1 / 16);
      onScrub(nextFrac);
    } else if (e.key === "ArrowLeft") {
      const prevFrac = Math.max(0, progress - 1 / 16);
      onScrub(prevFrac);
    }
  };

  return (
    <div
      tabIndex={onScrub ? 0 : -1}
      role={onScrub ? "slider" : undefined}
      aria-label="Audio waveform playback scrub"
      aria-valuenow={Math.round(progress * 100)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative flex h-12 w-full items-center gap-[3px] py-1 select-none",
        onScrub && "cursor-pointer focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 rounded",
        className
      )}
    >
      {BARS.map((height, i) => {
        const isPlayed = i / BARS.length <= progress;
        return (
          <span
            key={i}
            className={cn(
              "w-full rounded-full transition-colors duration-150",
              isPlayed ? "bg-primary" : "bg-wave-off"
            )}
            style={{ height: `${height * 100}%` }}
          />
        );
      })}

      {BEAT_STARTS.map((start, i) => {
        const reached = position >= start;
        return (
          <motion.span
            key={start}
            className="absolute inset-y-[-4px] w-px bg-highlight"
            style={{ left: `${(start / 16) * 100}%` }}
            initial={false}
            animate={{ opacity: reached ? 1 : 0.3, scaleY: reached ? 1 : 0.7 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <span className="absolute -top-4 left-1 font-mono text-[10px] font-semibold whitespace-nowrap text-highlight-foreground">
              cut {i + 1}
            </span>
          </motion.span>
        );
      })}
    </div>
  );
}
