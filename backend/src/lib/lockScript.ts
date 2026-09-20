import { lockedScriptKey, type IngestResult, type LockedScript, type Script } from "@vaani/shared";
import { getJson, putJson } from "./s3.js";
import { randomUUID } from "node:crypto";

export async function lockScript(script: Script, ingest: IngestResult, owner?: string, ownerName?: string): Promise<LockedScript> {
  const scriptId = randomUUID();
  const locked: LockedScript = {
    script_id: scriptId,
    script,
    ingest,
    locked_at: new Date().toISOString(),
    ...(owner ? { owner } : {}),
    ...(ownerName ? { owner_name: ownerName } : {}),
  };
  await putJson(lockedScriptKey(scriptId), locked);
  return locked;
}

export async function getLockedScript(scriptId: string): Promise<LockedScript> {
  return getJson<LockedScript>(lockedScriptKey(scriptId));
}
