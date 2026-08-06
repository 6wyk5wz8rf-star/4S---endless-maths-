const FRACTION_GLYPHS = {
  "1/2": "½",
  "1/3": "⅓",
  "2/3": "⅔",
  "1/4": "¼",
  "3/4": "¾",
  "1/5": "⅕",
  "2/5": "⅖",
  "3/5": "⅗",
  "4/5": "⅘",
  "1/8": "⅛",
  "3/8": "⅜",
  "5/8": "⅝",
  "7/8": "⅞",
};

export const CHALLENGE_ANCHORS = [
  { value: 0, label: "Foundation" },
  { value: 25, label: "Building" },
  { value: 52, label: "Year 4" },
  { value: 76, label: "Challenge" },
  { value: 100, label: "Deep challenge" },
];

export const SUPPORT_ANCHORS = [
  { value: 0, label: "Independent" },
  { value: 34, label: "Prompted" },
  { value: 67, label: "Guided" },
  { value: 100, label: "Modelled" },
];

export const PRESETS = {
  warmup: { challenge: 28, support: 34, label: "Warm up", focus: null },
  year4: { challenge: 56, support: 25, label: "Year 4", focus: null },
  stretch: { challenge: 84, support: 18, label: "Stretch", focus: null },
  tables: { challenge: 48, support: 20, label: "Tables", focus: "tables" },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hashSeed(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function integer(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

function shuffle(rng, items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function roundTo(value, place) {
  return Math.round(value / place) * place;
}

function gcd(a, b) {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right) {
    [left, right] = [right, left % right];
  }
  return left || 1;
}

function fraction(numerator, denominator) {
  return `${numerator}/${denominator}`;
}

function fractionToken(numerator, denominator) {
  const value = fraction(numerator, denominator);
  return FRACTION_GLYPHS[value] ?? `[[${value}]]`;
}

function formatNumber(value) {
  if (typeof value === "number" && !Number.isInteger(value)) {
    return String(Number(value.toFixed(2)));
  }
  return Number(value).toLocaleString("en-GB");
}

function normaliseAnswer(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replaceAll(",", "")
    .replaceAll("−", "-")
    .replaceAll("÷", "/")
    .replace(/\s+/g, " ");
}

function parseFraction(value) {
  const normalised = normaliseAnswer(value);
  const glyphEntry = Object.entries(FRACTION_GLYPHS).find(([, glyph]) => glyph === normalised);
  const fractionText = glyphEntry?.[0] ?? normalised;
  const match = fractionText.match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
  if (!match || Number(match[2]) === 0) return null;
  return Number(match[1]) / Number(match[2]);
}

function makeChoices(rng, answer, distractors) {
  const unique = [...new Set([String(answer), ...distractors.map(String)])].slice(0, 4);
  const numericAnswer = Number(String(answer).replaceAll(",", ""));
  let nudge = 1;
  while (unique.length < 4) {
    const candidate = Number.isFinite(numericAnswer) ? String(numericAnswer + nudge) : `Alternative ${nudge}`;
    if (!unique.includes(candidate)) unique.push(candidate);
    nudge += 1;
  }
  return shuffle(rng, unique);
}

function placeParts(value) {
  const places = [1000, 100, 10, 1];
  return places.map((place) => Math.floor(value / place) % 10);
}

function defaultVisual(strand, values = {}) {
  const { a, b, numerator, denominator } = values;
  if ((strand === "addition" || strand === "subtraction") && Number.isFinite(a) && Number.isFinite(b)) {
    return {
      kind: "place-value",
      title: "See the place values",
      rows: [placeParts(a), placeParts(b)],
      operator: strand === "addition" ? "+" : "−",
    };
  }
  if (strand === "multiplication" && Number.isFinite(a) && Number.isFinite(b)) {
    const factor = Math.min(a, b);
    const groups = Math.max(a, b);
    if (factor <= 10 && groups <= 12) {
      return { kind: "array", title: `${groups} groups of ${factor}`, rows: Math.min(groups, 12), columns: factor };
    }
    return {
      kind: "partition",
      title: "Partition one factor",
      parts: [Math.floor(groups / 10) * 10, groups % 10].filter(Boolean),
      multiplier: factor,
    };
  }
  if (strand === "division" && Number.isFinite(a) && Number.isFinite(b)) {
    return { kind: "groups", title: `Share ${formatNumber(a)} into groups of ${formatNumber(b)}`, total: a, groupSize: b };
  }
  if (strand === "fractions" && Number.isFinite(numerator) && Number.isFinite(denominator)) {
    return { kind: "fraction-strip", title: "See the fraction", numerator, denominator };
  }
  if (strand === "place value" && Number.isFinite(a)) {
    return { kind: "place-value", title: "See each digit's value", rows: [placeParts(a)], operator: "" };
  }
  if (Number.isFinite(a) && Number.isFinite(b)) {
    return { kind: "number-line", title: "Place the numbers", min: Math.min(a, b), max: Math.max(a, b), points: [a, b] };
  }
  return { kind: "relationship", title: "Look for the relationship" };
}

function defaultModel(strand) {
  const models = {
    addition: {
      title: "Watch a related addition",
      display: "36 + 27",
      lines: ["36 + 20 = 56", "56 + 7 = 63"],
      answer: "63",
    },
    subtraction: {
      title: "Watch a related subtraction",
      display: "72 − 38",
      lines: ["72 − 30 = 42", "42 − 8 = 34"],
      answer: "34",
    },
    multiplication: {
      title: "Watch a related multiplication",
      display: "24 × 6",
      lines: ["20 × 6 = 120", "4 × 6 = 24", "120 + 24 = 144"],
      answer: "144",
    },
    division: {
      title: "Watch a related division",
      display: "240 ÷ 6",
      lines: ["24 ÷ 6 = 4", "240 is 10 times larger", "So the quotient is 40"],
      answer: "40",
    },
    fractions: {
      title: "Watch a related fraction",
      display: "[[3/4]] of 20",
      lines: ["20 ÷ 4 = 5", "5 × 3 = 15"],
      answer: "15",
    },
    decimals: {
      title: "Watch related tenths",
      display: "0.7 + 0.2",
      lines: ["7 tenths + 2 tenths", "= 9 tenths"],
      answer: "0.9",
    },
    "place value": {
      title: "Watch the place values",
      display: "3,407",
      lines: ["3 thousands + 4 hundreds", "+ 0 tens + 7 ones"],
      answer: "3,407",
    },
    number: {
      title: "Watch a related midpoint",
      display: "Halfway between 300 and 500",
      lines: ["The gap is 200", "Half the gap is 100", "300 + 100 = 400"],
      answer: "400",
    },
    mixed: {
      title: "Watch the order",
      display: "12 × 4 + 7",
      lines: ["12 × 4 = 48", "48 + 7 = 55"],
      answer: "55",
    },
  };
  return models[strand] ?? models.mixed;
}

function makeScaffold({ strand, values, hint, steps, model }) {
  return {
    hint: hint ?? "Look for a fact or structure you already know.",
    visual: defaultVisual(strand, values),
    steps: steps ?? ["Choose a useful first step.", "Use that result to finish the calculation."],
    model: model ?? defaultModel(strand),
  };
}

function question(definition, payload) {
  const values = payload.values ?? {};
  return {
    id: "",
    family: definition.id,
    strand: definition.strand,
    subskill: definition.subskill,
    difficulty: payload.difficulty,
    type: payload.type ?? "numeric",
    display: payload.display,
    instruction: payload.instruction ?? null,
    answer: String(payload.answer),
    answerType: payload.answerType ?? "whole",
    acceptableAnswers: (payload.acceptableAnswers ?? []).map(String),
    choices: payload.choices ?? null,
    values,
    misconceptions: payload.misconceptions ?? {},
    scaffold: makeScaffold({
      strand: definition.strand,
      values,
      hint: payload.hint,
      steps: payload.steps,
      model: payload.model,
    }),
    relatedFollowUp: payload.relatedFollowUp ?? definition.id,
    metadata: {
      concept: definition.subskill,
      range: [definition.min, definition.max],
      generatedAt: Date.now(),
    },
  };
}

const define = (definition) => definition;

export const QUESTION_FAMILIES = [
  define({
    id: "number-bond", strand: "addition", subskill: "number bonds", min: 0, max: 18,
    generate({ rng, target }) {
      const total = target < 8 ? 10 : pick(rng, [10, 20]);
      const a = integer(rng, 1, total - 1);
      const answer = total - a;
      return question(this, {
        difficulty: 4 + (total === 20 ? 8 : 0), display: `${a} + □ = ${total}`, answer, values: { a, b: answer },
        hint: `What goes with ${a} to make ${total}?`, steps: [`Start at ${a}.`, `Count on to ${total}.`],
        model: { title: "Watch a bond", display: `${Math.max(1, a - 1)} + □ = ${total}`, lines: [`${Math.max(1, a - 1)} + ${total - Math.max(1, a - 1)} = ${total}`], answer: String(total - Math.max(1, a - 1)) },
      });
    },
  }),
  define({
    id: "addition-within-20", strand: "addition", subskill: "addition within 20", min: 0, max: 24,
    generate({ rng, target }) {
      const bridge = target > 9;
      const a = integer(rng, bridge ? 6 : 1, bridge ? 14 : 9);
      const minimumAddend = bridge ? (a < 10 ? Math.max(2, 11 - a) : 2) : 1;
      const b = integer(rng, minimumAddend, Math.min(9, 20 - a));
      return question(this, {
        difficulty: bridge ? 17 : 7, display: `${a} + ${b}`, answer: a + b, values: { a, b },
        hint: bridge ? "Make the next ten first." : "Start with the larger number and count on.",
        steps: bridge ? [`${a} + ${10 - a} = 10`, `Add the ${b - (10 - a)} left over.`] : [`Start at ${Math.max(a, b)}.`, `Count on ${Math.min(a, b)}.`],
        model: { title: "Watch", display: "8 + 5", lines: ["8 + 2 = 10", "10 + 3 = 13"], answer: "13" },
      });
    },
  }),
  define({
    id: "subtraction-within-20", strand: "subtraction", subskill: "subtraction within 20", min: 0, max: 24,
    generate({ rng, target }) {
      const a = integer(rng, target > 10 ? 11 : 6, 20);
      const b = integer(rng, 1, Math.min(9, a - 1));
      return question(this, {
        difficulty: a % 10 < b ? 18 : 8, display: `${a} − ${b}`, answer: a - b, values: { a, b },
        hint: a % 10 < b ? "Step back to 10, then keep going." : "Count back from the first number.",
        steps: a % 10 < b ? [`${a} − ${a - 10} = 10`, `Subtract the ${b - (a - 10)} still left.`] : [`Start at ${a}.`, `Count back ${b}.`],
        model: { title: "Watch", display: "14 − 6", lines: ["14 − 4 = 10", "10 − 2 = 8"], answer: "8" },
      });
    },
  }),
  define({
    id: "double-half", strand: "number", subskill: "doubles and halves", min: 3, max: 38,
    generate({ rng, target }) {
      const isDouble = rng() > 0.45;
      const max = target > 24 ? 50 : 10;
      const base = integer(rng, 2, max);
      const display = isDouble ? `Double ${base}` : `Half of ${base * 2}`;
      return question(this, {
        difficulty: 7 + Math.floor(base / 4), display, answer: isDouble ? base * 2 : base, values: { a: base, b: 2 },
        hint: isDouble ? "Add the number to itself." : "Split it into two equal parts.",
        steps: isDouble ? [`${base} + ${base}`] : [`Find the number that doubles to ${base * 2}.`],
        model: { title: "Watch", display: "Half of 16", lines: ["8 + 8 = 16", "So half is 8"], answer: "8" },
      });
    },
  }),
  define({
    id: "near-double", strand: "addition", subskill: "near doubles", min: 6, max: 38,
    generate({ rng, target }) {
      const a = integer(rng, 3, target > 25 ? 30 : 10);
      const b = a + pick(rng, [-1, 1]);
      return question(this, {
        difficulty: target > 25 ? 31 : 15, display: `${a} + ${b}`, answer: a + b, values: { a, b },
        hint: `Use double ${Math.min(a, b)}, then adjust by 1.`,
        steps: [`Double ${Math.min(a, b)} is ${Math.min(a, b) * 2}.`, `Add 1.`],
        model: { title: "Watch a near double", display: "7 + 8", lines: ["Double 7 is 14", "14 + 1 = 15"], answer: "15" },
      });
    },
  }),
  define({
    id: "simple-groups", strand: "multiplication", subskill: "equal groups", min: 5, max: 30, focus: "tables",
    generate({ rng, target }) {
      const allowed = target < 16 ? [2, 5, 10] : [2, 3, 4, 5, 8, 10];
      const a = pick(rng, allowed);
      const b = integer(rng, 2, target < 16 ? 6 : 12);
      return question(this, {
        difficulty: 9 + allowed.indexOf(a) * 2, display: `${a} × ${b}`, answer: a * b, values: { a, b },
        hint: `Think of ${b} equal groups of ${a}.`, steps: [`Use a fact you know.`, `${b} groups of ${a}.`],
        model: { title: "Watch equal groups", display: "4 × 3", lines: ["4 + 4 + 4", "= 12"], answer: "12" },
      });
    },
  }),
  define({
    id: "simple-sharing", strand: "division", subskill: "sharing and grouping", min: 8, max: 34, focus: "tables",
    generate({ rng, target }) {
      const divisors = target < 20 ? [2, 5, 10] : [2, 3, 4, 5, 8, 10];
      const b = pick(rng, divisors);
      const answer = integer(rng, 2, target < 20 ? 6 : 12);
      const a = b * answer;
      return question(this, {
        difficulty: 12 + divisors.indexOf(b) * 2, display: `${a} ÷ ${b}`, answer, values: { a, b },
        hint: `What multiplied by ${b} makes ${a}?`, steps: [`Think: ${b} × □ = ${a}.`],
        model: { title: "Watch", display: "20 ÷ 5", lines: ["5 × 4 = 20", "So 20 ÷ 5 = 4"], answer: "4" },
      });
    },
  }),
  define({
    id: "small-comparison", strand: "number", subskill: "comparison", min: 3, max: 28,
    generate({ rng, target }) {
      const max = target < 25 ? 60 : 999;
      const a = integer(rng, 10, max);
      let b = clamp(a + pick(rng, [-12, -7, -3, 3, 7, 12]), 1, max);
      if (a === b) b += 1;
      const answer = a > b ? String(a) : String(b);
      return question(this, {
        difficulty: target < 16 ? 10 : 25, type: "choice", instruction: "Which is greater?", display: `${formatNumber(a)}   or   ${formatNumber(b)}`,
        answer, choices: [String(a), String(b)], values: { a, b }, hint: "Compare the highest place value first.",
        steps: ["Compare the hundreds.", "If they match, compare the tens."],
      });
    },
  }),
  define({
    id: "tens-ones", strand: "place value", subskill: "tens and ones", min: 5, max: 32,
    generate({ rng, target }) {
      const max = target > 22 ? 999 : 99;
      const a = integer(rng, 12, max);
      const ones = a % 10;
      const tens = Math.floor(a / 10) % 10;
      const askTens = rng() > 0.5;
      return question(this, {
        difficulty: max > 99 ? 27 : 13, display: `${formatNumber(a)} has how many ${askTens ? "tens" : "ones"}?`, answer: askTens ? tens : ones,
        values: { a }, hint: `Find the ${askTens ? "tens" : "ones"} place.`, steps: ["Read the place-value columns from right to left."],
      });
    },
  }),
  define({
    id: "two-digit-addition", strand: "addition", subskill: "addition across tens", min: 18, max: 48,
    generate({ rng, target }) {
      const crossing = target > 27 || rng() > 0.55;
      let a = integer(rng, 21, 78);
      let b = integer(rng, 11, 49);
      if (crossing && (a % 10) + (b % 10) < 10) b = Math.min(49, b + 7);
      if (!crossing && (a % 10) + (b % 10) >= 10) b = Math.max(10, b - 6);
      const answer = a + b;
      return question(this, {
        difficulty: crossing ? 36 : 24, display: `${a} + ${b}`, answer, values: { a, b },
        hint: crossing ? "Partition the second number. Add the tens, then the ones." : "Add tens, then ones.",
        steps: [`${a} + ${Math.floor(b / 10) * 10} = ${a + Math.floor(b / 10) * 10}`, `${a + Math.floor(b / 10) * 10} + ${b % 10} = □`],
        model: { title: "Watch", display: "36 + 27", lines: ["36 + 20 = 56", "56 + 7 = 63"], answer: "63" },
        misconceptions: { [String(answer - 10)]: "Check whether the ones crossed into a new ten." },
      });
    },
  }),
  define({
    id: "two-digit-subtraction", strand: "subtraction", subskill: "subtraction across tens", min: 20, max: 50,
    generate({ rng, target }) {
      const a = integer(rng, 45, 99);
      let b = integer(rng, 12, a - 10);
      const crossingWanted = target > 28;
      if (crossingWanted && a % 10 >= b % 10) b = Math.min(a - 10, b + 7);
      const answer = a - b;
      return question(this, {
        difficulty: a % 10 < b % 10 ? 38 : 26, display: `${a} − ${b}`, answer, values: { a, b },
        hint: "Subtract the tens, then adjust with the ones.",
        steps: [`${a} − ${Math.floor(b / 10) * 10} = ${a - Math.floor(b / 10) * 10}`, `${a - Math.floor(b / 10) * 10} − ${b % 10} = □`],
        model: { title: "Watch", display: "72 − 38", lines: ["72 − 30 = 42", "42 − 8 = 34"], answer: "34" },
        misconceptions: { [String(Math.abs((Math.floor(a / 10) - Math.floor(b / 10)) * 10 + Math.abs((a % 10) - (b % 10))))]: "The ones cannot always be subtracted in either order." },
      });
    },
  }),
  define({
    id: "complement-boundary", strand: "addition", subskill: "complements", min: 18, max: 58,
    generate({ rng, target }) {
      const boundary = target < 34 ? 100 : pick(rng, [1000, 10000]);
      const step = boundary === 100 ? 1 : boundary === 1000 ? 10 : 100;
      const a = integer(rng, 2, boundary / step - 2) * step;
      return question(this, {
        difficulty: boundary === 100 ? 29 : boundary === 1000 ? 43 : 54, display: `□ + ${formatNumber(a)} = ${formatNumber(boundary)}`,
        answer: boundary - a, values: { a, b: boundary - a }, hint: `Find the gap from ${formatNumber(a)} to ${formatNumber(boundary)}.`,
        steps: [`Count up to ${formatNumber(boundary)}.`, `${formatNumber(boundary)} − ${formatNumber(a)} = □`],
      });
    },
  }),
  define({
    id: "table-recall", strand: "multiplication", subskill: "multiplication-table recall", min: 20, max: 72, focus: "tables",
    generate({ rng, target }) {
      const easier = [2, 5, 10, 3, 4];
      const core = [3, 4, 6, 7, 8, 9, 11, 12];
      const a = pick(rng, target < 38 ? easier : core);
      const b = integer(rng, 2, 12);
      const difficulty = 28 + ([6, 7, 8, 9, 12].includes(a) ? 20 : 5) + (b > 9 ? 4 : 0);
      return question(this, {
        difficulty, display: `${a} × ${b}`, answer: a * b, values: { a, b }, hint: `Use a nearby ${a} times-table fact.`,
        steps: [`Think of ${a} × ${Math.max(1, b - 1)}.`, `Add one more ${a}.`],
        model: { title: "Watch a related fact", display: "7 × 6", lines: ["7 × 5 = 35", "35 + 7 = 42"], answer: "42" },
      });
    },
  }),
  define({
    id: "division-fact", strand: "division", subskill: "corresponding division facts", min: 24, max: 72, focus: "tables",
    generate({ rng, target }) {
      const b = pick(rng, target < 40 ? [2, 3, 4, 5, 10] : [6, 7, 8, 9, 11, 12]);
      const answer = integer(rng, 2, 12);
      const a = b * answer;
      return question(this, {
        difficulty: 30 + ([6, 7, 8, 9, 12].includes(b) ? 20 : 5), display: `${a} ÷ ${b}`, answer, values: { a, b },
        hint: `Turn it around: ${b} × □ = ${a}.`, steps: [`Recall the matching ${b} times-table fact.`],
      });
    },
  }),
  define({
    id: "missing-factor", strand: "multiplication", subskill: "missing factors", min: 28, max: 84, focus: "tables",
    generate({ rng, target }) {
      const a = pick(rng, target < 65 ? [3, 4, 6, 7, 8, 9, 12] : [8, 12, 16, 24]);
      const answer = integer(rng, 3, target < 65 ? 12 : 30);
      const product = a * answer;
      return question(this, {
        difficulty: target < 65 ? 48 : 78, display: `${a} × □ = ${formatNumber(product)}`, answer, values: { a, b: answer },
        hint: `Use division: ${formatNumber(product)} ÷ ${a}.`, steps: [`Ask: how many groups of ${a} make ${formatNumber(product)}?`],
      });
    },
  }),
  define({
    id: "related-scaled-fact", strand: "multiplication", subskill: "related facts and scaling", min: 27, max: 78, focus: "tables",
    generate({ rng, target }) {
      const a = integer(rng, 3, 12);
      const b = integer(rng, 3, 9);
      const scale = target < 55 ? 10 : pick(rng, [10, 100]);
      const scaled = a * scale;
      return question(this, {
        difficulty: scale === 10 ? 42 : 62, instruction: `If ${a} × ${b} = ${a * b}, what is…`, display: `${formatNumber(scaled)} × ${b}`,
        answer: scaled * b, values: { a: scaled, b }, hint: `The first factor is ${scale} times larger.`,
        steps: [`${a} × ${b} = ${a * b}`, `${a * b} × ${scale} = □`],
        model: { title: "Watch the scale", display: "6 × 4 = 24", lines: ["60 is 10 times 6", "So 60 × 4 = 240"], answer: "240" },
      });
    },
  }),
  define({
    id: "fraction-of-quantity", strand: "fractions", subskill: "fractions of quantities", min: 28, max: 82,
    generate({ rng, target }) {
      const denominator = pick(rng, target < 55 ? [2, 4] : [3, 4, 5, 8]);
      const numerator = target < 48 ? 1 : integer(rng, 1, denominator - 1);
      const unit = integer(rng, 2, target < 55 ? 12 : 25);
      const quantity = denominator * unit;
      const answer = numerator * unit;
      return question(this, {
        difficulty: 34 + denominator * 3 + (numerator > 1 ? 12 : 0), display: `${fractionToken(numerator, denominator)} of ${quantity}`,
        answer, values: { a: quantity, b: denominator, numerator, denominator }, hint: `First find [[1/${denominator}]] by dividing by ${denominator}.`,
        steps: [`${quantity} ÷ ${denominator} = ${unit}`, numerator === 1 ? `So the answer is ${unit}.` : `${unit} × ${numerator} = □`],
        model: { title: "Watch", display: "[[3/4]] of 20", lines: ["20 ÷ 4 = 5", "5 × 3 = 15"], answer: "15" },
      });
    },
  }),
  define({
    id: "sequence", strand: "number", subskill: "sequences", min: 20, max: 65,
    generate({ rng, target }) {
      const steps = target < 40 ? [2, 5, 10, 20, 50] : [25, 100, 250, -25, -100];
      const step = pick(rng, steps);
      const start = step < 0 ? integer(rng, 8, 20) * Math.abs(step) : integer(rng, 1, 20) * Math.min(step, 10);
      const values = [start, start + step, start + step * 2, start + step * 3];
      return question(this, {
        difficulty: 29 + Math.min(28, Math.abs(step) / 10), display: `${values.slice(0, 3).map(formatNumber).join("   ·   ")}   ·   □`,
        answer: values[3], values: { a: start, b: step }, hint: "Find the same change between each pair.",
        steps: [`${formatNumber(values[1])} − ${formatNumber(values[0])} = ${formatNumber(step)}`, `Apply that change once more.`],
      });
    },
  }),
  define({
    id: "place-value-compose", strand: "place value", subskill: "composition and decomposition", min: 26, max: 72,
    generate({ rng, target }) {
      const thousands = target < 45 ? integer(rng, 1, 9) : integer(rng, 1, 9);
      const hundreds = integer(rng, 0, 9);
      const tens = integer(rng, 0, 9);
      const ones = integer(rng, 0, 9);
      const value = thousands * 1000 + hundreds * 100 + tens * 10 + ones;
      const omit = target > 55 ? pick(rng, ["hundreds", "tens"]) : null;
      if (omit) {
        const place = omit === "hundreds" ? 100 : 10;
        const digit = omit === "hundreds" ? hundreds : tens;
        const known = value - digit * place;
        return question(this, {
          difficulty: 61, display: `${formatNumber(value)} = ${formatNumber(known)} + □`, answer: digit * place, values: { a: value },
          hint: `Look at the ${omit} digit.`, steps: [`The ${omit} digit is ${digit}.`, `${digit} ${omit} = ${formatNumber(digit * place)}.`],
        });
      }
      return question(this, {
        difficulty: 39, instruction: "What number is this?", display: `${thousands} thousands + ${hundreds} hundreds + ${tens} tens + ${ones} ones`,
        answer: value, values: { a: value }, hint: "Place each digit in its column.", steps: [`Write ${thousands}, ${hundreds}, ${tens}, ${ones} in place-value order.`],
      });
    },
  }),
  define({
    id: "place-value-shift", strand: "place value", subskill: "powers of 10", min: 34, max: 75,
    generate({ rng, target }) {
      const a = integer(rng, 2, target > 60 ? 999 : 99);
      const multiplier = target > 60 ? pick(rng, [10, 100]) : 10;
      return question(this, {
        difficulty: multiplier === 10 ? 46 : 66, display: `${formatNumber(a)} × ${multiplier}`, answer: a * multiplier, values: { a, b: multiplier },
        hint: `Each digit becomes ${multiplier} times its value.`, steps: [`Shift every digit ${multiplier === 10 ? "one" : "two"} place${multiplier === 10 ? "" : "s"} left.`],
      });
    },
  }),
  define({
    id: "add-place-multiple", strand: "addition", subskill: "adding place-value multiples", min: 32, max: 70,
    generate({ rng, target }) {
      const a = target < 50 ? integer(rng, 10, 95) * 10 : integer(rng, 10, 95) * 100;
      const b = target < 50 ? integer(rng, 2, 9) * 10 : integer(rng, 2, 9) * 100;
      return question(this, {
        difficulty: target < 50 ? 42 : 58, display: `${formatNumber(a)} + ${formatNumber(b)}`, answer: a + b, values: { a, b },
        hint: "Only one place-value column changes.", steps: [`Add the ${target < 50 ? "tens" : "hundreds"}.`, "Keep the other places unchanged."],
      });
    },
  }),
  define({
    id: "subtract-place-multiple", strand: "subtraction", subskill: "subtracting place-value multiples", min: 34, max: 72,
    generate({ rng, target }) {
      const unit = target < 52 ? 10 : 100;
      const b = integer(rng, 2, 8) * unit;
      const a = integer(rng, Math.ceil(b / unit) + 3, 90) * unit;
      return question(this, {
        difficulty: unit === 10 ? 44 : 61, display: `${formatNumber(a)} − ${formatNumber(b)}`, answer: a - b, values: { a, b },
        hint: `Subtract the ${unit === 10 ? "tens" : "hundreds"}.`, steps: [`Work in ${unit === 10 ? "tens" : "hundreds"}: ${a / unit} − ${b / unit}.`, `Restore the place value.`],
      });
    },
  }),
  define({
    id: "rounding", strand: "place value", subskill: "rounding", min: 38, max: 76,
    generate({ rng, target }) {
      const place = target < 58 ? pick(rng, [10, 100]) : pick(rng, [100, 1000]);
      const max = place === 1000 ? 9999 : place === 100 ? 4999 : 999;
      let a = integer(rng, place, max);
      if (a % place === 0) a += integer(rng, 1, place - 1);
      const answer = roundTo(a, place);
      return question(this, {
        difficulty: 45 + Math.log10(place) * 6, instruction: `Round to the nearest ${formatNumber(place)}`, display: formatNumber(a), answer,
        values: { a, b: place }, hint: `Find the two nearest multiples of ${formatNumber(place)}.`,
        steps: [`The midpoint decides whether to round up or down.`, `Compare ${formatNumber(a)} with that midpoint.`],
      });
    },
  }),
  define({
    id: "ordering", strand: "place value", subskill: "ordering numbers", min: 38, max: 78,
    generate({ rng, target }) {
      const base = integer(rng, target < 60 ? 100 : 1000, target < 60 ? 850 : 8500);
      const values = shuffle(rng, [base, base + 9, base + 90, base + (target > 60 ? 900 : 45)]);
      const ordered = [...values].sort((left, right) => left - right);
      const answer = ordered.map(formatNumber).join("  <  ");
      const distractors = [
        [...ordered].reverse().map(formatNumber).join("  <  "),
        [ordered[0], ordered[2], ordered[1], ordered[3]].map(formatNumber).join("  <  "),
        [ordered[1], ordered[0], ordered[2], ordered[3]].map(formatNumber).join("  <  "),
      ];
      return question(this, {
        difficulty: target < 60 ? 51 : 69, type: "choice", instruction: "Which order goes from smallest to largest?", display: "Choose the order",
        answer, choices: makeChoices(rng, answer, distractors), values: { a: ordered[0], b: ordered.at(-1) },
        hint: "Compare the highest place-value digit first.", steps: ["Compare thousands, then hundreds.", "Use tens and ones only when earlier digits match."],
      });
    },
  }),
  define({
    id: "year4-addition", strand: "addition", subskill: "four-digit addition", min: 42, max: 88,
    generate({ rng, target }) {
      const digits = target < 62 ? 3 : 4;
      const min = digits === 3 ? 120 : 1200;
      const max = digits === 3 ? 899 : 7999;
      let a = integer(rng, min, max);
      let b = integer(rng, min, Math.min(max, 9999 - a));
      if (target > 55 && (a % 10) + (b % 10) < 10) b += 7;
      const answer = a + b;
      return question(this, {
        difficulty: digits === 3 ? 54 : target > 75 ? 78 : 68, display: `${formatNumber(a)} + ${formatNumber(b)}`, answer, values: { a, b },
        hint: "Keep each digit aligned with its place value.", steps: ["Add the ones.", "Then tens, hundreds and thousands. Regroup when needed."],
        model: { title: "Watch the alignment", display: "2,438 + 1,275", lines: ["8 + 5 = 13: write 3, regroup 1 ten", "Continue one column at a time"], answer: "3,713" },
        misconceptions: { [String(answer - 100)]: "Check every regrouped hundred." },
      });
    },
  }),
  define({
    id: "year4-subtraction", strand: "subtraction", subskill: "four-digit subtraction", min: 44, max: 90,
    generate({ rng, target }) {
      const a = integer(rng, target < 65 ? 500 : 3000, target < 65 ? 1999 : 9999);
      const b = integer(rng, 101, a - 100);
      const answer = a - b;
      return question(this, {
        difficulty: target < 65 ? 57 : target > 78 ? 82 : 70, display: `${formatNumber(a)} − ${formatNumber(b)}`, answer, values: { a, b },
        hint: Math.abs(Math.round(b / 100) * 100 - b) < 8 ? "A nearby round number may make this quicker." : "Keep each digit aligned and regroup carefully.",
        steps: [`Consider ${formatNumber(a)} − ${formatNumber(roundTo(b, 10))}.`, `Adjust by ${formatNumber(roundTo(b, 10) - b)}.`],
        model: { title: "Watch compensation", display: "6,004 − 2,997", lines: ["6,004 − 3,000 = 3,004", "Add back 3 = 3,007"], answer: "3,007" },
      });
    },
  }),
  define({
    id: "multiply-one-digit", strand: "multiplication", subskill: "multiplying by one digit", min: 44, max: 92,
    generate({ rng, target }) {
      const a = target < 72 ? integer(rng, 13, 99) : integer(rng, 120, 999);
      const b = integer(rng, 3, 9);
      const tens = Math.floor(a / 10) * 10;
      const rest = a - tens;
      return question(this, {
        difficulty: target < 58 ? 56 : target < 75 ? 72 : 86, display: `${formatNumber(a)} × ${b}`, answer: a * b, values: { a, b },
        hint: `Partition ${formatNumber(a)} into place-value parts.`,
        steps: [`${formatNumber(tens)} × ${b} = ${formatNumber(tens * b)}`, `${rest} × ${b} = ${rest * b}`, `Combine the partial products.`],
        model: { title: "Watch", display: "48 × 6", lines: ["40 × 6 = 240", "8 × 6 = 48", "240 + 48 = 288"], answer: "288" },
      });
    },
  }),
  define({
    id: "divide-multiples", strand: "division", subskill: "dividing multiples", min: 42, max: 88, focus: "tables",
    generate({ rng, target }) {
      const b = pick(rng, [3, 4, 5, 6, 8, 9, 12]);
      const quotient = target < 68 ? integer(rng, 10, 50) : integer(rng, 30, 200);
      const a = b * quotient;
      return question(this, {
        difficulty: target < 62 ? 57 : 76, display: `${formatNumber(a)} ÷ ${b}`, answer: quotient, values: { a, b },
        hint: `Partition ${formatNumber(a)} into multiples of ${b}.`, steps: [`Use a known ${b} times-table fact.`, "Scale or partition to reach the dividend."],
        model: { title: "Watch", display: "240 ÷ 6", lines: ["24 ÷ 6 = 4", "240 is 10 times larger", "So 240 ÷ 6 = 40"], answer: "40" },
      });
    },
  }),
  define({
    id: "missing-dividend", strand: "division", subskill: "missing dividends", min: 46, max: 90, focus: "tables",
    generate({ rng, target }) {
      const divisor = pick(rng, [3, 4, 5, 6, 8, 9, 12]);
      const quotient = integer(rng, target < 70 ? 4 : 20, target < 70 ? 20 : 120);
      const answer = divisor * quotient;
      return question(this, {
        difficulty: target < 70 ? 61 : 81, display: `□ ÷ ${divisor} = ${quotient}`, answer, values: { a: answer, b: divisor },
        hint: `Undo the division with ${quotient} × ${divisor}.`, steps: [`${quotient} × ${divisor} = □`],
      });
    },
  }),
  define({
    id: "division-remainder", strand: "division", subskill: "remainders", min: 52, max: 88,
    generate({ rng, target }) {
      const divisor = integer(rng, 3, target > 72 ? 12 : 8);
      const quotient = integer(rng, 3, target > 72 ? 40 : 15);
      const remainder = integer(rng, 1, divisor - 1);
      const dividend = divisor * quotient + remainder;
      const answer = `${quotient} remainder ${remainder}`;
      const distractors = [
        `${quotient} remainder ${Math.max(0, remainder - 1)}`,
        `${quotient + 1} remainder ${remainder}`,
        `${quotient - 1} remainder ${remainder + 1}`,
      ];
      return question(this, {
        difficulty: target > 72 ? 79 : 64, type: "choice", instruction: "What is the quotient and remainder?", display: `${dividend} ÷ ${divisor}`,
        answer, choices: makeChoices(rng, answer, distractors), values: { a: dividend, b: divisor },
        hint: `Find the largest multiple of ${divisor} below ${dividend}.`,
        steps: [`${divisor} × ${quotient} = ${divisor * quotient}`, `${dividend} − ${divisor * quotient} = ${remainder}`],
      });
    },
  }),
  define({
    id: "missing-additive", strand: "subtraction", subskill: "inverse relationships", min: 40, max: 86,
    generate({ rng, target }) {
      const answer = integer(rng, target < 65 ? 100 : 500, target < 65 ? 900 : 6000);
      const b = integer(rng, 25, target < 65 ? 450 : 2500);
      const a = answer + b;
      const missingStart = rng() > 0.5;
      return question(this, {
        difficulty: missingStart ? 72 : 58, display: missingStart ? `□ − ${formatNumber(b)} = ${formatNumber(answer)}` : `${formatNumber(a)} − □ = ${formatNumber(answer)}`,
        answer: missingStart ? a : b, values: { a, b }, hint: missingStart ? "Undo the subtraction by adding." : "Find the difference between the two known numbers.",
        steps: missingStart ? [`${formatNumber(answer)} + ${formatNumber(b)} = □`] : [`${formatNumber(a)} − ${formatNumber(answer)} = □`],
      });
    },
  }),
  define({
    id: "fraction-equivalence", strand: "fractions", subskill: "equivalent fractions", min: 46, max: 82,
    generate({ rng, target }) {
      const denominator = pick(rng, target < 68 ? [2, 3, 4, 5] : [3, 4, 5, 8]);
      const numerator = integer(rng, 1, denominator - 1);
      const scale = integer(rng, 2, target < 68 ? 3 : 5);
      const answer = fraction(numerator * scale, denominator * scale);
      const distractors = [
        fraction(numerator + scale, denominator + scale),
        fraction(numerator, denominator * scale),
        fraction(numerator * scale, denominator),
      ];
      return question(this, {
        difficulty: target < 68 ? 59 : 74, type: "choice", instruction: `Which fraction is equivalent to ${fractionToken(numerator, denominator)}?`, display: "Choose one",
        answer, answerType: "fraction", choices: makeChoices(rng, answer, distractors), values: { numerator, denominator },
        hint: "Multiply the numerator and denominator by the same number.", steps: [`${numerator} × ${scale}`, `${denominator} × ${scale}`],
      });
    },
  }),
  define({
    id: "fraction-comparison", strand: "fractions", subskill: "comparing fractions", min: 48, max: 84,
    generate({ rng, target }) {
      const sameDenominator = target < 70;
      let n1;
      let d1;
      let n2;
      let d2;
      do {
        d1 = pick(rng, [4, 5, 8]);
        d2 = sameDenominator ? d1 : pick(rng, [2, 4, 5, 8]);
        n1 = integer(rng, 1, d1 - 1);
        n2 = integer(rng, 1, d2 - 1);
      } while (n1 / d1 === n2 / d2);
      const left = fraction(n1, d1);
      const right = fraction(n2, d2);
      const answer = n1 / d1 > n2 / d2 ? left : right;
      return question(this, {
        difficulty: sameDenominator ? 56 : 76, type: "choice", instruction: "Which is larger?", display: `${fractionToken(n1, d1)}   or   ${fractionToken(n2, d2)}`,
        answer, answerType: "fraction", choices: [left, right], values: { numerator: n1, denominator: d1 },
        hint: sameDenominator ? "The denominators match, so compare the numerators." : "Compare each fraction with one half.",
        steps: ["Use a common denominator or a benchmark fraction."],
      });
    },
  }),
  define({
    id: "decimal-relationship", strand: "decimals", subskill: "tenths and hundredths", min: 50, max: 82,
    generate({ rng, target }) {
      const hundredths = target > 66;
      const place = hundredths ? 100 : 10;
      const a = integer(rng, 1, place - 3) / place;
      const b = integer(rng, 1, Math.min(place - Math.round(a * place) - 1, hundredths ? 15 : 4)) / place;
      const answer = Number((a + b).toFixed(hundredths ? 2 : 1));
      return question(this, {
        difficulty: hundredths ? 72 : 58, display: `${a} + ${b}`, answer, answerType: "decimal", values: { a, b },
        hint: `Add the ${hundredths ? "hundredths" : "tenths"} as whole units of the same size.`,
        steps: [`${a} is ${Math.round(a * place)} ${hundredths ? "hundredths" : "tenths"}.`, `Add ${Math.round(b * place)} more.`],
        model: { title: "Watch", display: "0.7 + 0.2", lines: ["7 tenths + 2 tenths", "= 9 tenths = 0.9"], answer: "0.9" },
      });
    },
  }),
  define({
    id: "decimal-fraction-equivalence", strand: "decimals", subskill: "decimal and fraction equivalence", min: 52, max: 84,
    generate({ rng, target }) {
      const hundredths = target > 70;
      const denominator = hundredths ? 100 : 10;
      const numerator = integer(rng, 1, denominator - 1);
      const decimal = Number((numerator / denominator).toFixed(hundredths ? 2 : 1));
      const divisor = gcd(numerator, denominator);
      const answer = fraction(numerator / divisor, denominator / divisor);
      const distractors = [
        fraction(numerator, denominator * 10),
        fraction(Math.max(1, numerator - 1), denominator),
        fraction(numerator + 1, denominator),
      ];
      return question(this, {
        difficulty: hundredths ? 76 : 61, type: "choice", instruction: `Which fraction is equivalent to ${decimal}?`, display: "Choose one",
        answer, answerType: "fraction", choices: makeChoices(rng, answer, distractors), values: { numerator, denominator },
        hint: `${decimal} means ${numerator} ${hundredths ? "hundredths" : "tenths"}.`, steps: [`Write [[${numerator}/${denominator}]].`, "Simplify if possible."],
      });
    },
  }),
  define({
    id: "halfway", strand: "number", subskill: "midpoints", min: 48, max: 84,
    generate({ rng, target }) {
      const step = target < 68 ? pick(rng, [100, 200, 400]) : pick(rng, [150, 250, 750]);
      const a = integer(rng, 2, 20) * 100;
      const b = a + step * 2;
      return question(this, {
        difficulty: target < 68 ? 59 : 76, instruction: "What number is halfway between…", display: `${formatNumber(a)}   and   ${formatNumber(b)}`,
        answer: a + step, values: { a, b }, hint: "Find the total distance, then halve it.",
        steps: [`${formatNumber(b)} − ${formatNumber(a)} = ${formatNumber(b - a)}`, `Half the gap, then add it to ${formatNumber(a)}.`],
      });
    },
  }),
  define({
    id: "equality-balance", strand: "number", subskill: "equality balancing", min: 42, max: 90,
    generate({ rng, target }) {
      const a = integer(rng, 20, target < 70 ? 200 : 900);
      const b = integer(rng, 5, 99);
      const c = integer(rng, 5, 99);
      const answer = a + b - c;
      return question(this, {
        difficulty: target < 70 ? 62 : 80, display: `${formatNumber(a)} + ${b} = ${c} + □`, answer, values: { a, b: c },
        hint: "Both sides of the equals sign must have the same value.", steps: [`Work out ${formatNumber(a)} + ${b}.`, `Subtract ${c} from that total.`],
      });
    },
  }),
  define({
    id: "estimation", strand: "mixed", subskill: "estimation", min: 54, max: 94,
    generate({ rng, target }) {
      const place = target > 75 ? 1000 : 100;
      const a = integer(rng, place, place * 8 - 1);
      const b = integer(rng, place, place * 8 - 1);
      const estimate = roundTo(a, place) + roundTo(b, place);
      const answer = formatNumber(estimate);
      return question(this, {
        difficulty: target > 75 ? 82 : 66, type: "choice", instruction: `Estimate by rounding each number to the nearest ${formatNumber(place)}.`, display: `${formatNumber(a)} + ${formatNumber(b)}`,
        answer, choices: makeChoices(rng, answer, [estimate - place, estimate + place, estimate + place * 2].map(formatNumber)), values: { a, b },
        hint: "Round each number before adding.", steps: [`${formatNumber(a)} ≈ ${formatNumber(roundTo(a, place))}`, `${formatNumber(b)} ≈ ${formatNumber(roundTo(b, place))}`],
      });
    },
  }),
  define({
    id: "odd-one-out", strand: "mixed", subskill: "odd-one-out arithmetic", min: 58, max: 100,
    generate({ rng, target }) {
      const a = integer(rng, 4, target > 82 ? 20 : 12);
      const b = integer(rng, 3, 9);
      const product = a * b;
      const choices = [
        `${a} × ${b}`,
        `${product} ÷ 1`,
        `${product + b} − ${b}`,
        `${a} × ${b} + ${pick(rng, [1, 2, b])}`,
      ];
      const answer = choices[3];
      return question(this, {
        difficulty: target > 82 ? 91 : 72, type: "choice", instruction: "Which calculation does not have the same value as the others?", display: "Choose the odd one out",
        answer, choices: shuffle(rng, choices), values: { a, b }, hint: "Look for inverse operations and equivalent forms.",
        steps: [`Use ${a} × ${b} = ${product} as the reference fact.`, "Compare each other expression with that value."],
      });
    },
  }),
  define({
    id: "chained-calculation", strand: "mixed", subskill: "chained calculations", min: 70, max: 100,
    generate({ rng, target }) {
      const a = integer(rng, 12, target > 88 ? 60 : 35);
      const b = integer(rng, 3, 9);
      const c = integer(rng, 10, 80);
      const answer = a * b + c;
      return question(this, {
        difficulty: target > 88 ? 94 : 78, display: `${a} × ${b} + ${c}`, answer, values: { a, b },
        hint: "Multiplication comes before addition.", steps: [`${a} × ${b} = ${a * b}`, `${a * b} + ${c} = □`],
        model: { title: "Watch the order", display: "12 × 4 + 7", lines: ["12 × 4 = 48", "48 + 7 = 55"], answer: "55" },
      });
    },
  }),
  define({
    id: "efficient-sum", strand: "addition", subskill: "efficient calculation", min: 72, max: 100,
    generate({ rng, target }) {
      const deep = target > 90;
      const boundary = deep ? pick(rng, [1000, 5000, 10000]) : pick(rng, [100, 500, 1000]);
      const offset = integer(rng, 1, deep ? Math.min(75, boundary / 10) : 15);
      const a = boundary - offset;
      const b = integer(rng, deep ? 1200 : 120, deep ? 6000 : 600);
      const c = offset;
      return question(this, {
        difficulty: deep ? 94 : 84, display: `${formatNumber(a)} + ${formatNumber(b)} + ${c}`, answer: a + b + c, values: { a, b },
        hint: `Which two numbers make ${formatNumber(boundary)}?`, steps: [`${formatNumber(a)} + ${c} = ${formatNumber(boundary)}`, `${formatNumber(boundary)} + ${formatNumber(b)} = □`],
        model: { title: "Watch the shortcut", display: "399 + 487 + 601", lines: ["399 + 601 = 1,000", "1,000 + 487 = 1,487"], answer: "1,487" },
      });
    },
  }),
  define({
    id: "near-multiple-product", strand: "multiplication", subskill: "distributive multiplication", min: 72, max: 100,
    generate({ rng, target }) {
      const a = integer(rng, 21, target > 90 ? 59 : 39);
      const b = pick(rng, [19, 21, 29, 31]);
      const near = roundTo(b, 10);
      return question(this, {
        difficulty: target > 90 ? 96 : 86, display: `${a} × ${b}`, answer: a * b, values: { a, b },
        hint: `${b} is close to ${near}. Use that.`, steps: [`${a} × ${near} = ${a * near}`, `${b > near ? "Add" : "Subtract"} ${a}.`],
        model: { title: "Watch compensation", display: "48 × 19", lines: ["48 × 20 = 960", "960 − 48 = 912"], answer: "912" },
      });
    },
  }),
  define({
    id: "missing-divisor", strand: "division", subskill: "missing divisors", min: 74, max: 100,
    generate({ rng, target }) {
      const answer = pick(rng, [6, 8, 12, 15, 20, 25, 40, 60]);
      const quotient = integer(rng, 4, target > 90 ? 120 : 60);
      const dividend = answer * quotient;
      return question(this, {
        difficulty: target > 90 ? 96 : 84, display: `${formatNumber(dividend)} ÷ □ = ${formatNumber(quotient)}`, answer, values: { a: dividend, b: answer },
        hint: `Use multiplication: ${formatNumber(quotient)} × □ = ${formatNumber(dividend)}.`, steps: [`${formatNumber(dividend)} ÷ ${formatNumber(quotient)} = □`],
      });
    },
  }),
  define({
    id: "sum-and-difference", strand: "mixed", subskill: "simultaneous constraints", min: 78, max: 100,
    generate({ rng, target }) {
      const total = integer(rng, 6, target > 92 ? 30 : 16) * 50;
      let difference = integer(rng, 1, Math.floor(total / 100)) * 50;
      if ((total + difference) % 2 !== 0) difference += 50;
      const high = (total + difference) / 2;
      const low = total - high;
      const answer = `${formatNumber(low)} and ${formatNumber(high)}`;
      const distractors = [
        `${formatNumber(low - 25)} and ${formatNumber(high + 25)}`,
        `${formatNumber(low + 50)} and ${formatNumber(high)}`,
        `${formatNumber(low)} and ${formatNumber(high + 50)}`,
      ];
      return question(this, {
        difficulty: target > 92 ? 98 : 88, type: "choice", instruction: `Which pair has a total of ${formatNumber(total)} and a difference of ${formatNumber(difference)}?`, display: "Choose the pair",
        answer, choices: makeChoices(rng, answer, distractors), values: { a: total, b: difference }, hint: "Start with half the total, then adjust both numbers equally.",
        steps: [`Half of ${formatNumber(total)} is ${formatNumber(total / 2)}.`, `Move ${formatNumber(difference / 2)} from one half to the other.`],
      });
    },
  }),
  define({
    id: "missing-operation-chain", strand: "mixed", subskill: "reverse operations", min: 76, max: 100,
    generate({ rng, target }) {
      const multiplier = integer(rng, 3, target > 90 ? 12 : 8);
      const answer = integer(rng, 4, target > 90 ? 30 : 15);
      const add = integer(rng, 5, 40);
      const result = multiplier * answer + add;
      return question(this, {
        difficulty: target > 90 ? 98 : 86, display: `${multiplier} × □ + ${add} = ${result}`, answer, values: { a: multiplier, b: answer },
        hint: "Undo the addition first, then undo the multiplication.", steps: [`${result} − ${add} = ${result - add}`, `${result - add} ÷ ${multiplier} = □`],
        model: { title: "Watch the reverse steps", display: "3 × □ + 14 = 50", lines: ["50 − 14 = 36", "36 ÷ 3 = 12"], answer: "12" },
      });
    },
  }),
  define({
    id: "calculation-comparison", strand: "mixed", subskill: "calculation comparison", min: 70, max: 100,
    generate({ rng, target }) {
      const base = integer(rng, 30, target > 90 ? 80 : 50);
      const left = `${base - 1} × ${base + 1}`;
      const right = `${base} × ${base}`;
      const leftValue = (base - 1) * (base + 1);
      const rightValue = base * base;
      const answer = rightValue > leftValue ? right : left;
      return question(this, {
        difficulty: target > 88 ? 95 : 82, type: "choice", instruction: "Which calculation is greater?", display: "Choose without long multiplication",
        answer, choices: shuffle(rng, [left, right]), values: { a: base - 1, b: base + 1 },
        hint: `${base - 1} and ${base + 1} are equally far from ${base}.`, steps: [`(${base} − 1) × (${base} + 1) is one less than ${base} × ${base}.`],
      });
    },
  }),
  define({
    id: "missing-digit", strand: "addition", subskill: "missing-digit equations", min: 76, max: 100,
    generate({ rng, target }) {
      const missing = integer(rng, 0, 9);
      const hundreds = integer(rng, 2, 8);
      const ones = integer(rng, 0, 9);
      const a = hundreds * 100 + missing * 10 + ones;
      const b = integer(rng, target > 90 ? 200 : 100, 399);
      const total = a + b;
      return question(this, {
        difficulty: target > 90 ? 97 : 86, instruction: "Find the missing digit", display: `${hundreds}□${ones} + ${b} = ${total}`, answer: missing,
        values: { a, b }, hint: "Use the ones and tens columns to work backwards.", steps: [`Subtract ${b} from ${total}.`, `Read the tens digit of the result.`],
        model: { title: "Watch", display: "4□7 + 286 = 733", lines: ["733 − 286 = 447", "The missing tens digit is 4"], answer: "4" },
      });
    },
  }),
  define({
    id: "true-false-equation", strand: "mixed", subskill: "true or false equations", min: 48, max: 96,
    generate({ rng, target }) {
      const a = integer(rng, 12, target > 75 ? 120 : 60);
      const b = integer(rng, 3, 9);
      const correct = a * b;
      const isTrue = rng() > 0.5;
      const shown = isTrue ? correct : correct + pick(rng, [-b, -2, 2, b]);
      const answer = isTrue ? "True" : "False";
      return question(this, {
        difficulty: target > 75 ? 84 : 61, type: "choice", instruction: "True or false?", display: `${a} × ${b} = ${shown}`,
        answer, choices: ["True", "False"], values: { a, b }, hint: "Estimate first, then test the equality.", steps: [`Calculate ${a} × ${b}.`, `Compare it with ${shown}.`],
      });
    },
  }),
  define({
    id: "find-the-error", strand: "mixed", subskill: "find the error", min: 62, max: 100,
    generate({ rng, target }) {
      const a = integer(rng, target > 85 ? 200 : 40, target > 85 ? 900 : 99);
      const b = integer(rng, 12, Math.min(a - 1, 99));
      const correct = a - b;
      const wrong = correct + pick(rng, [-10, -1, 1, 10]);
      const options = [
        "The ones were handled incorrectly",
        "The tens were handled incorrectly",
        "The operation should be addition",
        "There is no error",
      ];
      const delta = wrong - correct;
      const answer = Math.abs(delta) === 1 ? options[0] : options[1];
      return question(this, {
        difficulty: target > 85 ? 91 : 73, type: "choice", instruction: "A pupil wrote this. Where is the error?", display: `${formatNumber(a)} − ${b} = ${formatNumber(wrong)}`,
        answer, choices: shuffle(rng, options), values: { a, b }, hint: "Work out the calculation in place-value parts.",
        steps: [`The correct answer is ${formatNumber(correct)}.`, `Compare each place with ${formatNumber(wrong)}.`],
      });
    },
  }),
  define({
    id: "fraction-sum", strand: "fractions", subskill: "adding related fractions", min: 64, max: 94,
    generate({ rng, target }) {
      const denominator = pick(rng, target > 82 ? [8, 10, 12] : [4, 5, 8]);
      const n1 = integer(rng, 1, Math.floor(denominator / 2));
      const n2 = integer(rng, 1, denominator - n1 - 1);
      const numerator = n1 + n2;
      const divisor = gcd(numerator, denominator);
      const simple = fraction(numerator / divisor, denominator / divisor);
      return question(this, {
        difficulty: target > 82 ? 89 : 72, display: `${fractionToken(n1, denominator)} + ${fractionToken(n2, denominator)}`,
        answer: simple, answerType: "fraction", acceptableAnswers: [fraction(numerator, denominator)], values: { numerator, denominator },
        hint: "The parts are the same size, so add the numerators.", steps: [`${n1} + ${n2} = ${numerator}`, divisor > 1 ? `Simplify [[${numerator}/${denominator}]].` : "Keep the denominator."],
      });
    },
  }),
];

export function evaluateAnswer(item, rawAnswer) {
  if (rawAnswer === null || rawAnswer === undefined || String(rawAnswer).trim() === "") {
    return { correct: false, empty: true, misconception: null };
  }
  const given = normaliseAnswer(rawAnswer);
  const accepted = [item.answer, ...(item.acceptableAnswers ?? [])].map(normaliseAnswer);
  let correct = accepted.includes(given);
  if (!correct && item.answerType === "decimal") {
    const numericGiven = Number(given);
    correct = Number.isFinite(numericGiven) && Math.abs(numericGiven - Number(item.answer)) < 0.000001;
  }
  if (!correct && item.answerType === "fraction") {
    const givenFraction = parseFraction(given);
    const answerFraction = parseFraction(item.answer);
    correct = givenFraction !== null && answerFraction !== null && Math.abs(givenFraction - answerFraction) < 0.000001;
  }
  return {
    correct,
    empty: false,
    misconception: correct ? null : item.misconceptions?.[given] ?? null,
  };
}

export function validateQuestion(item) {
  const issues = [];
  if (!item || typeof item !== "object") issues.push("Question is not an object");
  if (!item?.family) issues.push("Missing family");
  if (!item?.strand) issues.push("Missing strand");
  if (!item?.display) issues.push("Missing display");
  if (item?.answer === "" || item?.answer === undefined) issues.push("Missing answer");
  if (!Number.isFinite(item?.difficulty) || item.difficulty < 0 || item.difficulty > 100) issues.push("Difficulty out of range");
  if (item?.type === "choice") {
    if (!Array.isArray(item.choices) || item.choices.length < 2) issues.push("Choice question needs choices");
    if (!item.choices?.map(String).includes(String(item.answer))) issues.push("Answer missing from choices");
    if (new Set(item.choices?.map(String)).size !== item.choices?.length) issues.push("Duplicate choices");
  }
  if (!item?.scaffold?.hint || !item?.scaffold?.visual || !item?.scaffold?.steps || !item?.scaffold?.model) issues.push("Incomplete scaffold");
  if (item?.family?.includes("division") || item?.strand === "division") {
    if (Number(item?.values?.b) === 0) issues.push("Division by zero");
  }
  return { valid: issues.length === 0, issues };
}

function weightedPick(rng, options) {
  const total = options.reduce((sum, option) => sum + option.weight, 0);
  let cursor = rng() * total;
  for (const option of options) {
    cursor -= option.weight;
    if (cursor <= 0) return option.value;
  }
  return options.at(-1).value;
}

function rhythmTarget(rng, challenge) {
  const roll = rng();
  if (roll < 0.15) return clamp(challenge - integer(rng, 6, 12), 0, 100);
  if (roll > 0.85) return clamp(challenge + integer(rng, 6, 12), 0, 100);
  return clamp(challenge + integer(rng, -4, 4), 0, 100);
}

export class FluencyEngine {
  constructor({ seed = `session-${Date.now()}`, challenge = 52, focus = null, recentSignatures = [] } = {}) {
    this.seed = String(seed);
    this.rng = mulberry32(hashSeed(this.seed));
    this.challenge = clamp(Number(challenge), 0, 100);
    this.focus = focus;
    this.recentSignatures = Array.isArray(recentSignatures) ? recentSignatures.map(String).slice(-24) : [];
    this.recentFamilies = [];
    this.recentStrands = [];
    this.index = 0;
  }

  setChallenge(value) {
    this.challenge = clamp(Number(value), 0, 100);
  }

  setFocus(focus) {
    this.focus = focus;
  }

  getHistory() {
    return [...this.recentSignatures];
  }

  next() {
    const target = rhythmTarget(this.rng, this.challenge);
    const candidates = QUESTION_FAMILIES.filter((family) => {
      const inRange = target >= family.min - 10 && target <= family.max + 10;
      const focusMatch = !this.focus || family.focus === this.focus;
      return inRange && focusMatch;
    });
    const source = candidates.length ? candidates : QUESTION_FAMILIES.filter((family) => !this.focus || family.focus === this.focus);
    const weighted = source.map((family) => {
      const midpoint = (family.min + family.max) / 2;
      const distance = Math.abs(midpoint - target);
      const familyRepeat = this.recentFamilies.includes(family.id) ? 0.12 : 1;
      const strandCount = this.recentStrands.filter((strand) => strand === family.strand).length;
      const strandBalance = 1 / (1 + strandCount * 0.7);
      return { value: family, weight: Math.max(0.04, (1 / (4 + distance)) * familyRepeat * strandBalance) };
    });

    for (let attempt = 0; attempt < 80; attempt += 1) {
      const family = weightedPick(this.rng, weighted);
      const item = family.generate({ rng: this.rng, target, challenge: this.challenge });
      item.id = `${hashSeed(this.seed).toString(36)}-${String(this.index).padStart(5, "0")}-${family.id}`;
      item.metadata.targetDifficulty = target;
      item.metadata.sessionIndex = this.index;
      const signature = `${family.id}:${item.display}:${item.answer}`;
      const validation = validateQuestion(item);
      const permittedDrift = target < 20 ? 12 : target > 85 ? 16 : 13;
      const difficultyFits = Math.abs(item.difficulty - target) <= permittedDrift;
      const rhythmFits = Math.abs(item.difficulty - this.challenge) <= 18;
      if (validation.valid && difficultyFits && rhythmFits && !this.recentSignatures.includes(signature)) {
        this.index += 1;
        this.recentSignatures.push(signature);
        this.recentFamilies.push(family.id);
        this.recentStrands.push(family.strand);
        this.recentSignatures = this.recentSignatures.slice(-24);
        this.recentFamilies = this.recentFamilies.slice(-7);
        this.recentStrands = this.recentStrands.slice(-8);
        return item;
      }
    }
    throw new Error("Unable to generate a valid, non-repeating question");
  }
}

export function createEngine(options) {
  return new FluencyEngine(options);
}

export function supportBand(value) {
  const support = clamp(Number(value), 0, 100);
  if (support < 18) return "independent";
  if (support < 43) return "prompted";
  if (support < 70) return "guided";
  if (support < 90) return "stepped";
  return "modelled";
}

export function challengeLabel(value) {
  const challenge = clamp(Number(value), 0, 100);
  if (challenge < 20) return "Foundation";
  if (challenge < 40) return "Building";
  if (challenge < 75) return "Year 4";
  if (challenge < 90) return "Challenge";
  return "Deep challenge";
}

export function supportLabel(value) {
  const support = clamp(Number(value), 0, 100);
  return [...SUPPORT_ANCHORS].reverse().find((anchor) => support >= anchor.value)?.label ?? "Independent";
}

export function adaptiveSupport(current, outcome) {
  const support = clamp(Number(current), 0, 100);
  if (outcome === "repeated-struggle") return clamp(support + 12, 0, 100);
  if (outcome === "three-independent-correct") return clamp(support - 8, 0, 100);
  return support;
}

export function generatorCatalogue() {
  return QUESTION_FAMILIES.map(({ id, strand, subskill, min, max, focus }) => ({ id, strand, subskill, min, max, focus: focus ?? null }));
}
