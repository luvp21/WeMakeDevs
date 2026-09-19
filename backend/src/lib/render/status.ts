import { renderStatusKey, renderVideoKey, type RenderStatus } from "@vaani/shared";
import { getJson, putJson, getPresignedUrl } from "../s3.js";

export async function getRenderStatus(scriptId: string): Promise<RenderStatus> {
  let status: RenderStatus;
  try {
    status = await getJson<RenderStatus>(renderStatusKey(scriptId));
  } catch (err) {
    if (err instanceof Error && err.name === "NoSuchKey") {
      return { script_id: scriptId, status: "pending", updated_at: new Date().toISOString() };
    }
    throw err;
  }

  // Generate the presigned URL fresh on read rather than trusting whatever
  // the render worker wrote — presigned URLs expire, the worker's write and
  // this read can be arbitrarily far apart.
  if (status.status === "done") {
    const video_url = await getPresignedUrl(renderVideoKey(scriptId));
    return { ...status, video_url };
  }
  return status;
}

export async function setRenderStatus(status: RenderStatus): Promise<void> {
  await putJson(renderStatusKey(status.script_id), status);
}
