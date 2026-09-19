import path from "node:path";
import { writeFile } from "node:fs/promises";
import { recordingKey, type LockedScript, type SceneCheckpoints } from "@vaani/shared";
import { downloadToFile } from "./s3.js";
import { beatVisualHtml } from "./visuals.js";
import { screenshotHtml } from "./screenshot.js";
import { runFfmpeg, getMediaDurationMs, OUTPUT_FPS } from "./ffmpeg.js";

// Minimum on-screen hold per beat, inspired by /brag's pacing rule ("~0.8s
// for labels holding long enough to absorb") — a real checkpoint gap this
// small only happens when the sync algorithm's stall-skip fires close
// together, and a visual flashing for a handful of frames reads as a glitch,
// not a deliberate cut. This is a floor, not a target: real gaps are
// normally much longer, and `-shortest` below still caps the scene's total
// length to the real recording's audio, so inflating one beat can only ever
// eat into later beats' slack, never desync from the real voice track.
//
// Deliberately NOT /brag's fuller word-count rule (~0.3s per word, min 1.2s
// for full sentences): /brag controls its own timing freely, but this
// video must stay locked to a real human's speech, and 0.3s/word (~3.3
// words/sec) would bind on ordinary fast speakers, inflating a beat and
// pushing every later beat visibly out of sync with the real audio. Only
// genuinely pathological gaps (< 0.8s, almost certainly a sync stall, not
// real speech pacing) should be overridden here.
const MIN_BEAT_HOLD_SECONDS = 0.8;

// Same FFmpeg concat-demuxer quirk as the fallback path's buildImageConcatList
// (index.ts) — duplicated rather than shared because this version also
// applies the minimum-hold floor, which the fallback path's Polly-derived
// durations (see narration/index.ts) never need in practice.
function buildImageConcatList(entries: { file: string; durationSeconds: number }[]): string {
  const lines: string[] = [];
  for (const entry of entries) {
    const durationSeconds = Math.max(MIN_BEAT_HOLD_SECONDS, entry.durationSeconds);
    lines.push(`file '${entry.file}'`);
    lines.push(`duration ${durationSeconds.toFixed(3)}`);
  }
  const last = entries[entries.length - 1];
  if (last) lines.push(`file '${last.file}'`);
  return lines.join("\n");
}

// Real-recording render path (CLAUDE.md #1's primary path, not the Polly
// fallback): visuals cut in full-screen at each beat's real sync checkpoint,
// with the scene's actual recorded audio (the presenter's real voice)
// playing throughout — see docs/ARCHITECTURE.md's "cut/overlay visuals at
// the checkpoint timestamps." Picture-in-picture / face-visible-alongside-
// visual treatment is explicitly cosmetic per docs/FEATURES.md and not done
// here; this is the must-have baseline.
export async function renderSceneFromRecording(
  locked: LockedScript,
  sceneCheckpoints: SceneCheckpoints,
  sceneId: string,
  workDir: string,
): Promise<string> {
  const scene = locked.script.scenes.find((s) => s.id === sceneId);
  if (!scene) throw new Error(`Scene ${sceneId} missing from script`);

  const { checkpoints } = sceneCheckpoints;
  if (checkpoints.length !== scene.beats.length) {
    throw new Error(
      `Scene ${sceneId}: expected ${scene.beats.length} checkpoints (one per beat), got ${checkpoints.length}`,
    );
  }
  scene.beats.forEach((beat, index) => {
    if (checkpoints[index].beat_id !== beat.id) {
      throw new Error(`Scene ${sceneId}: checkpoint order doesn't match beat order at index ${index}`);
    }
  });

  const recordingPath = path.join(workDir, `${sceneId}-recording.webm`);
  await downloadToFile(recordingKey(locked.script_id, sceneId, "webm"), recordingPath);
  const recordingDurationMs = await getMediaDurationMs(recordingPath);

  const imageEntries: { file: string; durationSeconds: number }[] = [];
  for (let i = 0; i < scene.beats.length; i++) {
    const beat = scene.beats[i];
    const startMs = checkpoints[i].timestamp_ms;
    const endMs = i + 1 < checkpoints.length ? checkpoints[i + 1].timestamp_ms : recordingDurationMs;
    const durationSeconds = Math.max(0, endMs - startMs) / 1000;

    const html = await beatVisualHtml(beat, locked.ingest);
    const imagePath = path.join(workDir, `${beat.id}.png`);
    await screenshotHtml(html, imagePath);
    imageEntries.push({ file: `${beat.id}.png`, durationSeconds });
  }

  const listPath = path.join(workDir, `${sceneId}-images.txt`);
  await writeFile(listPath, buildImageConcatList(imageEntries));

  const sceneVideoPath = path.join(workDir, `${sceneId}.mp4`);
  await runFfmpeg([
    "-f", "concat",
    "-safe", "0",
    "-i", listPath,
    "-i", recordingPath,
    "-map", "0:v:0",
    "-map", "1:a:0",
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
