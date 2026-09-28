import { JSDOM } from "jsdom";
import fs from "node:fs";

// v141: up to three characters can be pinned from their group heading. Pinned groups
// come first, in the order they were pinned, then the rest alphabetically, on the HQs
// and Séries tabs alike (one shared list). A fourth pin is refused with a toast. The
// list lives in library/fixados, so both devices see it; undo and backups leave it.

const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0;
let passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PERS = ["Batman", "Flash", "Superman", "Wonder Woman", "Aquaman"];
async function montar(abaInicial, docsExtra = []) {
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
  window.sessionStorage.setItem("longbox:aba", abaInicial);

  const vol = (p, i) => ({ id: p + i, titulo: p + " " + i, personagem: p, tipo: "Trade Paperback", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: [] });
  const serie = (p) => ({ id: "s-" + p, nome: p + " (2016)", personagens: [{ nome: p, de: null, ate: null }], editora: "DC Comics", anoInicio: "2016", anoFim: "", totalEdicoes: 10, ordem: null });
  const docs = new Map([
    ["library/volumes", { items: PERS.flatMap((p) => [vol(p, 1), vol(p, 2)]) }],
    ["library/colecoes", { items: [] }],
    ["library/series", { items: PERS.map(serie) }],
    ["library/cores", { mapa: {} }],
    ...docsExtra,
  ]);
  const makeDoc = (path) => ({
    path,
    get: async () => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path), metadata: { fromCache: false, hasPendingWrites: false } }),
    set: async (body) => { docs.set(path, JSON.parse(JSON.stringify(body))); },
    delete: async () => { docs.delete(path); },
  });
  window.claude = {
    use: async (name) => name === "db" ? {
      doc: makeDoc,
      collection: (cpath) => ({ path: cpath, doc: (id) => makeDoc(cpath + "/" + id), get: async () => ({ docs: [], size: 0, empty: true, docChanges: () => [], metadata: {} }) }),
    } : null,
  };
  window.eval(bundle);
  await sleep(450);
  const root = window.document.getElementById("root");
  const aba = () => root.querySelector('.aba[data-ativa="true"]') || root;
  const ordem = () => [...aba().querySelectorAll(".group-head h2")].map((h) => h.textContent);
  const fixar = async (p) => { aba().querySelector('.group-head [aria-label="Fixar ' + p + ' no topo"]')?.click(); await sleep(120); };
  return { window, root, erros, docs, ordem, fixar, aba };
}

console.log("=== HQs ===");
const m = await montar("volumes");
check("sem fixados, ordem alfabética", m.ordem().join() === "Aquaman,Batman,Flash,Superman,Wonder Woman", m.ordem().join());
check("cada cabeçalho tem o alfinete", m.aba().querySelectorAll(".group-head .group-pin").length === 5);
await m.fixar("Superman");
await m.fixar("Flash");
check("fixados primeiro, na ordem em que foram fixados", m.ordem().join() === "Superman,Flash,Aquaman,Batman,Wonder Woman", m.ordem().join());
const pino = m.aba().querySelector('.group-head [aria-label="Fixar Superman no topo"]');
check("alfinete marcado", pino?.getAttribute("aria-pressed") === "true", pino?.getAttribute("aria-pressed"));
await m.fixar("Wonder Woman");
await m.fixar("Batman");
const t = m.root.querySelector(".toast")?.textContent || "";
check("o quarto é recusado com aviso", /já fixou 3/.test(t), t);
check("ordem não muda com o quarto", m.ordem().join() === "Superman,Flash,Wonder Woman,Aquaman,Batman", m.ordem().join());
await sleep(700);
check("salvo no banco", (m.docs.get("library/fixados")?.personagens || []).join() === "Superman,Flash,Wonder Woman", JSON.stringify(m.docs.get("library/fixados")));
await m.fixar("Flash");
check("tocar de novo desafixa", m.ordem().join() === "Superman,Wonder Woman,Aquaman,Batman,Flash", m.ordem().join());
check("sem erros (HQs)", m.erros.length === 0, m.erros[0]);

console.log("=== Séries, com a lista guardada ===");
const s = await montar("series", [["library/fixados", { personagens: ["Wonder Woman", "Batman"] }]]);
check("séries seguem os mesmos fixados", s.ordem().join() === "Wonder Woman,Batman,Aquaman,Flash,Superman", s.ordem().join());
await s.fixar("Aquaman");
check("fixar nas séries também vale", s.ordem().join() === "Wonder Woman,Batman,Aquaman,Flash,Superman" && (await sleep(700), (s.docs.get("library/fixados").personagens || []).join() === "Wonder Woman,Batman,Aquaman"), JSON.stringify(s.docs.get("library/fixados")));
const h = await montar("volumes", [["library/fixados", { personagens: ["Wonder Woman", "Batman"] }]]);
check("a lista guardada vale ao abrir o HQs", h.ordem().join() === "Wonder Woman,Batman,Aquaman,Flash,Superman", h.ordem().join());
check("sem erros (Séries)", s.erros.length === 0 && h.erros.length === 0, s.erros[0] || h.erros[0]);

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
