import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { IngestRequestSchema } from "@vaani/shared";
import { ZodError } from "zod";
import { ingestRepo, IngestError } from "../lib/ingest.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const parsed = IngestRequestSchema.parse(JSON.parse(event.body ?? "{}"));
    const result = await ingestRepo(parsed.repo_url);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    if (err instanceof ZodError) {
      return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
    }
    const status = err instanceof IngestError ? 400 : 500;
    return { statusCode: status, body: JSON.stringify({ error: (err as Error).message }) };
  }
};
