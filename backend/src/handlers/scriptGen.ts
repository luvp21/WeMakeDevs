import { secured } from "./secure.js";
import { ScriptGenRequestSchema } from "@vaani/shared";
import { ZodError } from "zod";
import { generateScript } from "../lib/scriptGen.js";

export const handler = secured({ quota: "drafts" }, async (event) => {
  try {
    const parsed = ScriptGenRequestSchema.parse(JSON.parse(event.body ?? "{}"));
    const script = await generateScript(parsed.ingest, parsed.user_context, parsed.format, {
      targetMinutes: parsed.target_minutes,
      sourceScript: parsed.source_script?.trim() || undefined,
    }, parsed.language);
    return { statusCode: 200, body: JSON.stringify(script) };
  } catch (err) {
    if (err instanceof ZodError) {
      return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: (err as Error).message }) };
  }
});
