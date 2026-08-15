import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const PALETTE = ["#AF2E1B", "#CC6324", "#3B4B59", "#BFA07A", "#D9C3B0"];

const luminance = (hex) => {
  const channels = hex.slice(1).match(/.{2}/g).map((pair) => Number.parseInt(pair, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};

const contrast = (a, b) => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
};

test("pupil, teacher and installed surfaces use the exact Blue Bridge palette", async () => {
  const [globals, teacher, manifest, favicon, jotPad] = await Promise.all([
    read("../app/globals.css"),
    read("../app/teacher.css"),
    read("../public/manifest.webmanifest"),
    read("../public/favicon.svg"),
    read("../app/FluencyApp.tsx"),
  ]);

  for (const colour of PALETTE) {
    assert.match(globals, new RegExp(colour, "i"), `pupil tokens must include ${colour}`);
    assert.match(teacher, new RegExp(colour, "i"), `teacher tokens must include ${colour}`);
  }
  assert.equal(JSON.parse(manifest).theme_color, "#3B4B59");
  assert.equal(JSON.parse(manifest).background_color, "#D9C3B0");
  assert.match(favicon, /#D9C3B0[\s\S]*#3B4B59[\s\S]*#CC6324/);
  assert.match(jotPad, /strokeStyle = "#3B4B59"/, "generated pupil marks must use the shared slate");
});

test("semantic palette pairings retain readable contrast", () => {
  assert.ok(contrast("#AF2E1B", "#FFFFFF") >= 4.5, "red actions need readable white labels");
  assert.ok(contrast("#3B4B59", "#FFFFFF") >= 4.5, "slate actions need readable white labels");
  assert.ok(contrast("#3B4B59", "#D9C3B0") >= 4.5, "slate text needs readable blush surfaces");
  assert.ok(contrast("#CC6324", "#111111") >= 4.5, "orange states need dark labels");
});
