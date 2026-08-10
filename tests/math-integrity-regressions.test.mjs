import test from "node:test";
import assert from "node:assert/strict";

import { FluencyEngine, QUESTION_FAMILIES, validateQuestion } from "../lib/fluency-engine.mjs";

function questionFamily(id) {
  const family = QUESTION_FAMILIES.find((candidate) => candidate.id === id);
  assert.ok(family, `Missing question family: ${id}`);
  return family;
}

function deterministicRng(seed = 0x9e3779b9) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

test("estimation models use the active question's estimation steps", () => {
  const cases = [
    {
      options: { seed: "audit-estimation-fluency", challenge: 70, permittedFamilies: ["estimation-fluency"], connectedSequences: false, fixedSequence: true },
      expected: { display: "1,560 − 569", answer: "1,000" },
    },
    {
      options: { seed: "audit-estimation", challenge: 70, permittedFamilies: ["estimation"], connectedSequences: false, fixedSequence: true },
      expected: { display: "224 + 748", answer: "900" },
    },
  ];

  for (const { options, expected } of cases) {
    const item = new FluencyEngine(options).next();
    assert.equal(item.display, expected.display);
    assert.equal(item.answer, expected.answer);
    assert.equal(item.scaffold.model.display, `Estimate ${item.display}`);
    assert.deepEqual(item.scaffold.model.lines, item.scaffold.steps);
    assert.equal(item.scaffold.model.answer, item.answer);
    assert.doesNotMatch(item.scaffold.model.lines.join(" | "), /50 − 8 = 42|42 ÷ 3 = 14|12 × 4 = 48|48 \+ 7 = 55/);
  }
});

test("twenty-bond ten-frames preserve the complete known addend", () => {
  const exact = new FluencyEngine({
    seed: "bond20-0",
    challenge: 18,
    mode: "focus",
    focus: "addition",
    permittedFamilies: ["foundation-bond-network"],
    connectedSequences: false,
    fixedSequence: true,
  });
  const item = Array.from({ length: 4 }, () => exact.next()).at(-1);
  assert.deepEqual(
    { display: item.display, answer: item.answer, visual: item.scaffold.visual },
    { display: "□ + 18 = 20", answer: "2", visual: { kind: "ten-frame", title: "Make 20", filled: 18, total: 20 } },
  );

  const family = questionFamily("foundation-bond-network");
  const rng = deterministicRng(20);
  let twentyFrames = 0;
  for (let index = 0; index < 2_000; index += 1) {
    const candidate = family.generate({ rng, target: 18, challenge: 18 });
    if (candidate.values.boundary !== 20 || candidate.scaffold.visual.kind !== "ten-frame") continue;
    assert.equal(candidate.scaffold.visual.filled, candidate.values.a);
    assert.equal(candidate.scaffold.visual.total, 20);
    assert.equal(validateQuestion(candidate).valid, true, validateQuestion(candidate).issues.join(", "));
    twentyFrames += 1;
  }
  assert.ok(twentyFrames > 400);
});

test("double and half representations show the known structure without labelling the answer", () => {
  const exact = new FluencyEngine({
    seed: "doublehalf-0",
    challenge: 15,
    mode: "focus",
    focus: "number",
    permittedFamilies: ["double-half"],
    connectedSequences: false,
    fixedSequence: true,
  }).next();
  assert.equal(exact.display, "Half of 16");
  assert.equal(exact.answer, "8");
  assert.deepEqual(exact.scaffold.visual, { kind: "bar-model", title: "Split 16 into two equal parts", segments: 2, filled: 1, total: 16 });

  const family = questionFamily("double-half");
  const rng = deterministicRng(0xd0ab1e);
  let doubles = 0;
  let halves = 0;
  for (let index = 0; index < 500; index += 1) {
    const item = family.generate({ rng, target: 35, challenge: 35 });
    if (item.display.startsWith("Double ")) {
      assert.equal(item.scaffold.visual.kind, "relationship");
      assert.equal(item.scaffold.visual.left, String(item.values.a));
      assert.equal(item.scaffold.visual.right, `${item.values.a} + ${item.values.a}`);
      assert.notEqual(item.scaffold.visual.right, String(item.answer));
      doubles += 1;
    } else {
      const whole = Number(item.display.match(/Half of (\d+)/)?.[1]);
      assert.equal(item.scaffold.visual.kind, "bar-model");
      assert.equal(item.scaffold.visual.total, whole);
      assert.equal(item.scaffold.visual.segments, 2);
      assert.equal(item.scaffold.visual.filled, 1);
      assert.deepEqual(item.values, { a: whole, b: 2, part: Number(item.answer) });
      halves += 1;
    }
  }
  assert.ok(doubles > 150 && halves > 150);
});

