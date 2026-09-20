import { Badge } from "@/components/ui/badge";

interface StudioHeaderProps {
  step: number;
  stepCount: number;
  title: string;
  description: string;
  // Set once a script exists, so it's clear which repo this session is about.
  repoUrl?: string;
  locked: boolean;
}

// "https://github.com/owner/name" as "owner/name".
function repoLabel(repoUrl: string): string {
  try {
    const path = new URL(repoUrl).pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/, "");
    return path || repoUrl;
  } catch {
    return repoUrl;
  }
}

export function StudioHeader({ step, stepCount, title, description, repoUrl, locked }: StudioHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-mono text-xs text-muted-foreground tabular">
          Step {step} of {stepCount}
        </span>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        <p className="max-w-3xl font-mono text-sm text-muted-foreground">{description}</p>
      </div>
      {repoUrl && (
        <div className="flex items-center gap-2 font-mono text-sm">
          <span className="truncate font-semibold">{repoLabel(repoUrl)}</span>
          <Badge variant="secondary">{locked ? "Script locked" : "Draft"}</Badge>
        </div>
      )}
    </div>
  );
}
