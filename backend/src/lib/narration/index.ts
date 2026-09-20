import { parseBuffer } from "music-metadata";
import {
  narrationResultKey,
  sceneAudioKey,
  type BeatNarration,
  type LockedScript,
  type NarrationResult,
  type SceneNarration,
} from "@vaani/shared";
import { synthesizeSpeech } from "./polly.js";
import { putBinary, putJson, getPresignedUrl } from "../s3.js";

async function audioDurationMs(mp3: Buffer): Promise<number> {
  const metadata = await parseBuffer(mp3, "audio/mpeg");
  const seconds = metadata.format.duration;
  if (seconds === undefined) {
    throw new Error("Could not determine synthesized audio duration");
  }
  return Math.round(seconds * 1000);
}

// AI-narrated fallback path: we generate the audio ourselves via Polly, so
// each beat's exact duration is known directly from synthesis. Beats within
// a scene are concatenated into one track and offsets are the cumulative
// sum of prior durations — this is the fallback-path equivalent of the
// two-pointer sync algorithm's checkpoints, just deterministic instead of
// walked from a messy transcript (see docs/SYNC_ALGORITHM.md).
export async function narrateScript(locked: LockedScript): Promise<NarrationResult> {
  const scenes: SceneNarration[] = [];

  for (const scene of locked.script.scenes) {
    const beatAudio: { beat_id: string; audio: Buffer; duration_ms: number }[] = [];
    for (const beat of scene.beats) {
      const audio = await synthesizeSpeech(beat.text, locked.script.language);
      const duration_ms = await audioDurationMs(audio);
      beatAudio.push({ beat_id: beat.id, audio, duration_ms });
    }

    const sceneAudio = Buffer.concat(beatAudio.map((b) => b.audio));
    const key = sceneAudioKey(locked.script_id, scene.id);
    await putBinary(key, sceneAudio, "audio/mpeg");
    const audio_url = await getPresignedUrl(key);

    let offset = 0;
    const beats: BeatNarration[] = beatAudio.map((b) => {
      const entry: BeatNarration = { beat_id: b.beat_id, offset_ms: offset, duration_ms: b.duration_ms };
      offset += b.duration_ms;
      return entry;
    });

    scenes.push({ scene_id: scene.id, audio_url, duration_ms: offset, beats });
  }

  const result: NarrationResult = { script_id: locked.script_id, scenes };
  // The render worker (a separate Fargate task, not this Lambda/server) needs
  // this for beat timing — it re-derives audio S3 keys from the naming
  // convention rather than trusting audio_url, since that's a presigned URL
  // that may have expired by render time.
  await putJson(narrationResultKey(locked.script_id), result);
  return result;
}