test("missing-whole fraction bars keep the unknown whole concealed", () => {
  const exact = new FluencyEngine({
    seed: "missing-whole-0",
    challenge: 60,
    mode: "focus",
    focus: "fractions",
    permittedFamilies: ["fraction-quantity-network"],
    connectedSequences: false,
    fixedSequence: true,
  }).next();
  assert.equal(exact.display, "¼ of □ = 8");
  assert.equal(exact.answer, "32");
  assert.deepEqual(exact.scaffold.visual, { kind: "bar-model", title: "Build the unknown whole", segments: 4, filled: 1, total: null });

  const family = questionFamily("fraction-quantity-network");
  const rng = deterministicRng(0xfac710);
  let checked = 0;
  for (let index = 0; index < 2_000; index += 1) {
    const item = family.generate({ rng, target: 80, challenge: 80 });
    if (item.metadata.structure !== "fraction-missing-whole") continue;
    assert.equal(item.scaffold.visual.kind, "bar-model");
    assert.equal(item.scaffold.visual.total, null);
    assert.equal(item.scaffold.visual.segments, item.values.denominator);
    assert.equal(item.scaffold.visual.filled, 1);
    checked += 1;
  }
  assert.ok(checked > 250);
});

test("sequence number lines conceal whichever term the pupil must supply", () => {
  const exact = new FluencyEngine({
    seed: "sequenceReveal-0",
    challenge: 70,
    mode: "focus",
    focus: "number",
    permittedFamilies: ["intelligent-sequences"],
    connectedSequences: false,
    fixedSequence: true,
  }).next();
  assert.equal(exact.display, "16, 8, 4, □");
  assert.equal(exact.answer, "2");
  assert.equal(exact.scaffold.visual.unknown, 3);
  assert.equal(exact.scaffold.visual.markers[3], 2);

  for (const familyId of ["sequence", "intelligent-sequences"]) {
    const family = questionFamily(familyId);
    const rng = deterministicRng(familyId.length * 997);
    let checked = 0;
    for (let index = 0; index < 1_000; index += 1) {
      const item = family.generate({ rng, target: 80, challenge: 80 });
      if (!item.display.includes("□") || item.scaffold.visual.kind !== "number-line") continue;
      const markers = item.scaffold.visual.markers ?? item.scaffold.visual.points;
      const expectedUnknown = item.metadata.structure === "sequence-missing-middle" ? 1 : markers.length - 1;
      assert.equal(item.scaffold.visual.unknown, expectedUnknown, `${familyId}: ${item.display}`);
      assert.equal(String(markers[expectedUnknown]), String(item.answer));
      checked += 1;
    }
    assert.ok(checked > 300, `${familyId} did not exercise enough concealed terms`);
  }
});

test("tens-and-ones recall explicitly asks for a place-value digit", () => {
  const family = questionFamily("tens-ones");
  const rng = deterministicRng(0x10e5);
  for (let index = 0; index < 500; index += 1) {
    const item = family.generate({ rng, target: 30, challenge: 30 });
    const match = item.display.match(/^What digit is in the (tens|ones) place of ([\d,]+)\?$/);
    assert.ok(match, item.display);
    const value = Number(match[2].replaceAll(",", ""));
    const expected = match[1] === "tens" ? Math.floor(value / 10) % 10 : value % 10;
    assert.equal(Number(item.answer), expected);
  }
});

test("equivalent-to-half metadata describes both displayed fractions", () => {
  const family = questionFamily("fraction-equivalence-missing");
  const rng = deterministicRng(0x1a1f);
  let checked = 0;
  for (let index = 0; index < 2_000; index += 1) {
    const item = family.generate({ rng, target: 80, challenge: 80 });
    if (item.metadata.structure !== "fraction-equivalent-to-half") continue;
    assert.deepEqual(
      item.values,
      {
        numerator: 1,
        denominator: 2,
        equivalentNumerator: Number(item.answer),
        equivalentDenominator: item.scaffold.visual.denominator,
      },
    );
    assert.equal(item.scaffold.visual.numerator, item.values.equivalentNumerator);
    assert.equal(item.scaffold.visual.denominator, item.values.equivalentDenominator);
    checked += 1;
  }
  assert.ok(checked > 250);
});

