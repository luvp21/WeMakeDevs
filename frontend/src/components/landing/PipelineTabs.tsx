import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Circle, Clapperboard, GitBranch, Mic, Play, ScrollText, AudioLines, type LucideIcon } from "lucide-react";
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

const AUTO_ADVANCE_MS = 6500;
const EASE = [0.16, 1, 0.3, 1] as const;

function RepoArtifact() {
  const reads = ["README.md", "package.json", "src/index.ts", "src/parse.ts"];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2.5 font-mono text-sm">
        <GitBranch className="size-4 text-muted-foreground" />
        github.com/vercel/ms
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {reads.map((file, i) => (
          <motion.li
            key={file}
            className="flex items-center gap-2 font-mono text-muted-foreground"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.12, duration: 0.3, ease: EASE }}
          >
            <Check className="size-4 text-success" />
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
    <div className="flex flex-col gap-3">
      {beats.map((beat, i) => (
        <motion.div
          key={i}
          className="rounded-lg border bg-background p-3"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.15, duration: 0.3, ease: EASE }}
        >
          <p className="text-sm leading-relaxed">{beat.text}</p>
          <span className="mt-2 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            {beat.visual}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function RecordArtifact() {
  return (
    <div className="grid grid-cols-[1fr_9rem] gap-3">
      <div className="rounded-lg border bg-background p-3 text-base leading-relaxed">
        <span className="text-muted-foreground">Aaj hum dekh rahe hain </span>
        <span className="rounded bg-highlight/20 px-0.5 text-highlight">Vercel ka super popular package ms</span>
        <span className="text-muted-foreground/60">, jo time strings aur milliseconds ke beech convert karta hai.</span>
      </div>
      <div className="relative flex aspect-[4/5] items-center justify-center rounded-lg border bg-background">
        <Mic className="size-6 text-muted-foreground" />
        <span className="absolute top-2 left-2 flex items-center gap-1 rounded bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-background">
          <span className="size-1 animate-pulse rounded-full bg-current" /> REC
        </span>
      </div>
    </div>
  );
}

function SyncArtifact() {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-14 rounded-lg border bg-background">
        {[8, 41, 73].map((left, i) => (
          <motion.span
            key={left}
            className="absolute inset-y-2 w-px bg-highlight"
            style={{ left: `${left}%` }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: 0.2 + i * 0.25, duration: 0.3, ease: EASE }}
          >
            <span className="absolute -top-0.5 left-1.5 font-mono text-[10px] whitespace-nowrap text-highlight">
              {["16.16s", "18.26s", "20.66s"][i]}
            </span>
          </motion.span>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">Each beat is pinned to the moment you actually said it.</p>
    </div>
  );
}

function VideoArtifact() {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative flex aspect-video items-center justify-center rounded-lg border bg-background">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Play className="size-5" />
        </span>
        <span className="absolute bottom-2 left-2 rounded bg-card px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          final.mp4
        </span>
      </div>
      <p className="text-sm text-muted-foreground">Your voice, your visuals, cut on your words.</p>
    </div>
  );
}

const STEPS: PipelineStep[] = [
  { id: "repo", label: "Paste a repo", title: "Start from a public GitHub repo", body: "Vaani reads the README, package files and a sample of real source files. No setup, no tokens.", icon: GitBranch, Artifact: RepoArtifact },
  { id: "script", label: "Edit the script", title: "Get a script that sounds like you", body: "A beat-tagged Hinglish script, each beat paired with a visual from the actual repo. Change any word before you lock it.", icon: ScrollText, Artifact: ScriptArtifact },
  { id: "record", label: "Read it aloud", title: "Record one scene at a time", body: "A teleprompter shows the scene in large type. Retake as often as you like; only the take you keep is uploaded.", icon: Mic, Artifact: RecordArtifact },
  { id: "sync", label: "Sync", title: "Find the exact moment of every beat", body: "Your recording is transcribed and matched to the script, so a stutter or a filler word can't shift a cut.", icon: AudioLines, Artifact: SyncArtifact },
  { id: "video", label: "Render", title: "Get the finished video", body: "Visuals cut in on your words over your own audio, rendered on AWS Fargate. Download the MP4.", icon: Clapperboard, Artifact: VideoArtifact },
];

export function PipelineTabs() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(STEPS[0].id);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused) return;
    const timer = setTimeout(() => {
      const index = STEPS.findIndex((s) => s.id === active);
      setActive(STEPS[(index + 1) % STEPS.length].id);
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [active, paused, reduce]);

  const step = STEPS.find((s) => s.id === active) ?? STEPS[0];
  const Artifact = step.Artifact;

  return (
    <Tabs
      value={active}
      onValueChange={(value) => {
        setActive(String(value));
        setPaused(true);
      }}
      className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-14"
    >
      <TabsList className="flex h-auto! w-full flex-row items-stretch justify-start gap-1 overflow-x-auto bg-transparent p-0 lg:flex-col">
        {STEPS.map((s, i) => (
          <TabsTrigger
            key={s.id}
            value={s.id}
            className={cn(
              "h-auto! flex-none justify-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm lg:w-full",
              "data-active:bg-accent",
            )}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs tabular">
              {i + 1}
            </span>
            {s.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="grid gap-6 rounded-2xl border bg-card p-5 sm:p-7 md:grid-cols-2 md:items-start">
        <div className="flex flex-col gap-3">
          <h3 className="text-xl font-semibold tracking-tight">{step.title}</h3>
          <p className="text-muted-foreground">{step.body}</p>
          <span className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground" aria-hidden>
            <Circle className="size-2 fill-current" />
            Step {STEPS.indexOf(step) + 1} of {STEPS.length}
          </span>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step.id}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <Artifact />
          </motion.div>
        </AnimatePresence>
      </div>
    </Tabs>
  );
}
