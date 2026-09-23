import fs from "node:fs";

// Guards against the encoding damage a PowerShell rewrite caused earlier:
// a file that no longer round-trips as UTF-8 silently breaks string assertions.
// Every text source in the project, found by walking, so a newly added module or
// suite is covered without anyone remembering to list it here.
const PASTAS = ["src", "tests", "scripts", "harness"];
const EXT = /\.(jsx?|mjs|css|html|md)$/;
function andar(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = dir + "/" + e.name;
    if (e.isDirectory()) return e.name === "_blob" ? [] : andar(p);
    return EXT.test(e.name) && !/^harness\/(app\.js|styles\.css)$/.test(p) ? [p] : [];
  });
}
const files = ["DESIGN.md"].concat(...PASTAS.map(andar));
let bad = 0;

for (const f of files) {
  const buf = fs.readFileSync(f);
  const txt = buf.toString("utf8");
  const clean = Buffer.from(txt, "utf8").equals(buf);
  const replacement = (txt.match(/\uFFFD/g) || []).length;
  const mojibake = (txt.match(/\u00C3[\u0080-\u00BF]/g) || []).length;
  const ok = clean && replacement === 0 && mojibake === 0;
  if (!ok) bad++;
  console.log(
    (ok ? "  OK   " : "  BAD  ") + f.padEnd(44) +
    " utf8 round-trip: " + clean +
    ", replacement chars: " + replacement +
    ", mojibake: " + mojibake
  );
}

process.exit(bad ? 1 : 0);
