import { CognitoJwtVerifier } from "aws-jwt-verify";
import { FetchError, JwksNotAvailableInCacheError } from "aws-jwt-verify/error";
import { SimpleFetcher } from "aws-jwt-verify/https";
import { SimpleJwksCache } from "aws-jwt-verify/jwk";
import type { AuthRole } from "@vaani/shared";
import { HttpError } from "./http.js";

// Who a verified token belongs to.
export interface Auth {
  username: string;
  role: AuthRole;
  name: string;
}

type Verifier = ReturnType<typeof createVerifier>;

// The pool's public signing keys are fetched once per process. The library's default of
// 3 seconds for that fetch is too tight on a slow network (a laptop on home wifi took
// nearly that long), so it gets longer; a Lambda in AWS answers in milliseconds.
const KEY_FETCH_TIMEOUT_MS = 10_000;

export function createVerifier(config: { userPoolId: string; clientIds: string[] }) {
  return CognitoJwtVerifier.create(
    { userPoolId: config.userPoolId, tokenUse: "id", clientId: config.clientIds },
    { jwksCache: new SimpleJwksCache({ fetcher: new SimpleFetcher({ defaultRequestOptions: { responseTimeout: KEY_FETCH_TIMEOUT_MS } }) }) },
  );
}

let verifier: Verifier | undefined;
function defaultVerifier(): Verifier {
  return (verifier ??= createVerifier({
    userPoolId: process.env.USER_POOL_ID ?? "",
    clientIds: [process.env.TESTER_CLIENT_ID ?? "", process.env.JUDGE_CLIENT_ID ?? "", process.env.WEB_CLIENT_ID ?? ""].filter(Boolean),
  }));
}

// Fetches the pool's signing keys ahead of the first sign-in. Used by the local dev server
// so that the first login isn't the one that pays for a slow network. Failure is fine: the
// keys are simply fetched on first use instead.
export async function warmVerifier(): Promise<void> {
  try {
    await defaultVerifier().hydrate();
  } catch {
    /* fetched on first use instead */
  }
}

// Checks a Cognito ID token (signature against the pool's published keys, issuer,
// audience, expiry, that it is an ID token) and turns it into who is calling.
// Returns null for anything wrong, and for a user who is in neither group nor signed in
// with Google: the group (or Google) is what decides the role.
export async function verifyIdToken(token: string, using: Verifier = defaultVerifier()): Promise<Auth | null> {
  try {
    const payload = await using.verify(token);
    const groups = (payload["cognito:groups"] as string[] | undefined) ?? [];
    const username = payload["cognito:username"];
    // Someone who signed in with Google has no group; being federated is what makes them a member.
    const federated = Array.isArray(payload.identities) && payload.identities.length > 0;
    const role: AuthRole | null = groups.includes("judge")
      ? "judge"
      : groups.includes("team")
        ? "team"
        : groups.includes("tester")
          ? "tester"
          : federated
            ? "member"
            : null;
    if (!role || typeof username !== "string") return null;
    return { username, role, name: typeof payload.name === "string" ? payload.name : username };
  } catch (err) {
    // Not being able to fetch the keys says nothing about the token: it is our problem,
    // not the caller's, so it must not look like "this token is invalid".
    if (err instanceof FetchError || err instanceof JwksNotAvailableInCacheError) {
      throw new HttpError(503, "Sign-in is temporarily unavailable. Please try again in a moment.");
    }
    return null;
  }
}

export function sessionExpiry(token: string): string {
  const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as { exp: number };
  return new Date(payload.exp * 1000).toISOString();
}
