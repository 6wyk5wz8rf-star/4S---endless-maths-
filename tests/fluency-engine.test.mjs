import assert from "node:assert/strict";
import test from "node:test";
import {
  CHALLENGE_ANCHORS,
  FluencyEngine,
  QUESTION_FAMILIES,
  adaptiveSupport,
  evaluateAnswer,
  generatorCatalogue,
  supportBand,
  validateQuestion,
} from "../lib/fluency-engine.mjs";

const AUDIT_POINTS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

test("the catalogue is broad, modular and centred on Year 4", () => {
  const catalogue = generatorCatalogue();
  assert.ok(catalogue.length >= 40);
  const strands = new Set(catalogue.map((family) => family.strand));
  for (const strand of ["addition", "subtraction", "multiplication", "division", "fractions", "decimals", "place value", "mixed"]) {
    assert.ok(strands.has(strand), `missing ${strand}`);
  }
  assert.ok(catalogue.filter((family) => family.max >= 40 && family.min <= 75).length >= 20);
  assert.deepEqual(CHALLENGE_ANCHORS.map((anchor) => anchor.value), [0, 25, 52, 76, 100]);
});

test("seeded sessions are exactly reproducible", () => {
  const first = new FluencyEngine({ seed: "same-seed", challenge: 61 });
  const second = new FluencyEngine({ seed: "same-seed", challenge: 61 });
  for (let index = 0; index < 120; index += 1) {
    const left = first.next();
    const right = second.next();
    assert.deepEqual(
      { family: left.family, display: left.display, answer: left.answer, difficulty: left.difficulty },
      { family: right.family, display: right.display, answer: right.answer, difficulty: right.difficulty },
    );
  }
});

test("recent question history carries safely into a new session", () => {
  const first = new FluencyEngine({ seed: "history-first", challenge: 55 });
  for (let index = 0; index < 40; index += 1) first.next();
  const history = first.getHistory();
  assert.equal(history.length, 24);

  const second = new FluencyEngine({ seed: "history-second", challenge: 55, recentSignatures: history });
  for (let index = 0; index < 24; index += 1) {
    const item = second.next();
    const signature = `${item.family}:${item.display}:${item.answer}`;
    assert.equal(history.includes(signature), false);
  }
});

test("2,200 audited questions remain valid, close to challenge and non-repeating", () => {
  for (const challenge of AUDIT_POINTS) {
    const engine = new FluencyEngine({ seed: `continuum-${challenge}`, challenge });
    const recent = [];
    for (let index = 0; index < 200; index += 1) {
      const item = engine.next();
      const result = validateQuestion(item);
      assert.equal(result.valid, true, `${challenge}: ${result.issues.join(", ")}`);
      assert.ok(Math.abs(item.difficulty - challenge) <= 18, `${challenge}: ${item.difficulty} drifted too far`);
      const signature = `${item.family}:${item.display}:${item.answer}`;
      assert.equal(recent.includes(signature), false, `${challenge}: repeated ${signature}`);
      recent.push(signature);
      if (recent.length > 24) recent.shift();
      assert.equal(evaluateAnswer(item, item.answer).correct, true);
      if (item.type === "choice") {
        const wrong = item.choices.find((choice) => String(choice) !== String(item.answer));
        if (wrong !== undefined) assert.equal(evaluateAnswer(item, wrong).correct, false);
      }
      if (challenge <= 40 && item.type === "numeric" && item.answerType !== "fraction") {
        assert.ok(Number(String(item.answer).replaceAll(",", "")) >= 0, `${challenge}: unexpected negative answer`);
      }
    }
  }
});

test("mean complexity rises steadily across the continuum", () => {
  const means = AUDIT_POINTS.map((challenge) => {
    const engine = new FluencyEngine({ seed: `mean-${challenge}`, challenge });
    const difficulties = Array.from({ length: 300 }, () => engine.next().difficulty);
    return difficulties.reduce((sum, value) => sum + value, 0) / difficulties.length;
  });
  for (let index = 1; index < means.length; index += 1) {
    assert.ok(means[index] > means[index - 1], `${means[index]} did not exceed ${means[index - 1]}`);
  }
  assert.ok(means[0] < 15);
  assert.ok(means.at(-1) > 86);
});

test("tables focus stays with multiplication and related division", () => {
  const engine = new FluencyEngine({ seed: "tables-only", challenge: 48, focus: "tables" });
  const items = Array.from({ length: 300 }, () => engine.next());
  assert.ok(items.every((item) => ["multiplication", "division"].includes(item.strand)));
  assert.ok(new Set(items.map((item) => item.family)).size >= 5);
});

test("answer evaluation accepts equivalent fractions and decimal variants", () => {
  const fractionItem = {
    answer: "3/4",
    answerType: "fraction",
    acceptableAnswers: [],
    misconceptions: {},
  };
  assert.equal(evaluateAnswer(fractionItem, "6/8").correct, true);
  assert.equal(evaluateAnswer(fractionItem, "2/3").correct, false);

  const decimalItem = {
    answer: "0.7",
    answerType: "decimal",
    acceptableAnswers: [],
    misconceptions: {},
  };
  assert.equal(evaluateAnswer(decimalItem, ".70").correct, true);
});

test("support adapts without touching challenge", () => {
  assert.equal(supportBand(0), "independent");
  assert.equal(supportBand(35), "prompted");
  assert.equal(supportBand(55), "guided");
  assert.equal(supportBand(80), "stepped");
  assert.equal(supportBand(100), "modelled");
  assert.equal(adaptiveSupport(35, "repeated-struggle"), 47);
  assert.equal(adaptiveSupport(35, "three-independent-correct"), 27);
});

test("every generator can produce a structurally complete item", () => {
  for (const family of QUESTION_FAMILIES) {
    let produced = false;
    for (let attempt = 0; attempt < 30 && !produced; attempt += 1) {
      const seed = 1000 + attempt;
      let state = seed;
      const rng = () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
      };
      const item = family.generate({ rng, target: (family.min + family.max) / 2, challenge: (family.min + family.max) / 2 });
      const validation = validateQuestion(item);
      if (validation.valid) {
        produced = true;
        assert.ok(item.scaffold.hint);
        assert.ok(item.scaffold.visual);
        assert.ok(item.scaffold.steps.length);
        assert.ok(item.scaffold.model.lines.length);
      }
    }
    assert.equal(produced, true, `${family.id} could not produce a valid question`);
  }
});

test("long sessions generate quickly and without exhausting the engine", () => {
  const started = performance.now();
  const engine = new FluencyEngine({ seed: "long-session", challenge: 67 });
  for (let index = 0; index < 5000; index += 1) engine.next();
  const elapsed = performance.now() - started;
  assert.ok(elapsed < 3000, `generation took ${Math.round(elapsed)}ms`);
});
