import {
  QUESTION_FAMILIES,
  QUESTION_STRUCTURE_COUNT,
  createEngine,
  validateQuestion,
} from "../lib/fluency-engine.mjs";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (key.startsWith("--")) {
    args.set(key.slice(2), value && !value.startsWith("--") ? value : true);
    if (value && !value.startsWith("--")) index += 1;
  }
}

const points = args.has("challenge")
  ? [Number(args.get("challenge"))]
  : [5, 15, 25, 35, 45, 55, 65, 75, 85, 95];
const count = Math.max(1, Number(args.get("count") ?? 20));
const mode = String(args.get("mode") ?? "mix");
const asJson = args.has("json");
const rows = [];
const failures = [];

for (const challenge of points) {
  const engine = createEngine({ seed: `human-audit-${challenge}-${mode}`, challenge, mode });
  for (let index = 0; index < count; index += 1) {
    const item = engine.next();
    const validation = validateQuestion(item);
    if (!validation.valid) failures.push({ challenge, family: item.family, issues: validation.issues });
    rows.push({
      challenge,
      index: index + 1,
      generator: item.family,
      structure: item.metadata.structure,
      question: [item.instruction, item.display].filter(Boolean).join(" · "),
      answer: item.answer,
      difficulty: item.difficulty,
      strand: item.strand,
      scaffold: [item.scaffold.hint, item.scaffold.visual?.kind, item.scaffold.model?.display].join(" · "),
    });
  }
}

if (asJson) {
  console.log(JSON.stringify({ families: QUESTION_FAMILIES.length, structures: QUESTION_STRUCTURE_COUNT, mode, rows, failures }, null, 2));
} else {
  console.log(`Year 4 Fluency audit · ${QUESTION_FAMILIES.length} families · ${QUESTION_STRUCTURE_COUNT} structures · ${mode}`);
  for (const row of rows) {
    console.log([
      String(row.challenge).padStart(3),
      String(row.index).padStart(2),
      row.strand.padEnd(14),
      row.generator.padEnd(38),
      String(row.difficulty).padStart(3),
      row.question,
      `→ ${row.answer}`,
      `[${row.scaffold}]`,
    ].join(" | "));
  }
}

if (failures.length) {
  console.error(`${failures.length} validation failures`);
  process.exitCode = 1;
}
