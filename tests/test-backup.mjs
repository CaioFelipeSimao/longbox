import { JSDOM } from "jsdom";
import fs from "node:fs";

// v88: the hub's footer says how long ago the library was last backed up. The date
// lives in its own db document (library/meta), not in the library, so it is shared
// by both devices, never travels inside a backup file and is untouched by undo.
// It is written only when an export actually succeeds. Past 30 days, or with no
// backup at all, the line stands out and offers "Fazer backup agora".

const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0;
let passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const diasAtras = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };

async function montar({ meta, semDb = false, recusar = false } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
    runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.test/",
  });
  const { window } = dom;
  const erros = [];
  const salvos = [];
  window.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el }]); } unobserve() {} disconnect() {} };
  window.scrollTo = () => {};
  window.matchMedia = (q) => ({ matches: q.includes("pointer: fine"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  window.addEventListener("error", (e) => erros.push(e.error?.stack || e.message));
  window.console.error = (...a) => erros.push(a.join(" "));

  const docs = new Map([
    ["library/volumes", { items: [{ id: "v1", titulo: "Batman vol 1", personagem: "Batman", tipo: "Trade Paperback", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: [] }] }],
    ["library/colecoes", { items: [] }],
    ["library/series", { items: [] }],
    ["library/cores", { mapa: {} }],
  ]);
  if (meta) docs.set("library/meta", meta);
  const makeDoc = (path) => ({
    path,
    get: async () => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path), metadata: { fromCache: false, hasPendingWrites: false } }),
    set: async (body) => { docs.set(path, JSON.parse(JSON.stringify(body))); },
    delete: async () => { docs.delete(path); },
  });
  const colecao = (cpath) => ({
    path: cpath,
    doc: (id) => makeDoc(cpath + "/" + id),
    get: async () => ({ docs: [], size: 0, empty: true, docChanges: () => [], metadata: {} }),
  });
  const downloads = {
    save: async (arq) => {
      if (recusar) { const e = new Error("declined"); e.code = "declined"; throw e; }
      salvos.push(arq.filename);
    },
  };
  window.claude = {
    use: async (name) => {
      if (name === "db") return semDb ? null : { doc: makeDoc, collection: colecao };
      if (name === "downloads") return downloads;
      return null;
    },
  };
  window.eval(bundle);
  await sleep(450);
  const root = window.document.getElementById("root");
  const linha = () => root.querySelector(".hub-backup");
  const botaoAgora = () => linha() && [...linha().querySelectorAll("button")].find((b) => b.textContent.trim() === "Fazer backup agora");
  return { root, erros, docs, salvos, linha, botaoAgora };
}

console.log("=== nunca houve backup ===");
const a = await montar();
check("a linha aparece no hub", !!a.linha());
check("diz que nunca houve backup", /Nenhum backup/.test(a.linha()?.textContent || ""), a.linha()?.textContent);
check("fica em destaque", a.linha()?.dataset.atencao === "true");
check("oferece fazer agora", !!a.botaoAgora());
a.botaoAgora()?.click();
await sleep(200);
check("o botão exporta o backup", a.salvos[0] === "longbox.json", a.salvos[0]);
const gravado = a.docs.get("library/meta");
check("grava a data no banco", !!gravado && new Date(gravado.ultimoBackup).toDateString() === new Date().toDateString(), JSON.stringify(gravado));
check("a linha passa a dizer hoje", /Último backup hoje/.test(a.linha()?.textContent || ""), a.linha()?.textContent);
check("e sai do destaque", a.linha()?.dataset.atencao === "false" && !a.botaoAgora());
check("a data não entra na biblioteca", !("ultimoBackup" in (a.docs.get("library/volumes") || {})));
check("sem erros (nunca)", a.erros.length === 0, a.erros[0]);

console.log("=== backup recente ===");
const b = await montar({ meta: { ultimoBackup: diasAtras(12) } });
check("conta os dias", /Último backup há 12 dias/.test(b.linha()?.textContent || ""), b.linha()?.textContent);
check("sem destaque antes de 30 dias", b.linha()?.dataset.atencao === "false" && !b.botaoAgora());
const b1 = await montar({ meta: { ultimoBackup: diasAtras(1) } });
check("um dia é ontem", /Último backup ontem/.test(b1.linha()?.textContent || ""), b1.linha()?.textContent);

console.log("=== backup antigo ===");
const c = await montar({ meta: { ultimoBackup: diasAtras(45) } });
check("conta 45 dias", /há 45 dias/.test(c.linha()?.textContent || ""), c.linha()?.textContent);
check("em destaque depois de 30 dias", c.linha()?.dataset.atencao === "true" && !!c.botaoAgora());

console.log("=== download recusado ===");
const d = await montar({ meta: { ultimoBackup: diasAtras(45) }, recusar: true });
d.botaoAgora()?.click();
await sleep(200);
check("recusar não grava data nova", /há 45 dias/.test(d.linha()?.textContent || "") && new Date(d.docs.get("library/meta").ultimoBackup) < new Date(diasAtras(44)));
check("sem erros (recusa)", d.erros.length === 0, d.erros[0]);

console.log("=== sem banco ===");
const e = await montar({ semDb: true });
check("sem banco, sem a linha", !e.linha());

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
