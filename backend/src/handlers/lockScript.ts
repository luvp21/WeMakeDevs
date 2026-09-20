import { LockScriptRequestSchema } from "@vaani/shared";
import { ZodError } from "zod";
import { lockScript } from "../lib/lockScript.js";
import { secured } from "./secure.js";
import { checkLockedScript } from "../lib/auth/videoLimit.js";

export const handler = secured({ quota: "locks", check: checkLockedScript }, async (event, auth) => {
  try {
    const parsed = LockScriptRequestSchema.parse(JSON.parse(event.body ?? "{}"));
    const locked = await lockScript(parsed.script, parsed.ingest, auth.username, auth.name);
    return { statusCode: 200, body: JSON.stringify(locked) };
  } catch (err) {
    if (err instanceof ZodError) {
      return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: (err as Error).message }) };
  }
});
