import { JSDOM } from "jsdom";
import fs from "node:fs";

// v88: "Copiar faltantes" in the série sheet puts the missing edições on the
// clipboard as one line: whole numbers in a row collapse to "3-5", anything else
// (12.1, "Anual 1") follows on its own, and a meta past the catalogue adds "e mais
// N não catalogadas". A complete série shows no button. When the clipboard refuses,
// the same text appears in a box to copy by hand.

const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0;
let passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function montar({ clipboardFalha = false } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
    runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.test/",
  });
  const { window } = dom;
  const erros = [];
  const copiado = [];
  window.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el }]); } unobserve() {} disconnect() {} };
  window.scrollTo = () => {};
  window.matchMedia = (q) => ({ matches: q.includes("pointer: fine"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  window.addEventListener("error", (e) => erros.push(e.error?.stack || e.message));
  window.console.error = (...a) => erros.push(a.join(" "));
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (t) => { if (clipboardFalha) throw new Error("negado"); copiado.push(t); } },
  });
  window.sessionStorage.setItem("longbox:aba", "series");
  window.sessionStorage.setItem("longbox:series-abertas", JSON.stringify(["Batman"]));

  const serie = (id, nome, total) => ({ id, nome, personagens: [{ nome: "Batman", de: null, ate: null }], editora: "DC Comics", anoInicio: "2000", anoFim: "2001", totalEdicoes: total, ordem: null });
  const ed = (sid, numero) => ({ id: sid + "-" + numero, serieId: sid, numero, mes: "", ano: "", posicao: null });
  const s1 = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "12.1", "Anual 1"].map((n) => ed("s1", n));
  const docs = new Map([
    ["library/volumes", { items: [{
      id: "v1", titulo: "Batman vol 1", personagem: "Batman", tipo: "Trade Paperback", editora: "DC Comics", ano: "2020",
      status: "nao_lida", notas: "",
      edicoesColetadasIds: ["s1-1", "s1-2", "s1-6", "s1-7", "s2-1", "s2-2", "s3-1", "s4-1"],
    }] }],
    ["library/colecoes", { items: [] }],
    ["library/series", { items: [
      serie("s1", "Alfa", 14), serie("s2", "Completa", 2), serie("s3", "Quase", null), serie("s4", "Meta", 3),
    ] }],
    ["library/cores", { mapa: {} }],
    ["edicoes/s1", { items: s1 }],
    ["edicoes/s2", { items: [ed("s2", "1"), ed("s2", "2")] }],
    ["edicoes/s3", { items: [ed("s3", "1"), ed("s3", "2")] }],
    ["edicoes/s4", { items: [ed("s4", "1")] }],
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
  const sheet = () => root.querySelector('.sheet[data-in="true"]');
  const copiar = () => sheet() && [...sheet().querySelectorAll("button")].find((b) => b.textContent.trim() === "Copiar faltantes");
  const abrir = async (nome) => {
    const fechar = sheet() && sheet().querySelector('[aria-label="Fechar"]');
    if (fechar) { fechar.click(); await sleep(400); }
    [...root.querySelectorAll(".serie-row")].find((r) => r.textContent.includes(nome))?.click();
    await sleep(150);
  };
  return { root, erros, copiado, sheet, copiar, abrir };
}

console.log("=== copiar faltantes ===");
const m = await montar();
await m.abrir("Alfa");
check("série incompleta mostra o botão", !!m.copiar());
m.copiar()?.click();
await sleep(100);
check("texto com intervalos, avulsas no fim e a meta",
  m.copiado[0] === "Alfa: faltam 3-5, 8-10, 12.1, Anual 1, e mais 2 não catalogadas", m.copiado[0]);
check("avisa que copiou", /Faltantes copiadas/.test(m.root.querySelector(".toast")?.textContent || ""));
check("sem caixa manual quando copiou", !m.root.querySelector(".faltantes-manual"));

await m.abrir("Completa");
check("série completa não mostra o botão", !!m.sheet() && !m.copiar());

await m.abrir("Quase");
m.copiar()?.click();
await sleep(100);
check("uma só faltando usa o singular", m.copiado[1] === "Quase: falta 2", m.copiado[1]);

await m.abrir("Meta");
m.copiar()?.click();
await sleep(100);
check("só a meta faltando", m.copiado[2] === "Meta: faltam só as 2 não catalogadas", m.copiado[2]);
check("sem erros", m.erros.length === 0, m.erros[0]);

console.log("=== área de transferência recusada ===");
const f = await montar({ clipboardFalha: true });
await f.abrir("Alfa");
f.copiar()?.click();
await sleep(100);
const caixa = f.root.querySelector(".faltantes-manual");
check("o texto aparece numa caixa", !!caixa && caixa.value === "Alfa: faltam 3-5, 8-10, 12.1, Anual 1, e mais 2 não catalogadas", caixa && caixa.value);
check("o aviso explica", /Não consegui copiar/.test(f.root.querySelector(".toast")?.textContent || ""));
await f.abrir("Quase");
check("a caixa não passa para outra série", !f.root.querySelector(".faltantes-manual"));
check("sem erros (recusa)", f.erros.length === 0, f.erros[0]);

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
