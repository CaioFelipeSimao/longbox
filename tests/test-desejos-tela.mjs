import { JSDOM } from "jsdom";
import fs from "node:fs";

const bundle = fs.readFileSync("dist/app.js", "utf8");
let passes = 0, falhas = 0;
const check = (nome, ok) => { if (ok) passes++; else falhas++; console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const volume = (id, personagem = "Flash", editora = "DC Comics") => ({ id, titulo: personagem + " " + id, personagem, editora, tipo: "Trade Paperback", ano: "", notas: "Loja da esquina, R$ 90", edicoesColetadasIds: [] });
async function montar(vazia = false, celular = false) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.test/" });
  const { window } = dom;
  const erros = [];
  window.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el }]); } unobserve() {} disconnect() {} };
  window.scrollTo = () => {};
  window.matchMedia = (q) => ({ matches: q.includes("pointer: fine") || (celular && q.includes("max-width")), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  window.addEventListener("error", (e) => erros.push(e.error?.stack || e.message));
  window.console.error = (...a) => erros.push(a.join(" "));
  window.sessionStorage.setItem("longbox:aba", "volumes");
  const desejos = vazia ? [] : [18, 19, 20, 21].map((i) => volume("d" + i)).concat({ ...volume("m1", "Thor", "Marvel Comics"), tipo: "Omnibus" });
  const docs = new Map([
    ["library/volumes", { items: Array.from({ length: 17 }, (_, i) => ({ ...volume("v" + i), status: "nao_lida" })) }],
    ["library/colecoes", { items: [{ id: "c1", nome: "Saga do Flash", membros: Array.from({ length: 17 }, (_, i) => "v" + i) }, { id: "c2", nome: "Outra saga", corBarra: { h: 210 }, membros: [] }] }],
    ["library/desejos", { items: desejos }],
    ["library/desejosColecoes", { items: vazia ? [] : [{ id: "dc1", nome: "Saga do Flash", colecaoId: "c1", membros: ["d18", "d19", "d20", "d21"] }] }],
    ["library/series", { items: [] }], ["library/cores", { mapa: {} }],
    ["library/editoras", { itens: [{ id: "dc", nome: "DC Comics", cor: { h: 210 } }, { id: "marvel", nome: "Marvel Comics", cor: { h: 0 } }], selecionada: "dc" }],
    ["library/fixados", { personagens: ["Batman"] }],
  ]);
  const doc = (path) => ({ path, get: async () => ({ exists: docs.has(path), data: () => docs.get(path), metadata: {} }), set: async (body) => docs.set(path, JSON.parse(JSON.stringify(body))), delete: async () => docs.delete(path) });
  window.claude = { use: async (n) => n === "db" ? { doc, collection: (c) => ({ doc: (id) => doc(c + "/" + id), get: async () => ({ docs: [], size: 0, empty: true, docChanges: () => [], metadata: {} }) }) } : null };
  window.eval(bundle); await sleep(450);
  const root = window.document.getElementById("root");
  const cart = () => root.querySelector('[data-dica="Lista de desejos · 4"]');
  const lista = () => root.querySelector(".desejos-capa");
  const click = async (el) => { el?.click(); await sleep(200); };
  const input = async (el, value) => { window.Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, value); el.dispatchEvent(new window.Event("input", { bubbles: true })); await sleep(180); };
  const sheet = () => root.querySelector('.sheet[data-in="true"][data-behind="false"]') || root.querySelector('.sheet[data-in="true"]');
  return { window, root, docs, erros, cart, lista, click, input, sheet };
}

const vazio = await montar(true);
check("sem desejos o carrinho não tem selo", !!vazio.cart() && !vazio.cart().querySelector(".btn-badge"));
await vazio.click(vazio.cart());
check("tela vazia oferece Novo desejo", /Nada na lista ainda/.test(vazio.lista()?.textContent) && [...(vazio.lista()?.querySelectorAll("button") || [])].some((b) => b.textContent.trim() === "Novo desejo"));

