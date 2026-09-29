import { JSDOM } from "jsdom";
import fs from "node:fs";

// v143: with an edição picked in the série sheet, ← → step to the previous and
// next edição in checklist order (posicao first, so a #1000000 sits between the
// issues around its cover date). It follows what is on screen (search, faixa),
// stops at both ends, opens a folded hundred-block the next edição sits in, moves
// focus with the pick, and stays out of the way while typing or with a modifier.

const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0, passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function montar(series, edicoes, owned) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.test/" });
  const { window } = dom;
  const erros = [];
  window.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el }]); } unobserve() {} disconnect() {} };
  window.scrollTo = () => {};
  window.matchMedia = (q) => ({ matches: q.includes("pointer: fine"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  window.addEventListener("error", (e) => erros.push(e.error?.stack || e.message));
  window.console.error = (...a) => erros.push(a.join(" "));
  window.sessionStorage.setItem("longbox:aba", "series");
  window.sessionStorage.setItem("longbox:series-abertas", JSON.stringify(["Batman"]));
  const docs = new Map([
    ["library/volumes", { items: [{ id: "v1", titulo: "Batman v1", personagem: "Batman", tipo: "Omnibus", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: owned }] }],
    ["library/colecoes", { items: [] }], ["library/series", { items: series }], ["library/cores", { mapa: {} }],
  ]);
  const porSerie = {};
  edicoes.forEach((e) => (porSerie[e.serieId] = porSerie[e.serieId] || []).push(e));
  Object.entries(porSerie).forEach(([sid, items]) => docs.set("edicoes/" + sid, { items }));
  const makeDoc = (path) => ({ path, get: async () => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path), metadata: {} }), set: async (b) => { docs.set(path, b); }, delete: async () => { docs.delete(path); } });
  const colecao = (c) => ({ doc: (id) => makeDoc(c + "/" + id), get: async () => { const l = [...docs.keys()].filter((k) => k.startsWith(c + "/")).map((k) => ({ id: k.split("/").pop(), data: () => docs.get(k) })); return { docs: l, size: l.length, empty: !l.length, docChanges: () => [], metadata: {} }; } });
  window.claude = { use: async (n) => (n === "db" ? { doc: makeDoc, collection: colecao } : null) };
  window.eval(bundle);
  await sleep(450);
  const root = window.document.getElementById("root");
  root.querySelector(".serie-row")?.click();
  await sleep(200);
  const tile = (n) => [...root.querySelectorAll(".sheet .tile")].find((t) => t.textContent === n);
  const sel = () => root.querySelector(".sheet .edicao-pinned .t-title")?.textContent;
  const clicar = async (el) => { el?.click(); await sleep(120); };
  const tecla = async (key, alvo = window.document.activeElement || window.document.body, extra = {}) => {
    alvo.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...extra }));
    await sleep(120);
  };
  return { window, root, erros, tile, sel, clicar, tecla };
}
const serie = (id, nome) => ({ id, nome, personagens: [{ nome: "Batman", de: null, ate: null }], editora: "DC Comics", anoInicio: "1940", anoFim: "", totalEdicoes: null, ordem: null });
const eds = (sid, de, ate) => Array.from({ length: ate - de + 1 }, (_, i) => ({ id: sid + "-" + (de + i), serieId: sid, numero: String(de + i), mes: "", ano: "", posicao: null }));

