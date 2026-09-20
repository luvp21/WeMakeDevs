#!/usr/bin/env node
// Creates the three fixed Cognito users: tester1, tester2 (shared, passwords go in
// the blog) and judge (no password anyone knows: the judge signs in through the
// private link, and the API gives the account a fresh random password each time).
//
//   node backend/scripts/provision-users.mjs [<user-pool-id>]
//   node backend/scripts/provision-users.mjs --add tester3 [<user-pool-id>]   (one more tester)
//   node backend/scripts/provision-users.mjs --team tester3 [<user-pool-id>]  (make an account unlimited: group "team")
//
// The pool id defaults to USER_POOL_ID in backend/.env. Safe to run again: existing
// users are kept, and tester passwords are reused from backend/.accounts.txt when
// it has them. Plain passwords are written to backend/.accounts.txt (git-ignored).
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  UsernameExistsException,
} from "@aws-sdk/client-cognito-identity-provider";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(dir, ".env");
const notesPath = path.join(dir, ".accounts.txt");

const env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const args = process.argv.slice(2);
const teamIndex = args.indexOf("--team");
const teamName = teamIndex >= 0 ? args[teamIndex + 1]?.toLowerCase() : undefined;
const addIndex = args.indexOf("--add");
const addName = addIndex >= 0 ? args[addIndex + 1]?.toLowerCase() : undefined;
if (addIndex >= 0 && !/^tester\d+$/.test(addName ?? "")) {
  console.error('--add takes a name like "tester3".');
  process.exit(1);
}
const positional = args.filter((a, i) => !a.startsWith("--") && i !== addIndex + 1 && i !== teamIndex + 1);
const poolId = positional[0] ?? /^USER_POOL_ID=(.+)$/m.exec(env)?.[1]?.trim();
if (!poolId) {
  console.error("Pass the user pool id (a stack output), or set USER_POOL_ID in backend/.env.");
  process.exit(1);
}
const region = process.env.AWS_REGION ?? /^AWS_REGION=(.+)$/m.exec(env)?.[1]?.trim() ?? "us-east-1";
const cognito = new CognitoIdentityProviderClient({ region });

// --team: an existing account becomes a team account (no allowances or length limit, own projects only).
if (teamName) {
  if (!/^tester\d+$/.test(teamName)) {
    console.error('--team takes an existing account like "tester3".');
    process.exit(1);
  }
  await cognito.send(new AdminRemoveUserFromGroupCommand({ UserPoolId: poolId, Username: teamName, GroupName: "tester" })).catch(() => undefined);
  await cognito.send(new AdminAddUserToGroupCommand({ UserPoolId: poolId, Username: teamName, GroupName: "team" }));
  console.log(`${teamName} is now a team account: no limits, sees only its own projects.`);
  process.exit(0);
}

const LETTERS = "abcdefghjkmnpqrstuvwxyz23456789";
const random = (length) => Array.from(randomBytes(length), (b) => LETTERS[b % LETTERS.length]).join("");

const notes = existsSync(notesPath) ? readFileSync(notesPath, "utf8").split("\n").filter(Boolean) : [];
const known = new Map(notes.filter((l) => l.startsWith("tester\t")).map((l) => l.split("\t").slice(1)));
const kept = notes.filter((l) => l.startsWith("judge_link\t"));

const NUMBER = (name) => Number(name.replace(/\D/g, ""));
const person = (username, group, name, password, share) => ({ username, group, name, password, share });
const defaults = [
  person("tester1", "tester", "Tester 1", known.get("tester1") ?? `vaani-${random(8)}`, true),
  person("tester2", "tester", "Tester 2", known.get("tester2") ?? `vaani-${random(8)}`, true),
  person("judge", "judge", "Judge", randomBytes(32).toString("base64url"), false),
];
// --add creates just one more tester and leaves everyone else alone.
const people = addName
  ? [person(addName, "tester", `Tester ${NUMBER(addName)}`, known.get(addName) ?? `vaani-${random(8)}`, true)]
  : defaults;

for (const p of people) {
  try {
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: poolId,
        Username: p.username,
        MessageAction: "SUPPRESS",
        UserAttributes: [{ Name: "name", Value: p.name }],
      }),
    );
  } catch (err) {
    if (!(err instanceof UsernameExistsException)) throw err;
  }
  await cognito.send(new AdminSetUserPasswordCommand({ UserPoolId: poolId, Username: p.username, Password: p.password, Permanent: true }));
  await cognito.send(new AdminAddUserToGroupCommand({ UserPoolId: poolId, Username: p.username, GroupName: p.group }));
}

const fresh = people.filter((p) => p.share).map((p) => `tester\t${p.username}\t${p.password}`);
const others = addName ? notes.filter((l) => l.startsWith("tester\t") && l.split("\t")[1] !== addName) : [];
const lines = [...others, ...fresh, ...kept];
writeFileSync(notesPath, lines.join("\n") + "\n", { mode: 0o600 });

console.log(addName ? `Added ${addName}.\n` : "Users ready in the Cognito pool.\n");
console.log("Tester accounts (fine to put in the blog):");
for (const p of people.filter((x) => x.share)) console.log(`  ${p.username}   ${p.password}`);
console.log("\nThe judge has no password: use backend/scripts/judge-link.mjs to get the private link.");
