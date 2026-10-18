import { JSDOM } from "jsdom";
import fs from "node:fs";

// D1 (v89): "Seu acervo" on the hub, after the shelf. Reading as a meter (lidas,
// lendo, the rest), formats and characters as bars of their share of the whole
// collection, characters in their own shelf colour, top four plus "Outros". A
// publisher column only when there are two or more publishers. Every bar but
// "Outros" opens the HQs tab filtered to exactly that slice, with the filter panel
// open, the search cleared and the band on every publisher, so the shelf shows the
// same count the hub did.

const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0;
let passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function biblioteca({ duasEditoras = false } = {}) {
  const vols = [];
  let n = 0;
  const add = (personagem, tipo, status, editora = "DC Comics") => {
    n++;
    vols.push({ id: "v" + n, titulo: personagem + " " + n, personagem, tipo, editora, ano: "2020", status, notas: "", edicoesColetadasIds: [] });
  };
  for (let i = 0; i < 6; i++) add("Flash", i < 4 ? "Trade Paperback" : "Hardcover", i === 0 ? "lida" : "nao_lida");
  for (let i = 0; i < 4; i++) add("Batman", "Hardcover", i === 0 ? "lendo" : i === 1 ? "lida" : "nao_lida", duasEditoras && i === 3 ? "Marvel" : "DC Comics");
  add("Nightwing", "Omnibus", "nao_lida");
  add("Nightwing", "Trade Paperback", "nao_lida");
  add("Robin", "Trade Paperback", "nao_lida");
  add("Batgirl", "Compendium", "nao_lida");
  add("Harley Quinn", "Trade Paperback", "nao_lida");
  return vols; // 15 volumes: 2 lidas, 1 lendo, 12 na fila
}

async function montar(opcoes = {}) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
    runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.test/",
  });
  const { window } = dom;
  const erros = [];
  window.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el }]); } unobserve() {} disconnect() {} };
  window.scrollTo = () => {};
  window.matchMedia = (q) => ({ matches: q.includes("pointer: fine"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  window.addEventListener("error", (e) => erros.push(e.error?.stack || e.message));
  window.console.error = (...a) => erros.push(a.join(" "));
  window.sessionStorage.setItem("longbox:aba", "hub");
  if (opcoes.filtrosAntes) window.sessionStorage.setItem("longbox:filtros-hqs", JSON.stringify(opcoes.filtrosAntes));

  const docs = new Map([
    ["library/volumes", { items: opcoes.vazia ? [] : biblioteca(opcoes) }],
    ["library/colecoes", { items: [] }],
    ["library/series", { items: [] }],
    ["library/cores", { mapa: {} }],
  ]);
  if (opcoes.editoraSel) docs.set("library/editoras", { itens: [], selecionada: opcoes.editoraSel });
  const makeDoc = (path) => ({
    path,
    get: async () => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path), metadata: { fromCache: false, hasPendingWrites: false } }),
    set: async (body) => { docs.set(path, JSON.parse(JSON.stringify(body))); },
    delete: async () => { docs.delete(path); },
  });
  const colecao = (cpath) => ({ path: cpath, doc: (id) => makeDoc(cpath + "/" + id), get: async () => ({ docs: [], size: 0, empty: true, docChanges: () => [], metadata: {} }) });
  window.claude = { use: async (name) => (name === "db" ? { doc: makeDoc, collection: colecao } : null) };
  window.eval(bundle);
  await sleep(450);
  const root = window.document.getElementById("root");
  const retrato = () => root.querySelector(".retrato");
  const coluna = (titulo) => retrato() && [...retrato().querySelectorAll(".retrato-col")].find((c) => c.querySelector("h3")?.textContent === titulo);
  const linhas = (titulo) => coluna(titulo) ? [...coluna(titulo).querySelectorAll(".retrato-linha")] : [];
  const linha = (titulo, nome) => linhas(titulo).find((l) => l.querySelector(".retrato-nome")?.textContent === nome);
  const hqsVisiveis = () => [...root.querySelectorAll('.aba[data-ativa="true"] .vol .vol-title')].map((e) => e.textContent);
  return { window, root, erros, docs, retrato, coluna, linhas, linha, hqsVisiveis };
}