test("decimal visuals preserve whole-number parts and both addends", () => {
  const placeFamily = questionFamily("decimal-place-relations");
  for (const target of [60, 80]) {
    const rng = deterministicRng(target);
    let wholeValues = 0;
    for (let index = 0; index < 1_500; index += 1) {
      const item = placeFamily.generate({ rng, target, challenge: target });
      if (item.metadata.structure === "decimal-hundred-grid") {
        assert.equal(item.scaffold.visual.kind, "hundred-grid");
        assert.equal(item.values.numerator, item.scaffold.visual.filled);
        assert.equal(item.values.denominator, 100);
        assert.equal(Number(item.answer), item.values.numerator / item.values.denominator);
        assert.equal(item.values.a, Number(item.answer));
        continue;
      }
      const value = Number(item.values.a);
      const whole = Math.floor(value);
      if (whole === 0) continue;
      assert.equal(item.scaffold.visual.kind, "relationship");
      assert.equal(item.scaffold.visual.left, `${whole} ${whole === 1 ? "one" : "ones"}`);
      assert.match(item.scaffold.visual.right, /\d+ tenths/);
      if (target > 68) assert.match(item.scaffold.visual.right, /\d+ hundredths/);
      wholeValues += 1;
    }
    assert.ok(wholeValues > 700);
  }

  const additionFamily = questionFamily("decimal-comparison-and-complements");
  const additionRng = deterministicRng(0xdec1a1);
  let additions = 0;
  for (let index = 0; index < 2_000; index += 1) {
    const item = additionFamily.generate({ rng: additionRng, target: 80, challenge: 80 });
    if (item.metadata.structure !== "decimal-add-tenths") continue;
    const { a, b } = item.values;
    assert.equal(item.scaffold.visual.kind, "relationship");
    assert.equal(item.scaffold.visual.left, `${a} = ${Math.round(a * 10)} tenths`);
    assert.equal(item.scaffold.visual.right, `${b} = ${Math.round(b * 10)} tenths`);
    assert.equal(Number(item.answer), Number((a + b).toFixed(1)));
    additions += 1;
  }
  assert.ok(additions > 250);
});

test("near-round product comparisons use a distinct round-boundary structure", () => {
  const family = questionFamily("multiplicative-calculation-comparison");
  const rng = deterministicRng(0xc04a);
  const seen = new Set();
  for (let index = 0; index < 2_000; index += 1) {
    const item = family.generate({ rng, target: 90, challenge: 90 });
    if (!["compare-balanced-product", "compare-near-round-product"].includes(item.metadata.structure)) continue;
    seen.add(item.metadata.structure);
    const left = item.scaffold.visual.left.match(/^(\d+) × (\d+)$/)?.slice(1).map(Number);
    const right = item.scaffold.visual.right.match(/^(\d+) × (\d+)$/)?.slice(1).map(Number);
    assert.ok(left && right);
    const leftValue = left[0] * left[1];
    const rightValue = right[0] * right[1];
    const expected = leftValue === rightValue ? "Equal" : leftValue > rightValue ? item.scaffold.visual.left : item.scaffold.visual.right;
    assert.equal(item.answer, expected);
    if (item.metadata.structure === "compare-near-round-product") {
      assert.equal(left[0] % 10, 9);
      assert.equal(right[0] % 10, 0);
      assert.equal(right[0], left[0] + 1);
      assert.equal(right[1], left[1] - 1);
      assert.deepEqual(item.values, { a: left[0], b: left[1], round: right[0] });
    }
  }
  assert.deepEqual(seen, new Set(["compare-balanced-product", "compare-near-round-product"]));
});

test("error-spotting identifies the first error and models the corrected method", () => {
  const engine = new FluencyEngine({
    seed: "worked-error-corrections",
    challenge: 90,
    permittedFamilies: ["worked-error-spotting"],
    connectedSequences: false,
    fixedSequence: true,
  });
  const expected = {
    "error-addition-partition": { errorLine: -1, line: "638 + 5 = 643" },
    "error-subtraction-compensation": { errorLine: 2, line: "202 + 2 = 204" },
    "error-multiplication-partial": { errorLine: 3, line: "240 + 48 = 288" },
    "error-division-inverse": { errorLine: 2, line: "So 420 ÷ 7 = 60" },
    "error-fraction-unit": { errorLine: 1, line: "20 ÷ 4 = 5" },
  };
  const seen = new Set();

  for (let index = 0; index < 300 && seen.size < Object.keys(expected).length; index += 1) {
    const item = engine.next();
    const contract = expected[item.metadata.structure];
    assert.ok(contract, item.metadata.structure);
    assert.equal(item.promptVisual.errorLine, contract.errorLine);
    assert.equal(item.scaffold.visual.errorLine, contract.errorLine);
    assert.equal(item.scaffold.model.display, item.display);
    assert.equal(item.scaffold.model.answer, item.answer);
    assert.ok(item.scaffold.model.lines.includes(contract.line), `${item.metadata.structure}: ${item.scaffold.model.lines.join(" | ")}`);
    seen.add(item.metadata.structure);
  }
  assert.deepEqual(seen, new Set(Object.keys(expected)));
});

