import { JSDOM } from "jsdom";
import fs from "node:fs";

// Q4 (v91): keyboard shortcuts. "/" search, 1 2 3 tabs, N new, E edit what is open,
// Ctrl+Z undo the last removal, ? the list of shortcuts. None fires while typing in
// a field, none but Esc while a modal is up, letters and digits never with Ctrl or
// Alt (Ctrl+1 and Ctrl+N belong to the browser), and Ctrl+Z only when there is a
// removal to undo; otherwise it stays the browser's.

const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0;
let passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function montar(aba) {
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
  const v = (id) => ({ id, titulo: "Batman " + id, personagem: "Batman", tipo: "Trade Paperback", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: [] });
  const docs = new Map([
    ["library/volumes", { items: [v("a"), v("b")] }],
    ["library/colecoes", { items: [{ id: "c1", nome: "Saga", descricao: "", membros: ["a"] }] }],
    ["library/series", { items: [{ id: "s1", nome: "Batman (Volume 1)", personagens: [{ nome: "Batman", de: null, ate: null }], editora: "DC Comics", anoInicio: "1940", anoFim: "", totalEdicoes: 2, ordem: null }] }],
    ["library/cores", { mapa: {} }],
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
  const tecla = async (key, opcoes = {}, alvo = window.document.body) => {
    const ev = new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...opcoes });
    alvo.dispatchEvent(ev);
    await sleep(150);
    return ev;
  };
  const NOMES = { "HQs": "volumes", "Coleções": "colecoes", "Séries": "series" };
  const abaAtiva = () => {
    const b = root.querySelector('.segmented button[data-active="true"]');
    return b ? NOMES[b.textContent.trim()] : "hub";
  };
  const tituloModal = () => root.querySelector(".modal .t-display")?.textContent || null;
  const tituloSheet = () => [...root.querySelectorAll(".sheet")].find((s) => s.dataset.in === "true" && s.dataset.behind !== "true")?.querySelector(".sheet-head .t-display")?.textContent || null;
  const fecharTudo = async () => { for (let i = 0; i < 3; i++) await tecla("Escape"); await sleep(250); };
  return { window, root, erros, docs, tecla, abaAtiva, tituloModal, tituloSheet, fecharTudo };
}

console.log("=== navegar ===");
const m = await montar("volumes");
await m.tecla("2");
check("2 abre Coleções", m.abaAtiva() === "colecoes", m.abaAtiva());
await m.tecla("3");
check("3 abre Séries", m.abaAtiva() === "series", m.abaAtiva());
await m.tecla("1");
check("1 abre HQs", m.abaAtiva() === "volumes", m.abaAtiva());
await m.tecla("2", { ctrlKey: true });
check("Ctrl+2 fica para o navegador", m.abaAtiva() === "volumes", m.abaAtiva());
const barra = await m.tecla("/");
const busca = m.root.querySelector(".search input");
check("/ vai para a busca", m.window.document.activeElement === busca);
check("/ não escreve a barra na busca", barra.defaultPrevented);
await m.tecla("2", {}, busca);
check("digitando na busca, 2 não troca de aba", m.abaAtiva() === "volumes", m.abaAtiva());
busca.blur();

console.log("=== novo e editar ===");
await m.tecla("n");
check("N na aba HQs abre Novo volume", m.tituloModal() === "Novo volume", m.tituloModal());
await m.tecla("2");
check("com o formulário aberto, 2 não troca de aba", m.abaAtiva() === "volumes", m.abaAtiva());
await m.fecharTudo();
await m.tecla("3");
await m.tecla("N", { shiftKey: false });
check("N na aba Séries abre Nova série", m.tituloModal() === "Nova série", m.tituloModal());
await m.fecharTudo();
await m.tecla("n", { ctrlKey: true });
check("Ctrl+N fica para o navegador", m.tituloModal() === null, m.tituloModal());
await m.tecla("1");
[...m.root.querySelectorAll('.aba[data-ativa="true"] .vol')][0].click();
await sleep(200);
check("a ficha abriu", m.tituloSheet() === "Batman a", m.tituloSheet());
await m.tecla("2");
check("com a ficha aberta, 2 não troca de aba", m.abaAtiva() === "volumes" && m.tituloSheet() === "Batman a");
await m.tecla("e");
check("E edita o volume aberto", m.tituloModal() === "Editar volume", m.tituloModal());
await m.fecharTudo();

