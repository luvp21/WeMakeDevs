import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ScriptGenRequestSchema, WriteSceneRequestSchema } from "@vaani/shared";
import { ZodError } from "zod";
import { planScript, writePlannedScene } from "../lib/scriptGen.js";

function failure(err: unknown) {
  if (err instanceof ZodError) return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
  return { statusCode: 500, body: JSON.stringify({ error: (err as Error).message }) };
}

export const planHandler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const parsed = ScriptGenRequestSchema.parse(JSON.parse(event.body ?? "{}"));
    const scenes = await planScript(parsed.ingest, parsed.user_context, parsed.format, {
      targetMinutes: parsed.target_minutes,
      sourceScript: parsed.source_script?.trim() || undefined,
    }, parsed.language);
    return { statusCode: 200, body: JSON.stringify({ scenes }) };
  } catch (err) {
    return failure(err);
  }
};

export const writeSceneHandler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const parsed = WriteSceneRequestSchema.parse(JSON.parse(event.body ?? "{}"));
    const result = await writePlannedScene({
      ingest: parsed.ingest,
      format: parsed.format,
      language: parsed.language,
      userContext: parsed.user_context,
      outline: parsed.outline,
      index: parsed.index,
    });
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    return failure(err);
  }
};