test("the reported 14 × 7 + 58 case shows operation order instead of an unrelated number line", () => {
  const family = questionFamily("chained-calculation");
  const rolls = [0.09, 0.60, 0.68];
  let roll = 0;
  const item = family.generate({ rng: () => rolls[roll++], target: 78, challenge: 78 });

  assert.equal(item.display, "14 × 7 + 58");
  assert.equal(item.answer, "156");
  assert.deepEqual(item.values, { a: 14, b: 7, c: 58, product: 98 });
  assert.equal(item.promptVisual, null);
  assert.deepEqual(item.scaffold.visual, {
    kind: "relationship",
    title: "Do the multiplication first",
    left: "14 × 7 = 98",
    right: "98 + 58 = □",
    connector: "then",
  });
  assert.deepEqual(item.scaffold.steps, ["14 × 7 = 98", "98 + 58 = □"]);
  assert.deepEqual(item.scaffold.model, {
    title: "Work in operation order",
    display: "14 × 7 + 58",
    lines: ["14 × 7 = 98", "98 + 58 = 156"],
    answer: "156",
  });
  assert.equal(validateQuestion(item).valid, true, validateQuestion(item).issues.join(", "));
});

test("original mixed-calculation families use question-specific scaffold visuals and models", () => {
  const familyIds = [
    "estimation",
    "odd-one-out",
    "chained-calculation",
    "sum-and-difference",
    "missing-operation-chain",
    "calculation-comparison",
    "true-false-equation",
    "find-the-error",
  ];

  for (const [familyIndex, familyId] of familyIds.entries()) {
    const family = questionFamily(familyId);
    const rng = deterministicRng(0x4a1100 + familyIndex * 997);
    for (let index = 0; index < 500; index += 1) {
      const item = family.generate({ rng, target: 85, challenge: 85 });
      const visual = item.scaffold.visual;
      assert.equal(item.promptVisual, null, `${familyId}: an unsolicited prompt visual was added`);
      assert.equal(visual.kind, "relationship", `${familyId}: ${JSON.stringify(visual)}`);
      assert.notEqual(visual.left, "known fact", familyId);
      assert.notEqual(visual.right, "new fact", familyId);
      assert.doesNotMatch(JSON.stringify(visual), /Place the numbers|"kind":"number-line"/, familyId);
      assert.equal(item.scaffold.model.display, item.display, familyId);
      assert.equal(String(item.scaffold.model.answer), String(item.answer), familyId);
      const validation = validateQuestion(item);
      assert.equal(validation.valid, true, `${familyId}: ${validation.issues.join(", ")}`);
    }
  }
});

test("every mixed family avoids the unsafe two-value number-line fallback", () => {
  const mixedFamilies = QUESTION_FAMILIES.filter((family) => family.strand === "mixed");
  assert.ok(mixedFamilies.length >= 20);

  for (const [familyIndex, family] of mixedFamilies.entries()) {
    const target = Math.max(family.min, Math.min(92, Math.round((family.min + family.max) / 2)));
    const rng = deterministicRng(0x4d1850 + familyIndex * 313);
    for (let index = 0; index < 500; index += 1) {
      const item = family.generate({ rng, target, challenge: target });
      for (const visual of [item.promptVisual, item.scaffold.visual].filter(Boolean)) {
        assert.doesNotMatch(String(visual.kind), /^(number-line|bead-string)$/, `${family.id}/${item.metadata.structure}`);
        if (visual.kind !== "relationship") continue;
        assert.doesNotMatch(String(visual.left), /^(known|new|known fact|new fact)$/i, `${family.id}/${item.metadata.structure}`);
        assert.doesNotMatch(String(visual.right), /^(known|new|known fact|new fact)$/i, `${family.id}/${item.metadata.structure}`);
      }
      const validation = validateQuestion(item);
      assert.equal(validation.valid, true, `${family.id}/${item.metadata.structure}: ${validation.issues.join(", ")}`);
    }

    const engine = new FluencyEngine({
      seed: `mixed-stage-${family.id}`,
      challenge: target,
      permittedFamilies: [family.id],
      connectedSequences: false,
      fixedSequence: true,
    });
    for (let index = 0; index < 20; index += 1) {
      const item = engine.next();
      const expectedModelDisplay = /estimat/i.test(`${item.family} ${item.subskill}`) ? `Estimate ${item.display}` : item.display;
      assert.equal(item.scaffold.model.display, expectedModelDisplay, family.id);
      assert.equal(String(item.scaffold.model.answer), String(item.answer), family.id);
    }
  }
});

