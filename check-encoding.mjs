import fs from "node:fs";

// Guards against the encoding damage a PowerShell rewrite caused earlier:
// a file that no longer round-trips as UTF-8 silently breaks string assertions.
const files = ["test-render.mjs", "test-boot.mjs", "src/app.jsx", "src/styles.css", "src/index.html"];
let bad = 0;

for (const f of files) {
  const buf = fs.readFileSync(f);
  const txt = buf.toString("utf8");
  const clean = Buffer.from(txt, "utf8").equals(buf);
  const replacement = (txt.match(/�/g) || []).length;
  const mojibake = (txt.match(/Ã[-¿]/g) || []).length;
  const ok = clean && replacement === 0 && mojibake === 0;
  if (!ok) bad++;
  console.log(
    (ok ? "  OK   " : "  BAD  ") + f.padEnd(18) +
    " utf8 round-trip: " + clean +
    ", replacement chars: " + replacement +
    ", mojibake: " + mojibake
  );
}

process.exit(bad ? 1 : 0);
