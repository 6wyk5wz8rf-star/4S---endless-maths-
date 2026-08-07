import assert from "node:assert/strict";
import test from "node:test";
import {
  CHALLENGE_ANCHORS,
  FluencyEngine,
  QUESTION_FAMILIES,
  QUESTION_STRUCTURE_COUNT,
  adaptiveSupport,
  evaluateAnswer,
  generatorCatalogue,
  masteryLabel,
  supportBand,
  validateQuestion,
} from "../lib/fluency-engine.mjs";

const AUDIT_POINTS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

test("the catalogue is broad, modular and centred on Year 4", () => {
  const catalogue = generatorCatalogue();
  assert.ok(catalogue.length >= 90);
  assert.ok(QUESTION_STRUCTURE_COUNT >= 300);
  const strands = new Set(catalogue.map((family) => family.strand));
  for (const strand of ["addition", "subtraction", "multiplication", "division", "fractions", "decimals", "place value", "mixed"]) {
    assert.ok(strands.has(strand), `missing ${strand}`);
  }
  assert.ok(catalogue.filter((family) => family.max >= 40 && family.min <= 75).length >= 60);
  assert.ok(catalogue.every((family) => family.structures.length >= 1));
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

test("tables focus stays inside the multiplication fact network", () => {
  const engine = new FluencyEngine({ seed: "tables-only", challenge: 48, focus: "tables" });
  const items = Array.from({ length: 300 }, () => engine.next());
  assert.ok(items.every((item) => ["multiplication", "division", "number"].includes(item.strand)));
  assert.ok(items.filter((item) => item.strand === "number").every((item) => item.metadata.retrievalKey.startsWith("fact-family:")));
  assert.ok(new Set(items.map((item) => item.family)).size >= 5);
});

test("foundation sessions remain accessible and free from later notation", () => {
  for (const challenge of [0, 5, 10, 15]) {
    const engine = new FluencyEngine({ seed: `foundation-${challenge}`, challenge });
    const items = Array.from({ length: 500 }, () => engine.next());
    assert.ok(items.every((item) => !["fractions", "decimals"].includes(item.strand)));
    assert.ok(items.every((item) => !item.display.includes("−") || Number(item.answer) >= 0));
    assert.ok(items.every((item) => item.metadata.thinking <= 2));
  }
});

test("practice modes select distinct cognitive rhythms", () => {
  const quick = new FluencyEngine({ seed: "quick-mode", challenge: 55, mode: "quick" });
  const think = new FluencyEngine({ seed: "think-mode", challenge: 75, mode: "think" });
  const quickItems = Array.from({ length: 400 }, () => quick.next());
  const thinkItems = Array.from({ length: 400 }, () => think.next());
  assert.ok(quickItems.filter((item) => item.metadata.speed === "recall").length / quickItems.length > 0.65);
  assert.ok(thinkItems.reduce((sum, item) => sum + item.metadata.thinking, 0) / thinkItems.length > 2);
  assert.ok(new Set(thinkItems.map((item) => item.metadata.structure)).size > 30);
});

test("broad Focus mode honours each selected strand", () => {
  for (const focus of ["addition", "subtraction", "multiplication", "division", "place value", "fractions", "decimals"]) {
    const challenge = focus === "decimals" ? 62 : focus === "fractions" ? 55 : 50;
    const engine = new FluencyEngine({ seed: `focus-${focus}`, challenge, mode: "focus", focus });
    const items = Array.from({ length: 160 }, () => engine.next());
    assert.ok(items.every((item) => item.strand === focus), `${focus} leaked into ${new Set(items.map((item) => item.strand)).size} strands`);
  }
});

test("teacher relationship and fraction-decimal focuses remain mathematically coherent", () => {
  const relationships = new FluencyEngine({ seed: "focus-relationships", challenge: 72, mode: "focus", focus: "equivalence and missing numbers" });
  const relationshipItems = Array.from({ length: 200 }, () => relationships.next());
  assert.ok(relationshipItems.every((item) => /equival|equal|balanc|missing|comparison|inverse/.test(`${item.family} ${item.subskill}`)));

  const numberParts = new FluencyEngine({ seed: "focus-number-parts", challenge: 60, mode: "focus", focus: "fractions and decimals" });
  const numberPartItems = Array.from({ length: 200 }, () => numberParts.next());
  assert.ok(numberPartItems.every((item) => ["fractions", "decimals"].includes(item.strand)));
  assert.ok(numberPartItems.some((item) => item.strand === "fractions"));
  assert.ok(numberPartItems.some((item) => item.strand === "decimals"));
});

test("errors are revisited with spacing rather than immediate drilling", () => {
  const engine = new FluencyEngine({ seed: "retrieval-spacing", challenge: 55 });
  const item = engine.next();
  engine.recordResponse({ item, correct: false, responseMs: 2000 });
  const following = Array.from({ length: 20 }, () => engine.next());
  assert.notEqual(following[0].metadata.connectionKind, "spaced-original");
  const repeatIndex = following.findIndex((candidate) => candidate.metadata.connectionKind === "spaced-original");
  assert.ok(repeatIndex >= 6, `original returned after only ${repeatIndex + 1} questions`);
  assert.equal(following[repeatIndex].display, item.display);
});

test("a worked model is followed by a genuinely nearby transfer", () => {
  const engine = new FluencyEngine({ seed: "near-transfer", challenge: 55, mode: "focus", focus: "addition" });
  let item = engine.next();
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (!item.display.includes("□") && Number(item.answer) === Number(item.values?.a) + Number(item.values?.b)) break;
    item = engine.next();
  }
  engine.recordResponse({ item, correct: true, firstTry: false, supportUsed: 4, modelUsed: true, responseMs: 5000 });
  const transfer = engine.next();
  assert.equal(transfer.metadata.connectionKind, "near-transfer");
  assert.notEqual(transfer.display, item.display);
  assert.notEqual(transfer.display, item.scaffold.model.display);
  assert.equal(evaluateAnswer(transfer, transfer.answer).correct, true);
});

test("mastery signals move gradually and keep the selected challenge authoritative", () => {
  const engine = new FluencyEngine({ seed: "mastery-gradual", challenge: 70 });
  const item = engine.next();
  engine.recordResponse({ item, correct: true, firstTry: true, supportUsed: 0, modelUsed: false, responseMs: 1800 });
  const stateAfterOne = engine.getLearningState()[item.metadata.retrievalKey];
  assert.equal(stateAfterOne.strength, "developing");
  assert.ok(stateAfterOne.score < 0.62);
  for (let index = 0; index < 6; index += 1) engine.recordResponse({ item, correct: false, responseMs: 3000 });
  assert.ok(engine.getAdaptation().performanceBias < 0);
  assert.equal(engine.next().metadata.selectedChallenge, 70);
  assert.equal(masteryLabel(0.2), "emerging");
  assert.equal(masteryLabel(0.9), "highly secure");
});

test("generated representations cover the coherent Build 2 visual library", () => {
  const kinds = new Set();
  for (const challenge of [10, 35, 55, 75, 95]) {
    const engine = new FluencyEngine({ seed: `visuals-${challenge}`, challenge });
    for (let index = 0; index < 800; index += 1) {
      const item = engine.next();
      kinds.add(item.promptVisual?.kind);
      kinds.add(item.scaffold.visual?.kind);
    }
  }
  for (const kind of ["ten-frame", "bead-string", "part-whole", "array", "counters", "base-ten", "fraction-strip", "bar-model", "hundred-grid", "number-line", "relationship", "worked-example"]) {
    assert.ok(kinds.has(kind), `missing ${kind}`);
  }
});

test("an independent arithmetic oracle checks generated direct and missing equations", () => {
  const parseNumber = (value) => Number(String(value).replaceAll(",", ""));
  let directChecks = 0;
  let missingChecks = 0;
  for (const challenge of AUDIT_POINTS) {
    const engine = new FluencyEngine({ seed: `oracle-${challenge}`, challenge });
    for (let index = 0; index < 700; index += 1) {
      const item = engine.next();
      const display = item.display.replaceAll(",", "").trim();
      const answer = parseNumber(item.answer);
      const direct = display.match(/^(-?\d+(?:\.\d+)?)\s*([+−×÷])\s*(-?\d+(?:\.\d+)?)$/);
      if (direct && item.type === "numeric" && Number.isFinite(answer)) {
        const left = Number(direct[1]);
        const right = Number(direct[3]);
        const expected = direct[2] === "+" ? left + right : direct[2] === "−" ? left - right : direct[2] === "×" ? left * right : left / right;
        assert.ok(Math.abs(answer - expected) < 0.000001, `${item.family}: ${item.display} should be ${expected}, not ${item.answer}`);
        directChecks += 1;
      }

      const patterns = [
        { regex: /^(\d+)\s*\+\s*□\s*=\s*(\d+)$/, solve: (a, total) => total - a },
        { regex: /^□\s*\+\s*(\d+)\s*=\s*(\d+)$/, solve: (a, total) => total - a },
        { regex: /^(\d+)\s*−\s*□\s*=\s*(\d+)$/, solve: (a, result) => a - result },
        { regex: /^□\s*−\s*(\d+)\s*=\s*(\d+)$/, solve: (b, result) => b + result },
        { regex: /^(\d+)\s*×\s*□\s*=\s*(\d+)$/, solve: (factor, product) => product / factor },
        { regex: /^□\s*×\s*(\d+)\s*=\s*(\d+)$/, solve: (factor, product) => product / factor },
        { regex: /^(\d+)\s*÷\s*□\s*=\s*(\d+)$/, solve: (dividend, quotient) => dividend / quotient },
        { regex: /^□\s*÷\s*(\d+)\s*=\s*(\d+)$/, solve: (divisor, quotient) => divisor * quotient },
      ];
      for (const pattern of patterns) {
        const match = display.match(pattern.regex);
        if (!match || !Number.isFinite(answer)) continue;
        assert.equal(answer, pattern.solve(Number(match[1]), Number(match[2])), `${item.family}: wrong missing value in ${item.display}`);
        missingChecks += 1;
        break;
      }
    }
  }
  assert.ok(directChecks > 1800);
  assert.ok(missingChecks > 500);
});

test("every missing-digit puzzle has exactly one fitting digit", () => {
  const families = QUESTION_FAMILIES.filter((family) => family.id === "missing-digit" || family.id === "missing-digit-depth");
  let checked = 0;
  for (const family of families) {
    for (let attempt = 0; attempt < 800; attempt += 1) {
      let state = attempt + 713;
      const rng = () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
      };
      const item = family.generate({ rng, target: 94, challenge: 94 });
      const fitting = [];
      for (let digit = 0; digit <= 9; digit += 1) {
        const equation = item.display.replace("□", String(digit)).replaceAll(",", "");
        const match = equation.match(/^(\d+)\s*([+−×])\s*(\d+)\s*=\s*(\d+)$/);
        assert.ok(match, `could not parse ${equation}`);
        const left = Number(match[1]);
        const right = Number(match[3]);
        const expected = match[2] === "+" ? left + right : match[2] === "−" ? left - right : left * right;
        if (expected === Number(match[4])) fitting.push(digit);
      }
      assert.deepEqual(fitting, [Number(item.answer)], `${item.display} had fitting digits ${fitting.join(", ")}`);
      checked += 1;
    }
  }
  assert.equal(checked, 1600);
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

test("teacher challenge ranges remain authoritative while adaptation continues inside them", () => {
  const engine = new FluencyEngine({ seed: "teacher-range", challenge: 52, challengeRange: { min: 45, max: 60 } });
  for (let index = 0; index < 24; index += 1) {
    const item = engine.next();
    engine.recordResponse({ item, correct: false, firstTry: false, supportUsed: 2, responseMs: 4000 });
  }
  const items = Array.from({ length: 250 }, () => engine.next());
  assert.ok(items.every((item) => item.metadata.targetDifficulty >= 45 && item.metadata.targetDifficulty <= 60));
  assert.ok(items.every((item) => item.metadata.selectedChallengeRange.min === 45 && item.metadata.selectedChallengeRange.max === 60));
  assert.deepEqual(engine.getAdaptation().challengeRange, { min: 45, max: 60 });

  engine.setChallenge(58, true);
  assert.deepEqual(engine.getAdaptation().challengeRange, { min: 45, max: 60 });
  assert.ok(Array.from({ length: 100 }, () => engine.next()).every((item) => item.difficulty >= 45 && item.difficulty <= 60));

  engine.setChallenge(72);
  assert.equal(engine.getAdaptation().challengeRange, null);
  assert.equal(engine.next().metadata.selectedChallenge, 72);
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

test("restricted high-challenge Quick Fire sessions remain endless without immediate duplicates", () => {
  const engine = new FluencyEngine({ seed: "build3-75-quick", challenge: 75, mode: "quick" });
  let previousSignature = null;
  for (let index = 0; index < 500; index += 1) {
    const item = engine.next();
    const signature = engine.getHistory().at(-1);
    assert.ok(validateQuestion(item).valid);
    assert.notEqual(signature, previousSignature, `question ${index} repeated immediately`);
    previousSignature = signature;
  }
});

test("teacher subskill filters and family allow-lists narrow the engine without breaking challenge", () => {
  const derived = new FluencyEngine({
    seed: "teacher-derived-facts",
    challenge: 58,
    challengeRange: { min: 48, max: 68 },
    mode: "focus",
    focus: "multiplication",
    subskill: "Derived facts",
  });
  const derivedItems = Array.from({ length: 120 }, () => derived.next());
  assert.ok(derivedItems.every((item) => item.family === "derived-multiplication-facts"));
  assert.ok(derivedItems.every((item) => item.difficulty >= 48 && item.difficulty <= 68));

  const onlyRecall = new FluencyEngine({
    seed: "teacher-family-list",
    challenge: 52,
    mode: "focus",
    focus: "tables",
    permittedFamilies: ["table-recall"],
  });
  assert.ok(Array.from({ length: 100 }, () => onlyRecall.next()).every((item) => item.family === "table-recall"));

  const withoutRecall = new FluencyEngine({ seed: "teacher-family-exclusion", challenge: 52, excludedFamilies: ["table-recall"] });
  assert.ok(Array.from({ length: 300 }, () => withoutRecall.next()).every((item) => item.family !== "table-recall"));
});

test("table-group subskills select facts containing the requested table factors", () => {
  const engine = new FluencyEngine({ seed: "teacher-table-group", challenge: 48, mode: "focus", focus: "tables", subskill: "2, 5 and 10" });
  const requested = new Set([2, 5, 10]);
  const items = Array.from({ length: 160 }, () => engine.next());
  for (const item of items) {
    const values = [Number(item.values?.a), Number(item.values?.b)].filter((value) => Number.isInteger(value) && value >= 2 && value <= 12);
    const keyFactors = [...String(item.metadata.retrievalKey).matchAll(/(?:tables:|fact-family:|derived:)(\d+)(?:x(\d+))?/g)].flatMap((match) => [Number(match[1]), Number(match[2])]).filter(Number.isFinite);
    assert.ok((keyFactors.length ? keyFactors : values).some((factor) => requested.has(factor)), `${item.family} did not contain a 2×, 5× or 10× factor`);
  }
});

test("strategy, connected-sequence and near-transfer controls change selection and scheduling", () => {
  const noStrategies = new FluencyEngine({ seed: "no-strategies", challenge: 70, mode: "focus", focus: "multiplication", includeStrategyQuestions: false });
  const plainItems = Array.from({ length: 220 }, () => noStrategies.next());
  assert.ok(plainItems.every((item) => !item.metadata.strategy));
  assert.ok(plainItems.every((item) => !/strategy|derived|distribut|efficient/.test(`${item.family} ${item.subskill}`)));

  const connectionsOn = new FluencyEngine({ seed: "connections", challenge: 55, mode: "focus", focus: "multiplication", permittedFamilies: ["multiplication-fact-family-web"], connectedSequences: true });
  const connected = connectionsOn.next();
  assert.ok(connected.connections.length >= 2);
  assert.ok(connectionsOn.getAdaptation().scheduled >= 2);
  const connectionsOff = new FluencyEngine({ seed: "connections", challenge: 55, mode: "focus", focus: "multiplication", permittedFamilies: ["multiplication-fact-family-web"], connectedSequences: false });
  connectionsOff.next();
  assert.equal(connectionsOff.getAdaptation().scheduled, 0);

  const transferOn = new FluencyEngine({ seed: "near-transfer-option", challenge: 60, mode: "focus", focus: "addition", permittedFamilies: ["year4-addition"], connectedSequences: false, nearTransfer: true });
  const modelledOn = transferOn.next();
  transferOn.recordResponse({ item: modelledOn, correct: true, firstTry: false, supportUsed: 4, modelUsed: true });
  assert.equal(transferOn.getAdaptation().scheduled, 1);
  const transferOff = new FluencyEngine({ seed: "near-transfer-option", challenge: 60, mode: "focus", focus: "addition", permittedFamilies: ["year4-addition"], connectedSequences: false, nearTransfer: false });
  const modelledOff = transferOff.next();
  transferOff.recordResponse({ item: modelledOff, correct: true, firstTry: false, supportUsed: 4, modelUsed: true });
  assert.equal(transferOff.getAdaptation().scheduled, 0);
});

test("retrieval weighting changes My Mix selection while adaptive difficulty can be disabled", () => {
  const learningState = {
    "addition:number bonds": { score: 0.6, attempts: 20, lastSeen: -100, lastSeenAt: Date.now() - 10 * 86400000 },
  };
  const make = (retrievalWeight) => new FluencyEngine({
    seed: "retrieval-weighting",
    challenge: 55,
    mode: "my-mix",
    learningState,
    retrievalWeight,
    connectedSequences: false,
  });
  const makeNone = make(0);
  const makeStrong = make(0.55);
  const none = Array.from({ length: 600 }, () => makeNone.next());
  const strong = Array.from({ length: 600 }, () => makeStrong.next());
  const noneCount = none.filter((item) => item.strand === "addition").length;
  const strongCount = strong.filter((item) => item.strand === "addition").length;
  assert.ok(strongCount >= noneCount + 20, `${strongCount} strong-retrieval additions did not materially exceed ${noneCount}`);

  const fixedBand = new FluencyEngine({ seed: "no-adaptive-difficulty", challenge: 70, challengeRange: { min: 64, max: 76 }, adaptiveDifficulty: false });
  for (let index = 0; index < 12; index += 1) {
    const item = fixedBand.next();
    fixedBand.recordResponse({ item, correct: false, firstTry: false, supportUsed: 2 });
  }
  assert.equal(fixedBand.getAdaptation().performanceBias, 0);
  assert.ok(Array.from({ length: 120 }, () => fixedBand.next()).every((item) => item.difficulty >= 64 && item.difficulty <= 76));
});

test("representation frequency is deterministic metadata and does not perturb the question sequence", () => {
  const hidden = new FluencyEngine({ seed: "representation-frequency", challenge: 58, representationFrequency: 0 });
  const frequent = new FluencyEngine({ seed: "representation-frequency", challenge: 58, representationFrequency: 1 });
  for (let index = 0; index < 160; index += 1) {
    const left = hidden.next();
    const right = frequent.next();
    assert.deepEqual({ family: left.family, display: left.display, answer: left.answer }, { family: right.family, display: right.display, answer: right.answer });
    assert.equal(left.metadata.representationFrequency, 0);
    assert.equal(left.metadata.representationSuggested, false);
    assert.equal(right.metadata.representationFrequency, 1);
    assert.equal(right.metadata.representationSuggested, true);
  }
});

test("fixed sequences remain identical despite opposite pupil response patterns", () => {
  const options = { seed: "same-teacher-sequence", challenge: 62, mode: "my-mix", fixedSequence: true };
  const secureResponses = new FluencyEngine(options);
  const strugglingResponses = new FluencyEngine(options);
  for (let index = 0; index < 160; index += 1) {
    const secureItem = secureResponses.next();
    const strugglingItem = strugglingResponses.next();
    assert.deepEqual(
      { family: secureItem.family, display: secureItem.display, answer: secureItem.answer },
      { family: strugglingItem.family, display: strugglingItem.display, answer: strugglingItem.answer },
    );
    secureResponses.recordResponse({ item: secureItem, correct: true, firstTry: true, supportUsed: 0, modelUsed: false });
    strugglingResponses.recordResponse({ item: strugglingItem, correct: false, firstTry: false, supportUsed: 4, modelUsed: true });
  }
  assert.equal(secureResponses.getAdaptation().scheduled, 0);
  assert.equal(strugglingResponses.getAdaptation().scheduled, 0);
  assert.equal(secureResponses.getAdaptation().performanceBias, 0);
  assert.notDeepEqual(secureResponses.getLearningState(), strugglingResponses.getLearningState(), "mastery should still record the different outcomes");
});

test("a serialised engine snapshot resumes RNG, queues, history and learning state exactly", () => {
  const original = new FluencyEngine({
    seed: "serialised-resume",
    challenge: 58,
    challengeRange: { min: 50, max: 66 },
    mode: "focus",
    focus: "multiplication",
    retrievalWeight: "strong",
    representationFrequency: "high",
  });
  for (let index = 0; index < 12; index += 1) {
    const item = original.next();
    if (index === 3) original.recordResponse({ item, correct: false, firstTry: false, supportUsed: 1 });
    if (index === 7) original.recordResponse({ item, correct: true, firstTry: false, supportUsed: 4, modelUsed: true });
  }
  const state = JSON.parse(JSON.stringify(original.getState()));
  assert.ok(state.rngState >= 0);
  assert.ok(state.scheduled.length > 0);
  const expected = Array.from({ length: 100 }, () => {
    const item = original.next();
    return { id: item.id, family: item.family, display: item.display, answer: item.answer, connection: item.metadata.connectionKind ?? null };
  });
  const resumed = new FluencyEngine({ state });
  const actual = Array.from({ length: 100 }, () => {
    const item = resumed.next();
    return { id: item.id, family: item.family, display: item.display, answer: item.answer, connection: item.metadata.connectionKind ?? null };
  });
  assert.deepEqual(actual, expected);
  assert.deepEqual(resumed.getAdaptation().challengeRange, { min: 50, max: 66 });
  assert.equal(resumed.getAdaptation().retrievalWeight, 0.55);
});

test("descending sequence scaffolds use actual sequence endpoints rather than the negative step", () => {
  const engine = new FluencyEngine({ seed: "descending-sequence-visual", challenge: 58, mode: "focus", permittedFamilies: ["sequence"] });
  let item;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    item = engine.next();
    if (Number(item.values.b) < 0) break;
  }
  assert.ok(Number(item.values.b) < 0, "a descending sequence was not generated");
  const values = [0, 1, 2, 3].map((multiple) => Number(item.values.a) + Number(item.values.b) * multiple);
  assert.equal(item.scaffold.visual.kind, "number-line");
  assert.equal(item.scaffold.visual.min, Math.min(...values));
  assert.equal(item.scaffold.visual.max, Math.max(...values));
  assert.deepEqual(item.scaffold.visual.points, values);
  assert.notEqual(item.scaffold.visual.min, Number(item.values.b));
});

test("long sessions generate quickly and without exhausting the engine", () => {
  const started = performance.now();
  const engine = new FluencyEngine({ seed: "long-session", challenge: 67 });
  for (let index = 0; index < 5000; index += 1) engine.next();
  const elapsed = performance.now() - started;
  assert.ok(elapsed < 3000, `generation took ${Math.round(elapsed)}ms`);
});
