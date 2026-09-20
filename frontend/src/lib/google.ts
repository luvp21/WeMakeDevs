import type { AuthConfig } from "@vaani/shared";

const STORAGE_KEY = "vaani.google";

const base64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const randomString = (bytes: number) => base64url(crypto.getRandomValues(new Uint8Array(bytes)));

export const callbackUrl = () => `${window.location.origin}/auth/callback`;

// Sends the person to Google (through Cognito's hosted page). PKCE: a random verifier is kept
// here and only its hash is sent, so a stolen code alone is useless; `state` ties the
// return trip to this browser.
export async function startGoogleSignIn(config: NonNullable<AuthConfig["google"]>): Promise<void> {
  const verifier = randomString(48);
  const state = randomString(16);
  const challenge = base64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ verifier, state }));
  } catch {
    throw new Error("Your browser is blocking site storage, which Google sign-in needs.");
  }
  const params = new URLSearchParams({
    client_id: config.client_id,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: callbackUrl(),
    identity_provider: "Google",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });
  window.location.assign(`${config.authorize_url}?${params}`);
}

// What was stored when the trip started, used once when it comes back.
export function takeGoogleAttempt(): { verifier: string; state: string } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as { verifier: string; state: string }) : null;
  } catch {
    return null;
  }
}
