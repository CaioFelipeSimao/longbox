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
    ["library/series", { items: [serie("s1", "Alfa", 8), serie("s2", "Beta", 2), serie("s3", "Gama", 4)] }],
    ["library/cores", { mapa: {} }],
    ["edicoes/s1", { items: s1 }],
    ["edicoes/s2", { items: [ed("s2", "1"), ed("s2", "2")] }],
    // v146: Gama's three reprints draw on Alfa (owned: 1, 2) and on a série not in the library.
    ["edicoes/s3", { items: [
      ed("s3", "1", { reimpressao: true, origem: "Alfa #1, #2", fontes: [{ serie: "Alfa", numero: "1" }, { serie: "Alfa", numero: "2" }] }),
      ed("s3", "2", { reimpressao: true, origem: "Alfa #1, #3", fontes: [{ serie: "Alfa", numero: "1" }, { serie: "Alfa", numero: "3" }] }),
      ed("s3", "3", { reimpressao: true, origem: "Alfa #1; Adventure Comics #123", fontes: [{ serie: "Alfa", numero: "1" }, { serie: "Adventure Comics (Volume 1)", numero: "123" }] }),
      // v147: owns every reprinted source but carries a story printed nowhere else.
      ed("s3", "4", { reimpressao: true, origem: "Alfa #1, #2", fontes: [{ serie: "Alfa", numero: "1" }, { serie: "Alfa", numero: "2" }, { inedita: true }] }),
    ] }],
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
  return { root, erros, sheet, tile, abrir, toggle, ficha, fichaDe, modal, digitar, salvo, window, docs };
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
// v149: the edição was a reprint, so unticking stores reimpressao:false (the user's "no").
check("desmarcar grava reimpressao false e tira a origem", m.salvo("s1-8") && m.salvo("s1-8").reimpressao === false && m.salvo("s1-8").origem === undefined, JSON.stringify(m.salvo("s1-8")));

console.log("=== reimpressão coberta pelas originais (v146) ===");
await m.abrir("Gama");
const contagemG = () => m.sheet().querySelector(".faltantes-cont .num")?.textContent.replace(/\s+/g, " ").trim();
check("coberta conta como possuída", m.tile("s3-1")?.dataset.owned === "true");
check("parcial continua faltando", m.tile("s3-2")?.dataset.owned === "false" && m.tile("s3-3")?.dataset.owned === "false");
check("a contagem inclui a coberta", /1 de 4 possuídas/.test(contagemG()), contagemG());
await m.fichaDe("s3-1");
check("ficha da coberta diz coberta pelas originais", /Coberta pelas originais/.test(m.ficha()?.textContent || ""), m.ficha()?.textContent);
check("ficha da coberta mostra o volume das originais", /Flash vol 1/.test(m.ficha()?.textContent || ""), m.ficha()?.textContent);
check("coberta sem volume próprio não diz nenhum volume vinculado", !/Nenhum volume vinculado/.test(m.ficha()?.textContent || ""), m.ficha()?.textContent);
await m.fichaDe("s3-2");
check("ficha da parcial conta as histórias", /Você tem 1 de 2 edições originais/.test(m.ficha()?.textContent || ""), m.ficha()?.textContent);
await m.fichaDe("s3-3");
check("origem fora do acervo é dita", /fora do acervo/.test(m.ficha()?.textContent || ""), m.ficha()?.textContent);
check("origem mostrada sem o (Volume N)", /Adventure Comics #123/.test(m.ficha()?.textContent || "") && !/\(Volume/.test(m.ficha()?.textContent || ""), m.ficha()?.textContent);
check("com história inédita não fica coberta, mesmo tendo as origens", m.tile("s3-4")?.dataset.owned === "false");
await m.fichaDe("s3-4");
check("a ficha diz que a história é inédita", /Você tem 2 de 2 edições originais/.test(m.ficha()?.textContent || "") && /História inédita · só nesta edição/.test(m.ficha()?.textContent || ""), m.ficha()?.textContent);
// v147: saving through the form keeps fontes (the form does not show them).
await m.fichaDe("s3-1");
m.sheet().querySelector('[aria-label="Editar edição"]').click();
await sleep(200);
[...m.modal().querySelectorAll("button")].find((b) => b.textContent.trim() === "Salvar").click();
await sleep(900);
const s31 = (m.docs.get("edicoes/s3").items || []).find((e) => e.id === "s3-1");
check("salvar pelo formulário mantém as fontes", Array.isArray(s31?.fontes) && s31.fontes.length === 2, JSON.stringify(s31));
await m.abrir("Alfa");
check("a série de origem não muda", /3 de 8 possuídas/.test(contagemG() || ""), contagemG());
check("a edição antiga abre a ficha sem erro", (() => { m.tile("s1-1").click(); return true; })());
await sleep(100);
check("ficha da edição antiga sem a linha de reimpressão", !/Reimpressão/.test(m.ficha()?.textContent || ""));
check("sem erros", m.erros.length === 0, m.erros[0]);

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
