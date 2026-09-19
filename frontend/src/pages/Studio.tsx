import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import type { IngestResult, NarrationResult, ProjectDetail, RenderStatus, Script } from "@vaani/shared";
import { RepoForm, type GeneratePhase } from "@/components/RepoForm";
import { ScriptReview } from "@/components/ScriptReview";
import { NarrationPanel } from "@/components/NarrationPanel";
import { RenderPanel } from "@/components/RenderPanel";
import { SyncPanel } from "@/components/SyncPanel";
import { TeleprompterRecorder } from "@/components/TeleprompterRecorder";
import { Stepper, type StepId, type StepState } from "@/components/Stepper";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import * as api from "@/lib/api";

const RENDER_POLL_INTERVAL_MS = 3000;

const STAGE_TITLE: Record<StepId, { title: string; description: string }> = {
  repo: {
    title: "Turn a repo into a video in your own voice",
    description: "Paste a public GitHub URL. Vaani reads it and drafts a Hinglish script you can edit.",
  },
  script: {
    title: "Review the script",
    description: "This is what you'll read aloud. Change the words, keep the beats. Lock it when it sounds like you.",
  },
  record: {
    title: "Record, one scene at a time",
    description: "Read each scene from the prompter. Retake as often as you like before you keep a take.",
  },
  sync: {
    title: "Match your voice to the script",
    description: "Vaani finds the exact moment you say each beat, so every visual cuts in on time.",
  },
  video: {
    title: "Your video",
    description: "Render the final cut with your voice and the visuals timed to it.",
  },
};

function stepForProject(detail: ProjectDetail): StepId {
  const { stage, recorded_scene_ids, scene_count } = detail.summary;
  if (stage === "synced" || stage === "rendering" || stage === "done" || stage === "error") return "video";
  if (recorded_scene_ids.length >= scene_count) return "sync";
  return "record";
}

