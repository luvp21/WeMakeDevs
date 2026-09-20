import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { AuthRoleSchema, type AuthRole } from "@vaani/shared";
import { z } from "zod";

// The accounts are fixed and configured, not signed up for: AUTH_ACCOUNTS is a
// JSON list of { username, role, name, salt, hash }. Only a salted scrypt hash
// of each password is kept.
const AccountSchema = z.object({
  username: z.string().min(1),
  role: AuthRoleSchema,
  name: z.string().min(1),
  salt: z.string().min(16),
  hash: z.string().min(32),
});
export type Account = z.infer<typeof AccountSchema>;

const KEY_LENGTH = 32;

export function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, KEY_LENGTH).toString("hex");
}

export function makeAccount(username: string, role: AuthRole, name: string, password: string): Account {
  const salt = randomBytes(16).toString("hex");
  return { username, role, name, salt, hash: hashPassword(password, salt) };
}

// AUTH_ACCOUNTS is kept base64 encoded: raw JSON loses its quotes on the way
// through a shell and the SAM command line, which showed up as a broken login
// in the deployed stack. Plain JSON is still accepted, for local convenience.
export function loadAccounts(raw: string | undefined = process.env.AUTH_ACCOUNTS): Account[] {
  if (!raw) throw new Error("AUTH_ACCOUNTS is not set");
  const text = raw.trim().startsWith("[") ? raw : Buffer.from(raw.trim(), "base64").toString("utf8");
  return z.array(AccountSchema).parse(JSON.parse(text));
}

export function encodeAccounts(accounts: Account[]): string {
  return Buffer.from(JSON.stringify(accounts)).toString("base64");
}

// A fixed decoy so an unknown username costs the same time as a wrong password.
const DECOY: Account = { username: "", role: "tester", name: "", salt: "0".repeat(32), hash: "0".repeat(64) };

export function checkLogin(username: string, password: string, accounts: Account[] = loadAccounts()): Account | null {
  const account = accounts.find((a) => a.username === username.trim().toLowerCase());
  const target = account ?? DECOY;
  const given = Buffer.from(hashPassword(password, target.salt), "hex");
  const expected = Buffer.from(target.hash, "hex");
  const ok = given.length === expected.length && timingSafeEqual(given, expected);
  return account && ok ? account : null;
}
