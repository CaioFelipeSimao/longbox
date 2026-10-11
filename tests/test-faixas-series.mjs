import { JSDOM } from "jsdom";
import fs from "node:fs";

// v177: character counters must agree with the detail sheet's issue range.
// Synthetic library; these ownership counts are not the user's live library.
let passes = 0, falhas = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok ? " (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dom = new JSDOM('<div id="root"></div>', { runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.test/" });
const { window } = dom;
const erros = [];
window.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el }]); } unobserve() {} disconnect() {} };
window.scrollTo = () => {};
window.matchMedia = (q) => ({ matches: q.includes("pointer: fine"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
window.addEventListener("error", (e) => erros.push(e.error?.stack || e.message));
window.console.error = (...a) => erros.push(a.join(" "));
window.sessionStorage.setItem("longbox:aba", "series");
const faixa = (nome, de = null, ate = null) => ({ nome, de, ate });
const serie = (id, nome, personagens, totalEdicoes) => ({ id, nome, personagens, totalEdicoes, editora: "DC Comics", anoInicio: "1988", anoFim: "1998", ordem: null });
const ed = (sid, numero, posicao = null) => ({ id: sid + "-" + numero, serieId: sid, numero: String(numero), posicao, mes: "", ano: "" });
const series = [
  serie("ga", "Green Arrow (Volume 2)", [faixa("Green Arrow (Oliver Queen)", 1, 101), faixa("Green Arrow (Connor Hawke)", 102, 137)], 146),
  serie("generic", "Green Arrow especial", [faixa("Green Arrow")], 50),
  serie("edges", "Faixas de teste", [faixa("Faixas múltiplas", 2, 3), faixa("Faixas múltiplas", 3, 4), faixa("Só início", 3), faixa("Só fim", null, 2), faixa("Completa"), faixa("Sem edições", 20, 30)], 99),
];
const edicoes = {
  ga: Array.from({ length: 146 }, (_, i) => ed("ga", i + 1)),
  generic: [ed("generic", 1)],
  edges: [ed("edges", 1), ed("edges", 2), ed("edges", 3), ed("edges", 4), ed("edges", "Anual"), ed("edges", "Especial", 2.5)],
};
const owned = ["ga-1", "ga-101", "ga-102", "ga-137", "ga-138", "generic-1", "edges-1", "edges-3", "edges-Anual", "edges-Especial"];
const docs = new Map([
  ["library/volumes", { items: [{ id: "v", titulo: "Acervo de teste", personagem: "Green Arrow", editora: "DC Comics", tipo: "Trade Paperback", status: "nao_lida", edicoesColetadasIds: owned }] }],
  ["library/series", { items: series }], ["library/colecoes", { items: [] }], ["library/cores", { mapa: {} }],
  ...Object.entries(edicoes).map(([id, items]) => ["edicoes/" + id, { items }]),
]);
const doc = (p) => ({ get: async () => ({ exists: docs.has(p), data: () => docs.get(p), metadata: {} }), set: async (body) => docs.set(p, body), delete: async () => docs.delete(p) });
window.claude = { use: async (n) => n === "db" ? { doc, collection: (p) => ({ doc: (id) => doc(p + "/" + id), get: async () => ({ docs: [...docs].filter(([k]) => k.startsWith(p + "/")).map(([k, v]) => ({ id: k.split("/").pop(), data: () => v })), metadata: {} }) }) } : null };
window.eval(fs.readFileSync("dist/app.js", "utf8"));
await sleep(450);
const root = window.document.getElementById("root");
const grupo = (nome) => [...root.querySelectorAll("section.group")].find((g) => g.querySelector("h2")?.textContent === nome);
const contador = (nome) => grupo(nome)?.querySelector('.group-progresso [aria-hidden="true"]')?.textContent;
const esperado = { "Green Arrow": "1/50", "Green Arrow (Connor Hawke)": "2/36", "Green Arrow (Oliver Queen)": "2/101", "Faixas múltiplas": "2/4", "Só início": "1/2", "Só fim": "1/2", "Completa": "4/99", "Sem edições": "0/0" };
for (const [nome, valor] of Object.entries(esperado)) check(nome + ": " + valor, contador(nome) === valor, contador(nome));
const abrirGrupo = async (nome) => { const g = grupo(nome); if (!g.querySelector(".serie-row")) { g.querySelector('[aria-expanded]').click(); await sleep(100); } return grupo(nome); };
for (const nome of ["Green Arrow", "Green Arrow (Connor Hawke)", "Green Arrow (Oliver Queen)"]) {
  const g = await abrirGrupo(nome);
  const count = g.querySelector('.serie-top .num [aria-hidden="true"]')?.textContent;
  check("linha respeita a faixa de " + nome, count === esperado[nome], count);
}
const connor = grupo("Green Arrow (Connor Hawke)");
check("barra de Connor só mostra 36 edições", connor.querySelectorAll(".run i").length === 36, connor.querySelectorAll(".run i").length);
connor.querySelector(".serie-row").click();
await sleep(150);
const sheet = () => root.querySelector('.sheet[data-in="true"]');
const numeros = () => [...sheet().querySelectorAll('.tile[aria-label]')].map((e) => e.textContent);
check("painel informa 102 a 137", sheet()?.textContent.includes("Mostrando as edições 102 a 137"), sheet()?.textContent.slice(0, 300));
check("painel e contador usam as mesmas 36 edições", numeros().length === 36 && numeros()[0] === "102" && numeros().at(-1) === "137", numeros().join(","));
[...sheet().querySelectorAll("button")].find((b) => b.textContent === "Ver todas").click();
await sleep(100);
check("Ver todas continua mostrando 146 edições", numeros().length === 146, numeros().length);
check("Ver todas não muda o contador de Connor", contador("Green Arrow (Connor Hawke)") === "2/36", contador("Green Arrow (Connor Hawke)"));
[...sheet().querySelectorAll("button")].find((b) => b.textContent === "Aplicar a faixa").click();
await sleep(100);
check("Aplicar a faixa volta às 36 edições", numeros().length === 36, numeros().length);
check("sem erros", erros.length === 0, erros[0]);
console.log("\n" + passes + " passaram, " + falhas + " falharam");
dom.window.close();
process.exit(falhas ? 1 : 0);