console.log("=== o retrato ===");
const m = await montar();
check("a seção aparece no hub", !!m.retrato());
const secoes = [...m.root.querySelectorAll(".hub > section .hub-section-head h2")].map((h) => h.textContent);
check("fica depois do personagem em destaque", secoes.indexOf("Seu acervo") === secoes.indexOf("Em destaque") + 1, secoes.join(" > "));
check("leitura em destaque", /2\s*de 15/.test(m.coluna("Leitura")?.querySelector(".retrato-destaque")?.textContent || ""), m.coluna("Leitura")?.querySelector(".retrato-destaque")?.textContent);
const segs = [...(m.coluna("Leitura")?.querySelectorAll(".retrato-meter i") || [])].map((i) => i.dataset.s + ":" + i.style.flexGrow);
check("barra de leitura em três partes na ordem", segs.join(" ") === "lida:2 lendo:1 resto:12", segs.join(" "));
check("as contagens por extenso", ["2 lidas", "1 lendo", "12 na fila"].every((t) => m.coluna("Leitura")?.textContent.includes(t)), m.coluna("Leitura")?.textContent);
const formatos = m.linhas("Formatos").map((l) => l.querySelector(".retrato-nome").textContent + " " + l.querySelector(".retrato-valor").textContent);
check("formatos do maior para o menor", formatos.join(", ") === "Trade Paperback 7, Hardcover 6, Compendium 1, Omnibus 1", formatos.join(", "));
const tp = m.linha("Formatos", "Trade Paperback");
check("a barra é a fração do acervo", tp?.querySelector(".retrato-trilho i")?.style.width === (7 / 15 * 100).toFixed(2) + "%", tp?.querySelector(".retrato-trilho i")?.style.width);
check("a dica mostra a porcentagem", tp?.dataset.dica === "7 de 15, 47%", tp?.dataset.dica);
const pers = m.linhas("Personagens").map((l) => l.querySelector(".retrato-nome").textContent + " " + l.querySelector(".retrato-valor").textContent);
check("quatro maiores e outros", pers.join(", ") === "Flash 6, Batman 4, Nightwing 2, Batgirl 1, Outros 2", pers.join(", "));
check("personagem na cor da estante", !!m.linha("Personagens", "Flash")?.querySelector(".retrato-trilho i")?.style.background);
check("outros não é clicável", m.linha("Personagens", "Outros")?.tagName !== "BUTTON");
check("com uma editora só, sem coluna de editoras", !m.coluna("Editoras"));
check("sem erros", m.erros.length === 0, m.erros[0]);

console.log("=== tocar numa barra ===");
m.linha("Formatos", "Hardcover").click();
await sleep(500);
check("abre a aba HQs", m.root.querySelector('.aba[data-ativa="true"]') && m.hqsVisiveis().length > 0);
check("só os Hardcover", m.hqsVisiveis().length === 6, m.hqsVisiveis().join(", "));
check("com o painel de filtros aberto", m.root.querySelector(".btn-filtros")?.dataset.active === "true");
check("o filtro fica salvo como os outros", JSON.parse(m.window.sessionStorage.getItem("longbox:filtros-hqs")).tipo === "Hardcover");

const p = await montar({ filtrosAntes: { status: "lida", tipo: "Omnibus", personagem: "" } });
p.linha("Personagens", "Batman").click();
await sleep(500);
check("personagem abre só ele, limpando os filtros de antes", p.hqsVisiveis().length === 4 && p.hqsVisiveis().every((t) => t.startsWith("Batman")), p.hqsVisiveis().join(", "));
const s = await montar();
[...s.coluna("Leitura").querySelectorAll("button")].find((b) => /lendo/.test(b.textContent))?.click();
await sleep(500);
check("status abre só os que você está lendo", s.hqsVisiveis().join() === "Batman 7", s.hqsVisiveis().join(", "));

console.log("=== editoras ===");
const e = await montar({ duasEditoras: true, editoraSel: "__sem__" });
check("duas editoras mostram a coluna", !!e.coluna("Editoras"));
e.linha("Personagens", "Flash").click();
await sleep(500);
check("a faixa de editora volta para todas", e.hqsVisiveis().length === 6, e.hqsVisiveis().join(", "));
check("sem erros (editoras)", e.erros.length === 0, e.erros[0]);

console.log("=== acervo vazio ===");
const v = await montar({ vazia: true });
check("sem volumes, sem retrato", !v.retrato());

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
