import { Clapperboard, Download } from "lucide-react";
import type { RenderStatus } from "@vaani/shared";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface RenderPanelProps {
  // Either unlocks rendering: a synced real recording (primary, CLAUDE.md #1)
  // or Polly narration (fallback). The render worker itself decides which one
  // it actually used by checking for a SyncResult in S3 (render/src/index.ts);
  // these props only control what the button says.
  canRender: boolean;
  usingRealRecording: boolean;
  renderStatus: RenderStatus | null;
  onRender: () => void;
}

const PROGRESS: Record<"pending" | "running", { label: string; value: number }> = {
  pending: { label: "Queued", value: 15 },
  running: { label: "Rendering on Fargate", value: 60 },
};

export function RenderPanel({ canRender, usingRealRecording, renderStatus, onRender }: RenderPanelProps) {
  if (!canRender) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nothing to render yet</CardTitle>
          <CardDescription>Sync your recordings, or generate an AI narration, to unlock the final cut.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const status = renderStatus?.status;
  const isBusy = status === "pending" || status === "running";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Final cut
          <Badge variant="secondary">{usingRealRecording ? "Your voice" : "AI voice"}</Badge>
        </CardTitle>
        <CardDescription>
          {usingRealRecording
            ? "Visuals cut in at the moments you say them, over your own recorded audio."
            : "Visuals timed to the Kajal narration."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isBusy && (
          <Progress value={PROGRESS[status].value}>
            <ProgressLabel className="flex items-center gap-2">
              <Spinner /> {PROGRESS[status].label}
            </ProgressLabel>
          </Progress>
        )}

        {status === "error" && (
          <Alert variant="destructive">
            <AlertTitle>Render failed</AlertTitle>
            <AlertDescription>{renderStatus?.error}</AlertDescription>
          </Alert>
        )}

        {status === "done" && renderStatus?.video_url && (
          <div className="flex flex-col gap-3">
            <video
              controls
              src={renderStatus.video_url}
              className="aspect-video w-full rounded-xl border bg-black"
            />
            <div className="flex justify-end gap-2">
              <a
                href={renderStatus.video_url}
                download="vaani-video.mp4"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                <Download data-icon="inline-start" />
                Download MP4
              </a>
              <Button variant="ghost" onClick={onRender}>
                Render again
              </Button>
            </div>
          </div>
        )}

        {(!status || status === "error") && (
          <div className="flex justify-end">
            <Button onClick={onRender} size="lg">
              <Clapperboard data-icon="inline-start" />
              Render video
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
