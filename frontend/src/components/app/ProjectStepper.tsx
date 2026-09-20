import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STEP_NAMES } from "@/lib/stage";

interface ProjectStepperProps {
  // Steps finished so far (see STAGE_STEPS_DONE). The next one is in progress.
  done: number;
  // Show the step names under the bar. Cards use the slim, unlabeled version.
  labels?: boolean;
  failed?: boolean;
  className?: string;
}

// Five segments, left to right: finished ones filled, the one in progress
// outlined and pulsing, the rest empty.
export function ProjectStepper({ done, labels = false, failed = false, className }: ProjectStepperProps) {
  const current = done < STEP_NAMES.length ? done : -1;
  return (
    <ol
      className={cn("grid grid-cols-5 gap-1.5", labels && "gap-2 sm:gap-3", className)}
      aria-label={`${done} of ${STEP_NAMES.length} steps complete`}
    >
      {STEP_NAMES.map((name, i) => {
        const isDone = i < done;
        const isCurrent = i === current;
        return (
          <li key={name} className="flex min-w-0 flex-col gap-1.5">
            <span
              className={cn(
                "h-1.5 rounded-full",
                isDone && "bg-primary",
                isCurrent && !failed && "bg-primary/35 motion-safe:animate-pulse",
                isCurrent && failed && "bg-destructive",
                !isDone && !isCurrent && "bg-muted",
              )}
            />
            {labels && (
              <span
                className={cn(
                  "flex items-center gap-1 truncate font-mono text-xs",
                  isDone ? "text-foreground" : isCurrent ? (failed ? "text-destructive" : "text-primary") : "text-muted-foreground",
                )}
              >
                {isDone ? <Check className="size-3 shrink-0 text-primary" /> : <span className="tabular">{i + 1}</span>}
                <span className={cn("truncate", isCurrent && "font-semibold")}>{name}</span>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