export default function Studio() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [active, setActive] = useState<StepId>("repo");
  const [phase, setPhase] = useState<GeneratePhase | null>(null);
  const [locking, setLocking] = useState(false);
  const [loadingProject, setLoadingProject] = useState(!!id);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [script, setScript] = useState<Script | null>(null);
  const [lockedScriptId, setLockedScriptId] = useState<string | null>(null);
  const [recordedSceneIds, setRecordedSceneIds] = useState<string[]>([]);
  const [recorded, setRecorded] = useState(false);
  const [narration, setNarration] = useState<NarrationResult | null>(null);
  const [narrating, setNarrating] = useState(false);
  const [synced, setSynced] = useState(false);
  const [renderStatus, setRenderStatus] = useState<RenderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reopen a saved project. Skipped when the id is the one this session just
  // locked itself (we already hold all of its state locally).
  useEffect(() => {
    if (!id || id === lockedScriptId) return;
    let cancelled = false;
    setLoadingProject(true);
    api
      .getProject(id)
      .then((detail) => {
        if (cancelled) return;
        setScript(detail.locked.script);
        setIngestResult(detail.locked.ingest);
        setLockedScriptId(detail.locked.script_id);
        setRecordedSceneIds(detail.summary.recorded_scene_ids);
        setRecorded(detail.summary.recorded_scene_ids.length >= detail.summary.scene_count);
        setSynced(detail.summary.synced);
        setRenderStatus(detail.render);
        setActive(stepForProject(detail));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't open this project");
      })
      .finally(() => {
        if (!cancelled) setLoadingProject(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, lockedScriptId]);

  useEffect(() => {
    if (!lockedScriptId) return;
    if (renderStatus?.status !== "pending" && renderStatus?.status !== "running") return;
    const timer = setTimeout(async () => {
      try {
        const status = await api.getRenderStatus(lockedScriptId);
        setRenderStatus(status);
        if (status.status === "done") toast.success("Your video is ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unexpected error");
      }
    }, RENDER_POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [lockedScriptId, renderStatus]);

  async function handleGenerate(repoUrl: string, userContext: string) {
    setError(null);
    setPhase("ingest");
    try {
      const ingest = await api.ingestRepo(repoUrl);
      setIngestResult(ingest);
      setPhase("script");
      const generated = await api.generateScript(ingest, userContext);
      setScript(generated);
      setActive("script");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setPhase(null);
    }
  }

  async function handleLock() {
    if (!script || !ingestResult) return;
    setError(null);
    setLocking(true);
    try {
      const locked = await api.lockScript(script, ingestResult);
      setLockedScriptId(locked.script_id);
      // Give the project a real address so refresh and the dashboard both work.
      navigate(`/app/studio/${locked.script_id}`, { replace: true });
      toast.success("Script locked");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLocking(false);
    }
  }

  async function handleNarrate() {
    if (!lockedScriptId) return;
    setError(null);
    setNarrating(true);
    try {
      const result = await api.narrateScript(lockedScriptId);
      setNarration(result);
      toast.success("AI narration ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setNarrating(false);
    }
  }

  async function handleRender() {
    if (!lockedScriptId) return;
    setError(null);
    try {
      const status = await api.triggerRender(lockedScriptId);
      setRenderStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    }
  }

  function handleSynced() {
    setSynced(true);
    setRenderStatus(null);
    toast.success("Voice and script are in sync");
  }

  const steps: StepState[] = [
    { id: "repo", done: !!script, reachable: !id, blockedReason: "This project's script is already locked" },
    { id: "script", done: !!lockedScriptId, reachable: !!script, blockedReason: "Draft a script from a repo first" },
    { id: "record", done: recorded, reachable: !!lockedScriptId, blockedReason: "Lock the script first" },
    { id: "sync", done: synced || !!narration, reachable: !!lockedScriptId, blockedReason: "Lock the script first" },
    {
      id: "video",
      done: renderStatus?.status === "done",
      reachable: synced || !!narration,
      blockedReason: "Sync your recordings first",
    },
  ];

  const stage = STAGE_TITLE[active];

  if (loadingProject) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-5 w-96 max-w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (id && !script) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn't open this project</AlertTitle>
        <AlertDescription>{error ?? "It may have been removed."}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
      <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <Stepper steps={steps} active={active} onSelect={setActive} />
      </aside>

      <div className="flex min-w-0 max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{stage.title}</h1>
          <p className="max-w-prose text-muted-foreground">{stage.description}</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {active === "repo" && <RepoForm onSubmit={handleGenerate} phase={phase} />}

        {active === "script" && script && (
          <ScriptReview
            script={script}
            onChange={setScript}
            onLock={handleLock}
            onContinue={() => setActive("record")}
            locking={locking}
            lockedScriptId={lockedScriptId}
            ingestResult={ingestResult}
          />
        )}

        {/* Stays mounted while other steps are open so leaving mid-session
            doesn't drop the camera stream or the list of uploaded scenes. */}
        {script && lockedScriptId && (
          <div className={active === "record" ? undefined : "hidden"}>
            <TeleprompterRecorder
              script={script}
              lockedScriptId={lockedScriptId}
              initialCompletedSceneIds={recordedSceneIds}
              onComplete={() => {
                setRecorded(true);
                setActive("sync");
              }}
            />
          </div>
        )}

        {active === "sync" && script && lockedScriptId && (
          <div className="flex flex-col gap-6">
            <SyncPanel
              script={script}
              lockedScriptId={lockedScriptId}
              recorded={recorded}
              synced={synced}
              onSynced={handleSynced}
              onContinue={() => setActive("video")}
            />
            <NarrationPanel
              script={script}
              lockedScriptId={lockedScriptId}
              narration={narration}
              onGenerate={handleNarrate}
              onContinue={() => setActive("video")}
              generating={narrating}
            />
          </div>
        )}

        {active === "video" && (
          <RenderPanel
            canRender={!!narration || synced}
            usingRealRecording={synced}
            renderStatus={renderStatus}
            onRender={handleRender}
          />
        )}
      </div>
    </div>
  );
}
