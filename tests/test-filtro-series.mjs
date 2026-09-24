import { JSDOM } from "jsdom";
import fs from "node:fs";

// v93: the séries tab's character filter and the per-row search. A série with two
// characters sits in both groups; searching "batman" used to keep the série and show
// it in every group, so the Batgirl group came along. Now a row stays only when the
// série's name or that row's own character matches. The filter narrows the tab to one
// group (search then looks at names only), restricts the séries part of the search
// suggestions to that character, leaves the HQs part alone, and lasts the session.

const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0;
let passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function montar(sessao = {}) {
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
  Object.entries(sessao).forEach(([k, v]) => window.sessionStorage.setItem(k, v));
  const serie = (id, nome, personagens) => ({ id, nome, personagens, editora: "DC Comics", anoInicio: "1990", anoFim: "", totalEdicoes: 1, ordem: null });
  const docs = new Map([
    ["library/volumes", { items: [{ id: "v1", titulo: "Batman: Ano Um", personagem: "Batman", tipo: "Trade Paperback", editora: "DC Comics", ano: "1987", status: "nao_lida", notas: "", edicoesColetadasIds: [] }] }],
    ["library/colecoes", { items: [] }],
    ["library/series", { items: [
      serie("s1", "Batman (Volume 1)", [{ nome: "Batman", de: null, ate: null }]),
      serie("s2", "The Killing Joke", [{ nome: "Batman", de: null, ate: null }, { nome: "Batgirl", de: null, ate: null }]),
      serie("s3", "Batgirl (2011)", [{ nome: "Batgirl", de: null, ate: null }]),
      serie("s4", "Especial Avulso", []),
    ] }],
    ["library/cores", { mapa: {} }],
  ]);
  const makeDoc = (path) => ({
    path,
    get: async () => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path), metadata: {} }),
    set: async (body) => { docs.set(path, JSON.parse(JSON.stringify(body))); }, delete: async () => { docs.delete(path); },
  });
  window.claude = { use: async (n) => (n === "db" ? { doc: makeDoc, collection: (c) => ({ doc: (id) => makeDoc(c + "/" + id), get: async () => ({ docs: [], size: 0, empty: true, docChanges: () => [], metadata: {} }) }) } : null) };
  window.eval(bundle);
  await sleep(450);
  const root = window.document.getElementById("root");
  const setValor = async (el, valor) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, valor);
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
    await sleep(120);
  };
  const aba = () => root.querySelector('.aba[data-ativa="true"]');
  const nomesGrupos = () => [...aba().querySelectorAll("section.group .group-head h2")].map((h) => h.textContent);
  const linhas = () => aba().querySelectorAll("section.group .serie-row").length;
  const busca = () => root.querySelector("#busca-acervo");
  const botao = () => root.querySelector(".btn-filtros");
  return { window, root, erros, setValor, aba, nomesGrupos, linhas, busca, botao };
}

const abrirPainel = async (m) => {
  if (!m.root.querySelector("#filtro-personagem-series")) { m.botao().click(); await sleep(80); }
  return m.root.querySelector("#filtro-personagem-series");
};
const escolher = async (m, nome) => {
  const campo = await abrirPainel(m);
  campo.focus();
  await sleep(60);
  const op = [...m.root.querySelectorAll("#filtro-personagem-series-lista [role=option]")]
    .find((o) => o.querySelector(".sug-title").textContent === nome);
  op.click();
  await sleep(120);
};
const secoes = (m) => [...m.root.querySelectorAll("#busca-sugestoes .sug-secao")].map((p) => p.textContent);
const titulosSug = (m) => [...m.root.querySelectorAll("#busca-sugestoes .sug-row .sug-title")].map((t) => t.textContent);

console.log("=== busca por linha, sem filtro ===");
const m = await montar();
check("começa com todos os grupos", m.nomesGrupos().join(",") === "(sem personagem),Batgirl,Batman", m.nomesGrupos().join(","));
await m.setValor(m.busca(), "batman");
check("\"batman\" mostra só o grupo Batman", m.nomesGrupos().join(",") === "Batman", m.nomesGrupos().join(","));
check("com as duas séries do Batman", m.linhas() === 2, m.linhas());
await m.setValor(m.busca(), "killing");
check("nome da série casa: aparece nos dois grupos", m.nomesGrupos().join(",") === "Batgirl,Batman", m.nomesGrupos().join(","));
await m.setValor(m.busca(), "");

