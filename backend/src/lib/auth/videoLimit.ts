import { hasLimits, MAX_VIDEO_MINUTES, WORDS_PER_MINUTE, countWords, formatDuration, wordBudget, LockScriptRequestSchema, ScriptGenRequestSchema, narrationResultKey, syncResultKey, type AuthRole, type NarrationResult, type SyncResult } from "@vaani/shared";
import { getJson } from "../s3.js";
import { HttpError } from "./http.js";
import type { Auth, Check } from "./access.js";

// Every account except the judge makes one video of at most 3 minutes. The
// limit is enforced here, on the server, at the three points where length is set:
// drafting (target length, pasted script), locking (the script after edits) and
// rendering (how long the recording really runs). Slack is allowed because 135
// words a minute is an average, not a rule, and people pause and speed up.
const SCRIPT_SLACK = 1.1;
const RECORDING_SLACK = 1.25;

const limited = (role: AuthRole) => hasLimits(role);

export const maxScriptWords = (): number => Math.round(wordBudget(MAX_VIDEO_MINUTES) * SCRIPT_SLACK);
export const maxRecordingMs = (): number => Math.round(MAX_VIDEO_MINUTES * 60_000 * RECORDING_SLACK);

const wordsToTime = (words: number) => formatDuration((words / WORDS_PER_MINUTE) * 60);

// The target length to draft: what was asked for, but never over the limit.
export function limitedMinutes(role: AuthRole, requested: number | undefined, formatDefault: number): number | undefined {
  if (!limited(role)) return requested;
  return Math.min(requested ?? formatDefault, MAX_VIDEO_MINUTES);
}

// A script the person pasted in must fit before anything is generated from it.
export const checkOwnScript: Check = async (auth, { body }) => {
  if (!limited(auth.role)) return;
  const parsed = ScriptGenRequestSchema.safeParse(body);
  const words = parsed.success && parsed.data.source_script ? countWords(parsed.data.source_script) : 0;
  if (words > maxScriptWords()) {
    throw new HttpError(400, `Your script is about ${wordsToTime(words)} when spoken. The limit is ${MAX_VIDEO_MINUTES} minutes, so please shorten it.`);
  }
};

// The script as locked, after any edits, must still fit.
export const checkLockedScript: Check = async (auth, { body }) => {
  if (!limited(auth.role)) return;
  const parsed = LockScriptRequestSchema.safeParse(body);
  if (!parsed.success) return; // the handler reports the malformed body
  const words = parsed.data.script.scenes.reduce((n, scene) => n + scene.beats.reduce((m, b) => m + countWords(b.text), 0), 0);
  if (words > maxScriptWords()) {
    throw new HttpError(400, `This script is about ${wordsToTime(words)} when spoken. The limit is ${MAX_VIDEO_MINUTES} minutes, so please shorten it before locking.`);
  }
};

// Total speech in the recordings (or in the AI narration, if that is the path used).
export function totalSpeechMs(sync: SyncResult | null, narration: NarrationResult | null): number | null {
  if (sync && sync.scenes.every((s) => typeof s.duration_ms === "number")) {
    return sync.scenes.reduce((n, s) => n + (s.duration_ms ?? 0), 0);
  }
  if (!sync && narration) return narration.scenes.reduce((n, s) => n + s.duration_ms, 0);
  return null;
}

// Before a render: the recorded speech must fit. If neither result is there yet the
// render itself fails with its usual message, so nothing is refused here.
export const checkRecordingLength: Check = async (auth, { scriptId }) => {
  if (!limited(auth.role) || !scriptId) return;
  const [sync, narration] = await Promise.all([
    getJson<SyncResult>(syncResultKey(scriptId)).catch(() => null),
    getJson<NarrationResult>(narrationResultKey(scriptId)).catch(() => null),
  ]);
  const total = totalSpeechMs(sync, narration);
  if (total !== null && total > maxRecordingMs()) {
    throw new HttpError(400, `Your recording runs about ${formatDuration(total / 1000)}. The limit is ${MAX_VIDEO_MINUTES} minutes, so please re-record with shorter scenes.`);
  }
};
export type { Auth };
