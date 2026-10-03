import { JSDOM } from "jsdom";
import fs from "node:fs";

// v149: the publisher band now narrows the author filter (counted by série, like the
// character filter) and the search. When the search finds nothing in the band but does
// elsewhere, it says so and offers "Ver em todas as editoras". A saved author filter
// survives a casing/accent variant of the name.

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
  window.sessionStorage.setItem("longbox:series-abertas", JSON.stringify(["Flash", "Demolidor"]));
  Object.entries(sessao).forEach(([k, v]) => window.sessionStorage.setItem(k, v));

  const serie = (id, nome, editora, personagem) => ({ id, nome, personagens: [{ nome: personagem, de: null, ate: null }], editora, anoInicio: "2000", anoFim: "2001", totalEdicoes: 2, ordem: null });
  const ed = (sid, numero, extra = {}) => ({ id: sid + "-" + numero, serieId: sid, numero, mes: "", ano: "", posicao: null, ...extra });
  const docs = new Map([
    ["library/volumes", { items: [
      { id: "v1", titulo: "Alfa vol 1", personagem: "Flash", tipo: "Trade Paperback", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: ["s1-1"] },
      { id: "v2", titulo: "Beta vol 1", personagem: "Demolidor", tipo: "Trade Paperback", editora: "Marvel", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: ["s2-1", "s2-2"] },
    ] }],
    ["library/colecoes", { items: [] }],
    ["library/series", { items: [serie("s1", "Alfa", "DC Comics", "Flash"), serie("s2", "Beta", "Marvel", "Demolidor")] }],
    ["library/cores", { mapa: {} }],
    ["library/editoras", { itens: [
      { id: "dc-comics", nome: "DC Comics", cor: null, logoAssetId: null, logoFundo: "nenhum" },
      { id: "marvel", nome: "Marvel", cor: null, logoAssetId: null, logoFundo: "nenhum" },
    ], selecionada: "marvel" }],
    ["edicoes/s1", { items: [ed("s1", "1", { autores: { writer: ["Mark Waid"] } }), ed("s1", "2")] }],
    ["edicoes/s2", { items: [ed("s2", "1", { autores: { writer: ["Mark Waid", "Brian Bendis"] } }), ed("s2", "2", { autores: { writer: ["Brian Bendis"] } })] }],
  ]);
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
  const digitar = (el, v) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, v);
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  };
  return { root, erros, window, digitar, docs };
}

const linhas = (m) => [...m.root.querySelectorAll('.aba[data-ativa="true"] .serie-row')].map((r) => r.textContent);
const abrirPainel = async (m) => {
  if (!m.root.querySelector("#filtro-personagem-series")) { m.root.querySelector(".btn-filtros").click(); await sleep(80); }
};

console.log("=== filtro de autor segue a editora ===");
const m = await montar();
check("com Marvel no topo só a série da Marvel", linhas(m).length === 1 && linhas(m)[0].includes("Beta"), linhas(m));
await abrirPainel(m);
m.root.querySelector("#filtro-autor-series")?.focus();
await sleep(60);
const opcoes = [...m.root.querySelectorAll("#filtro-autor-series-lista [role=option]")]
  .map((o) => o.querySelector(".sug-title").textContent + "=" + (o.querySelector(".pfiltro-n")?.textContent || "")).join("|");
check("autores só da Marvel, contados por série", opcoes === "Todos os autores=|Brian Bendis=1|Mark Waid=1", opcoes);
m.root.querySelector("#filtro-autor-series")?.blur();

console.log("=== busca segue a editora, com aviso ===");
const busca = () => m.root.querySelector("#busca-acervo");
busca()?.focus();
m.digitar(busca(), "alfa");
await sleep(200);
check("busca por série da DC não mostra nada na Marvel", linhas(m).length === 0, linhas(m));
const sugeridas = [...m.root.querySelectorAll("#busca-sugestoes .sug-row")].map((s) => s.textContent);
check("sugestões também seguem a editora", !sugeridas.some((s) => s.includes("Alfa")), sugeridas);
const corpo = () => m.root.textContent.replace(/\s+/g, " ");
check("aviso de resultado em outras editoras", /Nada em Marvel\. 1 resultado em outras editoras\./.test(corpo()), corpo().slice(0, 400));
const ver = () => [...m.root.querySelectorAll("button")].find((b) => b.textContent.trim() === "Ver em todas as editoras");
check("botão para ver em todas as editoras", !!ver());
ver()?.click();
await sleep(200);
check("depois do botão, a série da DC aparece", linhas(m).some((l) => l.includes("Alfa")), linhas(m));
m.digitar(busca(), "beta");
await sleep(200);
check("sem aviso quando acha", !/Nada em/.test(corpo()));

console.log("=== autor salvo com outra grafia ===");
const r = await montar({ "longbox:filtro-autor": "BRIAN BÉNDIS" });
await sleep(200);
check("filtro salvo com outra grafia não se solta", r.window.sessionStorage.getItem("longbox:filtro-autor") === "BRIAN BÉNDIS" && linhas(r).length === 1, JSON.stringify([r.window.sessionStorage.getItem("longbox:filtro-autor"), linhas(r)]));
check("sem erros", m.erros.length === 0 && r.erros.length === 0, m.erros[0] || r.erros[0]);

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
