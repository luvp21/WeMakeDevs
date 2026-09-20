import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { handleRenderFailure, type FailureDeps, type RenderFailureInput } from "../lib/render/failure.js";
import { refund } from "../lib/auth/quota.js";
import { getRenderStatus, setRenderStatus } from "../lib/render/status.js";

const sns = new SNSClient({});

const deps: FailureDeps = {
  getStatus: getRenderStatus,
  setStatus: setRenderStatus,
  refund: (owner) => refund(owner, "member", "renders"),
  // No topic configured (for example in a test stack) simply means no email.
  async notify(subject, message) {
    const TopicArn = process.env.ALERT_TOPIC_ARN;
    if (TopicArn) await sns.send(new PublishCommand({ TopicArn, Subject: subject.slice(0, 100), Message: message }));
  },
};

// Invoked by the render state machine when the Fargate task fails or times out.
export const handler = async (input: RenderFailureInput): Promise<{ refunded: boolean }> => handleRenderFailure(deps, input);
