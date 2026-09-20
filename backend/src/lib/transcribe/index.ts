// Transcription is Whisper large-v3 via Groq (see groq.ts for why AWS Transcribe was replaced:
// its per-segment language ID mangled code-switched Hindi and English). The rest of the backend
// imports from here, so a self-hosted Whisper on AWS could replace it in one place.
export { getTranscriptionStatus, markTranscriptionStarted, startTranscription } from "./groq.js";
