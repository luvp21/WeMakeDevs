import { test } from "node:test";
import assert from "node:assert/strict";
import type { TranscriptWord } from "@vaani/shared";
import { attemptsFor, pickTranscript, scriptCoverage, statusFromStored } from "./groq.js";

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

test("an English script's first Whisper attempt is forced to English, without a duplicate retry", () => {
  const attempts = attemptsFor("en");
  assert.equal(attempts[0].language, "en");
  assert.equal(attempts[0].usePrompt, true);
  const keys = attempts.map((a) => `${a.language}/${a.usePrompt}`);
  assert.equal(new Set(keys).size, keys.length);
});

test("a Hinglish script's first Whisper attempt auto-detects the language", () => {
  const attempts = attemptsFor("hinglish");
  assert.equal(attempts[0].language, undefined);
  assert.equal(attempts[0].usePrompt, true);
});

test("with no script there is a single plain attempt", () => {
  assert.equal(attemptsFor(undefined).length, 1);
});

test("transcript status: nothing stored yet, or a fresh marker, is in progress", () => {
  const now = Date.parse("2026-09-20T10:00:00Z");
  assert.equal(statusFromStored("s", "scene-1", null, now).status, "in_progress");
  const fresh = { status: "in_progress" as const, started_at: "2026-09-20T09:58:00Z" };
  assert.equal(statusFromStored("s", "scene-1", fresh, now).status, "in_progress");
});

test("transcript status: a marker left behind by a dead worker turns into a failure", () => {
  const now = Date.parse("2026-09-20T10:00:00Z");
  const stale = { status: "in_progress" as const, started_at: "2026-09-20T09:50:00Z" };
  const status = statusFromStored("s", "scene-1", stale, now);
  assert.equal(status.status, "failed");
  assert.match(status.error ?? "", /timed out/);
});

test("transcript status: completed carries the words, failed carries the error", () => {
  const words = heard("hello there");
  assert.deepEqual(statusFromStored("s", "scene-1", { status: "completed", words }).words, words);
  const failed = statusFromStored("s", "scene-1", { status: "failed", error: "Groq said no" });
  assert.equal(failed.status, "failed");
  assert.equal(failed.error, "Groq said no");
});
