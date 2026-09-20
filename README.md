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
   -> Render      Step Functions -> Fargate: Playwright frames + ffmpeg -> final.mp4
```

The core idea is the sync. The script is known word for word before you record, so Vaani doesn't try to understand your speech. It walks the script and the transcript with two pointers, so stutters, repeats and filler words cost only the transcript pointer. Details and the as-built behaviour: [`docs/SYNC_ALGORITHM.md`](docs/SYNC_ALGORITHM.md). Full pipeline: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Where AWS fits

| Piece | Service |
|---|---|
| API (15 routes) | API Gateway HTTP API + Lambda (Node 24, esbuild bundles) |
| Web app | A small Lambda serving the built frontend behind the same API (one https origin, no CORS) |
| Storage | S3: locked scripts, recordings, clips, transcripts, sync results, videos; presigned URLs so recordings go straight from the browser to S3 |
| Video rendering | ECS Fargate one-off task, image in ECR (never Lambda: it would hit the runtime limit) |
| Render workflow | Step Functions runs the Fargate task and waits for it. On a failure or timeout it marks the render failed (a crashed task would otherwise leave the app waiting forever), gives a tester their one render back, and raises an alert |
| Usage limits | DynamoDB, one item per tester with atomic conditional updates, so two simultaneous requests can't both take the last render |
| Alerts | SNS topic plus CloudWatch alarms (a failed render workflow, a burst of API 5xx errors); the workflow's failure step also publishes the reason |
| AI-voice fallback | Amazon Polly, Kajal voice (Indian English and Hindi) |
| Infrastructure | One SAM/CloudFormation template: `backend/template.yaml` |

**What is not on AWS, honestly:** script generation uses Google Gemini and transcription uses Whisper large-v3 through Groq. Both sit behind small provider interfaces (`backend/src/lib/llm`, `backend/src/lib/transcribe`); Bedrock and AWS Transcribe implementations exist as alternatives. AWS Transcribe was tried first and replaced because it mangled code-switched Hindi and English (findings in `PROGRESS.md`). The production plan is a self-hosted Whisper on AWS.

**Why not CloudFront:** this account can't create CloudFront resources until AWS verifies it, so the frontend is served from Lambda instead. It is still https, which the camera and screen capture require.

## Accounts and access

There is no sign-up. Three fixed accounts are created with `node backend/scripts/make-accounts.mjs` (random passwords; only salted scrypt hashes go into `AUTH_ACCOUNTS`, and the plain passwords go to the git-ignored `backend/.accounts.txt`).

| Account | Sees | Can do |
|---|---|---|
| `tester1`, `tester2` (shared in the blog) | only their own project, on the blog link `/` | 5 script drafts, 3 script locks, and **one render in total** |
| `judge` (private) | the whole site: landing page, every account's projects and videos | no limits. Signs in by opening a **private link** (`/j/<key>`), so the judges need no password; `/judge` is a password sign-in kept as a backup |

The judge link's key is derived from `AUTH_SECRET`, so there is nothing extra to store: `node backend/scripts/judge-link.mjs <site-url> --save` writes the link to the git-ignored `backend/.accounts.txt`, and rotating `AUTH_SECRET` (then redeploying) replaces the link and signs everyone out. Anyone holding the link is the judge, so keep it out of the blog and out of screenshots. Opening it signs in and removes the key from the address bar; pages send no referrer.

Every API call is checked on the server: a signed session token (HMAC-SHA256, 6 hours for testers, 72 for the judge), then whether the project belongs to the caller, then the quota. A project that isn't yours answers 404, the same as one that doesn't exist. Hiding pages in the UI is only a convenience (the page code is in the public bundle); the data is what's protected.

Reset a tester after a demo: `aws dynamodb delete-item --table-name vaani-backend-usage --key '{"username":{"S":"tester1"}}'`.

## Run it locally

Needs Node 24, an AWS account with credentials configured (`aws configure`), and API keys for Gemini and Groq. Rendering locally also needs `ffmpeg` and Playwright's Chromium (`npx playwright install chromium`).

```bash
npm install
cp backend/.env.example backend/.env     # fill in S3_BUCKET, GEMINI_API_KEY, GROQ_API_KEY
node backend/scripts/make-accounts.mjs    # creates the sign-in accounts (AUTH_SECRET, AUTH_ACCOUNTS)
npm run dev:backend                       # http://localhost:4000
npm run dev:frontend                      # http://localhost:5173  (proxies /api to the backend)
```

Set `RENDER_MODE=local` in `backend/.env` to run the render worker from your checkout instead of on Fargate. That way a render can't run older code than the app you're testing.

```bash
npm test --workspace backend             # 72 tests: sync, script generation, transcription, layout, access control, quotas, render failure handling
```

## Deploy

```bash
npm run build:site                        # builds the frontend into backend/site/dist
cd backend
export PATH="$PWD/../node_modules/.bin:$PATH"   # sam build needs esbuild
sam build
sam deploy --stack-name vaani-backend --region us-east-1 --resolve-s3 \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --parameter-overrides GeminiApiKey=... GroqApiKey=... AuthSecret=... AuthAccounts=... AlertEmail=you@example.com VpcId=... SubnetIds=subnet-a,subnet-b
```

Then build and push the render image. Do this again after any change under `render/` or `shared/`, because Fargate runs whatever is in ECR:

```bash
docker build -f render/Dockerfile -t <account>.dkr.ecr.<region>.amazonaws.com/vaani-render:latest .
docker push <account>.dkr.ecr.<region>.amazonaws.com/vaani-render:latest
```

Deploy output echoes parameter overrides, so redact keys before sharing a log. Pass `AuthAccounts` base64 encoded (the script writes it that way): raw JSON loses its quotes on the SAM command line. `GithubToken` is an optional parameter that lifts GitHub's unauthenticated limit.

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

- **Fixed accounts only.** Sign-in is two shared tester accounts and one judge account, not a user system. Whoever uses a tester account sees the same project. A tester whose render fails is given it back automatically; an operator can also reset one by deleting their row in the usage table.
- **GitHub ingest** uses one unauthenticated API request per repo (60 an hour per IP, shared on Lambda) unless `GithubToken` is set. Repos are cached for 15 minutes.
- **API Gateway's 30 second limit** applies to every call, so transcription runs in the background and long scripts are written scene by scene.
- **A voice bot's replies aren't captured** in demo clips (no tab audio yet); show its text on screen.
- **Not built:** auto-zoom on clicks, a post-recording timeline editor, trimming a section out of a recorded clip (pause while recording instead), Hindi in Devanagari.

Track: **Ship It**.
