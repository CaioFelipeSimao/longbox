// Runs every suite and judges each one on three things, not on its exit code
// alone: test-render.mjs exits zero with failed assertions (it only counts thrown
// exceptions), which is how v44 and v47 shipped red. So a suite passes only when
//   - it exits 0,
//   - it prints no FAIL and no non-zero error/dash count,
//   - it prints at least MINIMO passes, because a suite that dies halfway also
//     prints zero failures.
// When a suite gains assertions, raise its floor; when one is deliberately
// rewritten away, lower it here, in the same change, so the drop is on record.
//
//   node scripts/test.mjs

import { spawnSync } from "node:child_process";

const SUITES = [
  { args: ["scripts/check-encoding.mjs"], minimo: 0 },
  { args: ["tests/test-render.mjs", "seeded"], minimo: 177 },
  { args: ["tests/test-render.mjs", "no-claude"], minimo: 6 },
  { args: ["tests/test-render.mjs", "with-claude"], minimo: 6 },
  { args: ["tests/test-boot.mjs"], minimo: 37 },
  { args: ["tests/test-filtros.mjs"], minimo: 53 },
  { args: ["tests/test-colecoes.mjs"], minimo: 74 },
  { args: ["tests/test-desfazer.mjs"], minimo: 44 },
  { args: ["tests/test-foco.mjs"], minimo: 35 },
  { args: ["tests/test-capa-grande.mjs"], minimo: 5 },
  { args: ["tests/test-cor-capa.mjs"], minimo: 5 },
  { args: ["tests/test-mapa-serie.mjs"], minimo: 9 },
  { args: ["tests/test-setas-serie.mjs"], minimo: 35 },
  { args: ["tests/test-lote5.mjs"], minimo: 23 },
  { args: ["tests/test-faltantes.mjs"], minimo: 12 },
  { args: ["tests/test-backup.mjs"], minimo: 18 },
  { args: ["tests/test-navegar.mjs"], minimo: 27 },
  { args: ["tests/test-retrato.mjs"], minimo: 23 },
  { args: ["tests/test-contraste.mjs"], minimo: 8 },
  { args: ["tests/test-atalhos.mjs"], minimo: 61 },
  { args: ["tests/test-filtro-series.mjs"], minimo: 27 },
  { args: ["tests/test-fixados.mjs"], minimo: 13 },
  { args: ["tests/test-formatos.mjs"], minimo: 24 },
  { args: ["tests/test-sincronia.mjs"], minimo: 36 },
  { args: ["tests/test-miniaturas.mjs"], minimo: 15 },
  { args: ["tests/test-capa-hub.mjs"], minimo: 40 },
  { args: ["tests/test-arrastar-folha.mjs"], minimo: 14 },
  { args: ["tests/test-barra-busca.mjs"], minimo: 30 },
  { args: ["tests/test-acessibilidade.mjs"], minimo: 24 },
  { args: ["tests/test-edicoes.mjs"], minimo: 41 },
  { args: ["tests/test-reimpressoes.mjs"], minimo: 32 },
  { args: ["tests/test-autores.mjs"], minimo: 26 },
  { args: ["tests/test-filtro-autor.mjs"], minimo: 21 },
];

// Lines that report a count which must be zero. Source and CSS dash counts are
// left out on purpose: those dashes live in code comments, which the punctuation
// ban does not cover; the rendered DOM is what the user reads.
const ZERADOS = [/^ERRORS: (\d+)/m, /^ERRORS AFTER INTERACTION: (\d+)/m, /EM-DASH in DOM: (\d+)/, /EN-DASH in DOM: (\d+)/];

let ruins = 0;
for (const s of SUITES) {
  const r = spawnSync(process.execPath, s.args, { encoding: "utf8", timeout: 180000 });
  const out = (r.stdout || "") + (r.stderr || "");
  const passes = (out.match(/\bPASS\b/g) || []).length;
  const falhas = out.split("\n").filter((l) => /\bFAIL\b|\bBAD\b/.test(l));
  const contagens = ZERADOS.map((re) => out.match(re)).filter((m) => m && m[1] !== "0").map((m) => m[0]);

  const problemas = [];
  if (r.status !== 0) problemas.push("saiu com " + (r.status ?? r.signal));
  if (falhas.length) problemas.push(falhas.length + " linha(s) com FAIL");
  if (contagens.length) problemas.push(contagens.join(", "));
  if (passes < s.minimo) problemas.push("só " + passes + " PASS, o mínimo é " + s.minimo);

  const nome = s.args.join(" ").padEnd(36);
  if (problemas.length) {
    ruins++;
    console.log("  FALHOU  " + nome + problemas.join("; "));
    falhas.slice(0, 15).forEach((l) => console.log("          " + l.trim().slice(0, 160)));
  } else {
    console.log("  ok      " + nome + (s.minimo ? passes + " PASS" : ""));
  }
}

console.log(ruins ? "\n" + ruins + " suíte(s) com problema." : "\nTudo passou.");
process.exit(ruins ? 1 : 0);
