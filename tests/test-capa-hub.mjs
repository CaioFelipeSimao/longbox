import { JSDOM } from "jsdom";
import fs from "node:fs";

// v126: the hub is a cover laid over the app, not a page of its own. Under it the
// last tab you used is already built (HQs on a first visit), so lifting the cover
// reveals that tab instead of an empty page. The tab under the cover is kept on the
// device (localStorage), the hub-or-not note stays per browser tab (sessionStorage).
// The unlock only counts when the finger starts at the very end of the hub: a swipe
// that scrolls into the end must not carry on and throw the cover away.

const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0;
let passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function montar({ sessao = {}, local = {} } = {}) {
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
  for (const [k, v] of Object.entries(sessao)) window.sessionStorage.setItem(k, v);
  for (const [k, v] of Object.entries(local)) window.localStorage.setItem(k, v);
  const v = (id) => ({ id, titulo: "Batman " + id, personagem: "Batman", tipo: "Trade Paperback", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: [] });
  const docs = new Map([
    ["library/volumes", { items: [v("a"), v("b")] }],
    ["library/colecoes", { items: [{ id: "c1", nome: "Saga", descricao: "", membros: ["a"] }] }],
    ["library/series", { items: [{ id: "s1", nome: "Batman (Volume 1)", personagens: [{ nome: "Batman", de: null, ate: null }], editora: "DC Comics", anoInicio: "1940", anoFim: "", totalEdicoes: 2, ordem: null }] }],
  ]);
  const makeDoc = (path) => ({
    path,
    get: async () => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path), metadata: {} }),
    set: async (body) => { docs.set(path, JSON.parse(JSON.stringify(body))); }, delete: async () => { docs.delete(path); },
  });
  window.claude = { use: async (n) => (n === "db" ? { doc: makeDoc, collection: (c) => ({ doc: (id) => makeDoc(c + "/" + id), get: async () => ({ docs: [], size: 0, empty: true, docChanges: () => [], metadata: {} }) }) } : null) };
  window.eval(bundle);
  await sleep(450);
  const root = window.document.getElementById("root");
  const NOMES = { "HQs": "volumes", "Coleções": "colecoes", "Séries": "series" };
  const abaDeBaixo = () => {
    const b = root.querySelector('.segmented button[data-active="true"]');
    return b ? NOMES[b.textContent.trim()] : null;
  };
  const capa = () => root.querySelector(".hub-capa");
  const clicar = async (el) => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); await sleep(150); };
  return { window, root, erros, abaDeBaixo, capa, clicar };
}

console.log("=== hub como capa ===");
{
  const m = await montar();
  check("primeira visita abre com a capa", !!m.capa());
  check("a capa guarda o hub", !!m.capa()?.querySelector(".hub .suggest-title"));
  check("embaixo da capa já está a aba HQs", m.abaDeBaixo() === "volumes", m.abaDeBaixo());
  check("a aba HQs de baixo já tem as HQs desenhadas", m.root.querySelectorAll('.aba[data-ativa="true"] .vol').length === 2);
  check("o app embaixo fica inerte enquanto a capa está", m.root.querySelector(".app-base")?.hasAttribute("inert"));

  const entrar = [...m.capa().querySelectorAll("button")].find((b) => /Minha coleção/.test(b.textContent));
  await m.clicar(entrar);
  await sleep(300);
  check("Minha coleção levanta a capa", !m.capa());
  check("revela a aba HQs", m.abaDeBaixo() === "volumes", m.abaDeBaixo());
  check("app deixa de ser inerte", !m.root.querySelector(".app-base")?.hasAttribute("inert"));
  check("aba de baixo gravada no aparelho", m.window.localStorage.getItem("longbox:aba-base") === "volumes", m.window.localStorage.getItem("longbox:aba-base"));
  check("sessão diz que não está no hub", m.window.sessionStorage.getItem("longbox:aba") === "volumes");

  const series = [...m.root.querySelectorAll(".tabbar button")].find((b) => /Séries/.test(b.textContent));
  await m.clicar(series);
  check("aba Séries gravada", m.window.localStorage.getItem("longbox:aba-base") === "series");
  await m.clicar(m.root.querySelector("button.brand"));
  check("o logo baixa a capa", !!m.capa());
  check("sessão grava o hub", m.window.sessionStorage.getItem("longbox:aba") === "hub");
  check("embaixo continua Séries", m.abaDeBaixo() === "series", m.abaDeBaixo());
  check("aba de baixo segue Séries", m.window.localStorage.getItem("longbox:aba-base") === "series");
  check("sem erros", m.erros.length === 0, m.erros[0]);
}

console.log("=== próxima visita ===");
{
  const m = await montar({ local: { "longbox:aba-base": "colecoes" } });
  check("abre com a capa", !!m.capa());
  check("sobre a última aba usada", m.abaDeBaixo() === "colecoes", m.abaDeBaixo());
  const r = await montar({ sessao: { "longbox:aba": "series" }, local: { "longbox:aba-base": "series" } });
  check("recarregar numa aba continua nela, sem capa", !r.capa() && r.abaDeBaixo() === "series");
  const lixo = await montar({ local: { "longbox:aba-base": "hub" } });
  check("aba de baixo inválida cai em HQs", lixo.abaDeBaixo() === "volumes", lixo.abaDeBaixo());
}

console.log("=== gesto de destravar ===");
{
  const m = await montar();
  const el = m.capa();
  // JSDOM has no layout: the cover's scroll is faked, 2000px of hub in a 700px window.
  let topo = 0;
  Object.defineProperty(el, "scrollTop", { get: () => topo, set: (v) => { topo = v; }, configurable: true });
  Object.defineProperty(el, "clientHeight", { get: () => 700, configurable: true });
  Object.defineProperty(el, "scrollHeight", { get: () => 2000, configurable: true });
  const toque = (tipo, y) => {
    const ev = new m.window.Event(tipo, { bubbles: true });
    const lista = tipo === "touchend" ? [] : [{ clientY: y, clientX: 100 }];
    Object.defineProperty(ev, "touches", { value: lista });
    Object.defineProperty(ev, "changedTouches", { value: [{ clientY: y, clientX: 100 }] });
    m.window.dispatchEvent(ev);
  };
  await sleep(400); // the gesture arms 350ms after the cover shows

  // A fast swipe that starts mid-hub and scrolls into the end (the page moves under
  // the finger, then the finger keeps going past the end).
  toque("touchstart", 600);
  topo = 1000; toque("touchmove", 500);
  topo = 1300; toque("touchmove", 400);
  toque("touchmove", 300);
  toque("touchmove", 200);
  toque("touchend", 200);
  await sleep(400);
  check("deslize que chega ao fim no meio não destrava", !!m.capa());
  check("e a capa volta ao lugar", !m.capa()?.style.transform || m.capa().style.transform === "", m.capa()?.style.transform);

  // Already at the end: a short quick flick with barely any travel is not enough.
  toque("touchstart", 600);
  toque("touchmove", 594);
  toque("touchend", 594);
  await sleep(400);
  check("um toque tremido no fim não destrava", !!m.capa());

  // Already at the end, a real swipe up.
  toque("touchstart", 600);
  toque("touchmove", 560);
  toque("touchmove", 500);
  toque("touchmove", 420);
  toque("touchend", 420);
  await sleep(500);
  check("deslize que começa no fim destrava", !m.capa());
  check("e mostra a aba de baixo", m.abaDeBaixo() === "volumes");
  check("sem erros", m.erros.length === 0, m.erros[0]);
}

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas === 0 ? 0 : 1);
