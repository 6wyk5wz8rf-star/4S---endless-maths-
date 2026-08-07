import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { FluencyEngine, evaluateAnswer, supportBand, validateQuestion } from "../lib/fluency-engine.mjs";
import { appendEvents, calculateEvidence, createClassroomState, normaliseEvent } from "../lib/classroom-mastery.mjs";
import { createPrintPractice } from "../lib/classroom-print.mjs";

const challengePoints = Array.from({ length: 21 }, (_, index) => index * 5);
const modes = ["mix", "focus", "quick", "think", "my-mix"];
const samplesPerCell = Number(process.argv.find((item) => item.startsWith("--count="))?.split("=")[1] ?? 200);
const means = [];
const families = new Set();
const strands = new Set();
let generated = 0;
let representations = 0;
const started = performance.now();

function scaffoldModelIsCorrect(model) {
  const answer = String(model?.answer ?? "").replaceAll(",", "").trim();
  const display = String(model?.display ?? "").replaceAll(",", "").trim();
  if (!answer || !display) return false;
  const direct = display.match(/^(-?\d+(?:\.\d+)?)\s*([+−×÷])\s*(-?\d+(?:\.\d+)?)$/);
  if (!direct) return true;
  const left = Number(direct[1]);
  const right = Number(direct[3]);
  const remainderAnswer = answer.match(/^(\d+)\s*(?:remainder|r)\s*(\d+)$/i);
  if (direct[2] === "÷" && remainderAnswer) {
    return right > 0 && Number(remainderAnswer[1]) === Math.floor(left / right) && Number(remainderAnswer[2]) === left % right;
  }
  if (!Number.isFinite(Number(answer))) return true;
  const expected = direct[2] === "+" ? left + right
    : direct[2] === "−" ? left - right
      : direct[2] === "×" ? left * right
        : right === 0 ? Number.NaN : left / right;
  return Number.isFinite(expected) && Math.abs(Number(answer) - expected) < 1e-9;
}

for (const challenge of challengePoints) {
  const difficulties = [];
  for (const mode of modes) {
    const focus = mode === "focus" ? (challenge >= 38 ? "place value" : "addition") : null;
    const engine = new FluencyEngine({ seed: `build3-${challenge}-${mode}`, challenge, mode, focus });
    let deepStructuralQuestions = 0;
    for (let index = 0; index < samplesPerCell; index += 1) {
      const item = engine.next();
      const result = validateQuestion(item);
      assert.equal(result.valid, true, `${challenge}/${mode}: ${result.issues.join(", ")}`);
      assert.equal(evaluateAnswer(item, item.answer).correct, true, `${item.id} rejected its own answer`);
      assert.ok(item.scaffold?.hint && item.scaffold?.visual && item.scaffold?.steps?.length && item.scaffold?.model?.answer !== undefined, `${item.id} lacks a scaffold ladder`);
      if (item.type === "choice") assert.ok(item.choices?.includes(item.answer), `${item.id} has no correct choice`);
      if (challenge <= 15) assert.ok(!["fractions", "decimals"].includes(item.strand), `${item.id} leaked later notation into foundation`);
      if (challenge >= 90) {
        assert.ok(item.difficulty >= 60, `${item.id} dropped too far below deep challenge`);
        if (item.metadata.thinking >= 2 || item.difficulty >= 86) deepStructuralQuestions += 1;
      }
      families.add(item.family);
      strands.add(item.strand);
      difficulties.push(item.difficulty);
      if (item.promptVisual || item.scaffold.visual) representations += 1;
      generated += 1;
    }
    if (challenge >= 90) {
      assert.ok(deepStructuralQuestions / samplesPerCell >= 0.7, `${challenge}/${mode} did not contain enough structural deep-challenge work`);
    }
  }
  means.push(difficulties.reduce((sum, value) => sum + value, 0) / difficulties.length);
}

for (let index = 1; index < means.length; index += 1) assert.ok(means[index] >= means[index - 1] - 2.5, `continuum fell sharply at ${challengePoints[index]}`);
assert.ok(means.at(-1) - means[0] > 70, "continuum did not deepen enough");

for (const support of [0, 25, 50, 75, 100]) {
  assert.ok(["independent", "prompted", "guided", "stepped", "modelled"].includes(supportBand(support)));
  const engine = new FluencyEngine({ seed: `support-${support}`, challenge: 58 });
  for (let index = 0; index < 120; index += 1) {
    const item = engine.next();
    assert.ok(item.scaffold.hint.length < 220);
    assert.ok(item.scaffold.steps.length >= 1);
    assert.equal(scaffoldModelIsCorrect(item.scaffold.model), true, `${item.id} has an invalid worked model`);
  }
}

for (const range of [{ min: 5, max: 18 }, { min: 45, max: 60 }, { min: 82, max: 96 }]) {
  const engine = new FluencyEngine({ seed: `range-${range.min}`, challenge: (range.min + range.max) / 2, challengeRange: range });
  const items = Array.from({ length: 500 }, () => engine.next());
  assert.ok(items.every((item) => item.difficulty >= range.min && item.difficulty <= range.max));
}

for (const [index, support] of ["independent", "available", "adaptive", "guided", "modelled"].entries()) {
  const pack = createPrintPractice({ seed: `print-${support}`, challengeMin: 30 + index * 10, challengeMax: 42 + index * 10, count: 30, support, includeAnswers: true, orientation: index % 2 ? "landscape" : "portrait" });
  assert.equal(pack.questions.length, 30);
  assert.ok(pack.questions.every((question, position) => question.number === position + 1 && question.accessibleText && !/drag|swipe/i.test(`${question.instruction} ${question.display}`)));
  assert.ok(pack.answers.every((answer, position) => answer.number === pack.questions[position].number && answer.answer === pack.questions[position].answer));
}

let classroom = createClassroomState({ applicationVersion: "Build 3" });
const syntheticEvents = [];
for (let index = 0; index < 4_500; index += 1) {
  syntheticEvents.push(normaliseEvent({
    id: `synthetic-${index}`,
    profileId: `profile-${index % 4}`,
    sessionId: `session-${Math.floor(index / 20)}`,
    timestamp: new Date(Date.now() - (4_500 - index) * 60_000).toISOString(),
    family: "table-recall",
    strand: "multiplication",
    subskill: `facts-${index % 12}`,
    questionDifficulty: 52,
    supportUsed: index % 7 === 0 ? 50 : 0,
    attempts: index % 9 === 0 ? 2 : 1,
    firstResponseCorrect: index % 9 !== 0,
    finalCorrect: true,
    questionSignature: `fact-${index % 80}`,
  }));
}
classroom = appendEvents(classroom, syntheticEvents);
assert.equal(classroom.events.length, 4_000, "event retention cap was not applied");
const evidence = calculateEvidence(classroom.events);
assert.equal(Object.keys(evidence).length, 4);
assert.ok(Object.values(evidence).every((skills) => Object.keys(skills).length > 0));

const longEngine = new FluencyEngine({ seed: "long-certification", challenge: 62 });
const longStarted = performance.now();
for (let index = 0; index < 500; index += 1) longEngine.next();
const longElapsed = performance.now() - longStarted;
assert.ok(longElapsed < 5_000, `500-question generation took ${Math.round(longElapsed)}ms`);

console.log(`Build 3 audit passed · ${generated.toLocaleString("en-GB")} digital questions · ${families.size} families · ${strands.size} strands · ${representations.toLocaleString("en-GB")} representations · 150 print questions · 4,000 retained evidence events · 500-question long session in ${Math.round(longElapsed)}ms · total ${Math.round(performance.now() - started)}ms`);
