import type { TranscribeStatus } from "@vaani/shared";
import * as aws from "./aws.js";
import * as groq from "./groq.js";

// Whisper via Groq is the primary STT provider (see groq.ts for why — real
// human-speech testing showed AWS Transcribe's per-segment language ID
// mangles code-switched loanwords in a way transliteration/matching/custom
// vocabulary couldn't fix). AWS Transcribe stays wired up as
// STT_PROVIDER=aws for comparison/fallback. In production this should move
// to a self-hosted Whisper on AWS rather than the Groq API — not done here,
// deadline tradeoff, same shape of decision as the Gemini LLM stopgap.
function getProvider(): "aws" | "groq" {
  const provider = process.env.STT_PROVIDER || "groq";
  if (provider !== "aws" && provider !== "groq") {
    throw new Error(`Unknown STT_PROVIDER: ${provider}`);
  }
  return provider;
}

// Writes the "in progress" marker, replacing any earlier take's transcript. Call
// this before handing the work to a background worker.
export async function markTranscriptionStarted(scriptId: string, sceneId: string): Promise<void> {
  if (getProvider() === "groq") await groq.markTranscriptionStarted(scriptId, sceneId);
}

export async function startTranscription(
  scriptId: string,
  sceneId: string,
  recordingKey: string,
  mediaFormat: "webm" | "mp4" | "mp3" = "webm",
): Promise<void> {
  const provider = getProvider();
  if (provider === "aws") {
    return aws.startTranscription(scriptId, sceneId, recordingKey, mediaFormat);
  }
  return groq.startTranscription(scriptId, sceneId, recordingKey);
}

export async function getTranscriptionStatus(scriptId: string, sceneId: string): Promise<TranscribeStatus> {
  return getProvider() === "aws"
    ? aws.getTranscriptionStatus(scriptId, sceneId)
    : groq.getTranscriptionStatus(scriptId, sceneId);
}
