import type { ScriptLanguage } from "@vaani/shared";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";

const client = new PollyClient({});

// Locked per CLAUDE.md #5 — Kajal is the bilingual Hindi/Indian-English voice
// built to switch mid-sentence, not a config choice.
const VOICE_ID = "Kajal";

function engine(): "neural" | "generative" {
  return process.env.POLLY_ENGINE === "generative" ? "generative" : "neural";
}

// Kajal reads both Hindi/English mixes and plain Indian English; for an English
// script the language code is pinned so she doesn't guess at Hindi.
export async function synthesizeSpeech(text: string, language: ScriptLanguage = "hinglish"): Promise<Buffer> {
  const res = await client.send(
    new SynthesizeSpeechCommand({
      Text: text,
      VoiceId: VOICE_ID,
      ...(language === "en" ? { LanguageCode: "en-IN" as const } : {}),
      Engine: engine(),
      OutputFormat: "mp3",
    }),
  );
  if (!res.AudioStream) {
    throw new Error("Polly response had no audio stream");
  }
  const bytes = await res.AudioStream.transformToByteArray();
  return Buffer.from(bytes);
}
