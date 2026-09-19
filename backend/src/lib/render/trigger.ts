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
