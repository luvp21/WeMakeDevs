import { test } from "node:test";
import assert from "node:assert/strict";
import type { Scene, TranscriptWord } from "@vaani/shared";
import { syncScene } from "./index.js";
import { transliterateTranscript } from "./transliterate.js";

// Real Whisper-large-v3 output (via Groq), captured this session, for real
// human speech (not Polly) saying something close to: "to yahan par dekho
// hum ek function banaya hai jo API se data fetch karta hai." Real
// timestamps preserved exactly as returned. Unlike AWS Transcribe (see
// real-data.test.ts), Whisper renders English loanwords as literal English
// ("function", "API", "data", "fetch"), not phonetically-respelled
// Devanagari — that's the whole reason this session switched STT providers.
const REAL_WHISPER_TRANSCRIPT: TranscriptWord[] = [
  { text: "तो", start_ms: 16160, end_ms: 17480 },
  { text: "यहां", start_ms: 17480, end_ms: 17860 },
  { text: "पर", start_ms: 17860, end_ms: 18000 },
  { text: "देखो", start_ms: 18000, end_ms: 18260 },
  { text: "हम", start_ms: 18260, end_ms: 18660 },
  { text: "एक", start_ms: 18660, end_ms: 18800 },
  { text: "function", start_ms: 18460, end_ms: 19820 },
  { text: "बनाया", start_ms: 19820, end_ms: 20440 },
  { text: "है", start_ms: 20440, end_ms: 20660 },
  { text: "जो", start_ms: 20660, end_ms: 21020 },
  { text: "API", start_ms: 21020, end_ms: 21600 },
  { text: "से", start_ms: 21600, end_ms: 21800 },
  { text: "data", start_ms: 21800, end_ms: 22080 },
  { text: "fetch", start_ms: 22080, end_ms: 22440 },
  { text: "करता", start_ms: 22440, end_ms: 22820 },
  { text: "है", start_ms: 22820, end_ms: 22960 },
];

test("real Whisper output: English loanwords stay literal, sync lands exactly on the real checkpoint", () => {
  const scene: Scene = {
    id: "scene-1",
    title: "whisper real speech test",
    beats: [
      {
        id: "beat-1",
        text: "to yahan par dekho hum ek function banaya hai",
        visual_type: "slide",
        visual_spec: { visual_type: "slide", html: "" },
      },
      {
        id: "beat-2",
        text: "jo API se data fetch karta hai",
        visual_type: "slide",
        visual_spec: { visual_type: "slide", html: "" },
      },
    ],
  };

  const transliterated = transliterateTranscript(REAL_WHISPER_TRANSCRIPT);

  // Regression guard for a real bug found alongside this: transliterating
  // an already-Latin loanword ("API") used to corrupt it (Sanscript's
  // ITRANS reading turned it into "aaPii") — transliterateTranscript()
  // must leave words with no Devanagari characters untouched.
  assert.equal(
    transliterated.find((w) => w.text === "API" || w.text === "aaPii")?.text,
    "API",
    "already-Latin loanwords must pass through transliteration unchanged",
  );

  const checkpoints = syncScene(scene, transliterated);

  assert.equal(checkpoints.find((c) => c.beat_id === "beat-1")?.timestamp_ms, 16160);
  // The real win: unlike the AWS/Polly case (real-data.test.ts), beat-2's
  // checkpoint lands exactly on "jo"'s real start time, not the end-of-scene
  // safety net — no cascade stall at all.
  assert.equal(checkpoints.find((c) => c.beat_id === "beat-2")?.timestamp_ms, 20660);
});
