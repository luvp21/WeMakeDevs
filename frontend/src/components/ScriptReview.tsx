import { ArrowRight, Lock, LockKeyhole } from "lucide-react";
import type { Beat, IngestResult, Scene, Script, VisualSpec } from "@vaani/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Spinner } from "@/components/ui/spinner";
import { VisualPreview } from "@/components/VisualPreview";

interface ScriptReviewProps {
  script: Script;
  onChange: (next: Script) => void;
  onLock: () => void;
  onContinue: () => void;
  locking: boolean;
  lockedScriptId: string | null;
  ingestResult: IngestResult | null;
}

const VISUAL_LABEL: Record<VisualSpec["visual_type"], string> = {
  code_highlight: "Code",
  slide: "Slide",
  graph: "Diagram",
  ui_demo: "Live demo",
};

function visualSpecSummary(spec: VisualSpec): string {
  switch (spec.visual_type) {
    case "code_highlight":
      return `${spec.file_path || "(no file)"}  L${spec.start_line}-${spec.end_line}`;
    case "slide":
      return "";
    case "graph":
      return spec.description || "";
    case "ui_demo":
      return spec.note || "";
  }
}

function updateBeatText(script: Script, sceneId: string, beatId: string, text: string): Script {
  return {
    ...script,
    scenes: script.scenes.map((scene: Scene) =>
      scene.id !== sceneId
        ? scene
        : {
            ...scene,
            beats: scene.beats.map((beat: Beat) => (beat.id !== beatId ? beat : { ...beat, text })),
          },
    ),
  };
}

function updateSceneTitle(script: Script, sceneId: string, title: string): Script {
  return {
    ...script,
    scenes: script.scenes.map((scene) => (scene.id !== sceneId ? scene : { ...scene, title })),
  };
}

export function ScriptReview({
  script,
  onChange,
  onLock,
  onContinue,
  locking,
  lockedScriptId,
  ingestResult,
}: ScriptReviewProps) {
  const isLocked = lockedScriptId !== null;
  const beatCount = script.scenes.reduce((sum, scene) => sum + scene.beats.length, 0);

  return (
    <div className="flex flex-col gap-6">
      <Accordion multiple defaultValue={[script.scenes[0]?.id]} className="flex flex-col gap-3">
        {script.scenes.map((scene, sceneIndex) => (
          <Card key={scene.id} size="sm" className="py-0">
            <AccordionItem value={scene.id} className="border-0">
              <AccordionTrigger className="items-center px-4 py-3.5 hover:no-underline">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground tabular">
                    {sceneIndex + 1}
                  </span>
                  <span className="truncate text-sm font-medium">{scene.title || "Untitled scene"}</span>
                  <Badge variant="secondary" className="tabular">
                    {scene.beats.length} {scene.beats.length === 1 ? "beat" : "beats"}
                  </Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <CardContent className="flex flex-col gap-5">
                  <Input
                    aria-label={`Title for scene ${sceneIndex + 1}`}
                    value={scene.title}
                    disabled={isLocked}
                    onChange={(e) => onChange(updateSceneTitle(script, scene.id, e.target.value))}
                    className="max-w-md font-medium"
                  />
                  {scene.beats.map((beat, beatIndex) => {
                    const summary = visualSpecSummary(beat.visual_spec);
                    return (
                      <div key={beat.id} className="grid gap-3 md:grid-cols-2 md:gap-5">
                        <div className="flex flex-col gap-2">
                          <span className="text-xs font-medium text-muted-foreground tabular">
                            Narration {beatIndex + 1}
                          </span>
                          <Textarea
                            aria-label={`Narration for beat ${beatIndex + 1}`}
                            value={beat.text}
                            disabled={isLocked}
                            onChange={(e) => onChange(updateBeatText(script, scene.id, beat.id, e.target.value))}
                            rows={4}
                            className="text-base leading-relaxed"
                          />
                        </div>
                        <div className="flex min-w-0 flex-col gap-2">
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline">{VISUAL_LABEL[beat.visual_type]}</Badge>
                            {summary && <span className="truncate font-mono">{summary}</span>}
                          </span>
                          <VisualPreview spec={beat.visual_spec} ingestResult={ingestResult} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </AccordionContent>
            </AccordionItem>
          </Card>
        ))}
      </Accordion>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-popover/95 px-4 py-3 shadow-lg shadow-black/30 backdrop-blur">
        <p className="text-sm text-muted-foreground tabular">
          {script.scenes.length} scenes, {beatCount} beats.{" "}
          {isLocked ? "Locked. Recording reads from this version." : "Edit anything, then lock it before recording."}
        </p>
        {isLocked ? (
          <Button onClick={onContinue}>
            Continue to recording
            <ArrowRight data-icon="inline-end" />
          </Button>
        ) : (
          <Button onClick={onLock} disabled={locking}>
            {locking ? <Spinner data-icon="inline-start" /> : <Lock data-icon="inline-start" />}
            {locking ? "Locking" : "Lock script"}
          </Button>
        )}
      </div>
      {isLocked && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <LockKeyhole className="size-3.5" />
          <span className="font-mono">{lockedScriptId}</span>
        </p>
      )}
    </div>
  );
}
