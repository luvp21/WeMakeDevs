import Groq, { toFile } from "groq-sdk";
import { transcribeOutputKey, type TranscribeStatus, type TranscriptWord } from "@vaani/shared";
import { getBuffer, putJson, getJson } from "../s3.js";

function client(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY env var is not set");
  return new Groq({ apiKey });
}

// Groq's response type only declares `text` — the actual verbose_json body
// (confirmed against a live call, not assumed) also carries `words` when
// timestamp_granularities includes "word".
interface GroqWord {
  word: string;
  start: number;
  end: number;
}
interface GroqVerboseTranscription {
  text: string;
  words?: GroqWord[];
}

interface StoredResult {
  status: "completed";
  words: TranscriptWord[];
}

// Whisper (via Groq) is the primary STT path, not AWS Transcribe — real
// human-speech testing (see PROGRESS.md, Sunday) proved Transcribe's
// per-segment language ID mangles consecutive English CS/programming
// loanwords ("async function") into unrelated Devanagari words, and neither
// transliteration, looser matching, nor a custom vocabulary fixed it.
// Whisper handles code-switching token-by-token instead of classifying a
// whole utterance into one language, which is the actual mechanism behind
// AWS's failure here. No `language` param is set on purpose: forcing "hi"
// would risk reproducing the same per-segment bias AWS's LanguageIdSettings
// had. Groq's API is a single synchronous call (no job polling like AWS),
// so this writes the completed result straight to the same S3 key
// AWS Transcribe would have used — getTranscriptionStatus() below just
// reads whatever is there, so the frontend's poll loop needs no changes.
export async function startTranscription(scriptId: string, sceneId: string, recordingKey: string): Promise<void> {
  const audio = await getBuffer(recordingKey);
  const file = await toFile(audio, "recording.webm");
  const response = (await client().audio.transcriptions.create({
    model: "whisper-large-v3",
    file,
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
    temperature: 0,
  })) as unknown as GroqVerboseTranscription;

  const words: TranscriptWord[] = (response.words ?? []).map((w) => ({
    text: w.word,
    start_ms: Math.round(w.start * 1000),
    end_ms: Math.round(w.end * 1000),
  }));

  const result: StoredResult = { status: "completed", words };
  await putJson(transcribeOutputKey(scriptId, sceneId), result);
}

export async function getTranscriptionStatus(scriptId: string, sceneId: string): Promise<TranscribeStatus> {
  try {
    const stored = await getJson<StoredResult>(transcribeOutputKey(scriptId, sceneId));
    return { script_id: scriptId, scene_id: sceneId, status: "completed", words: stored.words };
  } catch {
    // Nothing written yet. startTranscription() above blocks on the whole
    // Groq call before returning, so in practice this only shows on a poll
    // that races the very first request — not a real "in progress" job.
    return { script_id: scriptId, scene_id: sceneId, status: "in_progress" };
  }
}
