import { JSDOM } from "jsdom";
import fs from "node:fs";

// v129: on a phone the tab bar is a floating capsule with a search circle beside
// it. Tapping the circle opens the field there (the capsule folds into a circle
// with the tab's icon); the typed text filters the tab and suggests above the bar.
// Tapping outside only hides the suggestions; the X, the folded circle or a pick
// close the search and clear it. On a tablet or PC the search stays in the header.

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
  const v = (id, t) => ({ id, titulo: t, personagem: t.split(" ")[0], tipo: "Trade Paperback", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: [] });
  const docs = new Map([
    ["library/volumes", { items: [v("a", "Batman Ano Um"), v("b", "Batman Silêncio"), v("c", "Nightwing Ano Um")] }],
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
  const $ = (s) => root.querySelector(s);
  const clicar = async (el) => { el?.click(); await sleep(120); };
  const digitar = async (el, texto) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, texto);
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
    await sleep(150);
  };
  const buscando = () => $(".tabbar")?.dataset.buscando === "true";
  const hqsNaAba = () => [...root.querySelectorAll('.aba[data-ativa="true"] .vol')].length;
  return { window, root, erros, $, clicar, digitar, buscando, hqsNaAba };
}

console.log("=== celular ===");
{
  const m = await montar();
  check("a busca sai do topo", !m.$(".topbar .search"));
  check("e vira o círculo na barra de abas", !!m.$(".tabbar .search-barra .search-abrir"));
  check("abas numa cápsula com a pílula da ativa", !!m.$(".tabbar-capsula .tabbar-pill") && m.$(".tabbar").style.getPropertyValue("--aba-i") === "0");

  await m.clicar(m.$(".search-abrir"));
  const campo = m.$(".search-barra input");
  check("tocar no círculo abre o campo", m.buscando() && m.$(".search-barra").dataset.full === "true");
  check("e já foca o campo (teclado sobe)", m.window.document.activeElement === campo);
  check("a cápsula vira o círculo da aba", !!m.$(".tabbar-voltar"));

  await m.digitar(campo, "Batman");
  check("sugestões aparecem", m.root.querySelectorAll(".search-barra .sug-row").length === 2, m.root.querySelectorAll(".search-barra .sug-row").length);
  check("a aba filtra enquanto digita", m.hqsNaAba() === 2, m.hqsNaAba());

  m.$(".content").dispatchEvent(new m.window.Event("pointerdown", { bubbles: true }));
  await m.clicar(null);
  check("tocar fora só esconde as sugestões", !m.$(".search-barra .sug") && m.buscando() && campo.value === "Batman");
  check("e o filtro continua", m.hqsNaAba() === 2, m.hqsNaAba());

  await m.clicar(m.$(".tabbar-voltar"));
  check("o círculo da aba fecha a busca", !m.buscando());
  check("e limpa o texto", m.$(".search-barra input").value === "" && m.hqsNaAba() === 3, m.hqsNaAba());

  await m.clicar(m.$(".search-abrir"));
  await m.digitar(m.$(".search-barra input"), "Batman");
  await m.clicar(m.$(".search-fechar"));
  check("o X também fecha e limpa", !m.buscando() && m.$(".search-barra input").value === "");

  await m.clicar(m.$(".search-abrir"));
  await m.digitar(m.$(".search-barra input"), "Silêncio");
  await m.clicar(m.$(".search-barra .sug-row"));
  await m.clicar(null);
  const titulo = [...m.root.querySelectorAll(".sheet")].find((s) => s.dataset.in === "true")?.querySelector(".sheet-head .t-display")?.textContent;
  check("escolher uma sugestão abre o card", titulo === "Batman Silêncio", titulo);
  check("e fecha a busca", !m.buscando());

  await m.clicar(m.$(".search-abrir"));
  m.root.querySelector("button.brand").click();
  await sleep(200);
  check("ir ao hub fecha a busca", !m.buscando());
  check("sem erros", m.erros.length === 0, m.erros[0]);
}

console.log("=== tablet e PC ===");
{
  const m = await montar({ fone: false });
  check("busca continua no topo", !!m.$(".topbar .search") && !m.$(".search-barra"));
  check("sem erros", m.erros.length === 0, m.erros[0]);
}

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas === 0 ? 0 : 1);
