# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Developers who want to explain a codebase to others (teammates, an audience, hackathon judges) as a short video, in their own voice and face, without editing footage by hand. Narration is Hinglish by default, or English.

## Product Purpose
Vaani turns a public GitHub repo into a narrated explainer video. It drafts a beat-tagged script in English or Hinglish, the user records it scene by scene against a teleprompter, and Vaani cuts the matching visuals (real code, slides, diagrams) in at the exact moments the user says them. Success is a finished video that sounds and looks like the user made it.

## Positioning
The video uses the user's real recorded voice and face, with visuals timed to what they actually said (two-pointer sync against a Whisper transcript), not a synthetic voiceover. An AI voice (Amazon Polly Kajal) exists only as a fallback.

## Operating Context
A five-stage pipeline: Repo, Script (review and lock), Record (webcam, scene by scene), Sync, Video (render on AWS Fargate). The dashboard shows a project's place in it as a progress bar with the next action; the Studio walks through it with a horizontal stepper. Built for the First Commit hackathon (WeMakeDevs x AWS); deployed on AWS.

## Capabilities and Constraints
- Stages are sequential; a script must be locked before recording.
- Recording uploads straight to S3; transcription via Whisper (Groq for now, self-hosted Whisper on AWS intended for production).
- Rendering never runs on Lambda.

## Brand Commitments
Name: Vaani. The website is light, with a blue accent and Geist Mono type. Rendered videos can be dark (editor-style, one-dark code) or light (the same colors and type as the website), chosen per video. shadcn/ui is the required component base.

## Evidence on Hand
No customers, testimonials, or benchmarks exist; none should be invented.

## Product Principles
- The user's voice is the product; the AI voice is only a safety net.
- Show real work from the repo, never generic filler.
- One clear next action per stage.

## Accessibility & Inclusion
Keyboard focus visible, reduced-motion respected, contrast at or above WCAG AA. Copy must read clearly for Hindi-English bilingual users.
