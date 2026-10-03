import { JSDOM } from "jsdom";
import fs from "node:fs";

// v145: reimpressões na série. A edição que reimprime outra leva um selo no mapa e
// uma linha na ficha ("Reimpressão de Flash #105 (1959)"); "Esconder reimpressões"
// tira esses números do mapa sem mexer em "tenho / falta" nem nos totais; o formulário
// da edição marca e desmarca. Edições antigas, sem os campos, continuam como eram.

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
    ...["1", "2", "3", "4", "5", "6"].map((n) => ed("s1", n)),
    ed("s1", "7", { reimpressao: true, origem: "" }),
    ed("s1", "8", { reimpressao: true, origem: "Flash #105 (1959)" }),
  ];
  const docs = new Map([
    ["library/volumes", { items: [{
      id: "v1", titulo: "Flash vol 1", personagem: "Flash", tipo: "Trade Paperback", editora: "DC Comics", ano: "2020",
      status: "nao_lida", notas: "", edicoesColetadasIds: ["s1-1", "s1-2", "s1-7"],
    }] }],
    ["library/colecoes", { items: [] }],
    ["library/series", { items: [serie("s1", "Alfa", 8), serie("s2", "Beta", 2)] }],
    ["library/cores", { mapa: {} }],
    ["edicoes/s1", { items: s1 }],
    ["edicoes/s2", { items: [ed("s2", "1"), ed("s2", "2")] }],
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

console.log("=== reimpressões na série ===");
const m = await montar();
await m.abrir("Alfa");
check("o selo marca a reimpressão 7", m.tile("s1-7")?.dataset.reimp === "true");
check("a edição 1 não leva selo", m.tile("s1-1") && m.tile("s1-1").dataset.reimp === undefined);
check("o rótulo falado diz reimpressão", /reimpressão/.test(m.tile("s1-7")?.getAttribute("aria-label") || ""), m.tile("s1-7")?.getAttribute("aria-label"));

m.tile("s1-8").click();
await sleep(100);
check("a ficha diz de onde veio", /Reimpressão de Flash #105 \(1959\)/.test(m.ficha()?.textContent || ""), m.ficha()?.textContent);

check("o botão de esconder existe na série com reimpressões", !!m.toggle() && /Esconder reimpressões/.test(m.toggle().textContent));
const contagem = () => m.sheet().querySelector(".faltantes-cont .num")?.textContent.replace(/\s+/g, " ").trim();
check("contagem antes de esconder", /3 de 8 possuídas/.test(contagem()), contagem());
m.toggle().click();
await sleep(100);
check("esconder tira os números 7 e 8 do mapa", !m.tile("s1-7") && !m.tile("s1-8"));
check("esconder mantém os números 1 a 6", ["1", "2", "3", "4", "5", "6"].every((n) => !!m.tile("s1-" + n)));
check("esconder não mexe nos totais", /3 de 8 possuídas/.test(contagem()), contagem());
check("o botão agora oferece mostrar", /Mostrar reimpressões/.test(m.toggle().textContent) && m.toggle().getAttribute("aria-pressed") === "true");
m.toggle().click();
await sleep(100);
check("mostrar traz os dois de volta", !!m.tile("s1-7") && !!m.tile("s1-8"));

await m.abrir("Beta");
check("série sem reimpressões não tem o botão", !!m.sheet() && !m.toggle());

console.log("=== formulário da edição ===");
await m.abrir("Alfa");
m.tile("s1-8").click();
await sleep(100);
m.sheet().querySelector('[aria-label="Editar edição"]').click();
await sleep(200);
const caixa = () => m.modal().querySelector('input[type="checkbox"]');
const original = () => [...m.modal().querySelectorAll(".field")].find((f) => f.querySelector("label")?.textContent.trim() === "Original")?.querySelector("input");
check("o formulário abre com a reimpressão marcada", !!caixa() && caixa().checked);
check("o campo Original traz a origem", original()?.value === "Flash #105 (1959)", original()?.value);
[...m.modal().querySelectorAll("button")].find((b) => b.textContent.trim() === "Salvar").click();
await sleep(900);
check("salvar sem mexer mantém reimpressão e origem", m.salvo("s1-8")?.reimpressao === true && m.salvo("s1-8")?.origem === "Flash #105 (1959)", JSON.stringify(m.salvo("s1-8")));

await m.fichaDe("s1-8");
m.sheet().querySelector('[aria-label="Editar edição"]').click();
await sleep(200);
caixa().click();
await sleep(100);
[...m.modal().querySelectorAll("button")].find((b) => b.textContent.trim() === "Salvar").click();
await sleep(900);
check("desmarcar remove reimpressão e origem do documento", m.salvo("s1-8") && m.salvo("s1-8").reimpressao === undefined && m.salvo("s1-8").origem === undefined, JSON.stringify(m.salvo("s1-8")));

check("a edição antiga abre a ficha sem erro", (() => { m.tile("s1-1").click(); return true; })());
await sleep(100);
check("ficha da edição antiga sem a linha de reimpressão", !/Reimpressão/.test(m.ficha()?.textContent || ""));
check("sem erros", m.erros.length === 0, m.erros[0]);

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
