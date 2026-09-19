// Shared contract between Track A (script/visual/sync) and Track B (recording/render).
// See docs/ARCHITECTURE.md "Data contracts between stages" — change this file only
// after both tracks agree, per docs/TASK_SPLIT.md.
//
// Schemas are the source of truth; types are inferred from them so the same
// shape is used for both compile-time typing and runtime validation at
// system boundaries (API request bodies, Bedrock tool-use output).
import { z } from "zod";

export * from "./storageKeys.js";

export const VisualTypeSchema = z.enum(["code_highlight", "slide", "graph", "ui_demo"]);
export type VisualType = z.infer<typeof VisualTypeSchema>;

export const CodeHighlightSpecSchema = z.object({
  visual_type: z.literal("code_highlight"),
  file_path: z.string(),
  start_line: z.number().int().positive(),
  end_line: z.number().int().positive(),
  language: z.string().optional(),
});
export type CodeHighlightSpec = z.infer<typeof CodeHighlightSpecSchema>;

export const SlideSpecSchema = z.object({
  visual_type: z.literal("slide"),
  html: z.string(),
});
export type SlideSpec = z.infer<typeof SlideSpecSchema>;

export const GraphSpecSchema = z.object({
  visual_type: z.literal("graph"),
  html: z.string(),
  description: z.string(),
});
export type GraphSpec = z.infer<typeof GraphSpecSchema>;

export const UiDemoSpecSchema = z.object({
  visual_type: z.literal("ui_demo"),
  note: z.string(),
});
export type UiDemoSpec = z.infer<typeof UiDemoSpecSchema>;

export const VisualSpecSchema = z.discriminatedUnion("visual_type", [
  CodeHighlightSpecSchema,
  SlideSpecSchema,
  GraphSpecSchema,
  UiDemoSpecSchema,
]);
export type VisualSpec = z.infer<typeof VisualSpecSchema>;

export const BeatSchema = z.object({
  id: z.string(),
  text: z.string(),
  visual_type: VisualTypeSchema,
  visual_spec: VisualSpecSchema,
});
export type Beat = z.infer<typeof BeatSchema>;

export const SceneSchema = z.object({
  id: z.string(),
  title: z.string(),
  beats: z.array(BeatSchema),
});
export type Scene = z.infer<typeof SceneSchema>;

export const ScriptSchema = z.object({
  repo_url: z.string(),
  user_context: z.string(),
  scenes: z.array(SceneSchema),
});
export type Script = z.infer<typeof ScriptSchema>;

// Recording -> Transcription
export const TranscriptWordSchema = z.object({
  text: z.string(),
  start_ms: z.number(),
  end_ms: z.number(),
});
export type TranscriptWord = z.infer<typeof TranscriptWordSchema>;

// Sync -> Render
export const CheckpointSchema = z.object({
  beat_id: z.string(),
  timestamp_ms: z.number(),
});
export type Checkpoint = z.infer<typeof CheckpointSchema>;

export const SceneCheckpointsSchema = z.object({
  scene_id: z.string(),
  checkpoints: z.array(CheckpointSchema),
});
export type SceneCheckpoints = z.infer<typeof SceneCheckpointsSchema>;

// Persisted once every scene's real recording is transcribed and synced —
// render (Fargate) checks for this in S3 to decide real-recording path vs.
// Polly fallback (see CLAUDE.md #1: real voice/face is primary, Polly is
// the safety net).
export const SyncResultSchema = z.object({
  script_id: z.string(),
  scenes: z.array(SceneCheckpointsSchema),
});
export type SyncResult = z.infer<typeof SyncResultSchema>;

export const SyncRequestSchema = z.object({
  script_id: z.string(),
});
export type SyncRequest = z.infer<typeof SyncRequestSchema>;

// AI-narrated fallback path (Polly Kajal voice, see docs/ARCHITECTURE.md
// "Fallback path"). Since we generate the audio ourselves, each beat's exact
// duration is known directly from synthesis — no transcription or
// two-pointer sync needed for this path, unlike the real-recording path.
export const BeatNarrationSchema = z.object({
  beat_id: z.string(),
  offset_ms: z.number(), // start of this beat's audio within the scene's concatenated track
  duration_ms: z.number(),
});
export type BeatNarration = z.infer<typeof BeatNarrationSchema>;

export const SceneNarrationSchema = z.object({
  scene_id: z.string(),
  audio_url: z.string(), // presigned S3 URL to the scene's concatenated mp3
  duration_ms: z.number(),
  beats: z.array(BeatNarrationSchema),
});
export type SceneNarration = z.infer<typeof SceneNarrationSchema>;

export const NarrationResultSchema = z.object({
  script_id: z.string(),
  scenes: z.array(SceneNarrationSchema),
});
export type NarrationResult = z.infer<typeof NarrationResultSchema>;

export const NarrateRequestSchema = z.object({
  script_id: z.string(),
});
export type NarrateRequest = z.infer<typeof NarrateRequestSchema>;

// Repo ingest output (stage 1 -> stage 2 input)
export const IngestedFileSchema = z.object({
  path: z.string(),
  content: z.string(),
});
export type IngestedFile = z.infer<typeof IngestedFileSchema>;

export const IngestResultSchema = z.object({
  repo_url: z.string(),
  readme: z.string().nullable(),
  package_files: z.array(IngestedFileSchema),
  sample_files: z.array(IngestedFileSchema),
});
export type IngestResult = z.infer<typeof IngestResultSchema>;

// API request/response schemas (backend boundary validation)
export const IngestRequestSchema = z.object({
  repo_url: z.string().min(1),
});
export type IngestRequest = z.infer<typeof IngestRequestSchema>;

