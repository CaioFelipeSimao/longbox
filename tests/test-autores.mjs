import { JSDOM } from "jsdom";
import fs from "node:fs";

// v146: writer, penciler e inker na ficha da edição e no formulário. Cada papel é uma
// lista; o formulário aceita vários nomes separados por vírgula ou ponto e vírgula, tira
// repetidos, e não grava "autores" quando os três ficam vazios. Salvar não pode apagar
// reimpressao/origem (v145). Edição sem autores mostra a ficha como antes.

const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0;
let passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function montar() {
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
  window.sessionStorage.setItem("longbox:aba", "series");
  window.sessionStorage.setItem("longbox:series-abertas", JSON.stringify(["Flash"]));

  const serie = (id, nome, total) => ({ id, nome, personagens: [{ nome: "Flash", de: null, ate: null }], editora: "DC Comics", anoInicio: "1987", anoFim: "1990", totalEdicoes: total, ordem: null });
  const ed = (sid, numero, extra = {}) => ({ id: sid + "-" + numero, serieId: sid, numero, mes: "", ano: "", posicao: null, ...extra });
  const s1 = [
    ed("s1", "1", { autores: { writer: ["Mark Waid"], penciler: ["Mike Wieringo", "Paul Ryan"], inker: [] }, reimpressao: true, origem: "Flash #1 (1987)" }),
    ed("s1", "2"),
    ed("s1", "3", { autores: { writer: ["Grant Morrison", "Waid Exclusivo"] } }),
  ];
  const docs = new Map([
    ["library/volumes", { items: [{
      id: "v1", titulo: "Flash vol 1", personagem: "Flash", tipo: "Trade Paperback", editora: "DC Comics", ano: "2020",
      status: "nao_lida", notas: "", edicoesColetadasIds: ["s1-1", "s1-2"],
    }, { id: "v2", titulo: "Outro volume", personagem: "Outro", tipo: "Trade Paperback", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: ["s2-1", "ausente"] }] }],
    ["library/colecoes", { items: [] }],
    ["library/series", { items: [serie("s1", "Alfa", 3), serie("s2", "Beta", 2)] }],
    ["library/cores", { mapa: {} }],
    ["edicoes/s1", { items: s1 }],
    ["edicoes/s2", { items: [ed("s2", "1"), ed("s2", "2", { autores: { writer: ["Mark Waid", "Waid Exclusivo"] } })] }],
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
  const sheet = () => root.querySelector('.sheet[data-in="true"]');
  const tile = (id) => sheet() && sheet().querySelector('.tile[data-ed="' + id + '"]');
  const abrir = async (nome) => {
    const fechar = sheet() && sheet().querySelector('[aria-label="Fechar"]');
    if (fechar) { fechar.click(); await sleep(400); }
    [...root.querySelectorAll(".serie-row")].find((r) => r.textContent.includes(nome))?.click();
    await sleep(150);
  };
  const toggle = () => sheet() && sheet().querySelector(".reimp-toggle");
  const ficha = () => sheet() && sheet().querySelector(".edicao-pinned");
  const modal = () => root.querySelector(".modal");
  const digitar = (el, v) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, v);
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  };
  // clicking the picked tile again closes its ficha, so only click when it is shut
  const fichaDe = async (id) => {
    if (!sheet().querySelector('.tile[data-ed="' + id + '"][data-sel="true"]')) { sheet().querySelector('.tile[data-ed="' + id + '"]').click(); await sleep(100); }
  };
  const salvo = (id) => (docs.get("edicoes/s1").items || []).find((e) => e.id === id);
  return { root, erros, sheet, tile, abrir, toggle, ficha, fichaDe, modal, digitar, salvo, window };
}

console.log("=== autores na ficha ===");
const m = await montar();
await m.abrir("Alfa");
await m.fichaDe("s1-1");
const txt = () => (m.ficha()?.textContent || "").replace(/\s+/g, " ");
check("ficha mostra Writer e o nome", /Writer\s*Mark Waid/.test(txt()), txt());
check("ficha junta vários nomes com vírgula", /Penciler\s*Mike Wieringo, Paul Ryan/.test(txt()), txt());
check("papel vazio não aparece", !/Inker/.test(txt()), txt());
await m.fichaDe("s1-2");
check("edição sem autores não mostra nenhum papel", !/Writer|Penciler|Inker/.test(txt()), txt());

