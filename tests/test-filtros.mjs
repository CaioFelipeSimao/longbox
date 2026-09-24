import { JSDOM } from "jsdom";
import fs from "node:fs";

// v61: the HQs tab's filters survive a reload (sessionStorage) but not a fresh
// visit, and the publisher select in the filter panel became a character filter
// you can type into. A single mount can only show that a click changes the DOM;
// the feature is what a SECOND mount does with the first one's storage, and what
// a THIRD, storage-empty mount does. JSDOM instances do not share storage, so the
// value is carried across by hand, which is exactly what a reload keeps.

const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0;
let passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function biblioteca() {
  const v = (id, personagem, editora, status = "nao_lida") => ({
    id, titulo: personagem + " " + id, personagem, tipo: "Encadernado (TPB)", editora,
    ano: "2020", status, notas: "", edicoesColetadasIds: [],
  });
  return {
    volumes: [
      v("b1", "Batman", "DC Comics", "lida"), v("b2", "Batman", "DC Comics"), v("b3", "Batman", "DC Comics"),
      v("n1", "Nightwing", "DC Comics", "lida"), v("n2", "Nightwing", "DC Comics"),
      v("a1", "Capitão Átomo", "DC Comics"),
      v("d1", "Demolidor", "Marvel", "lida"), v("d2", "Demolidor", "Marvel"),
    ],
    editoras: [
      { id: "ed-dc", nome: "DC Comics", customOculta: false },
      { id: "ed-marvel", nome: "Marvel", cor: { h: 358, s: 74, l: 54 }, customOculta: false },
    ],
  };
}

async function montar({ sessao = {}, editoraSel = "__todas__" } = {}) {
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
  for (const [k, val] of Object.entries(sessao)) window.sessionStorage.setItem(k, val);

  const lib = biblioteca();
  const docs = new Map([
    ["library/volumes", { items: lib.volumes }],
    ["library/colecoes", { items: [] }],
    ["library/series", { items: [] }],
    ["library/cores", { mapa: {} }],
    ["library/editoras", { itens: lib.editoras, selecionada: editoraSel }],
  ]);
  const makeDoc = (path) => ({
    path,
    get: async () => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path), metadata: { fromCache: false, hasPendingWrites: false } }),
    set: async (body) => { docs.set(path, body); },
    delete: async () => { docs.delete(path); },
  });
  window.claude = {
    use: async (name) => name === "db" ? {
      doc: makeDoc,
      collection: (cpath) => ({ path: cpath, doc: (id) => makeDoc(cpath + "/" + id), get: async () => ({ docs: [], size: 0, empty: true, docChanges: () => [], metadata: {} }) }),
    } : null,
  };
  window.eval(bundle);
  await sleep(400);
  const root = window.document.getElementById("root");
  const setValor = (el, valor) => {
    const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, valor);
    el.dispatchEvent(new window.Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  };
  const tecla = (el, key) => el.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }));
  const grupos = () => [...root.querySelectorAll(".group-head h2")].map((h) => h.textContent);
  const salvo = () => window.sessionStorage.getItem("longbox:filtros-hqs");
  return { window, root, erros, setValor, tecla, grupos, salvo };
}

const abrirFiltros = async (m) => {
  if (!m.root.querySelector("#filtro-personagem")) {
    m.root.querySelector(".btn-filtros").click();
    await sleep(60);
  }
  return m.root.querySelector("#filtro-personagem");
};
const opcoes = (m) => [...m.root.querySelectorAll("#filtro-personagem-lista [role=option]")].map((o) => o.querySelector(".sug-title").textContent);

console.log("=== filtros: primeira montagem ===");
const m1 = await montar({ sessao: { "longbox:aba": "volumes" } });
const campo = await abrirFiltros(m1);
check("painel tem o filtro de personagem", !!campo && campo.getAttribute("role") === "combobox");
check("seletor de editora saiu do painel", !m1.root.querySelector('[aria-label="Filtrar por editora"]'));
check("começa sem filtro", campo.value === "" && m1.salvo() === null);
const botao = () => m1.root.querySelector(".btn-filtros");
check("botão sem contagem sem filtro", !botao().querySelector(".btn-badge") && botao().dataset.filtrando === "false");

campo.focus();
await sleep(60);
check("lista abre com Todos primeiro", opcoes(m1)[0] === "Todos os personagens", opcoes(m1).join(","));
check("lista em ordem, com todos da editora", opcoes(m1).slice(1).join(",") === "Batman,Capitão Átomo,Demolidor,Nightwing", opcoes(m1).join(","));
const nBatman = [...m1.root.querySelectorAll("#filtro-personagem-lista [role=option]")][1].querySelector(".pfiltro-n")?.textContent;
check("mostra quantas HQs cada um tem", nBatman === "3", nBatman);

