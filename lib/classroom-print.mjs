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

export function questionPrintSupport(item, support, showRepresentation = true) {
  const stage = SUPPORT_STAGES[support] ?? 0;
  if (stage <= 0) return null;
  if (stage === 1) return { kind: "prompt", hint: item.scaffold.hint };
  if (stage === 2) return {
    kind: "guided",
    hint: item.scaffold.hint,
    visual: showRepresentation ? item.scaffold.visual : null,
    steps: item.scaffold.steps.slice(0, 2),
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
