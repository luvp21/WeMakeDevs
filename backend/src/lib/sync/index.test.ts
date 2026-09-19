import { test } from "node:test";
import assert from "node:assert/strict";
import type { Scene, TranscriptWord } from "@vaani/shared";
import { syncScene } from "./index.js";

// Per docs/SYNC_ALGORITHM.md: "Write a standalone test with a fake
// transcript that includes: a deliberate stutter, a deliberate
// dropped/missed word, and at least one filler word... Confirm the
// checkpoints still land at the right script positions before this touches
// a real recording." Split into separate cases (rather than one combined
// transcript) so each concern's expected output is easy to hand-verify —
// a dropped word can cascade into skipping real matches for several
// following script words if it isn't isolated, which makes a single
// giant combined scenario hard to reason about correctly.

function scene(id: string, beats: { id: string; text: string }[]): Scene {
  return {
    id,
    title: "test scene",
    beats: beats.map((b) => ({
      id: b.id,
      text: b.text,
      visual_type: "slide",
      visual_spec: { visual_type: "slide", html: "" },
    })),
  };
}

function words(entries: [string, number, number][]): TranscriptWord[] {
  return entries.map(([text, start_ms, end_ms]) => ({ text, start_ms, end_ms }));
}

test("stutter: a word repeated several times doesn't shift later checkpoints", () => {
  // Arrange
  const s = scene("scene-1", [
    { id: "beat-1", text: "Toh yahan pe dekho" },
    { id: "beat-2", text: "Simple hai" },
  ]);
  const transcript = words([
    ["Toh", 0, 200],
    ["yahan", 200, 400],
    ["yahan", 400, 600], // stutter repeat
    ["yahan", 600, 800], // stutter repeat
    ["pe", 800, 1000],
    ["dekho", 1000, 1200],
    ["Simple", 1200, 1400],
    ["hai", 1400, 1600],
  ]);

  // Act
  const checkpoints = syncScene(s, transcript);

  // Assert
  assert.deepEqual(checkpoints, [
    { beat_id: "beat-1", timestamp_ms: 0 },
    { beat_id: "beat-2", timestamp_ms: 1200 },
  ]);
});

test("dropped word (not a beat boundary): stall skips it, later beats still sync", () => {
  // Arrange
  const s = scene("scene-1", [
    { id: "beat-1", text: "Ek do teen char" }, // "do" is never said
    { id: "beat-2", text: "Paanch chhah" },
  ]);
  const transcript = words([
    ["Ek", 0, 200],
    ["um", 200, 400], // filler, 3 non-matches trips the (test-only) low threshold
    ["matlab", 400, 600],
    ["arre", 600, 800],
    ["teen", 800, 1000],
    ["char", 1000, 1200],
    ["Paanch", 1200, 1400],
    ["chhah", 1400, 1600],
  ]);

  // Act — stallThreshold=3 so this stays compact instead of needing 18+
  // filler words; the mechanism being tested doesn't depend on the exact
  // threshold value, see docs/SYNC_ALGORITHM.md's "tune it" note.
  const checkpoints = syncScene(s, transcript, 3);

  // Assert
  assert.deepEqual(checkpoints, [
    { beat_id: "beat-1", timestamp_ms: 0 },
    { beat_id: "beat-2", timestamp_ms: 1200 },
  ]);
});

test("dropped word that IS a beat boundary: it still gets a best-effort checkpoint", () => {
  // Arrange
  const s = scene("scene-1", [
    { id: "beat-1", text: "Ek do" },
    { id: "beat-2", text: "Teen char" }, // "Teen" (the boundary word) is never said
    { id: "beat-3", text: "Paanch chhah" },
  ]);
  const transcript = words([
    ["Ek", 0, 200],
    ["do", 200, 400],
    ["um", 400, 600],
    ["matlab", 600, 800],
    ["arre", 800, 1000],
    ["char", 1000, 1200],
    ["Paanch", 1200, 1400],
    ["chhah", 1400, 1600],
  ]);

  // Act
  const checkpoints = syncScene(s, transcript, 3);

  // Assert — beat-2 still gets a checkpoint (approximated from the next
  // recognized word) rather than being silently missing.
  assert.deepEqual(checkpoints, [
    { beat_id: "beat-1", timestamp_ms: 0 },
    { beat_id: "beat-2", timestamp_ms: 1000 },
    { beat_id: "beat-3", timestamp_ms: 1200 },
  ]);
});

test("filler words scattered through the transcript don't break sync", () => {
  // Arrange
  const s = scene("scene-1", [{ id: "beat-1", text: "Simple si baat hai" }]);
  const transcript = words([
    ["um", 0, 200], // filler before the script even starts
    ["Simple", 200, 400],
    ["matlab", 400, 600], // filler
    ["si", 600, 800],
    ["baat", 800, 1000],
    ["toh", 1000, 1200], // filler
    ["hai", 1200, 1400],
  ]);

  // Act
  const checkpoints = syncScene(s, transcript);

  // Assert
  assert.deepEqual(checkpoints, [{ beat_id: "beat-1", timestamp_ms: 200 }]);
});

test("multiple trailing uncovered beats: safety net spreads them by word count instead of stacking on one timestamp", () => {
  // Arrange — beat-1 matches normally; beat-2 and beat-3 are never said at
  // all (transcript runs out while the script pointer is still stuck on
  // beat-2's first word) — the exact shape of the real cascade failure
  // found against live Transcribe/Whisper data (see real-data.test.ts /
  // whisper-real-data.test.ts), just with two uncovered beats instead of
  // one so the proportional spread is actually exercised.
  const s = scene("scene-1", [
    { id: "beat-1", text: "Ek do" },
    { id: "beat-2", text: "Teen char" }, // 2 words, never said
    { id: "beat-3", text: "Paanch chhah saat aath" }, // 4 words, never said
  ]);
  const transcript = words([
    ["Ek", 0, 200],
    ["do", 200, 400],
    ["um", 400, 1000], // filler, well under the default stall threshold
    ["matlab", 1000, 3000], // filler — transcript just runs out here
  ]);

  // Act
  const checkpoints = syncScene(s, transcript);

  // Assert — beat-2 (2 of the 6 uncovered words) lands a third of the way
  // from the last real checkpoint (0) to the transcript's end (3000);
  // beat-3 (the rest) lands at the transcript's end, same as the old
  // single-beat behavior would have given BOTH beats.
  assert.deepEqual(checkpoints, [
    { beat_id: "beat-1", timestamp_ms: 0 },
    { beat_id: "beat-2", timestamp_ms: 1000 },
    { beat_id: "beat-3", timestamp_ms: 3000 },
  ]);
});

test("loose matching: case and punctuation differences don't break a match", () => {
  // Arrange — Transcribe's raw output is typically lowercase with its own
  // punctuation choices, which will rarely match the script's casing
  // exactly (see docs/SYNC_ALGORITHM.md: "Don't require exact string
  // equality").
  const s = scene("scene-1", [{ id: "beat-1", text: "Toh yahan pe, dekho!" }]);
  const transcript = words([
    ["toh", 0, 200],
    ["yahan", 200, 400],
    ["pe", 400, 600],
    ["dekho", 600, 800],
  ]);

  // Act
  const checkpoints = syncScene(s, transcript);

  // Assert
  assert.deepEqual(checkpoints, [{ beat_id: "beat-1", timestamp_ms: 0 }]);
});
