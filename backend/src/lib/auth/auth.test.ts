import { test, before } from "node:test";
import assert from "node:assert/strict";
import { signToken, verifyToken } from "./token.js";
import { checkLogin, encodeAccounts, hashPassword, loadAccounts, makeAccount } from "./accounts.js";
import { consume, memoryStore, refund, getUsage } from "./quota.js";
import { checkJudgeLinkKey, judgeLinkKey } from "./judgeLink.js";
import { authenticate, canAccess, HttpError, requireJudge } from "./access.js";

before(() => {
  process.env.AUTH_SECRET = "test-secret-that-is-long-enough-for-hmac-signing";
});

const NOW = Date.parse("2026-09-20T10:00:00Z");
const soon = Math.floor(NOW / 1000) + 3600;
const payload = { sub: "tester1", role: "tester" as const, name: "Tester 1", exp: soon };

test("a token signed by us verifies and returns who it is for", () => {
  assert.deepEqual(verifyToken(signToken(payload), NOW), payload);
});

test("an expired token, a tampered token and garbage are all rejected", () => {
  assert.equal(verifyToken(signToken({ ...payload, exp: Math.floor(NOW / 1000) - 1 }), NOW), null);
  const [body, sig] = signToken(payload).split(".");
  const forged = Buffer.from(JSON.stringify({ ...payload, role: "judge" })).toString("base64url");
  assert.equal(verifyToken(`${forged}.${sig}`, NOW), null, "changing the role must break the signature");
  assert.equal(verifyToken(`${body}.AAAA`, NOW), null);
  for (const junk of ["", "abc", "a.b.c", "."]) assert.equal(verifyToken(junk, NOW), null);
});

test("a token signed with a different secret is rejected", () => {
  const token = signToken(payload);
  process.env.AUTH_SECRET = "a-completely-different-secret-of-sufficient-length";
  assert.equal(verifyToken(token, NOW), null);
  process.env.AUTH_SECRET = "test-secret-that-is-long-enough-for-hmac-signing";
});

test("a short or missing secret is refused rather than used", () => {
  process.env.AUTH_SECRET = "short";
  assert.throws(() => signToken(payload), /at least 32/);
  process.env.AUTH_SECRET = "test-secret-that-is-long-enough-for-hmac-signing";
});

const accounts = [
  makeAccount("tester1", "tester", "Tester 1", "correct horse"),
  makeAccount("judge", "judge", "Judge", "another secret"),
];

test("login works with the right password, case-insensitive username, and fails otherwise", () => {
  assert.equal(checkLogin("tester1", "correct horse", accounts)?.role, "tester");
  assert.equal(checkLogin("  Judge ", "another secret", accounts)?.role, "judge");
  assert.equal(checkLogin("tester1", "wrong", accounts), null);
  assert.equal(checkLogin("nobody", "correct horse", accounts), null);
  assert.equal(checkLogin("tester1", "another secret", accounts), null, "one account's password must not open another");
});

test("only a salted hash is stored, never the password", () => {
  const account = accounts[0];
  assert.ok(!JSON.stringify(account).includes("correct horse"));
  assert.equal(account.hash, hashPassword("correct horse", account.salt));
  assert.notEqual(makeAccount("a", "tester", "A", "same").hash, makeAccount("b", "tester", "B", "same").hash);
});

test("a tester gets exactly one render, and a refund gives it back", async () => {
  const store = memoryStore();
  assert.deepEqual(await consume("tester1", "tester", "renders", store), { ok: true });
  const second = await consume("tester1", "tester", "renders", store);
  assert.equal(second.ok, false);
  assert.match((second as { message: string }).message, /already made its one video/);
  await refund("tester1", "tester", "renders", store);
  assert.deepEqual(await consume("tester1", "tester", "renders", store), { ok: true });
});

test("simultaneous requests can't both take the last render", async () => {
  const store = memoryStore();
  const results = await Promise.all(Array.from({ length: 10 }, () => consume("tester1", "tester", "renders", store)));
  assert.equal(results.filter((r) => r.ok).length, 1);
});

test("drafts and locks have their own limits, accounts are separate, and the judge has none", async () => {
  const store = memoryStore();
  for (let i = 0; i < 5; i++) assert.equal((await consume("tester1", "tester", "drafts", store)).ok, true);
  assert.equal((await consume("tester1", "tester", "drafts", store)).ok, false);
  assert.equal((await consume("tester1", "tester", "locks", store)).ok, true, "a spent draft budget doesn't block locking");
  assert.equal((await consume("tester2", "tester", "drafts", store)).ok, true, "one account's use doesn't count against another");
  for (let i = 0; i < 20; i++) assert.equal((await consume("judge", "judge", "renders", store)).ok, true);
  assert.deepEqual(await getUsage("judge", store), { drafts: 0, locks: 0, renders: 0 }, "the judge is never counted");
});

test("a refund never goes below zero", async () => {
  const store = memoryStore();
  await refund("tester1", "tester", "drafts", store);
  assert.equal((await getUsage("tester1", store)).drafts, 0);
});

test("authenticate needs a valid Bearer token", () => {
  const token = signToken({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 });
  assert.equal(authenticate(`Bearer ${token}`).username, "tester1");
  for (const bad of [undefined, "", "Bearer", `Token ${token}`, "Bearer nonsense"]) {
    assert.throws(() => authenticate(bad), (e: unknown) => e instanceof HttpError && e.status === 401);
  }
});

test("a tester can only reach their own projects; the judge reaches all, including ownerless ones", () => {
  const tester = { username: "tester1", role: "tester" as const, name: "T" };
  const judge = { username: "judge", role: "judge" as const, name: "J" };
  assert.equal(canAccess(tester, "tester1"), true);
  assert.equal(canAccess(tester, "tester2"), false);
  assert.equal(canAccess(tester, undefined), false, "older projects have no owner and are the judge's alone");
  assert.equal(canAccess(judge, "tester2"), true);
  assert.equal(canAccess(judge, undefined), true);
  assert.throws(() => requireJudge(tester), (e: unknown) => e instanceof HttpError && e.status === 403);
  assert.doesNotThrow(() => requireJudge(judge));
});

test("accounts load from base64 (the deployed form) and from plain JSON", () => {
  const list = [makeAccount("tester1", "tester", "Tester 1", "pw-one")];
  assert.deepEqual(loadAccounts(encodeAccounts(list)), list);
  assert.deepEqual(loadAccounts(JSON.stringify(list)), list);
  assert.throws(() => loadAccounts(""), /not set/);
  assert.throws(() => loadAccounts("not json or base64 json"));
});

test("the judge link key is long, stable, and only the exact key opens it", () => {
  const key = judgeLinkKey();
  assert.ok(key.length >= 40, "long enough that it can't be guessed");
  assert.equal(key, judgeLinkKey(), "the same secret always gives the same link");
  assert.equal(checkJudgeLinkKey(key), true);
  for (const wrong of ["", "short", key.slice(0, -1), key + "x", key.toUpperCase(), "a".repeat(key.length)]) {
    assert.equal(checkJudgeLinkKey(wrong), false, wrong);
  }
});

test("changing the secret changes the judge link, so the old link stops working", () => {
  const before = judgeLinkKey();
  process.env.AUTH_SECRET = "a-completely-different-secret-of-sufficient-length";
  assert.notEqual(judgeLinkKey(), before);
  assert.equal(checkJudgeLinkKey(before), false);
  process.env.AUTH_SECRET = "test-secret-that-is-long-enough-for-hmac-signing";
});
