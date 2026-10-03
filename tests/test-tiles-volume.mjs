import { JSDOM } from "jsdom";
import fs from "node:fs";

// v150: the volume sheet draws its séries tiles with the same rule as the série map
// (v143/v144): plain numbers share one width per block (--nd), a longer one (#1000000,
// 1/2, 23.1) spans two, and a long number alone in its block keeps its own width. The
// volume sheet had its own tile code and never got the rule: #1000000 wrapped in two lines.

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
  window.sessionStorage.setItem("longbox:aba", "volumes");
  window.sessionStorage.setItem("longbox:series-abertas", JSON.stringify(["Flash", "Demolidor"]));
  Object.entries(sessao).forEach(([k, v]) => window.sessionStorage.setItem(k, v));

  const serie = (id, nome, editora, personagem) => ({ id, nome, personagens: [{ nome: personagem, de: null, ate: null }], editora, anoInicio: "2000", anoFim: "2001", totalEdicoes: 2, ordem: null });
  const ed = (sid, numero, extra = {}) => ({ id: sid + "-" + numero, serieId: sid, numero, mes: "", ano: "", posicao: null, ...extra });
  const docs = new Map([
    ["library/volumes", { items: [
      { id: "v1", titulo: "Batman: Teste", personagem: "Batman", tipo: "Trade Paperback", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: ["s1-723", "s1-724", "s1-725", "s1-1000000", "s2-1/2"] },
    ] }],
    ["library/colecoes", { items: [] }],
    ["library/series", { items: [serie("s1", "Detective Comics (Volume 1)", "DC Comics", "Batman"), serie("s2", "Batman (Volume 2)", "DC Comics", "Batman")] }],
    ["library/cores", { mapa: {} }],
        ["edicoes/s1", { items: ["723", "724", "725", "1000000"].map((n) => ed("s1", n)) }],
    ["edicoes/s2", { items: [ed("s2", "1/2")] }],
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

const m = await montar();
[...m.root.querySelectorAll(".vol")].find((b) => b.textContent.includes("Batman: Teste"))?.click();
await sleep(300);
const sheet = [...m.root.querySelectorAll(".sheet")].find((s) => s.dataset.in === "true" && s.dataset.behind !== "true");
const blocos = sheet ? [...sheet.querySelectorAll(".tiles")] : [];
const bloco = (n) => blocos.find((b) => [...b.querySelectorAll(".tile")].some((t) => t.textContent.trim() === n));
const tile = (n) => blocos.flatMap((b) => [...b.querySelectorAll(".tile")]).find((t) => t.textContent.trim() === n);
check("a ficha do volume abriu com as séries", blocos.length === 2, blocos.length);
check("bloco do Detective com --nd de 3 dígitos", bloco("723")?.style.getPropertyValue("--nd") === "3", bloco("723")?.getAttribute("style"));
check("números comuns com a mesma largura", ["723", "724", "725"].every((n) => tile(n)?.dataset.forma === "comum"));
check("#1000000 ocupa dois quadrados", tile("1000000")?.dataset.forma === "largo", tile("1000000")?.outerHTML);
check("1/2 sozinho no bloco fica com a largura própria", tile("1/2") && tile("1/2").dataset.forma === undefined, tile("1/2")?.outerHTML);
check("sem erros", m.erros.length === 0, m.erros[0]);

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
