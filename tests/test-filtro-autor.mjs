import { JSDOM } from "jsdom";
import fs from "node:fs";

// Filtro por autor das edições possuídas, combinado com personagem e salvo na sessão.

const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0;
let passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function montar(sessao = {}, semWaid = false) {
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
  window.sessionStorage.setItem("longbox:aba", "series");
  window.sessionStorage.setItem("longbox:series-abertas", JSON.stringify(["Flash", "Batman"]));

  Object.entries(sessao).forEach(([k, v]) => window.sessionStorage.setItem(k, v));
  const serie = (id, nome, total) => ({ id, nome, personagens: [{ nome: "Flash", de: null, ate: null }], editora: "DC Comics", anoInicio: "1987", anoFim: "1990", totalEdicoes: total, ordem: null });
  const ed = (sid, numero, extra = {}) => ({ id: sid + "-" + numero, serieId: sid, numero, mes: "", ano: "", posicao: null, ...extra });
  const s1 = [
    ed("s1", "1", { autores: { writer: ["Mark Waid"], penciler: ["Mike Wieringo", "Paul Ryan"], inker: [] }, reimpressao: true, origem: "Flash #1 (1987)" }),
    ed("s1", "2"),
    ed("s1", "3", { autores: { writer: ["Grant Morrison", "Waid Exclusivo"] } }),
  ];
  const docs = new Map([
    ["library/volumes", { items: [{
      id: "v1", titulo: "Flash vol 1", personagem: "Flash", tipo: "Trade Paperback", editora: "DC Comics", ano: "2020",
      status: "nao_lida", notas: "", edicoesColetadasIds: (semWaid ? ["s1-2"] : ["s1-1", "s1-2"]),
    }, { id: "v2", titulo: "Outro volume", personagem: "Outro", tipo: "Trade Paperback", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: ["s2-1"] }] }],
    ["library/colecoes", { items: [] }],
    ["library/series", { items: [serie("s1", "Alfa", 3), { ...serie("s2", "Alfa Beta", 2), personagens: [{ nome: "Batman", de: null, ate: null }] }, serie("s3", "Alfa Gama", 1)] }],
    ["library/cores", { mapa: {} }],
    ["edicoes/s1", { items: s1 }],
    ["edicoes/s2", { items: [ed("s2", "1", { autores: { writer: ["Grant Morrison"] } }), ed("s2", "2", { autores: { writer: ["Mark Waid", "Waid Exclusivo"] } })] }],
  ]);
  docs.set("edicoes/s3", { items: [ed("s3", "1", { autores: { writer: ["Mark Waid"] } })] });
  const makeDoc = (path) => ({
    path,
    get: async () => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path), metadata: { fromCache: false, hasPendingWrites: false } }),
    set: async (body) => { docs.set(path, JSON.parse(JSON.stringify(body))); },
    delete: async () => { docs.delete(path); },
  });
  const colecao = (cpath) => ({
    path: cpath,
    doc: (id) => makeDoc(cpath + "/" + id),
    get: async () => {
      const lista = [...docs.keys()].filter((k) => k.startsWith(cpath + "/")).map((k) => ({ id: k.split("/").pop(), data: () => docs.get(k) }));
      return { docs: lista, size: lista.length, empty: !lista.length, docChanges: () => [], metadata: {} };
    },
  });
  window.claude = { use: async (name) => (name === "db" ? { doc: makeDoc, collection: colecao } : null) };
  window.eval(bundle);
  await sleep(400);
  const root = window.document.getElementById("root");
  const sheet = () => root.querySelector('.sheet[data-in="true"]');
  const tile = (id) => sheet() && sheet().querySelector('.tile[data-ed="' + id + '"]');
  const abrir = async (nome) => {
    const fechar = sheet() && sheet().querySelector('[aria-label="Fechar"]');
    if (fechar) { fechar.click(); await sleep(400); }
    [...root.querySelectorAll(".serie-row")].find((r) => r.textContent.includes(nome))?.click();
    await sleep(150);
  };
  const toggle = () => sheet() && sheet().querySelector(".reimp-toggle");
  const ficha = () => sheet() && sheet().querySelector(".edicao-pinned");
  const modal = () => root.querySelector(".modal");
  const digitar = (el, v) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, v);
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  };
  // clicking the picked tile again closes its ficha, so only click when it is shut
  const fichaDe = async (id) => {
    if (!sheet().querySelector('.tile[data-ed="' + id + '"][data-sel="true"]')) { sheet().querySelector('.tile[data-ed="' + id + '"]').click(); await sleep(100); }
  };
  const salvo = (id) => (docs.get("edicoes/s1").items || []).find((e) => e.id === id);
  return { root, erros, sheet, tile, abrir, toggle, ficha, fichaDe, modal, digitar, salvo, window };
}

