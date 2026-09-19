import { useState } from "react";
import { ArrowRight, GitBranch, MonitorPlay } from "lucide-react";
import {
  TARGET_MINUTES_OPTIONS,
  VIDEO_FORMAT_LIST,
  VIDEO_FORMATS,
  countWords,
  estimateSeconds,
  formatDuration,
  minutesLabel,
  type VideoFormatId,
} from "@vaani/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

export type GeneratePhase = "ingest" | "plan" | "write";
export interface GenerateStatus {
  phase: GeneratePhase;
  done?: number;
  total?: number;
}

interface RepoFormProps {
  onSubmit: (repoUrl: string, userContext: string, format: VideoFormatId, options: { targetMinutes?: number; sourceScript?: string }) => void;
  status: GenerateStatus | null;
}

const EXAMPLE_REPO = "https://github.com/vercel/ms";

// What to ask the user for, per format: the focus note is where real numbers,
// the product's purpose and the audience go, since those can't be read from code.
const CONTEXT_PLACEHOLDER: Record<VideoFormatId, string> = {
  code_walkthrough: "Optional. For example: how the parser handles units, and why it's one function.",
  hackathon_demo: "What does it do, who is it for, and what did you build it with? Add any real results or numbers to show (they'll be used as-is, never invented).",
  product_demo: "Who uses this and what do they get out of it? Which two or three workflows should the tour cover?",
  architecture_overview: "Optional. Which parts of the system matter most, and which tradeoffs should be called out?",
  launch_teaser: "The one-line pitch, and where people can get it.",
};

function progressCopy(status: GenerateStatus): { label: string; detail: string; value: number } {
  if (status.phase === "ingest") {
    return { label: "Reading the repo", detail: "Pulling the README, package files and a sample of source files.", value: 12 };
  }
  if (status.phase === "plan") {
    return { label: "Planning the scenes", detail: "Deciding the shape of the video and how long each scene should be.", value: 28 };
  }
  const done = status.done ?? 0;
  const total = status.total ?? 1;
  return {
    label: done >= total ? "Finishing up" : `Writing scene ${done + 1} of ${total}`,
    detail: "Each scene is written on its own, a few at a time, with its own visuals.",
    value: 30 + Math.round((done / total) * 68),
  };
}

export function RepoForm({ onSubmit, status }: RepoFormProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [userContext, setUserContext] = useState("");
  const [format, setFormat] = useState<VideoFormatId>("hackathon_demo");
  const [minutes, setMinutes] = useState<number>(VIDEO_FORMATS.hackathon_demo.defaultMinutes);
  const [sourceScript, setSourceScript] = useState("");
  const scriptWords = countWords(sourceScript);
  const hasOwnScript = scriptWords > 0;
  const busy = status !== null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!repoUrl.trim()) return;
    onSubmit(repoUrl.trim(), userContext.trim(), format, {
      targetMinutes: hasOwnScript ? undefined : minutes,
      sourceScript: hasOwnScript ? sourceScript.trim() : undefined,
    });
  }

  if (status) {
    const copy = progressCopy(status);
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <Progress value={copy.value}>
              <ProgressLabel className="flex items-center gap-2 tabular">
                <Spinner /> {copy.label}
              </ProgressLabel>
            </Progress>
            <p className="text-sm text-muted-foreground">{copy.detail}</p>
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
            <Label id="format-label">What kind of video?</Label>
            <RadioGroup
              aria-labelledby="format-label"
              value={format}
              onValueChange={(value) => {
                setFormat(value as VideoFormatId);
                setMinutes(VIDEO_FORMATS[value as VideoFormatId].defaultMinutes);
              }}
              className="grid gap-2 sm:grid-cols-2"
            >
              {VIDEO_FORMAT_LIST.map((f) => (
                <label
                  key={f.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors hover:bg-accent/40",
                    format === f.id && "border-primary bg-primary/5",
                  )}
                >
                  <RadioGroupItem value={f.id} className="mt-0.5" />
                  <span className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-sm font-medium">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{f.tagline}</span>
                    <span className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="tabular">{f.length}</Badge>
                      {f.screenShare === "required" && (
                        <Badge variant="outline" className="gap-1">
                          <MonitorPlay className="size-3" />
                          Shows your product
                        </Badge>
                      )}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="user-context">{format === "code_walkthrough" ? "What should the video focus on?" : "Tell Vaani about it"}</Label>
            <Textarea
              id="user-context"
              placeholder={CONTEXT_PLACEHOLDER[format]}
              value={userContext}
              onChange={(e) => setUserContext(e.target.value)}
              disabled={busy}
              rows={4}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label id="length-label">How long should it be?</Label>
            <Tabs
              value={String(minutes)}
              onValueChange={(value) => setMinutes(Number(value))}
              aria-labelledby="length-label"
            >
              <TabsList className={hasOwnScript ? "opacity-50" : undefined}>
                {TARGET_MINUTES_OPTIONS.map((m) => (
                  <TabsTrigger key={m} value={String(m)} disabled={hasOwnScript || busy} className="tabular">
                    {minutesLabel(m)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <p className="text-xs text-muted-foreground">
              {hasOwnScript
                ? "Your own script sets the length, so this is off."
                : "Vaani writes to fit: about 135 spoken words per minute."}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="source-script">Already have a script? (optional)</Label>
            <Textarea
              id="source-script"
              placeholder="Paste your narration here. Vaani keeps your words and builds the slides, diagrams and demo beats around them."
              value={sourceScript}
              onChange={(e) => setSourceScript(e.target.value)}
              disabled={busy}
              rows={5}
            />
            {hasOwnScript && (
              <p className="text-xs text-muted-foreground tabular">
                {scriptWords} words, about {formatDuration(estimateSeconds(sourceScript))} spoken.
              </p>
            )}
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
