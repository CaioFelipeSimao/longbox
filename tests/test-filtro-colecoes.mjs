import { JSDOM } from "jsdom";
import fs from "node:fs";

// v165: the Coleções tab's character filter. A collection belongs to every character
// any of its volumes has (user's choice: a crossover saga shows under each), only
// within the publisher band; the filter lasts the session and counts on the button.

const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0;
let passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function montar(editoraSel = null) {
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
  window.sessionStorage.setItem("longbox:aba", "colecoes");
  const vol = (id, personagem, editora) => ({ id, titulo: "T " + id, personagem, tipo: "Trade Paperback", editora, ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: [] });
  const docs = new Map([
    ["library/volumes", { items: [vol("b1", "Batman", "DC Comics"), vol("f1", "Flash", "DC Comics"), vol("s1", "Homem-Aranha", "Marvel Comics")] }],
    ["library/colecoes", { items: [
      { id: "c1", nome: "Batman Saga", membros: ["b1"] },
      { id: "c2", nome: "Crossover", membros: ["b1", "f1", "s1"] },
      { id: "c3", nome: "Aranha Saga", membros: ["s1"] },
    ] }],
    ["library/series", { items: [] }],
    ["library/cores", { mapa: {} }],
    ["library/editoras", { itens: [{ id: "dc", nome: "DC Comics" }, { id: "mv", nome: "Marvel Comics" }], selecionada: editoraSel }],
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
  const aba = () => root.querySelector('.aba[data-ativa="true"]');
  const nomes = () => [...aba().querySelectorAll("section.coll .coll-head h2")].map((h) => h.textContent).filter((t, i, a) => a.indexOf(t) === i);
  const botao = () => root.querySelector(".btn-filtros");
  return { window, root, erros, aba, nomes, botao };
}

const abrir = async (m) => {
  if (!m.root.querySelector("#filtro-personagem-colecoes")) { m.botao()?.click(); await sleep(80); }
  const campo = m.root.querySelector("#filtro-personagem-colecoes");
  campo?.focus();
  await sleep(60);
  return [...m.root.querySelectorAll("#filtro-personagem-colecoes-lista [role=option]")];
};
const rotulos = (ops) => ops.map((o) => o.querySelector(".sug-title").textContent + "=" + (o.querySelector(".pfiltro-n")?.textContent || ""));

console.log("=== todas as editoras ===");
const m = await montar();
check("botão de filtros existe na aba Coleções", !!m.botao());
check("começa com as três coleções", m.nomes().join(",") === "Aranha Saga,Batman Saga,Crossover", m.nomes().join(","));
let ops = await abrir(m);
check("personagens de todos os volumes, com contagem", rotulos(ops).join(",") === "Todos os personagens=,Batman=2,Flash=1,Homem-Aranha=2", rotulos(ops).join(","));
ops.find((o) => o.querySelector(".sug-title").textContent === "Flash")?.click();
await sleep(150);
check("Flash: só o crossover (qualquer volume conta)", m.nomes().join(",") === "Crossover", m.nomes().join(","));
check("botão conta 1 filtro", m.botao().querySelector(".btn-badge")?.textContent === "1");
check("guardado na sessão", m.window.sessionStorage.getItem("longbox:filtro-colecoes") === "Flash");
check("sem erros", m.erros.length === 0, m.erros[0]);

console.log("=== faixa DC ===");
const d = await montar("dc");
ops = await abrir(d);
check("só personagens da DC", rotulos(ops).join(",") === "Todos os personagens=,Batman=2,Flash=1", rotulos(ops).join(","));
check("sem erros (DC)", d.erros.length === 0, d.erros[0]);

console.log(falhas ? `${falhas} falharam, ${passes} passaram` : `Tudo certo: ${passes} passaram`);
process.exit(falhas ? 1 : 0);
