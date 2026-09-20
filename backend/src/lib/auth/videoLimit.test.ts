import { test } from "node:test";
import assert from "node:assert/strict";
import type { Auth } from "./access.js";
import { HttpError } from "./http.js";
import { checkLockedScript, checkOwnScript, limitedMinutes, maxRecordingMs, maxScriptWords, totalSpeechMs } from "./videoLimit.js";

const tester: Auth = { username: "tester1", role: "tester", name: "T" };
const judge: Auth = { username: "judge", role: "judge", name: "J" };
const team: Auth = { username: "tester3", role: "team", name: "T" };
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const refused = (e: unknown) => e instanceof HttpError && e.status === 400;

const ingest = { repo_url: "https://github.com/a/b", readme: null, package_files: [], sample_files: [] };
const lockBody = (text: string) => ({
  ingest,
  script: {
    repo_url: "https://github.com/a/b",
    user_context: "",
    format: "hackathon_demo",
    language: "en",
    scenes: [{ id: "scene-1", title: "One", beats: [{ id: "beat-1", text, visual_type: "slide", visual_spec: { visual_type: "slide", html: "<h1>x</h1>" } }] }],
  },
});

test("the limits are 3 minutes of speech with a little slack", () => {
  assert.equal(maxScriptWords(), 446, "405 words is 3 minutes at 135 a minute, plus 10%");
  assert.equal(maxRecordingMs(), 225_000, "3 minutes plus 25% for how people really speak");
});

test("a non-judge's target length is capped at 3 minutes; the judge's is not", () => {
  assert.equal(limitedMinutes("tester", 5, 2), 3);
  assert.equal(limitedMinutes("tester", 1, 2), 1);
  assert.equal(limitedMinutes("tester", undefined, 2), 2, "the format's default when nothing was asked for");
  assert.equal(limitedMinutes("tester", undefined, 5), 3);
  assert.equal(limitedMinutes("judge", 5, 2), 5);
  assert.equal(limitedMinutes("judge", undefined, 2), undefined);
});

test("a pasted script over 3 minutes is refused before anything is generated", async () => {
  const draft = (source_script: string) => ({ ingest, format: "hackathon_demo", language: "en", source_script });
  await assert.doesNotReject(() => checkOwnScript(tester, { body: draft(words(400)) }));
  await assert.rejects(() => checkOwnScript(tester, { body: draft(words(600)) }), (e: unknown) => refused(e) && /limit is 3 minutes/.test((e as HttpError).message));
  await assert.doesNotReject(() => checkOwnScript(judge, { body: draft(words(600)) }), "the judge is not limited");
  await assert.doesNotReject(() => checkOwnScript(tester, { body: { ingest } }), "no pasted script, nothing to check");
});

test("a script edited to be too long is refused at lock, and a fitting one is fine", async () => {
  await assert.doesNotReject(() => checkLockedScript(tester, { body: lockBody(words(400)) }));
  await assert.rejects(() => checkLockedScript(tester, { body: lockBody(words(700)) }), (e: unknown) => refused(e) && /shorten it before locking/.test((e as HttpError).message));
  await assert.doesNotReject(() => checkLockedScript(judge, { body: lockBody(words(700)) }));
});

test("recording length comes from the sync result, or from the AI narration on the fallback path", () => {
  const scene = (id: string, duration_ms?: number) => ({ scene_id: id, checkpoints: [], duration_ms });
  assert.equal(totalSpeechMs({ script_id: "s", scenes: [scene("a", 60_000), scene("b", 90_000)] }, null), 150_000);
  assert.equal(totalSpeechMs({ script_id: "s", scenes: [scene("a", 60_000), scene("b")] }, null), null, "an older result with no durations can't be checked");
  const narration = { script_id: "s", scenes: [{ scene_id: "a", audio_url: "", duration_ms: 100_000, beats: [] }] };
  assert.equal(totalSpeechMs(null, narration), 100_000);
  assert.equal(totalSpeechMs(null, null), null);
});

test("a team account has no length limit anywhere, like the judge", async () => {
  assert.equal(limitedMinutes("team", 5, 2), 5);
  await assert.doesNotReject(() => checkOwnScript(team, { body: { ingest, format: "hackathon_demo", language: "en", source_script: words(900) } }));
  await assert.doesNotReject(() => checkLockedScript(team, { body: lockBody(words(900)) }));
});
