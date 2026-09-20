import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Check, Circle, Clapperboard, GitBranch, Mic, ScrollText, AudioLines, type LucideIcon
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface PipelineStep {
  id: string;
  label: string;
  title: string;
  body: string;
  icon: LucideIcon;
  Artifact: () => React.JSX.Element;
}

export const AUTO_ADVANCE_MS = 6500;
const EASE = [0.16, 1, 0.3, 1] as const;

function RepoArtifact() {
  const reads = ["README.md", "package.json", "src/index.ts", "src/parse.ts"];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded border border-line-strong bg-secondary px-3 py-2 font-mono text-xs text-foreground">
        <GitBranch className="size-3.5 text-muted-foreground" />
        github.com/vercel/ms
      </div>
      <ul className="flex flex-col gap-2 font-mono text-xs">
        {reads.map((file, i) => (
          <motion.li
            key={file}
            className="flex items-center gap-2 text-muted-foreground"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.12, duration: 0.3, ease: EASE }}
          >
            <Check className="size-3.5 text-success" />
            {file}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function ScriptArtifact() {
  const beats = [
    { text: "Aaj hum dekh rahe hain Vercel ka super popular package ms, jo time strings aur milliseconds ke beech convert karta hai.", visual: "Slide" },
    { text: "Sabse pehle iska main export dekho, ye single function dono directions handle karta hai.", visual: "Code  src/index.ts  L38-54" },
  ];
  return (
    <div className="flex flex-col gap-3 font-mono text-xs">
      {beats.map((beat, i) => (
        <motion.div
          key={i}
          className="rounded border border-line-strong bg-secondary p-3"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.15, duration: 0.3, ease: EASE }}
        >
          <p className="leading-relaxed text-foreground">{beat.text}</p>
          <span className="mt-2 inline-block rounded border border-line-strong bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {beat.visual}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function RecordArtifact() {
  return (
    <div className="grid grid-cols-[1fr_8rem] gap-3 font-mono text-xs">
      <div className="rounded border border-line-strong bg-secondary p-3 leading-relaxed">
        <span className="text-muted-foreground">Aaj hum dekh rahe hain </span>
        <span className="rounded bg-highlight-soft px-0.5 text-foreground font-semibold border-b border-highlight">
          Vercel ka super popular package ms
        </span>
        <span className="text-muted-foreground/60">, jo time strings aur milliseconds ke beech convert karta hai.</span>
      </div>
      <div className="relative flex aspect-[4/5] items-center justify-center rounded border border-line-strong bg-card">
        <Mic className="size-6 text-muted-foreground" />
        <span className="absolute top-2 left-2 flex items-center gap-1 rounded bg-destructive/10 border border-destructive/30 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
          <span className="size-1.5 animate-pulse rounded-full bg-destructive" /> REC
        </span>
      </div>
    </div>
  );
}

function SyncArtifact() {
  return (
    <div className="flex flex-col gap-3 font-mono text-xs">
      <div className="relative h-14 rounded border border-line-strong bg-secondary">
        {[8, 41, 73].map((left, i) => (
          <motion.span
            key={left}
            className="absolute inset-y-2 w-px bg-highlight"
            style={{ left: `${left}%` }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: 0.2 + i * 0.25, duration: 0.3, ease: EASE }}
          >
            <span className="absolute -top-1 left-1.5 text-[10px] font-semibold whitespace-nowrap text-highlight-foreground">
              {["16.16s", "18.26s", "20.66s"][i]}
            </span>
          </motion.span>
        ))}
      </div>
      <p className="text-muted-foreground">Each beat is pinned to the moment you actually said it.</p>
    </div>
  );
}

function VideoArtifact() {
  return (
    <div className="flex flex-col gap-4 font-mono text-xs">
      {/* Ready Status Card */}
      <div className="flex flex-col gap-3 rounded border border-line-strong bg-secondary/40 p-4">
        <div className="flex items-center justify-between border-b border-line-strong pb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-success/15 text-success">
              <Check className="size-3" />
            </span>
            <span className="font-semibold text-foreground">Your video is ready!</span>
          </div>
          <span className="rounded border border-success/30 bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">
            1080p MP4
          </span>
        </div>

        <p className="text-muted-foreground leading-relaxed">
          Rendered on AWS Fargate. Your presenter bubble, code highlights &amp; slides are timed exactly to your voice.
        </p>

        <div className="flex items-center justify-between border-t border-line-strong pt-2.5">
          <span className="text-[11px] text-muted-foreground">Duration: 22.96s &middot; 60 fps</span>
          <div className="inline-flex items-center gap-1.5 rounded border border-line-strong bg-foreground px-3 py-1.5 font-semibold text-background shadow-xs hover:bg-foreground/90 cursor-pointer">
            <Check className="size-3.5" />
            Download MP4
          </div>
        </div>
      </div>

      <p className="text-muted-foreground">Your voice, your visuals, cut on your words.</p>
    </div>
  );
}

export const STEPS: PipelineStep[] = [
  { id: "repo", label: "Paste a repo", title: "Start from a public GitHub repo", body: "Vaani reads the README, package files and a sample of real source files. No setup, no tokens.", icon: GitBranch, Artifact: RepoArtifact },
  { id: "script", label: "Edit the script", title: "Get a script that sounds like you", body: "A beat-tagged Hinglish script, each beat paired with a visual from the actual repo. Change any word before you lock it.", icon: ScrollText, Artifact: ScriptArtifact },
  { id: "record", label: "Read it aloud", title: "Record one scene at a time", body: "A teleprompter shows the scene in large type. Retake as often as you like; only the take you keep is uploaded.", icon: Mic, Artifact: RecordArtifact },
  { id: "sync", label: "Sync", title: "Find the exact moment of every beat", body: "Your recording is transcribed and matched to the script, so a stutter or a filler word can't shift a cut.", icon: AudioLines, Artifact: SyncArtifact },
  { id: "video", label: "Render", title: "Get the finished video", body: "Visuals cut in on your words over your own audio, rendered on AWS Fargate. Download the MP4.", icon: Clapperboard, Artifact: VideoArtifact },
];

export function PipelineTabs() {
  const reduce = useReducedMotion();
  const [activeIdx, setActiveIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-advance progress timer
  useEffect(() => {
    if (reduce || isHovered) return;

    const interval = 50; // update progress every 50ms
    const stepIncrement = (interval / AUTO_ADVANCE_MS) * 100;

    const timer = setInterval(() => {
      setProgress((p) => {
        if (p + stepIncrement >= 100) {
          return 100;
        }
        return p + stepIncrement;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [reduce, isHovered]);

  // When progress reaches 100%, step forward to the next index sequentially
  useEffect(() => {
    if (progress >= 100) {
      setActiveIdx((prev) => (prev + 1) % STEPS.length);
      setProgress(0);
    }
  }, [progress]);

  const handleTabHover = (index: number) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    // 80ms hover-intent delay
    hoverTimerRef.current = setTimeout(() => {
      setActiveIdx(index);
      setProgress(0);
    }, 80);
  };

  const handleTabClick = (index: number) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setActiveIdx(index);
    setProgress(0);
  };

  const currentStep = STEPS[activeIdx];
  const Artifact = currentStep.Artifact;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      }}
      className="flex flex-col border border-line-strong bg-card shadow-xs"
    >
      <Tabs value={currentStep.id} onValueChange={(val) => {
        const idx = STEPS.findIndex(s => s.id === val);
        if (idx !== -1) handleTabClick(idx);
      }} className="w-full">
        <TabsList className="grid h-auto! w-full grid-cols-2 rounded-none border-b border-line-strong bg-transparent p-0 sm:grid-cols-5 group/tabs">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === activeIdx;
            return (
              <TabsTrigger
                key={s.id}
                value={s.id}
                onMouseEnter={() => handleTabHover(i)}
                onClick={() => handleTabClick(i)}
                className={cn(
                  "relative flex h-16 flex-col items-start justify-center gap-1.5 rounded-none border-r border-line-strong px-4 py-3 text-left transition-all cursor-pointer last:border-r-0",
                  "hover:bg-card hover:border-foreground hover:z-10 group-hover/tabs:opacity-60 hover:!opacity-100",
                  isActive
                    ? "bg-card text-foreground font-semibold border-t-2 border-t-primary shadow-xs z-10 opacity-100!"
                    : "bg-secondary/40 text-muted-foreground border-t-2 border-t-transparent"
                )}
              >
                <div className="flex items-center gap-2 text-xs">
                  <Icon className="size-3.5 text-muted-foreground" />
                  <span className="font-mono text-[11px] text-muted-foreground">0{i + 1}</span>
                </div>
                <span className="font-mono text-xs tracking-tight">{s.label}</span>

                {/* Progress bar along bottom edge */}
                {isActive && !reduce && (
                  <div className="absolute bottom-0 left-0 h-[2px] bg-primary transition-all duration-75" style={{ width: `${progress}%` }} />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Main step content panel */}
      <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[2fr_3fr] md:items-center">
        <div className="flex flex-col gap-3 font-mono">
          <h3 className="text-xl font-semibold tracking-tight text-foreground">{currentStep.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{currentStep.body}</p>
          <span className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Circle className="size-2 fill-primary text-primary" />
            Step {activeIdx + 1} of {STEPS.length}
          </span>
        </div>

        <div className="rounded border border-line-strong bg-background p-5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentStep.id}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              <Artifact />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
