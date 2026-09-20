import { secured } from "./secure.js";
import { NarrateRequestSchema } from "@vaani/shared";
import { ZodError } from "zod";
import { getLockedScript } from "../lib/lockScript.js";
import { narrateScript } from "../lib/narration/index.js";

export const handler = secured({ script: "body", heavy: true }, async (event) => {
  try {
    const parsed = NarrateRequestSchema.parse(JSON.parse(event.body ?? "{}"));
    const locked = await getLockedScript(parsed.script_id);
    const result = await narrateScript(locked);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    if (err instanceof ZodError) {
      return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: (err as Error).message }) };
  }
});
