import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { hasLimits, type AuthRole } from "@vaani/shared";
import { HttpError } from "./http.js";

// How many calls one account may make in a minute. "heavy" routes are the ones
// that spend money (Gemini, Groq, Polly, Fargate); "login" is per IP address for
// the sign-in endpoints, where there is no account yet.
export type RateKind = "normal" | "heavy" | "login";

const PER_MINUTE: Record<RateKind, number> = {
  // Status polling alone is about 20 a minute, so this leaves plenty of room.
  normal: 120,
  // Drafting a script is a plan call plus one call per scene (up to about ten), all within
  // a minute or so.
  heavy: 30,
  login: 10,
};
// The judge and the team accounts are trusted and test a lot, but still limited: a stuck loop
// in a browser tab shouldn't be able to run up a bill either.
const JUDGE_MULTIPLIER = 5;
const WINDOW_SECONDS = 60;

// Renders across everyone except the judge, per UTC day. A last line of defence for
// the Fargate bill if accounts multiply or something loops.
export const DAILY_RENDER_CAP = 40;
const DAY_SECONDS = 86400;

// A counter per key that resets on its own. increment() adds one unless the count
// has already reached `limit`, in one atomic step, and says whether it did.
export interface RateStore {
  increment(key: string, limit: number, expiresAtSeconds: number): Promise<boolean>;
}

// Counters live in the usage table under "rate#..." keys. DynamoDB deletes them
// itself shortly after `expires_at` (the table's time-to-live setting).
function dynamoRateStore(): RateStore {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  return {
    async increment(key, limit, expiresAtSeconds) {
      const TableName = process.env.USAGE_TABLE;
      if (!TableName) throw new Error("USAGE_TABLE env var is not set");
      try {
        await client.send(
          new UpdateCommand({
            TableName,
            Key: { username: key },
            UpdateExpression: "ADD hits :one SET expires_at = if_not_exists(expires_at, :expires)",
            ConditionExpression: "attribute_not_exists(hits) OR hits < :limit",
            ExpressionAttributeValues: { ":one": 1, ":limit": limit, ":expires": expiresAtSeconds },
          }),
        );
        return true;
      } catch (err) {
        if (err instanceof ConditionalCheckFailedException) return false;
        throw err;
      }
    },
  };
}

export function memoryRateStore(): RateStore {
  const counts = new Map<string, number>();
  return {
    async increment(key, limit) {
      const current = counts.get(key) ?? 0;
      if (current >= limit) return false;
      counts.set(key, current + 1);
      return true;
    },
  };
}

let store: RateStore | undefined;
const defaultStore = () => (store ??= dynamoRateStore());

function tooFast(secondsLeft: number): HttpError {
  return new HttpError(429, `You're going a bit fast. Please wait ${secondsLeft} second${secondsLeft === 1 ? "" : "s"} and try again.`);
}

// Counts one call against `subject` (an account name, or an IP address for the
// sign-in routes) and throws a 429 if that is too many for this minute. If the
// counter itself is unavailable the call goes through: a limiter outage should
// not take the app down with it.
export async function enforceRate(
  subject: string,
  kind: RateKind,
  role: AuthRole | null = null,
  using: RateStore = defaultStore(),
  nowMs: number = Date.now(),
): Promise<void> {
  const now = Math.floor(nowMs / 1000);
  const window = Math.floor(now / WINDOW_SECONDS);
  // Accounts without allowances (judge, team) get more room, but are still limited.
  const limit = PER_MINUTE[kind] * (role !== null && !hasLimits(role) ? JUDGE_MULTIPLIER : 1);
  let allowed: boolean;
  try {
    allowed = await using.increment(`rate#${kind}#${subject}#${window}`, limit, (window + 1) * WINDOW_SECONDS + WINDOW_SECONDS);
  } catch (err) {
    console.error("rate limiter unavailable, letting the call through:", err instanceof Error ? err.message : err);
    return;
  }
  if (!allowed) throw tooFast((window + 1) * WINDOW_SECONDS - now);
}

// One more render today across all non-judge accounts, or a 429.
export async function enforceDailyRenderCap(using: RateStore = defaultStore(), nowMs: number = Date.now()): Promise<void> {
  const now = Math.floor(nowMs / 1000);
  const day = Math.floor(now / DAY_SECONDS);
  let allowed: boolean;
  try {
    allowed = await using.increment(`rate#renders-per-day#${day}`, DAILY_RENDER_CAP, (day + 1) * DAY_SECONDS + DAY_SECONDS);
  } catch (err) {
    console.error("daily render cap unavailable, letting the call through:", err instanceof Error ? err.message : err);
    return;
  }
  if (!allowed) {
    throw new HttpError(429, "Vaani has reached its limit of videos for today. Please try again tomorrow.");
  }
}
