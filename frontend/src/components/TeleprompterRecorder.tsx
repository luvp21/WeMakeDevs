import { useEffect, useRef, useState } from "react";
import { ArrowRight, Camera, Check, ExternalLink, MonitorPlay, RotateCcw, Square, Upload } from "lucide-react";
import { escapeHtml, type Script, type TranscribeStatus } from "@vaani/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { DemoClipsPanel } from "@/components/DemoClipsPanel";
import { pickSupportedMimeType } from "@/lib/recordingMime";
import * as api from "@/lib/api";

interface TeleprompterRecorderProps {
  script: Script;
  lockedScriptId: string;
  // Scenes already uploaded in an earlier session (reopened project).
  initialCompletedSceneIds?: string[];
  onComplete: () => void;
}

type Stage = "setup" | "idle" | "recording" | "review" | "uploading" | "uploaded";
const TRANSCRIBE_POLL_INTERVAL_MS = 5000;

export function TeleprompterRecorder({
  script,
  lockedScriptId,
  initialCompletedSceneIds = [],
  onComplete,
}: TeleprompterRecorderProps) {
  const [sceneIndex, setSceneIndex] = useState(() => {
    const firstOpen = script.scenes.findIndex((s) => !initialCompletedSceneIds.includes(s.id));
    return firstOpen === -1 ? 0 : firstOpen;
  });
  const [stage, setStage] = useState<Stage>("setup");
  const [error, setError] = useState<string | null>(null);
  const [completedSceneIds, setCompletedSceneIds] = useState<Set<string>>(() => new Set(initialCompletedSceneIds));
  const [transcribeStatus, setTranscribeStatus] = useState<TranscribeStatus | null>(null);


  const streamRef = useRef<MediaStream | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const reviewVideoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  const scene = script.scenes[sceneIndex];
  const isLastScene = sceneIndex === script.scenes.length - 1;
  const allDone = completedSceneIds.size === script.scenes.length;
  // Product-demo beats are recorded as separate silent screen clips, before
  // the narration (DemoClipsPanel), so the take here is always camera + mic.
  const demoBeats = scene.beats.filter((b) => b.visual_spec.visual_type === "ui_demo");

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (transcribeStatus?.status !== "in_progress") return;
    const timer = setTimeout(async () => {
      try {
        const status = await api.getTranscriptionStatus(lockedScriptId, scene.id);
        setTranscribeStatus(status);
      } catch (err) {
        setTranscribeStatus({
          script_id: lockedScriptId,
          scene_id: scene.id,
          status: "failed",
          error: err instanceof Error ? err.message : "Unexpected error",
        });
      }
    }, TRANSCRIBE_POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [transcribeStatus, lockedScriptId, scene.id]);

  async function enableCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
      }
      setStage("idle");
    } catch (err) {
      setError(
        err instanceof Error
          ? `Couldn't access camera/mic: ${err.message}`
          : "Couldn't access camera/mic",
      );
    }
  }

  // The prompter can be popped out into its own window and placed wherever
  // is convenient, for example beside the clip being narrated over.
  function popOutPrompter() {
    const popup = window.open("", "vaani-prompter", "popup,width=560,height=720");
    if (!popup) {
      setError("Your browser blocked the pop-out window. Allow pop-ups for this site and try again.");
      return;
    }
    const lines = scene.beats
      .map((beat) => {
        const demo = beat.visual_spec.visual_type === "ui_demo" ? `<div class="demo">On screen: ${escapeHtml(beat.visual_spec.note)}</div>` : "";
        return `<p>${escapeHtml(beat.text)}</p>${demo}`;
      })
      .join("");
    popup.document.title = "Vaani prompter";
    popup.document.body.innerHTML = `<style>body{margin:0;padding:28px;background:#23272e;color:#eceff4;font:26px/1.5 system-ui,sans-serif}h4{margin:0 0 18px;font:600 15px system-ui;color:#9199a8}p{margin:0 0 20px}.demo{margin:-8px 0 22px;font:600 15px system-ui;color:#e5c07b}</style><h4>${escapeHtml(scene.title)}</h4>${lines}`;
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    setError(null);
    chunksRef.current = [];
    const recordStream = new MediaStream([...stream.getVideoTracks(), ...stream.getAudioTracks()]);
    const recorder = new MediaRecorder(recordStream, { mimeType: pickSupportedMimeType() });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      recordedBlobRef.current = blob;
      if (reviewVideoRef.current) {
        reviewVideoRef.current.src = URL.createObjectURL(blob);
      }
      setStage("review");
    };
    recorderRef.current = recorder;
    recorder.start();
    setStage("recording");
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function retake() {
    recordedBlobRef.current = null;
    if (reviewVideoRef.current) reviewVideoRef.current.src = "";
    setStage("idle");
    if (liveVideoRef.current && streamRef.current) {
      liveVideoRef.current.srcObject = streamRef.current;
    }
  }

  async function confirmAndUpload() {
    const blob = recordedBlobRef.current;
    if (!blob) return;
    setError(null);
    setStage("uploading");
    try {
      const { upload_url } = await api.getRecordingUploadUrl(lockedScriptId, scene.id, blob.type);
      await api.uploadRecording(upload_url, blob);
      setCompletedSceneIds((prev) => new Set(prev).add(scene.id));
      setStage("uploaded");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      setStage("review");
      return;
    }
    // Upload succeeded — transcription is a separate concern, a failure
    // here shouldn't make the (already-successful) upload look failed.
    try {
      const status = await api.startTranscription(lockedScriptId, scene.id);
      setTranscribeStatus(status);
    } catch (err) {
      setTranscribeStatus({
        script_id: lockedScriptId,
        scene_id: scene.id,
        status: "failed",
        error: err instanceof Error ? err.message : "Unexpected error",
      });
    }
  }

  function nextScene() {
    if (isLastScene) return;
    setSceneIndex((i) => i + 1);
    setStage("idle");
    setTranscribeStatus(null);
    if (liveVideoRef.current && streamRef.current) {
      liveVideoRef.current.srcObject = streamRef.current;
    }
  }

  const inCapture = stage === "review" || stage === "uploading" || stage === "uploaded";
  const completedCount = completedSceneIds.size;

  return (
    <div className="flex flex-col gap-5">
      <Progress value={(completedCount / script.scenes.length) * 100}>
        <ProgressLabel>
          {allDone ? "All scenes recorded" : `Scene ${sceneIndex + 1} of ${script.scenes.length}`}
        </ProgressLabel>
        <ProgressValue>{() => `${completedCount}/${script.scenes.length} uploaded`}</ProgressValue>
      </Progress>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {allDone ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-4">
            <span className="flex size-10 items-center justify-center rounded-full bg-success/10 text-success">
              <Check className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-semibold">Every scene is recorded</h3>
              <p className="max-w-prose text-sm text-muted-foreground">
                Your recordings are uploaded and being transcribed. Next, Vaani matches what you said to the script
                so each visual lands exactly when you say it.
              </p>
            </div>
            <Button onClick={onComplete}>
              Continue to sync
              <ArrowRight data-icon="inline-end" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
        {demoBeats.length > 0 && <DemoClipsPanel key={scene.id} beats={demoBeats} lockedScriptId={lockedScriptId} sceneId={scene.id} />}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <Card className="order-2 lg:order-1">
            <CardContent className="flex flex-col gap-4">
              <span className="text-sm font-medium text-muted-foreground">{scene.title}</span>
              <div className="flex flex-col gap-4 text-xl leading-relaxed">
                {scene.beats.map((beat) => (
                  <div key={beat.id} className="flex flex-col gap-1.5">
                    <p>{beat.text}</p>
                    {beat.visual_spec.visual_type === "ui_demo" && (
                      <span className="flex items-start gap-1.5 text-sm font-medium text-highlight">
                        <MonitorPlay className="mt-0.5 size-4 shrink-0" />
                        On screen: {beat.visual_spec.note}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="w-fit" onClick={popOutPrompter}>
                <ExternalLink data-icon="inline-start" />
                Pop out prompter
              </Button>
            </CardContent>
          </Card>

          <div className="order-1 flex flex-col gap-3 lg:order-2">
            <div className="relative aspect-video overflow-hidden rounded-xl border bg-black/40">
              {stage === "setup" && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <Camera className="size-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Vaani needs your camera and microphone to record.</p>
                  <Button onClick={enableCamera}>Enable camera and mic</Button>
                </div>
              )}
              <video
                ref={liveVideoRef}
                autoPlay
                muted
                playsInline
                className={inCapture ? "hidden" : "size-full -scale-x-100 object-cover"}
              />
              <video
                ref={reviewVideoRef}
                controls
                playsInline
                className={inCapture ? "size-full object-cover" : "hidden"}
              />
              {stage === "recording" && (
                <Badge className="absolute top-3 left-3 gap-1.5 border-transparent bg-destructive text-background">
                  <span className="size-1.5 animate-pulse rounded-full bg-current" />
                  Recording
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {stage === "idle" && (
                <Button onClick={startRecording} className="flex-1">
                  <span className="size-2 rounded-full bg-destructive" data-icon="inline-start" />
                  Start recording
                </Button>
              )}
              {stage === "recording" && (
                <Button variant="destructive" onClick={stopRecording} className="flex-1">
                  <Square data-icon="inline-start" />
                  Stop
                </Button>
              )}
              {stage === "review" && (
                <>
                  <Button variant="outline" onClick={retake}>
                    <RotateCcw data-icon="inline-start" />
                    Re-record
                  </Button>
                  <Button onClick={confirmAndUpload} className="flex-1">
                    <Upload data-icon="inline-start" />
                    Use this take
                  </Button>
                </>
              )}
              {stage === "uploading" && (
                <Button disabled className="flex-1">
                  <Spinner data-icon="inline-start" />
                  Uploading
                </Button>
              )}
              {stage === "uploaded" && (
                <Button onClick={isLastScene ? onComplete : nextScene} className="flex-1">
                  {isLastScene ? "Finish recording" : "Next scene"}
                  <ArrowRight data-icon="inline-end" />
                </Button>
              )}
            </div>

            {stage === "idle" && demoBeats.length > 0 && (
              <p className="text-xs text-muted-foreground">
                This scene shows your product. Record its demo clips first (below), then read the script here while
                the clips play beside you.
              </p>
            )}

            {stage === "uploaded" && transcribeStatus && (
              <p className="text-xs text-muted-foreground tabular">
                {transcribeStatus.status === "in_progress" && "Transcribing this take..."}
                {transcribeStatus.status === "completed" &&
                  `Transcribed, ${transcribeStatus.words?.length ?? 0} words recognized.`}
                {transcribeStatus.status === "failed" && `Transcription failed: ${transcribeStatus.error}`}
              </p>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
