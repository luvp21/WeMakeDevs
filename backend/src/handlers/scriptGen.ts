import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ScriptGenRequestSchema } from "@vaani/shared";
import { ZodError } from "zod";
import { generateScript } from "../lib/scriptGen.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const parsed = ScriptGenRequestSchema.parse(JSON.parse(event.body ?? "{}"));
    const script = await generateScript(parsed.ingest, parsed.user_context);
    return { statusCode: 200, body: JSON.stringify(script) };
  } catch (err) {
    if (err instanceof ZodError) {
      return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: (err as Error).message }) };
  }
};
