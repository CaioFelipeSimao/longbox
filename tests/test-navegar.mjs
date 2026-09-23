import { JSDOM } from "jsdom";
import fs from "node:fs";

// v88: with a volume sheet open, ‹ › in its header (← → on a keyboard, a sideways
// swipe on touch) step to the neighbouring volume. The sequence is the list the
// volume was opened from: the HQs tab as it is on screen (filters, search and
// folded groups respected), a collection's reading order, or, from the hub and the
// search box, the full HQs order. The ends do not wrap. The keys stay out of the
// way while typing and while the série sheet sits on top.

const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0;
let passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function montar({ aba }) {
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
  window.sessionStorage.setItem("longbox:aba", aba);

  const v = (id, titulo, personagem, eds = []) => ({ id, titulo, personagem, tipo: "Trade Paperback", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: eds });
  const docs = new Map([
    ["library/volumes", { items: [
      v("a", "Batman A", "Batman", ["e1"]), v("b", "Batman B", "Batman"), v("c", "Batman C", "Batman"),
      v("d", "Nightwing D", "Nightwing"), v("e", "Nightwing E", "Nightwing"),
    ] }],
    ["library/colecoes", { items: [{ id: "saga", nome: "Saga", descricao: "", membros: ["e", "a", "c"] }] }],
    ["library/series", { items: [{ id: "s1", nome: "Batman (Volume 1)", personagens: [{ nome: "Batman", de: null, ate: null }], editora: "DC Comics", anoInicio: "1940", anoFim: "2011", totalEdicoes: 2, ordem: null }] }],
    ["library/cores", { mapa: {} }],
    ["edicoes/s1", { items: [{ id: "e1", serieId: "s1", numero: "1", mes: "", ano: "", posicao: null }, { id: "e2", serieId: "s1", numero: "2", mes: "", ano: "", posicao: null }] }],
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
  const frente = () => [...root.querySelectorAll(".sheet")].find((s) => s.dataset.behind !== "true" && s.dataset.in === "true");
  const titulo = () => frente()?.querySelector(".sheet-head .t-display")?.textContent;
  const ant = () => frente()?.querySelector('[aria-label="Volume anterior"]');
  const prox = () => frente()?.querySelector('[aria-label="Próximo volume"]');
  const clicar = async (el) => { el?.click(); await sleep(120); };
  const tecla = async (key, alvo = window.document.body) => {
    alvo.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    await sleep(120);
  };
  const deslizar = async (dx, dy = 0) => {
    const alvo = frente()?.querySelector(".vol-nav");
    if (!alvo) return;
    const toque = (tipo, x, y) => {
      const ev = new window.Event(tipo, { bubbles: true, cancelable: true });
      const lista = [{ clientX: x, clientY: y, identifier: 1 }];
      Object.defineProperty(ev, "touches", { value: tipo === "touchend" ? [] : lista });
      Object.defineProperty(ev, "changedTouches", { value: lista });
      alvo.dispatchEvent(ev);
    };
    toque("touchstart", 200, 300);
    await sleep(60);
    toque("touchend", 200 + dx, 300 + dy);
    await sleep(120);
  };
  const abrirCard = async (texto, dentro = root.querySelector('.aba[data-ativa="true"]')) => {
    await clicar([...dentro.querySelectorAll(".vol")].find((b) => b.textContent.includes(texto)));
  };
  return { window, root, erros, frente, titulo, ant, prox, clicar, tecla, deslizar, abrirCard };
}

console.log("=== aba HQs ===");
const m = await montar({ aba: "volumes" });
await m.abrirCard("Batman A");
check("abre no primeiro", m.titulo() === "Batman A", m.titulo());
check("o primeiro não tem anterior", !!m.ant() && m.ant().disabled);
check("mas tem próximo", !!m.prox() && !m.prox().disabled);
await m.clicar(m.prox());
check("próximo leva ao B", m.titulo() === "Batman B", m.titulo());
check("o conteúdo entra pela direita", m.frente()?.querySelector(".vol-nav")?.dataset.dir === "prox");
await m.clicar(m.prox());
await m.clicar(m.prox());
check("passa do Batman para o Nightwing", m.titulo() === "Nightwing D", m.titulo());
await m.clicar(m.prox());
check("o último não tem próximo", m.titulo() === "Nightwing E" && m.prox().disabled);
await m.clicar(m.ant());
check("anterior volta", m.titulo() === "Nightwing D" && m.frente()?.querySelector(".vol-nav")?.dataset.dir === "ant", m.titulo());

console.log("=== teclado ===");
await m.tecla("ArrowLeft");
check("seta esquerda volta um", m.titulo() === "Batman C", m.titulo());
await m.tecla("ArrowRight");
check("seta direita avança um", m.titulo() === "Nightwing D", m.titulo());
await m.tecla("ArrowRight", m.root.querySelector(".search input"));
check("seta dentro de um campo de texto não navega", m.titulo() === "Nightwing D", m.titulo());
const lateral = new m.window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true, shiftKey: true });
m.window.document.body.dispatchEvent(lateral);
await sleep(120);
check("seta com modificador não navega", m.titulo() === "Nightwing D", m.titulo());

console.log("=== deslizar ===");
await m.deslizar(-120);
check("deslizar para a esquerda avança", m.titulo() === "Nightwing E", m.titulo());
await m.deslizar(120);
check("deslizar para a direita volta", m.titulo() === "Nightwing D", m.titulo());
await m.deslizar(-80, 90);
check("gesto mais vertical que lateral não navega", m.titulo() === "Nightwing D", m.titulo());
await m.deslizar(-30);
check("gesto curto não navega", m.titulo() === "Nightwing D", m.titulo());

console.log("=== ficha da série por cima ===");
await m.clicar(m.frente()?.querySelector('[aria-label="Fechar"]'));
await sleep(300);
await m.abrirCard("Batman A");
await m.clicar([...m.frente().querySelectorAll(".tile")].find((t) => t.textContent.trim() === "1"));
check("a ficha da série abriu por cima", /Batman \(Volume 1\)/.test(m.titulo() || ""), m.titulo());
await m.tecla("ArrowRight");
const receded = [...m.root.querySelectorAll(".sheet")].find((s) => s.dataset.behind === "true");
check("com a série por cima, a seta não troca o volume de baixo",
  /Batman A/.test(receded?.querySelector(".sheet-head .t-display")?.textContent || ""), receded?.querySelector(".sheet-head .t-display")?.textContent);
check("sem erros (HQs)", m.erros.length === 0, m.erros[0]);

console.log("=== grupo recolhido fica de fora ===");
const g = await montar({ aba: "volumes" });
await g.clicar(g.root.querySelector('.aba[data-ativa="true"] .group-head button[aria-expanded="true"]'));
await g.abrirCard("Nightwing D");
check("com o Batman recolhido, o D é o primeiro", g.titulo() === "Nightwing D" && g.ant()?.disabled, g.titulo());

console.log("=== coleção: ordem de leitura ===");
const c = await montar({ aba: "colecoes" });
await c.abrirCard("Nightwing E");
check("abre o primeiro da saga", c.titulo() === "Nightwing E" && c.ant()?.disabled, c.titulo());
await c.clicar(c.prox());
check("segue a ordem de leitura, não a da estante", c.titulo() === "Batman A", c.titulo());
await c.clicar(c.prox());
check("e termina onde a saga termina", c.titulo() === "Batman C" && c.prox()?.disabled, c.titulo());
check("sem erros (coleção)", c.erros.length === 0, c.erros[0]);

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
