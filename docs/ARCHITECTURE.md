# Architecture

## Pipeline, stage by stage

```
Repo URL + user context
        │
        ▼
┌───────────────────┐
│  1. Ingest         │  clone repo, pull README + package files + up to N sample files
│  S3 + Lambda       │  cap what's sent forward — don't dump the whole repo into Bedrock
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  2. Script gen     │  Bedrock reads repo + context, outputs scenes → beats
│  Bedrock           │  each beat: narration text (Hinglish) + visual type + visual spec
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  3. Review/edit    │  user sees the full script, edits lines before locking
│  app layer only    │  this is the safety net for AI mistakes — don't skip it
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  4. Visual gen     │  per scene, generate the HTML slide / code highlight / graph
│  Bedrock           │  spec that each beat's visual_type calls for
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  5. Recording      │  scene by scene, teleprompter-guided
│  getUserMedia /    │  webcam for talking-head scenes
│  getDisplayMedia   │  tab-picker for UI-demo scenes
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  6. Transcription  │  word-level timestamps on the real recording
│  Transcribe        │
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  7. Sync/checkpoint│  two-pointer match: known script vs messy transcript
│  plain code        │  → real timestamp for every beat boundary
│  (see SYNC_ALGORITHM.md)
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  8. Render         │  cut/overlay visuals at the checkpoint timestamps
│  Fargate /          │  full-screen face vs. overlay vs. UI-demo footage
│  MediaConvert       │  NOT Lambda — video work will hit runtime limits
└─────────┬─────────┘
          ▼
   Finished video
```

## Orchestration

Step Functions ties stages 1–4 and 6–8 together as a state machine. Stage 5 (recording) is inherently a human-in-the-loop step — it waits on the user, so design that stage as an explicit "waiting for input" state rather than trying to force it into a fully automated chain.

## Fallback path (build this first)

Stages 1–4, then straight to Polly (Kajal voice) narration over the generated visuals, skipping 5–7 entirely. This is a complete, submittable video with zero dependency on the harder recording-and-sync work. Get this working before starting the human-recording path.

## Two visual sources (three, if the UI-demo scene type is built)

- **AI-generated slide**: code snippet, highlighted lines, a diagram or graph — built from the beat's `visual_spec`
- **Human recording**: webcam face, full-screen or as an overlay depending on the scene
- **UI-demo footage** (good-to-have): browser tab capture of the actual app running, Recordly-style polish applied after the must-haves are done

## Data contracts between stages

Keep these explicit and stable, since stages are built somewhat independently:

- **Script gen → Review**: `scene[] { id, beats[] { id, text, visual_type, visual_spec } }`
- **Recording → Transcription**: raw audio/video per scene, one file per scene, not one file for the whole video
- **Transcription → Sync**: `word[] { text, start_ms, end_ms }` per scene
- **Sync → Render**: `checkpoint[] { beat_id, timestamp_ms }` per scene

Whoever owns script generation and whoever owns recording/render should agree on the exact shape of the beat object before either writes code against it — see `docs/TASK_SPLIT.md`.
