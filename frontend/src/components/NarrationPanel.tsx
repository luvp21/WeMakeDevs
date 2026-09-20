import { ArrowRight } from "lucide-react";
import { formatDuration, type NarrationResult, type Script } from "@vaani/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

interface NarrationPanelProps {
  script: Script;
  lockedScriptId: string | null;
  narration: NarrationResult | null;
  onGenerate: () => void;
  onContinue: () => void;
  generating: boolean;
}

export function NarrationPanel({
  script,
  lockedScriptId,
  narration,
  onGenerate,
  onContinue,
  generating,
}: NarrationPanelProps) {
  if (!lockedScriptId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prefer an AI voice?</CardTitle>
        <CardDescription>
          Kajal, an Amazon Polly voice, reads the locked script instead. A solid safety net when you can't record, but
          it isn't your voice.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {narration &&
          narration.scenes.map((sceneNarration) => {
            const scene = script.scenes.find((s) => s.id === sceneNarration.scene_id);
            return (
              <div key={sceneNarration.scene_id} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{scene?.title ?? sceneNarration.scene_id}</span>
                  <span className="text-muted-foreground tabular">{formatDuration(sceneNarration.duration_ms / 1000)}</span>
                </div>
                <audio controls src={sceneNarration.audio_url} className="w-full" />
              </div>
            );
          })}
        <div className="flex justify-end">
          {narration ? (
            <Button variant="outline" onClick={onContinue}>
              Continue to video
              <ArrowRight data-icon="inline-end" />
            </Button>
          ) : (
            <Button variant="outline" onClick={onGenerate} disabled={generating}>
              {generating && <Spinner data-icon="inline-start" />}
              {generating ? "Generating narration" : "Generate AI narration"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
