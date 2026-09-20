import { test } from "node:test";
import assert from "node:assert/strict";
import { githubFailureMessage } from "./ingest.js";

const headers = (values: Record<string, string>) => (name: string) => values[name.toLowerCase()] ?? null;
const NOW = Date.parse("2026-09-20T10:00:00Z");

test("a used-up rate limit says when it resets, not just 403", () => {
  const reset = String(Math.floor((NOW + 17 * 60 * 1000) / 1000));
  const message = githubFailureMessage(403, headers({ "x-ratelimit-remaining": "0", "x-ratelimit-reset": reset }), "vercel/ms", NOW);
  assert.match(message, /hourly request limit/);
  assert.match(message, /about 17 minutes/);
});

test("a 429 is treated as a rate limit too, and a missing reset time still gives advice", () => {
  const message = githubFailureMessage(429, headers({}), "vercel/ms", NOW);
  assert.match(message, /hourly request limit/);
  assert.match(message, /Try again in a little while/);
});

test("a 403 that is not a rate limit is reported as an error, not a limit", () => {
  const message = githubFailureMessage(403, headers({ "x-ratelimit-remaining": "42" }), "vercel/ms", NOW);
  assert.doesNotMatch(message, /hourly request limit/);
  assert.match(message, /\(403\)/);
});

test("a missing repository says to check the URL and that it's public", () => {
  const message = githubFailureMessage(404, headers({}), "someone/nothing", NOW);
  assert.match(message, /Couldn't find someone\/nothing/);
  assert.match(message, /public/);
});
