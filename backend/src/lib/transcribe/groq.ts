import Groq, { toFile } from "groq-sdk";
import { transcribeOutputKey, type TranscribeStatus, type TranscriptWord } from "@vaani/shared";
import { getBuffer, putJson, getJson } from "../s3.js";
import { getLockedScript } from "../lockScript.js";
import { transliterateTranscript } from "../sync/transliterate.js";
import { wordsMatch } from "../sync/matches.js";

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

// Whisper's `prompt` biases both vocabulary and spelling toward what it's
// shown. Found by a real end-to-end test: on Polly-voiced Hinglish, Whisper
// wrote English terms in Devanagari ("फंक्शन"), and priming it with the scene's
// own script (same Latin Hinglish, same term spellings) fixed that. Capped:
// Whisper only uses the last ~224 tokens of a prompt anyway.
const MAX_PROMPT_CHARS = 800;

// Language handling, learned from real runs (see PROGRESS.md): forcing
// language "en" looked great on some scenes and failed badly on others — on the
// SAME audio it produced a hallucinated one-liner ("Let's see how to execute
// this."), a translation to English, or a truncated transcript. Letting Whisper
// auto-detect while priming it with the scene's own script was faithful every
// time, but writes Hindi words in Devanagari. So: auto-detect + prompt, then
// convert Devanagari to Latin here so everything stored is plain English
// letters, matching the script's Hinglish spelling. WHISPER_LANGUAGE can force
// a language for the first attempt.
const WHISPER_LANGUAGE = process.env.WHISPER_LANGUAGE || undefined;

// A transcript that matches under half of the script's words is wrong however
// long it is: Whisper invents stock phrases from unclear audio ("Let's see how
// to execute this.") and, in auto-detect mode, sometimes translates Hindi into
// English (a fluent, full-length transcript that matches nothing in the
// script). Both real. Below this share we retry with another setting.
const MIN_MATCH_COVERAGE = 0.5;

interface Attempt {
  label: string;
  language?: string;
  usePrompt: boolean;
}

interface SceneContext {
  prompt: string;
  scriptText: string;
}

async function sceneContext(scriptId: string, sceneId: string): Promise<SceneContext | undefined> {
  try {
    const locked = await getLockedScript(scriptId);
    const scene = locked.script.scenes.find((s) => s.id === sceneId);
    if (!scene) return undefined;
    const text = scene.beats.map((b) => b.text).join(" ");
    return {
      prompt: text.slice(-MAX_PROMPT_CHARS),
      scriptText: text,
    };
  } catch {
    // No script to prime with (e.g. transcribing a loose recording): plain
    // transcription still works, just without the vocabulary hint.
    return undefined;
  }
}

// Share of the script's words that the transcript reproduces, walking both in
// order (each script word must be found after the previous one).
export function scriptCoverage(scriptText: string, words: TranscriptWord[]): number {
  const script = scriptText.split(/\s+/).filter(Boolean);
  if (script.length === 0) return 1;
  let matched = 0;
  let j = 0;
  for (const scriptWord of script) {
    for (let k = j; k < words.length; k++) {
      if (wordsMatch(scriptWord, words[k].text)) {
        matched += 1;
        j = k + 1;
        break;
      }
    }
  }
  return matched / script.length;
}

// Picks the first transcript that matches enough of the script, else the best.
export function pickTranscript(candidates: TranscriptWord[][], scriptText: string): TranscriptWord[] {
  const scored = candidates.map((words) => ({ words, score: scriptCoverage(scriptText, words) }));
  const good = scored.find((c) => c.score >= MIN_MATCH_COVERAGE);
  if (good) return good.words;
  return scored.reduce((best, c) => (c.score > best.score ? c : best), scored[0]).words;
}

interface StoredResult {
  status: "completed";
  words: TranscriptWord[];
}

// Whisper (via Groq) is the primary STT path, not AWS Transcribe: Transcribe's
// per-segment language ID mangled consecutive English loanwords ("async
// function" heard as "tracing function") in a way transliteration, looser
// matching and a custom vocabulary couldn't fix. Groq's API is a single
// synchronous call (no job polling), so the completed result is written
// straight to the same S3 key AWS Transcribe would have used; the status
// endpoint just reads whatever is there.
async function transcribeOnce(audio: Buffer, params: { language?: string; prompt?: string }): Promise<TranscriptWord[]> {
  const file = await toFile(audio, "recording.webm");
  const response = (await client().audio.transcriptions.create({
    model: "whisper-large-v3",
    file,
    ...(params.language ? { language: params.language } : {}),
    ...(params.prompt ? { prompt: params.prompt } : {}),
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
    temperature: 0,
  })) as unknown as GroqVerboseTranscription;

  const words = (response.words ?? []).map((w) => ({
    text: w.word,
    start_ms: Math.round(w.start * 1000),
    end_ms: Math.round(w.end * 1000),
  }));
  // Devanagari to Latin here, so what is stored (and shown) is English letters.
  return transliterateTranscript(words);
}

export async function startTranscription(scriptId: string, sceneId: string, recordingKey: string): Promise<void> {
  const audio = await getBuffer(recordingKey);
  const context = await sceneContext(scriptId, sceneId);

  const attempts: Attempt[] = context
    ? [
        { label: "auto + script prompt", language: WHISPER_LANGUAGE, usePrompt: true },
        { label: "english + script prompt", language: "en", usePrompt: true },
        { label: "hindi + script prompt", language: "hi", usePrompt: true },
        { label: "english, no prompt", language: "en", usePrompt: false },
      ]
    : [{ label: "auto", language: WHISPER_LANGUAGE, usePrompt: false }];

  const candidates: TranscriptWord[][] = [];
  for (const attempt of attempts) {
    const words = await transcribeOnce(audio, {
      language: attempt.language,
      prompt: attempt.usePrompt ? context?.prompt : undefined,
    });
    candidates.push(words);
    if (!context) break;
    const coverage = scriptCoverage(context.scriptText, words);
    if (coverage >= MIN_MATCH_COVERAGE) break;
    console.warn(
      `transcribe: "${attempt.label}" only matched ${Math.round(coverage * 100)}% of the script (${sceneId}); trying another setting`,
    );
  }

  const words = context ? pickTranscript(candidates, context.scriptText) : candidates[0];
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
