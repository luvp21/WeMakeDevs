import "dotenv/config";
import express from "express";
import cors from "cors";
import {
  IngestRequestSchema,
  ScriptGenRequestSchema,
  LockScriptRequestSchema,
  NarrateRequestSchema,
  RenderRequestSchema,
  RecordingUploadUrlRequestSchema,
  TranscribeRequestSchema,
  SyncRequestSchema,
  SceneGenRequestSchema,
  WriteSceneRequestSchema,
  recordingKey,
  type RenderStatus,
} from "@vaani/shared";
import { ZodError } from "zod";
import { ingestRepo, IngestError } from "./lib/ingest.js";
import { generateScript, generateScene, planScript, writePlannedScene } from "./lib/scriptGen.js";
import { lockScript, getLockedScript } from "./lib/lockScript.js";
import { narrateScript } from "./lib/narration/index.js";
import { triggerRenderTask } from "./lib/render/trigger.js";
import { getRenderStatus, setRenderStatus } from "./lib/render/status.js";
import { getRecordingUploadUrl } from "./lib/recording.js";
import { markTranscriptionStarted, startTranscription, getTranscriptionStatus } from "./lib/transcribe/index.js";
import { computeSync } from "./lib/sync/computeSync.js";
import { listProjects, getProject } from "./lib/projects.js";

// Local dev server: same lib functions the Lambda handlers call, so behavior
// stays identical when this deploys behind API Gateway. Not used in prod.

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unexpected error";
}

app.post("/api/ingest", async (req, res) => {
  try {
    const parsed = IngestRequestSchema.parse(req.body);
    const result = await ingestRepo(parsed.repo_url);
    res.json(result);
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ error: err.message });
    const status = err instanceof IngestError ? 400 : 500;
    res.status(status).json({ error: errorMessage(err) });
  }
});

app.post("/api/script", async (req, res) => {
  try {
    const parsed = ScriptGenRequestSchema.parse(req.body);
    const script = await generateScript(parsed.ingest, parsed.user_context, parsed.format, {
      targetMinutes: parsed.target_minutes,
      sourceScript: parsed.source_script?.trim() || undefined,
    }, parsed.language);
    res.json(script);
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: errorMessage(err) });
  }
});

// Step 1 of the progress-friendly flow: the outline only.
app.post("/api/script/plan", async (req, res) => {
  try {
    const parsed = ScriptGenRequestSchema.parse(req.body);
    const scenes = await planScript(parsed.ingest, parsed.user_context, parsed.format, {
      targetMinutes: parsed.target_minutes,
      sourceScript: parsed.source_script?.trim() || undefined,
    }, parsed.language);
    res.json({ scenes });
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: errorMessage(err) });
  }
});

// Step 2: write one scene of that outline.
app.post("/api/script/write-scene", async (req, res) => {
  try {
    const parsed = WriteSceneRequestSchema.parse(req.body);
    res.json(
      await writePlannedScene({
        ingest: parsed.ingest,
        format: parsed.format,
        language: parsed.language,
        userContext: parsed.user_context,
        outline: parsed.outline,
        index: parsed.index,
      }),
    );
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.post("/api/script/scene", async (req, res) => {
  try {
    const parsed = SceneGenRequestSchema.parse(req.body);
    res.json(
      await generateScene({
        ingest: parsed.ingest,
        format: parsed.format,
        language: parsed.language,
        userContext: parsed.user_context,
        sceneTitle: parsed.scene_title,
        narration: parsed.narration,
        mode: parsed.mode,
      }),
    );
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.post("/api/script/lock", async (req, res) => {
  try {
    const parsed = LockScriptRequestSchema.parse(req.body);
    const locked = await lockScript(parsed.script, parsed.ingest);
    res.json(locked);
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.post("/api/narrate", async (req, res) => {
  try {
    const parsed = NarrateRequestSchema.parse(req.body);
    const locked = await getLockedScript(parsed.script_id);
    const result = await narrateScript(locked);
    res.json(result);
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.post("/api/render", async (req, res) => {
  try {
    const parsed = RenderRequestSchema.parse(req.body);
    const status: RenderStatus = {
      script_id: parsed.script_id,
      status: "pending",
      updated_at: new Date().toISOString(),
    };
    await setRenderStatus(status);
    await triggerRenderTask(parsed.script_id);
    res.json(status);
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.get("/api/render/:scriptId/status", async (req, res) => {
  try {
    const status = await getRenderStatus(req.params.scriptId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.post("/api/recording/upload-url", async (req, res) => {
  try {
    const parsed = RecordingUploadUrlRequestSchema.parse(req.body);
    const result = await getRecordingUploadUrl(parsed);
    res.json(result);
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.post("/api/transcribe", async (req, res) => {
  try {
    const parsed = TranscribeRequestSchema.parse(req.body);
    const key = recordingKey(parsed.script_id, parsed.scene_id, "webm");
    await markTranscriptionStarted(parsed.script_id, parsed.scene_id);
    await startTranscription(parsed.script_id, parsed.scene_id, key);
    res.json({ script_id: parsed.script_id, scene_id: parsed.scene_id, status: "in_progress" });
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.get("/api/transcribe/:scriptId/:sceneId/status", async (req, res) => {
  try {
    const status = await getTranscriptionStatus(req.params.scriptId, req.params.sceneId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.post("/api/sync", async (req, res) => {
  try {
    const parsed = SyncRequestSchema.parse(req.body);
    const locked = await getLockedScript(parsed.script_id);
    const result = await computeSync(locked);
    res.json(result);
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ error: err.message });
    res.status(409).json({ error: errorMessage(err) });
  }
});

app.get("/api/projects", async (_req, res) => {
  try {
    res.json({ projects: await listProjects() });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.get("/api/projects/:scriptId", async (req, res) => {
  try {
    res.json(await getProject(req.params.scriptId));
  } catch (err) {
    const notFound = err instanceof Error && err.name === "NoSuchKey";
    res.status(notFound ? 404 : 500).json({ error: notFound ? "Project not found" : errorMessage(err) });
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`backend dev server listening on http://localhost:${port}`);
});
