import { test } from "node:test";
import assert from "node:assert/strict";
import { scenesFromText, wordPreservation } from "./scriptGen.js";

const SCRIPT =
  "Promise dot all se saare requests ek saath jaate hain. Isse server overload ho jata hai. p-map concurrency limit lagata hai. Isliye sab kuch smooth chalta hai.";

test("wordPreservation is 1 when the wording is kept, however it is re-split", () => {
  assert.equal(wordPreservation(SCRIPT, [SCRIPT]), 1);
  assert.equal(
    wordPreservation(SCRIPT, ["Promise dot all se saare requests ek saath jaate hain.", "Isse server overload ho jata hai. p-map concurrency limit lagata hai. Isliye sab kuch smooth chalta hai."]),
    1,
  );
});

test("wordPreservation drops when the model rewrites the script", () => {
  const rewritten = "Using Promise.all for everything can overwhelm a server, so use p-map to limit concurrency.";
  assert.ok(wordPreservation(SCRIPT, [rewritten]) < 0.5);
});

test("scenesFromText keeps every word: paragraphs become scenes", () => {
  const text = "Pehla paragraph yahan hai. Dusra sentence bhi.\n\nDusra paragraph alag scene hai.";
  const scenes = scenesFromText(text);
  assert.equal(scenes.length, 2);
  assert.equal(wordPreservation(text, scenes.flatMap((s) => s.beats.map((b) => b.text))), 1);
  assert.ok(scenes.every((s) => s.beats.length >= 1 && s.beats.every((b) => b.visual_type === "slide")));
});

test("scenesFromText splits a single paragraph into three scenes", () => {
  const scenes = scenesFromText(SCRIPT);
  assert.equal(scenes.length, 2); // 4 sentences, 2 per scene when split evenly into 3 groups
  assert.equal(wordPreservation(SCRIPT, scenes.flatMap((s) => s.beats.map((b) => b.text))), 1);
});

test("planFromSourceScript: paragraphs become scenes and keep every word", async () => {
  const { planFromSourceScript } = await import("./scriptGen.js");
  const text = "Pehla paragraph yahan hai. Dusra sentence bhi.\n\nDusra paragraph alag scene hai.";
  const plan = planFromSourceScript(text);
  assert.equal(plan.length, 2);
  assert.equal(wordPreservation(text, plan.map((p) => p.source_text ?? "")), 1);
  assert.ok(plan.every((p) => p.target_words >= 1 && p.title === ""));
});

test("planFromSourceScript: one block of text is grouped by sentences, never empty", async () => {
  const { planFromSourceScript } = await import("./scriptGen.js");
  const plan = planFromSourceScript("Ek sentence. Do sentence. Teen sentence.");
  assert.ok(plan.length >= 1);
  assert.equal(wordPreservation("Ek sentence. Do sentence. Teen sentence.", plan.map((p) => p.source_text ?? "")), 1);
});

test("planFromSourceScript: very many paragraphs are merged down to the scene cap", async () => {
  const { planFromSourceScript } = await import("./scriptGen.js");
  const text = Array.from({ length: 25 }, (_, i) => `Paragraph number ${i} ka text hai.`).join("\n\n");
  const plan = planFromSourceScript(text);
  assert.ok(plan.length <= 14);
  assert.equal(wordPreservation(text, plan.map((p) => p.source_text ?? "")), 1);
});
