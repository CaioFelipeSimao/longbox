import { JSDOM } from "jsdom";
import fs from "node:fs";

// v147: highlights explain filtered rows without changing ownership.

const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0;
let passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function montar(sessao = {}, plural = false) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
    runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.test/",
  });
  const { window } = dom;
  const erros = [];
  window.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el }]); } unobserve() {} disconnect() {} };
  window.scrollTo = () => {};
  window.HTMLCanvasElement.prototype.getContext = () => null;
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
    ed("s1", "2", plural ? { autores: { inker: ["Mark Waid"] } } : {}),
    ed("s1", "3", { autores: { writer: ["Grant Morrison", "Waid Exclusivo"] } }),
  ];
  const docs = new Map([
    ["library/volumes", { items: [{
      id: "v1", titulo: "Flash vol 1", personagem: "Flash", tipo: "Trade Paperback", editora: "DC Comics", ano: "2020",
      status: "nao_lida", notas: "", edicoesColetadasIds: ["s1-1", "s1-2"],
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
  await sleep(800);
  const root = window.document.getElementById("root");
  const sheet = () => root.querySelector('.sheet[data-in="true"]');
  const tile = (id) => sheet() && sheet().querySelector('.tile[data-ed="' + id + '"]');
  const abrir = async (nome) => {
    const fechar = sheet() && sheet().querySelector('[aria-label="Fechar"]');
    if (fechar) { fechar.click(); await sleep(400); }
    [...root.querySelectorAll(".serie-row")].find((r) => r.querySelector(".t-title")?.textContent === nome)?.click();
    await sleep(400);
  };
  const digitar = (el, v) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, v);
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  };
  return { root, erros, sheet, tile, abrir, digitar, window };
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
const m = await montar();
const marcados = (m) => m.sheet()?.querySelectorAll('.tile[data-autor="true"]') || [];
const apagados = (m) => m.sheet()?.querySelectorAll('.tile[data-esmaecido="true"]') || [];
const aviso = (m) => m.sheet()?.querySelector(".destaque-autor");
const linha = (m) => m.root.querySelector(".serie-row");
const fechar = async (m) => { m.sheet()?.querySelector('[aria-label="Fechar"]')?.click(); await sleep(400); };
await m.abrir("Alfa");
check("sem autor ou query nao ha atributos de destaque", !marcados(m).length && !apagados(m).length);
check("sem autor ou query nao ha aviso", !aviso(m));
check("sem autor aria original preservada", m.tile("s1-2")?.getAttribute("aria-label") === "Nº 2, possuída");
await fechar(m);
await escolher(m, "filtro-autor-series", "Mark Waid");
check("linha conta singular so das possuidas", linha(m)?.textContent.includes("1 edição de Mark Waid"));
await m.abrir("Alfa");
check("autor exato marca sua edicao", m.tile("s1-1")?.getAttribute("data-autor") === "true" && marcados(m).length === 1);
check("autor esmaece outra possuida", m.tile("s1-2")?.getAttribute("data-esmaecido") === "true");
check("autor esmaece faltante sem destaca-la", m.tile("s1-3")?.getAttribute("data-esmaecido") === "true" && !m.tile("s1-3")?.hasAttribute("data-autor"));
check("tile destacada nao esmaece", !m.tile("s1-1")?.hasAttribute("data-esmaecido"));
check("aviso nomeia autor", aviso(m)?.textContent.includes("Destacando as edições de Mark Waid"));
check("aria da destacada nomeia autor", m.tile("s1-1")?.getAttribute("aria-label") === "Nº 1, possuída, reimpressão, de Mark Waid");
check("aria da outra nao ganha autor", m.tile("s1-2")?.getAttribute("aria-label") === "Nº 2, possuída");
check("posse e contagem preservadas", m.tile("s1-1")?.dataset.owned === "true" && m.tile("s1-3")?.dataset.owned === "false" && m.sheet()?.textContent.includes("2 de 3 possuídas"));
m.tile("s1-2")?.focus();
m.tile("s1-2")?.click();
await sleep(100);
check("tile esmaecida continua focavel e selecionavel", m.window.document.activeElement === m.tile("s1-2") && m.tile("s1-2")?.getAttribute("aria-pressed") === "true");
[...m.sheet().querySelectorAll("button")].find((b) => b.textContent === "Tirar destaque")?.click();
await sleep(100);
check("Tirar destaque remove aviso e atributos", !aviso(m) && !marcados(m).length && !apagados(m).length);
check("Tirar destaque preserva filtro global", m.window.sessionStorage.getItem("longbox:filtro-autor") === "Mark Waid");
check("Tirar destaque restaura aria", !m.tile("s1-1")?.getAttribute("aria-label").includes(", de Mark Waid"));
await m.abrir("Alfa");
check("reabrir sheet restaura destaque", marcados(m).length === 1);
await fechar(m);
m.root.querySelector(".filtros-limpar")?.click();
await sleep(100);
const buscar = async (texto) => { const el = m.root.querySelector("#busca-acervo"); m.digitar(el, texto); await sleep(140); };
await buscar("wÁi");
await m.abrir("Alfa");
check("query parcial folded destaca autor possuido", m.tile("s1-1")?.getAttribute("data-autor") === "true" && marcados(m).length === 1);
check("query parcial nao destaca autor de faltante", !m.tile("s1-3")?.hasAttribute("data-autor") && apagados(m).length === 2);
check("aviso parcial usa texto da busca", aviso(m)?.textContent.includes('Destacando as edições de autores com "wÁi"'));
check("aria parcial nomeia o autor real", m.tile("s1-1")?.getAttribute("aria-label").endsWith(", de Mark Waid"));
await fechar(m);
await buscar("alfa");
await m.abrir("Alfa");
check("query de titulo sem autor nao esmaece", !aviso(m) && !marcados(m).length && !apagados(m).length);
await fechar(m);
await buscar("waid");
await escolher(m, "filtro-autor-series", "Mike Wieringo");
await m.abrir("Alfa");
check("filtroAutor tem prioridade sobre query", aviso(m)?.textContent.includes("Destacando as edições de Mike Wieringo") && m.tile("s1-1")?.getAttribute("aria-label").endsWith(", de Mike Wieringo"));
const p = await montar({}, true);
await escolher(p, "filtro-autor-series", "Mark Waid");
check("linha conta plural e papeis diferentes", linha(p)?.textContent.includes("2 edições de Mark Waid"));
await p.abrir("Alfa");
check("plural destaca ambas possuidas", marcados(p).length === 2 && apagados(p).length === 1);
await fechar(m);
await buscar("");
m.root.querySelectorAll(".segmented button")[0].click();
await sleep(120);
if (!m.root.querySelector("#filtro-personagem")) { m.root.querySelector(".btn-filtros").click(); await sleep(80); }
check("HQs identifica grade de tres campos", m.root.querySelector("#filtro-personagem")?.closest(".filtros-linha")?.getAttribute("data-campos") === "3");
check("sem erros nas montagens", !m.erros.length && !p.erros.length, m.erros[0] || p.erros[0]);
[m, p].forEach((x) => x.window.close());
console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
