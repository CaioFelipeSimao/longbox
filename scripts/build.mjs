// One build for every shell. Calling esbuild through its JS API instead of the
// command line is the point: PowerShell used to strip the quotes out of the
// NODE_ENV define and silently ship React's development build (~549 KB).
//
//   node scripts/build.mjs          build dist/ and refresh the harness copies
//   node scripts/build.mjs --claro  same, but the harness CSS has the light theme forced on
//
// dist/ is what gets published: index.html as the page, app.js and styles.css
// as supporting files. styles.css and index.html have no build step, they are
// copied, which is exactly the step that used to be forgotten (v30 shipped
// without its own CSS). Doing it here means it cannot be skipped.

import { build } from "esbuild";
import fs from "node:fs";

const claro = process.argv.includes("--claro");
// A production bundle is ~350 KB; React's development build pushes it past 540.
// Anything over this ceiling means the define did not land.
const TETO_KB = 450;

await build({
  entryPoints: ["src/main.jsx"],
  bundle: true,
  minify: true,
  format: "iife",
  jsx: "automatic",
  target: "es2020",
  outfile: "dist/app.js",
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});

fs.copyFileSync("src/styles.css", "dist/styles.css");
fs.copyFileSync("src/index.html", "dist/index.html");

// The harness serves its own copies (git ignores them); refresh them every build
// so it never measures a stale bundle.
fs.copyFileSync("dist/app.js", "harness/app.js");
let css = fs.readFileSync("dist/styles.css", "utf8");
if (claro) css = css.split("@media (prefers-color-scheme: light)").join("@media all");
fs.writeFileSync("harness/styles.css", css);

const kb = fs.statSync("dist/app.js").size / 1024;
console.log("dist/app.js " + kb.toFixed(1) + " KB" + (claro ? "  (harness em tema claro)" : ""));
if (kb > TETO_KB) {
  console.error("Bundle acima de " + TETO_KB + " KB: provavelmente o build de desenvolvimento do React.");
  process.exit(1);
}
