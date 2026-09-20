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
        "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
        "hover:bg-accent/60 disabled:cursor-not-allowed disabled:hover:bg-transparent",
        isActive && "bg-accent",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors tabular",
          step.done && !isActive && "border-success/40 bg-success/10 text-success",
          isActive && "border-primary bg-primary text-primary-foreground",
          !step.done && !isActive && "border-border text-muted-foreground",
        )}
      >
        {step.done && !isActive ? <Check className="size-4" /> : isActive ? <Icon className="size-4" /> : index + 1}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block text-sm font-medium",
            !step.reachable && "text-muted-foreground",
          )}
        >
          {meta.label}
        </span>
        <span className="hidden truncate text-xs text-muted-foreground lg:block">{meta.hint}</span>
      </span>
    </button>
  );

  if (step.reachable) return button;

  return (
    <Tooltip>
      <TooltipTrigger render={<div className="w-full" />}>{button}</TooltipTrigger>
      <TooltipContent side="right">{step.blockedReason}</TooltipContent>
    </Tooltip>
  );
}

export function Stepper({ steps, active, onSelect }: StepperProps) {
  return (
    <nav aria-label="Progress" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {steps.map((step, index) => (
        <div key={step.id} className="relative min-w-[8.5rem] flex-1 lg:min-w-0 lg:flex-none">
          <StepButton step={step} index={index} isActive={step.id === active} onSelect={onSelect} />
          {index < steps.length - 1 && (
            <span
              aria-hidden
              className={cn(
                "absolute top-[2.9rem] left-[1.65rem] hidden h-3 w-px lg:block",
                step.done ? "bg-success/40" : "bg-border",
              )}
            />
          )}
        </div>
      ))}
    </nav>
  );
}
