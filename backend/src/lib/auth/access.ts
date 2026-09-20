import type { AuthRole } from "@vaani/shared";
import { getLockedScript } from "../lockScript.js";
import { verifyToken } from "./token.js";
import { consume, refund, type QuotaKind } from "./quota.js";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Auth {
  username: string;
  role: AuthRole;
  name: string;
}

// Reads "Authorization: Bearer <token>". Anything else is a 401.
export function authenticate(authorization: string | undefined): Auth {
  const token = /^Bearer (.+)$/i.exec(authorization ?? "")?.[1];
  const payload = token ? verifyToken(token) : null;
  if (!payload) throw new HttpError(401, "Please sign in again.");
  return { username: payload.sub, role: payload.role, name: payload.name };
}

export function requireJudge(auth: Auth): void {
  if (auth.role !== "judge") throw new HttpError(403, "This is only available to the judge account.");
}

// A tester can only touch projects they made; the judge can touch all of them.
// Projects from before accounts existed have no owner, so only the judge sees them.
export function canAccess(auth: Auth, owner: string | undefined): boolean {
  return auth.role === "judge" || owner === auth.username;
}

export async function authorizeScript(auth: Auth, scriptId: string): Promise<void> {
  if (auth.role === "judge") return;
  const locked = await getLockedScript(scriptId).catch(() => null);
  // Same answer for "doesn't exist" and "isn't yours", so ids can't be probed.
  if (!locked || !canAccess(auth, locked.owner)) throw new HttpError(404, "Project not found.");
}

export interface Guard {
  // Where to find the project id this call acts on, if any.
  script?: "body" | "path";
  // A quota to spend for this call (refunded if it fails on our side).
  quota?: QuotaKind;
}

// The one place every route (Lambda and local server) checks access: sign-in,
// then project ownership, then quota. Returns who is calling, plus a function
// to give the quota back if the work then fails.
export async function guard(
  authorization: string | undefined,
  rules: Guard,
  ids: { body?: unknown; path?: Record<string, string | undefined> },
): Promise<{ auth: Auth; refundQuota: () => Promise<void> }> {
  const auth = authenticate(authorization);
  if (rules.script) {
    const scriptId =
      rules.script === "path" ? ids.path?.scriptId : (ids.body as { script_id?: unknown } | undefined)?.script_id;
    if (typeof scriptId !== "string" || !scriptId) throw new HttpError(400, "script_id is required.");
    await authorizeScript(auth, scriptId);
  }
  if (rules.quota) {
    const spent = await consume(auth.username, auth.role, rules.quota);
    if (!spent.ok) throw new HttpError(403, spent.message);
  }
  const kind = rules.quota;
  return { auth, refundQuota: async () => (kind ? refund(auth.username, auth.role, kind) : undefined) };
}
