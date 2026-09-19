import { useState } from "react";
import { ArrowRight, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";

export type GeneratePhase = "ingest" | "script";

interface RepoFormProps {
  onSubmit: (repoUrl: string, userContext: string) => void;
  phase: GeneratePhase | null;
}

const EXAMPLE_REPO = "https://github.com/vercel/ms";

const PHASE_COPY: Record<GeneratePhase, { label: string; value: number }> = {
  ingest: { label: "Reading the repo", value: 30 },
  script: { label: "Writing the Hinglish script", value: 70 },
};

export function RepoForm({ onSubmit, phase }: RepoFormProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [userContext, setUserContext] = useState("");
  const busy = phase !== null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!repoUrl.trim()) return;
    onSubmit(repoUrl.trim(), userContext.trim());
  }

  if (phase) {
    const copy = PHASE_COPY[phase];
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <Progress value={copy.value}>
              <ProgressLabel className="flex items-center gap-2">
                <Spinner /> {copy.label}
              </ProgressLabel>
            </Progress>
            <p className="text-sm text-muted-foreground">
              {phase === "ingest"
                ? "Pulling the README, package files and a sample of source files."
                : "Splitting the explanation into scenes and beats, each with a visual."}
            </p>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-3" aria-hidden>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="repo-url">GitHub repository</Label>
            <div className="relative">
              <GitBranch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="repo-url"
                placeholder="https://github.com/owner/repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                disabled={busy}
                required
                className="h-10 pl-9 font-mono text-sm"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              No repo handy?
              <Button type="button" variant="outline" size="xs" onClick={() => setRepoUrl(EXAMPLE_REPO)}>
                Use vercel/ms
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="user-context">What should the video focus on?</Label>
            <Textarea
              id="user-context"
              placeholder="Optional. For example: how the parser handles units, and why it's one function."
              value={userContext}
              onChange={(e) => setUserContext(e.target.value)}
              disabled={busy}
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={busy || !repoUrl.trim()}>
              Draft the script
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