console.log("=== desfazer ===");
const semNada = await m.tecla("z", { ctrlKey: true });
check("Ctrl+Z sem remoção fica para o navegador", !semNada.defaultPrevented);
[...m.root.querySelectorAll('.aba[data-ativa="true"] .vol')][0].click();
await sleep(200);
m.root.querySelector('.sheet[data-in="true"] [aria-label="Remover"]').click();
await sleep(200);
check("removeu", m.root.querySelectorAll('.aba[data-ativa="true"] .vol').length === 1);
const noCampo = await m.tecla("z", { ctrlKey: true }, m.root.querySelector(".search input"));
check("Ctrl+Z dentro de um campo desfaz o texto, não a remoção", !noCampo.defaultPrevented && m.root.querySelectorAll('.aba[data-ativa="true"] .vol').length === 1);
const desfez = await m.tecla("z", { ctrlKey: true });
check("Ctrl+Z desfaz a remoção", desfez.defaultPrevented && m.root.querySelectorAll('.aba[data-ativa="true"] .vol').length === 2);
await m.fecharTudo();

console.log("=== painel ===");
await m.tecla("?", { shiftKey: true });
check("? abre a lista de atalhos", m.tituloModal() === "Atalhos do teclado", m.tituloModal());
const teclas = [...(m.root.querySelector(".modal")?.querySelectorAll("kbd") || [])].map((k) => k.textContent);
const esperadas = ["/", "1", "2", "3", "N", "?", "E", "←", "→", "Ctrl+V", "Esc", "Ctrl+Z"];
check("a lista traz todas as teclas", esperadas.every((t) => teclas.includes(t)), teclas.join(" "));
const escLista = await m.tecla("Escape");
await sleep(300);
check("Esc fecha a lista", m.tituloModal() === null, m.tituloModal());
// The host runtime pulls focus out of the artifact on any Esc left unprevented.
check("Esc com a lista aberta não sai do app", escLista.defaultPrevented);
const escSolto = await m.tecla("Escape");
check("Esc sem nada aberto também não sai do app", escSolto.defaultPrevented);

console.log("=== dicas ===");
const dica = (el) => (el && el.getAttribute("data-dica")) || "";
check("Novo mostra N na dica", /· N$/.test(dica([...m.root.querySelectorAll("button")].find((b) => b.textContent.trim() === "Novo"))), dica([...m.root.querySelectorAll("button")].find((b) => b.textContent.trim() === "Novo")));
const abas = [...m.root.querySelectorAll(".segmented button")];
check("as abas mostram 1 2 3", abas.length === 3 && abas.every((b, i) => dica(b).endsWith("· " + (i + 1))), abas.map(dica).join(" | "));
check("a busca mostra /", /· \/$/.test(dica(m.root.querySelector(".search-field"))), dica(m.root.querySelector(".search-field")));
[...m.root.querySelectorAll('.aba[data-ativa="true"] .vol')][0].click();
await sleep(200);
check("editar na ficha mostra E", /· E$/.test(dica(m.root.querySelector('.sheet[data-in="true"] [aria-label="Editar"]'))), dica(m.root.querySelector('.sheet[data-in="true"] [aria-label="Editar"]')));
m.root.querySelector('.sheet[data-in="true"] [aria-label="Remover"]').click();
await sleep(200);
check("Desfazer mostra Ctrl+Z", /Ctrl\+Z/.test(dica(m.root.querySelector(".toast button"))), dica(m.root.querySelector(".toast button")));
await m.tecla("z", { ctrlKey: true });
await m.fecharTudo();

console.log("=== hub ===");
const h = await montar("hub");
await h.tecla("/");
await sleep(300);
check("/ no hub vai para a aba HQs e para a busca", h.abaAtiva() === "volumes" && h.window.document.activeElement === h.root.querySelector(".search input"));
check("sem erros", m.erros.length === 0 && h.erros.length === 0, m.erros[0] || h.erros[0]);

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
