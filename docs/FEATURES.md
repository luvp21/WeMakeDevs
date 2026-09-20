# Feature mapping

Status as of Sept 20, 2026. The must-have and good-to-have split below is the original one, kept because the reasoning still holds; each row now says what actually happened.

## Must-have: the walking skeleton

| Feature | What it does | Built with | Status |
|---|---|---|---|
| Repo ingest | Accept a GitHub URL, pull the README, package files and a capped sample of source files | Lambda, GitHub tree API + raw files, S3 cache | Done. One API request per repo, 15 minute cache |
| User context box | Free-text note on what to emphasize (real numbers, audience, purpose) | app | Done. Notes are used as-is, never invented from |
| Script generation | Scenes broken into beats, each with a planned visual, in English or natural Hinglish | Gemini (Bedrock is not available on this account) | Done. Two-stage plan-then-write, length control, spoken style rules |
| Script review and edit | Edit the wording, regenerate a visual or a whole scene from the new text, lock | app + Lambda | Done |
| Visual generation | Per beat: code highlight, slide, diagram, chart, or product-demo footage | Shiki, shared HTML/CSS, Playwright | Done |
| Polly fallback narration | AI voice reads the script as a complete backup video | Amazon Polly (Kajal) | Done. Verified end to end; never the primary path |
| Teleprompter, scene-by-scene recording | One scene at a time; camera + mic; pop-out prompter | `getUserMedia`, MediaRecorder | Done |
| Product-demo recording | One silent screen clip per demo step, apart from the narration | `getDisplayMedia` | Done. Replaced recording screen and voice together (see below) |
| Transcription | Word timestamps on each recorded scene | Whisper large-v3 via Groq | Done. AWS Transcribe was tried and replaced |
| Two-pointer checkpoint sync | Matches the known script to the messy transcript | plain code | Done. Beats within about 440 ms of ground truth in tests. See `docs/SYNC_ALGORITHM.md` |
| Auto-cut render | Switches visuals at checkpoint times, with the presenter's face in a bubble | Fargate, Playwright, ffmpeg | Done |
| Beat-level visual tagging | Every beat says which visual it wants | part of script generation | Done |

## Added after the original plan

| Feature | Why |
|---|---|
| Five video formats (code walkthrough, hackathon demo, product demo, architecture overview, launch teaser) | The first output read as a code explanation only; hackathon and product videos need slides, diagrams and demos in balance |
| Target length (30 seconds to 5 minutes) | Scripts are planned to a word budget at 135 words per minute |
| Bring your own script | Paste narration; Vaani keeps the words and builds visuals around them |
| English or Hinglish | So the tool is useful to anyone who wants a fully English video |
| Spoken-style writing and a machine-writing check | Drafts sounded written, not spoken. Rules and a retry, using patterns from the open-source humanizer skill |
| Presenter face bubble | The first render had the voice but not the person |
| One demo clip per step, recorded silently | Recording the screen and the narration together collided with apps that use the mic (a voice bot), needed the app in the right state on cue, and made talking while clicking the norm |
| Clip fitting (speed up to fit, never cut the end, hold the last frame) | A demo's result is usually at the end of the clip |
| Projects dashboard, landing page | Reopen any project at the right step |
| Local render mode | So a render can't silently run older code than the app |

## Good-to-have, and what happened

| Feature | Status |
|---|---|
| Diagram generation beyond code snippets | Done (diagrams and bar charts) |
| Multiple aspect ratios (16:9 / 9:16) | Not built |
| Auto-burned captions | Not built. The word timestamps are there, so it is cheap to add |
| Auto-zoom on click for demo footage | Not built. A browser can't see clicks in another tab without extra capture, so it stays good-to-have |
| Manual override of cut timing | Not built. The preview-and-adjust step (see below) is the intended home |
| Nicer transitions between full-screen and overlay | Partly: every beat enters with an animation; no other transitions |

## Ideas we decided not to do today

- **A post-recording editor**: play the whole video in the browser, nudge cut points, trim and speed clips, draw zoom regions. It would sit between Sync and Render, reading a small list of overrides on top of the sync result. Judged too large for deadline day.
- **Trim or fast-forward a section of a recorded clip.** Pausing while recording is the workaround.
- **Tab audio in demo clips**, so a voice bot's replies are heard. Show its text on screen for now.

## Explicitly descoped

- Automated browser-driving of a target app's UI (too fragile; screen-share is user-driven)
- Phrase or meaning-based scene detection (replaced by the two-pointer positional match)
- Anything that needs a labelled training dataset (this is generation and matching, not classification)
- Hindi in Devanagari script (English and Hinglish in Latin letters only)
