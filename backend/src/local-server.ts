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
  VIDEO_FORMATS,
  type RenderStatus,
} from "@vaani/shared";
import { ZodError } from "zod";
import { ingestRepo, IngestError } from "./lib/ingest.js";
import { generateScene, planScript, writePlannedScene } from "./lib/scriptGen.js";
import { lockScript, getLockedScript } from "./lib/lockScript.js";
import { narrateScript } from "./lib/narration/index.js";
import { triggerRenderTask } from "./lib/render/trigger.js";
import { getRenderStatus, setRenderStatus } from "./lib/render/status.js";
import { getRecordingUploadUrl } from "./lib/recording.js";
import { markTranscriptionStarted, startTranscription, getTranscriptionStatus } from "./lib/transcribe/index.js";
import { computeSync } from "./lib/sync/computeSync.js";
import { listProjects, getProject } from "./lib/projects.js";
import { guard, HttpError, type Auth, type Guard } from "./lib/auth/access.js";
import { checkLockedScript, checkOwnScript, checkRecordingLength, limitedMinutes } from "./lib/auth/videoLimit.js";
import { authConfig, google, judgeLink, login, me, refresh } from "./handlers/auth.js";
import { warmVerifier } from "./lib/auth/verify.js";

// Local dev server: same lib functions the Lambda handlers call, so behavior
// stays identical when this deploys behind API Gateway. Not used in prod.

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unexpected error";
}

// The same checks the Lambda routes get from secured(): signed in, project is
// theirs, quota available (and given back if the call then fails on our side).
function secure(rules: Guard): express.RequestHandler {
  return async (req, res, next) => {
    try {
      const checked = await guard(req.headers.authorization, rules, { body: req.body, path: req.params });
      res.locals.auth = checked.auth;
      res.on("finish", () => {
        if (res.statusCode >= 500) void checked.refundQuota();
      });
      next();
    } catch (err) {
      if (err instanceof HttpError) return void res.status(err.status).json({ error: err.message });
      res.status(500).json({ error: errorMessage(err) });
    }
  };
}

app.post("/api/auth/login", async (req, res) => {
  try {
    res.json(await login(req.body, req.ip));
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err instanceof ZodError) return res.status(400).json({ error: "Enter a username and password." });
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.post("/api/auth/judge-link", async (req, res) => {
  try {
    res.json(await judgeLink(req.body, req.ip));
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.post("/api/auth/google", async (req, res) => {
  try {
    res.json(await google(req.body, req.ip));
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err instanceof ZodError) return res.status(400).json({ error: "Google sign-in didn't complete. Please try again." });
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.get("/api/auth/config", (_req, res) => {
  res.json(authConfig());
});

app.post("/api/auth/refresh", async (req, res) => {
  try {
    res.json(await refresh(req.body));
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err instanceof ZodError) return res.status(400).json({ error: "Please sign in again." });
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.get("/api/auth/me", async (req, res) => {
  try {
    res.json(await me(req.headers.authorization));
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.post("/api/ingest", secure({ heavy: true }), async (req, res) => {
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

// Step 1 of the progress-friendly flow: the outline only.
app.post("/api/script/plan", secure({ quota: "drafts", heavy: true, check: checkOwnScript }), async (req, res) => {
  try {
    const parsed = ScriptGenRequestSchema.parse(req.body);
    const scenes = await planScript(parsed.ingest, parsed.user_context, parsed.format, {
      targetMinutes: limitedMinutes((res.locals.auth as Auth).role, parsed.target_minutes, VIDEO_FORMATS[parsed.format].defaultMinutes),
      sourceScript: parsed.source_script?.trim() || undefined,
    }, parsed.language);
    res.json({ scenes });
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: errorMessage(err) });
  }
});

// Step 2: write one scene of that outline.
app.post("/api/script/write-scene", secure({ heavy: true }), async (req, res) => {
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

app.post("/api/script/scene", secure({ heavy: true }), async (req, res) => {
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

app.post("/api/script/lock", secure({ quota: "locks", check: checkLockedScript }), async (req, res) => {
  try {
    const parsed = LockScriptRequestSchema.parse(req.body);
    const locked = await lockScript(parsed.script, parsed.ingest, (res.locals.auth as Auth).username, (res.locals.auth as Auth).name);
    res.json(locked);
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.post("/api/narrate", secure({ script: "body", heavy: true }), async (req, res) => {
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

app.post("/api/render", secure({ script: "body", quota: "renders", heavy: true, check: checkRecordingLength }), async (req, res) => {
  try {
    const parsed = RenderRequestSchema.parse(req.body);
    const status: RenderStatus = {
      script_id: parsed.script_id,
      status: "pending",
      updated_at: new Date().toISOString(),
    };
    await setRenderStatus(status);
    await triggerRenderTask(parsed.script_id, {
      owner: (res.locals.auth as Auth).username,
      role: (res.locals.auth as Auth).role,
    });
    res.json(status);
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.get("/api/render/:scriptId/status", secure({ script: "path" }), async (req, res) => {
  try {
    const status = await getRenderStatus(req.params.scriptId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.post("/api/recording/upload-url", secure({ script: "body" }), async (req, res) => {
  try {
    const parsed = RecordingUploadUrlRequestSchema.parse(req.body);
    const result = await getRecordingUploadUrl(parsed);
    res.json(result);
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.post("/api/transcribe", secure({ script: "body", heavy: true }), async (req, res) => {
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

app.get("/api/transcribe/:scriptId/:sceneId/status", secure({ script: "path" }), async (req, res) => {
  try {
    const status = await getTranscriptionStatus(req.params.scriptId, req.params.sceneId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.post("/api/sync", secure({ script: "body" }), async (req, res) => {
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

app.get("/api/projects", secure({}), async (_req, res) => {
  try {
    res.json({ projects: await listProjects(res.locals.auth as Auth) });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.get("/api/projects/:scriptId", secure({ script: "path" }), async (req, res) => {
  try {
    res.json(await getProject(req.params.scriptId));
  } catch (err) {
    const notFound = err instanceof Error && err.name === "NoSuchKey";
    res.status(notFound ? 404 : 500).json({ error: notFound ? "Project not found" : errorMessage(err) });
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  void warmVerifier();
  console.log(`backend dev server listening on http://localhost:${port}`);
});
