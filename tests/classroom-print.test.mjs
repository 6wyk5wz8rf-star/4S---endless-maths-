import assert from "node:assert/strict";
import test from "node:test";
import {
  createPrintPractice,
  isPrintableQuestion,
  normalisePrintConfig,
  questionPrintSupport,
} from "../lib/classroom-print.mjs";

test("print configuration stays within classroom-safe options", () => {
  const config = normalisePrintConfig({ challengeMin: 80, challengeMax: 40, count: 999, orientation: "sideways", support: "unknown" });
  assert.deepEqual([config.challengeMin, config.challengeMax], [40, 80]);
  assert.equal(config.count, 10);
  assert.equal(config.orientation, "portrait");
  assert.equal(config.support, "independent");
});

test("digital interactions are never printed as broken instructions", () => {
  assert.equal(isPrintableQuestion({ instruction: "Drag the marker", display: "0 — 1" }), false);
});

test("seeded printable practice is reproducible, valid and answer aligned", () => {
  const config = { seed: "print-certification", challengeMin: 48, challengeMax: 62, count: 30, support: "guided", focus: "fractions" };
  const first = createPrintPractice(config);
  const second = createPrintPractice(config);
  assert.deepEqual(first.questions.map((item) => [item.display, item.answer]), second.questions.map((item) => [item.display, item.answer]));
  assert.equal(first.questions.length, 30);
  assert.equal(first.answers.length, 30);
  assert.ok(first.questions.every((item, index) => item.number === index + 1 && item.answer === first.answers[index].answer));
  assert.ok(first.questions.every((item) => item.strand === "fractions"));
  assert.ok(first.questions.every((item) => item.support?.kind === "guided"));
  assert.ok(first.questions.every((item) => !/drag|swipe/i.test(`${item.instruction} ${item.display}`)));
});

test("support changes the printable structure without changing challenge", () => {
  const base = createPrintPractice({ seed: "support-print", challengeMin: 70, challengeMax: 78, count: 5, support: "independent" });
  const modelled = createPrintPractice({ seed: "support-print", challengeMin: 70, challengeMax: 78, count: 5, support: "modelled" });
  assert.deepEqual(base.questions.map((item) => item.display), modelled.questions.map((item) => item.display));
  assert.ok(base.questions.every((item) => item.support === null));
  assert.ok(modelled.questions.every((item) => item.support?.kind === "model"));
  assert.equal(questionPrintSupport({ scaffold: { hint: "Think", visual: {}, steps: [], model: { title: "Watch", display: "1 + 1", lines: [], answer: "2" } } }, "available").kind, "prompt");
});

test("fixed challenge print packs work at both ends of the continuum", () => {
  for (const challenge of [0, 100]) {
    const pack = createPrintPractice({ challengeMin: challenge, challengeMax: challenge, count: 10, seed: `fixed-${challenge}` });
    assert.equal(pack.questions.length, 10);
    assert.ok(pack.questions.every((question) => Math.abs(question.difficulty - challenge) <= 18));
  }
});

test("teacher subskills and representation frequency shape printable practice", () => {
  const base = {
    seed: "teacher-print-options",
    seedMode: "same",
    challengeMin: 48,
    challengeMax: 68,
    count: 10,
    support: "guided",
    mode: "focus",
    focus: "multiplication",
    subskills: ["Derived facts"],
  };
  const occasional = createPrintPractice({ ...base, representationFrequency: 0 });
  const frequent = createPrintPractice({ ...base, representationFrequency: 1 });
  assert.deepEqual(
    occasional.questions.map((item) => [item.family, item.display, item.answer]),
    frequent.questions.map((item) => [item.family, item.display, item.answer]),
    "representation frequency should not perturb a reproducible sequence",
  );
  assert.ok(frequent.questions.every((item) => item.family === "derived-multiplication-facts"));
  assert.ok(occasional.questions.every((item) => item.support?.kind === "guided" && item.support.visual === null));
  assert.ok(frequent.questions.every((item) => item.support?.kind === "guided" && item.support.visual));
});
