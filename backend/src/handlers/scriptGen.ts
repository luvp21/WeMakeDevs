import { secured } from "./secure.js";
import { VIDEO_FORMATS } from "@vaani/shared";
import { checkOwnScript, limitedMinutes } from "../lib/auth/videoLimit.js";
import { ScriptGenRequestSchema } from "@vaani/shared";
import { ZodError } from "zod";
import { generateScript } from "../lib/scriptGen.js";

export const handler = secured({ quota: "drafts", heavy: true, check: checkOwnScript }, async (event, auth) => {
  try {
    const parsed = ScriptGenRequestSchema.parse(JSON.parse(event.body ?? "{}"));
    const script = await generateScript(parsed.ingest, parsed.user_context, parsed.format, {
      targetMinutes: limitedMinutes(auth.role, parsed.target_minutes, VIDEO_FORMATS[parsed.format].defaultMinutes),
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
