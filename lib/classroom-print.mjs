import { FluencyEngine, validateQuestion } from "./fluency-engine.mjs";

const PRINT_COUNTS = new Set([5, 10, 15, 20, 30]);
const SUPPORT_STAGES = {
  independent: 0,
  available: 1,
  adaptive: 1,
  guided: 2,
  modelled: 4,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

function plainMath(value) {
  return String(value ?? "")
    .replaceAll("[[", "")
    .replaceAll("]]", "")
    .replaceAll("□", "blank")
    .replaceAll("×", " multiplied by ")
    .replaceAll("÷", " divided by ")
    .replaceAll("−", " minus ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalisePrintMathText(value) {
  return String(value ?? "")
    .split(/(\[\[(?:-?\d+|□)\/(?:-?\d+|□)\]\])/g)
    .map((segment, index) => index % 2 === 1
      ? segment
      : segment.replace(/(-?\d+|□)\/(-?\d+|□)/g, "[[$1/$2]]"))
    .join("");
}

export function normalisePrintConfig(input = {}) {
  const requestedMin = Number(input.challengeMin ?? input.challenge ?? 55);
  const requestedMax = Number(input.challengeMax ?? input.challenge ?? requestedMin);
  const challengeMin = clamp(Math.min(requestedMin, requestedMax), 0, 100);
  const challengeMax = clamp(Math.max(requestedMin, requestedMax), 0, 100);
  const requestedCount = Number(input.count ?? 10);
  const count = PRINT_COUNTS.has(requestedCount) ? requestedCount : 10;
  const support = Object.hasOwn(SUPPORT_STAGES, input.support) ? input.support : "independent";
  return {
    title: String(input.title || "Year 4 Fluency").slice(0, 80),
    focus: input.focus && input.focus !== "mixed" ? String(input.focus).toLowerCase() : null,
    mode: ["mix", "focus", "quick", "think", "my-mix"].includes(input.mode) ? input.mode : (input.focus && input.focus !== "mixed" ? "focus" : "mix"),
    challengeMin,
    challengeMax,
    support,
    count,
    seed: String(input.seed || `print-${Date.now()}`),
    format: ["a4", "strip"].includes(input.format) ? input.format : "a4",
    orientation: input.orientation === "landscape" ? "landscape" : "portrait",
    includeAnswers: input.includeAnswers !== false,
    includeNameLine: input.includeNameLine !== false,
    blackAndWhite: input.blackAndWhite !== false,
    subskills: Array.isArray(input.subskills) ? input.subskills.map(String).filter(Boolean).slice(0, 12) : input.subskill ? [String(input.subskill)] : [],
    retrievalWeight: clamp(input.retrievalWeight ?? 0.28, 0, 1),
    includeStrategyQuestions: input.includeStrategyQuestions !== false,
    connectedSequences: input.connectedSequences !== false,
    nearTransfer: input.nearTransfer !== false,
    adaptiveDifficulty: input.adaptiveDifficulty !== false,
    representationFrequency: clamp(input.representationFrequency ?? 0.35, 0, 1),
    fixedSequence: input.fixedSequence === true || input.seedMode === "same",
  };
}

function canonicalMathValue(value) {
  return String(value ?? "")
    .replaceAll("[[", "")
    .replaceAll("]]", "")
    .replaceAll(",", "")
    .replace(/\s+/g, "")
    .trim();
}

function concealGuidedAnswer(step, answer) {
  const text = String(step ?? "").trim();
  if (!text) return null;
  const terminal = text.match(/[.!?]$/)?.[0] ?? "";
  const body = terminal ? text.slice(0, -1).trimEnd() : text;
  const explicitAnswer = body.match(/\b(?:the\s+)?answer\s+is\s+(.+)$/i);
  if (explicitAnswer && canonicalMathValue(explicitAnswer[1]) === canonicalMathValue(answer)) return null;

  const equalsAt = body.lastIndexOf("=");
  if (equalsAt < 0) return text;
  const result = body.slice(equalsAt + 1).trim();
  if (canonicalMathValue(result) !== canonicalMathValue(answer)) return text;
  const working = body.slice(0, equalsAt + 1).trimEnd();
  if (working.includes("□")) return null;
  return `${working} □${terminal}`;
}

function missingFractionTargets(display) {
  return [...String(display ?? "").matchAll(/(?:\[\[)?(□|-?\d+)\/(□|-?\d+)(?:\]\])?/g)]
    .map((match) => ({ numerator: match[1], denominator: match[2] }))
    .filter(({ numerator, denominator }) => (numerator === "□") !== (denominator === "□"));
}

function concealMissingFractionAnswer(value, targets, answer) {
  if (!targets.length) return String(value ?? "");
  const answerValue = canonicalMathValue(answer);
  return String(value ?? "").replace(
    /(\[\[)?(□|-?\d+)\/(□|-?\d+)(\]\])?/g,
    (fraction, open = "", numerator, denominator, close = "") => {
      const revealsTarget = targets.some((target) => (
        target.numerator === "□"
          ? canonicalMathValue(numerator) === answerValue && denominator === target.denominator
          : canonicalMathValue(denominator) === answerValue && numerator === target.numerator
      ));
      if (!revealsTarget) return fraction;
      return targetFraction(open, close, numerator, denominator, targets, answerValue);
    },
  );
}

function targetFraction(open, close, numerator, denominator, targets, answerValue) {
  const target = targets.find((candidate) => (
    candidate.numerator === "□"
      ? canonicalMathValue(numerator) === answerValue && denominator === candidate.denominator
      : canonicalMathValue(denominator) === answerValue && numerator === candidate.numerator
  ));
  if (!target) return `${open}${numerator}/${denominator}${close}`;
  return `${open}${target.numerator === "□" ? "□" : numerator}/${target.denominator === "□" ? "□" : denominator}${close}`;
}

export function questionPrintSupport(item, support, showRepresentation = true) {
  const stage = SUPPORT_STAGES[support] ?? 0;
  if (stage <= 0) return null;
  const fractionTargets = missingFractionTargets(item.display);
  const safeHint = concealMissingFractionAnswer(item.scaffold.hint, fractionTargets, item.answer);
  if (stage === 1) return { kind: "prompt", hint: safeHint };
  if (stage === 2) return {
    kind: "guided",
    hint: safeHint,
    visual: showRepresentation && !fractionTargets.length
      ? (item.type === "choice" ? item.promptVisual ?? null : item.scaffold.visual)
      : null,
    steps: fractionTargets.length || item.type === "choice"
      ? []
      : item.scaffold.steps.slice(0, 2).map((step) => concealGuidedAnswer(step, item.answer)).filter(Boolean),
  };
  return {
    kind: "model",
    title: item.scaffold.model.title,
    display: item.scaffold.model.display,
    lines: item.scaffold.model.lines,
    answer: item.scaffold.model.answer,
  };
}

export function isPrintableQuestion(item) {
  if (!item || !validateQuestion(item).valid) return false;
  const copy = `${item.instruction ?? ""} ${item.display}`.toLowerCase();
  return !/drag|swipe|tap the marker|move the marker/.test(copy);
}

export function createPrintPractice(input = {}, learningState = {}) {
  const config = normalisePrintConfig(input);
  const challenge = (config.challengeMin + config.challengeMax) / 2;
  const challengeRange = config.challengeMin === config.challengeMax
    ? null
    : { min: config.challengeMin, max: config.challengeMax };
  const engine = new FluencyEngine({
    seed: config.seed,
    challenge,
    challengeRange,
    focus: config.focus,
    mode: config.mode,
    learningState: config.fixedSequence ? {} : learningState,
    subskills: config.subskills,
    retrievalWeight: config.retrievalWeight,
    includeStrategyQuestions: config.includeStrategyQuestions,
    connectedSequences: config.connectedSequences,
    nearTransfer: config.nearTransfer,
    adaptiveDifficulty: config.adaptiveDifficulty,
    representationFrequency: config.representationFrequency,
    fixedSequence: config.fixedSequence,
  });
  const questions = [];
  let attempts = 0;
  while (questions.length < config.count && attempts < config.count * 30) {
    attempts += 1;
    const item = engine.next();
    if (!isPrintableQuestion(item)) continue;
    questions.push({
      number: questions.length + 1,
      id: item.id,
      family: item.family,
      strand: item.strand,
      subskill: item.subskill,
      difficulty: item.difficulty,
      instruction: item.instruction,
      display: item.display,
      type: item.type,
      choices: item.choices,
      answer: item.answer,
      answerType: item.answerType,
      promptVisual: item.promptVisual,
      support: questionPrintSupport(item, config.support, item.metadata.representationSuggested !== false),
      accessibleText: plainMath(`${item.instruction ? `${item.instruction}. ` : ""}${item.display}`),
    });
  }
  if (questions.length !== config.count) throw new Error("Unable to prepare a complete printable practice set");
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    config,
    questions,
    answers: questions.map(({ number, answer }) => ({ number, answer })),
  };
}

function printSupportText(support) {
  if (!support) return undefined;
  if (support.kind === "prompt") return support.hint;
  const uniqueLines = (lines) => {
    const seen = new Set();
    return lines.filter(Boolean).filter((line) => {
      const key = String(line).replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const asSentences = (lines) => uniqueLines(lines)
    .map((line) => {
      const text = String(line).trim();
      return /[.!?:]$/.test(text) ? text : `${text}\u2060.`;
    })
    .join(" ");
  if (support.kind === "guided") return asSentences([support.hint, ...(support.steps ?? [])]);
  if (support.kind === "model") {
    return asSentences([`${support.title}:`, support.display, ...(support.lines ?? []), `Answer: ${support.answer}`]);
  }
  return undefined;
}

/**
 * Convert an engine print pack into the UI contract without discarding question
 * semantics. Keeping this mapping pure makes choice and representation fidelity
 * testable without a browser.
 */
export function createPrintPreview(pack) {
  if (!pack || !Array.isArray(pack.questions)) throw new TypeError("A valid print practice pack is required");
  return {
    title: String(pack.config?.title ?? "Year 4 Fluency"),
    questions: pack.questions.map((item) => ({
      number: item.number,
      type: item.type,
      display: item.instruction ? `${item.instruction} · ${item.display}` : item.display,
      choices: Array.isArray(item.choices) ? item.choices.map(String) : undefined,
      support: printSupportText(item.support),
      visual: item.support?.visual ?? item.promptVisual ?? undefined,
      answer: String(item.answer ?? ""),
    })),
  };
}

export function printPageRule(options = {}) {
  const orientation = options.orientation === "landscape" ? "landscape" : "portrait";
  return `@page { size: A4 ${orientation}; margin: 0; }`;
}

/**
 * Create a conservative print view model. Unsupported or incomplete visual data
 * is withheld instead of being filled with invented values.
 */
export function normalisePrintVisual(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const source = input;
  const kind = String(source.kind ?? "");
  const title = String(source.title ?? "Mathematical model");
  const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
  const positiveInteger = (value, max = 100) => {
    const parsed = finite(value);
    return parsed !== null && parsed >= 1 ? Math.min(max, Math.round(parsed)) : null;
  };
  const numberList = (value, max = 24) => Array.isArray(value)
    ? value.map(finite).filter((item) => item !== null).slice(0, max)
    : [];

  if (kind === "number-line" || kind === "bead-string") {
    const min = finite(source.min);
    const max = finite(source.max);
    if (min === null || max === null || max <= min) return null;
    const markers = numberList(Array.isArray(source.markers) ? source.markers : source.points, 12)
      .filter((marker) => marker >= min && marker <= max);
    const unknown = Number.isInteger(source.unknown) && source.unknown >= 0 && source.unknown < markers.length
      ? source.unknown
      : null;
    return { kind, title, min, max, ticks: positiveInteger(source.ticks, 21) ?? 6, markers, unknown };
  }

  if (kind === "fraction-strip" || kind === "bar-model") {
    const segments = positiveInteger(source.denominator ?? source.segments, 100);
    const filledRaw = finite(source.numerator ?? source.filled);
    if (segments === null || filledRaw === null || filledRaw < 0 || filledRaw > segments) return null;
    const total = finite(source.total);
    return { kind, title, segments, filled: Math.round(filledRaw), total };
  }

  if (kind === "hundred-grid") {
    const filled = finite(source.filled);
    if (filled === null || filled < 0 || filled > 100) return null;
    return { kind, title, filled: Math.round(filled) };
  }

  if (kind === "array") {
    const rows = positiveInteger(source.rows, 24);
    const columns = positiveInteger(source.columns, 24);
    if (rows === null || columns === null) return null;
    return { kind, title, rows, columns };
  }

  if (kind === "partition") {
    const parts = numberList(source.parts, 12);
    const multiplier = finite(source.multiplier);
    if (!parts.length || multiplier === null) return null;
    return { kind, title, parts, multiplier };
  }

  if (kind === "multiplication-rectangle") {
    const factor = finite(source.factor);
    const parts = numberList(source.parts, 12);
    if (factor === null || !parts.length) return null;
    return { kind, title, factor, parts };
  }

  if (kind === "groups") {
    const total = positiveInteger(source.total, 10_000);
    const groupSize = positiveInteger(source.groupSize, 1_000);
    if (total === null || groupSize === null || total % groupSize !== 0) return null;
    return { kind, title, groups: total / groupSize, perGroup: groupSize, total };
  }

  if (kind === "counters") {
    const groups = positiveInteger(source.groups, 100);
    const perGroup = positiveInteger(source.perGroup, 100);
    if (groups === null || perGroup === null) return null;
    return { kind, title, groups, perGroup, total: groups * perGroup };
  }

  if (kind === "ten-frame") {
    const total = positiveInteger(source.total, 20);
    const filled = finite(source.filled);
    if (total === null || filled === null || filled < 0 || filled > total) return null;
    return { kind, title, total, filled: Math.round(filled) };
  }

  if (kind === "place-value") {
    const rows = Array.isArray(source.rows)
      ? source.rows.map((row) => numberList(row, 8)).filter((row) => row.length > 0).slice(0, 6)
      : [];
    if (!rows.length) return null;
    return { kind, title, rows, operator: String(source.operator ?? "") };
  }

  if (kind === "base-ten") {
    const value = finite(source.value ?? source.total);
    if (value === null) return null;
    return { kind, title, value };
  }

  if (kind === "part-whole") {
    const whole = finite(source.whole);
    const parts = numberList(source.parts, 12);
    if (whole === null || !parts.length) return null;
    return { kind, title, whole, parts };
  }

  if (kind === "relationship") {
    const left = String(source.left ?? "").trim();
    const right = String(source.right ?? "").trim();
    if (!left || !right) return null;
    return { kind, title, left, right, connector: String(source.connector ?? "helps") };
  }

  if (kind === "worked-example") {
    const lines = Array.isArray(source.lines) ? source.lines.map(String).filter(Boolean).slice(0, 12) : [];
    if (!lines.length) return null;
    return { kind, title, lines, errorLine: Number.isInteger(source.errorLine) ? source.errorLine : -1 };
  }

  return null;
}
