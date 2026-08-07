const GLYPHS = {
  "1/2": "½", "1/3": "⅓", "2/3": "⅔", "1/4": "¼", "3/4": "¾",
  "1/5": "⅕", "2/5": "⅖", "3/5": "⅗", "4/5": "⅘",
  "1/8": "⅛", "3/8": "⅜", "5/8": "⅝", "7/8": "⅞",
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const integer = (rng, min, max) => Math.floor(rng() * (max - min + 1)) + min;
const pick = (rng, values) => values[Math.floor(rng() * values.length)];

function shuffle(rng, values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function gcd(a, b) {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right) [left, right] = [right, left % right];
  return left || 1;
}

const format = (value) => Number(value).toLocaleString("en-GB", { maximumFractionDigits: 2 });
const fraction = (numerator, denominator) => `${numerator}/${denominator}`;
const fractionToken = (numerator, denominator) => GLYPHS[fraction(numerator, denominator)] ?? `[[${numerator}/${denominator}]]`;
const placeCount = (count, unit) => `${count} ${unit}${count === 1 ? "" : "s"}`;

function choices(rng, answer, distractors, limit = 4) {
  const result = [...new Set([String(answer), ...distractors.map(String)])];
  return shuffle(rng, result).slice(0, Math.max(2, Math.min(limit, result.length)));
}

const visual = {
  tenFrame: (filled, total = 10, title = "See the bond") => ({ kind: "ten-frame", title, filled, total }),
  beadString: (min, max, points, title = "Bridge on the bead string") => ({ kind: "bead-string", title, min, max, points }),
  partWhole: (whole, parts, title = "See the parts and whole") => ({ kind: "part-whole", title, whole, parts }),
  array: (rows, columns, title = `${rows} rows of ${columns}`) => ({ kind: "array", title, rows, columns }),
  counters: (groups, perGroup, title = `${groups} equal groups`) => ({ kind: "counters", title, groups, perGroup }),
  groups: (total, groupSize, title = `Group ${total} in ${groupSize}s`) => ({ kind: "groups", title, total, groupSize }),
  rectangle: (factor, parts, title = "Partition the rectangle") => ({ kind: "multiplication-rectangle", title, factor, parts }),
  placeValue: (value, title = "See each place") => ({ kind: "base-ten", title, value }),
  placeGrid: (rows, operator = "", title = "See the place values") => ({ kind: "place-value", title, rows, operator }),
  fractionStrip: (numerator, denominator, title = "See the fraction") => ({ kind: "fraction-strip", title, numerator, denominator }),
  bar: (segments, filled, total = null, title = "See equal parts") => ({ kind: "bar-model", title, segments, filled, total }),
  hundredGrid: (filled, title = "See the hundredths") => ({ kind: "hundred-grid", title, filled }),
  numberLine: (min, max, markers, ticks = 5, unknown = null, title = "Use the number line") => ({ kind: "number-line", title, min, max, markers, ticks, unknown }),
  relationship: (left, right, connector = "helps", title = "Connect the facts") => ({ kind: "relationship", title, left, right, connector }),
  worked: (lines, errorLine = -1, title = "Check the method") => ({ kind: "worked-example", title, lines, errorLine }),
};

function modelFor(strand) {
  const models = {
    addition: { title: "Watch", display: "48 + 27", lines: ["48 + 20 = 68", "68 + 7 = 75"], answer: "75" },
    subtraction: { title: "Watch", display: "502 − 298", lines: ["502 − 300 = 202", "202 + 2 = 204"], answer: "204" },
    multiplication: { title: "Watch", display: "48 × 6", lines: ["50 × 6 = 300", "2 × 6 = 12", "300 − 12 = 288"], answer: "288" },
    division: { title: "Watch", display: "420 ÷ 7", lines: ["42 ÷ 7 = 6", "420 is 10 times 42", "420 ÷ 7 = 60"], answer: "60" },
    fractions: { title: "Watch", display: "[[3/4]] of 20", lines: ["20 ÷ 4 = 5", "5 × 3 = 15"], answer: "15" },
    decimals: { title: "Watch", display: "1 − 0.4", lines: ["10 tenths − 4 tenths", "= 6 tenths"], answer: "0.6" },
    "place value": { title: "Watch", display: "4,582", lines: ["4 thousands + 5 hundreds", "+ 8 tens + 2 ones"], answer: "4,582" },
    number: { title: "Watch", display: "Halfway: 3,200 — 3,600", lines: ["The gap is 400", "Half the gap is 200", "3,200 + 200 = 3,400"], answer: "3,400" },
    mixed: { title: "Watch", display: "3 × □ + 8 = 50", lines: ["50 − 8 = 42", "42 ÷ 3 = 14"], answer: "14" },
  };
  return models[strand] ?? models.mixed;
}

function makeQuestion(definition, payload) {
  const values = payload.values ?? {};
  const itemVisual = payload.visual ?? visual.relationship("known", "new");
  return {
    id: "",
    family: definition.id,
    strand: definition.strand,
    subskill: definition.subskill,
    difficulty: clamp(Math.round(payload.difficulty), 0, 100),
    type: payload.type ?? "numeric",
    display: payload.display,
    instruction: payload.instruction ?? null,
    answer: String(payload.answer),
    answerType: payload.answerType ?? "whole",
    acceptableAnswers: (payload.acceptableAnswers ?? []).map(String),
    choices: payload.choices ?? null,
    values,
    misconceptions: payload.misconceptions ?? {},
    promptVisual: payload.promptVisual ?? null,
    scaffold: {
      hint: payload.hint ?? "Look for a fact or relationship you know.",
      visual: itemVisual,
      steps: payload.steps ?? ["Choose a useful first step.", "Use it to finish."],
      model: payload.model ?? modelFor(definition.strand),
      alternatives: payload.alternatives ?? [],
    },
    relatedFollowUp: payload.relatedFollowUp ?? definition.id,
    connections: payload.connections ?? [],
    metadata: {
      concept: definition.subskill,
      range: [definition.min, definition.max],
      structure: payload.structure ?? definition.structures?.[0] ?? definition.id,
      strategy: payload.strategy ?? null,
      operation: payload.operation ?? null,
      thinking: definition.thinking ?? 1,
      speed: definition.speed ?? "strategy",
      modes: definition.modes ?? ["mix", "focus"],
      retrievalKey: payload.retrievalKey ?? `${definition.strand}:${definition.subskill}`,
      designedConnection: Boolean(payload.designedConnection),
    },
  };
}

const define = (definition) => ({
  modes: ["mix", "focus"],
  speed: "strategy",
  thinking: 1,
  ...definition,
});

const bondStructures = [
  "bond-missing-right-10", "bond-missing-left-10", "bond-subtraction-10", "bond-related-10",
  "bond-missing-right-20", "bond-missing-left-20", "bond-subtraction-20", "bond-related-20",
  "bond-missing-right-50", "bond-missing-left-50", "bond-subtraction-50", "bond-related-50",
  "bond-missing-right-100", "bond-missing-left-100", "bond-subtraction-100", "bond-related-100",
];

export const BUILD2_FAMILIES = [
  define({
    id: "foundation-bond-network", strand: "addition", subskill: "connected number bonds", min: 0, max: 38,
    speed: "recall", modes: ["mix", "focus", "quick", "my-mix"], structures: bondStructures,
    generate({ rng, target, challenge = target }) {
      const boundaries = challenge < 10 ? [10] : challenge < 20 ? [10, 20] : challenge < 30 ? [20, 50] : [50, 100];
      const boundary = pick(rng, boundaries);
      const step = boundary <= 20 ? 1 : boundary === 50 ? 5 : 10;
      const form = pick(rng, ["missing-right", "missing-left", "subtraction", "related"]);
      const baseA = form === "related" ? integer(rng, 1, 9) : null;
      const a = baseA === null ? integer(rng, 1, boundary / step - 1) * step : baseA * (boundary / 10);
      const complement = boundary - a;
      const common = {
        difficulty: 4 + Math.log10(boundary) * 8 + (form === "related" ? 6 : 0), values: { a, b: complement, boundary },
        visual: boundary <= 20 ? visual.tenFrame(Math.min(a, 10), boundary, `Make ${boundary}`) : visual.partWhole(boundary, [a, complement]),
        hint: `Find the gap from ${format(a)} to ${format(boundary)}.`,
        steps: [`Start with ${format(a)}.`, `Count on to ${format(boundary)}.`],
        structure: `bond-${form}-${boundary}`,
        strategy: "complement",
      };
      if (form === "missing-left") return makeQuestion(this, { ...common, display: `□ + ${format(a)} = ${format(boundary)}`, answer: complement });
      if (form === "subtraction") return makeQuestion(this, { ...common, display: `${format(boundary)} − ${format(a)}`, answer: complement, operation: "subtraction" });
      if (form === "related") {
        const baseB = 10 - baseA;
        return makeQuestion(this, {
          ...common, instruction: `If ${baseA} + ${baseB} = 10, complete`, display: `${format(a)} + □ = ${format(boundary)}`, answer: complement,
          visual: visual.relationship(`${baseA} + ${baseB} = 10`, `${format(a)} + ${format(complement)} = ${format(boundary)}`, "scales to"),
        });
      }
      return makeQuestion(this, { ...common, display: `${format(a)} + □ = ${format(boundary)}`, answer: complement });
    },
  }),
  define({
    id: "foundation-addition-strategies", strand: "addition", subskill: "foundational addition strategies", min: 2, max: 45,
    speed: "recall", modes: ["mix", "focus", "quick", "my-mix"],
    structures: ["add-1", "add-2", "add-10", "add-tens", "bridge-10", "bridge-100", "compensate-9-19", "near-double-foundation", "make-whole-foundation"],
    generate({ rng, target, challenge = target }) {
      const available = challenge < 10 ? ["add-1", "add-2", "add-10"] : challenge < 20 ? ["add-10", "bridge-10", "near-double-foundation"] : challenge < 24 ? ["add-tens", "bridge-10", "near-double-foundation"] : ["bridge-100", "compensate-9-19", "make-whole-foundation", "add-tens"];
      const structure = pick(rng, available);
      let a; let b; let hint; let itemVisual; let strategy = structure;
      if (structure === "add-1" || structure === "add-2") { a = integer(rng, 3, 49); b = structure === "add-1" ? 1 : 2; hint = "Count on."; itemVisual = visual.beadString(a, a + b, [a, a + b], "Count on"); }
      else if (structure === "add-10") { a = integer(rng, 11, 89); b = 10; hint = "Only the tens change."; itemVisual = visual.placeValue(a); }
      else if (structure === "add-tens") { a = integer(rng, 12, 79); b = integer(rng, 1, 5) * 10; hint = "Add tens to tens."; itemVisual = visual.placeValue(a); }
      else if (structure === "bridge-10") { a = integer(rng, 6, 9); b = integer(rng, 11 - a, 9); hint = "Make 10 first."; itemVisual = visual.beadString(a, a + b, [a, 10, a + b]); }
      else if (structure === "bridge-100") { a = integer(rng, 84, 99); b = integer(rng, 101 - a, 18); hint = "Make 100 first."; itemVisual = visual.beadString(a, a + b, [a, 100, a + b]); }
      else if (structure === "compensate-9-19") { a = integer(rng, 22, 88); b = pick(rng, [9, 19]); hint = `Add ${b + 1}, then subtract 1.`; itemVisual = visual.relationship(`${a} + ${b + 1}`, "− 1", "then"); strategy = "compensation"; }
      else if (structure === "near-double-foundation") { a = integer(rng, 6, challenge < 20 ? 10 : 39); b = a + pick(rng, [-1, 1]); hint = `Use double ${Math.min(a, b)}, then adjust.`; itemVisual = visual.partWhole(a + b, [a, b], "See the near double"); strategy = "near double"; }
      else { a = integer(rng, 3, 9) * 10 + integer(rng, 1, 8); b = 100 - a; hint = "These numbers make a whole hundred."; itemVisual = visual.partWhole(100, [a, b]); strategy = "make a whole"; }
      return makeQuestion(this, {
        difficulty: clamp(target + (structure.includes("100") ? 4 : 0), 5, 44), display: `${a} + ${b}`, answer: a + b, values: { a, b },
        structure, strategy, operation: "addition", hint, visual: itemVisual,
        steps: strategy === "compensation" ? [`${a} + ${b + 1} = ${a + b + 1}`, "Subtract 1."] : [hint, "Finish from the helpful landmark."],
        alternatives: structure === "bridge-100" ? [`Partition: ${a} + ${Math.floor(b / 10) * 10} + ${b % 10}`, `Bridge: ${a} + ${100 - a} + ${b - (100 - a)}`] : [],
      });
    },
  }),
  define({
    id: "foundation-subtraction-strategies", strand: "subtraction", subskill: "foundational subtraction strategies", min: 3, max: 47,
    speed: "recall", modes: ["mix", "focus", "quick", "my-mix"],
    structures: ["subtract-1", "subtract-2", "subtract-10", "subtract-tens", "cross-10", "cross-100", "difference-count-up", "subtract-compensation", "inverse-subtraction"],
    generate({ rng, target, challenge = target }) {
      const available = challenge < 11 ? ["subtract-1", "subtract-2", "subtract-10"] : challenge < 20 ? ["subtract-1", "subtract-2", "subtract-10", "cross-10"] : challenge < 26 ? ["subtract-tens", "cross-10", "inverse-subtraction"] : ["cross-100", "difference-count-up", "subtract-compensation", "subtract-tens"];
      const structure = pick(rng, available);
      let a; let b; let hint; let itemVisual; let strategy = structure;
      if (structure === "subtract-1" || structure === "subtract-2") { a = integer(rng, 5, 50); b = structure === "subtract-1" ? 1 : 2; hint = "Count back."; itemVisual = visual.beadString(a - b, a, [a - b, a], "Count back"); }
      else if (structure === "subtract-10") { a = integer(rng, 21, 99); b = 10; hint = "Only the tens change."; itemVisual = visual.placeValue(a); }
      else if (structure === "subtract-tens") { b = integer(rng, 1, 5) * 10; a = integer(rng, Math.ceil((b + 12) / 10), 9) * 10 + integer(rng, 1, 9); hint = "Subtract tens from tens."; itemVisual = visual.placeValue(a); }
      else if (structure === "cross-10") { a = integer(rng, 12, 19); b = integer(rng, (a % 10) + 1, 9); hint = "Step back to 10 first."; itemVisual = visual.beadString(a - b, a, [a - b, 10, a]); }
      else if (structure === "cross-100") { a = integer(rng, 102, 119); b = integer(rng, (a % 100) + 1, Math.min(39, a - 1)); hint = "Step back through 100."; itemVisual = visual.beadString(a - b, a, [a - b, 100, a]); }
      else if (structure === "difference-count-up") { b = integer(rng, 44, 92); a = b + integer(rng, 2, 18); hint = "The numbers are close. Count up to find the gap."; itemVisual = visual.numberLine(b, a, [b, a], 4); strategy = "counting up"; }
      else if (structure === "subtract-compensation") { b = pick(rng, [98, 198, 299]); a = integer(rng, b + 2, 700); hint = `Subtract ${b + (b % 100 === 99 ? 1 : 2)}, then adjust.`; itemVisual = visual.relationship(`${a} − ${Math.round(b / 100) * 100}`, "+ adjustment", "then"); strategy = "compensation"; }
      else { b = integer(rng, 8, 40); const answer = integer(rng, 12, 60); a = b + answer; hint = `Think: ${b} + □ = ${a}.`; itemVisual = visual.partWhole(a, [b, answer]); strategy = "inverse"; }
      return makeQuestion(this, {
        difficulty: clamp(target + (structure.includes("100") ? 3 : 0), 6, 46), display: `${a} − ${b}`, answer: a - b, values: { a, b },
        structure, strategy, operation: "subtraction", hint, visual: itemVisual,
        steps: [hint, "Use the landmark or inverse to finish."],
      });
    },
  }),
  define({
    id: "multiplication-foundation-models", strand: "multiplication", subskill: "multiplication foundations", min: 5, max: 42,
    focus: "tables", speed: "recall", modes: ["mix", "focus", "quick", "my-mix"],
    structures: ["equal-groups", "repeated-addition", "array-to-fact", "skip-count-next", "missing-groups", "missing-group-size"],
    generate({ rng, target, challenge = target }) {
      const factorChoices = challenge < 20 ? [2, 5, 10] : [2, 3, 4, 5, 8, 10];
      const a = pick(rng, factorChoices);
      const structure = pick(rng, this.structures);
      const b = integer(rng, 2, structure === "repeated-addition" ? 6 : (challenge < 20 ? 6 : 12));
      const product = a * b;
      const itemVisual = structure.includes("array") ? visual.array(b, a) : visual.counters(b, a);
      const common = { difficulty: clamp(target, 8, 40), values: { a, b }, structure, visual: itemVisual, retrievalKey: `tables:${Math.min(a, b)}`, operation: "multiplication" };
      if (structure === "repeated-addition") {
        const repeated = (count, value) => Array.from({ length: count }, () => value).join(" + ");
        return makeQuestion(this, {
          ...common,
          type: "choice",
          instruction: `Which matches ${a} × ${b}?`,
          display: `${a} × ${b}`,
          answer: repeated(b, a),
          choices: choices(rng, repeated(b, a), [repeated(b, a + 1), repeated(Math.max(2, b - 1), a), `${a} + ${b}`]),
          hint: "Multiplication describes equal groups.",
        });
      }
      if (structure === "skip-count-next") return makeQuestion(this, { ...common, display: `${a * (b - 2)}, ${a * (b - 1)}, ${product}, □`, answer: product + a, hint: `Count on in ${a}s.`, visual: visual.numberLine(a * (b - 2), product + a, [a * (b - 2), a * (b - 1), product, product + a], 4) });
      if (structure === "missing-groups") return makeQuestion(this, { ...common, display: `□ groups of ${a} make ${product}`, answer: b, hint: `How many ${a}s make ${product}?` });
      if (structure === "missing-group-size") return makeQuestion(this, { ...common, display: `${b} equal groups make ${product}. Each group has □`, answer: a, hint: `Use ${product} ÷ ${b}.` });
      return makeQuestion(this, { ...common, display: `${a} × ${b}`, answer: product, hint: `See ${b} equal groups of ${a}.`, steps: [`Count ${b} groups.`, `Each group has ${a}.`] });
    },
  }),
  define({
    id: "division-foundation-models", strand: "division", subskill: "division foundations", min: 8, max: 45,
    focus: "tables", speed: "recall", modes: ["mix", "focus", "quick", "my-mix"],
    structures: ["sharing", "grouping", "inverse-division", "missing-number-groups", "missing-group-size-division"],
    generate({ rng, target, challenge = target }) {
      const divisor = pick(rng, challenge < 20 ? [2, 5, 10] : [2, 3, 4, 5, 8, 10]);
      const quotient = integer(rng, 2, challenge < 20 ? 6 : 12);
      const dividend = divisor * quotient;
      const structure = pick(rng, this.structures);
      const common = { difficulty: clamp(target, 10, 43), values: { a: dividend, b: divisor }, structure, visual: visual.groups(dividend, divisor), retrievalKey: `tables:${divisor}`, operation: "division" };
      if (structure === "sharing") return makeQuestion(this, { ...common, instruction: `${dividend} shared equally between ${divisor}`, display: `${dividend} ÷ ${divisor}`, answer: quotient, visual: visual.counters(divisor, quotient, `${divisor} equal shares`) });
      if (structure === "grouping") return makeQuestion(this, { ...common, instruction: `How many groups of ${divisor}?`, display: `${dividend} ÷ ${divisor}`, answer: quotient });
      if (structure === "inverse-division") return makeQuestion(this, { ...common, instruction: `Use ${divisor} × ${quotient} = ${dividend}`, display: `${dividend} ÷ ${divisor}`, answer: quotient, visual: visual.relationship(`${divisor} × ${quotient}`, `${dividend} ÷ ${divisor}`, "turns around") });
      if (structure === "missing-number-groups") return makeQuestion(this, { ...common, display: `□ ÷ ${divisor} = ${quotient}`, answer: dividend, hint: "Undo division with multiplication." });
      return makeQuestion(this, { ...common, display: `${dividend} ÷ □ = ${quotient}`, answer: divisor, hint: `What multiplied by ${quotient} makes ${dividend}?` });
    },
  }),
  define({
    id: "multiplication-fact-family-web", strand: "multiplication", subskill: "multiplication fact families", min: 25, max: 82,
    focus: "tables", speed: "recall", modes: ["mix", "focus", "quick", "think", "my-mix"], thinking: 2,
    structures: ["fact-commuted", "fact-divide-a", "fact-divide-b", "fact-scale-left", "fact-scale-right", "fact-scale-divide", "fact-half", "fact-double-half"],
    generate({ rng, target }) {
      const a = pick(rng, target < 45 ? [3, 4, 5, 6, 8, 10] : [6, 7, 8, 9, 11, 12]);
      const b = integer(rng, 3, 12);
      const product = a * b;
      const specs = [
        { structure: "fact-commuted", display: `${b} × ${a}`, answer: product, strand: "multiplication" },
        { structure: "fact-divide-a", display: `${product} ÷ ${a}`, answer: b, strand: "division" },
        { structure: "fact-divide-b", display: `${product} ÷ ${b}`, answer: a, strand: "division" },
        { structure: "fact-scale-left", display: `${a * 10} × ${b}`, answer: product * 10, strand: "multiplication" },
        { structure: "fact-scale-right", display: `${a} × ${b * 10}`, answer: product * 10, strand: "multiplication" },
        { structure: "fact-scale-divide", display: `${product * 10} ÷ ${a}`, answer: b * 10, strand: "division" },
        { structure: "fact-half", display: `Half of ${product * 2}`, answer: product, strand: "number" },
        { structure: "fact-double-half", display: `${a * 2} × ${Math.max(1, b / 2)}`, answer: Number.isInteger(b / 2) ? product : product * 2, strand: "multiplication", valid: Number.isInteger(b / 2) },
      ].filter((spec) => spec.valid !== false);
      const chosen = pick(rng, specs);
      const definition = { ...this, strand: chosen.strand };
      const makeConnected = (spec) => makeQuestion({ ...this, strand: spec.strand }, {
        difficulty: clamp(target + (spec.structure.includes("scale") ? 5 : 0), 28, 80), display: spec.display, answer: spec.answer,
        values: { a, b, product }, structure: spec.structure, designedConnection: true, retrievalKey: `fact-family:${a}x${b}`,
        hint: `Start from ${a} × ${b} = ${product}.`, visual: visual.relationship(`${a} × ${b} = ${product}`, spec.display, "connects to"),
      });
      const connections = shuffle(rng, specs.filter((spec) => spec.structure !== chosen.structure)).slice(0, 3).map(makeConnected);
      return makeQuestion(definition, {
        difficulty: clamp(target, 28, 80), instruction: `If ${a} × ${b} = ${product}, what is…`, display: chosen.display, answer: chosen.answer,
        values: { a, b, product }, structure: chosen.structure, retrievalKey: `fact-family:${a}x${b}`, connections,
        hint: "Keep the known fact in view.", visual: visual.relationship(`${a} × ${b} = ${product}`, chosen.display, "helps with"),
        alternatives: [`Turn the multiplication fact into division.`, `Scale both the known fact and its product.`],
      });
    },
  }),
  define({
    id: "derived-multiplication-facts", strand: "multiplication", subskill: "derived multiplication facts", min: 30, max: 78,
    focus: "tables", speed: "strategy", modes: ["mix", "focus", "think", "my-mix"], thinking: 2,
    structures: ["derive-5-to-6", "derive-10-to-9", "derive-4-to-8", "derive-3-to-6", "derive-6-to-12", "derive-half-double"],
    generate({ rng, target }) {
      const factor = integer(rng, 3, 12);
      const structure = pick(rng, this.structures);
      let known; let targetFact; let answer; let bridge;
      if (structure === "derive-5-to-6") { known = `5 × ${factor} = ${5 * factor}`; targetFact = `6 × ${factor}`; answer = 6 * factor; bridge = `Add one more ${factor}.`; }
      else if (structure === "derive-10-to-9") { known = `10 × ${factor} = ${10 * factor}`; targetFact = `9 × ${factor}`; answer = 9 * factor; bridge = `Subtract one ${factor}.`; }
      else if (structure === "derive-4-to-8") { known = `4 × ${factor} = ${4 * factor}`; targetFact = `8 × ${factor}`; answer = 8 * factor; bridge = "Double the known product."; }
      else if (structure === "derive-3-to-6") { known = `3 × ${factor} = ${3 * factor}`; targetFact = `6 × ${factor}`; answer = 6 * factor; bridge = "Double the known product."; }
      else if (structure === "derive-6-to-12") { known = `6 × ${factor} = ${6 * factor}`; targetFact = `12 × ${factor}`; answer = 12 * factor; bridge = "Double the known product."; }
      else { const even = pick(rng, [4, 6, 8, 10, 12]); known = `${even} × ${factor} = ${even * factor}`; targetFact = `${even / 2} × ${factor * 2}`; answer = even * factor; bridge = "Halve one factor and double the other."; }
      return makeQuestion(this, {
        difficulty: clamp(target, 36, 75), instruction: `Known: ${known}`, display: targetFact, answer, values: { a: factor }, structure,
        retrievalKey: `derived:${factor}`, strategy: "derived fact", hint: bridge,
        visual: visual.relationship(known, targetFact, "therefore"), steps: [bridge, `Use ${known}.`],
      });
    },
  }),
  define({
    id: "operation-order-sense", strand: "mixed", subskill: "commutativity and operation sense", min: 28, max: 75,
    modes: ["mix", "focus", "think", "my-mix"], thinking: 2,
    structures: ["commute-addition", "commute-multiplication", "not-commute-subtraction", "not-commute-division"],
    generate({ rng, target }) {
      const structure = pick(rng, target < 45 ? this.structures.slice(0, 2) : this.structures);
      const a = integer(rng, 4, target > 55 ? 80 : 20);
      const b = integer(rng, 2, Math.max(3, a - 1));
      const isPositive = structure === "commute-addition" || structure === "commute-multiplication";
      const operator = structure.includes("addition") ? "+" : structure.includes("multiplication") ? "×" : structure.includes("subtraction") ? "−" : "÷";
      const leftA = operator === "÷" ? a * b : a;
      const leftB = b;
      const statement = `${leftA} ${operator} ${leftB} = ${leftB} ${operator} ${leftA}`;
      return makeQuestion(this, {
        difficulty: clamp(target, 36, 72), type: "choice", instruction: "True or false?", display: statement, answer: isPositive ? "True" : "False", choices: ["True", "False"],
        values: { a: leftA, b: leftB }, structure, hint: isPositive ? "Swapping addends or factors keeps the value." : "Test the reversed operation.",
        visual: visual.relationship(`${leftA} ${operator} ${leftB}`, `${leftB} ${operator} ${leftA}`, "compare"),
      });
    },
  }),
  define({
    id: "distributive-strategy-choice", strand: "multiplication", subskill: "distributive reasoning", min: 45, max: 94,
    modes: ["mix", "focus", "think", "my-mix"], thinking: 3,
    structures: ["distribute-both-valid", "distribute-place-split", "distribute-compensate", "distribute-match-expression"],
    generate({ rng, target }) {
      const factor = integer(rng, 3, 9);
      const number = pick(rng, target > 75 ? [18, 19, 21, 24, 28, 32, 49] : [13, 14, 17, 18, 19, 23]);
      const structure = pick(rng, this.structures);
      const lower = Math.floor(number / 10) * 10;
      const rest = number - lower;
      const upper = Math.ceil(number / 10) * 10;
      const placeSplit = `${lower} × ${factor} + ${rest} × ${factor}`;
      const compensation = `${upper} × ${factor} − ${upper - number} × ${factor}`;
      if (structure === "distribute-both-valid") return makeQuestion(this, { difficulty: clamp(target, 54, 90), type: "choice", instruction: `Which split works for ${number} × ${factor}?`, display: `${number} × ${factor}`, answer: "Both", choices: shuffle(rng, [placeSplit, compensation, "Both"]), values: { a: number, b: factor }, structure, hint: "Both expressions rebuild the same factor.", visual: visual.rectangle(factor, [lower, rest]), alternatives: [placeSplit, compensation] });
      if (structure === "distribute-match-expression") return makeQuestion(this, { difficulty: clamp(target, 58, 92), type: "choice", instruction: `Which is equivalent to ${number} × ${factor}?`, display: `${number} × ${factor}`, answer: placeSplit, choices: choices(rng, placeSplit, [compensation.replace("−", "+"), `${number} + ${factor}`, `${lower} × ${factor} + ${rest}`]), values: { a: number, b: factor }, structure, hint: "Multiply both parts by the same factor.", visual: visual.rectangle(factor, [lower, rest]) });
      const chosen = structure === "distribute-compensate" ? compensation : placeSplit;
      return makeQuestion(this, { difficulty: clamp(target, 52, 91), instruction: "Use this split", display: `${chosen} = □`, answer: number * factor, values: { a: number, b: factor }, structure, strategy: structure === "distribute-compensate" ? "compensation" : "partition", hint: `This is ${number} × ${factor}.`, visual: visual.rectangle(factor, structure === "distribute-compensate" ? [upper, -(upper - number)] : [lower, rest]), alternatives: [placeSplit, compensation] });
    },
  }),
  define({
    id: "multiplication-strategy-lab", strand: "multiplication", subskill: "efficient multiplication strategies", min: 48, max: 100,
    modes: ["mix", "focus", "think", "my-mix"], thinking: 3,
    structures: ["multiply-double", "multiply-half-double", "multiply-partition", "multiply-compensate", "multiply-use-10", "multiply-use-5"],
    generate({ rng, target }) {
      const structure = pick(rng, this.structures);
      let a; let b; let hint; let steps; let alternatives = [];
      if (structure === "multiply-double") { a = pick(rng, [14, 18, 22, 26, 34]); b = pick(rng, [4, 8]); hint = "Double in stages."; steps = [`${a} × ${b / 2} = ${a * (b / 2)}`, "Double that result."]; }
      else if (structure === "multiply-half-double") { a = pick(rng, [16, 24, 36, 48]); b = pick(rng, [15, 25]); hint = "Halve the even factor and double the other."; steps = [`${a / 2} × ${b * 2}`, "The product stays equal."]; }
      else if (structure === "multiply-partition") { a = integer(rng, target > 82 ? 31 : 14, target > 82 ? 79 : 39); b = integer(rng, 3, 9); hint = `Split ${a} into tens and ones.`; steps = [`${Math.floor(a / 10) * 10} × ${b}`, `${a % 10} × ${b}`, "Combine."]; }
      else if (structure === "multiply-compensate") { a = pick(rng, [19, 21, 29, 31, 49]); b = integer(rng, 4, 12); const near = Math.round(a / 10) * 10; hint = `Use ${near} × ${b}, then adjust.`; steps = [`${near} × ${b} = ${near * b}`, `${a > near ? "Add" : "Subtract"} ${Math.abs(a - near) * b}.`]; }
      else if (structure === "multiply-use-10") { a = pick(rng, [9, 11]); b = integer(rng, 4, 12); hint = `Use 10 × ${b}.`; steps = [`10 × ${b} = ${10 * b}`, `${a === 9 ? "Subtract" : "Add"} ${b}.`]; }
      else { a = pick(rng, [6, 15, 25]); b = pick(rng, [8, 12, 16, 24, 36]); hint = a === 6 ? `Use 5 × ${b}, then add ${b}.` : "Use a friendly multiple of 100."; steps = a === 6 ? [`5 × ${b} = ${5 * b}`, `Add ${b}.`] : [`${a} × ${b}`, "Regroup the factors into a friendlier product."]; }
      if (a === 25 && b % 4 === 0) alternatives = [`25 × 4 × ${b / 4}`, `100 × ${b / 4}`];
      return makeQuestion(this, { difficulty: clamp(target, 56, 98), display: `${a} × ${b}`, answer: a * b, values: { a, b }, structure, strategy: structure.replace("multiply-", ""), operation: "multiplication", hint, steps, visual: visual.rectangle(b, [Math.floor(a / 10) * 10, a % 10].filter(Boolean)), alternatives });
    },
  }),
  define({
    id: "division-strategy-lab", strand: "division", subskill: "efficient division strategies", min: 45, max: 96,
    focus: "tables", modes: ["mix", "focus", "think", "my-mix"], thinking: 2,
    structures: ["divide-inverse", "divide-partition", "divide-halving", "divide-scale", "divide-best-known-fact"],
    generate({ rng, target }) {
      const structure = pick(rng, this.structures);
      const divisor = pick(rng, [4, 5, 6, 7, 8, 9]);
      const quotient = pick(rng, target > 75 ? [24, 30, 40, 50, 60, 80, 120] : [12, 20, 30, 40, 60]);
      const dividend = divisor * quotient;
      const common = { difficulty: clamp(target, 52, 93), values: { a: dividend, b: divisor }, structure, operation: "division", visual: visual.partWhole(dividend, [divisor * Math.floor(quotient / 10) * 10, divisor * (quotient % 10)].filter(Boolean), "Partition the dividend") };
      if (structure === "divide-best-known-fact") return makeQuestion(this, { ...common, type: "choice", instruction: `Which fact helps most with ${dividend} ÷ ${divisor}?`, display: `${dividend} ÷ ${divisor}`, answer: `${dividend / 10} ÷ ${divisor} = ${quotient / 10}`, choices: choices(rng, `${dividend / 10} ÷ ${divisor} = ${quotient / 10}`, [`${dividend} ÷ 10 = ${dividend / 10}`, `${divisor} + ${divisor}`, `${quotient} × 10`]), hint: "Choose the fact with the same divisor." });
      const hints = { "divide-inverse": `Think ${divisor} × □ = ${dividend}.`, "divide-partition": "Split into friendly multiples of the divisor.", "divide-halving": divisor === 4 || divisor === 8 ? "Halve in stages." : "Use an inverse fact.", "divide-scale": `Use ${dividend / 10} ÷ ${divisor}.` };
      return makeQuestion(this, { ...common, display: `${dividend} ÷ ${divisor}`, answer: quotient, hint: hints[structure] ?? `Use ${divisor} × ${quotient} = ${dividend}.`, steps: [`Find a known multiple of ${divisor}.`, "Scale or partition to reach the dividend."] });
    },
  }),
  define({
    id: "place-value-actions", strand: "place value", subskill: "place-value relationships", min: 32, max: 82,
    modes: ["mix", "focus", "quick", "think", "my-mix"],
    structures: ["digit-value", "compose-number", "hundred-more", "hundred-less", "thousand-more", "thousand-less", "adjacent-hundreds", "adjacent-thousands"],
    generate({ rng, target }) {
      const value = integer(rng, target < 55 ? 1000 : 2000, 8999);
      const structure = pick(rng, target < 55 ? this.structures.slice(0, 6) : this.structures);
      const digits = String(value).split("").map(Number);
      const placeIndex = integer(rng, 0, 3);
      const place = 10 ** (3 - placeIndex);
      const digitValue = digits[placeIndex] * place;
      const common = { difficulty: clamp(target, 39, 80), values: { a: value, place }, structure, visual: visual.placeValue(value) };
      if (structure === "digit-value") return makeQuestion(this, { ...common, instruction: `What is the value of the digit ${digits[placeIndex]}?`, display: format(value), answer: digitValue, hint: "Find its place, not just the digit." });
      if (structure === "compose-number") return makeQuestion(this, { ...common, instruction: "What number is this?", display: `${placeCount(digits[0], "thousand")} + ${placeCount(digits[1], "hundred")} + ${placeCount(digits[2], "ten")} + ${placeCount(digits[3], "one")}`, answer: value, hint: "Place each digit in its column." });
      if (structure === "hundred-more") return makeQuestion(this, { ...common, display: `100 more than ${format(value)}`, answer: value + 100, hint: "Change the hundreds place." });
      if (structure === "hundred-less") return makeQuestion(this, { ...common, display: `100 less than ${format(value)}`, answer: value - 100, hint: "Change the hundreds place." });
      if (structure === "thousand-more") return makeQuestion(this, { ...common, display: `1,000 more than ${format(value)}`, answer: value + 1000, hint: "Change the thousands place." });
      if (structure === "thousand-less") return makeQuestion(this, { ...common, display: `1,000 less than ${format(value)}`, answer: value - 1000, hint: "Change the thousands place." });
      const interval = structure === "adjacent-hundreds" ? 100 : 1000;
      const low = Math.floor(value / interval) * interval;
      const high = low + interval;
      return makeQuestion(this, { ...common, type: "choice", instruction: `${format(value)} lies between…`, display: format(value), answer: `${format(low)} and ${format(high)}`, choices: choices(rng, `${format(low)} and ${format(high)}`, [`${format(low - interval)} and ${format(low)}`, `${format(high)} and ${format(high + interval)}`], 3), hint: `Find the multiples of ${format(interval)} on either side.`, promptVisual: visual.numberLine(low, high, [value], 5) });
    },
  }),
  define({
    id: "flexible-partitioning", strand: "place value", subskill: "flexible partitioning", min: 42, max: 92,
    modes: ["mix", "focus", "think", "my-mix"], thinking: 2,
    structures: ["partition-standard", "partition-two-parts", "partition-thousands", "partition-hundreds", "partition-missing-flexible", "partition-compare-forms"],
    generate({ rng, target }) {
      const value = integer(rng, 2100, 8999);
      const structure = pick(rng, this.structures);
      const thousands = Math.floor(value / 1000) * 1000;
      const rest = value - thousands;
      const split = integer(rng, 1, Math.floor(value / 1000) - 1) * 1000;
      const hundreds = Math.floor(value / 100);
      const hundredsRest = value - hundreds * 100;
      const common = { difficulty: clamp(target, 50, 90), values: { a: value }, structure, visual: visual.placeValue(value) };
      if (structure === "partition-standard") return makeQuestion(this, { ...common, type: "choice", instruction: `Which shows ${format(value)}?`, display: format(value), answer: `${format(thousands)} + ${format(Math.floor(rest / 100) * 100)} + ${format(Math.floor((rest % 100) / 10) * 10)} + ${rest % 10}`, choices: choices(rng, `${format(thousands)} + ${format(Math.floor(rest / 100) * 100)} + ${format(Math.floor((rest % 100) / 10) * 10)} + ${rest % 10}`, [`${format(value - 100)} + 10`, `${format(thousands)} + ${rest + 100}`]), hint: "Match every place value." });
      if (structure === "partition-two-parts") return makeQuestion(this, { ...common, display: `${format(value)} = ${format(thousands)} + □`, answer: rest, hint: "Remove the thousands part." });
      if (structure === "partition-thousands") return makeQuestion(this, { ...common, display: `${format(value)} = ${format(split)} + □`, answer: value - split, hint: "The parts need not be standard place-value parts." });
      if (structure === "partition-hundreds") return makeQuestion(this, { ...common, display: `${format(value)} = ${hundreds} hundreds + □`, answer: hundredsRest, hint: `${hundreds} hundreds is ${format(hundreds * 100)}.` });
      if (structure === "partition-missing-flexible") { const part = Math.floor(value / 100) * 100 - 200; return makeQuestion(this, { ...common, display: `${format(value)} = ${format(part)} + □`, answer: value - part, hint: "Subtract the known part from the whole." }); }
      const standard = `${format(thousands)} + ${format(rest)}`;
      const flexible = `${format(split)} + ${format(value - split)}`;
      return makeQuestion(this, { ...common, type: "choice", instruction: `Which represents ${format(value)}?`, display: format(value), answer: "Both", choices: shuffle(rng, [standard, flexible, "Both"]), hint: "A number can be partitioned in more than one way.", alternatives: [standard, flexible] });
    },
  }),
  define({
    id: "rounding-possibilities", strand: "place value", subskill: "rounding and boundaries", min: 48, max: 94,
    modes: ["mix", "focus", "think", "my-mix"], thinking: 2,
    structures: ["round-direct", "round-boundaries", "round-which-could", "round-compare", "round-original-range"],
    generate({ rng, target }) {
      const place = pick(rng, target < 65 ? [10, 100] : [100, 1000]);
      const rounded = integer(rng, 2, place === 1000 ? 8 : 40) * place;
      const low = rounded - place / 2;
      const high = rounded + place / 2 - 1;
      const structure = pick(rng, this.structures);
      const original = integer(rng, low, high);
      const common = { difficulty: clamp(target, 55, 92), values: { a: original, b: place }, structure, visual: visual.numberLine(rounded - place, rounded + place, [original, rounded], 5) };
      if (structure === "round-direct") return makeQuestion(this, { ...common, instruction: `Round to the nearest ${format(place)}`, display: format(original), answer: rounded, hint: "Locate the midpoint between the two nearest multiples." });
      if (structure === "round-boundaries") return makeQuestion(this, { ...common, type: "choice", instruction: `Which range rounds to ${format(rounded)}?`, display: format(rounded), answer: `${format(low)} to ${format(high)}`, choices: choices(rng, `${format(low)} to ${format(high)}`, [`${format(rounded - place)} to ${format(rounded)}`, `${format(low + 1)} to ${format(high + 1)}`], 3), hint: "Include the lower midpoint, but not the next midpoint." });
      if (structure === "round-which-could") { const wrongLow = low - integer(rng, 1, Math.max(2, place / 4)); const wrongHigh = high + integer(rng, 1, Math.max(2, place / 4)); return makeQuestion(this, { ...common, type: "choice", instruction: `Which could round to ${format(rounded)}?`, display: `Nearest ${format(place)}`, answer: format(original), choices: choices(rng, format(original), [format(wrongLow), format(wrongHigh), format(rounded + place)]), hint: `Values from ${format(low)} to ${format(high)} round here.` }); }
      if (structure === "round-compare") { const second = high + integer(rng, 1, Math.max(2, place / 3)); return makeQuestion(this, { ...common, type: "choice", instruction: `Which rounds to ${format(rounded)}?`, display: "Choose one", answer: format(original), choices: shuffle(rng, [format(original), format(second)]), hint: "Compare each value with the midpoint." }); }
      return makeQuestion(this, { ...common, type: "choice", instruction: `A number rounds to ${format(rounded)}. Which statement is true?`, display: `Nearest ${format(place)}`, answer: `It could be from ${format(low)} to ${format(high)}`, choices: choices(rng, `It could be from ${format(low)} to ${format(high)}`, [`It must equal ${format(rounded)}`, `It is less than ${format(low)}`], 3), hint: "Rounding describes a whole interval of possible originals." });
    },
  }),
  define({
    id: "number-line-relationships", strand: "number", subskill: "number-line intervals and midpoints", min: 38, max: 92,
    modes: ["mix", "focus", "think", "my-mix"], thinking: 2,
    structures: ["line-midpoint", "line-missing-interval", "line-estimate-position", "line-adjacent-multiples", "line-marked-value"],
    generate({ rng, target }) {
      const unit = target < 60 ? pick(rng, [10, 50, 100]) : pick(rng, [100, 250, 500]);
      const min = integer(rng, 1, 12) * unit;
      const max = min + unit * 4;
      const structure = pick(rng, this.structures);
      const common = { difficulty: clamp(target, 45, 90), values: { a: min, b: max }, structure };
      const intervalMarkers = [min + unit, min + unit * 2, min + unit * 3];
      if (structure === "line-midpoint") {
        const midpointLine = visual.numberLine(min, max, [min + unit * 2], 5, 0);
        return makeQuestion(this, { ...common, instruction: "What is halfway?", display: `${format(min)} — ${format(max)}`, answer: min + unit * 2, promptVisual: midpointLine, visual: midpointLine, hint: "Halve the distance between the endpoints." });
      }
      if (structure === "line-missing-interval") {
        const missingLine = visual.numberLine(min, max, intervalMarkers, 5, 1);
        return makeQuestion(this, { ...common, display: `${format(min)}, ${format(min + unit)}, □, ${format(min + unit * 3)}`, answer: min + unit * 2, promptVisual: missingLine, visual: missingLine, hint: `Each interval is ${format(unit)}.` });
      }
      if (structure === "line-estimate-position") {
        const markerIndex = integer(rng, 1, 3);
        const marker = min + markerIndex * unit;
        const markedLine = visual.numberLine(min, max, intervalMarkers, 5, markerIndex - 1);
        return makeQuestion(this, { ...common, type: "choice", instruction: "Which value is marked?", display: "Read the line", answer: format(marker), choices: choices(rng, format(marker), [format(marker - unit), format(marker + unit), format(marker + unit / 2)]), promptVisual: markedLine, visual: markedLine, hint: "Work out the value of one equal interval." });
      }
      if (structure === "line-adjacent-multiples") { const marker = min + integer(rng, 1, 3) * unit + Math.floor(unit / 3); const low = Math.floor(marker / unit) * unit; return makeQuestion(this, { ...common, type: "choice", instruction: `${format(marker)} lies between…`, display: format(marker), answer: `${format(low)} and ${format(low + unit)}`, choices: choices(rng, `${format(low)} and ${format(low + unit)}`, [`${format(low - unit)} and ${format(low)}`, `${format(low + unit)} and ${format(low + unit * 2)}`], 3), promptVisual: visual.numberLine(low, low + unit, [marker], 5), visual: visual.numberLine(low, low + unit, [marker], 5), hint: "Find the multiple on each side." }); }
      const markerIndex = integer(rng, 1, 3);
      const marker = min + unit * markerIndex;
      const markedLine = visual.numberLine(min, max, intervalMarkers, 5, markerIndex - 1);
      return makeQuestion(this, { ...common, display: `Point A = □`, answer: marker, promptVisual: markedLine, visual: markedLine, hint: `The line increases by ${format(unit)} each interval.` });
    },
  }),
  define({
    id: "addition-strategy-engine", strand: "addition", subskill: "efficient addition strategies", min: 34, max: 100,
    modes: ["mix", "focus", "think", "my-mix"], thinking: 2,
    structures: ["addition-bridge", "addition-compensation", "addition-near-double", "addition-place-value", "addition-make-whole", "addition-reorder"],
    generate({ rng, target }) {
      const structure = pick(rng, this.structures);
      let display; let answer; let values; let hint; let steps; let itemVisual; let alternatives = [];
      if (structure === "addition-bridge") {
        const a = integer(rng, target > 70 ? 380 : 58, target > 70 ? 980 : 98);
        const boundary = Math.ceil(a / (target > 70 ? 100 : 10)) * (target > 70 ? 100 : 10);
        const b = integer(rng, boundary - a + 1, boundary - a + (target > 70 ? 80 : 9));
        display = `${format(a)} + ${b}`; answer = a + b; values = { a, b }; hint = `Make ${format(boundary)} first.`;
        steps = [`${format(a)} + ${boundary - a} = ${format(boundary)}`, `${format(boundary)} + ${b - (boundary - a)} = □`];
        itemVisual = visual.beadString(a, a + b, [a, boundary, a + b]);
        alternatives = [`Bridge through ${format(boundary)}.`, `Partition ${b} into ${Math.floor(b / 10) * 10} and ${b % 10}.`];
      } else if (structure === "addition-compensation") {
        const a = pick(rng, target > 75 ? [399, 499, 999, 1998] : [49, 99, 199, 399]);
        const b = integer(rng, target > 75 ? 240 : 32, target > 75 ? 2900 : 480);
        const round = a < 100 ? Math.round(a / 10) * 10 : Math.round(a / 100) * 100;
        display = `${format(a)} + ${format(b)}`; answer = a + b; values = { a, b }; hint = `Use ${format(round)}, then adjust by ${Math.abs(round - a)}.`;
        steps = [`${format(round)} + ${format(b)} = ${format(round + b)}`, `${a < round ? "Subtract" : "Add"} ${Math.abs(round - a)}.`];
        itemVisual = visual.relationship(`${format(round)} + ${format(b)}`, `${a < round ? "−" : "+"} ${Math.abs(round - a)}`, "then");
        alternatives = [`Compensate from ${format(round)}.`, `Partition ${format(b)} by place value.`];
      } else if (structure === "addition-near-double") {
        const a = integer(rng, target > 70 ? 120 : 28, target > 70 ? 900 : 99);
        const b = a + pick(rng, [-2, -1, 1, 2]);
        display = `${format(a)} + ${format(b)}`; answer = a + b; values = { a, b }; hint = `Use double ${Math.min(a, b)}, then adjust.`;
        steps = [`Double ${format(Math.min(a, b))} = ${format(Math.min(a, b) * 2)}`, `Add ${Math.abs(a - b)}.`]; itemVisual = visual.partWhole(answer, [a, b], "See the near double");
      } else if (structure === "addition-place-value") {
        const a = integer(rng, 12, 78) * (target > 68 ? 100 : 10);
        const b = integer(rng, 2, 9) * (target > 68 ? 10 : 10);
        display = `${format(a)} + ${format(b)}`; answer = a + b; values = { a, b }; hint = "Only one or two place-value columns change.";
        steps = ["Add like place values.", "Keep the other places unchanged."]; itemVisual = visual.placeGrid([String(a).padStart(4, "0").slice(-4).split("").map(Number), String(b).padStart(4, "0").slice(-4).split("").map(Number)], "+");
      } else if (structure === "addition-make-whole") {
        const boundary = pick(rng, target > 65 ? [1000, 5000, 10000] : [100, 500, 1000]);
        const a = boundary - integer(rng, 2, Math.min(99, boundary / 5));
        const b = boundary - a;
        display = `${format(a)} + ${format(b)}`; answer = boundary; values = { a, b }; hint = `The addends complete ${format(boundary)}.`;
        steps = [`Find the gap from ${format(a)} to ${format(boundary)}.`]; itemVisual = visual.partWhole(boundary, [a, b]);
      } else {
        const boundary = target > 65 ? 1000 : 100;
        const a = integer(rng, 12, boundary / 2);
        const c = boundary - a;
        const b = integer(rng, target > 65 ? 120 : 20, target > 65 ? 780 : 80);
        display = `${format(a)} + ${format(b)} + ${format(c)}`; answer = a + b + c; values = { a, b, c }; hint = `Reorder: ${format(a)} + ${format(c)} makes ${format(boundary)}.`;
        steps = [`${format(a)} + ${format(c)} = ${format(boundary)}`, `${format(boundary)} + ${format(b)} = □`]; itemVisual = visual.relationship(`${format(a)} + ${format(c)}`, format(boundary), "makes");
      }
      return makeQuestion(this, { difficulty: clamp(target, 42, 98), display, answer, values, structure, strategy: structure.replace("addition-", ""), operation: "addition", hint, steps, visual: itemVisual, alternatives });
    },
  }),
  define({
    id: "subtraction-strategy-engine", strand: "subtraction", subskill: "efficient subtraction strategies", min: 36, max: 100,
    modes: ["mix", "focus", "think", "my-mix"], thinking: 2,
    structures: ["subtraction-count-up", "subtraction-compensation", "subtraction-partition", "subtraction-cross-boundary", "subtraction-multiple", "subtraction-inverse"],
    generate({ rng, target }) {
      const structure = pick(rng, this.structures);
      let a; let b; let hint; let steps; let itemVisual;
      if (structure === "subtraction-count-up") {
        b = pick(rng, target > 75 ? [998, 1998, 2997] : [48, 98, 198, 298]);
        a = b + integer(rng, 3, target > 75 ? 120 : 35);
        const landmarkUnit = b < 100 ? 10 : b < 1000 ? 100 : 1000;
        const landmark = Math.ceil(b / landmarkUnit) * landmarkUnit;
        const markers = [b, ...(landmark > b && landmark < a ? [landmark] : []), a];
        hint = "The numbers are close. Count up to find the difference."; steps = [`Count from ${format(b)} to a nearby landmark.`, `Continue to ${format(a)} and combine the jumps.`]; itemVisual = visual.numberLine(b, a, markers, 5);
      } else if (structure === "subtraction-compensation") {
        a = integer(rng, target > 72 ? 3000 : 400, target > 72 ? 9000 : 1400);
        b = pick(rng, target > 72 ? [1998, 2997, 3999] : [198, 298, 399]);
        if (b >= a) a = b + integer(rng, 200, 2000);
        const round = Math.round(b / (b > 999 ? 1000 : 100)) * (b > 999 ? 1000 : 100);
        hint = `Subtract ${format(round)}, then add back ${format(round - b)}.`; steps = [`${format(a)} − ${format(round)} = ${format(a - round)}`, `Add back ${format(round - b)}.`]; itemVisual = visual.relationship(`${format(a)} − ${format(round)}`, `+ ${format(round - b)}`, "adjust");
      } else if (structure === "subtraction-partition") {
        a = integer(rng, 500, target > 70 ? 8000 : 1600); b = integer(rng, 120, Math.min(a - 100, target > 70 ? 2800 : 780));
        hint = "Partition the amount being subtracted."; steps = [`Subtract ${format(Math.floor(b / 100) * 100)}.`, `Then subtract the remaining ${format(b % 100)}.`]; itemVisual = visual.partWhole(b, [Math.floor(b / 100) * 100, b % 100].filter(Boolean), "Partition the subtrahend");
      } else if (structure === "subtraction-cross-boundary") {
        const boundary = target > 70 ? pick(rng, [1000, 5000]) : pick(rng, [100, 500, 1000]);
        a = boundary + integer(rng, 2, target > 70 ? 80 : 30); b = integer(rng, (a - boundary) + 1, (a - boundary) + (target > 70 ? 180 : 50));
        hint = `Step back through ${format(boundary)}.`; steps = [`${format(a)} − ${format(a - boundary)} = ${format(boundary)}`, `Subtract the rest.`]; itemVisual = visual.numberLine(a - b, a, [a - b, boundary, a], 5);
      } else if (structure === "subtraction-multiple") {
        const unit = target > 65 ? 100 : 10; b = integer(rng, 2, 8) * unit; a = integer(rng, b / unit + 4, 90) * unit;
        hint = `Work in ${unit === 100 ? "hundreds" : "tens"}.`; steps = [`${a / unit} − ${b / unit} = ${(a - b) / unit}`, "Restore the place value."]; itemVisual = visual.placeValue(a);
      } else {
        const answer = integer(rng, target > 70 ? 800 : 80, target > 70 ? 5000 : 900); b = integer(rng, 40, target > 70 ? 2500 : 450); a = answer + b;
        hint = `Think: ${format(b)} + □ = ${format(a)}.`; steps = ["Undo subtraction with addition."]; itemVisual = visual.partWhole(a, [b, answer]);
      }
      return makeQuestion(this, { difficulty: clamp(target, 45, 98), display: `${format(a)} − ${format(b)}`, answer: a - b, values: { a, b }, structure, strategy: structure.replace("subtraction-", ""), operation: "subtraction", hint, steps, visual: itemVisual });
    },
  }),
  define({
    id: "additive-calculation-comparison", strand: "addition", subskill: "comparison without full calculation", min: 56, max: 98,
    modes: ["mix", "focus", "think", "my-mix"], thinking: 3,
    structures: ["compare-same-total", "compare-offset-addends", "compare-near-boundary", "compare-three-addends"],
    generate({ rng, target }) {
      const structure = pick(rng, this.structures);
      const a = integer(rng, target > 78 ? 300 : 80, target > 78 ? 900 : 300);
      const b = integer(rng, target > 78 ? 200 : 40, target > 78 ? 800 : 260);
      const shift = integer(rng, 1, 9);
      let left; let right; let leftValue; let rightValue;
      if (structure === "compare-same-total") { left = `${format(a)} + ${format(b)}`; right = `${format(a + shift)} + ${format(b - shift)}`; leftValue = a + b; rightValue = leftValue; }
      else if (structure === "compare-offset-addends") { left = `${format(a)} + ${format(b)}`; right = `${format(a + shift)} + ${format(b - shift + 1)}`; leftValue = a + b; rightValue = a + b + 1; }
      else if (structure === "compare-near-boundary") { const round = Math.ceil(a / 100) * 100; left = `${format(a)} + ${format(b)}`; right = `${format(round)} + ${format(b - (round - a) + shift)}`; leftValue = a + b; rightValue = round + b - (round - a) + shift; }
      else { const c = integer(rng, 20, 100); left = `${format(a)} + ${format(b)} + ${format(c)}`; right = `${format(a + c)} + ${format(b - shift)}`; leftValue = a + b + c; rightValue = a + b + c - shift; }
      const answer = leftValue === rightValue ? "Equal" : leftValue > rightValue ? left : right;
      return makeQuestion(this, { difficulty: clamp(target, 64, 96), type: "choice", instruction: "Which has the greater value?", display: "Compare without long addition", answer, choices: shuffle(rng, [left, right, "Equal"]), values: { a, b }, structure, hint: "Track how the addends changed rather than calculating both.", visual: visual.relationship(left, right, "compare") });
    },
  }),
  define({
    id: "multiplicative-calculation-comparison", strand: "multiplication", subskill: "multiplicative comparison", min: 60, max: 100,
    modes: ["mix", "focus", "think", "my-mix"], thinking: 3,
    structures: ["compare-adjacent-factor", "compare-balanced-product", "compare-near-round-product", "compare-scale-product", "compare-equivalent-product"],
    generate({ rng, target }) {
      const structure = pick(rng, this.structures);
      const a = integer(rng, target > 82 ? 30 : 12, target > 82 ? 60 : 35);
      const b = integer(rng, 6, target > 82 ? 30 : 16);
      let left; let right; let leftValue; let rightValue;
      if (structure === "compare-adjacent-factor") { left = `${a} × ${b}`; right = `${a + 1} × ${b}`; leftValue = a * b; rightValue = (a + 1) * b; }
      else if (structure === "compare-balanced-product") { left = `${a - 1} × ${b + 1}`; right = `${a} × ${b}`; leftValue = (a - 1) * (b + 1); rightValue = a * b; }
      else if (structure === "compare-near-round-product") { left = `${a - 1} × ${b + 1}`; right = `${a} × ${b}`; leftValue = (a - 1) * (b + 1); rightValue = a * b; }
      else if (structure === "compare-scale-product") { left = `${a} × ${b * 10}`; right = `${a * 10} × ${b}`; leftValue = a * b * 10; rightValue = leftValue; }
      else { const even = a % 2 === 0 ? a : a + 1; left = `${even} × ${b}`; right = `${even / 2} × ${b * 2}`; leftValue = even * b; rightValue = leftValue; }
      const answer = leftValue === rightValue ? "Equal" : leftValue > rightValue ? left : right;
      return makeQuestion(this, { difficulty: clamp(target, 70, 98), type: "choice", instruction: "Which is larger?", display: "Compare the structure", answer, choices: shuffle(rng, [left, right, "Equal"]), values: { a, b }, structure, hint: "Notice which factor changed and by how much.", visual: visual.relationship(left, right, "compare") });
    },
  }),
  define({
    id: "structural-true-false", strand: "mixed", subskill: "structural true or false", min: 42, max: 96,
    modes: ["mix", "focus", "think", "my-mix"], thinking: 2,
    structures: ["tf-double-product", "tf-scaled-product", "tf-inverse-pair", "tf-add-whole", "tf-fraction-equivalent", "tf-place-value-scale"],
    generate({ rng, target }) {
      const structure = pick(rng, this.structures);
      const isTrue = rng() > 0.45;
      let display; let explanation;
      if (structure === "tf-double-product") { const a = integer(rng, 3, 9); const b = pick(rng, [4, 6, 8, 10, 12]); display = `${a} × ${b} = ${a * 2} × ${isTrue ? b / 2 : b / 2 + 1}`; explanation = "Halving one factor and doubling the other can preserve a product."; }
      else if (structure === "tf-scaled-product") { const a = integer(rng, 3, 9); const b = integer(rng, 3, 9); display = `${a * 10} × ${b} = ${a} × ${b * 10}${isTrue ? "" : " + 10"}`; explanation = "Either factor can carry the scale of 10."; }
      else if (structure === "tf-inverse-pair") { const a = integer(rng, 3, 12); const b = integer(rng, 3, 12); const p = a * b; display = `${p} ÷ ${a} = ${isTrue ? b : b + 1}`; explanation = "Use the matching multiplication fact."; }
      else if (structure === "tf-add-whole") { const a = integer(rng, 20, 90); display = `${a} + ${100 - a} = ${isTrue ? 100 : 90}`; explanation = "The addends form a complement to 100."; }
      else if (structure === "tf-fraction-equivalent") { const d = pick(rng, [2, 4, 5, 8]); const n = integer(rng, 1, d - 1); display = `${fractionToken(n, d)} = [[${n * 2}/${d * (isTrue ? 2 : 3)}]]`; explanation = "Equivalent fractions scale numerator and denominator equally."; }
      else { const a = integer(rng, 12, 99); display = `${a} × 10 = ${isTrue ? a * 10 : a + 10}`; explanation = "Multiplying by 10 changes every digit's value."; }
      return makeQuestion(this, { difficulty: clamp(target, 50, 93), type: "choice", instruction: "True or false?", display, answer: isTrue ? "True" : "False", choices: ["True", "False"], values: {}, structure, hint: explanation, visual: visual.relationship(display.split("=")[0].trim(), display.split("=")[1].trim(), "compare") });
    },
  }),
  define({
    id: "always-sometimes-never", strand: "mixed", subskill: "generalising number properties", min: 72, max: 100,
    modes: ["mix", "think", "my-mix"], thinking: 4,
    structures: ["asn-odd-plus-odd", "asn-even-halved", "asn-multiple-ten", "asn-factor-swap", "asn-round-hundreds", "asn-same-digit-sum", "asn-self-subtract"],
    generate({ rng, target }) {
      const statements = [
        { structure: "asn-odd-plus-odd", text: "Adding two odd whole numbers gives an even number.", answer: "Always", hint: "Try 3 + 5, then explain the pattern." },
        { structure: "asn-even-halved", text: "Halving an even number gives an even number.", answer: "Sometimes", hint: "Compare half of 6 with half of 8." },
        { structure: "asn-multiple-ten", text: "A whole-number multiple of 10 ends in 0.", answer: "Always", hint: "Think about the ones digit." },
        { structure: "asn-factor-swap", text: "Swapping two factors changes the product.", answer: "Never", hint: "Compare 6 × 8 and 8 × 6." },
        { structure: "asn-round-hundreds", text: "A number rounded to the nearest 100 ends in 00.", answer: "Always", hint: "Rounded answers are multiples of 100." },
        { structure: "asn-same-digit-sum", text: "Two numbers with the same digit sum have the same value.", answer: "Sometimes", hint: "The numbers might be identical, but need not be." },
        { structure: "asn-self-subtract", text: "Subtracting a number from itself gives 0.", answer: "Always", hint: "The difference between equal values is zero." },
      ];
      const chosen = pick(rng, statements);
      return makeQuestion(this, { difficulty: clamp(target, 78, 99), type: "choice", instruction: "Always, sometimes or never?", display: chosen.text, answer: chosen.answer, choices: ["Always", "Sometimes", "Never"], values: {}, structure: chosen.structure, hint: chosen.hint, visual: visual.relationship("test examples", "explain the pattern", "then") });
    },
  }),
  define({
    id: "unambiguous-odd-one-out", strand: "mixed", subskill: "structural odd one out", min: 52, max: 96,
    modes: ["mix", "think", "my-mix"], thinking: 3,
    structures: ["odd-out-same-value", "odd-out-not-multiple", "odd-out-fraction-value", "odd-out-operation-result"],
    generate({ rng, target }) {
      const structure = pick(rng, this.structures);
      let answer; let options; let reference;
      if (structure === "odd-out-same-value") { const a = integer(rng, 3, 9); const b = integer(rng, 3, 12); const p = a * b; options = [`${a} × ${b}`, `${p} ÷ 1`, `${p + b} − ${b}`, `${a} × ${b} + 1`]; answer = options[3]; reference = p; }
      else if (structure === "odd-out-not-multiple") { const base = pick(rng, [4, 5, 8, 10]); const m = integer(rng, 3, 12); options = [base * m, base * (m + 1), base * (m + 2), base * m + 1].map(String); answer = options[3]; reference = `multiples of ${base}`; }
      else if (structure === "odd-out-fraction-value") { options = ["[[1/2]]", "[[2/4]]", "[[4/8]]", "[[3/4]]"]; answer = "[[3/4]]"; reference = "one half"; }
      else { const v = integer(rng, 3, 10); options = [`${v * 4} ÷ 4`, `${v - 1} + 1`, `${v} × 1`, `${v} + 1`]; answer = options[3]; reference = v; }
      return makeQuestion(this, { difficulty: clamp(target, 62, 93), type: "choice", instruction: "Which is the odd one out?", display: "Three share one value or rule", answer, choices: shuffle(rng, options), values: {}, structure, hint: `Three choices connect to ${reference}.`, visual: visual.relationship("three match", "one differs", "find") });
    },
  }),
  define({
    id: "additive-equivalence", strand: "addition", subskill: "additive equivalence", min: 48, max: 96,
    modes: ["mix", "focus", "think", "my-mix"], thinking: 2,
    structures: ["equiv-shift-addend", "equiv-subtract-balance", "equiv-complement", "equiv-mixed-operations", "equiv-missing-side"],
    generate({ rng, target }) {
      const structure = pick(rng, this.structures);
      const a = integer(rng, target > 75 ? 200 : 30, target > 75 ? 900 : 120);
      const b = integer(rng, 12, target > 75 ? 300 : 90);
      const total = a + b;
      const shift = integer(rng, 2, 12);
      let display; let answer; let hint;
      if (structure === "equiv-shift-addend") { display = `${format(a)} + ${format(b)} = ${format(a + shift)} + □`; answer = b - shift; hint = `One addend rose by ${shift}, so the other must fall by ${shift}.`; }
      else if (structure === "equiv-subtract-balance") { const c = integer(rng, 20, Math.min(total - 5, 120)); display = `${format(a)} + ${format(b)} = ${format(total + c)} − □`; answer = c; hint = "Both sides must keep the same total."; }
      else if (structure === "equiv-complement") { const boundary = Math.ceil(total / 100) * 100 + 100; display = `${format(a)} + ${format(b)} = ${format(boundary)} − □`; answer = boundary - total; hint = `Find the gap from ${format(total)} to ${format(boundary)}.`; }
      else if (structure === "equiv-mixed-operations") { const c = integer(rng, 5, Math.min(50, total - 1)); display = `${format(total)} = ${format(total - c)} + □`; answer = c; hint = "Read the equals sign as 'has the same value as'."; }
      else { display = `□ = ${format(a)} + ${format(b)}`; answer = total; hint = "The missing value can appear on either side of equals."; }
      return makeQuestion(this, { difficulty: clamp(target, 56, 94), display, answer, values: { a, b }, structure, hint, visual: visual.relationship(display.split("=")[0].trim(), display.split("=")[1].trim(), "same value") });
    },
  }),
  define({
    id: "multiplicative-equivalence", strand: "multiplication", subskill: "multiplicative equivalence", min: 55, max: 100,
    focus: "tables", modes: ["mix", "focus", "think", "my-mix"], thinking: 3,
    structures: ["equiv-double-half", "equiv-scale-ten", "equiv-product-sum", "equiv-division-product", "equiv-missing-factor-balance"],
    generate({ rng, target }) {
      const structure = pick(rng, this.structures);
      const a = pick(rng, [4, 6, 8, 10, 12]);
      const b = integer(rng, 3, 12);
      const product = a * b;
      let display; let answer; let hint;
      if (structure === "equiv-double-half") { display = `${a} × ${b} = ${a * 2} × □`; answer = b / 2; if (!Number.isInteger(answer)) { display = `${a} × ${b * 2} = ${a * 2} × □`; answer = b; } hint = "Doubling one factor means halving the other."; }
      else if (structure === "equiv-scale-ten") { display = `${a} × ${b * 10} = ${a * 10} × □`; answer = b; hint = "The scale of 10 can move between factors."; }
      else if (structure === "equiv-product-sum") { const c = integer(rng, 5, Math.min(30, product - 1)); display = `${a} × ${b} = ${product - c} + □`; answer = c; hint = `Use ${a} × ${b} = ${product}.`; }
      else if (structure === "equiv-division-product") { display = `${product * 10} ÷ ${a} = ${b} × □`; answer = 10; hint = "Connect the quotient to the known product."; }
      else { const doubled = a * 2; display = `${a} × ${b} = ${doubled} × □`; answer = b / 2; if (!Number.isInteger(answer)) { display = `${a} × ${b + 1} = ${doubled} × □`; answer = (b + 1) / 2; } hint = "Keep the product balanced."; }
      return makeQuestion(this, { difficulty: clamp(target, 64, 98), display, answer, values: { a, b }, structure, hint, visual: visual.relationship(display.split("=")[0].trim(), display.split("=")[1].trim(), "same value"), retrievalKey: `fact-family:${a}x${b}` });
    },
  }),
  define({
    id: "balanced-equation-positions", strand: "mixed", subskill: "balanced equations", min: 38, max: 90,
    modes: ["mix", "focus", "think", "my-mix"], thinking: 2,
    structures: ["answer-left", "missing-left-addend", "mixed-balance", "subtraction-balance", "multiplication-balance", "division-balance"],
    generate({ rng, target }) {
      const structure = pick(rng, this.structures);
      const a = integer(rng, 20, target > 70 ? 500 : 120);
      const b = integer(rng, 5, Math.min(80, a - 1));
      let display; let answer; let hint;
      if (structure === "answer-left") { display = `□ = ${format(a)} + ${b}`; answer = a + b; hint = "Equals works in both directions."; }
      else if (structure === "missing-left-addend") { display = `${format(a + b)} = □ + ${b}`; answer = a; hint = "Subtract the known addend from the total."; }
      else if (structure === "mixed-balance") { const total = a + b; const c = integer(rng, 5, Math.min(60, total - 1)); display = `${format(a)} + ${b} = ${format(total + c)} − □`; answer = c; hint = "Make both sides equal the same total."; }
      else if (structure === "subtraction-balance") { const c = integer(rng, 2, b); display = `${format(a)} − ${b} = ${format(a - b + c)} − □`; answer = c; hint = "Compare how much each side subtracts."; }
      else if (structure === "multiplication-balance") { const f = pick(rng, [4, 6, 8, 10]); const g = pick(rng, [4, 6, 8, 10, 12]); display = `${f} × ${g} = ${f * g - f} + □`; answer = f; hint = `Use ${f} × ${g} = ${f * g}.`; }
      else { const divisor = pick(rng, [3, 4, 5, 6, 8]); const q = integer(rng, 3, 12); display = `${divisor * q} ÷ ${divisor} = ${q + 2} − □`; answer = 2; hint = "Work out the division side first."; }
      return makeQuestion(this, { difficulty: clamp(target, 46, 88), display, answer, values: { a, b }, structure, hint, visual: visual.relationship(display.split("=")[0].trim(), display.split("=")[1].trim(), "balances") });
    },
  }),
  define({
    id: "multi-step-missing-number", strand: "mixed", subskill: "multi-step missing numbers", min: 68, max: 100,
    modes: ["mix", "think", "my-mix"], thinking: 4,
    structures: ["missing-multiply-add", "missing-multiply-subtract", "missing-add-multiply", "missing-divide-add", "missing-two-step-subtract", "missing-bracket-free"],
    generate({ rng, target }) {
      const structure = pick(rng, this.structures);
      const answer = integer(rng, 4, target > 88 ? 40 : 18);
      const factor = integer(rng, 2, 9);
      const offset = integer(rng, 5, 40);
      let display; let result; let hint; let steps;
      if (structure === "missing-multiply-add") { result = factor * answer + offset; display = `${factor} × □ + ${offset} = ${result}`; hint = "Undo addition, then multiplication."; steps = [`${result} − ${offset} = ${result - offset}`, `${result - offset} ÷ ${factor} = □`]; }
      else if (structure === "missing-multiply-subtract") { result = factor * answer - offset; if (result < 0) result = factor * answer + offset; display = result === factor * answer - offset ? `${factor} × □ − ${offset} = ${result}` : `${factor} × □ + ${offset} = ${result}`; hint = "Undo the final operation first."; steps = ["Reverse the final addition or subtraction.", `Then divide by ${factor}.`]; }
      else if (structure === "missing-add-multiply") { result = (answer + offset) * factor; display = `(□ + ${offset}) × ${factor} = ${result}`; hint = `Divide by ${factor} first.`; steps = [`${result} ÷ ${factor} = ${answer + offset}`, `${answer + offset} − ${offset} = □`]; }
      else if (structure === "missing-divide-add") { const dividend = answer * factor; result = answer + offset; display = `□ ÷ ${factor} + ${offset} = ${result}`; hint = "Undo addition, then undo division."; steps = [`${result} − ${offset} = ${answer}`, `${answer} × ${factor} = □`]; return makeQuestion(this, { difficulty: clamp(target, 76, 99), display, answer: dividend, values: { a: factor, b: answer }, structure, hint, steps, visual: visual.relationship("undo last", "then undo first", "reverse") }); }
      else if (structure === "missing-two-step-subtract") { const start = answer + offset + factor; result = answer; display = `${start} − □ − ${factor} = ${result}`; hint = "Find the total amount removed."; steps = [`${start} − ${result} = ${start - result}`, `${start - result} − ${factor} = □`]; }
      else { result = factor * answer + offset; display = `${factor} × □ = ${result} − ${offset}`; hint = "Work out the known side, then divide."; steps = [`${result} − ${offset} = ${factor * answer}`, `${factor * answer} ÷ ${factor} = □`]; }
      return makeQuestion(this, { difficulty: clamp(target, 76, 99), display, answer, values: { a: factor, b: answer }, structure, hint, steps, visual: visual.relationship("undo last", "then undo first", "reverse") });
    },
  }),
  define({
    id: "missing-digit-depth", strand: "mixed", subskill: "missing-digit equations", min: 72, max: 100,
    modes: ["mix", "think", "my-mix"], thinking: 4,
    structures: ["missing-digit-add-tens", "missing-digit-add-hundreds", "missing-digit-subtract-tens", "missing-digit-subtract-hundreds", "missing-digit-product-ones"],
    generate({ rng, target }) {
      const structure = pick(rng, this.structures);
      const hundreds = integer(rng, 2, 8);
      const tens = integer(rng, 0, 9);
      const ones = integer(rng, 0, 9);
      let number = hundreds * 100 + tens * 10 + ones;
      let display; let answer; let hint; let values;
      if (structure === "missing-digit-add-tens" || structure === "missing-digit-add-hundreds") {
        const addend = integer(rng, 120, 398); const total = number + addend; const missingPlace = structure.endsWith("hundreds") ? 100 : 10; answer = Math.floor(number / missingPlace) % 10;
        const shown = structure.endsWith("hundreds") ? `□${tens}${ones}` : `${hundreds}□${ones}`;
        display = `${shown} + ${addend} = ${total}`; hint = `Subtract ${addend} from ${total}, then read the missing digit.`; values = { a: number, b: addend };
      } else if (structure === "missing-digit-subtract-tens" || structure === "missing-digit-subtract-hundreds") {
        const subtrahend = integer(rng, 50, Math.max(51, number - 20)); if (subtrahend >= number) number += 200; const result = number - subtrahend; const missingPlace = structure.endsWith("hundreds") ? 100 : 10; answer = Math.floor(number / missingPlace) % 10;
        const digits = String(number).padStart(3, "0"); const shown = structure.endsWith("hundreds") ? `□${digits[1]}${digits[2]}` : `${digits[0]}□${digits[2]}`;
        display = `${shown} − ${subtrahend} = ${result}`; hint = `Add ${subtrahend} and ${result}, then read the missing digit.`; values = { a: number, b: subtrahend };
      } else {
        const factor = integer(rng, 3, 9); const multiplicand = integer(rng, 12, 49); const product = factor * multiplicand; answer = product % 10; display = `${multiplicand} × ${factor} = ${Math.floor(product / 10)}□`; hint = "Use the ones digit of the multiplication fact."; values = { a: multiplicand, b: factor };
      }
      return makeQuestion(this, { difficulty: clamp(target, 82, 99), instruction: "Find the missing digit", display, answer, values, structure, hint, steps: ["Use the inverse calculation.", "Only one digit fits the complete equation."], visual: visual.worked([display], -1, "Work backwards") });
    },
  }),
  define({
    id: "fraction-visual-identification", strand: "fractions", subskill: "seeing fractions", min: 22, max: 68,
    modes: ["mix", "focus", "quick", "think", "my-mix"],
    structures: ["fraction-read-strip", "fraction-unit-name", "fraction-non-unit-name", "fraction-groups-count", "fraction-match-visual"],
    generate({ rng, target }) {
      const denominator = pick(rng, target < 45 ? [2, 4] : [3, 4, 5, 8]);
      const numerator = target < 35 ? 1 : integer(rng, 1, denominator - 1);
      const structure = pick(rng, this.structures);
      const answer = fraction(numerator, denominator);
      const strip = visual.fractionStrip(numerator, denominator);
      if (structure === "fraction-groups-count") {
        const unit = integer(rng, 2, 8); const total = denominator * unit; const selected = numerator * unit;
        return makeQuestion(this, { difficulty: clamp(target, 30, 65), type: "choice", instruction: `${selected} of ${total} counters are indigo. What fraction?`, display: "Choose the fraction", answer, answerType: "fraction", choices: choices(rng, answer, [fraction(selected, total + unit), fraction(denominator - numerator, denominator), fraction(numerator, total)]), values: { numerator, denominator, total }, structure, promptVisual: visual.counters(denominator, unit, `${numerator} of ${denominator} groups selected`), visual: strip, hint: "Count equal groups, not individual counters." });
      }
      if (structure === "fraction-match-visual") return makeQuestion(this, { difficulty: clamp(target, 32, 65), type: "choice", instruction: "Which fraction is shown?", display: "Read the bar", answer, answerType: "fraction", choices: choices(rng, answer, [fraction(Math.max(1, numerator - 1), denominator), fraction(denominator - numerator, denominator), fraction(numerator, denominator + 1)]), values: { numerator, denominator }, structure, promptVisual: visual.bar(denominator, numerator), visual: strip, hint: "Count all equal parts, then shaded parts." });
      return makeQuestion(this, { difficulty: clamp(target, 28, 64), type: "choice", instruction: structure === "fraction-unit-name" ? "Which unit fraction is shown?" : "Which fraction is shown?", display: "Read the strip", answer, answerType: "fraction", choices: choices(rng, answer, [fraction(Math.max(1, numerator - 1), denominator), fraction(numerator, Math.max(2, denominator - 1)), fraction(denominator - numerator, denominator)]), values: { numerator, denominator }, structure, promptVisual: strip, visual: strip, hint: "The denominator counts equal parts; the numerator counts selected parts." });
    },
  }),
  define({
    id: "fraction-quantity-network", strand: "fractions", subskill: "connected fractions of quantities", min: 30, max: 90,
    modes: ["mix", "focus", "think", "my-mix"], thinking: 2,
    structures: ["fraction-unit-quantity", "fraction-nonunit-quantity", "fraction-related-double", "fraction-related-half", "fraction-missing-whole", "fraction-compare-quantity"],
    generate({ rng, target }) {
      const denominator = pick(rng, target < 55 ? [2, 4] : [3, 4, 5, 8]);
      const numerator = target < 45 ? 1 : integer(rng, 1, denominator - 1);
      const unit = integer(rng, 2, target > 72 ? 30 : 15);
      const quantity = denominator * unit;
      const value = numerator * unit;
      const structure = pick(rng, this.structures);
      const common = { difficulty: clamp(target, 38, 87), values: { a: quantity, numerator, denominator }, structure, visual: visual.bar(denominator, numerator, quantity), retrievalKey: `fraction:${numerator}/${denominator}` };
      if (structure === "fraction-related-double") return makeQuestion(this, { ...common, instruction: `If ${fractionToken(numerator, denominator)} of ${quantity} = ${value}, what is…`, display: `${fractionToken(numerator, denominator)} of ${quantity * 2}`, answer: value * 2, hint: "The whole doubled, so the fraction amount doubles.", visual: visual.relationship(`${fractionToken(numerator, denominator)} of ${quantity}`, `${fractionToken(numerator, denominator)} of ${quantity * 2}`, "double") });
      if (structure === "fraction-related-half") return makeQuestion(this, { ...common, instruction: `If ${fractionToken(numerator, denominator)} of ${quantity * 2} = ${value * 2}, what is…`, display: `${fractionToken(numerator, denominator)} of ${quantity}`, answer: value, hint: "The whole halved, so the fraction amount halves." });
      if (structure === "fraction-missing-whole") return makeQuestion(this, { ...common, display: `${fractionToken(1, denominator)} of □ = ${unit}`, answer: quantity, hint: `The whole has ${denominator} equal parts of ${unit}.`, steps: [`${unit} × ${denominator} = □`] });
      if (structure === "fraction-compare-quantity") { const otherNumerator = Math.min(denominator - 1, numerator + 1); return makeQuestion(this, { ...common, type: "choice", instruction: "Which is greater?", display: `${fractionToken(numerator, denominator)} of ${quantity}   or   ${fractionToken(otherNumerator, denominator)} of ${quantity}`, answer: `${fractionToken(otherNumerator, denominator)} of ${quantity}`, choices: shuffle(rng, [`${fractionToken(numerator, denominator)} of ${quantity}`, `${fractionToken(otherNumerator, denominator)} of ${quantity}`]), hint: "The whole and denominator match, so compare numerators." }); }
      return makeQuestion(this, { ...common, display: `${fractionToken(numerator, denominator)} of ${quantity}`, answer: value, hint: `Find [[1/${denominator}]] first.`, steps: [`${quantity} ÷ ${denominator} = ${unit}`, numerator > 1 ? `${unit} × ${numerator} = □` : `So the answer is ${unit}.`] });
    },
  }),
  define({
    id: "fraction-equivalence-missing", strand: "fractions", subskill: "building equivalent fractions", min: 45, max: 88,
    modes: ["mix", "focus", "quick", "think", "my-mix"], thinking: 2,
    structures: ["fraction-missing-numerator", "fraction-missing-denominator", "fraction-select-equivalent", "fraction-scale-back", "fraction-equivalent-to-half"],
    generate({ rng, target }) {
      const denominator = pick(rng, [2, 3, 4, 5, 8]);
      const numerator = integer(rng, 1, denominator - 1);
      const scale = integer(rng, 2, target > 70 ? 6 : 4);
      const structure = pick(rng, this.structures);
      const common = { difficulty: clamp(target, 53, 85), values: { numerator, denominator }, structure, visual: visual.relationship(fractionToken(numerator, denominator), `[[${numerator * scale}/${denominator * scale}]]`, "same value") };
      if (structure === "fraction-missing-numerator") return makeQuestion(this, { ...common, display: `${fractionToken(numerator, denominator)} = [[□/${denominator * scale}]]`, answer: numerator * scale, hint: `The denominator was multiplied by ${scale}.` });
      if (structure === "fraction-missing-denominator") return makeQuestion(this, { ...common, display: `${fractionToken(numerator, denominator)} = [[${numerator * scale}/□]]`, answer: denominator * scale, hint: `Scale numerator and denominator by ${scale}.` });
      if (structure === "fraction-scale-back") return makeQuestion(this, { ...common, display: `[[${numerator * scale}/${denominator * scale}]] = [[□/${denominator}]]`, answer: numerator, hint: `Divide numerator and denominator by ${scale}.` });
      if (structure === "fraction-equivalent-to-half") { const d = pick(rng, [4, 6, 8, 10, 12]); return makeQuestion(this, { ...common, display: `[[1/2]] = [[□/${d}]]`, answer: d / 2, hint: "Half the denominator gives the numerator for one half.", visual: visual.fractionStrip(d / 2, d) }); }
      const answer = fraction(numerator * scale, denominator * scale);
      return makeQuestion(this, { ...common, type: "choice", instruction: `Which is equivalent to ${fractionToken(numerator, denominator)}?`, display: "Choose one", answer, answerType: "fraction", choices: choices(rng, answer, [fraction(numerator + scale, denominator + scale), fraction(numerator, denominator * scale), fraction(numerator * scale, denominator)]), hint: "Scale numerator and denominator equally." });
    },
  }),
  define({
    id: "fraction-order-and-benchmarks", strand: "fractions", subskill: "ordering and comparing fractions", min: 48, max: 94,
    modes: ["mix", "focus", "think", "my-mix"], thinking: 3,
    structures: ["fraction-same-denominator-compare", "fraction-unit-compare", "fraction-benchmark-half", "fraction-order-three", "fraction-distance-from-one"],
    generate({ rng, target }) {
      const structure = pick(rng, this.structures);
      if (structure === "fraction-same-denominator-compare") { const d = pick(rng, [4, 5, 8, 10]); const n1 = integer(rng, 1, d - 2); const n2 = integer(rng, n1 + 1, d - 1); return makeQuestion(this, { difficulty: clamp(target, 54, 90), type: "choice", instruction: "Which is larger?", display: `${fractionToken(n1, d)} or ${fractionToken(n2, d)}`, answer: fraction(n2, d), answerType: "fraction", choices: [fraction(n1, d), fraction(n2, d)], values: { numerator: n2, denominator: d }, structure, hint: "The parts are the same size, so compare numerators.", visual: visual.bar(d, n2) }); }
      if (structure === "fraction-unit-compare") { const d1 = pick(rng, [3, 4, 5]); const d2 = pick(rng, [6, 8, 10]); return makeQuestion(this, { difficulty: clamp(target, 58, 90), type: "choice", instruction: "Which is larger?", display: `${fractionToken(1, d1)} or ${fractionToken(1, d2)}`, answer: fraction(1, Math.min(d1, d2)), answerType: "fraction", choices: [fraction(1, d1), fraction(1, d2)], values: { numerator: 1, denominator: d1 }, structure, hint: "For unit fractions, fewer equal parts means a larger part.", visual: visual.relationship(fractionToken(1, d1), fractionToken(1, d2), "compare part size") }); }
      if (structure === "fraction-benchmark-half") { const d = pick(rng, [4, 6, 8, 10]); const n = pick(rng, [d / 2 - 1, d / 2 + 1]); const answer = n > d / 2 ? fraction(n, d) : "[[1/2]]"; return makeQuestion(this, { difficulty: clamp(target, 62, 92), type: "choice", instruction: "Which is larger?", display: `${fractionToken(n, d)} or [[1/2]]`, answer, answerType: answer === "[[1/2]]" ? "whole" : "fraction", choices: [fraction(n, d), "[[1/2]]"], values: { numerator: n, denominator: d }, structure, hint: `${d / 2}/${d} is exactly one half.`, visual: visual.fractionStrip(n, d) }); }
      if (structure === "fraction-order-three") { const d = pick(rng, [4, 5, 8]); const nums = shuffle(rng, [1, 2, d - 1]).slice(0, 3); const sorted = [...nums].sort((a, b) => a - b); const answer = sorted.map((n) => fraction(n, d)).join(" < "); const wrong = [...sorted].reverse().map((n) => fraction(n, d)).join(" < "); return makeQuestion(this, { difficulty: clamp(target, 68, 93), type: "choice", instruction: "Which order is smallest to largest?", display: nums.map((n) => fractionToken(n, d)).join("   "), answer, choices: choices(rng, answer, [wrong, [sorted[1], sorted[0], sorted[2]].map((n) => fraction(n, d)).join(" < ")], 3), values: { denominator: d }, structure, hint: "The denominators match, so order the numerators.", visual: visual.bar(d, sorted[2]) }); }
      const d = pick(rng, [5, 8, 10]); const n1 = d - 1; const n2 = d - 2; return makeQuestion(this, { difficulty: clamp(target, 66, 92), type: "choice", instruction: "Which is closer to 1?", display: `${fractionToken(n1, d)} or ${fractionToken(n2, d)}`, answer: fraction(n1, d), answerType: "fraction", choices: [fraction(n1, d), fraction(n2, d)], values: { numerator: n1, denominator: d }, structure, hint: "Compare how many equal parts are missing from one whole.", visual: visual.fractionStrip(n1, d) });
    },
  }),
  define({
    id: "fraction-whole-complements", strand: "fractions", subskill: "fractions and one whole", min: 48, max: 88,
    modes: ["mix", "focus", "quick", "think", "my-mix"], thinking: 2,
    structures: ["fraction-complement-one", "fraction-subtract-from-one", "fraction-missing-addend", "fraction-equivalent-whole", "fraction-parts-left"],
    generate({ rng, target }) {
      const denominator = pick(rng, target < 68 ? [4, 5, 8] : [5, 8, 10, 12]);
      const numerator = integer(rng, 1, denominator - 1);
      const remainder = denominator - numerator;
      const structure = pick(rng, this.structures);
      const common = { difficulty: clamp(target, 55, 85), values: { numerator, denominator }, structure, visual: visual.fractionStrip(numerator, denominator) };
      if (structure === "fraction-complement-one" || structure === "fraction-missing-addend") return makeQuestion(this, { ...common, display: `1 = ${fractionToken(numerator, denominator)} + □`, answer: fraction(remainder, denominator), answerType: "fraction", acceptableAnswers: [fraction(remainder / gcd(remainder, denominator), denominator / gcd(remainder, denominator))], hint: `One whole is [[${denominator}/${denominator}]].` });
      if (structure === "fraction-subtract-from-one") return makeQuestion(this, { ...common, display: `1 − ${fractionToken(numerator, denominator)}`, answer: fraction(remainder / gcd(remainder, denominator), denominator / gcd(remainder, denominator)), answerType: "fraction", acceptableAnswers: [fraction(remainder, denominator)], hint: `Write 1 as [[${denominator}/${denominator}]].` });
      if (structure === "fraction-equivalent-whole") return makeQuestion(this, { ...common, display: `[[□/${denominator}]] = 1`, answer: denominator, hint: "A whole has every equal part." });
      return makeQuestion(this, { ...common, type: "choice", instruction: `${fractionToken(numerator, denominator)} is shaded. What is unshaded?`, display: "Complete the whole", answer: fraction(remainder, denominator), answerType: "fraction", choices: choices(rng, fraction(remainder, denominator), [fraction(numerator, denominator), fraction(Math.max(1, remainder - 1), denominator), fraction(remainder, denominator + 1)]), hint: "Shaded and unshaded parts together make the whole." });
    },
  }),
  define({
    id: "fraction-number-lines", strand: "fractions", subskill: "fractions on number lines", min: 52, max: 94,
    modes: ["mix", "focus", "think", "my-mix"], thinking: 3,
    structures: ["fraction-line-read", "fraction-line-missing", "fraction-line-halfway", "fraction-line-equivalent", "fraction-line-estimate"],
    generate({ rng, target }) {
      const denominator = pick(rng, target < 72 ? [4, 5, 8] : [5, 8, 10]);
      const numerator = integer(rng, 1, denominator - 1);
      const structure = pick(rng, this.structures);
      const answer = fraction(numerator, denominator);
      const intervalMarkers = Array.from({ length: denominator - 1 }, (_, index) => (index + 1) / denominator);
      const line = visual.numberLine(0, 1, intervalMarkers, denominator + 1, structure === "fraction-line-equivalent" ? null : numerator - 1, "Fractions from 0 to 1");
      if (structure === "fraction-line-halfway") {
        const halfwayLine = visual.numberLine(0, 2 / denominator, [1 / denominator], 3, 0, "Find the halfway point");
        return makeQuestion(this, { difficulty: clamp(target, 64, 92), display: `Halfway between 0 and ${fractionToken(2, denominator)}`, answer: fraction(1, denominator), answerType: "fraction", values: { numerator: 1, denominator }, structure, promptVisual: halfwayLine, visual: halfwayLine, hint: "Halve the distance on the line." });
      }
      if (structure === "fraction-line-equivalent") { const scale = 2; return makeQuestion(this, { difficulty: clamp(target, 66, 92), type: "choice", instruction: "Which fraction sits at the same point?", display: fractionToken(numerator, denominator), answer: fraction(numerator * scale, denominator * scale), answerType: "fraction", choices: choices(rng, fraction(numerator * scale, denominator * scale), [fraction(numerator, denominator * scale), fraction(numerator + 1, denominator)]), values: { numerator, denominator }, structure, promptVisual: line, visual: line, hint: "Equivalent fractions share one position." }); }
      return makeQuestion(this, { difficulty: clamp(target, 60, 91), type: structure === "fraction-line-estimate" ? "choice" : "numeric", instruction: "What fraction is marked?", display: "Point A", answer, answerType: "fraction", choices: structure === "fraction-line-estimate" ? choices(rng, answer, [fraction(Math.max(1, numerator - 1), denominator), fraction(Math.min(denominator - 1, numerator + 1), denominator)]) : null, values: { numerator, denominator }, structure, promptVisual: line, visual: line, hint: `The whole is divided into ${denominator} equal intervals.` });
    },
  }),
  define({
    id: "decimal-place-relations", strand: "decimals", subskill: "tenths and hundredths place value", min: 48, max: 88,
    modes: ["mix", "focus", "quick", "think", "my-mix"],
    structures: ["decimal-digit-value", "decimal-compose", "decimal-tenth-more", "decimal-tenth-less", "decimal-hundredth-more", "decimal-hundred-grid"],
    generate({ rng, target }) {
      const hundredths = target > 68;
      const whole = integer(rng, 0, 4);
      const tenths = integer(rng, 1, 8);
      const hundredth = hundredths ? integer(rng, 1, 8) : 0;
      const value = Number((whole + tenths / 10 + hundredth / 100).toFixed(2));
      const structure = pick(rng, hundredths ? this.structures : this.structures.slice(0, 4));
      const common = { difficulty: clamp(target, 55, 85), values: { a: value }, structure, visual: hundredths ? visual.hundredGrid(tenths * 10 + hundredth) : visual.bar(10, tenths) };
      if (structure === "decimal-digit-value") return makeQuestion(this, { ...common, instruction: `What is the value of the digit ${hundredths ? hundredth : tenths}?`, display: String(value), answer: hundredths ? hundredth / 100 : tenths / 10, answerType: "decimal", hint: `Find the ${hundredths ? "hundredths" : "tenths"} place.` });
      if (structure === "decimal-compose") return makeQuestion(this, { ...common, instruction: "What decimal is this?", display: `${whole} ones + ${tenths} tenths${hundredths ? ` + ${hundredth} hundredths` : ""}`, answer: value, answerType: "decimal", hint: "Place tenths directly after the decimal point." });
      if (structure === "decimal-tenth-more") return makeQuestion(this, { ...common, display: `0.1 more than ${value}`, answer: Number((value + 0.1).toFixed(2)), answerType: "decimal", hint: "Increase the tenths by one." });
      if (structure === "decimal-tenth-less") return makeQuestion(this, { ...common, display: `0.1 less than ${value}`, answer: Number((value - 0.1).toFixed(2)), answerType: "decimal", hint: "Decrease the tenths by one." });
      if (structure === "decimal-hundredth-more") return makeQuestion(this, { ...common, display: `0.01 more than ${value}`, answer: Number((value + 0.01).toFixed(2)), answerType: "decimal", hint: "Increase the hundredths by one." });
      return makeQuestion(this, { ...common, type: "choice", instruction: "Which decimal is shown?", display: "Read the hundred grid", answer: Number(((tenths * 10 + hundredth) / 100).toFixed(2)), answerType: "decimal", choices: choices(rng, Number(((tenths * 10 + hundredth) / 100).toFixed(2)), [tenths / 10, hundredth / 100, (tenths + hundredth) / 10]), promptVisual: visual.hundredGrid(tenths * 10 + hundredth), hint: "Each small square is one hundredth." });
    },
  }),
  define({
    id: "decimal-number-lines", strand: "decimals", subskill: "decimals on number lines", min: 52, max: 92,
    modes: ["mix", "focus", "think", "my-mix"], thinking: 2,
    structures: ["decimal-line-read", "decimal-line-missing", "decimal-line-midpoint", "decimal-line-tenth-step", "decimal-line-hundredth-step"],
    generate({ rng, target }) {
      const hundredths = target > 72;
      const step = hundredths ? 0.01 : 0.1;
      const start = hundredths ? Number((integer(rng, 0, 80) / 100).toFixed(2)) : Number((integer(rng, 0, 30) / 10).toFixed(1));
      const markerIndex = integer(rng, 1, 4);
      const marker = Number((start + markerIndex * step).toFixed(2));
      const max = Number((start + 5 * step).toFixed(2));
      const structure = pick(rng, hundredths ? this.structures : this.structures.slice(0, 4));
      const intervalMarkers = Array.from({ length: 4 }, (_, index) => Number((start + (index + 1) * step).toFixed(2)));
      const line = visual.numberLine(start, max, intervalMarkers, 6, markerIndex - 1, "Decimals on a number line");
      if (structure === "decimal-line-midpoint") {
        const end = Number((start + step * 4).toFixed(2));
        const middle = Number((start + step * 2).toFixed(2));
        const midpointLine = visual.numberLine(start, end, [middle], 5, 0, "Find the halfway point");
        return makeQuestion(this, { difficulty: clamp(target, 61, 90), instruction: "What is halfway?", display: `${start} — ${end}`, answer: middle, answerType: "decimal", values: { a: start, b: end }, structure, promptVisual: midpointLine, visual: midpointLine, hint: "Find half the interval." });
      }
      return makeQuestion(this, { difficulty: clamp(target, 58, 90), type: structure.includes("read") ? "choice" : "numeric", instruction: "What decimal is marked?", display: "Point A", answer: marker, answerType: "decimal", choices: structure.includes("read") ? choices(rng, marker, [Number((marker - step).toFixed(2)), Number((marker + step).toFixed(2)), Number((marker + step / 2).toFixed(2))]) : null, values: { a: start, b: max }, structure, promptVisual: line, visual: line, hint: `Each interval is ${step}.` });
    },
  }),
  define({
    id: "decimal-fraction-network", strand: "decimals", subskill: "fraction and decimal connections", min: 48, max: 90,
    modes: ["mix", "focus", "quick", "think", "my-mix"], thinking: 2,
    structures: ["decimal-to-tenths", "tenths-to-decimal", "hundredths-to-decimal", "decimal-equivalent-choice", "decimal-fraction-scale"],
    generate({ rng, target }) {
      const hundredths = target > 70;
      const denominator = hundredths ? 100 : 10;
      const numerator = integer(rng, 1, denominator - 1);
      const decimal = Number((numerator / denominator).toFixed(hundredths ? 2 : 1));
      const divisor = gcd(numerator, denominator);
      const simple = fraction(numerator / divisor, denominator / divisor);
      const structure = pick(rng, hundredths ? this.structures : this.structures.slice(0, 2).concat("decimal-equivalent-choice"));
      const common = { difficulty: clamp(target, 55, 88), values: { numerator, denominator }, structure, visual: hundredths ? visual.hundredGrid(numerator) : visual.bar(10, numerator), retrievalKey: `decimal:${decimal}` };
      if (structure === "decimal-to-tenths") return makeQuestion(this, { ...common, display: `${decimal} = [[□/${denominator}]]`, answer: numerator, hint: `${decimal} means ${numerator} ${hundredths ? "hundredths" : "tenths"}.` });
      if (structure === "tenths-to-decimal" || structure === "hundredths-to-decimal") return makeQuestion(this, { ...common, display: `[[${numerator}/${denominator}]] = □`, answer: decimal, answerType: "decimal", hint: `Write ${numerator} ${hundredths ? "hundredths" : "tenths"} as a decimal.` });
      if (structure === "decimal-fraction-scale") return makeQuestion(this, { ...common, display: `${decimal} = ${simple}`, answer: "True", type: "choice", choices: ["True", "False"], hint: "Convert both forms to hundredths or tenths." });
      return makeQuestion(this, { ...common, type: "choice", instruction: `Which fraction equals ${decimal}?`, display: "Choose one", answer: simple, answerType: "fraction", choices: choices(rng, simple, [fraction(numerator, denominator * 10), fraction(Math.max(1, numerator - 1), denominator), fraction(numerator + 1, denominator)]), hint: "Read the decimal as tenths or hundredths, then simplify." });
    },
  }),
  define({
    id: "decimal-comparison-and-complements", strand: "decimals", subskill: "decimal comparison and complements", min: 54, max: 94,
    modes: ["mix", "focus", "think", "my-mix"], thinking: 2,
    structures: ["decimal-compare", "decimal-complement-one", "decimal-add-tenths", "decimal-subtract-tenths", "decimal-equivalent-zeros", "decimal-order"],
    generate({ rng, target }) {
      const structure = pick(rng, this.structures);
      if (structure === "decimal-compare") { const a = Number((integer(rng, 2, 9) / 10).toFixed(1)); const b = Number((a - 0.04 + pick(rng, [-0.02, 0.02])).toFixed(2)); const answer = a > b ? String(a) : String(b); return makeQuestion(this, { difficulty: clamp(target, 62, 91), type: "choice", instruction: "Which is greater?", display: `${a} or ${b}`, answer, choices: [String(a), String(b)], values: { a, b }, structure, hint: `Write ${a} as ${a.toFixed(2)} to compare hundredths.`, visual: visual.numberLine(Math.min(a, b) - 0.05, Math.max(a, b) + 0.05, [a, b], 5) }); }
      if (structure === "decimal-complement-one") { const a = Number((integer(rng, 1, 9) / 10).toFixed(1)); return makeQuestion(this, { difficulty: clamp(target, 58, 88), display: `${a} + □ = 1`, answer: Number((1 - a).toFixed(1)), answerType: "decimal", values: { a, b: 1 }, structure, hint: "Complete 10 tenths.", visual: visual.bar(10, Math.round(a * 10)) }); }
      if (structure === "decimal-add-tenths") { const a = Number((integer(rng, 2, 18) / 10).toFixed(1)); const b = Number((integer(rng, 1, 6) / 10).toFixed(1)); return makeQuestion(this, { difficulty: clamp(target, 58, 88), display: `${a} + ${b}`, answer: Number((a + b).toFixed(1)), answerType: "decimal", values: { a, b }, structure, hint: "Add tenths to tenths.", visual: visual.bar(10, Math.round((a % 1) * 10)) }); }
      if (structure === "decimal-subtract-tenths") { const a = Number((integer(rng, 7, 20) / 10).toFixed(1)); const b = Number((integer(rng, 1, Math.min(6, Math.round(a * 10) - 1)) / 10).toFixed(1)); return makeQuestion(this, { difficulty: clamp(target, 60, 90), display: `${a} − ${b}`, answer: Number((a - b).toFixed(1)), answerType: "decimal", values: { a, b }, structure, hint: "Subtract tenths from tenths.", visual: visual.numberLine(a - b, a, [a - b, a], 5) }); }
      if (structure === "decimal-equivalent-zeros") { const a = Number((integer(rng, 1, 9) / 10).toFixed(1)); return makeQuestion(this, { difficulty: clamp(target, 56, 86), type: "choice", instruction: "True or false?", display: `${a} = ${a.toFixed(2)}`, answer: "True", choices: ["True", "False"], values: { a }, structure, hint: "A trailing zero does not change the value.", visual: visual.bar(10, Math.round(a * 10), null, "The same number of tenths") }); }
      const values = [0.4, 0.35, 0.7]; const sorted = [...values].sort((a, b) => a - b); const answer = sorted.join(" < "); return makeQuestion(this, { difficulty: clamp(target, 68, 92), type: "choice", instruction: "Which order is smallest to largest?", display: values.join("   "), answer, choices: choices(rng, answer, [[...sorted].reverse().join(" < "), [sorted[1], sorted[0], sorted[2]].join(" < ")], 3), values: {}, structure, hint: "Compare tenths, then hundredths.", visual: visual.numberLine(0, 1, values, 11, null, "Compare their positions") });
    },
  }),
  define({
    id: "intelligent-sequences", strand: "number", subskill: "connected sequences", min: 24, max: 96,
    modes: ["mix", "focus", "quick", "think", "my-mix"], thinking: 2,
    structures: ["sequence-constant-up", "sequence-constant-down", "sequence-decimal", "sequence-double", "sequence-half", "sequence-missing-middle", "sequence-rule-choice"],
    generate({ rng, target }) {
      const structure = pick(rng, target < 50 ? this.structures.slice(0, 2).concat("sequence-missing-middle") : this.structures);
      let values; let answer; let hint;
      if (structure === "sequence-decimal") { const step = pick(rng, [0.1, 0.2, 0.25]); const start = pick(rng, [0, 0.1, 0.2, 0.5]); values = [start, start + step, start + step * 2, start + step * 3].map((v) => Number(v.toFixed(2))); answer = values[3]; hint = `Add ${step} each time.`; }
      else if (structure === "sequence-double") { const start = integer(rng, 2, 25); values = [start, start * 2, start * 4, start * 8]; answer = values[3]; hint = "Each term is double the previous term."; }
      else if (structure === "sequence-half") { const end = integer(rng, 2, 20); values = [end * 8, end * 4, end * 2, end]; answer = values[3]; hint = "Each term is half the previous term."; }
      else { const step = pick(rng, target > 65 ? [25, 50, 100, 250, 500] : [2, 5, 10, 20, 50]); const direction = structure === "sequence-constant-down" ? -1 : 1; const start = direction < 0 ? step * integer(rng, 6, 14) : integer(rng, 2, 30) * Math.min(step, 10); values = [start, start + direction * step, start + direction * step * 2, start + direction * step * 3]; answer = values[3]; hint = `${direction > 0 ? "Add" : "Subtract"} ${format(step)} each time.`; }
      if (structure === "sequence-missing-middle") return makeQuestion(this, { difficulty: clamp(target, 34, 88), display: `${format(values[0])}, □, ${format(values[2])}, ${format(values[3])}`, answer: values[1], answerType: Number.isInteger(values[1]) ? "whole" : "decimal", values: { a: values[0] }, structure, hint, visual: visual.numberLine(Math.min(...values), Math.max(...values), values, 4, 1) });
      if (structure === "sequence-rule-choice") return makeQuestion(this, { difficulty: clamp(target, 58, 92), type: "choice", instruction: "What is the rule?", display: values.slice(0, 3).map(format).join(", "), answer: hint.replace(" each time.", ""), choices: choices(rng, hint.replace(" each time.", ""), ["Add 10", "Double", "Subtract 5"]), values: { a: values[0] }, structure, hint: "Compare consecutive terms.", visual: visual.numberLine(Math.min(...values), Math.max(...values), values, 4, null, "See the equal steps") });
      return makeQuestion(this, { difficulty: clamp(target, 32, 93), display: `${values.slice(0, 3).map(format).join(", ")}, □`, answer, answerType: Number.isInteger(answer) ? "whole" : "decimal", values: { a: values[0] }, structure, hint, visual: visual.numberLine(Math.min(...values), Math.max(...values), values, 4) });
    },
  }),
  define({
    id: "alternating-sequences", strand: "number", subskill: "alternating and multiplicative sequences", min: 76, max: 100,
    modes: ["mix", "think", "my-mix"], thinking: 4,
    structures: ["sequence-alternate-add", "sequence-alternate-subtract", "sequence-multiply-two", "sequence-multiply-three", "sequence-add-double"],
    generate({ rng, target }) {
      const structure = pick(rng, this.structures);
      let values; let answer; let hint;
      if (structure === "sequence-alternate-add") { const start = integer(rng, 10, 40); const x = pick(rng, [5, 10, 20]); const y = pick(rng, [2, 4, 8]); values = [start, start + x, start + x + y, start + x * 2 + y, start + x * 2 + y * 2]; answer = values[4]; hint = `The changes alternate: +${x}, +${y}.`; }
      else if (structure === "sequence-alternate-subtract") { const x = pick(rng, [50, 100]); const y = pick(rng, [10, 20]); const start = integer(rng, 8, 15) * 100; values = [start, start - x, start - x - y, start - x * 2 - y, start - x * 2 - y * 2]; answer = values[4]; hint = `The changes alternate: −${x}, −${y}.`; }
      else if (structure === "sequence-multiply-three") { const start = integer(rng, 2, 6); values = [start, start * 3, start * 9, start * 27]; answer = values[3]; hint = "Multiply by 3 each time."; }
      else if (structure === "sequence-add-double") { const start = integer(rng, 2, 9); values = [start, start + 5, (start + 5) * 2, (start + 5) * 2 + 5]; answer = values[3]; hint = "The rule alternates: add 5, then double."; }
      else { const start = integer(rng, 3, 25); values = [start, start * 2, start * 4, start * 8]; answer = values[3]; hint = "Double each time."; }
      return makeQuestion(this, { difficulty: clamp(target, 82, 99), display: `${values.slice(0, -1).map(format).join(", ")}, □`, answer, values: { a: values[0] }, structure, hint, visual: visual.relationship("term", "next term", hint) });
    },
  }),
  define({
    id: "estimation-fluency", strand: "mixed", subskill: "estimation and magnitude", min: 48, max: 98,
    modes: ["mix", "focus", "think", "my-mix"], thinking: 3,
    structures: ["estimate-addition", "estimate-subtraction", "estimate-product", "estimate-division", "closest-estimate"],
    generate({ rng, target }) {
      const structure = pick(rng, this.structures);
      let display; let estimate; let distractors; let hint;
      if (structure === "estimate-addition") { const a = integer(rng, 250, 880); const b = integer(rng, 220, 890); estimate = Math.round(a / 100) * 100 + Math.round(b / 100) * 100; display = `${a} + ${b}`; distractors = [estimate - 100, estimate + 100, estimate + 300]; hint = "Round each addend to the nearest 100."; }
      else if (structure === "estimate-subtraction") { const a = integer(rng, 700, 1900); const b = integer(rng, 210, a - 200); estimate = Math.round(a / 100) * 100 - Math.round(b / 100) * 100; display = `${format(a)} − ${format(b)}`; distractors = [estimate - 100, estimate + 100, estimate + 300]; hint = "Round both numbers to friendly hundreds."; }
      else if (structure === "estimate-product") { const a = pick(rng, [19, 21, 29, 31, 49, 51]); const b = pick(rng, [9, 11, 19, 21]); estimate = Math.round(a / 10) * 10 * (Math.round(b / 10) * 10); display = `${a} × ${b}`; distractors = [estimate / 2, estimate * 2, estimate + 100]; hint = "Round both factors to friendly tens."; }
      else if (structure === "estimate-division") { const divisor = pick(rng, [4, 5, 8, 10]); const q = pick(rng, [20, 30, 40, 50, 60]); const exact = divisor * q + pick(rng, [-2, -1, 1, 2]); estimate = q; display = `${exact} ÷ ${divisor}`; distractors = [q - 10, q + 10, q * 2]; hint = `Use a nearby multiple of ${divisor}.`; }
      else { const a = integer(rng, 350, 650); const b = integer(rng, 350, 650); const exact = a + b; estimate = Math.round(exact / 100) * 100; display = `${a} + ${b}`; distractors = [estimate - 200, estimate + 200, estimate + 500]; hint = "Use magnitude: hundreds first."; }
      return makeQuestion(this, { difficulty: clamp(target, 58, 95), type: "choice", instruction: "Which is the best estimate?", display, answer: format(estimate), choices: choices(rng, format(estimate), distractors.map(format)), values: {}, structure, hint, visual: visual.relationship(display, `≈ ${format(estimate)}`, "rounds to") });
    },
  }),
  define({
    id: "reasonable-or-not", strand: "mixed", subskill: "checking reasonableness", min: 62, max: 100,
    modes: ["mix", "think", "my-mix"], thinking: 3,
    structures: ["reasonable-addition", "reasonable-subtraction", "reasonable-product", "reasonable-division", "reasonable-place-value"],
    generate({ rng, target }) {
      const structure = pick(rng, this.structures);
      const isReasonable = rng() > 0.5;
      let display; let proposed; let hint;
      if (structure === "reasonable-addition") { const a = integer(rng, 1200, 4800); const b = integer(rng, 1200, 4800); const exact = a + b; proposed = isReasonable ? exact + pick(rng, [-12, -5, 0, 8]) : exact + pick(rng, [2000, 5000]); display = `${format(a)} + ${format(b)} = ${format(proposed)}`; hint = "Estimate the total in thousands."; }
      else if (structure === "reasonable-subtraction") { const a = integer(rng, 3000, 9000); const b = integer(rng, 1000, a - 500); const exact = a - b; proposed = isReasonable ? exact + pick(rng, [-8, 0, 6]) : exact + a; display = `${format(a)} − ${format(b)} = ${format(proposed)}`; hint = "A subtraction result should fit the size of the starting number."; }
      else if (structure === "reasonable-product") { const a = integer(rng, 20, 80); const b = integer(rng, 3, 9); const exact = a * b; proposed = isReasonable ? exact + pick(rng, [-4, 0, 5]) : exact * 10; display = `${a} × ${b} = ${format(proposed)}`; hint = "Round the larger factor to a nearby ten."; }
      else if (structure === "reasonable-division") { const divisor = pick(rng, [4, 5, 8]); const q = integer(rng, 10, 50); const dividend = divisor * q; proposed = isReasonable ? q : q * divisor; display = `${dividend} ÷ ${divisor} = ${proposed}`; hint = "Multiply the proposed quotient by the divisor."; }
      else { const a = integer(rng, 1000, 9000); proposed = isReasonable ? a + 100 : a + 1000; display = `100 more than ${format(a)} is ${format(proposed)}`; hint = "Only the hundreds should change."; }
      return makeQuestion(this, { difficulty: clamp(target, 70, 98), type: "choice", instruction: "Is the proposed answer reasonable?", display, answer: isReasonable ? "Yes" : "No", choices: ["Yes", "No"], values: {}, structure, hint, visual: visual.relationship("estimate", "proposed answer", "check") });
    },
  }),
  define({
    id: "worked-error-spotting", strand: "mixed", subskill: "spotting errors in methods", min: 62, max: 100,
    modes: ["mix", "think", "my-mix"], thinking: 4,
    structures: ["error-addition-partition", "error-subtraction-compensation", "error-multiplication-partial", "error-division-inverse", "error-fraction-unit"],
    generate({ rng, target }) {
      const structure = pick(rng, this.structures);
      let lines; let answer; let options; let hint;
      if (structure === "error-addition-partition") { lines = ["398 + 245", "398 + 200 = 598", "598 + 40 = 638", "638 + 5 = 643"]; answer = "Correct"; options = ["Correct", "The tens step is wrong", "The ones step is wrong"]; hint = "Check each partial addition."; }
      else if (structure === "error-subtraction-compensation") { lines = ["502 − 298", "502 − 300 = 202", "202 − 2 = 200"]; answer = "The adjustment is wrong"; options = ["Correct", "The adjustment is wrong", "The first subtraction is wrong"]; hint = "Subtracting 300 removed 2 too much."; }
      else if (structure === "error-multiplication-partial") { lines = ["48 × 6", "40 × 6 = 240", "8 × 6 = 48", "240 + 48 = 278"]; answer = "The final addition is wrong"; options = ["Correct", "The 40 × 6 fact is wrong", "The final addition is wrong"]; hint = "Check the partial products, then their sum."; }
      else if (structure === "error-division-inverse") { lines = ["420 ÷ 7", "42 ÷ 7 = 6", "So 420 ÷ 7 = 6"]; answer = "The place-value scale is missing"; options = ["Correct", "The known fact is wrong", "The place-value scale is missing"]; hint = "420 is ten times 42."; }
      else { lines = ["[[3/4]] of 20", "20 ÷ 3 = 6 remainder 2", "6 × 4 = 24"]; answer = "Divide by the denominator first"; options = ["Correct", "Divide by the denominator first", "Multiply by 20 first"]; hint = "The denominator tells how many equal parts."; }
      return makeQuestion(this, { difficulty: clamp(target, 72, 99), type: "choice", instruction: "Check the method", display: "Correct or find the first error", answer, choices: shuffle(rng, options), values: {}, structure, promptVisual: visual.worked(lines, answer === "Correct" ? -1 : lines.length - 1), visual: visual.worked(lines, answer === "Correct" ? -1 : lines.length - 1), hint });
    },
  }),
  define({
    id: "better-strategy-choice", strand: "mixed", subskill: "choosing efficient strategies", min: 66, max: 100,
    modes: ["mix", "think", "my-mix"], thinking: 4,
    structures: ["strategy-add-compensation", "strategy-subtract-count-up", "strategy-multiply-near", "strategy-reorder-sum", "strategy-friendly-division"],
    generate({ rng, target }) {
      const structure = pick(rng, this.structures);
      let display; let methodA; let methodB; let answer; let hint;
      if (structure === "strategy-add-compensation") { display = "399 + 248"; methodA = "399 + 200 + 40 + 8"; methodB = "400 + 248 − 1"; answer = "Method B"; hint = "399 is one away from a round hundred."; }
      else if (structure === "strategy-subtract-count-up") { display = "1,004 − 998"; methodA = "Count up from 998 to 1,004"; methodB = "Column subtraction"; answer = "Method A"; hint = "The numbers are very close."; }
      else if (structure === "strategy-multiply-near") { display = "48 × 19"; methodA = "48 × 20 − 48"; methodB = "Add 48 nineteen times"; answer = "Method A"; hint = "19 is one less than 20."; }
      else if (structure === "strategy-reorder-sum") { display = "27 + 46 + 73"; methodA = "27 + 73, then + 46"; methodB = "27 + 46, then + 73"; answer = "Method A"; hint = "Look for a pair that makes 100."; }
      else { display = "420 ÷ 7"; methodA = "Use 42 ÷ 7, then scale"; methodB = "Subtract 7 repeatedly"; answer = "Method A"; hint = "A known related fact is quicker here."; }
      return makeQuestion(this, { difficulty: clamp(target, 76, 99), type: "choice", instruction: `Which is more efficient for ${display}?`, display, answer, choices: shuffle(rng, [`Method A`, `Method B`]), values: {}, structure, promptVisual: visual.worked([`Method A: ${methodA}`, `Method B: ${methodB}`], -1, "Two valid methods"), visual: visual.relationship(methodA, methodB, "compare"), hint, alternatives: [methodA, methodB] });
    },
  }),
  define({
    id: "mental-or-jot", strand: "mixed", subskill: "choosing mental or written methods", min: 58, max: 100,
    modes: ["mix", "think", "my-mix"], thinking: 3,
    structures: ["mental-near-boundary", "mental-place-multiple", "mental-compensation", "jot-four-digit-add", "jot-four-digit-subtract", "jot-multi-partial"],
    generate({ rng, target }) {
      const structure = pick(rng, target < 75 ? this.structures.slice(0, 4) : this.structures);
      let display; let answer; let hint;
      if (structure === "mental-near-boundary") { display = `${pick(rng, [4998, 3999, 9997])} + ${pick(rng, [2, 3, 4])}`; answer = "Mental"; hint = "The first number is very close to a boundary."; }
      else if (structure === "mental-place-multiple") { display = `${pick(rng, [3400, 5200, 7600])} + ${pick(rng, [200, 300, 600])}`; answer = "Mental"; hint = "Only the hundreds change."; }
      else if (structure === "mental-compensation") { display = `${pick(rng, [502, 1004, 3001])} − ${pick(rng, [498, 998, 1999])}`; answer = "Mental"; hint = "Use difference or compensation."; }
      else if (structure === "jot-four-digit-add") { display = `${format(integer(rng, 2400, 6800))} + ${format(integer(rng, 1800, 4200))}`; answer = "Jot"; hint = "Several place-value columns may regroup."; }
      else if (structure === "jot-four-digit-subtract") { const a = integer(rng, 5000, 9800); const b = integer(rng, 1800, a - 500); display = `${format(a)} − ${format(b)}`; answer = "Jot"; hint = "A written record may reduce working-memory load."; }
      else { display = `${integer(rng, 120, 480)} × ${integer(rng, 6, 9)}`; answer = "Jot"; hint = "Partial products are worth recording."; }
      return makeQuestion(this, { difficulty: clamp(target, 68, 98), type: "choice", instruction: "Mental or jot?", display, answer, choices: ["Mental", "Jot"], values: {}, structure, hint, visual: visual.relationship("number structure", "working-memory load", "consider") });
    },
  }),
  define({
    id: "proportional-number-relationships", strand: "mixed", subskill: "scaling and proportional relationships", min: 56, max: 100,
    modes: ["mix", "focus", "think", "my-mix"], thinking: 3,
    structures: ["scale-additive-fact", "scale-multiplicative-fact", "scale-division-fact", "scale-fraction-quantity", "scale-place-value"],
    generate({ rng, target }) {
      const structure = pick(rng, this.structures);
      const a = integer(rng, 3, 9); const b = integer(rng, 3, 9); const p = a * b;
      if (structure === "scale-additive-fact") return makeQuestion(this, { difficulty: clamp(target, 64, 96), instruction: `If ${a} + ${b} = ${a + b}, what is…`, display: `${a * 100} + ${b * 100}`, answer: (a + b) * 100, values: { a, b }, structure, hint: "Both addends are 100 times larger.", visual: visual.relationship(`${a} + ${b}`, `${a * 100} + ${b * 100}`, "× 100") });
      if (structure === "scale-multiplicative-fact") return makeQuestion(this, { difficulty: clamp(target, 66, 97), instruction: `If ${a} × ${b} = ${p}, what is…`, display: `${a * 100} × ${b}`, answer: p * 100, values: { a, b }, structure, hint: "One factor is 100 times larger, so the product is too.", visual: visual.relationship(`${a} × ${b} = ${p}`, `${a * 100} × ${b}`, "× 100") });
      if (structure === "scale-division-fact") return makeQuestion(this, { difficulty: clamp(target, 68, 97), instruction: `If ${p} ÷ ${a} = ${b}, what is…`, display: `${p * 100} ÷ ${a}`, answer: b * 100, values: { a: p * 100, b: a }, structure, hint: "The dividend is 100 times larger.", visual: visual.relationship(`${p} ÷ ${a}`, `${p * 100} ÷ ${a}`, "× 100") });
      if (structure === "scale-fraction-quantity") { const d = pick(rng, [2, 4, 5]); const q = d * integer(rng, 2, 12); return makeQuestion(this, { difficulty: clamp(target, 70, 98), instruction: `If [[1/${d}]] of ${q} = ${q / d}, what is…`, display: `[[1/${d}]] of ${q * 10}`, answer: (q / d) * 10, values: { a: q * 10, numerator: 1, denominator: d }, structure, hint: "The whole is 10 times larger.", visual: visual.relationship(`[[1/${d}]] of ${q}`, `[[1/${d}]] of ${q * 10}`, "× 10") }); }
      const value = integer(rng, 12, 99); return makeQuestion(this, { difficulty: clamp(target, 62, 94), instruction: `If ${value} × 10 = ${value * 10}, what is…`, display: `${value} × 100`, answer: value * 100, values: { a: value, b: 100 }, structure, hint: "100 is ten times 10.", visual: visual.relationship(`${value} × 10`, `${value} × 100`, "scale again") });
    },
  }),
];

export const BUILD2_STRUCTURE_COUNT = BUILD2_FAMILIES.reduce((total, family) => total + family.structures.length, 0);
