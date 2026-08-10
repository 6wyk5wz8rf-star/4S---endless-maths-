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
  normalisePracticeSelection,
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

test("invalid mode, focus and challenge combinations normalise without ending practice", () => {
  const cases = [
    { requested: { mode: "focus", focus: "decimals", challenge: 0 }, expected: { mode: "focus", focus: null } },
    { requested: { mode: "quick", focus: "fractions", challenge: 50 }, expected: { mode: "focus", focus: "fractions" } },
    { requested: { mode: "quick", focus: "decimals", challenge: 50 }, expected: { mode: "focus", focus: "decimals" } },
    { requested: { mode: "quick", focus: "addition", challenge: 100 }, expected: { mode: "focus", focus: "addition" } },
    { requested: { mode: "quick", focus: null, challenge: 100 }, expected: { mode: "mix", focus: null } },
    { requested: { mode: "think", focus: "subtraction", challenge: 10 }, expected: { mode: "focus", focus: "subtraction" } },
  ];

  for (const { requested, expected } of cases) {
    const selection = normalisePracticeSelection(requested);
    assert.equal(selection.challenge, requested.challenge, "normalisation must not move the chosen challenge");
    assert.deepEqual({ mode: selection.mode, focus: selection.focus }, expected);
    const engine = new FluencyEngine({ ...requested, seed: `normalise-${requested.mode}-${requested.focus}-${requested.challenge}` });
    assert.deepEqual({ mode: engine.getAdaptation().mode, focus: engine.getAdaptation().focus }, expected);
    for (let index = 0; index < 80; index += 1) assert.equal(validateQuestion(engine.next()).valid, true);
  }
});

