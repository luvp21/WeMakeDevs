import { useState } from "react";
import { useReducedMotion } from "motion/react";
import { GitBranch, ScrollText, Mic, AudioLines, Clapperboard, Database, Cpu, Activity, Volume2, Layers, Code, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";

interface StackCardItem {
  part: string;
  tech: string;
  note: string;
  extra: string;
  tag: "AWS" | "External" | "Own code";
  icon: React.ElementType;
}

const ROW_1_PIPELINE: StackCardItem[] = [
  { part: "Read the repo", tech: "GitHub API", note: "README, package files, sampled source", extra: "Fetches public tree, package.json dependencies, and top 5 source files for Gemini context.", tag: "External", icon: GitBranch },
  { part: "Write the script", tech: "Gemini", note: "Beat-tagged Hinglish with a visual per beat", extra: "Drafts beat-by-beat narration with paired code/slide visual specs.", tag: "External", icon: ScrollText },
  { part: "Hear you", tech: "Whisper large-v3", note: "Keeps English terms intact in Hindi speech", extra: "Runs on Groq cloud API for sub-second transcription with English word preservation.", tag: "External", icon: Mic },
  { part: "Match voice to script", tech: "Two-pointer sync", note: "Plain TypeScript, no ML alignment model", extra: "Deterministic pointer walk handles stutters, filler words, and phonetic Hindi variations.", tag: "Own code", icon: AudioLines },
  { part: "Cut the video", tech: "Playwright + FFmpeg", note: "Rendered on AWS Fargate, never on Lambda", extra: "Spawns headless Chromium beat capture and merges audio/video tracks at exact timestamps.", tag: "Own code", icon: Clapperboard },
  { part: "Store and serve", tech: "S3, Lambda, API Gateway", note: "Recordings upload straight from browser to S3", extra: "Direct S3 presigned POST uploads bypass Lambda payload limits for raw audio takes.", tag: "AWS", icon: HardDrive },
];

const ROW_2_BACKBONE: StackCardItem[] = [
  { part: "Workflow Orchestration", tech: "AWS Step Functions", note: "State machine managing script generation & rendering", extra: "Handles retries, failure notifications, and worker task polling automatically.", tag: "AWS", icon: Cpu },
  { part: "Database", tech: "Amazon DynamoDB", note: "Single-table design for projects & scenes", extra: "Sub-10ms reads for project metadata, scene script arrays, and take manifests.", tag: "AWS", icon: Database },
  { part: "Monitoring & Alerts", tech: "SNS + CloudWatch", note: "Real-time alerts for render job failures", extra: "Triggers CloudWatch alarms and SNS topic emails if a Fargate render fails.", tag: "AWS", icon: Activity },
  { part: "Fallback Voice", tech: "Amazon Polly (Kajal)", note: "Neural Indian English & Hindi voice engine", extra: "Used as a safety net if a creator skips recording their own voice.", tag: "AWS", icon: Volume2 },
  { part: "Infrastructure as Code", tech: "AWS SAM + CloudFormation", note: "Declarative AWS stack template", extra: "Deploys API Gateway routes, Lambda functions, and IAM roles in one command.", tag: "AWS", icon: Layers },
  { part: "Frontend Stack", tech: "React 19 + Vite + Tailwind v4", note: "Geist Mono, Base UI primitives, Motion", extra: "Built for instant dev feedback and sub-second page loads without heavy UI frameworks.", tag: "External", icon: Code },
];

function MarqueeCard({ item }: { item: StackCardItem }) {
  const Icon = item.icon;
  return (
    <div
      tabIndex={0}
      className={cn(
        "group relative flex w-80 shrink-0 flex-col justify-between gap-3 rounded-md border border-line-strong bg-card p-4 font-mono transition-all duration-200 cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-ring",
        "hover:scale-[1.02] hover:border-primary hover:bg-card hover:shadow-md hover:z-20"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{item.part}</span>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-semibold border",
            item.tag === "AWS" && "bg-accent border-primary/30 text-primary",
            item.tag === "Own code" && "bg-highlight-soft border-highlight/40 text-highlight-foreground",
            item.tag === "External" && "bg-secondary border-line-strong text-muted-foreground"
          )}
        >
          {item.tag}
        </span>
      </div>

      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{item.tech}</span>
          <span className="text-xs text-muted-foreground leading-snug">{item.note}</span>
        </div>
      </div>

      <div className="hidden text-[11px] text-muted-foreground border-t border-line-strong pt-2 leading-relaxed group-hover:block transition-all">
        {item.extra}
      </div>
    </div>
  );
}

export function StackMarquee() {
  const reduce = useReducedMotion();
  const [isPaused, setIsPaused] = useState(false);

  // Repeat array twice for seamless marquee loop
  const row1 = [...ROW_1_PIPELINE, ...ROW_1_PIPELINE];
  const row2 = [...ROW_2_BACKBONE, ...ROW_2_BACKBONE];

  if (reduce) {
    return (
      <div className="flex flex-col gap-6 py-4">
        <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-thin">
          {ROW_1_PIPELINE.map((item, i) => (
            <MarqueeCard key={i} item={item} />
          ))}
        </div>
        <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-thin">
          {ROW_2_BACKBONE.map((item, i) => (
            <MarqueeCard key={i} item={item} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      className="relative flex flex-col gap-6 overflow-hidden py-4 select-none group/marquee"
    >
      {/* Edge gradient fade masks */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent" />

      {/* Row 1: Pipeline (scrolls left 42s) */}
      <div className="flex w-max gap-4 animate-marquee hover:[animation-play-state:paused]" style={{ animationPlayState: isPaused ? "paused" : "running" }}>
        {row1.map((item, i) => (
          <MarqueeCard key={`r1-${i}`} item={item} />
        ))}
      </div>

      {/* Row 2: AWS Backbone (scrolls right 48s) */}
      <div className="flex w-max gap-4 animate-marquee-reverse hover:[animation-play-state:paused]" style={{ animationPlayState: isPaused ? "paused" : "running" }}>
        {row2.map((item, i) => (
          <MarqueeCard key={`r2-${i}`} item={item} />
        ))}
      </div>

      {/* Legend below marquee */}
      <div className="flex items-center justify-center gap-6 font-mono text-xs text-muted-foreground border-t border-line-strong pt-4 mt-2">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" /> AWS Backbone
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-highlight" /> Vaani Custom Code
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-muted-foreground" /> External Services
        </span>
      </div>
    </div>
  );
}