export const ScriptGenRequestSchema = z.object({
  ingest: IngestResultSchema,
  user_context: z.string().default(""),
});
export type ScriptGenRequest = z.infer<typeof ScriptGenRequestSchema>;

export const LockScriptRequestSchema = z.object({
  script: ScriptSchema,
  // Persisted alongside the script so later server-side stages (render) can
  // source real file content for code_highlight beats — without this it
  // only ever existed in the frontend's browser session.
  ingest: IngestResultSchema,
});
export type LockScriptRequest = z.infer<typeof LockScriptRequestSchema>;

export const LockedScriptSchema = z.object({
  script_id: z.string(),
  script: ScriptSchema,
  ingest: IngestResultSchema,
  locked_at: z.string(),
});
export type LockedScript = z.infer<typeof LockedScriptSchema>;

export const ApiErrorSchema = z.object({
  error: z.string(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// LLM tool-use output, before beat/scene ids are assigned by our code and
// before it's expanded into the real VisualSpec shape. Kept flat and under 8
// properties on purpose — Gemini's forced function-calling (mode: ANY)
// rejects any object schema with 8+ properties with a bare 400
// INVALID_ARGUMENT, confirmed empirically, independent of property names.
// language is inferred from file_path's extension instead of asked for;
// start_line/end_line are packed into one "line_range" string ("10-25").
export const RawBeatSchema = z.object({
  text: z.string(),
  visual_type: VisualTypeSchema,
  file_path: z.string().optional(),
  line_range: z.string().optional(),
  content: z.string().optional(),
});
export type RawBeat = z.infer<typeof RawBeatSchema>;

export const RawSceneSchema = z.object({
  title: z.string(),
  beats: z.array(RawBeatSchema),
});
export type RawScene = z.infer<typeof RawSceneSchema>;

export const RawScriptOutputSchema = z.object({
  scenes: z.array(RawSceneSchema),
});
export type RawScriptOutput = z.infer<typeof RawScriptOutputSchema>;

// Render stage (stage 8, Fargate — never Lambda, see CLAUDE.md #6). Rendering
// takes real time (screenshotting every beat + ffmpeg encoding), so this is
// async: POST /render kicks off a Fargate task and returns immediately, the
// task writes its own progress here as it runs, and the frontend polls
// GET /render/:script_id/status.
export const RenderStatusValueSchema = z.enum(["pending", "running", "done", "error"]);
export type RenderStatusValue = z.infer<typeof RenderStatusValueSchema>;

export const RenderStatusSchema = z.object({
  script_id: z.string(),
  status: RenderStatusValueSchema,
  video_url: z.string().optional(),
  error: z.string().optional(),
  updated_at: z.string(),
});
export type RenderStatus = z.infer<typeof RenderStatusSchema>;

export const RenderRequestSchema = z.object({
  script_id: z.string(),
});
export type RenderRequest = z.infer<typeof RenderRequestSchema>;

// Recording (stage 5) — scene-by-scene teleprompter capture, see CLAUDE.md
// #2. A recorded scene can easily exceed Lambda/API Gateway payload limits,
// so the browser uploads the video directly to S3 via a presigned PUT URL
// rather than routing the bytes through a Lambda.
export const RecordingUploadUrlRequestSchema = z.object({
  script_id: z.string(),
  scene_id: z.string(),
  content_type: z.string(),
});
export type RecordingUploadUrlRequest = z.infer<typeof RecordingUploadUrlRequestSchema>;

export const RecordingUploadUrlResponseSchema = z.object({
  upload_url: z.string(),
  key: z.string(),
});
export type RecordingUploadUrlResponse = z.infer<typeof RecordingUploadUrlResponseSchema>;

// Transcription (stage 6). Async like render/narration's status polling
// pattern — a real job takes real time. GET status re-queries the actual
// Transcribe job each time rather than us tracking our own status copy,
// since AWS already persists job state reliably.
export const TranscribeRequestSchema = z.object({
  script_id: z.string(),
  scene_id: z.string(),
});
export type TranscribeRequest = z.infer<typeof TranscribeRequestSchema>;

export const TranscribeStatusValueSchema = z.enum(["in_progress", "completed", "failed"]);
export type TranscribeStatusValue = z.infer<typeof TranscribeStatusValueSchema>;

export const TranscribeStatusSchema = z.object({
  script_id: z.string(),
  scene_id: z.string(),
  status: TranscribeStatusValueSchema,
  words: z.array(TranscriptWordSchema).optional(),
  error: z.string().optional(),
});
export type TranscribeStatus = z.infer<typeof TranscribeStatusSchema>;

// Dashboard (projects list + resume). A "project" is a locked script; its
// status is derived from which downstream artifacts exist in S3, so nothing
// extra has to be persisted or kept in sync by the pipeline stages.
export const ProjectStageSchema = z.enum(["scripted", "recording", "synced", "rendering", "done", "error"]);
export type ProjectStage = z.infer<typeof ProjectStageSchema>;

export const ProjectSummarySchema = z.object({
  script_id: z.string(),
  repo_url: z.string(),
  title: z.string(),
  scene_count: z.number(),
  beat_count: z.number(),
  recorded_scene_ids: z.array(z.string()),
  synced: z.boolean(),
  render_status: RenderStatusValueSchema.nullable(),
  stage: ProjectStageSchema,
  locked_at: z.string(),
});
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;

export const ProjectListSchema = z.object({ projects: z.array(ProjectSummarySchema) });
export type ProjectList = z.infer<typeof ProjectListSchema>;

export const ProjectDetailSchema = z.object({
  locked: LockedScriptSchema,
  summary: ProjectSummarySchema,
  render: RenderStatusSchema.nullable(),
});
export type ProjectDetail = z.infer<typeof ProjectDetailSchema>;
