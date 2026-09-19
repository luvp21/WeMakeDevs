import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  DeleteTranscriptionJobCommand,
  LanguageCode,
} from "@aws-sdk/client-transcribe";
import { transcribeOutputKey, transcriptionJobName, type TranscribeStatus } from "@vaani/shared";
import { getJson } from "../s3.js";
import { parseTranscribeOutput } from "./parse.js";

const client = new TranscribeClient({});

function bucketName(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET env var is not set");
  return bucket;
}

// Code-switched Hinglish speech, same reasoning as Kajal's voice choice
// (CLAUDE.md #5) — pick from both candidate languages rather than force one.
const LANGUAGE_OPTIONS = [LanguageCode.HI_IN, LanguageCode.EN_IN];

export async function startTranscription(
  scriptId: string,
  sceneId: string,
  recordingKey: string,
  mediaFormat: "webm" | "mp4" | "mp3" = "webm",
): Promise<void> {
  const jobName = transcriptionJobName(scriptId, sceneId);

  // Job names must be unique per account/region and are deterministic here
  // (re-recording the same scene re-transcribes under the same name), so
  // clear out any prior job for this scene before starting a fresh one.
  try {
    await client.send(new DeleteTranscriptionJobCommand({ TranscriptionJobName: jobName }));
  } catch {
    // No prior job — fine, this is the common case.
  }

  // Confirmed empirically: without this, Transcribe phonetically respells
  // English CS/programming loanwords ("async", "function", "API") as
  // Devanagari within the Hindi segment instead of recognizing them as
  // English — a custom vocabulary on the en-IN language ID pass biases
  // recognition toward the literal English spelling for exactly these
  // words. See PROGRESS.md for the before/after comparison.
  const vocabularyName = process.env.TRANSCRIBE_VOCABULARY_NAME;

  await client.send(
    new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      Media: { MediaFileUri: `s3://${bucketName()}/${recordingKey}` },
      MediaFormat: mediaFormat,
      IdentifyMultipleLanguages: true,
      LanguageOptions: LANGUAGE_OPTIONS,
      LanguageIdSettings: vocabularyName
        ? { [LanguageCode.EN_IN]: { VocabularyName: vocabularyName } }
        : undefined,
      OutputBucketName: bucketName(),
      OutputKey: transcribeOutputKey(scriptId, sceneId),
    }),
  );
}

export async function getTranscriptionStatus(scriptId: string, sceneId: string): Promise<TranscribeStatus> {
  const jobName = transcriptionJobName(scriptId, sceneId);
  const res = await client.send(new GetTranscriptionJobCommand({ TranscriptionJobName: jobName }));
  const job = res.TranscriptionJob;
  const status = job?.TranscriptionJobStatus;

  if (status === "FAILED") {
    return { script_id: scriptId, scene_id: sceneId, status: "failed", error: job?.FailureReason };
  }
  if (status !== "COMPLETED") {
    return { script_id: scriptId, scene_id: sceneId, status: "in_progress" };
  }

  const raw = await getJson<unknown>(transcribeOutputKey(scriptId, sceneId));
  const words = parseTranscribeOutput(raw);
  return { script_id: scriptId, scene_id: sceneId, status: "completed", words };
}