const m = await montar();
check("selo e nome acessível contam 5 desejos", m.cart()?.querySelector(".btn-badge")?.textContent === "5" && m.cart()?.getAttribute("aria-label") === "Lista de desejos, 5 itens");
check("carrinho fica antes da busca no computador", m.cart()?.nextElementSibling?.classList.contains("search"));
await m.click(m.cart());
check("lista agrupa por editora e ignora a faixa DC selecionada", /DC Comics/.test(m.lista()?.textContent) && /Marvel Comics/.test(m.lista()?.textContent));
check("faixa mostra 18 a 21", [...(m.lista()?.querySelectorAll(".slot-order") || [])].map((e) => e.textContent).join(",") === "18,19,20,21");
await m.click(m.lista()?.querySelector('[data-vid="d18"]'));
check("ficha oferece Comprei sem status", !!m.sheet() && /Comprei/.test(m.sheet().textContent) && !m.sheet().querySelector("[data-kind]"));
check("notas do desejo ficam em destaque", /Loja da esquina/.test(m.sheet()?.querySelector(".desejo-notas")?.textContent));
await m.click([...(m.sheet()?.querySelectorAll("button") || [])].find((b) => b.textContent.trim() === "Comprei"));
check("Comprei fecha ficha e oferece Desfazer", /Movido para o acervo/.test(m.root.querySelector(".toast")?.textContent) && !!m.root.querySelector(".toast button") && !m.root.querySelector('.sheet[data-in="true"]'));
await m.click(m.lista()?.querySelector('[aria-label="Voltar da lista de desejos"]'));
check("d18 aparece nas HQs depois da compra", !!m.root.querySelector('.aba[data-ativa="true"] [data-vid="d18"]'));
await m.click(m.root.querySelector(".toast button"));
await m.click(m.cart());
check("Desfazer devolve d18 à lista e restaura a numeração", !!m.lista()?.querySelector('[data-vid="d18"]') && m.lista()?.querySelector(".slot-order")?.textContent === "18" && !m.root.querySelector('.aba[data-ativa="true"] [data-vid="d18"]'));
await m.input(m.lista().querySelector('[aria-label="Buscar na lista de desejos"]'), "saga");
check("buscar saga deixa só a coleção", m.lista().querySelectorAll(".vol").length === 4 && !m.lista().querySelector('[data-vid="m1"]'));
await m.input(m.lista().querySelector('[aria-label="Buscar na lista de desejos"]'), "inexistente");
check("busca vazia tem mensagem própria", /Nada encontrado na lista/.test(m.lista().textContent));
await m.input(m.lista().querySelector('[aria-label="Buscar na lista de desejos"]'), "");
await m.click(m.lista().querySelector('[aria-label="Filtros"]'));
await m.click(m.lista().querySelector("#desejos-tipo"));
await m.click([...m.lista().querySelectorAll('#desejos-tipo-lista [role="option"]')].find((b) => b.textContent.trim() === "Omnibus"));
check("filtro de formato deixa só o desejo solto e conta o ativo", m.lista().querySelectorAll(".vol").length === 1 && !!m.lista().querySelector('[data-vid="m1"]') && m.lista().querySelector(".btn-filtros .btn-badge")?.textContent === "1");
await m.click([...m.lista().querySelectorAll("button")].find((b) => b.textContent.trim() === "Limpar filtros"));
await m.click(m.lista().querySelector("#desejos-editora"));
await m.click([...m.lista().querySelectorAll('#desejos-editora-lista [role="option"]')].find((b) => b.textContent.trim() === "DC Comics"));
check("filtro da lista por editora deixa a faixa", m.lista().querySelectorAll(".vol").length === 4 && !m.lista().querySelector('[data-vid="m1"]'));
await m.click([...m.lista().querySelectorAll("button")].find((b) => b.textContent.trim() === "Limpar filtros"));
await m.click(m.lista().querySelector('[aria-label="Filtros"]'));
await m.click(m.lista().querySelector('[aria-label="Fixar Flash no topo"]'));
await sleep(250);
check("fixados da lista são independentes", m.docs.get("library/fixados")?.personagens.join() === "Batman" && m.docs.get("library/fixadosDesejos")?.personagens.includes("Flash"));

