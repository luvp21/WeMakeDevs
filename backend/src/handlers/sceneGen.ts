import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { SceneGenRequestSchema } from "@vaani/shared";
import { ZodError } from "zod";
import { generateScene } from "../lib/scriptGen.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const parsed = SceneGenRequestSchema.parse(JSON.parse(event.body ?? "{}"));
    const result = await generateScene({
      ingest: parsed.ingest,
      format: parsed.format,
      userContext: parsed.user_context,
      sceneTitle: parsed.scene_title,
      narration: parsed.narration,
      mode: parsed.mode,
    });
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    if (err instanceof ZodError) {
      return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: (err as Error).message }) };
  }
};
