import path from "node:path";
import { recordingKey, type LockedScript, type SceneCheckpoints } from "@vaani/shared";
import { downloadToFile } from "./s3.js";
import { demoFrameHtml } from "@vaani/shared";
import { beatVisualHtml, chromeFor } from "./visuals.js";
import { getMediaDurationMs } from "./ffmpeg.js";
import { assembleScene, frameCounts, renderBeatClip, renderFootageClip } from "./beatClip.js";

// Minimum on-screen hold per beat, inspired by /brag's pacing rule ("~0.8s
// for labels holding long enough to absorb") — a real checkpoint gap this
// small only happens when the sync algorithm's stall-skip fires close
// together, and a visual flashing for a handful of frames reads as a glitch,
// not a deliberate cut. This is a floor, not a target: real gaps are
// normally much longer, and `-shortest` (assembleScene) still caps the scene
// to the real recording's audio, so inflating one beat can only ever eat
// into later beats' slack, never desync from the real voice track.
//
// Deliberately NOT /brag's fuller word-count rule (~0.3s per word, min 1.2s
// for full sentences): /brag controls its own timing freely, but this
// video must stay locked to a real human's speech, and 0.3s/word (~3.3
// words/sec) would bind on ordinary fast speakers, inflating a beat and
// pushing every later beat visibly out of sync with the real audio. Only
// genuinely pathological gaps (< 0.8s, almost certainly a sync stall, not
// real speech pacing) should be overridden here.
const MIN_BEAT_HOLD_SECONDS = 0.8;

// Real-recording render path (CLAUDE.md #1's primary path, not the Polly
// fallback): visuals cut in full-screen at each beat's real sync checkpoint,
// with the scene's actual recorded audio (the presenter's real voice)
// playing throughout — see docs/ARCHITECTURE.md's "cut/overlay visuals at
// the checkpoint timestamps." Picture-in-picture / face-visible-alongside-
// visual treatment is explicitly cosmetic per docs/FEATURES.md and not done
// here; this is the must-have baseline. Each beat is an animated clip
// (beatClip.ts) so a cut lands as an entrance, not a hard jump.
export async function renderSceneFromRecording(
  locked: LockedScript,
  sceneCheckpoints: SceneCheckpoints,
  sceneId: string,
  workDir: string,
): Promise<string> {
  const scenes = locked.script.scenes;
  const sceneIndex = scenes.findIndex((s) => s.id === sceneId);
  const scene = scenes[sceneIndex];
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

  const durations = scene.beats.map((_, i) => {
    // The first beat owns everything before the first spoken word (the
    // silence between pressing record and speaking). Measuring it from its own
    // checkpoint instead drops that lead-in from the video, and since the
    // audio keeps it, every later cut would land early by exactly that long.
    const startMs = i === 0 ? 0 : checkpoints[i].timestamp_ms;
    const endMs = i + 1 < checkpoints.length ? checkpoints[i + 1].timestamp_ms : recordingDurationMs;
    return Math.max(MIN_BEAT_HOLD_SECONDS, Math.max(0, endMs - startMs) / 1000);
  });
  const frames = frameCounts(durations);

  // Start time of each beat within the recording, for cutting demo footage.
  const startsSeconds: number[] = [];
  durations.reduce((elapsed, d) => {
    startsSeconds.push(elapsed);
    return elapsed + d;
  }, 0);

  const clipPaths: string[] = [];
  for (let i = 0; i < scene.beats.length; i++) {
    const beat = scene.beats[i];
    const chrome = chromeFor(scenes, sceneIndex, i);
    if (beat.visual_spec.visual_type === "ui_demo") {
      // The presenter showed the product during this beat: use that footage.
      clipPaths.push(
        await renderFootageClip({
          frameHtml: demoFrameHtml(beat.visual_spec.note || "Live demo", chrome),
          recordingPath,
          startSeconds: startsSeconds[i],
          frames: frames[i],
          workDir,
          id: beat.id,
        }),
      );
      continue;
    }
    const html = await beatVisualHtml(beat, locked.ingest, chrome);
    clipPaths.push(await renderBeatClip({ html, frames: frames[i], workDir, id: beat.id }));
  }

  const sceneVideoPath = path.join(workDir, `${sceneId}.mp4`);
  await assembleScene({ clipPaths, audioPath: recordingPath, outPath: sceneVideoPath, workDir, sceneId });
  return sceneVideoPath;
}
