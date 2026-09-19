import { test } from "node:test";
import assert from "node:assert/strict";
import type { Scene, TranscriptWord } from "@vaani/shared";
import { syncScene } from "./index.js";
import { transliterateTranscript } from "./transliterate.js";

// Real AWS Transcribe output, captured this session, for known Polly-spoken
// input: "Toh yahan pe dekho, humne ek async function banaya hai jo API se
// data fetch karta hai." — Transcribe (hi-IN multi-language) returned this
// in Devanagari, not the script's Latin/romanized Hinglish. Real timestamps
// preserved exactly as returned.
const REAL_DEVANAGARI_TRANSCRIPT: TranscriptWord[] = [
  { text: "तो", start_ms: 29, end_ms: 319 },
  { text: "यहाँ", start_ms: 319, end_ms: 600 },
  { text: "पे", start_ms: 600, end_ms: 720 },
  { text: "देखो", start_ms: 720, end_ms: 1269 },
  { text: "हमने", start_ms: 1279, end_ms: 1600 },
  { text: "एक", start_ms: 1600, end_ms: 1759 },
  { text: "एसिंक", start_ms: 1759, end_ms: 2160 },
  { text: "फंक्शन", start_ms: 2160, end_ms: 2559 },
  { text: "बनाया", start_ms: 2559, end_ms: 2960 },
  { text: "है", start_ms: 2960, end_ms: 3160 },
  { text: "जो", start_ms: 3160, end_ms: 3359 },
  { text: "एपीआई", start_ms: 3359, end_ms: 3839 },
  { text: "से", start_ms: 3839, end_ms: 4000 },
  { text: "डाटा", start_ms: 4000, end_ms: 4320 },
  { text: "फेच", start_ms: 4320, end_ms: 4760 },
  { text: "करता", start_ms: 4760, end_ms: 4920 },
  { text: "है", start_ms: 4920, end_ms: 5039 },
];

test("real Transcribe output: transliteration recovers pure-Hindi words; consecutive English loanwords cascade-stall", () => {
  // Arrange — two beats, so we can see where sync actually breaks down
  const s: Scene = {
    id: "scene-1",
    title: "real data test",
    beats: [
      {
        id: "beat-1",
        text: "Toh yahan pe dekho humne ek async function banaya hai",
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

  const transliterated = transliterateTranscript(REAL_DEVANAGARI_TRANSCRIPT);

  // Act — default threshold (18) is larger than this scene's whole word
  // count (17), so once the script pointer sticks on "async" it can never
  // recover within this transcript at all.
  const withDefaultThreshold = syncScene(s, transliterated);

  // beat-1 still gets its checkpoint (first word "Toh" matches immediately).
  assert.equal(withDefaultThreshold.find((c) => c.beat_id === "beat-1")?.timestamp_ms, 29);
  // beat-2's real checkpoint ("jo" at 3160ms) is never reached — the script
  // pointer is still stuck on "async" when the transcript runs out, so
  // beat-2 falls to the end-of-scene safety net instead of its real timing.
  const beat2Default = withDefaultThreshold.find((c) => c.beat_id === "beat-2")?.timestamp_ms;
  assert.equal(beat2Default, 5039, "documents current behavior: safety-net timestamp, not the real 3160ms");

  // A lower, scene-length-aware threshold forces the "async"/"function"
  // stall to resolve sooner — but does NOT fully fix it, because by the
  // time the script pointer reaches "function", the transcript pointer has
  // already raced past "function"'s real transcript position while waiting
  // out "async". This is a structural property of the two-pointer design
  // (stalling on word N can consume word N+1's real match too), not
  // something a threshold value alone resolves.
  const withLowerThreshold = syncScene(s, transliterated, 4);
  const beat2Lower = withLowerThreshold.find((c) => c.beat_id === "beat-2")?.timestamp_ms;
  assert.notEqual(beat2Lower, 3160, "documents that lowering the threshold alone does not recover the real timestamp here");
});
