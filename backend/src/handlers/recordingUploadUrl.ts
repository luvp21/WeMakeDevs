import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { RecordingUploadUrlRequestSchema } from "@vaani/shared";
import { ZodError } from "zod";
import { getRecordingUploadUrl } from "../lib/recording.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const parsed = RecordingUploadUrlRequestSchema.parse(JSON.parse(event.body ?? "{}"));
    const result = await getRecordingUploadUrl(parsed);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    if (err instanceof ZodError) {
      return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: (err as Error).message }) };
  }
};
