import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { TranscribeRequestSchema, recordingKey } from "@vaani/shared";
import { ZodError } from "zod";
import { startTranscription } from "../lib/transcribe/index.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const parsed = TranscribeRequestSchema.parse(JSON.parse(event.body ?? "{}"));
    const key = recordingKey(parsed.script_id, parsed.scene_id, "webm");
    await startTranscription(parsed.script_id, parsed.scene_id, key);
    return {
      statusCode: 200,
      body: JSON.stringify({ script_id: parsed.script_id, scene_id: parsed.scene_id, status: "in_progress" }),
    };
  } catch (err) {
    if (err instanceof ZodError) {
      return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: (err as Error).message }) };
  }
};
