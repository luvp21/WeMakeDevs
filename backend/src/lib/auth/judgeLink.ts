import { createHmac, timingSafeEqual } from "node:crypto";

// The judge is given a link, not a password, so the link itself has to be the
// credential: /j/<key>. The key is derived from AUTH_SECRET instead of being a
// second secret to store and deploy. Anyone holding the link is the judge, and
// changing AUTH_SECRET changes the link (and signs everyone out), which is how to
// revoke it.
const PURPOSE = "vaani/judge-link/v1";

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET must be set and at least 32 characters");
  return value;
}

export function judgeLinkKey(): string {
  return createHmac("sha256", secret()).update(PURPOSE).digest("base64url");
}

export function checkJudgeLinkKey(given: string): boolean {
  const expected = Buffer.from(judgeLinkKey());
  const actual = Buffer.from(given);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
