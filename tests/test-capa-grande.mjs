import { JSDOM } from "jsdom";
import fs from "node:fs";

// v105: the full-size cover (hub suggestion, volume sheet) only paints a picture that
// belongs to the volume on screen. Rerolling the hub suggestion used to keep the
// previous book's cover under the new title until the new file had downloaded.

const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0, passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.test/" });
const { window } = dom;
const erros = [];
window.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el }]); } unobserve() {} disconnect() {} };
window.scrollTo = () => {};
window.matchMedia = (q) => ({ matches: q.includes("pointer: fine"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
window.addEventListener("error", (e) => erros.push(e.error?.stack || e.message));
window.console.error = (...a) => erros.push(a.join(" "));
window.sessionStorage.setItem("longbox:aba", "hub");
// Every full cover takes 300ms to "download and decode".
window.Image = class { set src(v) { this._s = v; } get src() { return this._s; } decode() { return new Promise((r) => setTimeout(r, 300)); } };
const vols = Array.from({ length: 8 }, (_, i) => ({ id: "v" + i, titulo: "Livro " + i, personagem: "Batman", tipo: "Trade Paperback", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: [], capaAssetId: ("c" + i).padEnd(32, "0") }));
const docs = new Map([["library/volumes", { items: vols }], ["library/colecoes", { items: [] }], ["library/series", { items: [] }], ["library/cores", { mapa: {} }]]);
const makeDoc = (path) => ({ path, get: async () => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path), metadata: {} }), set: async (b) => { docs.set(path, b); }, delete: async () => { docs.delete(path); } });
window.claude = { use: async (n) => (n === "db" ? { doc: makeDoc, collection: (c) => ({ doc: (id) => makeDoc(c + "/" + id), get: async () => ({ docs: [], size: 0, empty: true, docChanges: () => [], metadata: {} }) }) } : null) };
window.eval(bundle);
await sleep(450);
const root = window.document.getElementById("root");
const porTitulo = Object.fromEntries(vols.map((v) => [v.titulo, v.capaAssetId]));
let erradas = 0, amostras = 0;
const olhar = () => {
  const t = root.querySelector(".suggest-title")?.textContent, img = root.querySelector(".suggest-cover img");
  amostras++;
  if (img && img.dataset.capa !== porTitulo[t]) erradas++;
};
const iv = setInterval(olhar, 20);

console.log("=== capa grande do hub ===");
await sleep(400);
const titulo0 = root.querySelector(".suggest-title")?.textContent;
check("a capa aparece depois de pronta", root.querySelector(".suggest-cover img")?.dataset.capa === porTitulo[titulo0]);
const outro = () => [...root.querySelectorAll(".suggest-actions button")].find((b) => /Outro/.test(b.textContent)).click();
for (let i = 0; i < 5; i++) { outro(); await sleep(120); }
await sleep(20);
const tituloN = root.querySelector(".suggest-title")?.textContent;
check("trocando rápido, a capa anterior some junto com o título", !root.querySelector(".suggest-cover img") || root.querySelector(".suggest-cover img").dataset.capa === porTitulo[tituloN]);
await sleep(400);
check("a nova capa entra quando fica pronta", root.querySelector(".suggest-cover img")?.dataset.capa === porTitulo[tituloN]);
clearInterval(iv);
check("em nenhum momento a capa foi de outro livro", erradas === 0 && amostras > 20, erradas + " de " + amostras);
check("sem erros", erros.length === 0, erros[0]);

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
