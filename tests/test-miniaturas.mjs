import { JSDOM } from "jsdom";
import fs from "node:fs";

// v123: shelf thumbnails shared through the asset store. A device with no
// thumbnail of its own (a new phone, or Safari after it cleared the site's
// storage) used to download every full cover, ~760 KB on average, to make its
// own. Now the first device to make one uploads it and records it on the
// volume as { capa, id }; the others draw that small file directly. A record
// made for a different cover (the cover was swapped) is ignored.

const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0, passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const id32 = (s) => s.padEnd(32, "0");

const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.test/" });
const { window } = dom;
const erros = [];
window.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el }]); } unobserve() {} disconnect() {} };
window.scrollTo = () => {};
window.matchMedia = (q) => ({ matches: q.includes("pointer: fine"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
window.addEventListener("error", (e) => erros.push(e.error?.stack || e.message));
window.console.error = (...a) => erros.push(a.join(" "));
window.sessionStorage.setItem("longbox:aba", "hqs");

// A browser that can make thumbnails. Every full-cover download is counted.
// Like the real artifact frame (v124, measured with a probe page), fetch() of a
// blob: URL is refused there, so a thumbnail already on the device must be
// uploaded from the Blob itself.
const baixadas = [];
window.fetch = async (url) => {
  if (String(url).startsWith("blob:")) throw new TypeError("Failed to fetch");
  baixadas.push(String(url));
  return { ok: true, blob: async () => new window.Blob(["capa"], { type: "image/jpeg" }) };
};
// Just enough IndexedDB for capas.js, seeded with a thumbnail this device already
// made for c4 (a cover with no shared one yet).
const idb = new Map([[id32("c4"), { blob: new window.Blob(["mini-local"], { type: "image/jpeg" }), largura: 360, formato: "image/jpeg" }]]);
const pedido = (fn) => { const q = {}; setTimeout(() => { q.result = fn(); q.onsuccess && q.onsuccess(); }, 0); return q; };
const loja = {
  openCursor() {
    const q = {}; const itens = [...idb.entries()]; let i = 0;
    const passo = () => setTimeout(() => { q.result = i < itens.length ? { key: itens[i][0], value: itens[i][1], continue() { i++; passo(); } } : null; q.onsuccess && q.onsuccess(); }, 0);
    passo(); return q;
  },
  put(v, k) { idb.set(k, v); return pedido(() => k); },
  getAllKeys() { return pedido(() => [...idb.keys()]); },
  delete(k) { idb.delete(k); return pedido(() => undefined); },
};
window.indexedDB = { open() { return pedido(() => ({ transaction: () => ({ objectStore: () => loja }) })); } };
window.createImageBitmap = async () => ({ width: 968, height: 1500, close() {} });
window.OffscreenCanvas = class { getContext() { return { drawImage() {} }; } async convertToBlob(o) { return new window.Blob(["mini"], { type: o.type }); } };
let nBlob = 0;
window.URL.createObjectURL = () => "blob:local/" + (nBlob++);
const enviados = [];

const vols = [
  { id: "v0", titulo: "Livro 0", capaAssetId: id32("c0"), mini: { capa: id32("c0"), id: id32("m0") } },
  { id: "v1", titulo: "Livro 1", capaAssetId: id32("c1"), mini: { capa: id32("cvelha"), id: id32("mvelha") } },
  { id: "v2", titulo: "Livro 2", capaAssetId: id32("c2") },
  { id: "v3", titulo: "Livro 3", capaAssetId: id32("c2") },
  { id: "v4", titulo: "Livro 4", capaAssetId: id32("c4") },
].map((v) => ({ personagem: "Batman", tipo: "Trade Paperback", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: [], ...v }));
const docs = new Map([["library/volumes", { items: vols }], ["library/colecoes", { items: [] }], ["library/series", { items: [] }], ["library/cores", { mapa: {} }]]);
const makeDoc = (path) => ({ path, get: async () => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path), metadata: {} }), set: async (b) => { docs.set(path, JSON.parse(JSON.stringify(b))); }, delete: async () => { docs.delete(path); } });
const db = { doc: makeDoc, collection: (c) => ({ doc: (id) => makeDoc(c + "/" + id), get: async () => ({ docs: [], size: 0, empty: true, docChanges: () => [], metadata: {} }) }) };
const assets = { upload: async (file, o) => { enviados.push(o && o.type); const id = id32("u" + enviados.length); return { id, url: "/_blob/" + id }; } };
window.claude = { use: async (n) => (n === "db" ? db : n === "assets" ? assets : null) };
window.eval(bundle);
const root = window.document.getElementById("root");
// The shelf appears once the library and the local thumbnails are read.
for (let i = 0; i < 100 && !root.querySelector('img[loading][alt="Capa de Livro 0"]'); i++) await sleep(20);
const src = (t) => root.querySelector('img[loading][alt="Capa de ' + t + '"]')?.getAttribute("src");