console.log("=== formulário ===");
const campo = (rot) => [...m.modal().querySelectorAll(".field")].find((f) => f.querySelector("label")?.textContent.trim() === rot)?.querySelector("input");
const salvar = async () => { [...m.modal().querySelectorAll("button")].find((b) => b.textContent.trim() === "Salvar").click(); await sleep(900); };
await m.fichaDe("s1-1");
m.sheet().querySelector('[aria-label="Editar edição"]').click();
await sleep(200);
check("formulário traz Writer preenchido", campo("Writer")?.value === "Mark Waid", campo("Writer")?.value);
check("formulário traz Penciler com os dois nomes", campo("Penciler")?.value === "Mike Wieringo, Paul Ryan", campo("Penciler")?.value);
check("formulário traz Inker vazio", campo("Inker")?.value === "", campo("Inker")?.value);
m.digitar(campo("Inker"), "Jose Marzan Jr.; Jose Marzan Jr.");
await sleep(50);
await salvar();
const e1 = m.salvo("s1-1");
check("inker gravado como lista, sem repetido", JSON.stringify(e1?.autores?.inker) === JSON.stringify(["Jose Marzan Jr."]), JSON.stringify(e1?.autores));
check("writer e penciler mantidos", JSON.stringify(e1?.autores?.writer) === JSON.stringify(["Mark Waid"]) && e1?.autores?.penciler?.length === 2, JSON.stringify(e1?.autores));
check("salvar mantém reimpressão e origem", e1?.reimpressao === true && e1?.origem === "Flash #1 (1987)", JSON.stringify(e1));
check("campos auxiliares do formulário não vão para o banco", e1 && !("autoresWriter" in e1) && !("autoresPenciler" in e1) && !("autoresInker" in e1), JSON.stringify(e1));

await m.fichaDe("s1-2");
m.sheet().querySelector('[aria-label="Editar edição"]').click();
await sleep(200);
await salvar();
const e2 = m.salvo("s1-2");
check("edição sem nomes continua sem a chave autores", e2 && !("autores" in e2), JSON.stringify(e2));
check("sem erros", m.erros.length === 0, m.erros[0]);

console.log("=== busca por autor ===");
const b = await montar();
const trocarAba = async (idx) => { b.root.querySelectorAll(".segmented button")[idx].click(); await sleep(120); };
const buscar = async (q) => { b.digitar(b.root.querySelector("#busca-acervo"), q); await sleep(120); };
const ativa = () => b.root.querySelector('.aba[data-ativa="true"]');
const volumes = () => [...ativa().querySelectorAll(".vol")].map((v) => v.textContent).join(" | ");
const series = () => [...ativa().querySelectorAll(".serie-row")].map((v) => v.textContent).join(" | ");
await trocarAba(0);
for (const q of ["waid", "WAID", "wáid", "Wieringo"]) {
  await buscar(q);
  check("HQs: autor possuído por " + q + " encontra só v1", volumes().includes("Flash vol 1") && !volumes().includes("Outro volume"), volumes());
}
await buscar("Waid Exclusivo");
check("HQs: autor não possuído mostra Nada encontrado", volumes() === "" && ativa().textContent.includes("Nada encontrado"));
await trocarAba(2);
for (const q of ["waid", "WAID", "wáid", "Wieringo"]) {
  await buscar(q);
  check("Séries: autor possuído por " + q + " encontra só Alfa", series().includes("Alfa") && !series().includes("Beta"), series());
}
await buscar("Waid Exclusivo");
check("Séries: autor não possuído mostra Nada encontrado", series() === "" && ativa().textContent.includes("Nada encontrado"));
await buscar("Autor inexistente");
check("Séries: autor desconhecido mostra Nada encontrado", ativa().textContent.includes("Nada encontrado"));
await trocarAba(0);
await buscar("Autor inexistente");
check("HQs: autor desconhecido mostra Nada encontrado", ativa().textContent.includes("Nada encontrado"));
check("busca sem erros em edição antiga ou id ausente", b.erros.length === 0, b.erros[0]);
b.window.close();
m.window.close();

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
