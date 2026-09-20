#!/usr/bin/env node
// Creates the fixed accounts (two testers and a judge) with random passwords.
//
//   node backend/scripts/make-accounts.mjs [--force]
//
// Writes AUTH_SECRET and AUTH_ACCOUNTS (salted scrypt hashes only) into
// backend/.env, and the plain passwords into backend/.accounts.txt (git-ignored).
// The tester passwords are meant to be shared; the judge's is printed nowhere.
import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(dir, ".env");
const notesPath = path.join(dir, ".accounts.txt");

if (existsSync(notesPath) && !process.argv.includes("--force")) {
  console.error("Accounts already exist (backend/.accounts.txt). Pass --force to replace them; every session is then signed out.");
  process.exit(1);
}

const LETTERS = "abcdefghjkmnpqrstuvwxyz23456789";
function random(length) {
  return Array.from(randomBytes(length), (b) => LETTERS[b % LETTERS.length]).join("");
}

// Must match hashPassword() in src/lib/auth/accounts.ts.
function makeAccount(username, role, name, password) {
  const salt = randomBytes(16).toString("hex");
  return { username, role, name, salt, hash: scryptSync(password, salt, 32).toString("hex") };
}

const people = [
  { username: "tester1", role: "tester", name: "Tester 1", password: `vaani-${random(8)}` },
  { username: "tester2", role: "tester", name: "Tester 2", password: `vaani-${random(8)}` },
  { username: "judge", role: "judge", name: "Judge", password: random(16) },
];
const accounts = people.map((p) => makeAccount(p.username, p.role, p.name, p.password));

const lines = {
  AUTH_SECRET: randomBytes(48).toString("base64url"),
  // base64 so it survives the shell and the SAM command line unchanged
  AUTH_ACCOUNTS: Buffer.from(JSON.stringify(accounts)).toString("base64"),
};
let env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
for (const [key, value] of Object.entries(lines)) {
  const line = `${key}=${value}`;
  env = new RegExp(`^${key}=.*$`, "m").test(env) ? env.replace(new RegExp(`^${key}=.*$`, "m"), () => line) : `${env.replace(/\n*$/, "\n")}${line}\n`;
}
writeFileSync(envPath, env);
writeFileSync(notesPath, people.map((p) => `${p.role}\t${p.username}\t${p.password}`).join("\n") + "\n", { mode: 0o600 });

console.log("Accounts written to backend/.env (hashes only) and backend/.accounts.txt (passwords).\n");
console.log("Tester accounts (fine to put in the blog):");
for (const p of people.filter((x) => x.role === "tester")) console.log(`  ${p.username}   ${p.password}`);
console.log("\nJudge password: in backend/.accounts.txt only. Keep the /judge link and this password private.");