console.log("=== miniaturas compartilhadas ===");
check("com miniatura registrada, a estante usa ela e não a capa cheia", src("Livro 0") === "/_blob/" + id32("m0"), src("Livro 0"));
check("miniatura registrada para outra capa é ignorada", src("Livro 1") !== "/_blob/" + id32("mvelha"), src("Livro 1"));
check("miniatura remota não força download antecipado", root.querySelector('img[loading][alt="Capa de Livro 0"]')?.getAttribute("loading") === "lazy", root.querySelector('img[loading][alt="Capa de Livro 0"]')?.getAttribute("loading"));

// v124: the page is hidden (phone locked) while the batch still waits its 3 s:
// the records must reach the library at once, not when the page wakes.
for (let i = 0; i < 100 && enviados.length < 3; i++) await sleep(50);
// Meanwhile another device edits a volume, so the batch save has to merge.
docs.set("library/volumes", { items: docs.get("library/volumes").items.map((v) => (v.id === "v0" ? { ...v, notas: "de outro aparelho" } : v)) });
Object.defineProperty(window.document, "visibilityState", { value: "hidden", configurable: true });
window.document.dispatchEvent(new window.Event("visibilitychange"));
await sleep(200);
check("ao ocultar a página, o lote é gravado na hora", (docs.get("library/volumes").items.filter((v) => v.mini).length) === 5, docs.get("library/volumes").items.filter((v) => v.mini).length);
Object.defineProperty(window.document, "visibilityState", { value: "visible", configurable: true });
await sleep(4000);
const salvos = Object.fromEntries(docs.get("library/volumes").items.map((v) => [v.id, v.mini]));
check("a capa que já tinha miniatura não é baixada de novo", !baixadas.some((u) => u.includes(id32("c0"))), baixadas.join(" "));
check("uma capa usada por dois volumes sobe uma vez só", enviados.length === 3, enviados.length);
check("miniatura que já estava no aparelho sobe sem baixar a capa cheia", salvos.v4 && salvos.v4.capa === id32("c4") && !baixadas.some((u) => u.includes(id32("c4"))), JSON.stringify(salvos.v4));
check("sobe como JPEG", enviados.every((t) => t === "image/jpeg"), enviados.join(","));
check("capa trocada ganha miniatura nova", salvos.v1 && salvos.v1.capa === id32("c1") && salvos.v1.id !== id32("mvelha"), JSON.stringify(salvos.v1));
check("volume sem miniatura ganha uma", salvos.v2 && salvos.v2.capa === id32("c2"), JSON.stringify(salvos.v2));
check("os dois volumes da mesma capa apontam para a mesma miniatura", salvos.v3 && salvos.v2 && salvos.v3.id === salvos.v2.id);
check("o registro existente fica como estava", salvos.v0 && salvos.v0.id === id32("m0"));
check("a edição do outro aparelho sobrevive à mescla", docs.get("library/volumes").items.find((v) => v.id === "v0").notas === "de outro aparelho");
// v125: a save that merged schedules a follow-up with nothing left to write; the
// indicator used to stay on "Salvando…" for good.
check("o aviso não fica preso em Salvando", root.querySelector(".salvamento")?.dataset.estado !== "salvando", root.querySelector(".salvamento")?.dataset.estado);
check("sem erros", erros.length === 0, erros[0]);

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
