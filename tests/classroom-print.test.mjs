import assert from "node:assert/strict";
import test from "node:test";
import {
  createPrintPreview,
  createPrintPractice,
  isPrintableQuestion,
  normalisePrintMathText,
  normalisePrintVisual,
  normalisePrintConfig,
  printPageRule,
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

test("guided print support never exposes the answer it is meant to scaffold", () => {
  const support = questionPrintSupport({
    answer: 5,
    scaffold: {
      hint: "Find one quarter first.",
      visual: {},
      steps: ["20 ÷ 4 = 5", "So the answer is 5."],
      model: { title: "Watch", display: "1/4 of 20", lines: [], answer: "5" },
    },
  }, "guided");
  assert.deepEqual(support.steps, ["20 ÷ 4 = □"]);
  assert.doesNotMatch(JSON.stringify(support), /= 5|answer is 5/i);

  const missingFraction = questionPrintSupport({
    display: "[[4/8]] = [[□/2]]",
    answer: 1,
    scaffold: {
      hint: "[[1/2]] has the same value. Connect [[1/2]] with [[4/8]].",
      visual: { kind: "relationship", left: "[[1/2]]", connector: "same value", right: "[[4/8]]" },
      steps: ["4 ÷ 4 = 1", "8 ÷ 4 = 2"],
      model: { title: "Watch", display: "[[4/8]] = [[1/2]]", lines: [], answer: "1" },
    },
  }, "guided");
  assert.equal(missingFraction.hint, "[[□/2]] has the same value. Connect [[□/2]] with [[4/8]].");
  assert.equal(missingFraction.visual, null);
  assert.deepEqual(missingFraction.steps, []);
  assert.doesNotMatch(JSON.stringify(missingFraction), /\[\[1\/2\]\]/);

  const choice = questionPrintSupport({
    type: "choice",
    display: "Which fraction is equivalent to [[2/3]]?",
    answer: "[[6/9]]",
    promptVisual: { kind: "fraction-strip", denominator: 3, numerator: 2 },
    scaffold: {
      hint: "Multiply the numerator and denominator by the same number.",
      visual: { kind: "relationship", left: "[[2/3]]", connector: "same value", right: "[[6/9]]" },
      steps: ["2 × 3 = 6", "3 × 3 = 9"],
      model: { title: "Watch", display: "[[2/3]] = [[6/9]]", lines: [], answer: "[[6/9]]" },
    },
  }, "guided");
  assert.deepEqual(choice.steps, []);
  assert.deepEqual(choice.visual, { kind: "fraction-strip", denominator: 3, numerator: 2 });
  assert.doesNotMatch(JSON.stringify(choice), /6\/9|2 × 3 = 6|3 × 3 = 9/);
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

test("teacher print preview preserves every multiple-choice option", () => {
  const pack = createPrintPractice({
    seed: "print-choice-missing-0",
    seedMode: "same",
    challengeMin: 60,
    challengeMax: 60,
    count: 30,
    focus: "fractions",
    support: "guided",
  });
  const preview = createPrintPreview(pack);
  const choiceItems = pack.questions.filter((question) => question.type === "choice");
  assert.ok(choiceItems.length >= 1, "the deterministic corpus must contain a choice item");
  for (const source of choiceItems) {
    const rendered = preview.questions.find((question) => question.number === source.number);
    assert.deepEqual(rendered?.choices, source.choices);
    assert.ok(rendered?.choices?.includes(String(source.answer)));
  }
});

test("print support keeps consecutive working steps visibly separated", () => {
  const preview = createPrintPreview({
    config: { title: "Working" },
    questions: [{
      number: 1,
      display: "4/5 of 35",
      answer: 28,
      support: {
        kind: "guided",
        hint: "Find 1/5 first.",
        steps: ["35 ÷ 5 = 7", "7 × 4 = □"],
      },
    }],
  });
  assert.equal(preview.questions[0].support, "Find 1/5 first. 35 ÷ 5 = 7\u2060. 7 × 4 = □\u2060.");
});

test("print orientation produces a real A4 page rule", () => {
  assert.match(printPageRule({ orientation: "portrait" }), /size:\s*A4 portrait/);
  assert.match(printPageRule({ orientation: "landscape" }), /size:\s*A4 landscape/);
});

test("print maths preserves fractions while typesetting missing values", () => {
  assert.equal(normalisePrintMathText("1/2 = □/8"), "[[1/2]] = [[□/8]]");
  assert.equal(normalisePrintMathText("[[3/4]] of 20"), "[[3/4]] of 20");
  assert.equal(normalisePrintMathText("Connect 3/5 with [[12/20]]."), "Connect [[3/5]] with [[12/20]].");
});

test("print visuals conceal unknown markers and never fabricate schema defaults", () => {
  const line = normalisePrintVisual({ kind: "number-line", min: 2500, max: 3000, markers: [2750], unknown: 0, ticks: 5 });
  assert.deepEqual(line?.markers, [2750]);
  assert.equal(line?.unknown, 0);

  const groups = normalisePrintVisual({ kind: "groups", total: 80, groupSize: 8 });
  assert.deepEqual(groups, { kind: "groups", title: "Mathematical model", groups: 10, perGroup: 8, total: 80 });
  assert.equal(normalisePrintVisual({ kind: "groups", total: 80 }), null, "missing group size must not become four invented groups");

  const rectangle = normalisePrintVisual({ kind: "multiplication-rectangle", factor: 6, parts: [10, 9] });
  assert.deepEqual(rectangle?.parts, [10, 9]);
  assert.equal(rectangle?.factor, 6);

  const placeValue = normalisePrintVisual({ kind: "place-value", rows: [[0, 1, 0, 0], [0, 0, 8, 0]], operator: "+" });
  assert.deepEqual(placeValue?.rows, [[0, 1, 0, 0], [0, 0, 8, 0]]);
  assert.equal(placeValue?.operator, "+");
});

test("every supported visual family has a conservative printable view model", () => {
  const cases = [
    { kind: "ten-frame", filled: 8, total: 20 },
    { kind: "part-whole", whole: 20, parts: [12, 8] },
    { kind: "relationship", left: "8 × 10", connector: "makes", right: "80" },
    { kind: "hundred-grid", filled: 37 },
    { kind: "worked-example", lines: ["20 ÷ 4 = 5", "5 × 3 = 15"], errorLine: -1 },
    { kind: "partition", parts: [10, 9], multiplier: 6 },
    { kind: "base-ten", value: 3050 },
  ];
  for (const visual of cases) assert.ok(normalisePrintVisual(visual), `${visual.kind} should be printable`);
});
