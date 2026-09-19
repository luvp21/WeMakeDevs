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
