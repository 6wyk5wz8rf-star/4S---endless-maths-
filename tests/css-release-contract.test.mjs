import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const pupil = readFileSync(new URL("../app/pupil-final.css", import.meta.url), "utf8");
const teacher = readFileSync(new URL("../app/teacher.css", import.meta.url), "utf8");
const teacherTools = readFileSync(new URL("../app/TeacherTools.tsx", import.meta.url), "utf8");

function colour(source, token) {
  const match = source.match(new RegExp(`--${token}:\\s*(#[0-9a-f]{6})`, "i"));
  assert.ok(match, `missing --${token}`);
  return match[1];
}

function luminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((value) => Number.parseInt(value, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test("quiet small-text tokens meet WCAG AA contrast", () => {
  assert.ok(contrast(colour(globals, "blue-faded"), colour(globals, "paper")) >= 4.5);
  assert.ok(contrast(colour(globals, "ink-soft"), colour(globals, "paper")) >= 4.5);
  assert.ok(contrast(colour(globals, "accent"), colour(globals, "paper")) >= 4.5);
  assert.ok(contrast(colour(teacher, "teacher-accent"), colour(teacher, "teacher-paper")) >= 4.5);
  assert.ok(contrast(colour(teacher, "teacher-ink-soft"), colour(teacher, "teacher-paper")) >= 4.5);
  assert.match(pupil, /\.axis__labels\s*\{[^}]*color:\s*var\(--blue-faded\)/s);
  assert.match(pupil, /\.answer-display\[data-empty="true"\] span\s*\{[^}]*color:\s*var\(--ink-soft\)/s);
});

test("essential exits and disabled states remain explicit", () => {
  assert.doesNotMatch(teacher, /\.teacher-quiet-button\s*\{[^}]*display:\s*none/s);
  assert.doesNotMatch(pupil, /\.fullscreen-button span[^}]*font-size:\s*0(?:[;\s}])/s);
  assert.match(globals, /button:disabled\s*\{[^}]*opacity:\s*1/s);
  assert.match(teacher, /button:disabled\s*\{[^}]*var\(--teacher-line-strong\)/s);
});

test("skip and update controls keep full touch targets", () => {
  assert.match(globals, /\.skip-link\s*\{[^}]*min-height:\s*44px/s);
  assert.match(globals, /\.update-banner button\s*\{[^}]*min-height:\s*44px/s);
});

test("print sheets preserve choices, visuals and separate strip answers", () => {
  assert.match(teacher, /\.print-choices\s*\{/);
  for (const className of ["print-hundred-grid", "print-partition", "print-ten-frame", "print-place-value-grid", "print-part-whole", "print-relationship", "print-worked"]) {
    assert.match(teacher, new RegExp(`\\.${className}\\s*\\{`));
  }
  const stripRules = [...teacher.matchAll(/\.teacher-print-preview\.format-strip \.print-sheet--questions\s*\{([^}]*)\}/gs)];
  assert.ok(stripRules.some((match) => /width:\s*min\(100%,\s*780px\)/.test(match[1])), "screen strip preview must preserve its paper ratio without content overflow");
  const printStripRule = stripRules.find((match) => /height:\s*99mm/.test(match[1]));
  assert.ok(printStripRule, "missing 99mm strip question-sheet rule");
  assert.match(teacher, /\.teacher-print-preview\.format-strip \.print-sheet--questions > ol\s*\{[^}]*grid-template-columns:\s*repeat\(5,/s);
  assert.match(teacher, /\.teacher-print-preview\.format-strip \.print-number-line__track\s*\{[^}]*height:\s*38px/s);
  assert.match(teacher, /\.teacher-print-preview\.format-strip \.print-number-line__track > b:nth-of-type\(3n \+ 2\) span\s*\{[^}]*top:\s*18px/s);
  assert.match(teacher, /\.teacher-print-preview\.format-strip \.print-number-line__track > b:nth-of-type\(3n\) span\s*\{[^}]*top:\s*28px/s);
  assert.doesNotMatch(printStripRule[1], /overflow:\s*hidden/);
  const baseAnswerRule = teacher.match(/(?:^|\n)\s*\.print-sheet--answers\s*\{([^}]*)\}/s);
  assert.ok(baseAnswerRule, "missing base answer-sheet print rule");
  assert.match(baseAnswerRule[1], /break-before:\s*auto/);
  assert.match(baseAnswerRule[1], /min-height:\s*0/);
  assert.doesNotMatch(teacher, /\.teacher-print-preview\.portrait \.print-sheet--answers\s*\{/);
  assert.match(teacher, /\.teacher-print-preview\.has-answer-sheet\.format-a4 \.print-sheet--questions > ol > li:last-child\s*\{[^}]*break-after:\s*page/s);
  assert.doesNotMatch(teacher, /\.teacher-print-preview\.format-a4 \.print-sheet--questions > ol > li:last-child\s*\{[^}]*break-after:\s*page/s);
  assert.match(teacher, /\.teacher-print-preview\.without-answer-sheet\.format-a4 \.print-sheet--questions\s*\{[^}]*padding-bottom:\s*0/s);
  assert.match(teacher, /\.teacher-print-preview\.format-strip \.print-sheet--answers\s*\{[^}]*break-before:\s*page/s);
  assert.match(teacher, /\.teacher-print-preview\.landscape \.print-sheet\s*\{[^}]*break-after:\s*auto/s);
  assert.match(teacher, /\.print-sheet--questions > ol > li[^}]*break-inside:\s*avoid/s);
  assert.match(teacher, /\.print-sheet--questions > ol\s*\{[^}]*column-gap:\s*40px[^}]*list-style:\s*none/s);
  assert.match(teacher, /\.print-sheet--questions > ol > li\s*\{[^}]*padding-inline:\s*30px 8px[^}]*position:\s*relative/s);
  assert.match(teacher, /\.print-sheet--questions > ol > li::before\s*\{[^}]*content:\s*counter\(list-item\) "\."[^}]*position:\s*absolute/s);
  assert.match(teacher, /\.teacher-print-preview\.format-strip \.print-sheet--questions > ol > li\s*\{[^}]*padding-inline:\s*6mm 1mm/s);
  assert.match(teacher, /overflow-wrap:\s*anywhere/);
  assert.match(teacher, /\.fluency-app:has\(\.teacher-print-dialog\[open\]\) > \*:not\(\.teacher-tools\)/);
  assert.doesNotMatch(teacher, /body:has\(\.teacher-print-dialog\[open\]\) > \*:not\(\.teacher-tools\)/);
  assert.match(teacher, /\.teacher-print-dialog\[open\]\s*\{[^}]*overflow:\s*visible[^}]*position:\s*static/s);
  assert.match(teacher, /\.teacher-print-dialog::backdrop\s*\{[^}]*background:\s*white/s);
  assert.match(teacherTools, /className="teacher-print-math-unit"/);
  assert.match(teacher, /\.teacher-print-math-unit\s*\{[^}]*display:\s*inline-block[^}]*white-space:\s*nowrap/s);
});
