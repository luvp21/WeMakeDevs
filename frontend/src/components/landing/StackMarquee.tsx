import { useState } from "react";
import { useReducedMotion } from "motion/react";
import { GitBranch, ScrollText, Mic, AudioLines, Clapperboard, Database, Cpu, Activity, Volume2, Layers, Code, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";

interface StackCardItem {
  part: string;
  tech: string;
  detail: string;
  extra: string;
  tag: "AWS" | "External" | "Own code";
  icon: React.ElementType;
}

const ROW_1_PIPELINE: StackCardItem[] = [
  { part: "Read the repo", tech: "GitHub API", detail: "Reads the README, package files and a few key source files.", extra: "One request per repo, cached for 15 minutes. Gemini gets the README, package files and a capped sample of code.", tag: "External", icon: GitBranch },
  { part: "Write the script", tech: "Gemini", detail: "Writes beat by beat narration, each beat with its own visual.", extra: "Two steps: plan the scenes, then write each one. Length follows a word budget, in Hinglish or English.", tag: "External", icon: ScrollText },
  { part: "Hear you", tech: "Whisper large-v3", detail: "Transcribes your voice on Groq and keeps English terms intact.", extra: "Gives a timestamp for every word, which the sync step uses to place each cut.", tag: "External", icon: Mic },
  { part: "Match voice to script", tech: "Two-pointer sync", detail: "Plain TypeScript that skips stutters and fillers. No ML model.", extra: "Walks the script and transcript together, so repeats and dropped words don't throw the cuts off.", tag: "Own code", icon: AudioLines },
  { part: "Cut the video", tech: "Playwright + FFmpeg", detail: "Captures each beat and joins audio and video on AWS Fargate.", extra: "Screenshots each beat in headless Chromium, then ffmpeg cuts at your word times and adds your face bubble.", tag: "Own code", icon: Clapperboard },
  { part: "Store and serve", tech: "S3, Lambda, API Gateway", detail: "Recordings upload from the browser straight to S3.", extra: "Uploads use presigned URLs, so large recordings never pass through Lambda.", tag: "AWS", icon: HardDrive },
];

const ROW_2_BACKBONE: StackCardItem[] = [
  { part: "Workflow Orchestration", tech: "AWS Step Functions", detail: "Runs the render, retries it and alerts if it fails.", extra: "Starts the Fargate render. If it fails, the video is marked failed, quota refunded and an alert sent.", tag: "AWS", icon: Cpu },
  { part: "Database", tech: "Amazon DynamoDB", detail: "Tracks usage limits and per-user quotas.", extra: "Holds each user's quota and rate-limit counters, which expire on their own.", tag: "AWS", icon: Database },
  { part: "Monitoring & Alerts", tech: "SNS + CloudWatch", detail: "Emails the team when a render job fails.", extra: "A CloudWatch alarm on failed renders sends an email through an SNS topic.", tag: "AWS", icon: Activity },
  { part: "Fallback Voice", tech: "Amazon Polly (Kajal)", detail: "Indian English and Hindi voice, used only as a fallback.", extra: "Reads the script in Kajal's voice, so a full video exists even if recording fails.", tag: "AWS", icon: Volume2 },
  { part: "Infrastructure as Code", tech: "AWS SAM + CloudFormation", detail: "The whole AWS stack deploys with one command.", extra: "One template defines the Lambdas, API routes, roles, bucket, table and workflow.", tag: "AWS", icon: Layers },
  { part: "Frontend Stack", tech: "React 19 + Vite + Tailwind v4", detail: "Geist Mono, Base UI and Motion. Fast to load.", extra: "React 19, Vite and Tailwind v4, with Base UI components and Motion for animation.", tag: "External", icon: Code },
];

function MarqueeCard({ item }: { item: StackCardItem }) {
  const Icon = item.icon;
  return (
    <div
      tabIndex={0}
      className={cn(
        "group relative flex h-36 w-80 shrink-0 flex-col justify-between gap-3 rounded-md border border-line-strong bg-card p-4 font-mono transition-colors duration-200 cursor-default select-none focus-visible:outline-2 focus-visible:outline-ring",
        "hover:border-primary hover:shadow-md"
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
          {/* Both texts share one grid cell, so the card never changes size on hover or focus. */}
          <span className="grid text-xs leading-snug text-muted-foreground">
            <span className="col-start-1 row-start-1 transition-opacity duration-200 group-hover:opacity-0 group-focus-visible:opacity-0">{item.detail}</span>
            <span className="col-start-1 row-start-1 text-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">{item.extra}</span>
          </span>
        </div>
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
