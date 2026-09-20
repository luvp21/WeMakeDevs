import { useState } from "react";
import { ArrowRight, Lock, LockKeyhole, PenLine, RefreshCw } from "lucide-react";
import { SCRIPT_LANGUAGES, countWords, estimateSeconds, formatDuration } from "@vaani/shared";
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
  // Rebuild one beat's visual, or a whole scene's beats and visuals, from
  // narration the user edited. The wording is kept; the visuals follow it.
  onRegenerateBeat: (sceneId: string, beatId: string, text: string) => Promise<void>;
  onRewriteScene: (sceneId: string, text: string) => Promise<void>;
  locking: boolean;
  lockedScriptId: string | null;
  ingestResult: IngestResult | null;
}

const VISUAL_LABEL: Record<VisualSpec["visual_type"], string> = {
  code_highlight: "Code",
  slide: "Slide",
  graph: "Diagram",
  diagram: "Diagram",
  chart: "Chart",
  ui_demo: "Product demo",
};

function visualSpecSummary(spec: VisualSpec): string {
  switch (spec.visual_type) {
    case "code_highlight":
      return `${spec.file_path || "(no file)"}  L${spec.start_line}-${spec.end_line}`;
    case "slide":
      return "";
    case "graph":
      return spec.description || "";
    case "diagram":
      return spec.title ?? `${spec.nodes.length} components`;
    case "chart":
      return spec.title;
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

function sceneText(scene: Scene): string {
  return scene.beats.map((b) => b.text).join("\n\n");
}

function sceneSeconds(scene: Scene): number {
  return estimateSeconds(scene.beats.map((b) => b.text).join(" "));
}

export function ScriptReview({
  script,
  onChange,
  onLock,
  onContinue,
  onRegenerateBeat,
  onRewriteScene,
  locking,
  lockedScriptId,
  ingestResult,
}: ScriptReviewProps) {
  const isLocked = lockedScriptId !== null;
  const beatCount = script.scenes.reduce((sum, scene) => sum + scene.beats.length, 0);
  const totalWords = script.scenes.reduce((sum, scene) => sum + scene.beats.reduce((n, b) => n + countWords(b.text), 0), 0);
  const totalSeconds = script.scenes.reduce((sum, scene) => sum + sceneSeconds(scene), 0);

  // Beats whose wording changed after their visual was made, so the visual may
  // no longer fit. Cleared when the visual is regenerated.
  const [stale, setStale] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [rewriteDraft, setRewriteDraft] = useState<Record<string, string>>({});

  function markBusy(id: string, on: boolean) {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function regenerateBeat(scene: Scene, beat: Beat) {
    markBusy(beat.id, true);
    try {
      await onRegenerateBeat(scene.id, beat.id, beat.text);
      setStale((prev) => {
        const next = new Set(prev);
        next.delete(beat.id);
        return next;
      });
    } finally {
      markBusy(beat.id, false);
    }
  }

  async function rewriteScene(scene: Scene) {
    const text = rewriteDraft[scene.id];
    if (!text?.trim()) return;
    markBusy(scene.id, true);
    try {
      await onRewriteScene(scene.id, text);
      setRewriteDraft((prev) => {
        const { [scene.id]: _removed, ...rest } = prev;
        return rest;
      });
    } finally {
      markBusy(scene.id, false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Accordion multiple defaultValue={[script.scenes[0]?.id]} className="flex flex-col gap-3">
        {script.scenes.map((scene, sceneIndex) => {
          const rewriting = scene.id in rewriteDraft;
          const sceneBusy = busy.has(scene.id);
          return (
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
                    <span className="text-xs text-muted-foreground tabular">{formatDuration(sceneSeconds(scene))}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <CardContent className="flex flex-col gap-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        aria-label={`Title for scene ${sceneIndex + 1}`}
                        value={scene.title}
                        disabled={isLocked}
                        onChange={(e) => onChange(updateSceneTitle(script, scene.id, e.target.value))}
                        className="max-w-md font-medium"
                      />
                      {!isLocked && !rewriting && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRewriteDraft((prev) => ({ ...prev, [scene.id]: sceneText(scene) }))}
                        >
                          <PenLine data-icon="inline-start" />
                          Rewrite scene
                        </Button>
                      )}
                    </div>

                    {rewriting && (
                      <div className="flex flex-col gap-3 rounded-lg border border-dashed p-3">
                        <p className="text-sm text-muted-foreground">
                          Change this scene's script however you like. Vaani keeps your wording and rebuilds the beats
                          and visuals to match it.
                        </p>
                        <Textarea
                          aria-label={`Script for scene ${sceneIndex + 1}`}
                          value={rewriteDraft[scene.id]}
                          onChange={(e) => setRewriteDraft((prev) => ({ ...prev, [scene.id]: e.target.value }))}
                          rows={8}
                          disabled={sceneBusy}
                          className="text-base leading-relaxed"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground tabular">
                            {countWords(rewriteDraft[scene.id] ?? "")} words, about{" "}
                            {formatDuration(estimateSeconds(rewriteDraft[scene.id] ?? ""))}
                          </span>
                          <span className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={sceneBusy}
                              onClick={() =>
                                setRewriteDraft((prev) => {
                                  const { [scene.id]: _removed, ...rest } = prev;
                                  return rest;
                                })
                              }
                            >
                              Cancel
                            </Button>
                            <Button size="sm" disabled={sceneBusy || !rewriteDraft[scene.id]?.trim()} onClick={() => rewriteScene(scene)}>
                              {sceneBusy ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
                              {sceneBusy ? "Rebuilding" : "Rebuild scene"}
                            </Button>
                          </span>
                        </div>
                      </div>
                    )}

                    {scene.beats.map((beat, beatIndex) => {
                      const summary = visualSpecSummary(beat.visual_spec);
                      const beatBusy = busy.has(beat.id);
                      const isStale = stale.has(beat.id);
                      return (
                        <div key={beat.id} className="grid gap-3 md:grid-cols-2 md:gap-5">
                          <div className="flex flex-col gap-2">
                            <span className="flex items-center justify-between text-xs font-medium text-muted-foreground tabular">
                              <span>Narration {beatIndex + 1}</span>
                              <span className="font-normal">
                                {countWords(beat.text)} words, about {Math.max(1, Math.round(estimateSeconds(beat.text)))}s
                              </span>
                            </span>
                            <Textarea
                              aria-label={`Narration for beat ${beatIndex + 1}`}
                              value={beat.text}
                              disabled={isLocked || beatBusy}
                              onChange={(e) => {
                                onChange(updateBeatText(script, scene.id, beat.id, e.target.value));
                                setStale((prev) => new Set(prev).add(beat.id));
                              }}
                              rows={4}
                              className="text-base leading-relaxed"
                            />
                            {!isLocked && (
                              <Button
                                variant={isStale ? "default" : "outline"}
                                size="sm"
                                className="w-fit"
                                disabled={beatBusy || !beat.text.trim()}
                                onClick={() => regenerateBeat(scene, beat)}
                              >
                                {beatBusy ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
                                {beatBusy ? "Updating visual" : isStale ? "Update visual to match" : "Regenerate visual"}
                              </Button>
                            )}
                          </div>
                          <div className="flex min-w-0 flex-col gap-2">
                            <span className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline">{VISUAL_LABEL[beat.visual_type]}</Badge>
                              {isStale && <Badge variant="secondary">Wording changed</Badge>}
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
          );
        })}
      </Accordion>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-popover/95 px-4 py-3 shadow-lg shadow-black/30 backdrop-blur">
        <p className="text-sm text-muted-foreground tabular">
          {SCRIPT_LANGUAGES[script.language].name}, {script.scenes.length} scenes, {beatCount} beats, {totalWords} words, about {formatDuration(totalSeconds)}.{" "}
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
