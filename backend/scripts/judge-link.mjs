#!/usr/bin/env node
// Builds the private judge link from AUTH_SECRET in backend/.env.
//
//   node backend/scripts/judge-link.mjs <site-url> [--save]
//
// Without --save the link is printed (it is a credential: anyone who has it is
// the judge). With --save it is written to backend/.accounts.txt instead and
// nothing sensitive is printed. Must match judgeLinkKey() in src/lib/auth/judgeLink.ts.
import { createHmac } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = process.argv[2]?.replace(/\/$/, "");
if (!site || !site.startsWith("http")) {
  console.error("Usage: node backend/scripts/judge-link.mjs https://your-site [--save]");
  process.exit(1);
}
const env = readFileSync(path.join(dir, ".env"), "utf8");
const secret = /^AUTH_SECRET=(.+)$/m.exec(env)?.[1]?.trim();
if (!secret || secret.length < 32) {
  console.error("AUTH_SECRET is missing from backend/.env. Run make-accounts.mjs first.");
  process.exit(1);
}
const key = createHmac("sha256", secret).update("vaani/judge-link/v1").digest("base64url");
const link = `${site}/j/${key}`;

if (process.argv.includes("--save")) {
  const notes = path.join(dir, ".accounts.txt");
  const kept = (existsSync(notes) ? readFileSync(notes, "utf8") : "").split("\n").filter((l) => l && !l.startsWith("judge_link\t"));
  writeFileSync(notes, [...kept, `judge_link\t${link}`].join("\n") + "\n", { mode: 0o600 });
  console.log("Judge link saved to backend/.accounts.txt (line starting with judge_link). Not printed.");
} else {
  console.log(link);
}
