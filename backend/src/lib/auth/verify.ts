import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { AuthRole } from "@vaani/shared";

// Who a verified token belongs to.
export interface Auth {
  username: string;
  role: AuthRole;
  name: string;
}

type Verifier = ReturnType<typeof createVerifier>;

export function createVerifier(config: { userPoolId: string; clientIds: string[] }) {
  return CognitoJwtVerifier.create({ userPoolId: config.userPoolId, tokenUse: "id", clientId: config.clientIds });
}

let verifier: Verifier | undefined;
function defaultVerifier(): Verifier {
  return (verifier ??= createVerifier({
    userPoolId: process.env.USER_POOL_ID ?? "",
    clientIds: [process.env.TESTER_CLIENT_ID ?? "", process.env.JUDGE_CLIENT_ID ?? "", process.env.WEB_CLIENT_ID ?? ""].filter(Boolean),
  }));
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
  } catch {
    return null;
  }
}

export function sessionExpiry(token: string): string {
  const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as { exp: number };
  return new Date(payload.exp * 1000).toISOString();
}
