# Architecture

How Vaani works as built and deployed. The original design lives in `docs/SYNC_ALGORITHM.md` (the sync spec) and `PROGRESS.md` (every decision that changed, and why).

## Pipeline, stage by stage

```
GitHub URL + notes + format + language + length (or the user's own script)
        │
        ▼
┌─────────────────────┐
│ 1. Ingest            │  file tree via the GitHub API (1 request), README + package files +
│ Lambda               │  up to 12 source files from raw.githubusercontent.com, each capped
│ backend/lib/ingest   │  at 20 KB. Result cached in S3 for 15 minutes.
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 2. Script generation │  PLAN: one call returns an outline (scene titles, purpose, word budget
│ Gemini, function     │  from the target length at 135 words/minute).
│ calling              │  WRITE: one call per scene, three at a time, each seeing the shared
│ backend/lib/scriptGen│  repo context and the whole outline. Beats carry narration text plus
└──────────┬──────────┘  a visual: code_highlight | slide | diagram | chart | ui_demo.
           ▼             Narration follows spoken-style rules and a machine-writing check.
┌─────────────────────┐
│ 3. Review and lock   │  Edit any words. "Update visual" regenerates one beat from its new
│ app + Lambda         │  wording; "Rewrite scene" rebuilds a scene from edited text, keeping
│                      │  the wording (checked). Lock stores the script + ingest in S3.
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 4. Record            │  Per scene, in the browser: camera + mic against a teleprompter
│ getUserMedia /       │  (MediaRecorder, webm). Scenes with ui_demo beats first get a
│ getDisplayMedia      │  Demo clips panel: one silent screen clip per step, uploaded on its own.
└──────────┬──────────┘  Uploads go straight to S3 with presigned PUT URLs.
           ▼
┌─────────────────────┐
│ 5. Transcribe        │  Whisper large-v3 via Groq, word timestamps. The API call only marks
│ Lambda, background   │  the scene in progress and starts a background run of the same
│ backend/lib/         │  function (API Gateway gives up at 30 s); the app polls status.
│ transcribe           │  Attempts are scored against the script and retried (see below).
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 6. Sync              │  Two-pointer match of the known script against the transcript ->
│ plain code           │  a timestamp for every beat. See docs/SYNC_ALGORITHM.md.
│ backend/lib/sync     │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 7. Render            │  Step Functions runs an ECS Fargate one-off task (never Lambda) and waits
│ Fargate + ffmpeg     │  for it. Per beat: Playwright captures
│ Fargate + ffmpeg     │  the animated visual frame by frame; ffmpeg builds constant-30fps clips,
│ render/src           │  fits demo clips to their beats, joins the scene with the recorded
└──────────┬──────────┘  audio, overlays the face bubble, and concatenates scenes to final.mp4.
           ▼
      Finished video (presigned S3 URL)
```

The whole flow is driven by the app's stepper (Repo, Script, Record, Sync, Video) and by artifacts in S3. Only the render is a Step Functions workflow (see below); everywhere else each stage's state is derived from which objects exist in S3, which is also how the dashboard knows where a project stands.

### The render workflow

`POST /api/render` spends the tester's render, then starts a Step Functions execution (`backend/statemachine/render.asl.json`) with the project id, owner and role. `RunRender` uses the `ecs:runTask.sync` integration, so the workflow waits for the Fargate task and fails if the task exits non-zero or takes over 20 minutes. Any failure goes to `TidyUp` (the `RenderFailedFunction` Lambda, logic in `lib/render/failure.ts`): mark the render as failed if the worker couldn't (a crash or timeout leaves it on "running"), give a tester their render back in DynamoDB, add a note to the message the tester sees, and publish the reason to the SNS alerts topic. The execution then ends in a `Fail` state, which the `render-failed` CloudWatch alarm also watches. The worker's message to the app is sanitized: AWS and ffmpeg errors (role names, account ids, command output) go to the logs and the alert, not the page. In local dev (`RENDER_MODE=local`) the worker runs directly and none of this applies.

### Fallback path

Instead of recording, `POST /narrate` has Amazon Polly (Kajal, `en-IN` for English scripts) voice every beat, and the render uses the resulting exact durations as its timing. It is a complete video with no dependency on recording or sync. It is the safety net, never the primary path.

### Choices worth knowing about

- **Whisper, not AWS Transcribe.** Transcribe's per-segment language ID mangled code-switched Hindi and English. Whisper is faithful when primed with the scene's own script. Retry order for Hinglish: auto-detect + script prompt, English + prompt, Hindi + prompt, English alone. Each attempt is scored by how much of the script it reproduces (threshold 0.5), because Whisper sometimes hallucinates a stock phrase or translates. English scripts start with `language: "en"`. Devanagari output is transliterated to Latin before it is stored.
- **Constant frame rate everywhere.** Sparse still-image video and webcam webm are variable frame rate, and decoders cut such streams off early. Every clip is forced to 30 fps (`tpad` clones, `fps` filters).
- **First beat starts at 0.** It owns the silence before the first spoken word, so later cuts don't land early by that long.
- **Demo clips fit their beat.** A longer clip is sped up so all of it fits (squeezed into 85% of the beat, so the result stays on screen); a shorter one holds its last frame.
- **Face bubble.** Circular mask via ffmpeg `geq`, bottom-right. Visuals are drawn at 82% when a face is present so nothing runs under it (scaling the stage keeps diagrams undistorted); the demo window moves left and shrinks to 960x540.
- **Shared visual code.** `shared/src/visualDesign.ts` produces the HTML for every visual. The renderer screenshots it and the browser preview shows the same HTML in a scaled iframe, so what you review is what renders. Only code beats differ (Shiki in the renderer, a lighter highlighter in the browser).

