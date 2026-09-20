# Task split

*Written on day one as a suggested split. The tech names below are updated to what was built; who did what is for the team to fill in.*

Fill in the names below once you've actually decided — this is a suggested split based on how the pipeline naturally divides, not a fixed assignment.

## Track A — Intelligence side
*Owns: stages 1–4, 6–7 (ingest, script gen, review, visual gen, transcription, sync algorithm)*

- Repo ingest and capping logic
- Gemini prompt design for English and Hinglish, beat-tagged script generation
- Visual-spec generation per beat
- Transcription integration (Whisper via Groq)
- The two-pointer sync algorithm (`docs/SYNC_ALGORITHM.md`) — build and unit-test this in isolation before it needs to touch a real recording

## Track B — Capture & render side
*Owns: stage 5 and 8 (recording UI, render pipeline), plus AWS infra*

- Teleprompter recording UI (`getUserMedia` for webcam scenes)
- Tab-picker capture for UI-demo scenes (`getDisplayMedia`)
- Fargate/MediaConvert render pipeline
- Wiring the stages together (the app's stepper plus state derived from S3; no Step Functions in the end)
- AWS account setup, credit form, Builder Center verification for both members

## Shared checkpoint

Both tracks depend on one shared contract: the exact shape of a "beat" object (id, text, visual_type, visual_spec, checkpoint marker). **Agree on this shape together before either track writes code against it** — see `docs/ARCHITECTURE.md` for the current proposed shape. Changing it later means both tracks have to rework their side.

## Daily sync

Given the deadline, a quick sync at the start and end of each day (see `docs/SCOPE_PLAN.md` for what each day should produce) matters more than usual — this isn't a project where either track can disappear for a full day without checking the other is still building against the same contract.