test("forward and reverse operation chains preserve one semantic path through every help stage", () => {
  const forward = new FluencyEngine({
    seed: "mixed-chain-stage-contract",
    challenge: 84,
    permittedFamilies: ["chained-calculation", "missing-operation-chain"],
    connectedSequences: false,
    fixedSequence: true,
  });

  for (let index = 0; index < 500; index += 1) {
    const item = forward.next();
    assert.equal(item.promptVisual, null);
    assert.equal(item.scaffold.visual.kind, "relationship");
    assert.equal(item.scaffold.visual.left, item.scaffold.steps[0]);
    assert.equal(item.scaffold.visual.right, item.scaffold.steps[1]);
    assert.equal(item.scaffold.visual.connector, "then");
    assert.equal(item.scaffold.model.display, item.display);
    assert.equal(String(item.scaffold.model.answer), String(item.answer));
    assert.doesNotMatch(JSON.stringify(item.scaffold.visual), /number-line|Place the numbers/);
    const validation = validateQuestion(item);
    assert.equal(validation.valid, true, `${item.display}: ${validation.issues.join(", ")}`);
  }

  const legacyWrongVisual = questionFamily("chained-calculation").generate({ rng: deterministicRng(7), target: 78, challenge: 78 });
  legacyWrongVisual.scaffold.visual = { kind: "number-line", title: "Place the numbers", min: 7, max: 14, points: [14, 7] };
  const invalid = validateQuestion(legacyWrongVisual);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.issues.includes("Chained calculation visual must show the two calculation stages in order"));
});

test("all multi-step missing-number structures have accurate algebra and matching visual and model stages", () => {
  const family = questionFamily("multi-step-missing-number");
  const rng = deterministicRng(0x4a1104);
  const seen = new Set();

  for (let index = 0; index < 4_000; index += 1) {
    const item = family.generate({ rng, target: 92, challenge: 92 });
    const compact = item.display.replaceAll(",", "");
    let expected;
    let match = compact.match(/^(\d+) × □ \+ (\d+) = (\d+)$/);
    if (match) expected = (Number(match[3]) - Number(match[2])) / Number(match[1]);
    match ??= compact.match(/^(\d+) × □ − (\d+) = (\d+)$/);
    if (match && expected === undefined) expected = (Number(match[3]) + Number(match[2])) / Number(match[1]);
    match = compact.match(/^\(□ \+ (\d+)\) × (\d+) = (\d+)$/);
    if (match) expected = Number(match[3]) / Number(match[2]) - Number(match[1]);
    match = compact.match(/^□ ÷ (\d+) \+ (\d+) = (\d+)$/);
    if (match) expected = (Number(match[3]) - Number(match[2])) * Number(match[1]);
    match = compact.match(/^(\d+) − □ − (\d+) = (\d+)$/);
    if (match) expected = Number(match[1]) - Number(match[2]) - Number(match[3]);
    match = compact.match(/^(\d+) × □ = (\d+) − (\d+)$/);
    if (match) expected = (Number(match[2]) - Number(match[3])) / Number(match[1]);

    assert.equal(Number(item.answer), expected, `${item.metadata.structure}: ${item.display}`);
    assert.equal(item.scaffold.visual.kind, "relationship");
    assert.equal(item.scaffold.visual.left, item.scaffold.steps[0]);
    assert.equal(item.scaffold.visual.right, item.scaffold.steps[1]);
    assert.equal(item.scaffold.visual.connector, "then");
    assert.match(item.scaffold.visual.right, /□/);
    assert.equal(item.scaffold.model.display, item.display);
    assert.equal(String(item.scaffold.model.answer), String(item.answer));
    assert.doesNotMatch(item.scaffold.model.lines.at(-1), /□/);
    const validation = validateQuestion(item);
    assert.equal(validation.valid, true, `${item.metadata.structure}: ${validation.issues.join(", ")}`);
    seen.add(item.metadata.structure);
  }

  assert.deepEqual(seen, new Set(family.structures));
});
