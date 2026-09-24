import { JSDOM } from "jsdom";
import fs from "node:fs";

// v95: formats belong to publishers. Trade Paperback, Omnibus, Hardcover and Outro
// exist for any publisher; DC adds Compendium, Absolute Edition and DC Finest; Marvel
// adds Epic Collection and Marvel Masterworks. The volume form picks the publisher
// from the registered ones and offers that publisher's formats; switching to one that
// lacks the chosen format falls back to Trade Paperback and says so. The HQs format
// filter follows the publisher band. Stored values the lists do not know stay on offer.

const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0;
let passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DC_LISTA = "Trade Paperback,Compendium,Absolute Edition,DC Finest,Omnibus,Hardcover,Outro";
const MARVEL_LISTA = "Trade Paperback,Epic Collection,Marvel Masterworks,Omnibus,Hardcover,Outro";

async function montar({ sessao = {}, editoraSel = "__todas__", nomeMarvel = "Marvel Comics" } = {}) {
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
  window.sessionStorage.setItem("longbox:aba", "volumes");
  Object.entries(sessao).forEach(([k, v]) => window.sessionStorage.setItem(k, v));
  const vol = (id, titulo, editora, tipo) => ({ id, titulo, personagem: "Batman", tipo, editora, ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: [] });
  const ed = (id, nome) => ({ id, nome, cor: null, logoAssetId: null, logoFundo: "nenhum" });
  const docs = new Map([
    ["library/volumes", { items: [
      vol("a", "Batman: Ano Um", "DC Comics", "DC Finest"),
      vol("b", "Edição Antiga", "Editora Abril", "Formatinho"),
    ] }],
    ["library/colecoes", { items: [] }],
    ["library/series", { items: [] }],
    ["library/cores", { mapa: {} }],
    ["library/editoras", { itens: [ed("dc-comics", "DC Comics"), ed("marvel-comics", nomeMarvel)], selecionada: editoraSel }],
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
  const tecla = async (key) => {
    window.document.body.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    await sleep(150);
  };
  const modal = () => root.querySelector(".modal");
  // The form's native selects, found by their field label.
  const campo = (rotulo) => [...(modal()?.querySelectorAll(".field") || [])]
    .find((f) => f.querySelector("label")?.textContent === rotulo)?.querySelector("select");
  const opcoesDe = (sel) => [...(sel?.options || [])].map((o) => o.value || o.textContent);
  const escolher = async (sel, valor) => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set.call(sel, valor);
    sel.dispatchEvent(new window.Event("change", { bubbles: true }));
    await sleep(80);
  };
  const dicaDe = (rotulo) => [...(modal()?.querySelectorAll(".field") || [])]
    .find((f) => f.querySelector("label")?.textContent === rotulo)?.querySelector(".field-hint")?.textContent || "";
  const tiposDoFiltro = async () => {
    if (!root.querySelector("#filtro-tipo")) { root.querySelector(".btn-filtros").click(); await sleep(80); }
    root.querySelector("#filtro-tipo").click();
    await sleep(80);
    const fora = [...root.querySelectorAll("#filtro-tipo-lista [role=option]")].map((o) => o.textContent).slice(1);
    root.querySelector("#filtro-tipo").click();
    await sleep(60);
    return fora.join(",");
  };
  return { window, root, erros, docs, tecla, modal, campo, opcoesDe, escolher, dicaDe, tiposDoFiltro };
}

console.log("=== formulário de volume ===");
const m = await montar({ editoraSel: "dc-comics" });
await m.tecla("n");
check("Novo abre o formulário", !!m.modal());
const editora = m.campo("Editora");
check("editora é uma lista", !!editora && editora.tagName === "SELECT");
// "Editora Abril" is there because the app registers every publisher a stored
// volume already names (semearEditoras), which is what keeps old records whole.
check("lista traz Sem editora e as cadastradas", m.opcoesDe(editora).join(",") === "Sem editora,DC Comics,Marvel Comics,Editora Abril", m.opcoesDe(editora).join(","));
check("vem com a editora da faixa", editora.value === "DC Comics", editora.value);
const ordem = [...m.modal().querySelectorAll(".field label")].map((l) => l.textContent);
check("editora vem antes do tipo", ordem.indexOf("Editora") < ordem.indexOf("Tipo"), ordem.join(","));
check("DC oferece os formatos da DC", m.opcoesDe(m.campo("Tipo")).join(",") === DC_LISTA, m.opcoesDe(m.campo("Tipo")).join(","));
await m.escolher(m.campo("Tipo"), "DC Finest");
await m.escolher(m.campo("Editora"), "Marvel Comics");
check("Marvel oferece os formatos da Marvel", m.opcoesDe(m.campo("Tipo")).join(",") === MARVEL_LISTA, m.opcoesDe(m.campo("Tipo")).join(","));
check("DC Finest volta para Trade Paperback", m.campo("Tipo").value === "Trade Paperback", m.campo("Tipo").value);
check("e o formulário avisa", /DC Finest não existe na Marvel Comics/.test(m.dicaDe("Tipo")), m.dicaDe("Tipo"));
await m.escolher(m.campo("Tipo"), "Omnibus");
check("aviso some ao escolher outro tipo", m.dicaDe("Tipo") === "", m.dicaDe("Tipo"));
await m.escolher(m.campo("Editora"), "DC Comics");
check("formato comum sobrevive à troca", m.campo("Tipo").value === "Omnibus" && m.dicaDe("Tipo") === "", m.campo("Tipo").value);
await m.escolher(m.campo("Editora"), "");
check("sem editora, só os quatro comuns", m.opcoesDe(m.campo("Tipo")).join(",") === "Trade Paperback,Omnibus,Hardcover,Outro", m.opcoesDe(m.campo("Tipo")).join(","));
await m.tecla("Escape");
await sleep(250);

console.log("=== valor antigo fora das listas ===");
const t = await montar();
[...t.root.querySelectorAll('.aba[data-ativa="true"] .vol')].find((v) => /Edição Antiga/.test(v.textContent)).click();
await sleep(200);
await t.tecla("e");
check("edição abre o formulário", !!t.modal());
check("editora do volume antigo continua na lista", t.campo("Editora")?.value === "Editora Abril" && t.opcoesDe(t.campo("Editora")).includes("Editora Abril"), t.campo("Editora")?.value);
check("tipo antigo continua na lista", t.campo("Tipo")?.value === "Formatinho" && t.opcoesDe(t.campo("Tipo")).includes("Formatinho"), t.campo("Tipo")?.value);
t.modal().querySelector(".btn-primary").click();
await sleep(700);
const salvo = t.docs.get("library/volumes").items.find((v) => v.id === "b");
check("salvar sem mexer não reescreve nada", salvo.editora === "Editora Abril" && salvo.tipo === "Formatinho", salvo.editora + " " + salvo.tipo);
check("o aviso não vai para o volume", !("avisoTipo" in salvo));

console.log("=== filtro de formato segue a faixa ===");
const f1 = await montar();
check("Todas as editoras: todos os formatos", (await f1.tiposDoFiltro()) === "Trade Paperback,Compendium,Absolute Edition,DC Finest,Epic Collection,Marvel Masterworks,Omnibus,Hardcover,Outro");
const f2 = await montar({ editoraSel: "dc-comics" });
check("DC: formatos da DC", (await f2.tiposDoFiltro()) === DC_LISTA);
const f3 = await montar({
  editoraSel: "marvel-comics",
  sessao: { "longbox:filtros-hqs": JSON.stringify({ status: "", tipo: "DC Finest", personagem: "" }) },
});
check("Marvel: formatos da Marvel", (await f3.tiposDoFiltro()) === MARVEL_LISTA);
check("filtro salvo que a Marvel não tem é solto", f3.root.querySelector("#filtro-tipo").textContent === "Todos os tipos", f3.root.querySelector("#filtro-tipo").textContent);

const f4 = await montar({ editoraSel: "marvel-comics", nomeMarvel: "Marvel" });
check("editora cadastrada só como Marvel ganha os formatos da Marvel", (await f4.tiposDoFiltro()) === MARVEL_LISTA);

console.log("=== formulário de série ===");
const s = await montar({ sessao: { "longbox:aba": "series" } });
await s.tecla("n");
check("série: editora é uma lista", s.campo("Editora")?.tagName === "SELECT" && s.opcoesDe(s.campo("Editora")).join(",") === "Sem editora,DC Comics,Marvel Comics,Editora Abril", s.opcoesDe(s.campo("Editora")).join(","));

check("sem erros", [m, t, f1, f2, f3, f4, s].every((x) => x.erros.length === 0), [m, t, f1, f2, f3, f4, s].map((x) => x.erros[0]).find(Boolean));
console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
