import { JSDOM } from "jsdom";
import fs from "node:fs";

// v126: on a phone a sheet follows the finger down and closes when let go far
// enough (120px) or flicked. It only starts from the top of the sheet's content:
// with the content scrolled, pulling down scrolls it back up as always. Sideways
// swipes stay the volume sheet's navigation. Tablet and PC (the side panel) keep
// no drag at all.

const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0;
let passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function montar({ fone = true } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
    runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.test/",
  });
  const { window } = dom;
  const erros = [];
  window.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el }]); } unobserve() {} disconnect() {} };
  window.scrollTo = () => {};
  window.matchMedia = (q) => ({
    matches: q.includes("pointer: fine") || (fone && q.includes("max-width: 767px")),
    media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  });
  window.addEventListener("error", (e) => erros.push(e.error?.stack || e.message));
  window.console.error = (...a) => erros.push(a.join(" "));
  window.sessionStorage.setItem("longbox:aba", "volumes");
  const v = (id) => ({ id, titulo: "Batman " + id, personagem: "Batman", tipo: "Trade Paperback", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: [] });
  const docs = new Map([
    ["library/volumes", { items: [v("A"), v("B"), v("C")] }],
    ["library/colecoes", { items: [] }],
    ["library/series", { items: [] }],
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
  const folha = () => [...root.querySelectorAll(".sheet")].find((s) => s.dataset.in === "true");
  const titulo = () => folha()?.querySelector(".sheet-head .t-display")?.textContent;
  const abrir = async (t) => {
    [...root.querySelectorAll('.aba[data-ativa="true"] .vol')].find((b) => b.textContent.includes(t))?.click();
    await sleep(150);
  };
  // Touches are dispatched on the element the finger lands on, the way a browser does.
  const arrastar = async (alvo, pontos, pausa = 16) => {
    const ev = (tipo, x, y) => {
      const e = new window.Event(tipo, { bubbles: true, cancelable: true });
      const lista = [{ clientX: x, clientY: y, identifier: 1 }];
      Object.defineProperty(e, "touches", { value: tipo === "touchend" ? [] : lista });
      Object.defineProperty(e, "changedTouches", { value: lista });
      alvo.dispatchEvent(e);
      return e;
    };
    const [x0, y0] = pontos[0];
    ev("touchstart", x0, y0);
    let impedido = false;
    for (const [x, y] of pontos.slice(1)) { await sleep(pausa); if (ev("touchmove", x, y).defaultPrevented) impedido = true; }
    const meio = folha()?.style.transform || "";
    const [xf, yf] = pontos[pontos.length - 1];
    ev("touchend", xf, yf);
    await sleep(350);
    return { meio, impedido };
  };
  return { window, root, erros, folha, titulo, abrir, arrastar };
}

const descendo = (y0, y1, passo = 20, x = 200) => {
  const p = [];
  for (let y = y0; y <= y1; y += passo) p.push([x, y]);
  return p;
};

console.log("=== celular ===");
{
  const m = await montar();
  await m.abrir("Batman A");
  check("abre o card", m.titulo() === "Batman A", m.titulo());

  let r = await m.arrastar(m.folha().querySelector(".sheet-head"), descendo(100, 150, 10), 60);
  check("o card acompanha o dedo", r.meio === "translateY(50px)", r.meio);
  check("a página não rola junto", r.impedido);
  check("puxão curto e lento não fecha", m.titulo() === "Batman A");
  check("e o card volta ao lugar", !m.folha()?.style.transform, m.folha()?.style.transform);

  r = await m.arrastar(m.folha().querySelector(".sheet-grab"), descendo(100, 260));
  check("puxar 160px pela barrinha fecha", !m.folha(), m.titulo());

  await m.abrir("Batman B");
  r = await m.arrastar(m.folha().querySelector(".sheet-body"), [[200, 300], [200, 330], [200, 360], [200, 380]], 8);
  check("puxão rápido no conteúdo, no topo, fecha", !m.folha(), m.titulo());

  await m.abrir("Batman C");
  const corpo = m.folha().querySelector(".sheet-body");
  Object.defineProperty(corpo, "scrollTop", { value: 240, configurable: true, writable: true });
  r = await m.arrastar(corpo, descendo(200, 400));
  check("com o conteúdo rolado, puxar para baixo não mexe no card", m.titulo() === "Batman C" && r.meio === "", r.meio);
  check("e não impede a rolagem", !r.impedido);
  corpo.scrollTop = 0;

  r = await m.arrastar(m.folha().querySelector(".sheet-head"), [[300, 100], [270, 104], [230, 108], [180, 110]]);
  check("deslize de lado não arrasta o card", r.meio === "" && !!m.folha(), r.meio);

  r = await m.arrastar(m.folha().querySelector(".sheet-head"), [[200, 200], [200, 180], [200, 120]]);
  check("puxar para cima não mexe", r.meio === "" && !!m.folha(), r.meio);
  check("sem erros", m.erros.length === 0, m.erros[0]);
}

console.log("=== tablet e PC ===");
{
  const m = await montar({ fone: false });
  await m.abrir("Batman A");
  const r = await m.arrastar(m.folha().querySelector(".sheet-head"), descendo(100, 300));
  check("painel lateral não fecha arrastando", m.titulo() === "Batman A" && r.meio === "", r.meio);
  check("sem erros", m.erros.length === 0, m.erros[0]);
}

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas === 0 ? 0 : 1);