test("live selection setters and restored sessions use the same normalisation guard", () => {
  const live = new FluencyEngine({ seed: "live-selection-guard", challenge: 0, mode: "mix" });
  assert.deepEqual(live.setFocus("decimals"), { mode: "mix", focus: null, challenge: 0 });
  assert.equal(validateQuestion(live.next()).valid, true);
  live.setChallenge(100);
  assert.deepEqual(live.setMode("quick"), { mode: "mix", focus: null, challenge: 100 });
  assert.equal(validateQuestion(live.next()).valid, true);

  const state = live.getState();
  state.mode = "quick";
  state.focus = "fractions";
  state.challenge = 50;
  state.challengeRange = null;
  const restored = new FluencyEngine({ state });
  assert.deepEqual({ mode: restored.getAdaptation().mode, focus: restored.getAdaptation().focus }, { mode: "focus", focus: "fractions" });
  assert.equal(validateQuestion(restored.next()).valid, true);
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

test("foundation representations stay compact and subtraction stays non-negative", () => {
  const multiplication = new FluencyEngine({
    seed: "compact-foundation-groups",
    challenge: 25,
    mode: "focus",
    focus: "multiplication",
    permittedFamilies: ["multiplication-foundation-models"],
    connectedSequences: false,
  });
  let repeatedAdditionSeen = false;
  for (let index = 0; index < 400; index += 1) {
    const item = multiplication.next();
    if (item.metadata.structure !== "repeated-addition") continue;
    repeatedAdditionSeen = true;
    assert.ok(item.choices.every((choice) => String(choice).split("+").length <= 6), `choice is too long: ${item.choices.join(" | ")}`);
  }
  assert.equal(repeatedAdditionSeen, true);

  const subtraction = new FluencyEngine({
    seed: "non-negative-foundation-subtraction",
    challenge: 30,
    mode: "focus",
    focus: "subtraction",
    permittedFamilies: ["foundation-subtraction-strategies"],
    connectedSequences: false,
  });
  for (let index = 0; index < 500; index += 1) {
    const item = subtraction.next();
    assert.ok(Number(item.answer) >= 0, `${item.display} produced ${item.answer}`);
  }
});

test("scaffold representations never expose generic placeholder copy", () => {
  for (const challenge of AUDIT_POINTS) {
    const engine = new FluencyEngine({ seed: `representation-copy-${challenge}`, challenge, support: 100 });
    for (let index = 0; index < 500; index += 1) {
      const item = engine.next();
      const visual = item.scaffold.visual;
      if (visual.kind !== "relationship") continue;
      assert.ok(visual.left && visual.right, `${item.family} has an incomplete relationship visual`);
      assert.equal(/^(known|new|known fact|new fact)$/i.test(String(visual.left)), false, `${item.family} exposed ${visual.left}`);
      assert.equal(/^(known|new|known fact|new fact)$/i.test(String(visual.right)), false, `${item.family} exposed ${visual.right}`);
    }
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

test("every generated number-line marker and hidden-marker index is valid", () => {
  let numberLines = 0;
  let hiddenMarkers = 0;
  for (const challenge of AUDIT_POINTS) {
    const engine = new FluencyEngine({ seed: `number-line-integrity-${challenge}`, challenge });
    for (let index = 0; index < 800; index += 1) {
      const item = engine.next();
      for (const visual of [item.promptVisual, item.scaffold.visual]) {
        if (!visual || !["number-line", "bead-string"].includes(visual.kind)) continue;
        numberLines += 1;
        const markers = visual.markers ?? visual.points ?? [];
        assert.ok(Number.isFinite(visual.min) && Number.isFinite(visual.max) && visual.max > visual.min, `${item.family}/${item.metadata.structure}: invalid range`);
        assert.ok(markers.every((marker) => Number.isFinite(marker) && marker >= visual.min && marker <= visual.max), `${item.family}/${item.metadata.structure}: marker outside the line`);
        if (visual.unknown === null || visual.unknown === undefined) continue;
        hiddenMarkers += 1;
        assert.ok(Number.isInteger(visual.unknown) && visual.unknown >= 0 && visual.unknown < markers.length, `${item.family}/${item.metadata.structure}: hidden marker ${visual.unknown} is not a marker-array index`);
      }
      assert.equal(validateQuestion(item).valid, true, `${item.family}/${item.metadata.structure}: ${validateQuestion(item).issues.join(", ")}`);
    }
  }
  assert.ok(numberLines > 1_000);
  assert.ok(hiddenMarkers > 100);

  const invalid = new FluencyEngine({ seed: "invalid-hidden-marker-guard", challenge: 60 }).next();
  invalid.promptVisual = { kind: "number-line", title: "Broken line", min: 0, max: 10, markers: [5], unknown: 5 };
  const validation = validateQuestion(invalid);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.includes("Prompt number line has an invalid hidden marker"));
});

test("number-line questions hide the value they ask pupils to find", () => {
  const familyItems = (familyId, target = 90) => {
    const family = QUESTION_FAMILIES.find((candidate) => candidate.id === familyId);
    assert.ok(family, `missing ${familyId}`);
    let state = 0x9e3779b9;
    const rng = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const found = new Map();
    for (let attempt = 0; attempt < 2_000 && found.size < family.structures.length; attempt += 1) {
      const item = family.generate({ rng, target, challenge: target });
      found.set(item.metadata.structure, item);
    }
    assert.deepEqual([...found.keys()].sort(), [...family.structures].sort(), `${familyId} did not generate every structure`);
    return found;
  };

  const hiddenValue = (item, where = "promptVisual") => {
    const line = where === "promptVisual" ? item.promptVisual : item.scaffold.visual;
    const markers = line.markers ?? line.points ?? [];
    assert.ok(Number.isInteger(line.unknown) && line.unknown >= 0 && line.unknown < markers.length, `${item.family}/${item.metadata.structure}: no valid hidden target`);
    return markers[line.unknown];
  };
  const numericAnswer = (item) => Number(String(item.answer).replaceAll(",", ""));
  const fractionAnswer = (item) => {
    const match = String(item.answer).match(/^(-?\d+)\/(-?\d+)$/);
    assert.ok(match, `${item.family}/${item.metadata.structure}: invalid fraction answer ${item.answer}`);
    return Number(match[1]) / Number(match[2]);
  };
  const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: hidden ${actual}, answer ${expected}`);

  const wholeLines = familyItems("number-line-relationships");
  for (const structure of ["line-midpoint", "line-missing-interval", "line-estimate-position", "line-marked-value"]) {
    const item = wholeLines.get(structure);
    close(hiddenValue(item), numericAnswer(item), structure);
    close(hiddenValue(item, "scaffold"), numericAnswer(item), `${structure} scaffold`);
  }
  assert.equal(wholeLines.get("line-adjacent-multiples").promptVisual.unknown, null);

  const fractionLines = familyItems("fraction-number-lines");
  for (const structure of ["fraction-line-read", "fraction-line-missing", "fraction-line-halfway", "fraction-line-estimate"]) {
    const item = fractionLines.get(structure);
    close(hiddenValue(item), fractionAnswer(item), structure);
    close(hiddenValue(item, "scaffold"), fractionAnswer(item), `${structure} scaffold`);
  }
  assert.equal(fractionLines.get("fraction-line-equivalent").promptVisual.unknown, null);

  const decimalLines = familyItems("decimal-number-lines");
  for (const structure of decimalLines.keys()) {
    const item = decimalLines.get(structure);
    close(hiddenValue(item), numericAnswer(item), structure);
    close(hiddenValue(item, "scaffold"), numericAnswer(item), `${structure} scaffold`);
  }

  const sequences = familyItems("intelligent-sequences");
  const missingSequence = sequences.get("sequence-missing-middle");
  close(hiddenValue(missingSequence, "scaffold"), numericAnswer(missingSequence), "sequence-missing-middle");
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

test("worked models solve the active arithmetic question rather than a nearby different one", () => {
  const number = "(-?\\d+(?:\\.\\d+)?)";
  const directPattern = new RegExp(`^${number}\\s*([+−×÷])\\s*${number}$`);
  const missingPatterns = [
    ["missing-addend-right", new RegExp(`^${number}\\s*\\+\\s*□\\s*=\\s*${number}$`)],
    ["missing-addend-left", new RegExp(`^□\\s*\\+\\s*${number}\\s*=\\s*${number}$`)],
    ["missing-subtrahend", new RegExp(`^${number}\\s*−\\s*□\\s*=\\s*${number}$`)],
    ["missing-minuend", new RegExp(`^□\\s*−\\s*${number}\\s*=\\s*${number}$`)],
    ["missing-factor", new RegExp(`^${number}\\s*×\\s*□\\s*=\\s*${number}$`)],
    ["missing-dividend", new RegExp(`^□\\s*÷\\s*${number}\\s*=\\s*${number}$`)],
    ["missing-divisor", new RegExp(`^${number}\\s*÷\\s*□\\s*=\\s*${number}$`)],
  ];
  const counts = new Map();
  const evaluateEquation = (line) => {
    const compact = String(line).replace(/^So\s+/i, "").replace(/[.,]$/, "").replaceAll(",", "").trim();
    const match = compact.match(new RegExp(`^${number}\\s*([+−×÷])\\s*${number}\\s*=\\s*${number}$`));
    if (!match) return null;
    const left = Number(match[1]);
    const operation = match[2];
    const right = Number(match[3]);
    const shown = Number(match[4]);
    const expected = operation === "+" ? left + right : operation === "−" ? left - right : operation === "×" ? left * right : left / right;
    return Math.abs(shown - expected) < 0.000001;
  };

  for (const challenge of AUDIT_POINTS) {
    const engine = new FluencyEngine({ seed: `active-model-${challenge}`, challenge, connectedSequences: false });
    for (let index = 0; index < 900; index += 1) {
      const item = engine.next();
      if (!Number.isFinite(Number(item.answer))) continue;
      const display = item.display.replaceAll(",", "").trim();
      const direct = display.match(directPattern);
      let category = null;
      if (direct) {
        const left = Number(direct[1]);
        const operation = direct[2];
        const right = Number(direct[3]);
        const expected = operation === "+" ? left + right : operation === "−" ? left - right : operation === "×" ? left * right : left / right;
        if (Math.abs(expected - Number(item.answer)) < 0.000001) category = `direct-${operation}`;
      }
      if (!category) category = missingPatterns.find(([, pattern]) => pattern.test(display))?.[0] ?? null;
      if (!category) continue;

      counts.set(category, (counts.get(category) ?? 0) + 1);
      assert.equal(item.scaffold.model.display, item.display, `${item.family}: model switched ${item.display} to ${item.scaffold.model.display}`);
      assert.equal(String(item.scaffold.model.answer), String(item.answer), `${item.family}: model answer drifted from the active question`);
      const checkedLines = item.scaffold.model.lines.map(evaluateEquation).filter((result) => result !== null);
      assert.ok(checkedLines.length >= 1, `${item.family}: model had no checkable arithmetic for ${item.display}`);
      assert.ok(checkedLines.every(Boolean), `${item.family}: model contained a false equality for ${item.display}: ${item.scaffold.model.lines.join(" | ")}`);
    }
  }

  for (const category of ["direct-+", "direct-−", "direct-×", "direct-÷", ...missingPatterns.map(([name]) => name)]) {
    assert.ok((counts.get(category) ?? 0) >= 10, `${category} was not exercised enough`);
  }
});

test("estimation models never present an approximate answer as an exact equality", () => {
  const engine = new FluencyEngine({
    seed: "estimation-model-semantics",
    challenge: 58,
    permittedFamilies: ["estimation-fluency"],
    connectedSequences: false,
  });
  let approximateModels = 0;
  for (let index = 0; index < 300; index += 1) {
    const item = engine.next();
    const direct = String(item.display).replaceAll(",", "").match(/^(-?\d+(?:\.\d+)?)\s*([+−×÷])\s*(-?\d+(?:\.\d+)?)$/);
    if (!direct || !Number.isFinite(Number(String(item.answer).replaceAll(",", "")))) continue;
    const left = Number(direct[1]);
    const right = Number(direct[3]);
    const exact = direct[2] === "+" ? left + right : direct[2] === "−" ? left - right : direct[2] === "×" ? left * right : left / right;
    if (exact === Number(String(item.answer).replaceAll(",", ""))) continue;
    approximateModels += 1;
    assert.match(item.scaffold.model.display, /^Estimate\s/);
    assert.equal(item.scaffold.model.answer, String(item.answer));
  }
  assert.ok(approximateModels > 50);
});

test("the 10 divided by 5 regression and all direct or missing division models keep one equation in view", () => {
  const foundation = new FluencyEngine({
    seed: "show-division-10",
    challenge: 10,
    mode: "focus",
    focus: "division",
    permittedFamilies: ["simple-sharing", "division-foundation-models"],
    connectedSequences: false,
  });
  let tenDividedByFive = null;
  for (let index = 0; index < 300 && !tenDividedByFive; index += 1) {
    const item = foundation.next();
    if (item.display === "10 ÷ 5") tenDividedByFive = item;
  }
  assert.ok(tenDividedByFive, "the regression question was not generated");
  assert.deepEqual(
    { display: tenDividedByFive.scaffold.model.display, answer: tenDividedByFive.scaffold.model.answer },
    { display: "10 ÷ 5", answer: "2" },
  );
  assert.ok(tenDividedByFive.scaffold.model.lines.includes("5 × 2 = 10"));
  assert.ok(tenDividedByFive.scaffold.model.lines.includes("So 10 ÷ 5 = 2"));

  for (const challenge of AUDIT_POINTS) {
    const engine = new FluencyEngine({ seed: `division-model-${challenge}`, challenge, mode: "focus", focus: "division", connectedSequences: false });
    for (let index = 0; index < 500; index += 1) {
      const item = engine.next();
      const display = item.display.replaceAll(",", "").trim();
      if (!/^(?:□|\d+)\s*÷\s*(?:□|\d+)(?:\s*=\s*\d+)?$/.test(display) || !Number.isFinite(Number(item.answer))) continue;
      assert.equal(item.scaffold.model.display, item.display);
      assert.equal(String(item.scaffold.model.answer), String(item.answer));
      assert.equal(item.scaffold.model.lines.some((line) => String(line).startsWith("So ") && String(line).replaceAll(",", "").includes(String(item.answer).replaceAll(",", ""))), true, `${item.display}: missing concluding line`);
    }
  }
});

test("related and near-transfer arithmetic items refresh their value-specific scaffolds", () => {
  const division = new FluencyEngine({
    seed: "fresh-division-transfer",
    challenge: 18,
    mode: "focus",
    focus: "division",
    permittedFamilies: ["division-foundation-models"],
    connectedSequences: false,
  });
  let source = division.next();
  while (!/^\d+ ÷ \d+$/.test(source.display)) source = division.next();
  division.recordResponse({ item: source, correct: true, firstTry: false, supportUsed: 4, modelUsed: true });
  const transfer = division.next();
  assert.equal(transfer.metadata.connectionKind, "near-transfer");
  assert.equal(transfer.scaffold.model.display, transfer.display);
  assert.equal(String(transfer.scaffold.model.answer), String(transfer.answer));
  if (transfer.scaffold.visual.kind === "groups") {
    assert.equal(Number(transfer.scaffold.visual.total), Number(transfer.values.a));
    assert.equal(Number(transfer.scaffold.visual.groupSize), Number(transfer.values.b));
  }
  if (transfer.scaffold.visual.kind === "counters") {
    assert.equal(Number(transfer.scaffold.visual.groups) * Number(transfer.scaffold.visual.perGroup), Number(transfer.values.a));
  }

  const retrieval = new FluencyEngine({ seed: "fresh-related-retrieval", challenge: 40, mode: "mix", permittedFamilies: ["division-fact"], connectedSequences: false });
  const missed = retrieval.next();
  retrieval.recordResponse({ item: missed, correct: false, firstTry: false, supportUsed: 0, modelUsed: false });
  const following = Array.from({ length: 10 }, () => retrieval.next());
  const related = following.find((item) => item.metadata.connectionKind === "related-retrieval");
  assert.ok(related, "a related inverse fact was not scheduled");
  assert.equal(related.scaffold.visual.kind, "relationship");
  assert.ok(related.scaffold.visual.left.includes(missed.display));
  assert.ok(related.scaffold.visual.right.includes(related.display));
  assert.equal(related.scaffold.model.display, related.display);
});

test("multi-step subtraction blanks are solved independently rather than copied from the right-hand side", () => {
  const family = QUESTION_FAMILIES.find((candidate) => candidate.id === "multi-step-missing-number");
  assert.ok(family);
  let checked = 0;
  for (let seed = 1; seed <= 2_000; seed += 1) {
    let state = seed;
    const rng = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const item = family.generate({ rng, target: 90, challenge: 90 });
    if (item.metadata.structure !== "missing-two-step-subtract") continue;
    const match = item.display.match(/^(\d+) − □ − (\d+) = (\d+)$/);
    assert.ok(match, item.display);
    const [, start, finalSubtract, result] = match.map(Number);
    const expected = start - finalSubtract - result;
    assert.equal(Number(item.answer), expected, `${item.display} should have blank ${expected}, not ${item.answer}`);
    assert.equal(start - Number(item.answer) - finalSubtract, result);
    checked += 1;
  }
  assert.ok(checked > 250);
});

test("fraction labels, values and visuals agree for unit, non-unit, group and missing-whole structures", () => {
  const visualFamily = QUESTION_FAMILIES.find((candidate) => candidate.id === "fraction-visual-identification");
  const quantityFamily = QUESTION_FAMILIES.find((candidate) => candidate.id === "fraction-quantity-network");
  assert.ok(visualFamily && quantityFamily);
  const counts = { unit: 0, nonUnit: 0, groups: 0, missingWhole: 0 };

  for (let seed = 1; seed <= 4_000; seed += 1) {
    let state = seed;
    const rng = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const item = visualFamily.generate({ rng, target: 70, challenge: 70 });
    if (item.metadata.structure === "fraction-unit-name") {
      assert.equal(item.values.numerator, 1);
      assert.match(item.answer, /^1\//);
      assert.equal(item.promptVisual.numerator, 1);
      counts.unit += 1;
    }
    if (item.metadata.structure === "fraction-non-unit-name") {
      assert.ok(item.values.numerator > 1);
      counts.nonUnit += 1;
    }
    if (item.metadata.structure === "fraction-groups-count") {
      assert.equal(item.promptVisual.kind, "bar-model");
      assert.equal(item.promptVisual.segments, item.values.denominator);
      assert.equal(item.promptVisual.filled, item.values.numerator);
      assert.match(item.instruction, new RegExp(`^${item.values.numerator} of ${item.values.denominator} equal groups`));
      counts.groups += 1;
    }

    let quantityState = seed + 10_000;
    const quantityRng = () => {
      quantityState = (quantityState * 1664525 + 1013904223) >>> 0;
      return quantityState / 4294967296;
    };
    const quantity = quantityFamily.generate({ rng: quantityRng, target: 80, challenge: 80 });
    if (quantity.metadata.structure !== "fraction-missing-whole") continue;
    const shownUnit = Number(quantity.display.match(/=\s*(\d+)$/)?.[1]);
    assert.equal(quantity.values.numerator, 1);
    assert.equal(quantity.scaffold.visual.kind, "bar-model");
    assert.equal(quantity.scaffold.visual.filled, 1);
    assert.equal(Number(quantity.answer), shownUnit * quantity.values.denominator);
    assert.equal(quantity.scaffold.model.display, quantity.display);
    assert.equal(String(quantity.scaffold.model.answer), String(quantity.answer));
    counts.missingWhole += 1;
  }

  assert.ok(Object.values(counts).every((count) => count > 500), JSON.stringify(counts));
});

test("decimal digit-value prompts identify one unambiguous place", () => {
  const family = QUESTION_FAMILIES.find((candidate) => candidate.id === "decimal-place-relations");
  assert.ok(family);
  let checked = 0;
  for (let seed = 1; seed <= 3_000; seed += 1) {
    let state = seed;
    const rng = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const item = family.generate({ rng, target: 80, challenge: 80 });
    if (item.metadata.structure !== "decimal-digit-value") continue;
    const decimals = item.display.split(".")[1]?.padEnd(2, "0") ?? "00";
    assert.notEqual(decimals[0], decimals[1], `${item.display} repeats the target digit in both places`);
    assert.match(item.instruction, /hundredths digit/);
    assert.equal(Number(item.answer), Number(decimals[1]) / 100);
    checked += 1;
  }
  assert.ok(checked > 400);
});

test("division strategy facts stay integral and partitions genuinely split the dividend", () => {
  const family = QUESTION_FAMILIES.find((candidate) => candidate.id === "division-strategy-lab");
  assert.ok(family);
  const counts = { fact: 0, partition: 0, scale: 0 };

  for (let seed = 1; seed <= 5_000; seed += 1) {
    let state = seed;
    const rng = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const item = family.generate({ rng, target: 90, challenge: 90 });
    const divisor = Number(item.values.b);
    const [dividend, shownDivisor] = item.display.split(" ÷ ").map(Number);
    assert.equal(shownDivisor, divisor);

    if (item.metadata.structure === "divide-best-known-fact") {
      const match = String(item.answer).match(/^(\d+) ÷ (\d+) = (\d+)$/);
      assert.ok(match, `friendly fact was not an integer equality: ${item.answer}`);
      const [, knownDividend, knownDivisor, knownQuotient] = match.map(Number);
      assert.equal(knownDivisor, divisor);
      assert.equal(knownDividend / knownDivisor, knownQuotient);
      assert.ok(knownDividend < dividend, `${item.answer} does not simplify ${item.display}`);
      assert.ok(item.choices.every((choice) => !/\d+\.\d+/.test(String(choice))), `decimal division choice leaked into ${item.display}`);
      counts.fact += 1;
    }

    if (item.metadata.structure === "divide-partition") {
      const partition = item.scaffold.visual;
      assert.equal(partition.kind, "part-whole");
      assert.equal(partition.whole, dividend);
      assert.ok(partition.parts.length >= 2);
      assert.ok(partition.parts.every((part) => part > 0 && part < dividend && part % divisor === 0));
      assert.equal(partition.parts.reduce((sum, part) => sum + part, 0), dividend);
      counts.partition += 1;
    }

    if (item.metadata.structure === "divide-scale") {
      const match = item.scaffold.hint.match(/Use (\d+) ÷ (\d+) = (\d+), then scale by (\d+)\./);
      assert.ok(match, item.scaffold.hint);
      const [, knownDividend, knownDivisor, knownQuotient, scale] = match.map(Number);
      assert.equal(knownDivisor, divisor);
      assert.equal(knownDividend / knownDivisor, knownQuotient);
      assert.equal(knownDividend * scale, dividend);
      counts.scale += 1;
    }

    assert.equal(validateQuestion(item).valid, true, `${item.display}: ${validateQuestion(item).issues.join(", ")}`);
  }

  assert.ok(Object.values(counts).every((count) => count > 800), JSON.stringify(counts));
});

test("whole-number digit-value prompts name the exact place", () => {
  const family = QUESTION_FAMILIES.find((candidate) => candidate.id === "place-value-actions");
  assert.ok(family);
  const placeNames = new Map([[1000, "thousands"], [100, "hundreds"], [10, "tens"], [1, "ones"]]);
  let checked = 0;

  for (let seed = 1; seed <= 4_000; seed += 1) {
    let state = seed;
    const rng = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const item = family.generate({ rng, target: 80, challenge: 80 });
    if (item.metadata.structure !== "digit-value") continue;
    const place = Number(item.values.place);
    const placeName = placeNames.get(place);
    const value = Number(item.display.replaceAll(",", ""));
    const digit = Math.floor(value / place) % 10;
    assert.match(item.instruction, new RegExp(`${placeName} digit ${digit}`));
    assert.equal(Number(item.answer), digit * place);
    assert.equal(validateQuestion(item).valid, true, validateQuestion(item).issues.join(", "));
    checked += 1;
  }

  assert.ok(checked > 400);
});

test("proposed-answer judgements never label a false equality Yes", () => {
  const family = QUESTION_FAMILIES.find((candidate) => candidate.id === "reasonable-or-not");
  assert.ok(family);
  const structures = new Set();
  let yes = 0;
  let no = 0;

  for (let seed = 1; seed <= 5_000; seed += 1) {
    let state = seed;
    const rng = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const item = family.generate({ rng, target: 90, challenge: 90 });
    const display = item.display.replaceAll(",", "");
    const arithmetic = display.match(/^(\d+)\s*([+−×÷])\s*(\d+)\s*=\s*(\d+)$/);
    const placeValue = display.match(/^100 more than (\d+) is (\d+)$/);
    let isTrue;
    if (arithmetic) {
      const left = Number(arithmetic[1]);
      const right = Number(arithmetic[3]);
      const proposed = Number(arithmetic[4]);
      const exact = arithmetic[2] === "+" ? left + right : arithmetic[2] === "−" ? left - right : arithmetic[2] === "×" ? left * right : left / right;
      isTrue = exact === proposed;
    } else {
      assert.ok(placeValue, item.display);
      isTrue = Number(placeValue[1]) + 100 === Number(placeValue[2]);
    }
    assert.equal(item.answer, isTrue ? "Yes" : "No", `${item.display} was labelled ${item.answer}`);
    assert.match(item.instruction, /correct/i);
    assert.equal(validateQuestion(item).valid, true, validateQuestion(item).issues.join(", "));
    structures.add(item.metadata.structure);
    if (item.answer === "Yes") yes += 1;
    else no += 1;
  }

  assert.deepEqual(structures, new Set(family.structures));
  assert.ok(yes > 1_500 && no > 1_500, `Yes ${yes}, No ${no}`);
});

test("equality balancing always gives a positive keypad-enterable blank", () => {
  const family = QUESTION_FAMILIES.find((candidate) => candidate.id === "equality-balance");
  assert.ok(family);

  for (const challenge of [42, 45, 55, 70, 80, 90]) {
    for (let seed = 1; seed <= 2_000; seed += 1) {
      let state = seed + challenge * 10_000;
      const rng = () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
      };
      const item = family.generate({ rng, target: challenge, challenge });
      const equation = item.display.replaceAll(",", "").match(/^(\d+) \+ (\d+) = (\d+) \+ □$/);
      assert.ok(equation, item.display);
      const expected = Number(equation[1]) + Number(equation[2]) - Number(equation[3]);
      assert.ok(expected > 0, `${item.display} requires ${expected}`);
      assert.equal(Number(item.answer), expected);
      assert.equal(validateQuestion(item).valid, true, validateQuestion(item).issues.join(", "));
    }
  }

  const regression = new FluencyEngine({ seed: "neg-audit-45-1", challenge: 45, connectedSequences: false });
  for (let index = 0; index <= 204; index += 1) {
    const item = regression.next();
    if (item.family === "equality-balance") assert.ok(Number(item.answer) > 0, `${index}: ${item.display} → ${item.answer}`);
  }
});

test("missing factor, dividend and divisor scaffolds preserve the blank instead of drawing its answer", () => {
  const familyIds = ["missing-factor", "missing-dividend", "missing-divisor", "multiplication-foundation-models", "division-foundation-models"];
  const missingStructures = new Set(["missing-factor", "missing-dividend", "missing-divisor", "missing-groups", "missing-group-size", "missing-number-groups", "missing-group-size-division"]);
  const seen = new Set();

  for (const familyId of familyIds) {
    const family = QUESTION_FAMILIES.find((candidate) => candidate.id === familyId);
    assert.ok(family, familyId);
    for (let seed = 1; seed <= 1_000; seed += 1) {
      let state = seed;
      const rng = () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
      };
      const item = family.generate({ rng, target: 80, challenge: 80 });
      if (!missingStructures.has(item.metadata.structure)) continue;
      const visual = item.scaffold.visual;
      assert.equal(visual.kind, "relationship", `${familyId}/${item.metadata.structure} exposed the blank through ${visual.kind}`);
      assert.ok(String(visual.left).includes("□") || /missing/.test(String(visual.right)), `${familyId}/${item.metadata.structure} removed the unknown from the model`);
      seen.add(`${familyId}:${item.metadata.structure}`);
    }
  }

  for (const expected of [
    "missing-factor:missing-factor",
    "missing-dividend:missing-dividend",
    "missing-divisor:missing-divisor",
    "multiplication-foundation-models:missing-groups",
    "multiplication-foundation-models:missing-group-size",
    "division-foundation-models:missing-number-groups",
    "division-foundation-models:missing-group-size-division",
  ]) assert.ok(seen.has(expected), `${expected} was not exercised`);
});

test("remainder and large equal-group representations never draw a false capped total", () => {
  const remainderFamily = QUESTION_FAMILIES.find((candidate) => candidate.id === "division-remainder");
  assert.ok(remainderFamily);
  for (let seed = 1; seed <= 1_000; seed += 1) {
    let state = seed;
    const rng = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const item = remainderFamily.generate({ rng, target: 84, challenge: 84 });
    const match = String(item.answer).match(/^(\d+) remainder (\d+)$/);
    assert.ok(match);
    const quotient = Number(match[1]);
    const remainder = Number(match[2]);
    const divisor = Number(item.values.b);
    assert.equal(item.scaffold.visual.kind, "part-whole");
    assert.equal(item.scaffold.visual.whole, item.values.a);
    assert.deepEqual(item.scaffold.visual.parts, [divisor * quotient, remainder]);
    assert.equal(item.scaffold.visual.parts.reduce((sum, part) => sum + part, 0), item.scaffold.visual.whole);
  }

  for (const challenge of AUDIT_POINTS) {
    const engine = new FluencyEngine({ seed: `bounded-visual-${challenge}`, challenge });
    for (let index = 0; index < 800; index += 1) {
      const item = engine.next();
      for (const visual of [item.promptVisual, item.scaffold.visual]) {
        if (visual?.kind === "array") {
          assert.ok(Number(visual.rows) <= 12 && Number(visual.columns) <= 12 && Number(visual.rows) * Number(visual.columns) <= 96, `${item.family}: truncated array`);
        }
        if (visual?.kind === "groups") {
          assert.equal(Number(visual.total) % Number(visual.groupSize), 0, `${item.family}: remainder hidden in equal groups`);
          assert.ok(Number(visual.total) / Number(visual.groupSize) <= 12, `${item.family}: capped groups hide the true quotient`);
        }
        if (visual?.kind === "counters") {
          assert.ok(Number(visual.groups) <= 12 && Number(visual.perGroup) <= 12, `${item.family}: capped counters hide the true total`);
        }
      }
    }
  }
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