m1.setValor(campo, "atomo");
await sleep(60);
check("digitar filtra sem acento nem caixa", opcoes(m1).join(",") === "Capitão Átomo", opcoes(m1).join(","));
m1.setValor(campo, "zzz");
await sleep(60);
check("nada encontrado tem mensagem", /Nenhum personagem/.test(m1.root.querySelector("#filtro-personagem-lista").textContent));
m1.tecla(campo, "Escape");
await sleep(60);
check("Esc fecha e mantém sem filtro", !m1.root.querySelector("#filtro-personagem-lista") && campo.value === "");

// Fold Batman first, so choosing him proves the filter forces his group open.
const foldBatman = m1.root.querySelector('[aria-label="Esconder as HQs de Batman"]');
check("existe a dobra do grupo Batman", !!foldBatman);
if (foldBatman) { foldBatman.click(); await sleep(60); }

campo.focus();
await sleep(60);
m1.setValor(campo, "bat");
await sleep(60);
m1.tecla(campo, "Enter");
await sleep(80);
check("Enter escolhe o personagem", campo.value === "Batman", campo.value);
check("só o grupo dele fica", m1.grupos().join(",") === "Batman", m1.grupos().join(","));
check("grupo recolhido abre ao filtrar", m1.root.querySelectorAll(".vol").length === 3, m1.root.querySelectorAll(".vol").length);

const status = m1.root.querySelector("#filtro-status");
check("status é o mesmo componente do personagem", status.tagName === "BUTTON" && status.getAttribute("role") === "combobox" && !m1.root.querySelector(".filtros-hqs select"));
check("status começa em Todos", status.textContent === "Todos os status", status.textContent);
status.click(); await sleep(60);
const opsStatus = [...m1.root.querySelectorAll("#filtro-status-lista [role=option]")].map((o) => o.textContent);
check("lista de status", opsStatus.join(",") === "Todos os status,Não lida,Lendo,Lida", opsStatus.join(","));
check("lista usa o estilo do personagem", m1.root.querySelector("#filtro-status-lista").classList.contains("pfiltro-lista"));
m1.tecla(status, "Escape"); await sleep(60);
check("Esc fecha a lista de status", !m1.root.querySelector("#filtro-status-lista"));
// Keyboard: open on ArrowDown, lands on the current (Todos), three down is Lida.
m1.tecla(status, "ArrowDown"); await sleep(40);
m1.tecla(status, "ArrowDown"); await sleep(20);
m1.tecla(status, "ArrowDown"); await sleep(20);
m1.tecla(status, "ArrowDown"); await sleep(20);
m1.tecla(status, "Enter"); await sleep(80);
check("teclado escolhe Lida", status.textContent === "Lida" && !m1.root.querySelector("#filtro-status-lista"), status.textContent);
const tipo = m1.root.querySelector("#filtro-tipo");
tipo.click(); await sleep(60);
// v95: under "Todas as editoras" every publisher's formats are on offer, the DC and
// Marvel lines included, so 9 formats plus "Todos os tipos" (was 7 plus 1).
check("lista de tipos com Todos primeiro", m1.root.querySelectorAll("#filtro-tipo-lista [role=option]").length === 10 && m1.root.querySelector("#filtro-tipo-lista [role=option]").textContent === "Todos os tipos", m1.root.querySelectorAll("#filtro-tipo-lista [role=option]").length);
m1.root.querySelector("#filtro-tipo-lista [role=option]").click(); await sleep(60);
check("escolher Todos os tipos deixa sem filtro de tipo", tipo.textContent === "Todos os tipos" && !m1.root.querySelector("#filtro-tipo-lista"));
check("status continua combinando", m1.root.querySelectorAll(".vol").length === 1);
check("botão conta dois filtros", botao().querySelector(".btn-badge")?.textContent === "2" && botao().getAttribute("aria-label") === "Filtros, 2 ativos", botao().getAttribute("aria-label"));
const guardado = m1.salvo();
check("filtros gravados na sessão", guardado && JSON.parse(guardado).personagem === "Batman" && JSON.parse(guardado).status === "lida", guardado);
check("nada no localStorage", m1.window.localStorage.getItem("longbox:filtros-hqs") === null);

