import { test } from "node:test";
import assert from "node:assert/strict";
import { DAILY_RENDER_CAP, enforceDailyRenderCap, enforceRate, memoryRateStore, type RateStore } from "./rateLimit.js";
import { HttpError } from "./http.js";

const T0 = Date.parse("2026-09-20T10:00:10Z"); // 10 seconds into a minute
const tooMany = (e: unknown) => e instanceof HttpError && e.status === 429;

test("an account gets its allowance per minute, then a 429 that says how long to wait", async () => {
  const store = memoryRateStore();
  for (let i = 0; i < 30; i++) await enforceRate("tester1", "heavy", "tester", store, T0);
  await assert.rejects(() => enforceRate("tester1", "heavy", "tester", store, T0), (e: unknown) => {
    assert.ok(tooMany(e));
    assert.match((e as HttpError).message, /wait 50 seconds/);
    return true;
  });
});

test("the next minute starts fresh", async () => {
  const store = memoryRateStore();
  for (let i = 0; i < 30; i++) await enforceRate("tester1", "heavy", "tester", store, T0);
  await assert.doesNotReject(() => enforceRate("tester1", "heavy", "tester", store, T0 + 60_000));
});

test("accounts are limited separately, and heavy and normal calls are counted separately", async () => {
  const store = memoryRateStore();
  for (let i = 0; i < 30; i++) await enforceRate("tester1", "heavy", "tester", store, T0);
  await assert.doesNotReject(() => enforceRate("tester2", "heavy", "tester", store, T0), "another account is unaffected");
  await assert.doesNotReject(() => enforceRate("tester1", "normal", "tester", store, T0), "ordinary calls have their own allowance");
});

test("ordinary calls allow far more than expensive ones (status polling must not trip it)", async () => {
  const store = memoryRateStore();
  for (let i = 0; i < 120; i++) await enforceRate("tester1", "normal", "tester", store, T0);
  await assert.rejects(() => enforceRate("tester1", "normal", "tester", store, T0), tooMany);
});

test("the judge has five times the room, but is still limited", async () => {
  const store = memoryRateStore();
  for (let i = 0; i < 150; i++) await enforceRate("judge", "heavy", "judge", store, T0);
  await assert.rejects(() => enforceRate("judge", "heavy", "judge", store, T0), tooMany);
});

test("sign-in attempts are limited per IP address", async () => {
  const store = memoryRateStore();
  for (let i = 0; i < 10; i++) await enforceRate("203.0.113.9", "login", null, store, T0);
  await assert.rejects(() => enforceRate("203.0.113.9", "login", null, store, T0), tooMany);
  await assert.doesNotReject(() => enforceRate("198.51.100.4", "login", null, store, T0), "another address is unaffected");
});

test("if the counter is unavailable the call goes through instead of breaking the app", async () => {
  const broken: RateStore = { increment: async () => Promise.reject(new Error("DynamoDB is down")) };
  const log = console.error;
  console.error = () => undefined;
  try {
    await assert.doesNotReject(() => enforceRate("tester1", "heavy", "tester", broken, T0));
    await assert.doesNotReject(() => enforceDailyRenderCap(broken, T0));
  } finally {
    console.error = log;
  }
});

test("the daily render cap covers everyone together and resets the next day", async () => {
  const store = memoryRateStore();
  for (let i = 0; i < DAILY_RENDER_CAP; i++) await enforceDailyRenderCap(store, T0);
  await assert.rejects(() => enforceDailyRenderCap(store, T0), (e: unknown) => tooMany(e) && /today/.test((e as HttpError).message));
  await assert.doesNotReject(() => enforceDailyRenderCap(store, T0 + 24 * 3600 * 1000));
});

test("a team account gets the same extra room as the judge, and is still limited", async () => {
  const store = memoryRateStore();
  for (let i = 0; i < 150; i++) await enforceRate("tester3", "heavy", "team", store, T0);
  await assert.rejects(() => enforceRate("tester3", "heavy", "team", store, T0), tooMany);
});
