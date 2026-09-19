# Feature mapping

## Must-have — the walking skeleton, nothing works as a demo without all of these

| Feature | What it does | AWS piece | Why it's non-negotiable |
|---|---|---|---|
| Repo ingest | Accept a GitHub URL, clone it, pull README + sample key files (capped) | S3, Lambda | No input, no product |
| User context box | Free-text field, what to emphasize before script gen | app layer | Makes it *your* explanation, not a generic one |
| Hinglish-aware script generation | Bedrock reads repo + context, outputs scene → beats, in natural code-switched Hinglish, not translated-sounding Hindi | Bedrock | The actual AI core judges score on "built on AWS," and Hinglish is now core to the pitch |
| Script review/edit | User sees the locked script, edits before recording | app layer | Safety net for AI mistakes |
| Visual generation | Per beat, generate the HTML slide/highlight/graph the beat calls for | Bedrock | The actual "look good" payoff |
| Kajal (Polly) fallback narration | AI voice reads the script over the visuals as a complete backup video | Polly | If the human-recording/sync path breaks Saturday night, this version still ships |
| Teleprompter-guided, scene-by-scene recording | Shows script one scene at a time; webcam for talking-head scenes, browser tab-picker for UI-demo scenes | `getUserMedia`, `getDisplayMedia` | This is the headline differentiator — real voice, real face |
| Transcription | Word-level timestamps on each recorded scene | Transcribe | Required input to the sync algorithm |
| Two-pointer checkpoint sync | Matches known script to messy transcript, finds real timestamps for beat boundaries | plain code | See `docs/SYNC_ALGORITHM.md` — this is the hardest and most novel piece |
| Auto-cut render | Assembles the final video: switches visuals at checkpoint timestamps, full-screen face vs. overlay | Fargate or MediaConvert | The thing you actually submit |
| Beat-level visual tagging in script gen | Each beat's script output includes which visual type it wants (highlight lines X–Y, show graph, show UI) | Bedrock (part of stage 2) | Without this the render step has nothing to key off |

## Good-to-have — only after everything above works end to end

| Feature | Payoff | Effort | Notes |
|---|---|---|---|
| Auto-burned captions | More watchable for judges skimming with sound off | Low | Nearly free — you already have Transcribe's word timestamps |
| UI-demo screen-capture scenes | Strong, concrete visual of the actual app working | Medium | Only if it's your own app — you get cursor/click data for free; someone else's site gives you pixels only |
| Auto-zoom-on-click for UI-demo footage | Recordly-style polish | Medium, do last | Depends entirely on having structured cursor data, see above |
| Nicer transition styles (full-screen ↔ overlay) | Looks less like a rough cut | Medium | Purely cosmetic |
| Diagram generation beyond code snippets (architecture graphs) | Stronger visual variety, helps Best UI | Medium–high | Don't attempt until core render works |
| Manual override on auto-cut timing | Escape hatch if a checkpoint lands wrong | Medium | |
| Multiple export aspect ratios (16:9 / 9:16) | Nice for posting to X/LinkedIn | Low | Purely cosmetic, do last |

## Explicitly descoped (don't build these for this hackathon)

- Automated browser-driving of a target app's UI (too fragile in the time available; screen-share is user-driven instead)
- Phrase/meaning-based scene detection (replaced by the two-pointer positional match — see `docs/SYNC_ALGORITHM.md`)
- Anything requiring a labeled training dataset (this project never needed one — it's reasoning/generation, not classification)
