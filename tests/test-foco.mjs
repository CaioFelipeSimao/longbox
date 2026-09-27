import { JSDOM } from "jsdom";
import fs from "node:fs";

// v100 (critique P1/P2): dialogs take focus when they open (a form's first field,
// otherwise the sheet's body), keep Tab inside, and give focus back on close; form
// labels and errors are tied to their fields; tabs, issue tiles and the reading
// status expose their state to assistive tech, not only as colour.

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
  window.sessionStorage.setItem("longbox:series-abertas", JSON.stringify(["Batman"]));

  const v = (id, eds = []) => ({ id, titulo: "Batman " + id, personagem: "Batman", tipo: "Trade Paperback", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: eds });
  const eds = [1, 2, 3].map((n) => ({ id: "e" + n, serieId: "s1", numero: String(n), mes: "", ano: "", posicao: null }));
  const docs = new Map([
    ["library/volumes", { items: [v("b0", ["e1", "e2"]), v("b1"), v("b2"), v("b3")] }],
    ["library/colecoes", { items: [{ id: "saga", nome: "Saga", descricao: "", membros: ["b0", "b1", "b2"] }] }],
    ["library/series", { items: [{ id: "s1", nome: "Batman (Volume 1)", personagens: [{ nome: "Batman", de: null, ate: null }], editora: "DC Comics", anoInicio: "1940", anoFim: "2011", totalEdicoes: 3, ordem: null }] }],
    ["library/cores", { mapa: {} }],
    ["edicoes/s1", { items: eds }],
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
  const botao = (texto, dentro = root) => [...dentro.querySelectorAll("button")].find((b) => b.textContent.trim() === texto);
  const toast = () => root.querySelector(".toast");
  const desfazer = () => toast() && botao("Desfazer", toast());
  const titulosHqs = () => [...root.querySelectorAll('.aba[data-ativa="true"] .vol .vol-title')].map((e) => e.textContent);
  const abrirHq = async (id) => {
    [...root.querySelectorAll('.aba[data-ativa="true"] .vol')].find((b) => b.textContent.includes("Batman " + id)).click();
    await sleep(150);
  };
  const sheetAberta = () => root.querySelector('.sheet[data-in="true"]');
  const modalAberto = () => [...root.querySelectorAll(".modal")].find((m) => m.closest('[data-in="true"]') || m.getAttribute("data-in") === "true");
  return { window, root, erros, docs, botao, toast, desfazer, titulosHqs, abrirHq, sheetAberta, modalAberto };
}

const m = await montar({ aba: "volumes" });
const doc = m.window.document;
const ativo = () => doc.activeElement;
const tecla = async (key, opcoes = {}, alvo = ativo() || doc.body) => {
  const ev = new m.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...opcoes });
  alvo.dispatchEvent(ev);
  await sleep(150);
  return ev;
};

console.log("=== formulário novo ===");
const novo = m.botao("Novo");
novo.focus();
novo.click();
await sleep(200);
const modal = m.root.querySelector(".modal");
check("o modal tem nome acessível", modal?.getAttribute("aria-labelledby") && doc.getElementById(modal.getAttribute("aria-labelledby"))?.textContent.length > 0);
check("o título é um heading", doc.getElementById(modal?.getAttribute("aria-labelledby"))?.tagName === "H2");
check("foco vai para o primeiro campo", ativo()?.tagName === "INPUT" && modal.contains(ativo()), ativo()?.outerHTML.slice(0, 80));
const rotulo = [...modal.querySelectorAll("label")].find((l) => l.textContent === "Título");
check("rótulo Título ligado ao campo", rotulo && rotulo.htmlFor && doc.getElementById(rotulo.htmlFor) === ativo());
const grupoStatus = [...modal.querySelectorAll('[role="group"]')].find((g) => doc.getElementById(g.getAttribute("aria-labelledby"))?.textContent === "Status de leitura");
check("status de leitura vira um grupo com nome", !!grupoStatus);
check("status marcado anuncia aria-pressed", grupoStatus?.querySelectorAll('[aria-pressed="true"]').length === 1);
const focaveis = [...modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')];
focaveis[focaveis.length - 1].focus();
let ev = await tecla("Tab");
check("Tab no último volta ao primeiro", ev.defaultPrevented && ativo() === focaveis[0]);
ev = await tecla("Tab", { shiftKey: true });
check("Shift+Tab no primeiro vai ao último", ev.defaultPrevented && ativo() === focaveis[focaveis.length - 1]);
m.botao("Salvar e fechar", modal)?.click();
await sleep(150);
const titulo = doc.getElementById(rotulo?.htmlFor);
const erroId = titulo?.getAttribute("aria-describedby");
check("erro do campo ligado por aria-describedby", !!erroId && /\S/.test(doc.getElementById(erroId)?.textContent || "") && titulo.getAttribute("aria-invalid") === "true", erroId);
await tecla("Escape");
await sleep(300);
check("fechar devolve o foco ao botão Novo", ativo() === novo, ativo()?.outerHTML.slice(0, 80));

console.log("=== ficha do volume ===");
const card = [...m.root.querySelectorAll('.aba[data-ativa="true"] .vol')].find((b) => b.textContent.includes("Batman b1"));
card.focus();
card.click();
await sleep(200);
const sheet = m.sheetAberta() || m.root.querySelector(".sheet");
check("a ficha tem nome acessível", /Batman b1/.test(doc.getElementById(sheet?.getAttribute("aria-labelledby"))?.textContent || ""));
check("foco entra na ficha", sheet?.contains(ativo()), ativo()?.outerHTML.slice(0, 80));
const status = sheet?.querySelector('.seg3 [aria-pressed="true"]');
check("status atual marcado", status?.textContent === "Não lida", status?.textContent);
ev = await tecla("ArrowRight");
check("← → continuam andando entre volumes", /Batman b2/.test(doc.getElementById(m.root.querySelector('.sheet[data-behind="false"]')?.getAttribute("aria-labelledby"))?.textContent || ""));
await tecla("Escape");
await sleep(300);
check("fechar devolve o foco à capa", ativo() === card, ativo()?.outerHTML.slice(0, 80));

console.log("=== abas e grade ===");
const abas = m.root.querySelector('.segmented[role="tablist"]');
check("seções formam uma tablist", !!abas);
check("uma aba selecionada", abas?.querySelectorAll('[role="tab"][aria-selected="true"]').length === 1);
const s = await montar({ aba: "series" });
s.root.querySelector(".serie-row")?.click();
await sleep(200);
const tiles = [...s.root.querySelectorAll(".tile")];
check("número possuído diz que é possuído", tiles.some((t) => t.getAttribute("aria-label") === "Nº 1, possuída"), tiles.map((t) => t.getAttribute("aria-label")).join(" | "));
check("número faltante diz que falta", tiles.some((t) => t.getAttribute("aria-label") === "Nº 3, falta"));
check("sem erros", m.erros.length === 0 && s.erros.length === 0, m.erros[0] || s.erros[0]);

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
