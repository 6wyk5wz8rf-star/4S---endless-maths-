import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "pages-dist");

await mkdir(path.join(root, "assets"), { recursive: true });
for (const file of ["index.html", "favicon.svg", "manifest.webmanifest", "sw.js"]) {
  await copyFile(path.join(output, file), path.join(root, file));
}
for (const file of ["app.js", "index.css"]) {
  await copyFile(path.join(output, "assets", file), path.join(root, "assets", file));
}

console.log("GitHub Pages root now contains the complete browser app.");
