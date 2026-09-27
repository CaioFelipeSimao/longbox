import { JSDOM } from "jsdom";
import fs from "node:fs";

// v88: removing a volume, collection, série or edição no longer asks first; it
// happens at once and the toast offers "Desfazer" for 8 seconds. Undo puts back the
// library exactly as it was before the removal (collection order, a série's edições
// and every volume's links to them), but only while nothing else has changed since:
// restoring the old library over a newer edit would silently throw that edit away.
// "Zerar tudo" keeps its confirmation and gets the undo too.

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

console.log("=== remover um volume e desfazer ===");
const m = await montar({ aba: "volumes" });
check("começa com 4 HQs", m.titulosHqs().length === 4, m.titulosHqs().join(", "));
await m.abrirHq("b1");
m.sheetAberta()?.querySelector('[aria-label="Remover"]')?.click();
await sleep(150);
check("remove sem perguntar", !m.root.textContent.includes("Remover este item?"));
check("a HQ some da estante", !m.titulosHqs().includes("Batman b1"), m.titulosHqs().join(", "));
check("a ficha fecha", !m.sheetAberta());
check("o aviso diz o que saiu", /Volume removido/.test(m.toast()?.textContent || ""), m.toast()?.textContent);
check("o aviso oferece desfazer", !!m.desfazer());
await sleep(700);
check("gravou a remoção no banco", !m.docs.get("library/volumes").items.some((x) => x.id === "b1"));
check("saiu da coleção no banco", JSON.stringify(m.docs.get("library/colecoes").items[0].membros) === '["b0","b2"]');
await sleep(2800);
check("o aviso com desfazer dura mais que os 3s de sempre", !!m.desfazer());
m.desfazer()?.click();
await sleep(150);
check("desfazer devolve a HQ", m.titulosHqs().includes("Batman b1"), m.titulosHqs().join(", "));
check("desfazer reabre a ficha que estava aberta", /Batman b1/.test(m.sheetAberta()?.textContent || ""));
check("o aviso confirma e perde o botão", !m.desfazer() && /Desfeito/.test(m.toast()?.textContent || ""), m.toast()?.textContent);
await sleep(700);
check("banco recebe a HQ de volta", m.docs.get("library/volumes").items.some((x) => x.id === "b1"));
check("volta para a mesma posição na coleção", JSON.stringify(m.docs.get("library/colecoes").items[0].membros) === '["b0","b1","b2"]', JSON.stringify(m.docs.get("library/colecoes").items[0].membros));
m.sheetAberta()?.querySelector('[aria-label="Fechar"]')?.click();
await sleep(400);

console.log("=== outra mudança depois da remoção apaga o desfazer ===");
await m.abrirHq("b2");
m.sheetAberta()?.querySelector('[aria-label="Remover"]')?.click();
await sleep(150);
check("desfazer oferecido", !!m.desfazer());
await m.abrirHq("b0");
m.botao("Lida", m.sheetAberta())?.click();
await sleep(150);
check("depois de mudar o status de outra HQ, o botão some", !m.desfazer());
await sleep(700);
const vols = m.docs.get("library/volumes").items;
check("a mudança nova fica", vols.find((x) => x.id === "b0").status === "lida");
check("a remoção também fica", !vols.some((x) => x.id === "b2"));
check("sem erros (volume)", m.erros.length === 0, m.erros[0]);