## Deployment

```
Browser ──https──> API Gateway HTTP API ──┬─ GET /, /{proxy+}   -> SiteFunction (serves frontend/dist)
                   (one origin)           └─ /api/*             -> 17 Lambda functions
                                                                    │
            presigned PUT/GET (recordings, clips, video) ───────────┤
                                                                    ▼
                                                              S3 bucket
                                                                    ▲
       RenderTriggerFunction -> Step Functions -> ecs:RunTask -> Fargate ┘  (image in ECR)
                         └─ on failure: RenderFailedFunction -> DynamoDB refund + SNS alert
```

Everything is in `backend/template.yaml`. CloudFront would normally front the site, but this account can't create CloudFront resources until AWS verifies it, so the frontend is served by `backend/site/index.mjs` (gzip, immutable caching for fingerprinted assets, SPA fallback, path-traversal guarded). The API is throttled (50 rps, burst 100) because it is public and each call can spend model, transcription, TTS or Fargate money.

Locally, `backend/src/local-server.ts` serves the same routes (`/api/*`) and the Vite dev server proxies to it. With `RENDER_MODE=local` the render worker runs from the checkout instead of Fargate.

## Access control

Fixed accounts, no sign-up (`backend/src/lib/auth/`). `POST /api/auth/login` checks a salted scrypt hash in constant time and returns a signed token; `POST /api/auth/judge-link` exchanges the private link's key for a judge session (the key is `HMAC(AUTH_SECRET, "vaani/judge-link/v1")`, compared in constant time, so the judges need no password and rotating the secret revokes the link); `GET /api/auth/me` returns the account and its usage. Every other route goes through one function, `guard()` in `access.ts` (used by the Lambda wrapper `handlers/secure.ts` and by the local server), which checks in order: a valid unexpired token, that the project belongs to the caller (the judge passes; a tester on someone else's project gets a 404, indistinguishable from a missing one), and a quota. Quotas live in a DynamoDB table (`<stack>-usage`, one item per tester) and every change is a single atomic conditional update (an increment only succeeds while the counter is under its limit), so simultaneous requests can't both take the last unit. A tester gets 5 drafts, 3 script locks and 1 render in total (`TESTER_LIMITS` in `shared/src/auth.ts`); a call that then fails on our side gives its quota back. A locked script records its `owner`; projects from before accounts have none and are visible to the judge only. The dashboard lists a tester's own projects and every project for the judge.

The web app decides what to show by role (blog link `/` is a sign-in for testers, `/judge` for the judge, landing page and full dashboard only for the judge), but that is presentation: the data is protected by the server checks above.

## Data contracts

All defined once as Zod schemas in `shared/src/index.ts`; the API validates requests and the frontend parses responses with the same schemas.

- **Script**: `{ repo_url, user_context, format, language, scenes[] { id, title, beats[] { id, text, visual_type, visual_spec } } }`
- **Transcript** (per scene): `words[] { text, start_ms, end_ms }`, plus a status of in_progress, completed or failed
- **Sync result**: `scenes[] { scene_id, checkpoints[] { beat_id, timestamp_ms } }`

### S3 layout

| Key | Content |
|---|---|
| `scripts/<id>.json` | locked script + ingest |
| `recordings/<id>/<scene>.webm` | the narration take (camera + mic) |
| `clips/<id>/<beat>.webm` | silent screen clip for one demo step |
| `transcripts/<id>/<scene>/output.json` | transcript status and words |
| `sync/<id>/result.json` | checkpoints |
| `narration/<id>/...` | Polly fallback audio and timing |
| `renders/<id>/status.json`, `final.mp4` | render status and the video |
| `ingest-cache/<owner>/<repo>.json` | 15 minute repo cache |

## Configuration

| Variable | Purpose |
|---|---|
| `S3_BUCKET`, `AWS_REGION` | storage |
| `LLM_PROVIDER` (`gemini` default, or `bedrock`), `GEMINI_API_KEY`, `GEMINI_MODEL` | script generation |
| `STT_PROVIDER` (`groq` default, or `aws`), `GROQ_API_KEY`, `WHISPER_LANGUAGE` | transcription |
| `GITHUB_TOKEN` | optional, lifts GitHub's 60 requests an hour |
| `USAGE_TABLE` | the DynamoDB table of tester usage (`vaani-backend-usage`) |
| `RENDER_STATE_MACHINE_ARN`, `ALERT_TOPIC_ARN` | set by the stack in Lambda: the render workflow and the alerts topic |
| `AUTH_SECRET`, `AUTH_ACCOUNTS` | session signing key and the fixed accounts (base64 JSON of salted hashes), from `backend/scripts/make-accounts.mjs` |
| `RENDER_MODE=local` | dev only: run the render from the checkout |

See `backend/.env.example`.
