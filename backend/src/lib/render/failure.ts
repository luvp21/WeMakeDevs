import { hasLimits, type AuthRole, type RenderStatus } from "@vaani/shared";

// What the render workflow (Step Functions) hands over when the Fargate task
// fails or times out. `error` is Step Functions' own description of why.
export interface RenderFailureInput {
  script_id: string;
  owner?: string;
  role?: AuthRole;
  error?: { Error?: string; Cause?: string };
}

export interface FailureDeps {
  getStatus(scriptId: string): Promise<RenderStatus>;
  setStatus(status: RenderStatus): Promise<void>;
  refund(owner: string): Promise<void>;
  notify(subject: string, message: string): Promise<void>;
}

const STOPPED_MESSAGE = "The render stopped before it finished.";
const GIVEN_BACK = " It didn't use up your one video, so you can try again.";
const MAX_CAUSE_LENGTH = 400;

// Tidies up after a failed render, which the worker can't always do for itself
// (a crash or timeout leaves the status stuck on "running" and the app waiting
// forever): mark it failed, give a tester their one render back, and raise an alert.
export async function handleRenderFailure(
  deps: FailureDeps,
  input: RenderFailureInput,
  now: () => Date = () => new Date(),
): Promise<{ refunded: boolean }> {
  const current = await deps.getStatus(input.script_id);
  // Finished after all (the worker won a race with the workflow): nothing to undo.
  if (current.status === "done") return { refunded: false };

  // Only accounts with a one-video allowance have one to give back.
  const refunded = Boolean(input.owner) && hasLimits(input.role ?? null);
  const base = current.status === "error" && current.error ? current.error : STOPPED_MESSAGE;
  // A tester is told their video wasn't used up, since that is what they wonder next.
  const sentence = /[.!?]$/.test(base) ? base : `${base}.`;
  const message = refunded ? `${sentence}${GIVEN_BACK}` : base;
  if (current.status !== "error" || refunded) {
    await deps.setStatus({ script_id: input.script_id, status: "error", error: message, updated_at: now().toISOString() });
  }
  if (refunded && input.owner) await deps.refund(input.owner);

  const cause = (input.error?.Cause ?? input.error?.Error ?? "unknown").slice(0, MAX_CAUSE_LENGTH);
  await deps.notify(
    `Vaani render failed (${input.script_id})`,
    [
      `Project: ${input.script_id}`,
      `Account: ${input.owner ?? "unknown"}${refunded ? " (render given back)" : ""}`,
      `What the app shows: ${message}`,
      `Workflow error: ${cause}`,
    ].join("\n"),
  );
  return { refunded };
}
