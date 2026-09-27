import { JSDOM } from "jsdom";
import fs from "node:fs";

// v114 (critique 2, lote 5): A) a shelf is one Tab stop and the arrows move inside
// it; B) "Lidas até aqui" in a collection's reading order; C) the "Novo volume" form
// takes a cover that is uploaded once the volume is saved.

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

  window.sessionStorage.setItem("longbox:series-abertas", JSON.stringify(["Batman"]));
  const v = (id, eds = []) => ({ id, titulo: "Batman " + id, personagem: "Batman", tipo: "Trade Paperback", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: eds });
  const docs = new Map([
    ["library/volumes", { items: [v("b0"), v("b1"), v("b2"), v("b3")] }],
    ["library/colecoes", { items: [{ id: "saga", nome: "Saga", descricao: "", membros: ["b0", "b1", "b2", "b3"] }] }],
    ["library/series", { items: [] }],
    ["library/cores", { mapa: {} }],
  ]);
  const makeDoc = (path) => ({
    path,
    get: async () => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path), metadata: { fromCache: false, hasPendingWrites: false } }),
    set: async (body) => { docs.set(path, JSON.parse(JSON.stringify(body))); },
    delete: async () => { docs.delete(path); },
  });
  const colecao = (cpath) => ({ path: cpath, doc: (id) => makeDoc(cpath + "/" + id), get: async () => ({ docs: [], size: 0, empty: true, docChanges: () => [], metadata: {} }) });
  const enviados = [];
  const assets = { upload: async (blob) => { enviados.push(blob); return { id: "a".repeat(32), url: "/_blob/" + "a".repeat(32) }; } };
  window.claude = { use: async (name) => (name === "db" ? { doc: makeDoc, collection: colecao } : name === "assets" ? assets : null) };
  window.eval(bundle);
  await sleep(450);
  const root = window.document.getElementById("root");
  const botao = (texto, dentro = root) => [...dentro.querySelectorAll("button")].find((b) => b.textContent.trim() === texto);
  return { window, root, erros, docs, botao, enviados };
}
const tecla = (w, alvo, key) => alvo.dispatchEvent(new w.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

console.log("=== A: teclado na estante ===");
{
  const m = await montar({ aba: "volumes" });
  const cards = () => [...m.root.querySelectorAll('.aba[data-ativa="true"] .shelf .vol')];
  check("só a primeira capa é parada do Tab", cards().map((c) => c.tabIndex).join(",") === "0,-1,-1,-1", cards().map((c) => c.tabIndex).join(","));
  cards()[0].focus();
  tecla(m.window, cards()[0], "ArrowRight");
  check("→ vai para a próxima capa", m.window.document.activeElement === cards()[1]);
  check("e ela vira a parada do Tab", cards().map((c) => c.tabIndex).join(",") === "-1,0,-1,-1", cards().map((c) => c.tabIndex).join(","));
  tecla(m.window, cards()[1], "End");
  check("End vai para a última", m.window.document.activeElement === cards()[3]);
  tecla(m.window, cards()[3], "Home");
  check("Home volta para a primeira", m.window.document.activeElement === cards()[0]);
  check("sem erros (A)", m.erros.length === 0, m.erros[0]);
}

console.log("=== B: lidas até aqui ===");
{
  const m = await montar({ aba: "colecoes" });
  m.root.querySelector('.aba[data-ativa="true"] .coll-head h2, .aba[data-ativa="true"] .coll-head button')?.click();
  await sleep(200);
  let sheet = m.root.querySelector(".sheet");
  if (!sheet) { m.botao("Gerenciar")?.click(); await sleep(200); sheet = m.root.querySelector(".sheet"); }
  const ate = [...(sheet?.querySelectorAll(".ordem-ate") || [])];
  check("cada volume não lido oferece o botão", ate.length === 4, ate.length);
  ate[2]?.click();
  await sleep(700);
  const st = m.docs.get("library/volumes").items.map((x) => x.status).join(",");
  check("marca ele e os anteriores", st === "lida,lida,lida,nao_lida", st);
  check("o aviso diz quantos", /3 volumes marcados como lidos/.test(m.root.querySelector(".toast")?.textContent || ""), m.root.querySelector(".toast")?.textContent);
  check("os lidos perdem o botão", m.root.querySelectorAll(".sheet .ordem-ate").length === 1);
  botaoDesfazer: {
    const d = [...m.root.querySelectorAll(".toast button")].find((b) => b.textContent.trim() === "Desfazer");
    d?.click();
    await sleep(700);
    check("desfazer volta tudo", m.docs.get("library/volumes").items.every((x) => x.status === "nao_lida"));
  }
  // v115: a read one can be set back from the reading order.
  m.root.querySelector(".sheet .ordem-ate")?.click();
  await sleep(700);
  const sel = m.root.querySelector(".sheet .ordem-status");
  check("o lido ganha o seletor de status", m.root.querySelectorAll(".sheet .ordem-status").length === 1 && sel?.value === "lida");
  const setSel = Object.getOwnPropertyDescriptor(m.window.HTMLSelectElement.prototype, "value").set;
  setSel.call(sel, "lendo");
  sel.dispatchEvent(new m.window.Event("change", { bubbles: true }));
  await sleep(700);
  check("mudar para Lendo grava", m.docs.get("library/volumes").items[0].status === "lendo", m.docs.get("library/volumes").items[0].status);
  check("e o botão Lidas até aqui volta", m.root.querySelectorAll(".sheet .ordem-ate").length === 4);
  check("sem erros (B)", m.erros.length === 0, m.erros[0]);
}

console.log("=== C: capa no Novo ===");
{
  const m = await montar({ aba: "volumes" });
  m.botao("Novo")?.click();
  await sleep(250);
  const modal = m.root.querySelector(".modal");
  const input = modal?.querySelector('.capa-nova input[type="file"]');
  check("o formulário Novo tem o campo de capa", !!input);
  m.window.URL.createObjectURL = () => "blob:prévia";
  m.window.URL.revokeObjectURL = () => {};
  const arq = new m.window.File(["x"], "capa.jpg", { type: "image/jpeg" });
  Object.defineProperty(input, "files", { configurable: true, value: [arq] });
  input.dispatchEvent(new m.window.Event("change", { bubbles: true }));
  await sleep(150);
  check("mostra a capa escolhida", !!m.root.querySelector(".capa-nova-mini img"));
  const titulo = modal.querySelector("input.input");
  const setter = Object.getOwnPropertyDescriptor(m.window.HTMLInputElement.prototype, "value").set;
  setter.call(titulo, "Batman novo");
  titulo.dispatchEvent(new m.window.Event("input", { bubbles: true }));
  const pers = modal.querySelectorAll("input.input")[1];
  setter.call(pers, "Batman");
  pers.dispatchEvent(new m.window.Event("input", { bubbles: true }));
  await sleep(100);
  m.botao("Salvar e fechar", modal)?.click();
  await sleep(900);
  check("envia a capa depois de salvar", m.enviados.length === 1 && m.enviados[0].name === "capa.jpg", m.enviados.length);
  const novo = m.docs.get("library/volumes").items.find((x) => x.titulo === "Batman novo");
  check("o volume novo fica com a capa", novo && novo.capaAssetId === "a".repeat(32), JSON.stringify(novo));
  check("sem erros (C)", m.erros.length === 0, m.erros[0]);
}

// v115: opening a volume or a série from the hub, a collection or the search opens its
// sheet over the tab you are on, instead of moving you to HQs or Séries.
console.log("=== abrir não troca de aba ===");
{
  const h = await montar({ aba: "hub" });
  h.root.querySelector(".wall .vol")?.click();
  await sleep(250);
  check("HQ do mural abre por cima do hub", !!h.root.querySelector('.sheet[data-in="true"], .sheet') && !!h.root.querySelector(".hub"), h.root.querySelector(".sheet") ? "" : "sem folha");
  const c = await montar({ aba: "colecoes" });
  c.root.querySelector('.aba[data-ativa="true"] .coll-strip .vol')?.click();
  await sleep(250);
  const ativa = c.root.querySelector('.segmented button[aria-selected="true"]')?.textContent.trim();
  check("HQ da coleção abre por cima de Coleções", ativa === "Coleções" && !!c.root.querySelector(".sheet"), ativa);
  check("sem erros (abas)", h.erros.length === 0 && c.erros.length === 0, h.erros[0] || c.erros[0]);
}

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
