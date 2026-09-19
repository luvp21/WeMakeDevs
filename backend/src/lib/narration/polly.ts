import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";

const client = new PollyClient({});

// Locked per CLAUDE.md #5 — Kajal is the bilingual Hindi/Indian-English voice
// built to switch mid-sentence, not a config choice.
const VOICE_ID = "Kajal";

function engine(): "neural" | "generative" {
  return process.env.POLLY_ENGINE === "generative" ? "generative" : "neural";
}

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const res = await client.send(
    new SynthesizeSpeechCommand({
      Text: text,
      VoiceId: VOICE_ID,
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
