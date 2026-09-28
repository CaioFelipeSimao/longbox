import { JSDOM } from "jsdom";
import fs from "node:fs";

// v108: the série sheet's number map. Hundred-blocks with a handful of issues join
// the block before; blocks with some owned and some missing open by themselves (all
// of them when there are one or two); complete and untouched blocks stay closed.

const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0, passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function montar(series, edicoes, owned) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.test/" });
  const { window } = dom;
  const erros = [];
  window.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el }]); } unobserve() {} disconnect() {} };
  window.scrollTo = () => {};
  window.matchMedia = (q) => ({ matches: q.includes("pointer: fine"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  window.addEventListener("error", (e) => erros.push(e.error?.stack || e.message));
  window.console.error = (...a) => erros.push(a.join(" "));
  window.sessionStorage.setItem("longbox:aba", "series");
  window.sessionStorage.setItem("longbox:series-abertas", JSON.stringify(["Batman"]));
  const docs = new Map([
    ["library/volumes", { items: [{ id: "v1", titulo: "Batman v1", personagem: "Batman", tipo: "Omnibus", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: owned }] }],
    ["library/colecoes", { items: [] }], ["library/series", { items: series }], ["library/cores", { mapa: {} }],
  ]);
  const porSerie = {};
  edicoes.forEach((e) => (porSerie[e.serieId] = porSerie[e.serieId] || []).push(e));
  Object.entries(porSerie).forEach(([sid, items]) => docs.set("edicoes/" + sid, { items }));
  const makeDoc = (path) => ({ path, get: async () => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path), metadata: {} }), set: async (b) => { docs.set(path, b); }, delete: async () => { docs.delete(path); } });
  const colecao = (c) => ({ doc: (id) => makeDoc(c + "/" + id), get: async () => { const l = [...docs.keys()].filter((k) => k.startsWith(c + "/")).map((k) => ({ id: k.split("/").pop(), data: () => docs.get(k) })); return { docs: l, size: l.length, empty: !l.length, docChanges: () => [], metadata: {} }; } });
  window.claude = { use: async (n) => (n === "db" ? { doc: makeDoc, collection: colecao } : null) };
  window.eval(bundle);
  await sleep(450);
  const root = window.document.getElementById("root");
  return { root, erros };
}
const serie = (id, nome) => ({ id, nome, personagens: [{ nome: "Batman", de: null, ate: null }], editora: "DC Comics", anoInicio: "1940", anoFim: "", totalEdicoes: null, ordem: null });
const eds = (sid, de, ate) => Array.from({ length: ate - de + 1 }, (_, i) => ({ id: sid + "-" + (de + i), serieId: sid, numero: String(de + i), mes: "", ano: "", posicao: null }));
// What the eye reads: v132 added a screen-reader-only "N de M possuídas" beside each count.
const visivel = (el) => { const c = el.cloneNode(true); c.querySelectorAll(".sr-only").forEach((s) => s.remove()); return c.textContent; };
const blocos = (root) => [...root.querySelectorAll(".sheet .bucket")].map((d) => visivel(d.querySelector("summary")).replace(/\s+/g, " ").trim() + (d.open ? " [aberto]" : " [fechado]"));

console.log("=== 1-99 mais um #100 solto ===");
{
  const owned = eds("s1", 1, 55).map((e) => e.id);
  const m = await montar([serie("s1", "Constantine")], eds("s1", 1, 100), owned);
  m.root.querySelector(".serie-row")?.click();
  await sleep(200);
  const b = blocos(m.root);
  check("vira um bloco só", b.length === 1, b.join(" | "));
  check("rotulado até o 100", /Nº 0-100 55\/100/.test(b[0] || ""), b[0]);
  check("e aberto", /\[aberto\]/.test(b[0] || ""), b[0]);
  check("sem erros", m.erros.length === 0, m.erros[0]);
}

console.log("=== série longa: só abre onde há caça ===");
{
  const owned = [...eds("s2", 1, 99), ...eds("s2", 200, 250)].map((e) => e.id);
  const m = await montar([serie("s2", "Batman (Volume 1)")], eds("s2", 1, 399), owned);
  m.root.querySelector(".serie-row")?.click();
  await sleep(200);
  const b = blocos(m.root);
  check("quatro blocos", b.length === 4, b.join(" | "));
  check("completo fica fechado", /Nº 0-99 99\/99 \[fechado\]/.test(b[0] || ""), b[0]);
  check("sem nenhuma possuída fica fechado", /Nº 100-199 0\/100 \[fechado\]/.test(b[1] || ""), b[1]);
  check("com caça abre", /Nº 200-299 51\/100 \[aberto\]/.test(b[2] || ""), b[2]);
  check("sem erros", m.erros.length === 0, m.erros[0]);
}

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
