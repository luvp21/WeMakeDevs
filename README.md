# Vaani — AI Codebase Narrator
*(working title, rename freely — search/replace "Vaani" repo-wide when you pick the real one)*

Built for **First Commit** (WeMakeDevs x AWS, Bharat Builds Tour), Sept 17–20, 2026.
Team: **codeDKFYDK** / **cosmosapiens** — Luv Patel ([@luvvv](https://x.com/luvvv), leader) and Poorvanshi Kochar ([@poorvanshi1375](https://x.com/poorvanshi1375)).

## The problem

Explaining a codebase, an ML model, or a backend system out loud, for a hackathon demo, a LinkedIn post, or an X video, almost always ends up as a talking head over a black terminal. It works, but it doesn't look good, and it's genuinely hard to make code, architecture, or an algorithm visually appealing without a lot of manual editing.

## What this does

You give it a repo (plus your own note on what to emphasize). It reads the codebase, writes a scene-by-scene narration script in natural Hinglish, and turns that script into a full explainer video: you record yourself reading it, scene by scene, against a teleprompter, and the app matches your real recorded voice to AI-generated visuals, animated slides, code highlights, graphs, so the visual on screen tracks exactly what you're saying, line by line, as you say it.

## Why it's different

There's already a small space of "repo in, video out" tools (Phantom, RepoClip, repo-explainer, and others). Every one of them we found generates the narration with AI, TTS or an AI voice. None of them sync a **real recorded human voice and face** to AI-generated visuals with per-line precision. That's the actual gap this project fills, and it's the headline feature, not a bonus on top of an AI-narrated video.

## How the sync actually works (the short version)

1. Bedrock writes the script as **scenes**, each scene broken into **beats** (a beat = one visual state: "highlight lines 1–5," "show this as a graph," etc.)
2. You record scene by scene against a teleprompter, one continuous take per scene, real voice, real face (or a shared browser tab for UI-demo scenes)
3. Transcribe returns the recording as timestamped words
4. A two-pointer match walks your **known script** against the **messy transcript** (stumbles, repeats, filler words included) and finds the real timestamp for every beat's checkpoint
5. The render step switches the visual at that exact timestamp

Full detail: [`docs/SYNC_ALGORITHM.md`](docs/SYNC_ALGORITHM.md)

## Repo map

```
├── README.md                    you are here
├── CLAUDE.md                    operating instructions for the coding agent — read this first
├── PROGRESS.md                  cross-session build log, update as you go
├── docs/
│   ├── ARCHITECTURE.md          full pipeline, stage by stage, AWS services mapped
│   ├── SYNC_ALGORITHM.md        the two-pointer checkpoint-matching spec, in detail
│   ├── FEATURES.md              must-have vs good-to-have, with the reasoning
│   ├── SCOPE_PLAN.md            day-by-day build plan against the actual deadline
│   ├── TASK_SPLIT.md            who's building what
│   └── HACKATHON_RULES.md       the rules that can disqualify or cost you a submission
├── frontend/                    (empty — recording UI, teleprompter, upload flow)
└── backend/                     (empty — Bedrock calls, Transcribe, sync algorithm, render)
```

## Tech stack (locked decisions, don't relitigate without good reason)

| Stage | Service | Notes |
|---|---|---|
| Repo ingest | S3 + Lambda | cap what gets sent to Bedrock, don't dump the whole repo |
| Script + visual generation | Bedrock | outputs scene → beats, each beat tagged with its visual type |
| Fallback narration | Polly (**Kajal** voice) | bilingual Hindi/Indian-English, switches mid-sentence — use for the safety-net AI-narrated version |
| Recording | Browser `getUserMedia` (webcam) + `getDisplayMedia` (tab picker for UI-demo scenes) | scene-by-scene, teleprompter-guided, not one long take |
| Transcription | Transcribe | word-level timestamps, this is what the sync algorithm consumes |
| Render | Fargate or MediaConvert | **not Lambda** — video rendering will hit Lambda's runtime limits |
| Orchestration | Step Functions | ingest → script → confirm → record → sync → render |

Track: **Ship It** (everything above is deployed AWS, not local-only, so this is not Build It).
