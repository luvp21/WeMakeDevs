import { test } from "node:test";
import assert from "node:assert/strict";
import type { RenderStatus } from "@vaani/shared";
import { handleRenderFailure, type FailureDeps } from "./failure.js";

const ID = "proj-1";
const NOW = new Date("2026-09-20T10:00:00Z");

function fakes(current: RenderStatus) {
  const calls = { set: [] as RenderStatus[], refunds: [] as string[], alerts: [] as { subject: string; message: string }[] };
  const deps: FailureDeps = {
    getStatus: async () => current,
    setStatus: async (s) => void calls.set.push(s),
    refund: async (owner) => void calls.refunds.push(owner),
    notify: async (subject, message) => void calls.alerts.push({ subject, message }),
  };
  return { deps, calls };
}

const status = (s: RenderStatus["status"], error?: string): RenderStatus => ({
  script_id: ID,
  status: s,
  updated_at: "2026-09-20T09:59:00Z",
  ...(error ? { error } : {}),
});

test("a render stuck on 'running' is marked failed, the tester gets their render back, and an alert goes out", async () => {
  const { deps, calls } = fakes(status("running"));
  const result = await handleRenderFailure(deps, { script_id: ID, owner: "tester1", role: "tester", error: { Cause: "OOM" } }, () => NOW);
  assert.equal(result.refunded, true);
  assert.equal(calls.set.length, 1);
  assert.equal(calls.set[0].status, "error");
  assert.match(calls.set[0].error ?? "", /stopped before it finished\. It didn't use up your one video/);
  assert.deepEqual(calls.refunds, ["tester1"]);
  assert.equal(calls.alerts.length, 1);
  assert.match(calls.alerts[0].message, /tester1 \(render given back\)/);
  assert.match(calls.alerts[0].message, /OOM/);
});

test("when the worker already wrote its own error, that message is kept", async () => {
  const { deps, calls } = fakes(status("error", "Scene scene-2 missing from sync result"));
  await handleRenderFailure(deps, { script_id: ID, owner: "tester1", role: "tester" }, () => NOW);
  // The worker's own message is kept, with the refund note added for a tester.
  assert.equal(calls.set[0].error, "Scene scene-2 missing from sync result. It didn't use up your one video, so you can try again.");
  const judge = fakes(status("error", "Scene scene-2 missing from sync result"));
  await handleRenderFailure(judge.deps, { script_id: ID, owner: "judge", role: "judge" }, () => NOW);
  assert.equal(judge.calls.set.length, 0, "with nothing to give back, the worker's error is left exactly as it is");
  assert.match(calls.alerts[0].message, /Scene scene-2 missing from sync result/);
});

test("the judge has nothing to give back, but the failure is still recorded and alerted", async () => {
  const { deps, calls } = fakes(status("running"));
  const result = await handleRenderFailure(deps, { script_id: ID, owner: "judge", role: "judge" }, () => NOW);
  assert.equal(result.refunded, false);
  assert.deepEqual(calls.refunds, []);
  assert.equal(calls.set.length, 1);
  assert.equal(calls.alerts.length, 1);
});

test("a render that actually finished is left alone: no refund, no alert", async () => {
  const { deps, calls } = fakes(status("done"));
  const result = await handleRenderFailure(deps, { script_id: ID, owner: "tester1", role: "tester" }, () => NOW);
  assert.equal(result.refunded, false);
  assert.deepEqual([calls.set.length, calls.refunds.length, calls.alerts.length], [0, 0, 0]);
});

test("a very long failure cause is cut down so the alert stays readable", async () => {
  const { deps, calls } = fakes(status("running"));
  await handleRenderFailure(deps, { script_id: ID, owner: "judge", role: "judge", error: { Cause: "x".repeat(5000) } }, () => NOW);
  assert.ok(calls.alerts[0].message.length < 900);
});

test("a team account has no allowance, so a failed render gives nothing back", async () => {
  const { deps, calls } = fakes(status("running"));
  const result = await handleRenderFailure(deps, { script_id: ID, owner: "tester3", role: "team" }, () => NOW);
  assert.equal(result.refunded, false);
  assert.deepEqual(calls.refunds, []);
  assert.equal(calls.set.length, 1, "the failure is still recorded");
});
