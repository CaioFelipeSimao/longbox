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
const baixadas = [];
window.fetch = async (url) => { baixadas.push(String(url)); return { ok: true, blob: async () => new window.Blob(["capa"], { type: "image/jpeg" }) }; };
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
].map((v) => ({ personagem: "Batman", tipo: "Trade Paperback", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: [], ...v }));
const docs = new Map([["library/volumes", { items: vols }], ["library/colecoes", { items: [] }], ["library/series", { items: [] }], ["library/cores", { mapa: {} }]]);
const makeDoc = (path) => ({ path, get: async () => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path), metadata: {} }), set: async (b) => { docs.set(path, JSON.parse(JSON.stringify(b))); }, delete: async () => { docs.delete(path); } });
const db = { doc: makeDoc, collection: (c) => ({ doc: (id) => makeDoc(c + "/" + id), get: async () => ({ docs: [], size: 0, empty: true, docChanges: () => [], metadata: {} }) }) };
const assets = { upload: async (file, o) => { enviados.push(o && o.type); const id = id32("u" + enviados.length); return { id, url: "/_blob/" + id }; } };
window.claude = { use: async (n) => (n === "db" ? db : n === "assets" ? assets : null) };
window.eval(bundle);
await sleep(450);
const root = window.document.getElementById("root");
const src = (t) => root.querySelector('img[alt="Capa de ' + t + '"]')?.getAttribute("src");

console.log("=== miniaturas compartilhadas ===");
check("com miniatura registrada, a estante usa ela e não a capa cheia", src("Livro 0") === "/_blob/" + id32("m0"), src("Livro 0"));
check("miniatura registrada para outra capa é ignorada", src("Livro 1") !== "/_blob/" + id32("mvelha"), src("Livro 1"));
check("miniatura remota não força download antecipado", root.querySelector('img[alt="Capa de Livro 0"]')?.getAttribute("loading") === "lazy");

await sleep(6000);
const salvos = Object.fromEntries(docs.get("library/volumes").items.map((v) => [v.id, v.mini]));
check("a capa que já tinha miniatura não é baixada de novo", !baixadas.some((u) => u.includes(id32("c0"))), baixadas.join(" "));
check("uma capa usada por dois volumes sobe uma vez só", enviados.length === 2, enviados.length);
check("sobe como JPEG", enviados.every((t) => t === "image/jpeg"), enviados.join(","));
check("capa trocada ganha miniatura nova", salvos.v1 && salvos.v1.capa === id32("c1") && salvos.v1.id !== id32("mvelha"), JSON.stringify(salvos.v1));
check("volume sem miniatura ganha uma", salvos.v2 && salvos.v2.capa === id32("c2"), JSON.stringify(salvos.v2));
check("os dois volumes da mesma capa apontam para a mesma miniatura", salvos.v3 && salvos.v2 && salvos.v3.id === salvos.v2.id);
check("o registro existente fica como estava", salvos.v0 && salvos.v0.id === id32("m0"));
check("sem erros", erros.length === 0, erros[0]);

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
