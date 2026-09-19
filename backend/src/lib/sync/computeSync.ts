import { syncResultKey, type LockedScript, type SceneCheckpoints, type SyncResult } from "@vaani/shared";
import { getTranscriptionStatus } from "../transcribe/index.js";
import { putJson } from "../s3.js";
import { transliterateTranscript } from "./transliterate.js";
import { syncScene } from "./index.js";

// Real-recording path's equivalent of narrateScript() in ../narration —
// turns each scene's completed transcript into checkpoints via the
// two-pointer algorithm, instead of deriving them deterministically from
// synthesized audio. Requires every scene's transcription to already be
// completed (the frontend fires recording+transcription per scene as each
// one is uploaded — see TeleprompterRecorder.tsx); a scene that isn't ready
// yet throws rather than silently persisting a partial/wrong result, since
// render (Fargate) treats "a SyncResult exists in S3" as its signal to use
// the real-recording path over the Polly fallback (see CLAUDE.md #1).
export async function computeSync(locked: LockedScript): Promise<SyncResult> {
  const scenes: SceneCheckpoints[] = [];

  for (const scene of locked.script.scenes) {
    const status = await getTranscriptionStatus(locked.script_id, scene.id);
    if (status.status !== "completed") {
      throw new Error(
        `Scene ${scene.id} isn't transcribed yet (status: ${status.status}) — record and upload every scene before syncing.`,
      );
    }
    const transliterated = transliterateTranscript(status.words ?? []);
    const checkpoints = syncScene(scene, transliterated);
    scenes.push({ scene_id: scene.id, checkpoints });
  }

  const result: SyncResult = { script_id: locked.script_id, scenes };
  await putJson(syncResultKey(locked.script_id), result);
  return result;
}
