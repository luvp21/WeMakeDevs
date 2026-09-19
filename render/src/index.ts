import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  lockedScriptKey,
  narrationResultKey,
  sceneAudioKey,
  syncResultKey,
  renderStatusKey,
  renderVideoKey,
  type LockedScript,
  type NarrationResult,
  type RenderStatus,
  type SyncResult,
} from "@vaani/shared";
import { getJson, putJson, downloadToFile, putFile } from "./s3.js";
import { beatVisualHtml } from "./visuals.js";
import { screenshotHtml, closeBrowser } from "./screenshot.js";
import { runFfmpeg, OUTPUT_FPS } from "./ffmpeg.js";
import { renderSceneFromRecording } from "./realRender.js";

async function setStatus(scriptId: string, status: RenderStatus["status"], error?: string): Promise<void> {
  const body: RenderStatus = { script_id: scriptId, status, error, updated_at: new Date().toISOString() };
  await putJson(renderStatusKey(scriptId), body);
}

// FFmpeg's concat demuxer needs the last entry's duration line omitted (a
// well-known quirk — the final image's stated duration is otherwise
// ignored), so the last file is repeated once more without one.
function buildImageConcatList(entries: { file: string; durationSeconds: number }[]): string {
  const lines: string[] = [];
  for (const entry of entries) {
    lines.push(`file '${entry.file}'`);
    lines.push(`duration ${entry.durationSeconds.toFixed(3)}`);
  }
  const last = entries[entries.length - 1];
  if (last) lines.push(`file '${last.file}'`);
  return lines.join("\n");
}

// AI-narrated fallback path (Polly) — see docs/ARCHITECTURE.md. Kept as-is;
// renderSceneFromRecording() in realRender.ts is the real-recording
// equivalent, tried first (see main()).
async function renderSceneFromNarration(
  locked: LockedScript,
  narration: NarrationResult,
  sceneId: string,
  workDir: string,
): Promise<string> {
  const scene = locked.script.scenes.find((s) => s.id === sceneId);
  const sceneNarration = narration.scenes.find((s) => s.scene_id === sceneId);
  if (!scene || !sceneNarration) throw new Error(`Scene ${sceneId} missing from script or narration`);

  const audioPath = path.join(workDir, `${sceneId}.mp3`);
  await downloadToFile(sceneAudioKey(locked.script_id, sceneId), audioPath);

  const imageEntries: { file: string; durationSeconds: number }[] = [];
  for (const beat of scene.beats) {
    const beatNarration = sceneNarration.beats.find((b) => b.beat_id === beat.id);
    if (!beatNarration) throw new Error(`Beat ${beat.id} missing from narration`);

    const html = await beatVisualHtml(beat, locked.ingest);
    const imagePath = path.join(workDir, `${beat.id}.png`);
    await screenshotHtml(html, imagePath);
    imageEntries.push({ file: `${beat.id}.png`, durationSeconds: beatNarration.duration_ms / 1000 });
  }

  const listPath = path.join(workDir, `${sceneId}-images.txt`);
  await writeFile(listPath, buildImageConcatList(imageEntries));

  const sceneVideoPath = path.join(workDir, `${sceneId}.mp4`);
  await runFfmpeg([
    "-f", "concat",
    "-safe", "0",
    "-i", listPath,
    "-i", audioPath,
    "-r", String(OUTPUT_FPS),
    "-vsync", "cfr",
    "-pix_fmt", "yuv420p",
    "-c:v", "libx264",
    "-c:a", "aac",
    "-shortest",
    sceneVideoPath,
  ]);

  return sceneVideoPath;
}

// Real-recording path is primary (CLAUDE.md #1); Polly is the fallback
// "if the human-recording pipeline breaks." A completed SyncResult in S3
// (written by backend's POST /sync once every scene is recorded +
// transcribed — see backend/src/lib/sync/computeSync.ts) is the signal that
// real recordings exist and are ready; its absence means fall back to
// narration, exactly the way it worked before this path existed.
async function tryGetSyncResult(scriptId: string): Promise<SyncResult | null> {
  try {
    return await getJson<SyncResult>(syncResultKey(scriptId));
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const scriptId = process.env.SCRIPT_ID;
  if (!scriptId) throw new Error("SCRIPT_ID env var is not set");

  await setStatus(scriptId, "running");

  const locked = await getJson<LockedScript>(lockedScriptKey(scriptId));
  const sync = await tryGetSyncResult(scriptId);

  const workDir = await mkdtemp(path.join(tmpdir(), "vaani-render-"));

  const sceneVideoPaths: string[] = [];
  if (sync) {
    for (const scene of locked.script.scenes) {
      const sceneCheckpoints = sync.scenes.find((s) => s.scene_id === scene.id);
      if (!sceneCheckpoints) throw new Error(`Scene ${scene.id} missing from sync result`);
      const sceneVideoPath = await renderSceneFromRecording(locked, sceneCheckpoints, scene.id, workDir);
      sceneVideoPaths.push(sceneVideoPath);
    }
  } else {
    const narration = await getJson<NarrationResult>(narrationResultKey(scriptId));
    for (const scene of locked.script.scenes) {
      const sceneVideoPath = await renderSceneFromNarration(locked, narration, scene.id, workDir);
      sceneVideoPaths.push(sceneVideoPath);
    }
  }

  const scenesListPath = path.join(workDir, "scenes.txt");
  await writeFile(scenesListPath, sceneVideoPaths.map((p) => `file '${p}'`).join("\n"));

  const finalVideoPath = path.join(workDir, "final.mp4");
  await runFfmpeg(["-f", "concat", "-safe", "0", "-i", scenesListPath, "-c", "copy", finalVideoPath]);

  await putFile(renderVideoKey(scriptId), finalVideoPath, "video/mp4");
  await setStatus(scriptId, "done");
}

main()
  .catch(async (err: unknown) => {
    const scriptId = process.env.SCRIPT_ID;
    const message = err instanceof Error ? err.message : String(err);
    console.error("Render failed:", message);
    if (scriptId) await setStatus(scriptId, "error", message);
    process.exitCode = 1;
  })
  .finally(() => closeBrowser());
