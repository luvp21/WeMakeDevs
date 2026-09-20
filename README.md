# Vaani: turn a GitHub repo into a video in your own voice

**Live app: https://10jlhtgcih.execute-api.us-east-1.amazonaws.com**

Built for **First Commit** (WeMakeDevs x AWS, Bharat Builds Tour), Sept 17 to 20, 2026.
Team **codeDKFYDK / cosmosapiens**: Luv Patel ([@luvvv](https://x.com/luvvv), leader) and Poorvanshi Kochar ([@poorvanshi1375](https://x.com/poorvanshi1375)).

## The problem

Explaining a project out loud, for a hackathon demo, a LinkedIn post or an X video, usually ends up as a talking head over a black terminal. It works, but it doesn't look good, and making code, architecture and a live product look good takes a lot of manual editing.

## What Vaani does

Paste a public GitHub repo. Vaani reads it and drafts a scene-by-scene script, with a visual planned for every line. You review and edit the script, then record yourself reading it, one scene at a time, from a teleprompter. Vaani finds the exact moment you say each line and cuts the matching visual in at that moment, with your face in a bubble on top.

The video uses **your real voice and face**. An AI voice (Amazon Polly) exists only as a fallback if you can't record.

### Features

- **Five video formats**: code walkthrough, hackathon demo, product demo, architecture overview, launch teaser. Each has its own scene outline, tone and visual mix.
- **English or Hinglish scripts**, picked before drafting. Hinglish is written the way Indian developers talk, in Latin letters. Both are written to be spoken: short sentences, plain words, no dashes or hype (see `backend/src/lib/prompts/spokenStyle.ts`).
- **Target length** (30 seconds to 5 minutes): the script is planned to a word budget, then each scene is written on its own with the repo as shared context.
- **Bring your own script**: paste narration and Vaani keeps your words and builds slides, diagrams and demo steps around them.
- **Edit any scene**: change the wording and regenerate the visual to match, or rebuild the whole scene from your text. The teleprompter follows.
- **Visuals**: syntax-highlighted code with the lines that matter, slides, architecture diagrams, bar charts (only from numbers in the repo or your notes), and product-demo footage.
- **Product demos, one clip per step**: for a demo step you record a silent screen clip on its own (tab picker), separate from your narration. The app you're demoing can use the microphone, you can pause through waiting, and you can retake one step. In the video the clip is sped up to fit your narration and ends on its last frame, so the result is never cut off.
- **Your face in the video**: a round camera bubble, bottom-right, on every scene.
- **Projects dashboard**: reopen any project at the step where you left it.

## How it works

```
GitHub URL + notes
   -> Ingest      file tree + a capped sample of files (1 GitHub API request, cached)
   -> Script      plan the scenes, then write each scene (Gemini)     [English | Hinglish]
   -> Review      edit words, regenerate visuals, lock the script
   -> Record      per scene: camera + mic against a teleprompter; demo steps: silent screen clips
   -> Transcribe  Whisper large-v3, word timestamps, runs in the background
   -> Sync        two-pointer match of the known script against the messy transcript
   -> Render      Fargate: Playwright frames + ffmpeg -> final.mp4
```

The core idea is the sync. The script is known word for word before you record, so Vaani doesn't try to understand your speech. It walks the script and the transcript with two pointers, so stutters, repeats and filler words cost only the transcript pointer. Details and the as-built behaviour: [`docs/SYNC_ALGORITHM.md`](docs/SYNC_ALGORITHM.md). Full pipeline: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Where AWS fits

| Piece | Service |
|---|---|
| API (15 routes) | API Gateway HTTP API + Lambda (Node 24, esbuild bundles) |
| Web app | A small Lambda serving the built frontend behind the same API (one https origin, no CORS) |
| Storage | S3: locked scripts, recordings, clips, transcripts, sync results, videos; presigned URLs so recordings go straight from the browser to S3 |
| Video rendering | ECS Fargate one-off task, image in ECR (never Lambda: it would hit the runtime limit) |
| AI-voice fallback | Amazon Polly, Kajal voice (Indian English and Hindi) |
| Infrastructure | One SAM/CloudFormation template: `backend/template.yaml` |

**What is not on AWS, honestly:** script generation uses Google Gemini and transcription uses Whisper large-v3 through Groq. Both sit behind small provider interfaces (`backend/src/lib/llm`, `backend/src/lib/transcribe`); Bedrock and AWS Transcribe implementations exist as alternatives. AWS Transcribe was tried first and replaced because it mangled code-switched Hindi and English (findings in `PROGRESS.md`). The production plan is a self-hosted Whisper on AWS.

**Why not CloudFront:** this account can't create CloudFront resources until AWS verifies it, so the frontend is served from Lambda instead. It is still https, which the camera and screen capture require.

## Run it locally

Needs Node 24, an AWS account with credentials configured (`aws configure`), and API keys for Gemini and Groq. Rendering locally also needs `ffmpeg` and Playwright's Chromium (`npx playwright install chromium`).

```bash
npm install
cp backend/.env.example backend/.env     # fill in S3_BUCKET, GEMINI_API_KEY, GROQ_API_KEY
npm run dev:backend                       # http://localhost:4000
npm run dev:frontend                      # http://localhost:5173  (proxies /api to the backend)
```

Set `RENDER_MODE=local` in `backend/.env` to run the render worker from your checkout instead of on Fargate. That way a render can't run older code than the app you're testing.

```bash
npm test --workspace backend             # 51 tests: sync, script generation, transcription, layout
```

## Deploy

```bash
npm run build:site                        # builds the frontend into backend/site/dist
cd backend
export PATH="$PWD/../node_modules/.bin:$PATH"   # sam build needs esbuild
sam build
sam deploy --stack-name vaani-backend --region us-east-1 --resolve-s3 \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --parameter-overrides GeminiApiKey=... GroqApiKey=... VpcId=... SubnetIds=subnet-a,subnet-b
```

Then build and push the render image. Do this again after any change under `render/` or `shared/`, because Fargate runs whatever is in ECR:

```bash
docker build -f render/Dockerfile -t <account>.dkr.ecr.<region>.amazonaws.com/vaani-render:latest .
docker push <account>.dkr.ecr.<region>.amazonaws.com/vaani-render:latest
```

Deploy output echoes parameter overrides, so redact keys before sharing a log. `GithubToken` is an optional parameter that lifts GitHub's unauthenticated limit.

## Repo map

```
├── shared/     Zod schemas (the single source of truth for every API and stored shape),
│               formats, layout and visual design shared by the renderer and the browser preview
├── backend/    Lambda handlers, script generation, sync, transcription, local dev server,
│               template.yaml, site/ (the Lambda that serves the web app)
├── frontend/   React 19 + Vite + Tailwind v4 + shadcn: landing page, dashboard, studio
├── render/     Fargate worker: Playwright frames, ffmpeg assembly, face bubble, demo clips
├── docs/       architecture, sync algorithm, features, scope plan, hackathon rules
├── CLAUDE.md   decisions that were locked on purpose, for the coding agent
└── PROGRESS.md the build log: what was tried, what broke, what is still open
```

## Known limits

- **No login.** The API is public and rate limited; the dashboard lists every project.
- **GitHub ingest** uses one unauthenticated API request per repo (60 an hour per IP, shared on Lambda) unless `GithubToken` is set. Repos are cached for 15 minutes.
- **API Gateway's 30 second limit** applies to every call, so transcription runs in the background and long scripts are written scene by scene.
- **A voice bot's replies aren't captured** in demo clips (no tab audio yet); show its text on screen.
- **Not built:** auto-zoom on clicks, a post-recording timeline editor, trimming a section out of a recorded clip (pause while recording instead), Hindi in Devanagari.

Track: **Ship It**.
