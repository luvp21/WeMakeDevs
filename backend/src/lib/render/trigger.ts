import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";

const client = new ECSClient({});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} env var is not set`);
  return value;
}

// Kicks off a one-off Fargate task (not a long-running ECS service — we pay
// only for the render's actual runtime, per CLAUDE.md #6's "not Lambda"
// but still serverless). The task writes its own progress to S3 as it runs.
export async function triggerRenderTask(scriptId: string): Promise<void> {
  if (process.env.RENDER_MODE === "local") {
    startLocalRender(scriptId);
    return;
  }
  const cluster = requireEnv("ECS_CLUSTER");
  const taskDefinition = requireEnv("ECS_TASK_DEFINITION");
  const subnets = requireEnv("ECS_SUBNETS").split(",");
  const securityGroup = requireEnv("ECS_SECURITY_GROUP");
  const containerName = process.env.ECS_CONTAINER_NAME ?? "render";

  await client.send(
    new RunTaskCommand({
      cluster,
      taskDefinition,
      launchType: "FARGATE",
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets,
          securityGroups: [securityGroup],
          assignPublicIp: "ENABLED",
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: containerName,
            environment: [
              { name: "SCRIPT_ID", value: scriptId },
              { name: "S3_BUCKET", value: requireEnv("S3_BUCKET") },
              { name: "AWS_REGION", value: requireEnv("AWS_REGION") },
            ],
          },
        ],
      },
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