console.log("=== série curta com #1000000 na posição 2.5 ===");
{
  const lista = [...eds("s1", 1, 25), { id: "s1-m", serieId: "s1", numero: "1000000", mes: "", ano: "", posicao: 2.5 }];
  const m = await montar([serie("s1", "Catwoman (Volume 2)")], lista, ["s1-1"]);
  await m.tecla("ArrowRight", m.window.document.body);
  check("sem edição escolhida, a seta não escolhe nada", !m.sel(), m.sel());
  await m.clicar(m.tile("2"));
  check("clicar escolhe a 2", m.sel() === "Nº 2", m.sel());
  await m.tecla("ArrowRight");
  check("seta direita vai para a #1000000, que está entre a 2 e a 3", m.sel() === "Nº 1000000", m.sel());
  check("o destaque acompanha", m.tile("1000000")?.dataset.sel === "true" && m.tile("2")?.dataset.sel === "false");
  check("o foco acompanha", m.window.document.activeElement === m.tile("1000000"), m.window.document.activeElement?.textContent);
  await m.tecla("ArrowRight");
  check("e depois para a 3", m.sel() === "Nº 3", m.sel());
  await m.tecla("ArrowLeft");
  await m.tecla("ArrowLeft");
  await m.tecla("ArrowLeft");
  check("seta esquerda volta até a 1", m.sel() === "Nº 1", m.sel());
  await m.tecla("ArrowLeft");
  check("na primeira, para (não dá a volta)", m.sel() === "Nº 1", m.sel());
  await m.tecla("ArrowRight", m.window.document.body, { shiftKey: true });
  check("com Shift apertado, não navega", m.sel() === "Nº 1", m.sel());
  await m.clicar(m.tile("25"));
  await m.tecla("ArrowRight");
  check("na última, para", m.sel() === "Nº 25", m.sel());
  const campo = m.root.querySelector('.sheet input[aria-label="Buscar número na série"]');
  await m.tecla("ArrowLeft", campo);
  check("dentro do campo de busca, a seta é do texto", m.sel() === "Nº 25", m.sel());
  check("sem erros", m.erros.length === 0, m.erros[0]);
}

console.log("=== busca: anda só no que está na tela ===");
{
  const m = await montar([serie("s1", "Robin (Volume 2)")], eds("s1", 1, 25), []);
  const campo = m.root.querySelector('.sheet input[aria-label="Buscar número na série"]');
  const setter = Object.getOwnPropertyDescriptor(m.window.HTMLInputElement.prototype, "value").set;
  setter.call(campo, "2");
  campo.dispatchEvent(new m.window.Event("input", { bubbles: true }));
  await sleep(150);
  await m.clicar(m.tile("2"));
  await m.tecla("ArrowRight");
  check("da 2 pula para a 12 (as que contêm \"2\")", m.sel() === "Nº 12", m.sel());
  check("sem erros", m.erros.length === 0, m.erros[0]);
}

console.log("=== série longa: abre o bloco fechado da próxima ===");
{
  const m = await montar([serie("s2", "Batman (Volume 1)")], eds("s2", 1, 399), []);
  const blocoDe = (n) => m.tile(n)?.closest("details");
  check("o bloco do 100 começa fechado", blocoDe("100") && !blocoDe("100").open);
  await m.clicar(m.tile("99"));
  await m.tecla("ArrowRight");
  check("da 99 vai para a 100", m.sel() === "Nº 100", m.sel());
  check("e o bloco dela abre", !!blocoDe("100")?.open);
  check("com o foco nela", m.window.document.activeElement === m.tile("100"));
  check("sem erros", m.erros.length === 0, m.erros[0]);
}

console.log("=== #1000000 ocupa dois quadradinhos ===");
{
  const lista = [...eds("s3", 720, 730), { id: "s3-m", serieId: "s3", numero: "1000000", mes: "", ano: "", posicao: 726.5 }];
  const m = await montar([serie("s3", "Detective Comics (Volume 1)")], lista, []);
  const t = m.tile("1000000");
  check("mostra o número inteiro", !!t);
  check("junto de outras, é largo", t?.dataset.forma === "largo", t?.dataset.forma);
  check("as comuns são comuns", m.tile("726")?.dataset.forma === "comum", m.tile("726")?.dataset.forma);
  check("a largura das comuns segue os 3 dígitos do bloco", t?.parentElement?.style.getPropertyValue("--nd") === "3", t?.parentElement?.style.getPropertyValue("--nd"));
  check("sem erros", m.erros.length === 0, m.erros[0]);
}
{
  const m = await montar([serie("s4", "Robin (Volume 2)")], [{ id: "s4-m", serieId: "s4", numero: "1000000", mes: "", ano: "", posicao: null }], []);
  check("sozinho no bloco, tamanho normal", m.tile("1000000") && !m.tile("1000000").dataset.forma, m.tile("1000000")?.dataset.forma);
  check("sem erros", m.erros.length === 0, m.erros[0]);
}


console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
