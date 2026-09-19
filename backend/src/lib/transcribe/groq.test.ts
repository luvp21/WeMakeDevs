import { test } from "node:test";
import assert from "node:assert/strict";
import type { TranscriptWord } from "@vaani/shared";
import { pickTranscript, scriptCoverage } from "./groq.js";

const heard = (text: string): TranscriptWord[] =>
  text.split(" ").map((t, i) => ({ text: t, start_ms: i * 300, end_ms: i * 300 + 250 }));

const SCRIPT = "Chaliye iska execution flow samjhte hain input chahe array ho ya async stream";

// Both are real Whisper outputs for real audio.
const HALLUCINATED = heard("Let's see how to execute this.");
const TRANSLATED = heard("Let's understand its execution flow. Whether the input is array or async stream");
const FAITHFUL = heard("chalie isakaa execution flow samjhte hain input chahe array ho ya async stream");

test("a fluent English translation of Hindi speech scores as a bad match", () => {
  assert.ok(scriptCoverage(SCRIPT, TRANSLATED) < 0.5);
  assert.ok(scriptCoverage(SCRIPT, HALLUCINATED) < 0.5);
});

test("a faithful transliterated transcript scores as a good match", () => {
  assert.ok(scriptCoverage(SCRIPT, FAITHFUL) >= 0.8);
});

test("skips hallucinated and translated attempts and takes the faithful one", () => {
  assert.equal(pickTranscript([HALLUCINATED, TRANSLATED, FAITHFUL], SCRIPT), FAITHFUL);
});

test("when every attempt is bad, returns the best-matching one rather than nothing", () => {
  assert.equal(pickTranscript([HALLUCINATED, TRANSLATED], SCRIPT), TRANSLATED);
});
