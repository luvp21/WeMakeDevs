import { test } from "node:test";
import assert from "node:assert/strict";
import type { Scene, TranscriptWord } from "@vaani/shared";
import { syncScene } from "./index.js";
import { transliterateTranscript } from "./transliterate.js";

// Real Whisper large-v3 output from a full end-to-end run through the actual
// UI (Chromium fake mic playing Amazon Polly speech of the script), with
// language forced to "en" and the scene script passed as Whisper's prompt.
// Before those two settings the same audio came back with English terms in
// Devanagari ("फंक्शन") and two of three checkpoints landed 1-5s late. Polly
// gives ground truth: the speech began at 1.5s and beats start 3408ms and
// 7656ms into it, so the expected checkpoints are about 1500, 4908, 9156.
const TRANSCRIPT: TranscriptWord[] = [
  { text: "Aaj", start_ms: 1520, end_ms: 1820 },
  { text: "hum", start_ms: 1820, end_ms: 1980 },
  { text: "dekhenge", start_ms: 1980, end_ms: 2540 },
  { text: "ki", start_ms: 2540, end_ms: 2700 },
  { text: "ms", start_ms: 2700, end_ms: 3160 },
  { text: "package", start_ms: 3160, end_ms: 3540 },
  { text: "kaise", start_ms: 3540, end_ms: 3860 },
  { text: "kaam", start_ms: 3860, end_ms: 4160 },
  { text: "karta", start_ms: 4160, end_ms: 4480 },
  { text: "hai.", start_ms: 4480, end_ms: 4980 },
  { text: "Iska", start_ms: 4980, end_ms: 5260 },
  { text: "main", start_ms: 5260, end_ms: 5520 },
  { text: "function", start_ms: 5520, end_ms: 5980 },
  { text: "ek", start_ms: 5980, end_ms: 6240 },
  { text: "string", start_ms: 6240, end_ms: 6520 },
  { text: "leta", start_ms: 6520, end_ms: 6940 },
  { text: "hai,", start_ms: 6940, end_ms: 7280 },
  { text: "aur", start_ms: 7280, end_ms: 7360 },
  { text: "milliseconds", start_ms: 7360, end_ms: 7820 },
  { text: "return", start_ms: 7820, end_ms: 8300 },
  { text: "karta", start_ms: 8300, end_ms: 8700 },
  { text: "hai.", start_ms: 8700, end_ms: 9220 },
  { text: "Agar", start_ms: 9220, end_ms: 9440 },
  { text: "number", start_ms: 9440, end_ms: 9780 },
  { text: "pass", start_ms: 9780, end_ms: 10140 },
  { text: "karo,", start_ms: 10140, end_ms: 10640 },
  { text: "toh", start_ms: 10640, end_ms: 10800 },
  { text: "ye", start_ms: 10800, end_ms: 10880 },
  { text: "ek", start_ms: 10880, end_ms: 11160 },
  { text: "readable", start_ms: 11160, end_ms: 11560 },
  { text: "string", start_ms: 11560, end_ms: 11900 },
  { text: "bana", start_ms: 11900, end_ms: 12160 },
  { text: "deta", start_ms: 12160, end_ms: 12560 },
  { text: "hai.", start_ms: 12560, end_ms: 12720 }

];

test("real Whisper output (Latin Hinglish, script as prompt): every checkpoint lands within 150ms of truth", () => {
  const beat = (id: string, text: string) => ({
    id,
    text,
    visual_type: "slide" as const,
    visual_spec: { visual_type: "slide" as const, html: "" },
  });
  const scene: Scene = {
    id: "scene-1",
    title: "e2e",
    beats: [
      beat("beat-1", "Aaj hum dekhenge ki ms package kaise kaam karta hai."),
      beat("beat-2", "Iska main function ek string leta hai, aur milliseconds return karta hai."),
      beat("beat-3", "Agar number pass karo, toh ye ek readable string bana deta hai."),
    ],
  };

  const checkpoints = syncScene(scene, transliterateTranscript(TRANSCRIPT));
  const at = (id: string) => checkpoints.find((c) => c.beat_id === id)!.timestamp_ms;

  assert.ok(Math.abs(at("beat-1") - 1500) < 150, `beat-1 at ${at("beat-1")}`);
  assert.ok(Math.abs(at("beat-2") - 4908) < 150, `beat-2 at ${at("beat-2")}`);
  assert.ok(Math.abs(at("beat-3") - 9156) < 150, `beat-3 at ${at("beat-3")}`);
});
