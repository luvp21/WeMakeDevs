import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { JudgeLinkRequestSchema, LoginRequestSchema, TESTER_LIMITS, type LoginResponse, type Session } from "@vaani/shared";
import { ZodError } from "zod";
import { authenticate, HttpError } from "../lib/auth/access.js";
import { checkLogin, loadAccounts, type Account } from "../lib/auth/accounts.js";
import { checkJudgeLinkKey } from "../lib/auth/judgeLink.js";
import { getUsage } from "../lib/auth/quota.js";
import { signToken } from "../lib/auth/token.js";
import { errorResponse } from "./secure.js";

// How long a sign-in lasts. Testers are short, so a shared account can't be
// left open on someone's laptop for long; the judge looks around over days and, with
// only a link, has no password to sign in again with, so it is long.
const SESSION_HOURS = { tester: 6, judge: 72 } as const;
// Slows password guessing on top of the API's rate limit.
const FAILED_LOGIN_DELAY_MS = 500;

async function sessionFor(username: string, role: "tester" | "judge", name: string): Promise<Session> {
  return role === "tester"
    ? { username, display_name: name, role, usage: await getUsage(username), limits: TESTER_LIMITS }
    : { username, display_name: name, role };
}

async function startSession(account: Account): Promise<LoginResponse> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_HOURS[account.role] * 3600;
  return {
    ...(await sessionFor(account.username, account.role, account.name)),
    token: signToken({ sub: account.username, role: account.role, name: account.name, exp }),
    expires_at: new Date(exp * 1000).toISOString(),
  };
}

async function refuse(message: string): Promise<never> {
  await new Promise((resolve) => setTimeout(resolve, FAILED_LOGIN_DELAY_MS));
  throw new HttpError(401, message);
}

export async function login(body: unknown): Promise<LoginResponse> {
  const parsed = LoginRequestSchema.parse(body);
  const account = checkLogin(parsed.username, parsed.password);
  return account ? startSession(account) : refuse("That username or password isn't right.");
}

// Opening the private judge link signs in as the judge account.
export async function judgeLink(body: unknown): Promise<LoginResponse> {
  const parsed = JudgeLinkRequestSchema.safeParse(body);
  if (!parsed.success || !checkJudgeLinkKey(parsed.data.key)) return refuse("This link isn't valid.");
  const judge = loadAccounts().find((a) => a.role === "judge");
  if (!judge) throw new Error("No judge account is configured");
  return startSession(judge);
}

export async function me(authorization: string | undefined): Promise<Session> {
  const auth = authenticate(authorization);
  return sessionFor(auth.username, auth.role, auth.name);
}

function fail(err: unknown): APIGatewayProxyStructuredResultV2 {
  if (err instanceof HttpError) return errorResponse(err);
  if (err instanceof ZodError) return { statusCode: 400, body: JSON.stringify({ error: "Enter a username and password." }) };
  return { statusCode: 500, body: JSON.stringify({ error: (err as Error).message }) };
}

// One function for the auth routes: POST /api/auth/login, POST /api/auth/judge-link, GET /api/auth/me.
export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    if (event.rawPath.endsWith("/auth/login")) return { statusCode: 200, body: JSON.stringify(await login(body)) };
    if (event.rawPath.endsWith("/auth/judge-link")) return { statusCode: 200, body: JSON.stringify(await judgeLink(body)) };
    return { statusCode: 200, body: JSON.stringify(await me(event.headers?.authorization)) };
  } catch (err) {
    return fail(err);
  }
};
