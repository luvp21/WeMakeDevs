# Operating instructions

Read this before writing any code. This project has a hard deadline (Sunday 8:00 PM IST) and a set of architectural decisions that were already worked through in detail before any code was written — don't re-derive or second-guess them, build against them.

## Non-negotiable decisions already made

These were each chosen over a simpler or more "impressive-sounding" alternative, for specific reasons. Don't swap them out mid-build without checking `docs/` first.

1. **Real recorded human voice/face is the headline feature.** AI-narrated fallback (Polly) exists only as a safety net if the human-recording pipeline breaks, never as the primary path in the demo.
2. **Recording happens scene by scene against a teleprompter, not as one long take.** This was chosen specifically because it makes the video-to-visual matching almost free (each clip is already born matched to its scene) instead of needing heavy post-hoc alignment.
3. **Sync uses a two-pointer match between the known script and the messy Transcribe output — not phrase detection, not an ML alignment model.** The script is authoritative. The transcript is allowed to be messy (stutters, repeats, filler words). See `docs/SYNC_ALGORITHM.md` before touching this code.
4. **UI-demo scenes use the browser's tab-picker (`getDisplayMedia`), recorded as one silent clip per demo step, separate from the narration (so the app can use the mic), not desktop capture and not an uploaded video from elsewhere.** This gives structured cursor/click data for free if it's your own app being demoed; treat auto-zoom-on-click as good-to-have, not must-have.
5. **Hinglish is the default and a first-class requirement of the script prompt, not a translation pass after the fact.** (English is a second option, picked before drafting; it has its own example lines.) Give the generation prompt real Hinglish example lines to match register against, or it defaults to stiff, formal Hindi. Use Polly's **Kajal** voice for any AI-narrated audio — it's built to switch Hindi/Indian-English mid-sentence.
6. **Video rendering does not run on Lambda.** Use Fargate or MediaConvert for that stage specifically.

## Build order

Follow `docs/SCOPE_PLAN.md` day by day. In short: get repo-in → locked script → AI-narrated (Polly) placeholder video working completely, end to end, before touching the human-recording sync at all. That gives a submittable fallback early and turns everything after it into upside, not risk.

## When you finish a piece

Update `PROGRESS.md` with what's done, what broke, and what's still open. Keep it current across sessions — that file is the memory of this build, not this conversation.

## What NOT to build unless the must-haves are done

Everything in the "good-to-have" table in `docs/FEATURES.md`. Especially: auto-zoom-on-click, multi-visual-beat animation triggered by anything other than the two-pointer checkpoint match, and any attempt to auto-drive a target app's UI via browser automation (not planned — screen-share is user-driven, not agent-driven).

## Style

Plain, direct code and comments. No filler. If something in these docs turns out to be wrong once you're actually building it, say so and update the doc, don't silently drift from it.