const abrirPainel = async (m) => {
  if (!m.root.querySelector("#filtro-personagem-series")) { m.root.querySelector(".btn-filtros").click(); await sleep(80); }
};
const escolher = async (m, id, nome) => {
  await abrirPainel(m);
  m.root.querySelector("#" + id)?.focus();
  await sleep(60);
  [...m.root.querySelectorAll("#" + id + "-lista [role=option]")].find((o) => o.querySelector(".sug-title")?.textContent === nome)?.click();
  await sleep(120);
};
const linhas = (m) => [...m.root.querySelectorAll('.aba[data-ativa="true"] .serie-row')].map((r) => r.textContent);
const conta = (m) => m.root.querySelector(".btn-filtros .btn-badge")?.textContent;
const sessaoDe = (m) => Object.fromEntries(Object.entries(m.window.sessionStorage));
const m = await montar();
await abrirPainel(m);
const autor = () => m.root.querySelector("#filtro-autor-series");
check("painel traz Filtrar por autor", autor()?.getAttribute("aria-label") === "Filtrar por autor" && autor()?.placeholder === "Todos os autores");
autor()?.focus();
await sleep(60);
const opcoes = [...m.root.querySelectorAll("#filtro-autor-series-lista [role=option]")];
check("opções só de autores possuídos com contagem", opcoes.map((o) => o.querySelector(".sug-title").textContent + "=" + (o.querySelector(".pfiltro-n")?.textContent || "")).join("|") === "Todos os autores=|Grant Morrison=1|Mark Waid=1|Mike Wieringo=1|Paul Ryan=1");
check("lista Autores sem quadradinho de cor", m.root.querySelector("#filtro-autor-series-lista")?.getAttribute("aria-label") === "Autores" && !m.root.querySelector("#filtro-autor-series-lista .group-swatch"));
if (autor()) { m.digitar(autor(), "inexistente"); await sleep(80); }
check("mensagem vazia usa texto de autor", m.root.querySelector("#filtro-autor-series-lista .sug-empty")?.textContent === 'Nenhum autor com "inexistente".');
if (autor()) { m.digitar(autor(), ""); await sleep(80); }
await escolher(m, "filtro-autor-series", "Mark Waid");
check("Mark Waid mostra só s1, sem s2 ou s3 não possuída", linhas(m).length === 1 && linhas(m)[0].includes("Alfa") && !linhas(m)[0].includes("Gama") && !linhas(m)[0].includes("Beta"), linhas(m));
check("contador conta um autor", conta(m) === "1", conta(m));
// v147: one série is "1 série", not "1 séries".
const corpo = m.window.document.body.textContent;
check("contador no singular com uma série", /(^|\D)1 série(?!s)/.test(corpo) && !/(^|\D)1 séries/.test(corpo), (corpo.match(/\d+ séries?/) || [""])[0]);
check("autor salvo na sessão", m.window.sessionStorage.getItem("longbox:filtro-autor") === "Mark Waid");
await escolher(m, "filtro-personagem-series", "Batman");
check("autor e personagem combinam com E", linhas(m).length === 0);
check("contador conta os dois filtros", conta(m) === "2", conta(m));
await escolher(m, "filtro-personagem-series", "Flash");
check("personagem compatível mantém série do autor", linhas(m).length === 1 && !linhas(m)[0].includes("Gama"));
m.root.querySelector("#busca-acervo").focus();
m.digitar(m.root.querySelector("#busca-acervo"), "alfa");
await sleep(120);
const sug = [...m.root.querySelectorAll("#busca-sugestoes .sug-title")].map((t) => t.textContent);
check("sugestões respeitam ambos os filtros", sug.includes("Alfa") && !sug.includes("Alfa Beta") && !sug.includes("Alfa Gama"), sug);
m.digitar(m.root.querySelector("#busca-acervo"), "");
await sleep(120);
const r = await montar(sessaoDe(m));
check("segunda montagem mantém filtro válido após carregar", r.window.sessionStorage.getItem("longbox:filtro-autor") === "Mark Waid" && linhas(r).length === 1);
const n = await montar(sessaoDe(r), true);
check("terceira montagem solta autor sem edição possuída", n.window.sessionStorage.getItem("longbox:filtro-autor") === null && linhas(n).length === 2, linhas(n));
m.root.querySelector(".filtros-limpar").click();
await sleep(120);
check("Limpar filtros limpa os dois campos", autor()?.value === "" && m.root.querySelector("#filtro-personagem-series")?.value === "" && !conta(m));
check("Limpar filtros limpa ambas as chaves", m.window.sessionStorage.getItem("longbox:filtro-autor") === null && m.window.sessionStorage.getItem("longbox:filtro-series") === null);
check("Limpar filtros restaura todas as séries", linhas(m).length === 3, linhas(m));
await escolher(m, "filtro-autor-series", "Mike Wieringo");
check("filtro inclui penciler de edição possuída", linhas(m).length === 1 && !linhas(m)[0].includes("Gama"));
m.root.querySelectorAll(".segmented button")[0].click();
await sleep(120);
if (!m.root.querySelector("#filtro-personagem")) { m.root.querySelector(".btn-filtros").click(); await sleep(80); }
const hqs = m.root.querySelector("#filtro-personagem");
check("HQs preserva textos padrão", hqs?.placeholder === "Todos os personagens" && hqs?.getAttribute("aria-label") === "Filtrar por personagem");
hqs?.focus();
await sleep(60);
check("HQs preserva lista e cor de personagens", m.root.querySelector("#filtro-personagem-lista")?.getAttribute("aria-label") === "Personagens" && !!m.root.querySelector("#filtro-personagem-lista .group-swatch"));
check("HQs não conta autor da aba Séries", !conta(m));
check("sem erros nas três montagens", [m, r, n].every((x) => x.erros.length === 0), m.erros[0] || r.erros[0] || n.erros[0]);
[m, r, n].forEach((x) => x.window.close());
console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
