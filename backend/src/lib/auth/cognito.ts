import { randomBytes } from "node:crypto";
import {
  AdminInitiateAuthCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  NotAuthorizedException,
  UserNotFoundException,
} from "@aws-sdk/client-cognito-identity-provider";
import type { AuthRole } from "@vaani/shared";
import { HttpError } from "./http.js";

const client = new CognitoIdentityProviderClient({});

const JUDGE_USERNAME = "judge";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} env var is not set`);
  return value;
}

// Testers and the judge use separate app clients so their sessions can last
// different times (see the template).
const clientId = (role: AuthRole) => env(role === "judge" ? "JUDGE_CLIENT_ID" : role === "member" ? "WEB_CLIENT_ID" : "TESTER_CLIENT_ID");

export interface Tokens {
  idToken: string;
  refreshToken?: string;
  expiresIn: number;
}

async function adminAuth(role: AuthRole, flow: "ADMIN_USER_PASSWORD_AUTH" | "REFRESH_TOKEN_AUTH", params: Record<string, string>): Promise<Tokens> {
  const result = await client.send(
    new AdminInitiateAuthCommand({
      UserPoolId: env("USER_POOL_ID"),
      ClientId: clientId(role),
      AuthFlow: flow,
      AuthParameters: params,
    }),
  );
  const auth = result.AuthenticationResult;
  if (!auth?.IdToken) throw new HttpError(401, "That username or password isn't right.");
  return { idToken: auth.IdToken, refreshToken: auth.RefreshToken, expiresIn: auth.ExpiresIn ?? 3600 };
}

// Password sign-in is for the shared tester accounts. It refuses the judge
// account before Cognito is asked: Cognito locks a user out after a few wrong
// passwords, and the judge has no password to type, so anyone guessing at "judge"
// could only ever succeed in locking the real judge out.
export function assertPasswordLoginAllowed(username: string): void {
  if (username.trim().toLowerCase() === JUDGE_USERNAME) throw new HttpError(401, "That username or password isn't right.");
}

export async function passwordSignIn(username: string, password: string): Promise<Tokens> {
  assertPasswordLoginAllowed(username);
  try {
    return await adminAuth("tester", "ADMIN_USER_PASSWORD_AUTH", { USERNAME: username.trim().toLowerCase(), PASSWORD: password });
  } catch (err) {
    // A wrong password and an unknown user get the same answer.
    if (err instanceof NotAuthorizedException || err instanceof UserNotFoundException) {
      throw new HttpError(401, "That username or password isn't right.");
    }
    throw err;
  }
}

// The judge has no password anyone knows. Opening the private link (checked by
// our Lambda first) gives the judge account a fresh random password and signs in
// with it, so there is nothing stored that could leak, and no password to guess.
export async function judgeSignIn(): Promise<Tokens> {
  const attempt = async () => {
    const password = randomBytes(32).toString("base64url");
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: env("USER_POOL_ID"),
        Username: JUDGE_USERNAME,
        Password: password,
        Permanent: true,
      }),
    );
    return adminAuth("judge", "ADMIN_USER_PASSWORD_AUTH", { USERNAME: JUDGE_USERNAME, PASSWORD: password });
  };
  try {
    return await attempt();
  } catch (err) {
    // Two link opens at the same moment can each change the password under the other.
    if (err instanceof NotAuthorizedException) return attempt();
    throw err;
  }
}

// A new ID token from a refresh token, without signing in again.
export async function refreshSession(role: AuthRole, refreshToken: string): Promise<Tokens> {
  try {
    return await adminAuth(role, "REFRESH_TOKEN_AUTH", { REFRESH_TOKEN: refreshToken });
  } catch (err) {
    if (err instanceof NotAuthorizedException) throw new HttpError(401, "Please sign in again.");
    throw err;
  }
}

// Where a Google sign-in may come back to: this site's callback page, or the local dev server's.
export function assertAllowedRedirect(uri: string, siteUrl: string | undefined = process.env.SITE_URL): void {
  const allowed = [`${(siteUrl ?? "").replace(/\/$/, "")}/auth/callback`, "http://localhost:5173/auth/callback"];
  if (!allowed.includes(uri)) throw new HttpError(400, "That sign-in address isn't allowed.");
}

// The second half of "Continue with Google": Cognito's hosted page has sent the person back
// with a code; exchange it (proving we started the sign-in, with the PKCE verifier) for tokens.
export async function googleSignIn(code: string, codeVerifier: string, redirectUri: string): Promise<Tokens> {
  assertAllowedRedirect(redirectUri);
  const res = await fetch(`https://${env("COGNITO_DOMAIN")}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: env("WEB_CLIENT_ID"),
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });
  if (!res.ok) throw new HttpError(401, "Google sign-in didn't complete. Please try again.");
  const tokens = (await res.json()) as { id_token?: string; refresh_token?: string; expires_in?: number };
  if (!tokens.id_token) throw new HttpError(401, "Google sign-in didn't complete. Please try again.");
  return { idToken: tokens.id_token, refreshToken: tokens.refresh_token, expiresIn: tokens.expires_in ?? 3600 };
}
