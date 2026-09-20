# Sync algorithm: matching real speech to the known script

## The core idea

We already know the exact script, word for word, before recording happens. So the problem isn't "understand what this person means" (fragile, needs an AI call, guesses at meaning), it's "find where in this specific recording these specific known words got spoken" (mechanical, plain code, no AI call needed).

**The script is authoritative. The transcript is allowed to be messy.**

If someone stumbles and says a word three times, the transcript will show it three times — the script's position pointer only ever advances once for that word. Repeats, filler words ("um," "matlab"), and restarts in the transcript should cost the *transcript* pointer steps, not the *script* pointer.

## Inputs

- `script_words[]` — the known script for this scene, tokenized into words, in order, with each beat boundary marked (i.e. you know "beat 2 starts at script_words[47]")
- `transcript_words[]` — Transcribe's output for the real recording of this scene: `{ text, start_ms, end_ms }` per recognized word, in order

## The walk

Two pointers, `i` into `script_words`, `j` into `transcript_words`. Both start at 0.

```
while i < len(script_words) and j < len(transcript_words):
    if matches(script_words[i], transcript_words[j]):
        if script_words[i] is a beat boundary:
            checkpoint[beat_id] = transcript_words[j].start_ms
        i += 1
        j += 1
    else:
        j += 1   # transcript word doesn't match — treat as filler/repeat/mis-hear, skip it
                  # do NOT advance i here — the script hasn't actually been said yet
```

`matches()` should be a loose comparison: lowercase, strip punctuation, maybe fuzzy-match short words. Don't require exact string equality.

## The stall case (handle this from day one, not as an afterthought)

If `j` advances a long way (some threshold, tune it, start around 15–20 transcript words) without `i` ever advancing, the script pointer is stuck on a word that's not being recognized, mumbled, mispronounced, or a genuine Transcribe miss. Don't let the whole sync freeze on it.

Fallback behavior: if the stall threshold is hit, **advance `i` past the stuck word anyway** and keep going from there, logging that this word was skipped. A checkpoint that lands a fraction of a second late because of one skipped word is invisible in the final video. A checkpoint system that silently stops advancing for the rest of the scene is not.

## What NOT to build

- No phrase/keyword detection ("wait for the AI to recognize the sentence has started talking about loops") — you already know the words, you don't need to infer meaning
- No ML alignment model — this is a two-pointer walk, plain code
- No requirement that beats have "distinctive opening words" — position in the known script is the anchor, not phrase recognition

## Testing this before wiring it into the real pipeline

Write a standalone test with a fake transcript that includes:
1. A deliberate stutter (one word repeated 2–3 times)
2. A deliberate dropped/missed word (present in script, absent from transcript)
3. At least one filler word not in the script at all ("um," "toh")

Confirm the checkpoints still land at the right script positions before this touches a real recording. This is cheap to test in isolation and expensive to debug live against actual audio.

## Output

`checkpoints[] { beat_id, timestamp_ms }` per scene, consumed directly by the render stage (see `docs/ARCHITECTURE.md`) to decide when to switch the visual.

---

# As built

The spec above is the design. This section is what the code in `backend/src/lib/sync/` actually does, including everything real speech taught us that the spec didn't anticipate. Each item was found by running against real recordings, not assumed.

## Tokenizing

Both sides are split on whitespace and any token with no letter or digit is dropped ("focus karo, initial runners" stays; a lone dash does not). A dash or other punctuation normalizes to nothing and can never match, so leaving it in stalled the walk. The first word of each beat is the beat boundary.

## Matching (`matches.ts`)

`wordsMatch` is layered, cheapest first:

1. **Exact** after lowercasing and stripping punctuation.
2. **Phonetic key**: Hindi has no fixed Latin spelling, so "cheez" and "chiija" must compare equal. The key folds long vowels (`aa`, `ii`, `ee`, `oo`, `uu`), `ph`/`f`, `ck`/`k`, `z`/`j`, `v`/`w`, doubled letters and a trailing `a`. Keys under three letters never match this way.
3. **Edit distance**, proportional to length: about one edit per three characters, with a floor of 2 edits. Words of two letters or fewer may differ by at most 1 edit ("ye" must not match "hi").

## The walk (`index.ts`)

Two pointers as specified, plus:

- **Look-ahead on a mismatch.** If the next two script words match the next two transcript words, the word was misheard and the transcript word stands in for it ("substituted", both pointers advance). If the next two script words match the transcript from `j` on, the word was never said ("dropped", only the script pointer advances and the transcript word is kept for the next script word). Two consecutive matches are required, so one coincidental fuzzy match can't trigger a skip.
- **Stall threshold of 18** transcript words with no script progress: the script word is skipped (logged) and, if it opened a beat, that beat's checkpoint is taken from the current transcript word.
- **Safety net for uncovered beats.** If the transcript ends before the script does, the remaining beats are spread across the time between the last real checkpoint and the end of the transcript, in proportion to their word counts, instead of all landing on the same final timestamp.

`computeSync` requires every scene to be transcribed and stores the result in S3 (`sync/<id>/result.json`).

## Before matching: getting a usable transcript (`transcribe/groq.ts`)

- Whisper is **primed with the scene's own script** as its prompt, which fixes spelling and vocabulary. Without it, English terms came back in Devanagari.
- Forcing a language on Hinglish audio was unreliable (a hallucinated one-liner, a translation to English, a truncated transcript on the same audio), so Hinglish starts with auto-detect and English scripts start with `en`. Each attempt is scored by how much of the script it reproduces in order; below 0.5, the next setting is tried.
- Devanagari output is transliterated to Latin (`transliterate.ts`) before it is stored, but only words that actually contain Devanagari, so "API" is never mangled.

## In the render

- The first beat starts at 0, not at its own checkpoint, so the silence before the first word stays in the video and every later cut lands where it should.
- A beat is never shorter than 0.8 seconds. Only a sync stall can produce a gap that small, and a visual flashing for a few frames reads as a glitch.
- The last beat runs to the end of the recording.

## How well it works

Measured against Polly narration, where the true timing of every beat is known, all beats landed within about 440 ms. Against a real human recording the same code produced cuts that lined up when the finished video was watched. Beats can still land a beat early or late when Whisper mishears a run of words; that is the case a future timeline editor would fix by hand.

## Tests

`sync/index.test.ts` covers the spec's three cases (stutter, dropped word, filler) plus substitution, spelling variants and punctuation tokens. `real-data.test.ts`, `whisper-real-data.test.ts` and `e2e-real-data.test.ts` run real transcripts from real recordings.