const escolherColecao = async (rotulo) => {
  await m.click(m.root.querySelector("#form-desejo-colecao"));
  await m.click([...(m.root.querySelectorAll('#form-desejo-colecao-lista [role="option"]') || [])].find((b) => b.textContent.trim() === rotulo));
};
const novo = async (titulo, colecao, nomeNovo) => {
  await m.click([...m.lista().querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Novo desejo"));
  const inputs = m.root.querySelectorAll(".modal-body input.input");
  await m.input(inputs[0], titulo); await m.input(inputs[1], "Flash");
  await escolherColecao(colecao);
  if (nomeNovo) await m.input(m.root.querySelector('[aria-label="Nome da coleção"]'), nomeNovo);
  await m.click([...m.root.querySelectorAll(".modal button")].find((b) => b.textContent.trim() === "Salvar e fechar"));
  await sleep(650);
  const salvo = m.docs.get("library/desejos")?.items.find((d) => d.titulo === titulo);
  await m.click(m.sheet()?.querySelector('[aria-label="Fechar"]'));
  await sleep(250);
  return salvo;
};
const n1 = await novo("Desejo novo da lista", "Saga do Flash (lista)");
check("formulário grava desejo sem status na coleção da lista", !!n1 && !("status" in n1) && m.docs.get("library/desejosColecoes")?.items.find((c) => c.id === "dc1")?.membros.includes(n1.id));
const n2 = await novo("Desejo novo do acervo", "Saga do Flash (acervo)");
check("escolher acervo reaproveita a coleção da lista", !!n2 && m.docs.get("library/desejosColecoes")?.items.filter((c) => c.colecaoId === "c1").length === 1 && m.docs.get("library/desejosColecoes")?.items.find((c) => c.id === "dc1")?.membros.includes(n2.id));
const n3 = await novo("Desejo de outra saga", "Outra saga (acervo)");
const cd2 = m.docs.get("library/desejosColecoes")?.items.find((c) => c.colecaoId === "c2");
check("escolher acervo cria coleção da lista com nome e cor", !!n3 && cd2?.nome === "Outra saga" && cd2.corBarra?.h === 210 && cd2.membros.includes(n3.id));
const n4 = await novo("Desejo de coleção nova", "Nova coleção", "Coleção só da lista");
const novaCol = m.docs.get("library/desejosColecoes")?.items.find((c) => c.nome === "Coleção só da lista");
check("Nova coleção nasce sem colecaoId", !!n4 && !!novaCol && !("colecaoId" in novaCol) && novaCol.membros.includes(n4.id));
check("formulário de desejo preserva os volumes do acervo", m.docs.get("library/volumes")?.items.length === 17);
await m.click(m.lista().querySelector('[data-vid="' + n4?.id + '"]'));
await m.click(m.sheet()?.querySelector('[aria-label="Editar"]'));
check("editar desejo usa o modo desejo", m.root.querySelector(".modal .t-display")?.textContent === "Editar desejo" && !m.root.querySelector(".modal [data-kind]"));
await escolherColecao("Saga do Flash (lista)");
await m.click([...m.root.querySelectorAll(".modal button")].find((b) => b.textContent.trim() === "Salvar"));
await sleep(650);
check("editar transfere o membro e remove coleção que esvaziou", !m.docs.get("library/desejosColecoes")?.items.some((c) => c.id === novaCol?.id) && m.docs.get("library/desejosColecoes")?.items.find((c) => c.id === "dc1")?.membros.filter((id) => id === n4?.id).length === 1);
await m.click(m.sheet()?.querySelector('[aria-label="Remover"]'));
check("apagar desejo oferece Desfazer e tira a capa", !!m.root.querySelector(".toast button") && !m.lista().querySelector('[data-vid="' + n4?.id + '"]'));
await m.click(m.root.querySelector(".toast button"));
check("Desfazer exclusão restaura desejo e ficha", !!m.lista().querySelector('[data-vid="' + n4?.id + '"]') && m.sheet()?.querySelector(".sheet-head .t-display")?.textContent === n4?.titulo);
check("textos da lista e ficha não usam travessão nem meia-risca", !/[\u2013\u2014]/.test(m.lista().textContent + m.sheet()?.textContent));
const phone = await montar(true, true);
check("no celular o carrinho fica na barra de baixo, não no topo", !phone.cart() && !!phone.root.querySelector(".tabbar .tabbar-carrinho"));
check("sem erros de renderização", [vazio, m, phone].every((x) => !x.erros.length));
console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
