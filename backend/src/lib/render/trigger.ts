import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import type { AuthRole } from "@vaani/shared";

const sfn = new SFNClient({});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} env var is not set`);
  return value;
}

export interface RenderRequester {
  owner: string;
  role: AuthRole;
}

// Starts the render workflow (a Step Functions state machine): it runs the render
// on Fargate (never Lambda, CLAUDE.md #6), waits for it, and if it fails or times
// out marks the render failed, gives a tester their render back and raises an
// alert. The worker writes its own progress to S3 as it runs. The requester is
// passed along so a failure knows whose quota to give back.
export async function triggerRenderTask(scriptId: string, requester: RenderRequester): Promise<void> {
  if (process.env.RENDER_MODE === "local") {
    startLocalRender(scriptId);
    return;
  }
  await sfn.send(
    new StartExecutionCommand({
      stateMachineArn: requireEnv("RENDER_STATE_MACHINE_ARN"),
      // Names must be unique per state machine; a re-render of the same project needs a new one.
      name: `${scriptId}-${Date.now()}`,
      input: JSON.stringify({ script_id: scriptId, owner: requester.owner, role: requester.role }),
    }),
  );
}

// Dev only (RENDER_MODE=local): runs the render worker straight from this
// checkout instead of on Fargate. The Fargate image only changes when someone
// rebuilds and pushes it, so a render there can silently run older code than
// the app being tested. The worker itself is identical and writes the same
// status and video files to S3.
function startLocalRender(scriptId: string): void {
  const renderDir = fileURLToPath(new URL("../../../../render/", import.meta.url));
  const log = openSync(join(tmpdir(), `vaani-render-${scriptId}.log`), "a");
  const child = spawn("npx", ["tsx", "src/index.ts"], {
    cwd: renderDir,
    env: {
      ...process.env,
      SCRIPT_ID: scriptId,
      S3_BUCKET: requireEnv("S3_BUCKET"),
      AWS_REGION: requireEnv("AWS_REGION"),
    },
    detached: true,
    stdio: ["ignore", log, log],
  });
  // An uncaught throw here would take the whole dev server down.
  child.on("error", (err) => console.error(`Couldn't start the local render: ${err.message}`));
  child.unref();
}