console.log("=== remover uma série e desfazer ===");
const s = await montar({ aba: "series" });
s.root.querySelector(".serie-row")?.click();
await sleep(150);
s.sheetAberta()?.querySelector('[aria-label="Remover"]')?.click();
await sleep(700);
check("série removida sem perguntar", !s.root.textContent.includes("Remover este item?") && !s.root.querySelector(".serie-row"));
check("aviso fala da série", /Série removida/.test(s.toast()?.textContent || ""), s.toast()?.textContent);
check("o banco perde as edições da série", !s.docs.has("edicoes/s1"));
check("e o vínculo do volume", s.docs.get("library/volumes").items.find((x) => x.id === "b0").edicoesColetadasIds.length === 0);
s.desfazer()?.click();
await sleep(700);
check("desfazer devolve a série", !!s.root.querySelector(".serie-row"));
check("com as três edições", (s.docs.get("edicoes/s1")?.items || []).length === 3);
check("e o vínculo do volume", JSON.stringify(s.docs.get("library/volumes").items.find((x) => x.id === "b0").edicoesColetadasIds) === '["e1","e2"]');
check("sem erros (série)", s.erros.length === 0, s.erros[0]);

console.log("=== zerar tudo continua perguntando ===");
const z = await montar({ aba: "hub" });
z.botao("Zerar tudo")?.click();
await sleep(150);
check("pergunta antes de zerar", z.root.textContent.includes("Zerar a biblioteca?"));
z.botao("Confirmar")?.click();
await sleep(700);
check("zerou o banco", z.docs.get("library/volumes").items.length === 0);
check("zerar também oferece desfazer", !!z.desfazer());
z.desfazer()?.click();
await sleep(700);
check("desfazer devolve tudo", z.docs.get("library/volumes").items.length === 4 && (z.docs.get("edicoes/s1")?.items || []).length === 3);
check("sem erros (zerar)", z.erros.length === 0, z.erros[0]);

// v99: importing a backup used to replace the library the moment the file was
// picked. Now it shows both counts, only replaces on "Substituir", and undoes.
console.log("=== importar backup pergunta e desfaz ===");
const im = await montar({ aba: "hub" });
const nv = (n) => ({ id: "n" + n, titulo: "Nightwing vol. " + n, personagem: "Nightwing", tipo: "Trade Paperback", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: [] });
const arquivo = { volumes: [nv(10), nv(2), nv(1)], colecoes: [], series: [], edicoes: [] };
const escolher = async (conteudo) => {
  const input = im.root.querySelector('input[type="file"]');
  Object.defineProperty(input, "files", { configurable: true, value: [new im.window.File([conteudo], "backup.json")] });
  input.dispatchEvent(new im.window.Event("change", { bubbles: true }));
  await sleep(200);
};
await escolher(JSON.stringify(arquivo));
check("pergunta antes de substituir", im.root.textContent.includes("Substituir a biblioteca?"));
const tabela = im.root.querySelector(".import-compara");
check("mostra agora e no arquivo", /Volumes\s*4\s*3/.test(tabela?.textContent.replace(/\s+/g, " ") || ""), tabela?.textContent);
im.botao("Cancelar", im.modalAberto())?.click();
await sleep(700);
check("cancelar não mexe no banco", im.docs.get("library/volumes").items.length === 4);
await escolher(JSON.stringify(arquivo));
im.botao("Substituir")?.click();
await sleep(700);
check("substituir grava o arquivo", im.docs.get("library/volumes").items.length === 3 && !im.docs.has("edicoes/s1"));
check("o aviso oferece desfazer", !!im.desfazer(), im.toast()?.textContent);
im.botao("HQs")?.click();
await sleep(200);
check("títulos em ordem numérica", im.titulosHqs().join(",") === "Nightwing vol. 1,Nightwing vol. 2,Nightwing vol. 10", im.titulosHqs().join(", "));
im.desfazer()?.click();
await sleep(700);
check("desfazer devolve a biblioteca de antes", im.docs.get("library/volumes").items.length === 4 && (im.docs.get("edicoes/s1")?.items || []).length === 3);
await escolher("{ isto não é json");
check("arquivo inválido não pergunta nada", !im.root.textContent.includes("Substituir a biblioteca?") && /Não consegui ler/.test(im.toast()?.textContent || ""));
check("sem erros (importar)", im.erros.length === 0, im.erros[0]);

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