// Tabs and the hub never unmount the app's state; checked anyway, since that is
// half of what was asked.
const abas = [...m1.root.querySelectorAll(".tabbar button")];
abas[1].click(); await sleep(60);
m1.root.querySelector('[aria-label="Voltar ao início"]').click(); await sleep(80);
check("chegou ao hub", !!m1.root.querySelector(".suggest-title, .hub"));
abas[0].click(); await sleep(80);
check("painel aberto continua aberto depois do hub", !!m1.root.querySelector("#filtro-personagem"));
botao().click(); await sleep(60);
check("fechar o painel mantém a contagem no botão", !m1.root.querySelector("#filtro-personagem") && botao().dataset.filtrando === "true" && botao().querySelector(".btn-badge")?.textContent === "2");
m1.root.querySelector('[aria-label="Voltar ao início"]').click(); await sleep(80);
m1.root.querySelectorAll(".tabbar button")[0].click(); await sleep(80);
check("painel fechado continua fechado depois do hub", !m1.root.querySelector("#filtro-personagem"));
const campoDepois = await abrirFiltros(m1);
check("trocar de aba e ir ao hub mantém os filtros", campoDepois.value === "Batman" && m1.grupos().join(",") === "Batman", campoDepois.value + " / " + m1.grupos().join(","));
// v64: one button clears the three panel filters, and only shows when there is
// something to clear.
const limpar = () => m1.root.querySelector(".filtros-linha .filtros-limpar");
check("Limpar filtros fica na linha dos filtros", !!limpar() && limpar().parentElement.querySelector("#filtro-status") !== null);
check("Limpar filtros ativo com filtro ativo", !limpar().disabled);
limpar().click(); await sleep(80);
check("Limpar filtros zera os três", m1.root.querySelector("#filtro-personagem").value === "" &&
  m1.root.querySelector("#filtro-status").textContent === "Todos os status" &&
  m1.root.querySelector("#filtro-tipo").textContent === "Todos os tipos" && m1.grupos().length === 4, m1.grupos().join(","));
check("Limpar filtros continua lá, desativado, sem filtro", !!limpar() && limpar().disabled && !botao().querySelector(".btn-badge"));
check("sessão limpa depois de limpar", m1.salvo() === null, m1.salvo());
check("sem editora com cor, a página não pega tom", !m1.root.querySelector(".app[data-ed-tint]"));
check("sem erros (1)", m1.erros.length === 0, m1.erros[0]);

console.log("=== segunda montagem: recarregar com a sessão da primeira ===");
const m2 = await montar({ sessao: { "longbox:aba": "volumes", "longbox:filtros-hqs": guardado } });
check("recarregar com filtro mostra a contagem", m2.root.querySelector(".btn-filtros .btn-badge")?.textContent === "2");
const campo2 = await abrirFiltros(m2);
check("recarregar mantém o personagem", campo2.value === "Batman", campo2.value);
check("recarregar mantém o status", m2.root.querySelector("#filtro-status").textContent === "Lida");
check("prateleira filtrada depois do recarregamento", m2.grupos().join(",") === "Batman" && m2.root.querySelectorAll(".vol").length === 1);
check("sem erros (2)", m2.erros.length === 0, m2.erros[0]);

console.log("=== terceira montagem: visita nova, sessão vazia ===");
const m3 = await montar({ sessao: { "longbox:aba": "volumes" } });
const campo3 = await abrirFiltros(m3);
check("visita nova começa sem filtro", campo3.value === "" && m3.root.querySelector("#filtro-status").textContent === "Todos os status");
check("visita nova mostra todos os grupos", m3.grupos().length === 4, m3.grupos().join(","));

console.log("=== quarta montagem: personagem salvo não existe na editora da faixa ===");
const m4 = await montar({
  sessao: { "longbox:aba": "volumes", "longbox:filtros-hqs": JSON.stringify({ status: "", tipo: "", personagem: "Batman" }) },
  editoraSel: "ed-marvel",
});
const campo4 = await abrirFiltros(m4);
check("filtro solta o personagem de outra editora", campo4.value === "", campo4.value);
check("prateleira não fica vazia", m4.grupos().join(",") === "Demolidor", m4.grupos().join(","));
campo4.focus(); await sleep(60);
check("lista só com a editora da faixa", opcoes(m4).slice(1).join(",") === "Demolidor", opcoes(m4).join(","));
check("sessão limpa quando nenhum filtro sobra", m4.salvo() === null, m4.salvo());
const app4 = m4.root.querySelector(".app");
check("editora com cor tinge a página fora do hub", app4.dataset.edTint === "true" && app4.style.getPropertyValue("--ed-hue") === "358", app4.dataset.edTint + " " + app4.style.getPropertyValue("--ed-hue"));
m4.root.querySelector('[aria-label="Voltar ao início"]').click(); await sleep(80);
check("o hub nunca pega o tom da editora", !m4.root.querySelector(".app[data-ed-tint]"));

console.log("=== quinta montagem: valores inválidos na sessão ===");
const m5 = await montar({ sessao: { "longbox:aba": "volumes", "longbox:filtros-hqs": "{nao e json" } });
const campo5 = await abrirFiltros(m5);
check("sessão corrompida cai em sem filtro", campo5.value === "" && m5.grupos().length === 4);
check("sem erros (5)", m5.erros.length === 0, m5.erros[0]);

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
