import {
  IngestResultSchema,
  ScriptSchema,
  LockedScriptSchema,
  NarrationResultSchema,
  RenderStatusSchema,
  RecordingUploadUrlResponseSchema,
  TranscribeStatusSchema,
  SyncResultSchema,
  ProjectListSchema,
  ProjectDetailSchema,
  ApiErrorSchema,
  type IngestResult,
  type Script,
  type LockedScript,
  type NarrationResult,
  type RenderStatus,
  type RecordingUploadUrlResponse,
  type TranscribeStatus,
  type SyncResult,
  type ProjectList,
  type ProjectDetail,
} from "@vaani/shared";
import { z } from "zod";

async function postJson<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json: unknown = await res.json();
  if (!res.ok) {
    const parsedError = ApiErrorSchema.safeParse(json);
    throw new Error(parsedError.success ? parsedError.data.error : `Request to ${path} failed (${res.status})`);
  }
  return schema.parse(json);
}

async function getJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(`/api${path}`);
  const json: unknown = await res.json();
  if (!res.ok) {
    const parsedError = ApiErrorSchema.safeParse(json);
    throw new Error(parsedError.success ? parsedError.data.error : `Request to ${path} failed (${res.status})`);
  }
  return schema.parse(json);
}

export function ingestRepo(repoUrl: string): Promise<IngestResult> {
  return postJson("/ingest", { repo_url: repoUrl }, IngestResultSchema);
}

export function generateScript(ingest: IngestResult, userContext: string): Promise<Script> {
  return postJson("/script", { ingest, user_context: userContext }, ScriptSchema);
}

export function lockScript(script: Script, ingest: IngestResult): Promise<LockedScript> {
  return postJson("/script/lock", { script, ingest }, LockedScriptSchema);
}

export function narrateScript(scriptId: string): Promise<NarrationResult> {
  return postJson("/narrate", { script_id: scriptId }, NarrationResultSchema);
}

export function triggerRender(scriptId: string): Promise<RenderStatus> {
  return postJson("/render", { script_id: scriptId }, RenderStatusSchema);
}

export function getRenderStatus(scriptId: string): Promise<RenderStatus> {
  return getJson(`/render/${scriptId}/status`, RenderStatusSchema);
}

export function getRecordingUploadUrl(
  scriptId: string,
  sceneId: string,
  contentType: string,
): Promise<RecordingUploadUrlResponse> {
  return postJson(
    "/recording/upload-url",
    { script_id: scriptId, scene_id: sceneId, content_type: contentType },
    RecordingUploadUrlResponseSchema,
  );
}

// Direct-to-S3 upload via presigned URL — never routes the recorded bytes
// through our own API (a multi-minute scene recording could easily exceed
// Lambda/API Gateway payload limits).
export async function uploadRecording(uploadUrl: string, blob: Blob): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": blob.type },
    body: blob,
  });
  if (!res.ok) {
    throw new Error(`Recording upload failed (${res.status})`);
  }
}

export function startTranscription(scriptId: string, sceneId: string): Promise<TranscribeStatus> {
  return postJson("/transcribe", { script_id: scriptId, scene_id: sceneId }, TranscribeStatusSchema);
}

export function getTranscriptionStatus(scriptId: string, sceneId: string): Promise<TranscribeStatus> {
  return getJson(`/transcribe/${scriptId}/${sceneId}/status`, TranscribeStatusSchema);
}

// Computes real-recording checkpoints from every scene's completed
// transcript and persists them — this is what flips the render step from
// the Polly fallback over to the real recorded voice/face (CLAUDE.md #1).
// Fails with a clear error if any scene isn't transcribed yet.
export function syncRecordings(scriptId: string): Promise<SyncResult> {
  return postJson("/sync", { script_id: scriptId }, SyncResultSchema);
}

export function listProjects(): Promise<ProjectList> {
  return getJson("/projects", ProjectListSchema);
}

// Everything needed to reopen a project: the locked script + ingest, which
// scenes already have recordings, whether it's synced, and render status.
export function getProject(scriptId: string): Promise<ProjectDetail> {
  return getJson(`/projects/${scriptId}`, ProjectDetailSchema);
}
