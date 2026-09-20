import { AudioLines, Check, Clapperboard, GitBranch, Mic, ScrollText, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type StepId = "repo" | "script" | "record" | "sync" | "video";

export interface StepState {
  id: StepId;
  done: boolean;
  reachable: boolean;
  // Shown in the tooltip when a step can't be opened yet.
  blockedReason: string;
}

const STEP_META: Record<StepId, { label: string; hint: string; icon: LucideIcon }> = {
  repo: { label: "Repo", hint: "Paste a GitHub URL", icon: GitBranch },
  script: { label: "Script", hint: "Review and lock", icon: ScrollText },
  record: { label: "Record", hint: "Scene by scene", icon: Mic },
  sync: { label: "Sync", hint: "Match voice to script", icon: AudioLines },
  video: { label: "Video", hint: "Render the final cut", icon: Clapperboard },
};

interface StepperProps {
  steps: StepState[];
  active: StepId;
  onSelect: (id: StepId) => void;
}

function StepButton({
  step,
  index,
  isActive,
  onSelect,
}: {
  step: StepState;
  index: number;
  isActive: boolean;
  onSelect: (id: StepId) => void;
}) {
  const meta = STEP_META[step.id];
  const Icon = meta.icon;

  const button = (
    <button
      type="button"
      disabled={!step.reachable}
      aria-current={isActive ? "step" : undefined}
      onClick={() => onSelect(step.id)}
      className={cn(
        "flex w-full flex-col gap-2 rounded-lg px-2 py-2 text-left transition-colors sm:px-3",
        "hover:bg-accent/60 disabled:cursor-not-allowed disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-ring",
        isActive && "bg-accent/70",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-full rounded-full transition-colors",
          step.done && "bg-primary",
          !step.done && isActive && "bg-primary/35 motion-safe:animate-pulse",
          !step.done && !isActive && "bg-muted",
        )}
      />
      <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs">
        <span
          className={cn(
            "flex shrink-0 items-center",
            step.done ? "text-primary" : isActive ? "text-primary" : "text-muted-foreground",
          )}
        >
          {step.done ? <Check className="size-3.5" /> : isActive ? <Icon className="size-3.5" /> : <span className="tabular">{index + 1}</span>}
        </span>
        <span
          className={cn(
            "truncate text-sm",
            isActive ? "font-semibold text-foreground" : step.reachable ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {meta.label}
        </span>
        <span className="hidden truncate text-muted-foreground xl:inline">{meta.hint}</span>
      </span>
    </button>
  );

  if (step.reachable) return button;

  return (
    <Tooltip>
      <TooltipTrigger render={<div className="w-full" />}>{button}</TooltipTrigger>
      <TooltipContent side="bottom">{step.blockedReason}</TooltipContent>
    </Tooltip>
  );
}

// The five steps as one bar across the top, the same shape as the progress bar
// on the dashboard, but each step can be opened once it is reachable.
export function Stepper({ steps, active, onSelect }: StepperProps) {
  return (
    <nav aria-label="Progress" className="rounded-xl border border-line-strong bg-card p-1.5 shadow-xs">
      <ol className="grid grid-cols-5 gap-1 sm:gap-2">
        {steps.map((step, index) => (
          <li key={step.id} className="min-w-0">
            <StepButton step={step} index={index} isActive={step.id === active} onSelect={onSelect} />
          </li>
        ))}
      </ol>
    </nav>
  );
}
