import { JSDOM } from "jsdom";
import fs from "node:fs";

// v179: reloading while the wishlist is open must keep it open, like the hub.
// A reload keeps sessionStorage, so the second mount is given the first one's note.

const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0;
const check = (nome, ok, info) => {
  if (!ok) falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function montar(sessao = {}) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
    runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.test/",
  });
  const { window } = dom;
  window.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el }]); } unobserve() {} disconnect() {} };
  window.scrollTo = () => {};
  window.matchMedia = (q) => ({ matches: q.includes("pointer: fine"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  for (const [k, v] of Object.entries(sessao)) window.sessionStorage.setItem(k, v);
  const docs = new Map([
    ["library/volumes", { items: [] }], ["library/colecoes", { items: [] }], ["library/series", { items: [] }],
    ["library/cores", { mapa: {} }], ["library/editoras", { itens: [{ id: "ed-dc", nome: "DC Comics", customOculta: false }], selecionada: "__todas__" }],
  ]);
  const makeDoc = (path) => ({
    path,
    get: async () => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path), metadata: { fromCache: false, hasPendingWrites: false } }),
    set: async (body) => { docs.set(path, body); },
    delete: async () => { docs.delete(path); },
  });
  window.claude = { use: async (n) => n === "db" ? { doc: makeDoc, collection: (c) => ({ path: c, doc: (id) => makeDoc(c + "/" + id), get: async () => ({ docs: [], size: 0, empty: true, docChanges: () => [], metadata: {} }) }) } : null };
  window.eval(bundle);
  await sleep(400);
  return { window, root: window.document.getElementById("root") };
}

const a = await montar({ "longbox:aba": "volumes" });
check("sem nota, a lista de desejos começa fechada", !a.root.querySelector(".desejos-capa"));
a.root.querySelector(".btn-desejos").click();
await sleep(100);
check("clicar no carrinho abre a lista", !!a.root.querySelector(".desejos-capa"));
const nota = a.window.sessionStorage.getItem("longbox:desejos-aberto");
check("abrir grava a nota", nota === "1", nota);

const b = await montar({ "longbox:aba": "volumes", "longbox:desejos-aberto": nota });
check("recarregar com a nota mantém a lista aberta", !!b.root.querySelector(".desejos-capa"));
b.root.querySelector(".btn-desejos").click();
await sleep(100);
check("fechar grava 0 e a lista some", !b.root.querySelector(".desejos-capa") && b.window.sessionStorage.getItem("longbox:desejos-aberto") === "0");

console.log(falhas ? "FALHOU: " + falhas : "OK");
process.exit(falhas ? 1 : 0);
