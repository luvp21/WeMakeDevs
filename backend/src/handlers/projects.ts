import { secured } from "./secure.js";
import { listProjects, getProject } from "../lib/projects.js";

export const listHandler = secured({}, async (_event, auth) => {
  try {
    return { statusCode: 200, body: JSON.stringify({ projects: await listProjects(auth) }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: (err as Error).message }) };
  }
});

export const getHandler = secured({ script: "path" }, async (event) => {
  try {
    const scriptId = event.pathParameters?.scriptId;
    if (!scriptId) return { statusCode: 400, body: JSON.stringify({ error: "scriptId is required" }) };
    return { statusCode: 200, body: JSON.stringify(await getProject(scriptId)) };
  } catch (err) {
    const notFound = err instanceof Error && err.name === "NoSuchKey";
    return { statusCode: notFound ? 404 : 500, body: JSON.stringify({ error: notFound ? "Project not found" : (err as Error).message }) };
  }
});