console.log("=== filtro de personagem ===");
check("botão de filtros existe na aba Séries", !!m.botao());
check("sem contagem sem filtro", !m.botao().querySelector(".btn-badge"));
const campo = await abrirPainel(m);
check("painel traz o campo de personagem", !!campo && campo.getAttribute("role") === "combobox");
campo.focus();
await sleep(60);
const ops = [...m.root.querySelectorAll("#filtro-personagem-series-lista [role=option]")].map((o) => o.querySelector(".sug-title").textContent + "=" + (o.querySelector(".pfiltro-n")?.textContent || ""));
check("opções com contagem de séries, incluindo sem personagem", ops.join(",") === "Todos os personagens=,(sem personagem)=1,Batgirl=2,Batman=2", ops.join(","));
await escolher(m, "Batman");
check("só o grupo Batman", m.nomesGrupos().join(",") === "Batman", m.nomesGrupos().join(","));
check("grupo aberto com as duas séries", m.linhas() === 2, m.linhas());
check("sem Mostrar/Esconder todas", !m.aba().querySelector(".fold-all"));
check("botão conta 1 filtro", m.botao().querySelector(".btn-badge")?.textContent === "1");
check("guardado na sessão", m.window.sessionStorage.getItem("longbox:filtro-series") === "Batman");
check("contador diz 2 séries", m.root.querySelector(".ed-note")?.textContent === "2 séries", m.root.querySelector(".ed-note")?.textContent);

// v94: with the fold button hidden under the filter, Q leaves the one group alone.
const qFiltro = new m.window.KeyboardEvent("keydown", { key: "q", bubbles: true, cancelable: true });
m.window.document.body.dispatchEvent(qFiltro);
await sleep(120);
check("com filtro, Q não fecha o grupo", m.linhas() === 2 && !qFiltro.defaultPrevented, m.linhas());

console.log("=== busca com filtro ===");
await m.setValor(m.busca(), "batgirl");
check("com filtro, a busca olha só o nome: Batgirl não traz nada", m.nomesGrupos().length === 0, m.nomesGrupos().join(","));
await m.setValor(m.busca(), "joke");
check("\"joke\" acha The Killing Joke só no grupo Batman", m.nomesGrupos().join(",") === "Batman" && m.linhas() === 1, m.nomesGrupos().join(",") + " " + m.linhas());
m.busca().focus();
await m.setValor(m.busca(), "bat");
check("sugestões: seção de séries marca o filtro", secoes(m)[0] === "Séries · Batman", secoes(m).join(" | "));
check("sugestões: só séries do Batman", !titulosSug(m).includes("Batgirl (2011)") && titulosSug(m).includes("Batman (Volume 1)"), titulosSug(m).join(" | "));
check("sugestões: HQs continuam", secoes(m).includes("HQs") && titulosSug(m).includes("Batman: Ano Um"), secoes(m).join(" | "));
await m.setValor(m.busca(), "");

console.log("=== abas separadas ===");
m.root.querySelectorAll(".segmented button")[0].click();
await sleep(200);
check("na aba HQs o botão não conta o filtro de Séries", !m.botao().querySelector(".btn-badge"));
m.root.querySelectorAll(".segmented button")[2].click();
await sleep(200);
check("de volta em Séries, o filtro continua", m.nomesGrupos().join(",") === "Batman", m.nomesGrupos().join(","));

console.log("=== limpar ===");
await abrirPainel(m);
m.root.querySelector(".filtros-limpar").click();
await sleep(120);
check("Limpar volta todos os grupos", m.nomesGrupos().join(",") === "(sem personagem),Batgirl,Batman", m.nomesGrupos().join(","));
check("e esquece da sessão", m.window.sessionStorage.getItem("longbox:filtro-series") === null);

console.log("=== recarregar ===");
const r = await montar({ "longbox:filtro-series": "Batgirl" });
check("recarregar mantém o filtro", r.nomesGrupos().join(",") === "Batgirl", r.nomesGrupos().join(","));
const n = await montar({ "longbox:filtro-series": "Ninguém" });
check("personagem que não existe mais é solto", n.nomesGrupos().length === 3 && n.window.sessionStorage.getItem("longbox:filtro-series") === null, n.nomesGrupos().join(","));

check("sem erros", m.erros.length === 0 && r.erros.length === 0 && n.erros.length === 0, m.erros[0] || r.erros[0] || n.erros[0]);
console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
