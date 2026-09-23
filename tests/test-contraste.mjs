import { JSDOM } from "jsdom";
import fs from "node:fs";

// v90 (D2): contrast guards. JSDOM applies no media queries and computes no
// colours, so the pairs that failed the D2 review are checked from the tokens in
// src/styles.css with the WCAG formula, and the band pill's ink is checked on the
// element the app renders. v70 had quietly put white text on the Longbox cyan
// (2.3:1) and nothing noticed for twenty versions; these stop that happening twice.

const css = fs.readFileSync("src/styles.css", "utf8");
const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0;
let passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (info !== undefined ? "  (" + info + ")" : ""));
};

const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const razao = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// The dark tokens are the first :root block; the light ones sit inside the first
// prefers-color-scheme: light block.
const inicioClaro = css.indexOf("@media (prefers-color-scheme: light)");
const escuro = css.slice(0, inicioClaro);
const claro = css.slice(inicioClaro, css.indexOf("\n}\n", inicioClaro));
const token = (bloco, nome) => {
  const m = bloco.match(new RegExp("--" + nome + ":\\s*(#[0-9A-Fa-f]{6})"));
  return m ? m[1] : null;
};

console.log("=== tokens ===");
const pares = [
  ["botão principal no claro: branco sobre --accent", token(claro, "accent-ink") || "#FFFFFF", token(claro, "accent")],
  ["botão principal no escuro: --accent-ink sobre --accent", token(escuro, "accent-ink"), token(escuro, "accent")],
  ["edição possuída no escuro: --read-ink sobre --read", token(escuro, "read-ink"), token(escuro, "read")],
  ["edição possuída no claro: --read-ink sobre --read", token(claro, "read-ink"), token(claro, "read")],
];
for (const [nome, frente, fundo] of pares) {
  const r = frente && fundo ? razao(frente, fundo) : 0;
  check(nome + " passa de 4,5", r >= 4.5, frente + " sobre " + fundo + ": " + r.toFixed(2));
}
check("a regra da pílula não fixa o branco", /data-tinted="true"\] \.segmented button\[data-active="true"\] \{ color: var\(--ed-cor-tinta/.test(css));

console.log("=== pílula renderizada ===");
async function montar(editoraSel) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
    runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.test/",
  });
  const { window } = dom;
  window.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el }]); } unobserve() {} disconnect() {} };
  window.scrollTo = () => {};
  window.matchMedia = (q) => ({ matches: q.includes("pointer: fine"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  window.sessionStorage.setItem("longbox:aba", "volumes");
  const vol = (id, editora) => ({ id, titulo: "Vol " + id, personagem: "Batman", tipo: "Trade Paperback", editora, ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: [] });
  const docs = new Map([
    ["library/volumes", { items: [vol("a", "DC Comics"), vol("b", "Amarela")] }],
    ["library/colecoes", { items: [] }],
    ["library/series", { items: [] }],
    ["library/cores", { mapa: {} }],
    ["library/editoras", { itens: [
      { id: "dc", nome: "DC Comics", cor: { h: 211.3, s: 96.7, l: 48.2 } },
      { id: "amarela", nome: "Amarela", cor: { h: 60 } },
    ], selecionada: editoraSel }],
  ]);
  const makeDoc = (path) => ({
    path,
    get: async () => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path), metadata: {} }),
    set: async (body) => { docs.set(path, body); }, delete: async () => { docs.delete(path); },
  });
  window.claude = { use: async (n) => (n === "db" ? { doc: makeDoc, collection: (c) => ({ doc: (id) => makeDoc(c + "/" + id), get: async () => ({ docs: [], size: 0, empty: true, docChanges: () => [], metadata: {} }) }) } : null) };
  window.eval(bundle);
  await new Promise((r) => setTimeout(r, 450));
  const faixa = window.document.querySelector(".ed-band");
  return faixa ? faixa.style.getPropertyValue("--ed-cor-tinta").trim() : null;
}
check("Todas as editoras (ciano claro): tinta escura", (await montar("__todas__")) === "#04191E", await montar("__todas__"));
check("editora de cor clara (amarelo): tinta escura", (await montar("amarela")) === "#04191E", await montar("amarela"));
check("editora de azul forte: branco", (await montar("dc")) === "#FFFFFF", await montar("dc"));

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
