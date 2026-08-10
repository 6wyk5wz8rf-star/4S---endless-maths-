import { BUILD2_FAMILIES, BUILD2_STRUCTURE_COUNT } from "./fluency-build2-families.mjs";

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
  const rng = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  rng.getState = () => state >>> 0;
  rng.setState = (value) => { state = Number(value) >>> 0; };
  return rng;
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

function placeCount(count, unit) {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
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

function defaultVisual(strand, values = {}, display = null) {
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
    if (factor <= 10 && groups <= 12 && factor * groups <= 96) {
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
    const quotient = b > 0 ? Math.floor(a / b) : 0;
    const remainder = b > 0 ? a % b : 0;
    if (b > 0 && remainder === 0 && quotient <= 12) {
      return { kind: "groups", title: `Make groups of ${formatNumber(b)} from ${formatNumber(a)}`, total: a, groupSize: b };
    }
    return {
      kind: "relationship",
      title: remainder ? "See full groups and the remainder" : "Use the inverse fact",
      left: remainder
        ? `${formatNumber(b)} × ${formatNumber(quotient)} + ${formatNumber(remainder)} = ${formatNumber(a)}`
        : `${formatNumber(b)} × ${formatNumber(quotient)} = ${formatNumber(a)}`,
      right: `${formatNumber(a)} ÷ ${formatNumber(b)}`,
      connector: "checks",
    };
  }
  if (strand === "fractions" && Number.isFinite(numerator) && Number.isFinite(denominator)) {
    return { kind: "fraction-strip", title: "See the fraction", numerator, denominator };
  }
  if (strand === "decimals" && Number.isFinite(numerator) && Number.isFinite(denominator)) {
    return denominator === 100
      ? { kind: "hundred-grid", title: "See the hundredths", filled: numerator }
      : { kind: "bar-model", title: "See the tenths", segments: denominator, filled: numerator };
  }
  if (strand === "place value" && Number.isFinite(a)) {
    return { kind: "place-value", title: "See each digit's value", rows: [placeParts(a)], operator: "" };
  }
  if (strand === "mixed") {
    return {
      kind: "relationship",
      title: "Keep the complete relationship in view",
      left: String(display ?? "Read the complete question"),
      right: "Choose a valid first step",
      connector: "then",
    };
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

function makeScaffold({ strand, values, display, hint, steps, model, visual, alternatives }) {
  return {
    hint: hint ?? "Look for a fact or structure you already know.",
    visual: visual ?? defaultVisual(strand, values, display),
    steps: steps ?? ["Choose a useful first step.", "Use that result to finish the calculation."],
    model: model ?? defaultModel(strand),
    alternatives: alternatives ?? [],
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
    promptVisual: payload.promptVisual ?? null,
    scaffold: makeScaffold({
      strand: definition.strand,
      values,
      display: payload.display,
      hint: payload.hint,
      steps: payload.steps,
      model: payload.model,
      visual: payload.visual,
      alternatives: payload.alternatives,
    }),
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
  structures: [definition.id],
  ...definition,
});

const BUILD1_QUESTION_FAMILIES = [
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
      const crossesTen = a > 10 && a % 10 < b;
      return question(this, {
        difficulty: crossesTen ? 18 : 8, display: `${a} − ${b}`, answer: a - b, values: { a, b },
        hint: crossesTen ? "Step back to 10, then keep going." : "Count back from the first number.",
        steps: crossesTen ? [`${a} − ${a - 10} = 10`, `Subtract the ${b - (a - 10)} still left.`] : [`Start at ${a}.`, `Count back ${b}.`],
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
      const whole = base * 2;
      const display = isDouble ? `Double ${base}` : `Half of ${whole}`;
      return question(this, {
        difficulty: 7 + Math.floor(base / 4), display, answer: isDouble ? whole : base, values: isDouble ? { a: base, b: 2 } : { a: whole, b: 2, part: base },
        hint: isDouble ? "Add the number to itself." : "Split it into two equal parts.",
        steps: isDouble ? [`${base} + ${base}`] : [`Find the number that doubles to ${whole}.`],
        model: { title: "Watch", display: "Half of 16", lines: ["8 + 8 = 16", "So half is 8"], answer: "8" },
        visual: isDouble
          ? { kind: "relationship", title: "See two equal parts", left: formatNumber(base), right: `${formatNumber(base)} + ${formatNumber(base)}`, connector: "doubles as" }
          : { kind: "bar-model", title: `Split ${formatNumber(whole)} into two equal parts`, segments: 2, filled: 1, total: whole },
      });
    },
  }),
  define({
    id: "near-double", strand: "addition", subskill: "near doubles", min: 6, max: 38,
    generate({ rng, target }) {
      const a = integer(rng, 3, target > 25 ? 30 : 10);
      const b = a + pick(rng, [-1, 1]);
      return question(this, {
        difficulty: a > 10 ? 27 : 15, display: `${a} + ${b}`, answer: a + b, values: { a, b },
        hint: `Use double ${Math.min(a, b)}, then adjust by 1.`,
        steps: [`Double ${Math.min(a, b)} is ${Math.min(a, b) * 2}.`, `Add 1.`],
        model: { title: "Watch a near double", display: "7 + 8", lines: ["Double 7 is 14", "14 + 1 = 15"], answer: "15" },
      });
    },
  }),
  define({
    id: "simple-groups", strand: "multiplication", subskill: "equal groups", min: 5, max: 30, focus: "tables",
    generate({ rng, target, challenge = target }) {
      const allowed = challenge < 20 ? [2, 5, 10] : [2, 3, 4, 5, 8, 10];
      const a = pick(rng, allowed);
      const b = integer(rng, 2, challenge < 20 ? 6 : 12);
      return question(this, {
        difficulty: 9 + allowed.indexOf(a) * 2, display: `${a} × ${b}`, answer: a * b, values: { a, b },
        hint: `Think of ${b} equal groups of ${a}.`, steps: [`Use a fact you know.`, `${b} groups of ${a}.`],
        model: { title: "Watch equal groups", display: "4 × 3", lines: ["4 + 4 + 4", "= 12"], answer: "12" },
      });
    },
  }),
  define({
    id: "simple-sharing", strand: "division", subskill: "sharing and grouping", min: 8, max: 34, focus: "tables",
    generate({ rng, target, challenge = target }) {
      const divisors = challenge < 20 ? [2, 5, 10] : [2, 3, 4, 5, 8, 10];
      const b = pick(rng, divisors);
      const answer = integer(rng, 2, challenge < 20 ? 6 : 12);
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
      const place = askTens ? "tens" : "ones";
      return question(this, {
        difficulty: max > 99 ? 27 : 13, display: `What digit is in the ${place} place of ${formatNumber(a)}?`, answer: askTens ? tens : ones,
        values: { a }, hint: `Find the ${place} place.`, steps: ["Read the place-value columns from right to left."],
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
    generate({ rng, target, challenge = target }) {
      const boundary = challenge < 34 ? 100 : pick(rng, [1000, 10000]);
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
        visual: { kind: "relationship", title: "Use the inverse", left: `${formatNumber(a)} × □`, right: formatNumber(product), connector: "makes" },
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
        visual: { kind: "number-line", title: "See the sequence", min: Math.min(...values), max: Math.max(...values), points: values, unknown: values.length - 1 },
      });
    },
  }),
  define({
    id: "place-value-compose", strand: "place value", subskill: "composition and decomposition", min: 26, max: 72,
    generate({ rng, target, challenge = target }) {
      const useThousands = challenge >= 38;
      const thousands = useThousands ? integer(rng, 1, 9) : 0;
      const hundreds = integer(rng, useThousands ? 0 : 1, 9);
      const tens = integer(rng, 0, 9);
      const ones = integer(rng, 0, 9);
      const value = thousands * 1000 + hundreds * 100 + tens * 10 + ones;
      const omit = challenge > 55 ? pick(rng, ["hundreds", "tens"]) : null;
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
        difficulty: useThousands ? 39 : 32, instruction: "What number is this?", display: useThousands ? `${placeCount(thousands, "thousand")} + ${placeCount(hundreds, "hundred")} + ${placeCount(tens, "ten")} + ${placeCount(ones, "one")}` : `${placeCount(hundreds, "hundred")} + ${placeCount(tens, "ten")} + ${placeCount(ones, "one")}`,
        answer: value, values: { a: value }, hint: "Place each digit in its column.", steps: [useThousands ? `Write ${thousands}, ${hundreds}, ${tens}, ${ones} in place-value order.` : `Write ${hundreds}, ${tens}, ${ones} in place-value order.`],
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
        visual: { kind: "relationship", title: "Use the inverse", left: `${divisor} × ${quotient}`, right: "the missing dividend", connector: "makes" },
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
        visual: { kind: "part-whole", title: "Full groups and remainder", whole: dividend, parts: [divisor * quotient, remainder] },
        model: {
          title: "Work through this division",
          display: `${dividend} ÷ ${divisor}`,
          lines: [`${divisor} × ${quotient} = ${divisor * quotient}`, `${dividend} − ${divisor * quotient} = ${remainder}`],
          answer,
        },
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
        hint: "Multiply the numerator and denominator by the same number.", steps: [`${numerator} × ${scale} = ${numerator * scale}`, `${denominator} × ${scale} = ${denominator * scale}`],
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
      const total = a + b;
      const c = integer(rng, 5, Math.min(99, total - 1));
      const answer = total - c;
      return question(this, {
        difficulty: target < 70 ? 62 : 80, display: `${formatNumber(a)} + ${b} = ${c} + □`, answer, values: { a, b: c },
        hint: "Both sides of the equals sign must have the same value.", steps: [`Work out ${formatNumber(a)} + ${b}.`, `Subtract ${c} from that total.`],
        visual: { kind: "relationship", title: "Keep both sides equal", left: `${formatNumber(a)} + ${b}`, right: `${c} + □`, connector: "equals" },
      });
    },
  }),
  define({
    id: "estimation", strand: "mixed", subskill: "estimation", min: 54, max: 94,
    generate({ rng, target }) {
      const place = target > 75 ? 1000 : 100;
      const a = integer(rng, place, place * 8 - 1);
      const b = integer(rng, place, place * 8 - 1);
      const roundedA = roundTo(a, place);
      const roundedB = roundTo(b, place);
      const estimate = roundedA + roundedB;
      const answer = formatNumber(estimate);
      const steps = [`${formatNumber(a)} ≈ ${formatNumber(roundedA)}`, `${formatNumber(b)} ≈ ${formatNumber(roundedB)}`];
      return question(this, {
        difficulty: target > 75 ? 82 : 66, type: "choice", instruction: `Estimate by rounding each number to the nearest ${formatNumber(place)}.`, display: `${formatNumber(a)} + ${formatNumber(b)}`,
        answer, choices: makeChoices(rng, answer, [estimate - place, estimate + place, estimate + place * 2].map(formatNumber)), values: { a, b, roundedA, roundedB, place },
        hint: "Round each number before adding.", steps,
        visual: {
          kind: "relationship",
          title: "Round first, then add",
          left: `${formatNumber(a)} ≈ ${formatNumber(roundedA)} and ${formatNumber(b)} ≈ ${formatNumber(roundedB)}`,
          right: `${formatNumber(roundedA)} + ${formatNumber(roundedB)} = □`,
          connector: "then",
        },
        model: { title: "Estimate this calculation", display: `${formatNumber(a)} + ${formatNumber(b)}`, lines: steps, answer },
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
        visual: { kind: "relationship", title: "Use one reference value", left: `${a} × ${b} = ${product}`, right: `Compare every choice with ${product}`, connector: "then" },
        model: { title: "Check every choice", display: "Choose the odd one out", lines: [`${a} × ${b} = ${product}`, `Three choices equal ${product}; one does not.`], answer },
      });
    },
  }),
  define({
    id: "chained-calculation", strand: "mixed", subskill: "chained calculations", min: 70, max: 100,
    generate({ rng, target }) {
      const a = integer(rng, 12, target > 88 ? 60 : 35);
      const b = integer(rng, 3, 9);
      const c = integer(rng, 10, 80);
      const product = a * b;
      const answer = product + c;
      const steps = [`${a} × ${b} = ${product}`, `${product} + ${c} = □`];
      return question(this, {
        difficulty: target > 88 ? 94 : 78, display: `${a} × ${b} + ${c}`, answer, values: { a, b, c, product },
        hint: "Multiplication comes before addition.", steps,
        visual: { kind: "relationship", title: "Do the multiplication first", left: steps[0], right: steps[1], connector: "then" },
        model: { title: "Work in operation order", display: `${a} × ${b} + ${c}`, lines: [steps[0], `${product} + ${c} = ${answer}`], answer: String(answer) },
      });
    },
  }),
  define({
    id: "efficient-sum", strand: "addition", subskill: "efficient calculation", min: 72, max: 100, thinking: 2,
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
        visual: { kind: "relationship", title: "Use the inverse", left: `${formatNumber(quotient)} × □`, right: formatNumber(dividend), connector: "makes" },
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
      const halfTotal = total / 2;
      const halfDifference = difference / 2;
      const distractors = [
        `${formatNumber(low - 25)} and ${formatNumber(high + 25)}`,
        `${formatNumber(low + 50)} and ${formatNumber(high)}`,
        `${formatNumber(low)} and ${formatNumber(high + 50)}`,
      ];
      return question(this, {
        difficulty: target > 92 ? 98 : 88, type: "choice", instruction: `Which pair has a total of ${formatNumber(total)} and a difference of ${formatNumber(difference)}?`, display: "Choose the pair",
        answer, choices: makeChoices(rng, answer, distractors), values: { a: total, b: difference, total, difference, halfTotal, halfDifference }, hint: "Start with half the total, then adjust both numbers equally.",
        steps: [`Half of ${formatNumber(total)} is ${formatNumber(halfTotal)}.`, `Move ${formatNumber(halfDifference)} from one half to the other.`],
        visual: { kind: "relationship", title: "Split, then adjust", left: `${formatNumber(total)} ÷ 2 = ${formatNumber(halfTotal)}`, right: `move ${formatNumber(halfDifference)} each way`, connector: "then" },
        model: { title: "Balance the pair", display: "Choose the pair", lines: [`${formatNumber(total)} ÷ 2 = ${formatNumber(halfTotal)}`, `${formatNumber(halfTotal)} − ${formatNumber(halfDifference)} = ${formatNumber(low)}`, `${formatNumber(halfTotal)} + ${formatNumber(halfDifference)} = ${formatNumber(high)}`], answer },
      });
    },
  }),
  define({
    id: "missing-operation-chain", strand: "mixed", subskill: "reverse operations", min: 76, max: 100,
    generate({ rng, target }) {
      const multiplier = integer(rng, 3, target > 90 ? 12 : 8);
      const answer = integer(rng, 4, target > 90 ? 30 : 15);
      const add = integer(rng, 5, 40);
      const product = multiplier * answer;
      const result = product + add;
      const steps = [`${result} − ${add} = ${product}`, `${product} ÷ ${multiplier} = □`];
      return question(this, {
        difficulty: target > 90 ? 98 : 86, display: `${multiplier} × □ + ${add} = ${result}`, answer, values: { a: multiplier, b: answer, multiplier, add, product, result },
        hint: "Undo the addition first, then undo the multiplication.", steps,
        visual: { kind: "relationship", title: "Undo in reverse order", left: steps[0], right: steps[1], connector: "then" },
        model: { title: "Reverse both operations", display: `${multiplier} × □ + ${add} = ${result}`, lines: [steps[0], `${product} ÷ ${multiplier} = ${answer}`], answer: String(answer) },
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
        visual: { kind: "relationship", title: "Compare the structures", left, right, connector: "compare" },
        model: { title: "Use the difference of squares", display: "Choose without long multiplication", lines: [`${left} = ${leftValue}`, `${right} = ${rightValue}`], answer },
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
        visual: { kind: "relationship", title: "Test both sides", left: `${a} × ${b}`, right: String(shown), connector: "compare with" },
        model: { title: "Check the equality", display: `${a} × ${b} = ${shown}`, lines: [`${a} × ${b} = ${correct}`, `${correct} ${correct === shown ? "=" : "≠"} ${shown}`], answer },
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
        visual: { kind: "relationship", title: "Check the proposed result", left: `${formatNumber(a)} − ${b}`, right: formatNumber(wrong), connector: "compare with" },
        model: { title: "Correct the calculation", display: `${formatNumber(a)} − ${b} = ${formatNumber(wrong)}`, lines: [`${formatNumber(a)} − ${b} = ${formatNumber(correct)}`, `${formatNumber(correct)} ${correct === wrong ? "=" : "≠"} ${formatNumber(wrong)}`], answer },
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

export const QUESTION_FAMILIES = [...BUILD1_QUESTION_FAMILIES, ...BUILD2_FAMILIES];
export const QUESTION_STRUCTURE_COUNT = BUILD1_QUESTION_FAMILIES.length + BUILD2_STRUCTURE_COUNT;

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
  const structure = item?.metadata?.structure;
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
  if (!item?.metadata?.structure) issues.push("Missing mathematical structure");
  if (!item?.metadata?.retrievalKey) issues.push("Missing retrieval key");
  if (item?.scaffold?.alternatives && !Array.isArray(item.scaffold.alternatives)) issues.push("Alternatives must be an array");
  if (item?.connections && !Array.isArray(item.connections)) issues.push("Connections must be an array");
  if (item?.family?.includes("division") || item?.strand === "division") {
    if (Number(item?.values?.b) === 0) issues.push("Division by zero");
  }
  if (item?.answerType === "fraction" && parseFraction(item.answer) === null) issues.push("Invalid fraction answer");
  if (item?.family?.includes("missing-digit") && !/^\d$/.test(String(item.answer))) issues.push("Missing-digit answer must be one digit");
  if (structure === "missing-two-step-subtract") {
    const match = String(item.display).replaceAll(",", "").match(/^(\d+)\s*−\s*□\s*−\s*(\d+)\s*=\s*(\d+)$/);
    if (!match || Number(item.answer) !== Number(match[1]) - Number(match[2]) - Number(match[3])) issues.push("Two-step subtraction has the wrong missing value");
  }
  if (structure === "fraction-unit-name" && Number(item?.values?.numerator) !== 1) issues.push("Unit fraction must have numerator 1");
  if (structure === "fraction-non-unit-name" && Number(item?.values?.numerator) <= 1) issues.push("Non-unit fraction must have numerator greater than 1");
  if (structure === "fraction-missing-whole" && Number(item?.values?.numerator) !== 1) issues.push("Missing-whole unit fraction must have numerator 1");
  if (structure === "decimal-digit-value") {
    const decimalDigits = String(item.display).split(".")[1]?.padEnd(2, "0") ?? "00";
    if (/hundredths/.test(String(item.instruction)) && decimalDigits[0] === decimalDigits[1]) issues.push("Decimal digit-value prompt has an ambiguous repeated digit");
  }
  if (structure === "digit-value") {
    const placeNames = new Map([[1000, "thousands"], [100, "hundreds"], [10, "tens"], [1, "ones"]]);
    const placeName = placeNames.get(Number(item?.values?.place));
    if (!placeName || !String(item.instruction).includes(placeName)) issues.push("Place-value digit prompt does not identify the target place");
  }
  if (structure === "divide-best-known-fact") {
    const fact = String(item.answer).match(/^(\d+)\s*÷\s*(\d+)\s*=\s*(\d+)$/);
    if (!fact || Number(fact[2]) !== Number(item?.values?.b) || Number(fact[1]) / Number(fact[2]) !== Number(fact[3])) {
      issues.push("Division strategy must use an exact whole-number fact with the same divisor");
    }
  }
  if (structure === "divide-partition") {
    const partition = item?.scaffold?.visual;
    const parts = partition?.parts;
    const divisor = Number(item?.values?.b);
    if (partition?.kind !== "part-whole" || !Array.isArray(parts) || parts.length < 2
      || parts.some((part) => !Number.isFinite(Number(part)) || Number(part) <= 0 || Number(part) % divisor !== 0)
      || parts.reduce((sum, part) => sum + Number(part), 0) !== Number(partition.whole)) {
      issues.push("Division partition must show at least two useful divisible parts that make the whole");
    }
  }
  if (structure === "equality-balance") {
    const equation = String(item.display).replaceAll(",", "").match(/^(\d+)\s*\+\s*(\d+)\s*=\s*(\d+)\s*\+\s*□$/);
    const expected = equation ? Number(equation[1]) + Number(equation[2]) - Number(equation[3]) : NaN;
    if (!Number.isFinite(expected) || expected <= 0 || Number(item.answer) !== expected) issues.push("Equality balance must have one positive missing value");
  }
  if (structure === "chained-calculation") {
    const calculation = String(item.display).replaceAll(",", "").match(/^(\d+)\s*×\s*(\d+)\s*\+\s*(\d+)$/);
    const first = calculation ? Number(calculation[1]) * Number(calculation[2]) : NaN;
    const expected = calculation ? first + Number(calculation[3]) : NaN;
    const expectedSteps = calculation ? [`${calculation[1]} × ${calculation[2]} = ${first}`, `${first} + ${calculation[3]} = □`] : [];
    if (!Number.isFinite(expected) || Number(item.answer) !== expected) issues.push("Chained calculation answer disagrees with operation order");
    if (item?.scaffold?.visual?.kind !== "relationship"
      || item.scaffold.visual.left !== expectedSteps[0]
      || item.scaffold.visual.right !== expectedSteps[1]
      || item.scaffold.visual.connector !== "then") {
      issues.push("Chained calculation visual must show the two calculation stages in order");
    }
    if (JSON.stringify(item?.scaffold?.steps) !== JSON.stringify(expectedSteps)) issues.push("Chained calculation steps disagree with the displayed calculation");
    if (String(item?.scaffold?.model?.display) !== String(item.display) || String(item?.scaffold?.model?.answer) !== String(item.answer)) {
      issues.push("Chained calculation model must use the active calculation and answer");
    }
  }
  if (structure === "missing-operation-chain") {
    const calculation = String(item.display).replaceAll(",", "").match(/^(\d+)\s*×\s*□\s*\+\s*(\d+)\s*=\s*(\d+)$/);
    const product = calculation ? Number(calculation[3]) - Number(calculation[2]) : NaN;
    const expected = calculation ? product / Number(calculation[1]) : NaN;
    const expectedSteps = calculation ? [`${calculation[3]} − ${calculation[2]} = ${product}`, `${product} ÷ ${calculation[1]} = □`] : [];
    if (!Number.isFinite(expected) || !Number.isInteger(expected) || Number(item.answer) !== expected) issues.push("Missing-operation chain has the wrong missing value");
    if (item?.scaffold?.visual?.kind !== "relationship"
      || item.scaffold.visual.left !== expectedSteps[0]
      || item.scaffold.visual.right !== expectedSteps[1]
      || item.scaffold.visual.connector !== "then") {
      issues.push("Missing-operation chain visual must preserve the reverse-operation stages");
    }
    if (JSON.stringify(item?.scaffold?.steps) !== JSON.stringify(expectedSteps)) issues.push("Missing-operation chain steps disagree with the displayed equation");
    if (String(item?.scaffold?.model?.display) !== String(item.display) || String(item?.scaffold?.model?.answer) !== String(item.answer)) {
      issues.push("Missing-operation chain model must use the active equation and answer");
    }
  }
  if (item?.family === "multi-step-missing-number") {
    const steps = item?.scaffold?.steps;
    const visual = item?.scaffold?.visual;
    const model = item?.scaffold?.model;
    if (!Array.isArray(steps) || steps.length !== 2 || !String(steps?.[1]).includes("□")) issues.push("Multi-step missing-number scaffold needs two ordered reverse steps");
    if (visual?.kind !== "relationship" || visual.left !== steps?.[0] || visual.right !== steps?.[1] || visual.connector !== "then") {
      issues.push("Multi-step missing-number visual must match its two reverse steps");
    }
    if (String(model?.display) !== String(item.display) || String(model?.answer) !== String(item.answer) || String(model?.lines?.at?.(-1) ?? "").includes("□")) {
      issues.push("Multi-step missing-number model must complete the active equation");
    }
  }
  if (String(structure).startsWith("reasonable-")) {
    const display = String(item.display).replaceAll(",", "");
    const arithmetic = display.match(/^(\d+)\s*([+−×÷])\s*(\d+)\s*=\s*(\d+)$/);
    const placeValue = display.match(/^100 more than (\d+) is (\d+)$/);
    let statementIsTrue = null;
    if (arithmetic) {
      const left = Number(arithmetic[1]);
      const right = Number(arithmetic[3]);
      const proposed = Number(arithmetic[4]);
      const exact = arithmetic[2] === "+" ? left + right : arithmetic[2] === "−" ? left - right : arithmetic[2] === "×" ? left * right : left / right;
      statementIsTrue = exact === proposed;
    } else if (placeValue) {
      statementIsTrue = Number(placeValue[1]) + 100 === Number(placeValue[2]);
    }
    if (statementIsTrue === null || (String(item.answer) === "Yes") !== statementIsTrue) issues.push("Proposed-answer judgement disagrees with the displayed statement");
  }
  for (const [label, visual] of [["Prompt", item?.promptVisual], ["Scaffold", item?.scaffold?.visual]]) {
    if (visual?.kind === "array" && (Number(visual.rows) > 12 || Number(visual.columns) > 12 || Number(visual.rows) * Number(visual.columns) > 96)) {
      issues.push(`${label} array would be visually truncated`);
    }
    if (visual?.kind === "groups" && (Number(visual.total) % Number(visual.groupSize) !== 0 || Number(visual.total) / Number(visual.groupSize) > 12)) {
      issues.push(`${label} equal groups would hide part of the total`);
    }
    if (visual?.kind === "counters" && (Number(visual.groups) > 12 || Number(visual.perGroup) > 12)) {
      issues.push(`${label} counters would be visually truncated`);
    }
    if (!visual || !["number-line", "bead-string"].includes(visual.kind)) continue;
    const markers = visual.markers ?? visual.points ?? [];
    if (!Number.isFinite(visual.min) || !Number.isFinite(visual.max) || visual.max <= visual.min) {
      issues.push(`${label} number line needs a valid increasing range`);
    }
    if (!Array.isArray(markers) || markers.some((marker) => !Number.isFinite(marker) || marker < visual.min || marker > visual.max)) {
      issues.push(`${label} number line has an invalid marker`);
    }
    if (visual.unknown !== null && visual.unknown !== undefined && (!Number.isInteger(visual.unknown) || visual.unknown < 0 || visual.unknown >= markers.length)) {
      issues.push(`${label} number line has an invalid hidden marker`);
    }
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

function rhythmTarget(rng, challenge, bias = 0, mode = "mix") {
  const centre = clamp(challenge + bias, 0, 100);
  if (mode === "quick") return clamp(centre + integer(rng, -3, 3), 0, 100);
  if (mode === "think") return clamp(centre + integer(rng, -2, 7), 0, 100);
  const roll = rng();
  if (roll < 0.15) return clamp(centre - integer(rng, 6, 11), 0, 100);
  if (roll > 0.85) return clamp(centre + integer(rng, 6, 11), 0, 100);
  return clamp(centre + integer(rng, -4, 4), 0, 100);
}

function cloneQuestion(item) {
  return JSON.parse(JSON.stringify(item));
}

function normaliseFocus(value) {
  return String(value ?? "").trim().toLowerCase();
}

function focusMatches(family, focus) {
  const selected = normaliseFocus(focus);
  if (!selected || selected === "mixed") return true;
  if (selected === "tables") {
    return family.focus === "tables" || /table|fact famil|derived multiplication/.test(`${family.id} ${family.subskill}`);
  }
  if (selected === "fractions and decimals") return family.strand === "fractions" || family.strand === "decimals";
  if (selected === "equivalence and missing numbers") {
    return /equival|equal|balanc|missing|comparison|inverse/.test(`${family.id} ${family.subskill}`);
  }
  if (selected === "place value") return family.strand === "place value";
  return family.strand === selected;
}

function itemMatchesFocus(item, focus) {
  const selected = normaliseFocus(focus);
  if (!selected || selected === "mixed") return true;
  if (selected === "tables") {
    const key = item.metadata?.retrievalKey ?? "";
    const sourceFamily = QUESTION_FAMILIES.find((family) => family.id === item.family);
    return ["multiplication", "division", "number"].includes(item.strand) && (sourceFamily?.focus === "tables" || key.startsWith("tables:") || key.startsWith("fact-family:"));
  }
  if (selected === "fractions and decimals") return item.strand === "fractions" || item.strand === "decimals";
  if (selected === "equivalence and missing numbers") {
    const sourceFamily = QUESTION_FAMILIES.find((family) => family.id === item.family);
    return /equival|equal|balanc|missing|comparison|inverse/.test(`${item.family} ${item.subskill} ${sourceFamily?.id ?? ""}`);
  }
  return item.strand === selected;
}

const QUICK_RECALL_FAMILIES = new Set(["number-bond", "double-half", "tens-ones", "complement-boundary", "table-recall", "division-fact", "related-scaled-fact", "add-place-multiple", "subtract-place-multiple", "place-value-shift", "place-value-actions"]);
const FOUNDATION_THINK_FAMILIES = new Set(["number-bond", "near-double", "small-comparison", "foundation-bond-network", "multiplication-foundation-models", "division-foundation-models"]);
const FOUNDATION_EXCLUSIONS = new Set(["two-digit-addition", "two-digit-subtraction", "complement-boundary", "place-value-compose"]);

function modeMatches(family, mode) {
  const modes = family.modes ?? ["mix", "focus"];
  if (mode === "focus") return modes.includes("focus");
  if (mode === "quick") {
    return family.speed === "recall" || QUICK_RECALL_FAMILIES.has(family.id);
  }
  if (mode === "think") return modes.includes("think") || Number(family.thinking) >= 2 || FOUNDATION_THINK_FAMILIES.has(family.id);
  if (mode === "my-mix") return modes.includes("my-mix") || modes.includes("mix");
  return modes.includes("mix");
}

function familyCoversSelection(family, challenge) {
  if (challenge < 20 && (family.strand === "fractions" || FOUNDATION_EXCLUSIONS.has(family.id))) return false;
  if (challenge < 38 && family.strand === "decimals") return false;
  return challenge >= family.min - 5 && challenge <= family.max + 5;
}

function selectionHasCoverage(mode, focus, challenge) {
  return QUESTION_FAMILIES.some((family) => (
    focusMatches(family, focus)
    && modeMatches(family, mode)
    && familyCoversSelection(family, challenge)
  ));
}

/**
 * @param {{ mode?: string, focus?: string | null, challenge?: number }} selection
 * @returns {{ mode: "mix" | "focus" | "quick" | "think" | "my-mix", focus: string | null, challenge: number }}
 */
export function normalisePracticeSelection({ mode = "mix", focus = null, challenge = 52 } = {}) {
  const selectedChallenge = clamp(Number(challenge), 0, 100);
  const requestedMode = ["mix", "focus", "quick", "think", "my-mix"].includes(mode) ? mode : "mix";
  const requestedFocus = normaliseFocus(focus);
  const selectedFocus = requestedFocus && requestedFocus !== "mixed"
    ? requestedFocus
    : null;

  if (selectionHasCoverage(requestedMode, selectedFocus, selectedChallenge)) {
    return { mode: /** @type {"mix" | "focus" | "quick" | "think" | "my-mix"} */ (requestedMode), focus: selectedFocus, challenge: selectedChallenge };
  }

  // Challenge remains authoritative. If a requested practice feel has no
  // suitable generator at that point, preserve the mathematical focus first.
  if (selectedFocus && selectionHasCoverage("focus", selectedFocus, selectedChallenge)) {
    return { mode: "focus", focus: selectedFocus, challenge: selectedChallenge };
  }

  const focusWithoutConflict = null;
  if (selectionHasCoverage(requestedMode, focusWithoutConflict, selectedChallenge)) {
    return { mode: /** @type {"mix" | "focus" | "quick" | "think" | "my-mix"} */ (requestedMode), focus: focusWithoutConflict, challenge: selectedChallenge };
  }

  return { mode: "mix", focus: null, challenge: selectedChallenge };
}

function normaliseList(value) {
  const values = Array.isArray(value) ? value : value === null || value === undefined || value === "" ? [] : [value];
  return [...new Set(values.map((item) => String(item).trim().toLowerCase()).filter(Boolean))];
}

function canonicalFamilyId(value) {
  return String(value ?? "").replace(/-related$/, "").trim().toLowerCase();
}

const SUBSKILL_ALIASES = new Map([
  ["recall facts", /table recall|multiplication-table recall/],
  ["derived facts", /derived/],
  ["fact families", /fact famil/],
  ["multiplying by 10 and 100", /related facts and scaling|powers of 10/],
  ["distributive reasoning", /distribut/],
  ["related facts", /related|corresponding division facts|fact famil/],
  ["grouping and sharing", /group|sharing|division foundations/],
  ["scaling", /scal|dividing multiples/],
  ["missing divisors", /missing divisor/],
  ["compose and partition", /compos|partition/],
  ["compare and order", /compar|order/],
  ["number lines", /number.line/],
  ["powers of ten", /powers of 10|place.value relationships/],
  ["fractions of quantities", /fraction.*quantit/],
  ["equivalence", /equival/],
  ["compare and order", /compar|order/],
  ["fraction number lines", /fraction.*number.line/],
  ["tenths and hundredths", /tenths and hundredths/],
  ["compare", /compar/],
  ["complements", /complement/],
  ["fraction connections", /fraction.*connection|decimal and fraction|fraction and decimal/],
  ["balanced equations", /balanc/],
  ["missing numbers", /missing number|missing additive|missing factor|missing dividend|missing divisor/],
  ["missing digits", /missing.digit/],
  ["calculation comparison", /calculation comparison|comparison without full/],
]);

const TABLE_GROUPS = new Map([
  ["2, 5 and 10", new Set([2, 5, 10])],
  ["3, 4 and 8", new Set([3, 4, 8])],
  ["6, 7, 9, 11 and 12", new Set([6, 7, 9, 11, 12])],
]);

function familySearchText(family) {
  return `${family.id} ${family.subskill} ${(family.structures ?? []).join(" ")}`.toLowerCase();
}

function familyMatchesOneSubskill(family, selected) {
  if (!selected || selected.startsWith("all ")) return true;
  if (TABLE_GROUPS.has(selected)) return family.focus === "tables" || /table|fact|multiplication foundation|division foundation/.test(familySearchText(family));
  const text = familySearchText(family);
  const alias = SUBSKILL_ALIASES.get(selected);
  if (alias) return alias.test(text);
  if (text.includes(selected)) return true;
  const meaningful = selected.split(/\s+/).filter((word) => word.length > 3 && !["with", "from", "into", "numbers"].includes(word));
  return meaningful.length > 0 && meaningful.every((word) => text.includes(word));
}

function familyMatchesSubskills(family, subskills) {
  if (!subskills.length) return true;
  return subskills.some((selected) => familyMatchesOneSubskill(family, selected));
}

function itemTableFactors(item) {
  const key = String(item.metadata?.retrievalKey ?? "");
  const factors = [];
  for (const match of key.matchAll(/(?:tables:|fact-family:|derived:)(\d+)(?:x(\d+))?/g)) {
    factors.push(Number(match[1]));
    if (match[2]) factors.push(Number(match[2]));
  }
  if (!factors.length) {
    for (const value of [item.values?.a, item.values?.b]) {
      const factor = Number(value);
      if (Number.isInteger(factor) && factor >= 2 && factor <= 12) factors.push(factor);
    }
  }
  return factors;
}

function itemMatchesSubskills(item, subskills) {
  if (!subskills.length) return true;
  return subskills.some((selected) => {
    if (!selected || selected.startsWith("all ")) return true;
    const group = TABLE_GROUPS.get(selected);
    if (group) return itemTableFactors(item).some((factor) => group.has(factor));
    const sourceFamily = QUESTION_FAMILIES.find((family) => family.id === canonicalFamilyId(item.family));
    return sourceFamily ? familyMatchesOneSubskill(sourceFamily, selected) : `${item.family} ${item.subskill}`.toLowerCase().includes(selected);
  });
}

function explicitStrategyFamily(family) {
  return /strategy|derived|distribut|efficient|compens|mental.or.jot|better.strategy/.test(familySearchText(family));
}

function normaliseRetrievalWeight(value) {
  if (value === "light") return 0.12;
  if (value === "strong") return 0.55;
  if (value === "balanced" || value === undefined || value === null) return 0.28;
  return clamp(Number.isFinite(Number(value)) ? Number(value) : 0.28, 0, 1);
}

function normaliseRepresentationFrequency(value) {
  if (value === "low") return 0.15;
  if (value === "high") return 0.65;
  if (value === "balanced" || value === undefined || value === null) return 0.35;
  return clamp(Number.isFinite(Number(value)) ? Number(value) : 0.35, 0, 1);
}

function masteryLabelFromScore(score) {
  if (score < 0.35) return "emerging";
  if (score < 0.62) return "developing";
  if (score < 0.82) return "secure";
  return "highly secure";
}

function learningForFamily(family, learningState) {
  const direct = learningState[`${family.strand}:${family.subskill}`];
  if (direct) return direct;
  const entries = Object.entries(learningState).filter(([key]) => {
    if (family.focus === "tables") return key.startsWith("tables:") || key.startsWith("fact-family:");
    if (family.strand === "fractions") return key.startsWith("fraction:") || key.startsWith("fractions:");
    if (family.strand === "decimals") return key.startsWith("decimal:") || key.startsWith("decimals:");
    return key.startsWith(`${family.strand}:`);
  });
  if (!entries.length) return null;
  const summary = entries.reduce((result, [, value]) => ({
    score: result.score + Number(value.score ?? 0),
    attempts: result.attempts + Number(value.attempts ?? 0),
    lastSeen: Math.max(result.lastSeen, Number(value.lastSeen ?? -1)),
    lastSeenAt: Math.max(result.lastSeenAt, Number(value.lastSeenAt ?? 0)),
  }), { score: 0, attempts: 0, lastSeen: -1, lastSeenAt: 0 });
  return { ...summary, score: summary.score / entries.length };
}

function questionSignature(item) {
  return `${item.family}:${item.display}:${item.answer}`;
}

function nearTransfer(item) {
  const next = cloneQuestion(item);
  const values = { ...(next.values ?? {}) };
  const operation = next.metadata?.operation ?? next.strand;
  const numericA = Number(values.a);
  const numericB = Number(values.b);
  const compactDisplay = String(next.display).replaceAll(",", "").trim();
  let changed = false;

  // Arithmetic questions carry value-specific hints, diagrams and worked
  // steps. Mutating only their display and answer leaves those supports tied
  // to the previous question. Let generateNearTransfer create a fresh item
  // from the same family/structure instead, so every layer describes the same
  // mathematics.
  const arithmeticEquation = /^(?:□|-?\d+(?:\.\d+)?)\s*[+−×÷]\s*(?:□|-?\d+(?:\.\d+)?)(?:\s*=\s*-?\d+(?:\.\d+)?)?$/.test(compactDisplay);
  if (arithmeticEquation) return null;

  let match = compactDisplay.match(/^(\d+)\s*\+\s*□\s*=\s*(\d+)$/);
  if (match) {
    const addend = Number(match[1]);
    const total = Number(match[2]);
    const relatedAddend = Math.min(total - 1, addend + 1);
    next.display = `${formatNumber(relatedAddend)} + □ = ${formatNumber(total)}`;
    next.answer = String(total - relatedAddend);
    values.a = relatedAddend;
    values.b = total - relatedAddend;
    changed = true;
  }
  match = changed ? null : compactDisplay.match(/^□\s*\+\s*(\d+)\s*=\s*(\d+)$/);
  if (match) {
    const addend = Number(match[1]);
    const total = Number(match[2]);
    const relatedAddend = Math.min(total - 1, addend + 1);
    next.display = `□ + ${formatNumber(relatedAddend)} = ${formatNumber(total)}`;
    next.answer = String(total - relatedAddend);
    values.a = relatedAddend;
    values.b = total - relatedAddend;
    changed = true;
  }
  match = changed ? null : compactDisplay.match(/^(\d+)\s*×\s*□\s*=\s*(\d+)$/);
  if (match) {
    const factor = Number(match[1]);
    const missing = Math.max(2, Number(next.answer) + 1);
    next.display = `${formatNumber(factor)} × □ = ${formatNumber(factor * missing)}`;
    next.answer = String(missing);
    values.a = factor;
    values.b = missing;
    changed = true;
  }
  match = changed ? null : compactDisplay.match(/^□\s*×\s*(\d+)\s*=\s*(\d+)$/);
  if (match) {
    const factor = Number(match[1]);
    const missing = Math.max(2, Number(next.answer) + 1);
    next.display = `□ × ${formatNumber(factor)} = ${formatNumber(factor * missing)}`;
    next.answer = String(missing);
    values.a = missing;
    values.b = factor;
    changed = true;
  }
  match = changed ? null : compactDisplay.match(/^□\s*÷\s*(\d+)\s*=\s*(\d+)$/);
  if (match) {
    const divisor = Number(match[1]);
    const quotient = Number(match[2]) + 1;
    next.display = `□ ÷ ${formatNumber(divisor)} = ${formatNumber(quotient)}`;
    next.answer = String(divisor * quotient);
    values.a = divisor * quotient;
    values.b = divisor;
    changed = true;
  }
  match = changed ? null : compactDisplay.match(/^(\d+)\s*÷\s*□\s*=\s*(\d+)$/);
  if (match) {
    const quotient = Number(match[2]);
    const divisor = Math.max(2, Number(next.answer) + 1);
    next.display = `${formatNumber(quotient * divisor)} ÷ □ = ${formatNumber(quotient)}`;
    next.answer = String(divisor);
    values.a = quotient * divisor;
    values.b = divisor;
    changed = true;
  }
  match = changed ? null : compactDisplay.match(/^(\d+)\s*−\s*(\d+)$/);
  if (match && Number(next.answer) === Number(match[1]) - Number(match[2])) {
    const minuend = Number(match[1]) + 1;
    const subtrahend = Number(match[2]);
    next.display = `${formatNumber(minuend)} − ${formatNumber(subtrahend)}`;
    next.answer = String(minuend - subtrahend);
    values.a = minuend;
    values.b = subtrahend;
    changed = true;
  }
  if (!changed && compactDisplay.includes("□") && Number.isFinite(values.numerator) && Number.isFinite(values.denominator)) {
    const unitMatch = compactDisplay.match(/=\s*(\d+)$/);
    if (unitMatch) {
      const nextUnit = Number(unitMatch[1]) + 1;
      next.display = `${fractionToken(values.numerator, values.denominator)} of □ = ${formatNumber(nextUnit * Number(values.numerator))}`;
      next.answer = String(nextUnit * Number(values.denominator));
      values.a = Number(next.answer);
      changed = true;
    }
  }

  if (!changed && operation === "addition" && Number.isFinite(numericA) && Number.isFinite(numericB) && Number(next.answer) === numericA + numericB && !next.display.includes("□")) {
    values.a = numericA + (numericA >= 100 ? 100 : numericA >= 20 ? 10 : 1);
    next.display = `${formatNumber(values.a)} + ${formatNumber(numericB)}`;
    next.answer = String(values.a + numericB);
    changed = true;
  } else if (!changed && operation === "subtraction" && Number.isFinite(numericA) && Number.isFinite(numericB) && Number(next.answer) === numericA - numericB && !next.display.includes("□")) {
    const shift = numericA >= 100 ? 100 : numericA >= 20 ? 10 : 1;
    values.a = numericA + shift;
    next.display = `${formatNumber(values.a)} − ${formatNumber(numericB)}`;
    next.answer = String(values.a - numericB);
    changed = true;
  } else if (!changed && operation === "multiplication" && Number.isFinite(numericA) && Number.isFinite(numericB) && Number(next.answer) === numericA * numericB && !next.display.includes("□")) {
    const factor = numericA <= 12 ? numericA : numericB;
    const other = numericA <= 12 ? numericB : numericA;
    const nextFactor = Math.max(2, factor + 1);
    values.a = nextFactor;
    values.b = other;
    next.display = `${formatNumber(nextFactor)} × ${formatNumber(other)}`;
    next.answer = String(nextFactor * other);
    changed = true;
  } else if (!changed && operation === "division" && Number.isFinite(numericA) && Number.isFinite(numericB) && numericB > 0 && Number(next.answer) === numericA / numericB && !next.display.includes("□")) {
    const quotient = Number.isInteger(numericA / numericB) ? numericA / numericB : Number(next.answer);
    if (Number.isFinite(quotient)) {
      values.a = numericB * (quotient + 1);
      values.b = numericB;
      next.display = `${formatNumber(values.a)} ÷ ${formatNumber(numericB)}`;
      next.answer = String(quotient + 1);
      changed = true;
    }
  } else if (!changed && compactDisplay.includes("of") && Number.isFinite(numericA) && Number.isFinite(values.numerator) && Number.isFinite(values.denominator)) {
    const quantity = numericA + Number(values.denominator) * 2;
    const result = quantity * Number(values.numerator) / Number(values.denominator);
    if (Number.isInteger(result)) {
      values.a = quantity;
      next.display = `${fractionToken(values.numerator, values.denominator)} of ${formatNumber(quantity)}`;
      next.answer = String(result);
      changed = true;
    }
  }

  if (!changed) return null;
  next.id = "";
  next.instruction = "Your turn";
  next.values = values;
  next.connections = [];
  next.metadata = {
    ...next.metadata,
    structure: `near-transfer:${next.metadata?.structure ?? next.family}`,
    designedConnection: true,
    connectionKind: "near-transfer",
  };
  return next;
}

function relatedFact(item) {
  const next = cloneQuestion(item);
  const values = next.values ?? {};
  const a = Number(values.a);
  const b = Number(values.b);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;

  if (item.strand === "multiplication") {
    const product = Number(item.answer);
    if (!Number.isFinite(product) || a === 0 || product !== a * b) return null;
    next.strand = "division";
    next.display = `${formatNumber(product)} ÷ ${formatNumber(a)}`;
    next.answer = String(b);
    next.values = { a: product, b: a };
    next.scaffold.hint = `Turn ${formatNumber(a)} × ${formatNumber(b)} = ${formatNumber(product)} around.`;
    next.scaffold.visual = {
      kind: "relationship",
      title: "Turn the fact around",
      left: `${formatNumber(a)} × ${formatNumber(b)} = ${formatNumber(product)}`,
      right: `${formatNumber(product)} ÷ ${formatNumber(a)} = ${formatNumber(b)}`,
      connector: "becomes",
    };
    next.scaffold.steps = [next.scaffold.hint, `${formatNumber(product)} ÷ ${formatNumber(a)} = ${formatNumber(b)}.`];
  } else if (item.strand === "division" && Number.isFinite(Number(item.answer)) && Number(item.answer) === a / b) {
    const quotient = Number(item.answer);
    next.strand = "multiplication";
    next.display = `${formatNumber(b)} × ${formatNumber(quotient)}`;
    next.answer = String(a);
    next.values = { a: b, b: quotient };
    next.scaffold.hint = "Use the inverse multiplication fact.";
    next.scaffold.visual = {
      kind: "relationship",
      title: "Turn the fact around",
      left: `${formatNumber(a)} ÷ ${formatNumber(b)} = ${formatNumber(quotient)}`,
      right: `${formatNumber(b)} × ${formatNumber(quotient)} = ${formatNumber(a)}`,
      connector: "becomes",
    };
    next.scaffold.steps = [next.scaffold.hint, `${formatNumber(b)} × ${formatNumber(quotient)} = ${formatNumber(a)}.`];
  } else if (item.strand === "addition" && Number.isFinite(Number(item.answer)) && Number(item.answer) === a + b) {
    const total = Number(item.answer);
    next.strand = "subtraction";
    next.display = `${formatNumber(total)} − ${formatNumber(a)}`;
    next.answer = String(b);
    next.values = { a: total, b: a };
    next.scaffold.hint = "Turn the addition around with subtraction.";
    next.scaffold.visual = {
      kind: "relationship",
      title: "Turn the fact around",
      left: `${formatNumber(a)} + ${formatNumber(b)} = ${formatNumber(total)}`,
      right: `${formatNumber(total)} − ${formatNumber(a)} = ${formatNumber(b)}`,
      connector: "becomes",
    };
    next.scaffold.steps = [next.scaffold.hint, `${formatNumber(total)} − ${formatNumber(a)} = ${formatNumber(b)}.`];
  } else {
    return null;
  }

  next.id = "";
  next.family = `${item.family}-related`;
  next.instruction = "Connected fact";
  next.connections = [];
  next.metadata = {
    ...next.metadata,
    structure: `related:${item.metadata?.structure ?? item.family}`,
    operation: next.strand,
    designedConnection: true,
    connectionKind: "retrieval",
  };
  return next;
}

function preparedRepeat(item, kind) {
  const next = cloneQuestion(item);
  next.id = "";
  next.connections = [];
  next.instruction = kind === "spaced-original" ? "Remember this one?" : next.instruction;
  next.metadata = {
    ...next.metadata,
    designedConnection: true,
    connectionKind: kind,
  };
  return next;
}

function tailoredModel(item) {
  const values = item.values ?? {};
  const numericAnswer = Number(item.answer);
  const compactDisplay = String(item.display).replaceAll(",", "").trim();
  const number = "(-?\\d+(?:\\.\\d+)?)";
  const sameNumber = (left, right) => Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 0.000001;
  const model = (title, lines) => ({ title, display: item.display, lines, answer: String(item.answer) });
  const show = formatNumber;
  let match;

  match = compactDisplay.match(new RegExp(`^${number}\\s*([+−×÷])\\s*${number}$`));
  if (match && Number.isFinite(numericAnswer)) {
    const left = Number(match[1]);
    const operation = match[2];
    const right = Number(match[3]);
    const result = operation === "+" ? left + right : operation === "−" ? left - right : operation === "×" ? left * right : right === 0 ? NaN : left / right;
    if (sameNumber(result, numericAnswer)) {
      if (operation === "+") {
        const broadPart = Number.isInteger(right) && right >= 10 ? Math.floor(right / 10) * 10 : right;
        const remainder = right - broadPart;
        const lines = remainder
          ? [`${show(left)} + ${show(broadPart)} = ${show(left + broadPart)}`, `${show(left + broadPart)} + ${show(remainder)} = ${show(result)}`, `So ${show(left)} + ${show(right)} = ${show(result)}`]
          : [`${show(left)} + ${show(right)} = ${show(result)}`];
        return model("Work through this addition", lines);
      }
      if (operation === "−") {
        const broadPart = Number.isInteger(right) && right >= 10 ? Math.floor(right / 10) * 10 : right;
        const remainder = right - broadPart;
        const lines = remainder
          ? [`${show(left)} − ${show(broadPart)} = ${show(left - broadPart)}`, `${show(left - broadPart)} − ${show(remainder)} = ${show(result)}`, `So ${show(left)} − ${show(right)} = ${show(result)}`]
          : [`${show(left)} − ${show(right)} = ${show(result)}`];
        return model("Work through this subtraction", lines);
      }
      if (operation === "×") {
        let broadPart = 0;
        let remainder = 0;
        let other = 0;
        let splitFirst = true;
        if (Number.isInteger(left) && left >= 10) {
          broadPart = Math.floor(left / 10) * 10;
          remainder = left - broadPart;
          other = right;
        } else if (Number.isInteger(right) && right >= 10) {
          broadPart = Math.floor(right / 10) * 10;
          remainder = right - broadPart;
          other = left;
          splitFirst = false;
        }
        const lines = broadPart && remainder
          ? splitFirst
            ? [`${show(broadPart)} × ${show(other)} = ${show(broadPart * other)}`, `${show(remainder)} × ${show(other)} = ${show(remainder * other)}`, `${show(broadPart * other)} + ${show(remainder * other)} = ${show(result)}`, `So ${show(left)} × ${show(right)} = ${show(result)}`]
            : [`${show(other)} × ${show(broadPart)} = ${show(other * broadPart)}`, `${show(other)} × ${show(remainder)} = ${show(other * remainder)}`, `${show(other * broadPart)} + ${show(other * remainder)} = ${show(result)}`, `So ${show(left)} × ${show(right)} = ${show(result)}`]
          : [`${show(left)} × ${show(right)} = ${show(result)}`];
        return model("Work through this multiplication", lines);
      }
      return model("Work through this division", [`${show(right)} × ${show(result)} = ${show(left)}`, `So ${show(left)} ÷ ${show(right)} = ${show(result)}`]);
    }
  }

  const missingPatterns = [
    { regex: new RegExp(`^${number}\\s*\\+\\s*□\\s*=\\s*${number}$`), solve: (known, total) => total - known, inverse: (known, total, answer) => [`${show(total)} − ${show(known)} = ${show(answer)}`, `${show(known)} + ${show(answer)} = ${show(total)}`] },
    { regex: new RegExp(`^□\\s*\\+\\s*${number}\\s*=\\s*${number}$`), solve: (known, total) => total - known, inverse: (known, total, answer) => [`${show(total)} − ${show(known)} = ${show(answer)}`, `${show(answer)} + ${show(known)} = ${show(total)}`] },
    { regex: new RegExp(`^${number}\\s*−\\s*□\\s*=\\s*${number}$`), solve: (whole, result) => whole - result, inverse: (whole, result, answer) => [`${show(whole)} − ${show(result)} = ${show(answer)}`, `${show(whole)} − ${show(answer)} = ${show(result)}`] },
    { regex: new RegExp(`^□\\s*−\\s*${number}\\s*=\\s*${number}$`), solve: (known, result) => known + result, inverse: (known, result, answer) => [`${show(result)} + ${show(known)} = ${show(answer)}`, `${show(answer)} − ${show(known)} = ${show(result)}`] },
    { regex: new RegExp(`^${number}\\s*×\\s*□\\s*=\\s*${number}$`), solve: (factor, product) => product / factor, inverse: (factor, product, answer) => [`${show(product)} ÷ ${show(factor)} = ${show(answer)}`, `${show(factor)} × ${show(answer)} = ${show(product)}`] },
    { regex: new RegExp(`^□\\s*×\\s*${number}\\s*=\\s*${number}$`), solve: (factor, product) => product / factor, inverse: (factor, product, answer) => [`${show(product)} ÷ ${show(factor)} = ${show(answer)}`, `${show(answer)} × ${show(factor)} = ${show(product)}`] },
    { regex: new RegExp(`^□\\s*÷\\s*${number}\\s*=\\s*${number}$`), solve: (divisor, quotient) => divisor * quotient, inverse: (divisor, quotient, answer) => [`${show(divisor)} × ${show(quotient)} = ${show(answer)}`, `${show(answer)} ÷ ${show(divisor)} = ${show(quotient)}`] },
    { regex: new RegExp(`^${number}\\s*÷\\s*□\\s*=\\s*${number}$`), solve: (dividend, quotient) => dividend / quotient, inverse: (dividend, quotient, answer) => [`${show(quotient)} × ${show(answer)} = ${show(dividend)}`, `${show(dividend)} ÷ ${show(answer)} = ${show(quotient)}`] },
  ];
  for (const pattern of missingPatterns) {
    match = compactDisplay.match(pattern.regex);
    if (!match) continue;
    const first = Number(match[1]);
    const second = Number(match[2]);
    const expected = pattern.solve(first, second);
    if (!sameNumber(expected, numericAnswer)) break;
    return model("Find the missing number", [...pattern.inverse(first, second, expected), `So □ = ${show(expected)}`]);
  }

  if (compactDisplay.includes("of") && Number.isFinite(Number(values.a)) && Number.isFinite(Number(values.numerator)) && Number.isFinite(Number(values.denominator)) && Number(values.denominator) !== 0) {
    const whole = Number(values.a);
    const numerator = Number(values.numerator);
    const denominator = Number(values.denominator);
    const unit = whole / denominator;
    const result = unit * numerator;
    if (sameNumber(result, numericAnswer)) {
      return model("Work through this fraction", [`${show(whole)} ÷ ${show(denominator)} = ${show(unit)}`, `${show(unit)} × ${show(numerator)} = ${show(result)}`]);
    }
  }

  return item.scaffold.model;
}

function contextualSteps(item) {
  const visual = item.scaffold.visual ?? {};
  const hint = item.scaffold.hint;
  if (visual.kind === "relationship") {
    return [hint, `Connect ${visual.left ?? "the known fact"} with ${visual.right ?? "the new fact"}.`];
  }
  if (visual.kind === "number-line" || visual.kind === "bead-string") {
    return [hint, "Work out the value of one interval, then follow the marked points."];
  }
  if (visual.kind === "place-value" || visual.kind === "base-ten") {
    return [hint, "Keep each digit in its place-value column."];
  }
  if (["array", "groups", "counters", "multiplication-rectangle"].includes(visual.kind)) {
    return [hint, "Use the equal groups to connect multiplication and division."];
  }
  if (["fraction-strip", "bar-model", "hundred-grid"].includes(visual.kind)) {
    return [hint, "Count equal parts first, then the parts being used."];
  }
  if (visual.kind === "worked-example") {
    return [hint, "Check one line at a time before deciding."];
  }
  return [hint, "Use that relationship to finish the question."];
}

function contextualModel(item) {
  const visual = item.scaffold.visual ?? {};
  const original = item.scaffold.model ?? {};
  const estimationContext = /estimat/i.test(`${item.family ?? ""} ${item.subskill ?? ""} ${item.metadata?.structure ?? ""}`);
  const directArithmeticDisplay = /^-?[\d,]+(?:\.\d+)?\s*[+−×÷]\s*-?[\d,]+(?:\.\d+)?$/.test(String(item.display).trim());
  if (estimationContext && directArithmeticDisplay) {
    const estimationLines = Array.isArray(item.scaffold.steps) && item.scaffold.steps.length
      ? item.scaffold.steps
      : [item.scaffold.hint];
    return {
      title: "Estimate before calculating",
      display: `Estimate ${item.display}`,
      lines: estimationLines,
      answer: item.answer,
    };
  }
  if (String(original.display) === String(item.display) && String(original.answer) === String(item.answer) && Array.isArray(original.lines) && original.lines.length) {
    return { ...original, display: item.display, answer: item.answer };
  }
  if (visual.kind === "relationship") {
    return {
      title: "Watch the connection",
      display: item.display,
      lines: [`${visual.left ?? "A known fact"} ${visual.connector ?? "helps"} ${visual.right ?? "this fact"}.`, item.scaffold.hint],
      answer: item.answer,
    };
  }
  if (visual.kind === "worked-example") {
    const lines = visual.lines ?? [item.display];
    return { title: "Watch one line at a time", display: item.display, lines, answer: item.answer };
  }
  if (visual.kind === "number-line" || visual.kind === "bead-string") {
    return {
      title: "Watch the intervals",
      display: item.display,
      lines: [item.scaffold.hint],
      answer: item.answer,
    };
  }
  return { title: "Watch the structure", display: item.display, lines: [item.scaffold.hint], answer: item.answer };
}

export class FluencyEngine {
  constructor(options = {}) {
    const restored = options.state && typeof options.state === "object" ? options.state : null;
    const restoredOptions = restored?.options && typeof restored.options === "object" ? restored.options : {};
    const seed = restored?.seed ?? options.seed ?? `session-${Date.now()}`;
    const challenge = restored?.challenge ?? options.challenge ?? 52;
    const challengeRange = restored?.challengeRange ?? options.challengeRange ?? null;
    const focus = restored?.focus ?? options.focus ?? null;
    const mode = restored?.mode ?? options.mode ?? "mix";
    const recentSignatures = restored?.recentSignatures ?? options.recentSignatures ?? [];
    const learningState = restored?.learningState ?? options.learningState ?? {};
    const option = (key, fallback) => restored && Object.prototype.hasOwnProperty.call(restoredOptions, key)
      ? restoredOptions[key]
      : Object.prototype.hasOwnProperty.call(options, key) ? options[key] : fallback;

    this.seed = String(seed);
    this.rng = mulberry32(hashSeed(this.seed));
    this.challenge = clamp(Number(challenge), 0, 100);
    const requestedMin = Number(challengeRange?.min);
    const requestedMax = Number(challengeRange?.max);
    this.challengeRange = Number.isFinite(requestedMin) && Number.isFinite(requestedMax)
      ? { min: clamp(Math.min(requestedMin, requestedMax), 0, 100), max: clamp(Math.max(requestedMin, requestedMax), 0, 100) }
      : null;
    if (this.challengeRange) this.challenge = clamp(this.challenge, this.challengeRange.min, this.challengeRange.max);
    const selection = normalisePracticeSelection({ mode, focus, challenge: this.challenge });
    this.focus = selection.focus;
    this.mode = selection.mode;
    this.subskills = normaliseList(option("subskills", option("subskill", [])));
    this.retrievalWeight = normaliseRetrievalWeight(option("retrievalWeight", 0.28));
    this.includeStrategyQuestions = option("includeStrategyQuestions", true) !== false;
    this.connectedSequences = option("connectedSequences", true) !== false;
    this.nearTransfer = option("nearTransfer", true) !== false;
    this.adaptiveDifficulty = option("adaptiveDifficulty", true) !== false;
    this.representationFrequency = normaliseRepresentationFrequency(option("representationFrequency", 0.35));
    this.permittedFamilies = new Set(normaliseList(option("permittedFamilies", [])).map(canonicalFamilyId));
    this.excludedFamilies = new Set(normaliseList(option("excludedFamilies", [])).map(canonicalFamilyId));
    this.fixedSequence = option("fixedSequence", false) === true;
    this.recentSignatures = Array.isArray(recentSignatures) ? recentSignatures.map(String).slice(-24) : [];
    this.recentFamilies = [];
    this.recentStrands = [];
    this.recentOutcomes = [];
    this.performanceBias = 0;
    this.learningState = learningState && typeof learningState === "object" ? cloneQuestion(learningState) : {};
    this.selectionLearningState = cloneQuestion(this.learningState);
    this.scheduled = [];
    this.scheduledSources = new Set();
    this.index = 0;
    if (restored) this.restoreState(restored);
  }

  setChallenge(value, preserveRange = false) {
    const next = clamp(Number(value), 0, 100);
    if (preserveRange && this.challengeRange) {
      this.challenge = clamp(next, this.challengeRange.min, this.challengeRange.max);
      return this.normaliseSelection();
    }
    this.challenge = next;
    this.challengeRange = null;
    return this.normaliseSelection();
  }

  setChallengeRange(range) {
    const requestedMin = Number(range?.min);
    const requestedMax = Number(range?.max);
    if (!Number.isFinite(requestedMin) || !Number.isFinite(requestedMax)) return;
    this.challengeRange = {
      min: clamp(Math.min(requestedMin, requestedMax), 0, 100),
      max: clamp(Math.max(requestedMin, requestedMax), 0, 100),
    };
    this.challenge = clamp((this.challengeRange.min + this.challengeRange.max) / 2, this.challengeRange.min, this.challengeRange.max);
    return this.normaliseSelection();
  }

  setFocus(focus) {
    this.focus = focus;
    return this.normaliseSelection();
  }

  setMode(mode) {
    if (["mix", "focus", "quick", "think", "my-mix"].includes(mode)) this.mode = mode;
    return this.normaliseSelection();
  }

  normaliseSelection() {
    const selection = normalisePracticeSelection({ mode: this.mode, focus: this.focus, challenge: this.challenge });
    this.mode = selection.mode;
    this.focus = selection.focus;
    return selection;
  }

  getHistory() {
    return [...this.recentSignatures];
  }

  getLearningState() {
    return cloneQuestion(this.learningState);
  }

  getAdaptation() {
    return {
      performanceBias: this.performanceBias,
      mode: this.mode,
      focus: this.focus,
      scheduled: this.scheduled.length,
      challengeRange: this.challengeRange ? { ...this.challengeRange } : null,
      adaptiveDifficulty: this.adaptiveDifficulty,
      fixedSequence: this.fixedSequence,
      retrievalWeight: this.retrievalWeight,
    };
  }

  getState() {
    return cloneQuestion({
      version: 1,
      seed: this.seed,
      rngState: this.rng.getState(),
      index: this.index,
      challenge: this.challenge,
      challengeRange: this.challengeRange ? { ...this.challengeRange } : null,
      focus: this.focus,
      mode: this.mode,
      options: {
        subskills: [...this.subskills],
        retrievalWeight: this.retrievalWeight,
        includeStrategyQuestions: this.includeStrategyQuestions,
        connectedSequences: this.connectedSequences,
        nearTransfer: this.nearTransfer,
        adaptiveDifficulty: this.adaptiveDifficulty,
        representationFrequency: this.representationFrequency,
        permittedFamilies: [...this.permittedFamilies],
        excludedFamilies: [...this.excludedFamilies],
        fixedSequence: this.fixedSequence,
      },
      recentSignatures: this.recentSignatures,
      recentFamilies: this.recentFamilies,
      recentStrands: this.recentStrands,
      recentOutcomes: this.recentOutcomes,
      performanceBias: this.performanceBias,
      learningState: this.learningState,
      selectionLearningState: this.selectionLearningState,
      scheduled: this.scheduled,
      scheduledSources: [...this.scheduledSources],
    });
  }

  restoreState(state) {
    if (!state || typeof state !== "object") return false;
    this.seed = String(state.seed ?? this.seed);
    this.rng = mulberry32(hashSeed(this.seed));
    if (Number.isFinite(Number(state.rngState))) this.rng.setState(state.rngState);
    this.index = Math.max(0, Math.round(Number(state.index) || 0));
    this.challenge = clamp(Number.isFinite(Number(state.challenge)) ? Number(state.challenge) : this.challenge, 0, 100);
    const rangeMin = Number(state.challengeRange?.min);
    const rangeMax = Number(state.challengeRange?.max);
    this.challengeRange = Number.isFinite(rangeMin) && Number.isFinite(rangeMax)
      ? { min: clamp(Math.min(rangeMin, rangeMax), 0, 100), max: clamp(Math.max(rangeMin, rangeMax), 0, 100) }
      : null;
    if (this.challengeRange) this.challenge = clamp(this.challenge, this.challengeRange.min, this.challengeRange.max);
    this.focus = state.focus ?? this.focus;
    this.mode = ["mix", "focus", "quick", "think", "my-mix"].includes(state.mode) ? state.mode : this.mode;
    const sessionOptions = state.options && typeof state.options === "object" ? state.options : {};
    if (Object.prototype.hasOwnProperty.call(sessionOptions, "subskills")) this.subskills = normaliseList(sessionOptions.subskills);
    if (Object.prototype.hasOwnProperty.call(sessionOptions, "retrievalWeight")) this.retrievalWeight = normaliseRetrievalWeight(sessionOptions.retrievalWeight);
    if (Object.prototype.hasOwnProperty.call(sessionOptions, "includeStrategyQuestions")) this.includeStrategyQuestions = sessionOptions.includeStrategyQuestions !== false;
    if (Object.prototype.hasOwnProperty.call(sessionOptions, "connectedSequences")) this.connectedSequences = sessionOptions.connectedSequences !== false;
    if (Object.prototype.hasOwnProperty.call(sessionOptions, "nearTransfer")) this.nearTransfer = sessionOptions.nearTransfer !== false;
    if (Object.prototype.hasOwnProperty.call(sessionOptions, "adaptiveDifficulty")) this.adaptiveDifficulty = sessionOptions.adaptiveDifficulty !== false;
    if (Object.prototype.hasOwnProperty.call(sessionOptions, "representationFrequency")) this.representationFrequency = normaliseRepresentationFrequency(sessionOptions.representationFrequency);
    if (Object.prototype.hasOwnProperty.call(sessionOptions, "permittedFamilies")) this.permittedFamilies = new Set(normaliseList(sessionOptions.permittedFamilies).map(canonicalFamilyId));
    if (Object.prototype.hasOwnProperty.call(sessionOptions, "excludedFamilies")) this.excludedFamilies = new Set(normaliseList(sessionOptions.excludedFamilies).map(canonicalFamilyId));
    if (Object.prototype.hasOwnProperty.call(sessionOptions, "fixedSequence")) this.fixedSequence = sessionOptions.fixedSequence === true;
    this.recentSignatures = Array.isArray(state.recentSignatures) ? state.recentSignatures.map(String).slice(-24) : [];
    this.recentFamilies = Array.isArray(state.recentFamilies) ? state.recentFamilies.map(String).slice(-7) : [];
    this.recentStrands = Array.isArray(state.recentStrands) ? state.recentStrands.map(String).slice(-8) : [];
    this.recentOutcomes = Array.isArray(state.recentOutcomes) ? cloneQuestion(state.recentOutcomes).slice(-10) : [];
    this.performanceBias = this.adaptiveDifficulty && !this.fixedSequence ? clamp(Number(state.performanceBias) || 0, -5, 5) : 0;
    this.learningState = state.learningState && typeof state.learningState === "object" ? cloneQuestion(state.learningState) : {};
    this.selectionLearningState = state.selectionLearningState && typeof state.selectionLearningState === "object"
      ? cloneQuestion(state.selectionLearningState)
      : cloneQuestion(this.learningState);
    this.scheduled = Array.isArray(state.scheduled) ? cloneQuestion(state.scheduled).filter((entry) => entry?.item && Number.isFinite(Number(entry.due))).slice(0, 20) : [];
    this.scheduledSources = new Set(Array.isArray(state.scheduledSources) ? state.scheduledSources.map(String) : this.scheduled.map((entry) => String(entry.key)).filter(Boolean));
    this.normaliseSelection();
    return true;
  }

  familyAllowed(family) {
    const id = canonicalFamilyId(family?.id);
    if (!id) return false;
    if (this.permittedFamilies.size && !this.permittedFamilies.has(id)) return false;
    if (this.excludedFamilies.has(id)) return false;
    if (!familyMatchesSubskills(family, this.subskills)) return false;
    if (!this.includeStrategyQuestions && explicitStrategyFamily(family)) return false;
    return true;
  }

  itemAllowed(item) {
    const id = canonicalFamilyId(item?.family);
    if (this.permittedFamilies.size && !this.permittedFamilies.has(id)) return false;
    if (this.excludedFamilies.has(id)) return false;
    if (!itemMatchesSubskills(item, this.subskills)) return false;
    const sourceFamily = QUESTION_FAMILIES.find((family) => family.id === id);
    if (!this.includeStrategyQuestions && (item?.metadata?.strategy || (sourceFamily && explicitStrategyFamily(sourceFamily)))) return false;
    return true;
  }

  schedule(item, due, kind, sourceId = "") {
    if (!item || this.scheduled.length >= 20) return;
    const key = `${kind}:${sourceId || questionSignature(item)}`;
    if (this.scheduledSources.has(key)) return;
    const prepared = preparedRepeat(item, kind);
    this.scheduled.push({ item: prepared, due: Math.max(this.index, due), kind, key });
    this.scheduledSources.add(key);
  }

  recordResponse({ item, question: legacyQuestion, correct = false, firstTry = false, supportUsed = 0, modelUsed = false, responseMs = null, misconception = null } = {}) {
    const answered = item ?? legacyQuestion;
    if (!answered) return;
    const retrievalKey = answered.metadata?.retrievalKey ?? `${answered.strand}:${answered.subskill}`;
    const previous = this.learningState[retrievalKey] ?? {
      attempts: 0,
      correct: 0,
      errors: 0,
      supported: 0,
      models: 0,
      score: 0.42,
      averageResponseMs: null,
      lastSeen: -1,
      lastSeenAt: null,
    };
    const supportAmount = typeof supportUsed === "number" ? supportUsed : supportUsed ? 1 : 0;
    const independent = correct && firstTry && supportAmount <= 0 && !modelUsed;
    const delta = independent ? 0.09 : correct ? (modelUsed ? 0.025 : 0.045) : -0.065;
    const score = clamp(previous.score + delta * (1 - previous.attempts / (previous.attempts + 18)), 0.08, 0.95);
    const numericResponse = Number(responseMs);
    const responseCount = previous.averageResponseMs === null ? 0 : previous.attempts;
    const averageResponseMs = Number.isFinite(numericResponse) && numericResponse >= 0
      ? Math.round(((previous.averageResponseMs ?? 0) * responseCount + numericResponse) / (responseCount + 1))
      : previous.averageResponseMs;
    this.learningState[retrievalKey] = {
      ...previous,
      attempts: previous.attempts + 1,
      correct: previous.correct + (correct ? 1 : 0),
      errors: previous.errors + (correct ? 0 : 1),
      supported: previous.supported + (supportAmount > 0 ? 1 : 0),
      models: previous.models + (modelUsed ? 1 : 0),
      score,
      strength: masteryLabelFromScore(score),
      averageResponseMs,
      lastSeen: this.index,
      lastSeenAt: Date.now(),
      lastMisconception: misconception ?? previous.lastMisconception ?? null,
    };

    this.recentOutcomes.push({ correct: Boolean(correct), independent });
    this.recentOutcomes = this.recentOutcomes.slice(-10);
    const recent = this.recentOutcomes.slice(-8);
    const secure = recent.filter((outcome) => outcome.independent).length;
    const errors = recent.filter((outcome) => !outcome.correct).length;
    this.performanceBias = this.adaptiveDifficulty && !this.fixedSequence
      ? clamp(secure >= 6 ? 4 : secure >= 4 ? 2 : errors >= 4 ? -4 : errors >= 2 ? -2 : 0, -5, 5)
      : 0;

    const sourceId = answered.id || questionSignature(answered);
    if (!this.fixedSequence && this.nearTransfer && modelUsed) {
      const transfer = nearTransfer(answered) ?? this.generateNearTransfer(answered);
      if (transfer) this.schedule(transfer, this.index, "near-transfer", sourceId);
    }
    if (!this.fixedSequence && !correct) {
      const related = relatedFact(answered);
      if (related) this.schedule(related, this.index + 3, "related-retrieval", sourceId);
      this.schedule(answered, this.index + 8, "spaced-original", sourceId);
      if (related) this.schedule(related, this.index + 17, "long-retrieval", `${sourceId}:long`);
    }
  }

  generateNearTransfer(answered) {
    const familyId = answered.relatedFollowUp ?? answered.family.replace(/-related$/, "");
    const family = QUESTION_FAMILIES.find((candidate) => candidate.id === familyId);
    if (!family || !this.familyAllowed(family)) return null;
    let fallback = null;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const candidate = family.generate({ rng: this.rng, target: answered.difficulty, challenge: this.challenge });
      const valid = validateQuestion(candidate).valid && questionSignature(candidate) !== questionSignature(answered) && itemMatchesFocus(candidate, this.focus) && this.itemAllowed(candidate);
      if (!valid) continue;
      fallback ??= candidate;
      if (candidate.metadata?.structure !== answered.metadata?.structure) continue;
      candidate.id = "";
      candidate.instruction = candidate.instruction ? `Your turn · ${candidate.instruction}` : "Your turn";
      candidate.connections = [];
      candidate.metadata = { ...candidate.metadata, designedConnection: true, connectionKind: "near-transfer" };
      return candidate;
    }
    if (!fallback) return null;
    fallback.id = "";
    fallback.instruction = fallback.instruction ? `Your turn · ${fallback.instruction}` : "Your turn";
    fallback.connections = [];
    fallback.metadata = { ...fallback.metadata, designedConnection: true, connectionKind: "near-transfer" };
    return fallback;
  }

  takeScheduled() {
    const priorities = { "near-transfer": 0, "related-retrieval": 1, connection: 2, "spaced-original": 3, "long-retrieval": 4 };
    const due = this.scheduled
      .map((entry, position) => ({ ...entry, position }))
      .filter((entry) => entry.due <= this.index)
      .sort((left, right) => left.due - right.due || (priorities[left.kind] ?? 9) - (priorities[right.kind] ?? 9));
    for (const entry of due) {
      const validation = validateQuestion(entry.item);
      const livePosition = this.scheduled.findIndex((candidate) => candidate.key === entry.key);
      if (livePosition >= 0) this.scheduled.splice(livePosition, 1);
      this.scheduledSources.delete(entry.key);
      const repeated = this.recentSignatures.includes(questionSignature(entry.item));
      const intentionalRepeat = entry.kind === "spaced-original" || entry.kind === "long-retrieval";
      const rangeFits = !this.challengeRange || (entry.item.difficulty >= this.challengeRange.min && entry.item.difficulty <= this.challengeRange.max);
      if (validation.valid && rangeFits && (!repeated || intentionalRepeat) && itemMatchesFocus(entry.item, this.focus) && this.itemAllowed(entry.item) && Math.abs(entry.item.difficulty - this.challenge) <= 28) return entry.item;
    }
    return null;
  }

  finishItem(item, target, familyId = item.family) {
    item.id = `${hashSeed(this.seed).toString(36)}-${String(this.index).padStart(5, "0")}-${familyId}`;
    item.metadata = {
      ...item.metadata,
      targetDifficulty: target,
      sessionIndex: this.index,
      selectedChallenge: this.challenge,
      selectedChallengeRange: this.challengeRange ? { ...this.challengeRange } : null,
      performanceBias: this.performanceBias,
      mode: this.mode,
      mastery: this.learningState[item.metadata?.retrievalKey]?.strength ?? "unseen",
      representationFrequency: this.representationFrequency,
      representationSuggested: (hashSeed(`${this.seed}:${item.id}:representation`) / 4294967296) < this.representationFrequency,
    };
    if (this.mode === "quick") item.metadata.speed = "recall";
    if (item.scaffold.steps?.[0] === "Choose a useful first step.") item.scaffold.steps = contextualSteps(item);
    const tailored = tailoredModel(item);
    const resolvedModel = tailored === item.scaffold.model ? contextualModel(item) : tailored;
    item.scaffold.model = String(resolvedModel?.display) === String(item.display) && String(resolvedModel?.answer) === String(item.answer)
      ? resolvedModel
      : contextualModel(item);
    const signature = questionSignature(item);
    this.index += 1;
    this.recentSignatures.push(signature);
    this.recentFamilies.push(item.family);
    this.recentStrands.push(item.strand);
    this.recentSignatures = this.recentSignatures.slice(-24);
    this.recentFamilies = this.recentFamilies.slice(-7);
    this.recentStrands = this.recentStrands.slice(-8);

    if (!this.fixedSequence && this.connectedSequences && !item.metadata.designedConnection && item.connections?.length && this.scheduled.length < 12) {
      const offsets = [0, 3, 8];
      item.connections.slice(0, 3).forEach((connection, connectionIndex) => {
        this.schedule(connection, this.index + offsets[connectionIndex], "connection", `${item.id}:${connectionIndex}`);
      });
    }
    return item;
  }

  next() {
    const scheduled = this.takeScheduled();
    if (scheduled) return this.finishItem(scheduled, scheduled.difficulty, scheduled.family);

    const rhythm = rhythmTarget(this.rng, this.challenge, this.adaptiveDifficulty && !this.fixedSequence ? this.performanceBias : 0, this.mode);
    const target = this.challengeRange ? clamp(rhythm, this.challengeRange.min, this.challengeRange.max) : rhythm;
    const eligibleFamilies = QUESTION_FAMILIES.filter((family) => this.familyAllowed(family) && focusMatches(family, this.focus) && modeMatches(family, this.mode));
    const candidates = eligibleFamilies.filter((family) => {
      const inRange = target >= family.min - 10 && target <= family.max + 10;
      const contentFits = (this.challenge >= 20 || (family.strand !== "fractions" && !FOUNDATION_EXCLUSIONS.has(family.id))) && (this.challenge >= 38 || family.strand !== "decimals");
      return inRange && contentFits;
    });
    const source = candidates.length ? candidates : eligibleFamilies;
    const safeSource = source;
    if (!safeSource.length) throw new Error("No question families match this session configuration");
    const weighted = source.map((family) => {
      const midpoint = (family.min + family.max) / 2;
      const distance = Math.abs(midpoint - target);
      const familyRepeat = this.recentFamilies.includes(family.id) ? 0.1 : 1;
      const strandCount = this.recentStrands.filter((strand) => strand === family.strand).length;
      const strandBalance = 1 / (1 + strandCount * 0.7);
      const learning = learningForFamily(family, this.fixedSequence ? this.selectionLearningState : this.learningState);
      const questionsSince = learning ? Math.max(0, this.index - (learning.lastSeen ?? 0)) : Infinity;
      const ageDays = learning?.lastSeenAt ? (Date.now() - learning.lastSeenAt) / 86400000 : Infinity;
      const retrievalBoost = 1 + 0.55 * (this.retrievalWeight / 0.28);
      const retrievalDue = learning && (questionsSince > 20 || ageDays > 3) ? retrievalBoost : 1;
      const masteryWeight = !learning ? 1.08 : learning.score >= 0.82 ? 0.5 : learning.score < 0.45 ? 1.55 : 1;
      const personalWeight = this.mode === "my-mix" ? masteryWeight * retrievalDue : 1;
      const yearFourCore = this.challenge >= 40 && this.challenge <= 75 && family.max >= 45 && family.min <= 75 ? 1.35 : 1;
      const foundationFit = this.challenge < 20 && family.min <= 20 ? 1.3 : 1;
      return { value: family, weight: Math.max(0.0001, (1 / (3 + distance)) * familyRepeat * strandBalance * personalWeight * yearFourCore * foundationFit) };
    });

    for (let attempt = 0; attempt < 80; attempt += 1) {
      const family = weightedPick(this.rng, weighted.length ? weighted : safeSource.map((value) => ({ value, weight: 1 })));
      const item = family.generate({ rng: this.rng, target, challenge: this.challenge });
      const signature = questionSignature(item);
      const validation = validateQuestion(item);
      const permittedDrift = target < 20 ? 12 : target > 85 ? 16 : 13;
      const difficultyFits = Math.abs(item.difficulty - target) <= permittedDrift;
      const rhythmFits = Math.abs(item.difficulty - this.challenge) <= (this.mode === "focus" ? 32 : 18);
      const rangeFits = !this.challengeRange || (item.difficulty >= this.challengeRange.min && item.difficulty <= this.challengeRange.max);
      const recentWindow = attempt < 56 ? this.recentSignatures : attempt < 72 ? this.recentSignatures.slice(-4) : this.recentSignatures.slice(-1);
      if (validation.valid && rangeFits && itemMatchesFocus(item, this.focus) && this.itemAllowed(item) && difficultyFits && rhythmFits && !recentWindow.includes(signature)) {
        return this.finishItem(item, target, family.id);
      }
    }

    // Narrow modes can occasionally use up every likely variation before the
    // weighted search happens to find a fresh one. Sweep the eligible families
    // directly before giving up. This keeps an endless session endless while
    // retaining the most important repetition rule: never repeat the question
    // that was shown immediately before this one.
    const lastSignature = this.recentSignatures.at(-1);
    for (const family of safeSource) {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const item = family.generate({ rng: this.rng, target, challenge: this.challenge });
        const signature = questionSignature(item);
        const validation = validateQuestion(item);
        const rangeFits = !this.challengeRange || (item.difficulty >= this.challengeRange.min && item.difficulty <= this.challengeRange.max);
        const broadRhythmFits = Math.abs(item.difficulty - this.challenge) <= (this.mode === "focus" ? 32 : 24);
        if (validation.valid && rangeFits && itemMatchesFocus(item, this.focus) && this.itemAllowed(item) && broadRhythmFits && signature !== lastSignature) {
          return this.finishItem(item, target, family.id);
        }
      }
    }

    // A live control change or an older shared configuration can combine a
    // valid challenge, focus and mode that have no generator intersection.
    // Preserve challenge, then relax only the conflicting selector instead of
    // allowing an uncaught generation error to end the pupil session.
    const fallbackSelections = [
      this.focus ? { mode: "focus", focus: this.focus } : null,
      { mode: this.mode, focus: null },
      { mode: "mix", focus: null },
    ].filter(Boolean);
    const seenSelections = new Set();
    for (const selection of fallbackSelections) {
      const selectionKey = `${selection.mode}:${selection.focus ?? "mixed"}`;
      if (seenSelections.has(selectionKey)) continue;
      seenSelections.add(selectionKey);
      const fallbackFamilies = QUESTION_FAMILIES.filter((family) => (
        this.familyAllowed(family)
        && focusMatches(family, selection.focus)
        && modeMatches(family, selection.mode)
        && familyCoversSelection(family, this.challenge)
      ));
      for (const family of fallbackFamilies) {
        for (let attempt = 0; attempt < 16; attempt += 1) {
          const item = family.generate({ rng: this.rng, target, challenge: this.challenge });
          const validation = validateQuestion(item);
          const signature = questionSignature(item);
          const rangeFits = !this.challengeRange || (item.difficulty >= this.challengeRange.min && item.difficulty <= this.challengeRange.max);
          if (!validation.valid || !rangeFits || !itemMatchesFocus(item, selection.focus) || !this.itemAllowed(item) || signature === lastSignature) continue;
          this.mode = selection.mode;
          this.focus = selection.focus;
          return this.finishItem(item, target, family.id);
        }
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
  return QUESTION_FAMILIES.map(({ id, strand, subskill, min, max, focus, modes, thinking, speed, structures }) => ({
    id,
    strand,
    subskill,
    min,
    max,
    focus: focus ?? null,
    modes: modes ?? ["mix", "focus"],
    thinking: thinking ?? 1,
    speed: speed ?? "strategy",
    structures: structures ?? [id],
  }));
}

export function masteryLabel(score) {
  return masteryLabelFromScore(clamp(Number(score), 0, 1));
}
