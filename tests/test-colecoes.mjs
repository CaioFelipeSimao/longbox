import { JSDOM } from "jsdom";
import fs from "node:fs";

// v66: the collection manage sheet folds its reading order (kept per session) and
// offers a colour for the collection's spine bar, but only while that bar is on
// screen. JSDOM computes no layout, so every strip would measure 0 wide and no bar
// would ever show; scrollWidth and clientWidth are stubbed per strip instead, one
// collection overflowing and one fitting, which is exactly the fact the sheet
// depends on.
//
// v80: the sheet no longer asks the bar. A folded collection has no strip, and
// its colour option vanished with it, so the sheet works the answer out from the
// column's width instead. .content is stubbed 560 wide to match the strips.

const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0;
let passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function montar({ sessao = {}, docsIniciais } = {}) {
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
  for (const [k, v] of Object.entries(sessao)) window.sessionStorage.setItem(k, v);

  // A strip holding more than four covers overflows; four or fewer fit.
  const P = window.HTMLElement.prototype;
  Object.defineProperty(P, "scrollWidth", { configurable: true, get() {
    return this.classList && this.classList.contains("coll-strip") ? this.children.length * 138 : 0;
  } });
  Object.defineProperty(P, "clientWidth", { configurable: true, get() {
    return this.classList && (this.classList.contains("coll-strip") || this.classList.contains("content")) ? 560 : 0;
  } });

  const v = (id) => ({ id, titulo: "Batman " + id, personagem: "Batman", tipo: "Encadernado (TPB)", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: [] });
  const volumes = Array.from({ length: 10 }, (_, i) => v("b" + i));
  const docs = new Map(docsIniciais || [
    ["library/volumes", { items: volumes }],
    ["library/colecoes", { items: [
      { id: "longa", nome: "Longa", descricao: "", membros: volumes.slice(0, 8).map((x) => x.id) },
      { id: "curta", nome: "Curta", descricao: "", membros: volumes.slice(0, 3).map((x) => x.id) },
    ] }],
    ["library/series", { items: [] }],
    ["library/cores", { mapa: {} }],
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
  const secao = (nome) => [...root.querySelectorAll(".coll")].find((s) => s.querySelector("h2")?.textContent === nome);
  const gerenciar = async (nome) => {
    [...secao(nome).querySelectorAll("button")].find((b) => b.textContent === "Gerenciar").click();
    await sleep(120);
  };
  const fechar = async () => { root.querySelector('.sheet [aria-label="Fechar"]').click(); await sleep(400); };
  return { window, root, erros, docs, secao, gerenciar, fechar };
}

console.log("=== coleções: primeira montagem ===");
const m1 = await montar({ sessao: { "longbox:aba": "colecoes" } });
check("barra da coleção longa aparece", !m1.secao("Longa").querySelector(".shelf-bar").hidden);
check("barra da coleção curta fica escondida", m1.secao("Curta").querySelector(".shelf-bar").hidden);

await m1.gerenciar("Longa");
const sheet = () => m1.root.querySelector(".sheet[data-in='true']") || m1.root.querySelector(".sheet");
const head = () => m1.root.querySelector(".ordem-head");
check("ordem de leitura tem cabeçalho dobrável", head() && head().getAttribute("aria-expanded") === "true");
check("lista aberta mostra os 8", m1.root.querySelectorAll('.sheet .ordem-linha').length === 8);
check("cor da barra oferecida quando a barra existe", !!m1.root.querySelector(".cor-barra"));
check("começa na cor da editora", /Usando a cor da editora/.test(m1.root.querySelector(".cor-barra").textContent));

head().click(); await sleep(80);
check("recolher esconde a lista", head().getAttribute("aria-expanded") === "false" && m1.root.querySelectorAll('.sheet .ordem-linha').length === 0);
check("recolhido mostra a contagem", head().textContent.includes("8"));
const guardado = m1.window.sessionStorage.getItem("longbox:ordem-recolhida");
check("recolhido gravado na sessão", guardado === JSON.stringify(["longa"]), guardado);

const sw = m1.root.querySelectorAll(".cor-barra .swatch");
// v67: the character palette (30 + 3 neutrals) plus the Longbox cyan among the neutrals.
check("paleta dos personagens mais o ciano Longbox", sw.length === 34, sw.length);
const nomes = [...m1.root.querySelectorAll(".cor-barra .dica-swatch")].map((d) => d.dataset.dica);
check("toda cor tem nome", nomes.length === 34 && nomes.every((n) => n && n !== "Cor"), nomes.filter((n) => !n || n === "Cor").length);
check("nomes não se repetem", new Set(nomes).size === 34);
check("o nome também é o rótulo acessível", [...sw].every((b) => b.getAttribute("aria-label") === b.parentElement.dataset.dica));
const ciano = [...sw].find((b) => b.getAttribute("aria-label") === "Ciano Longbox");
check("ciano Longbox está nos neutros", !!ciano && nomes.indexOf("Ciano Longbox") === 33);
ciano.click(); await sleep(700);
const docCiano = m1.docs.get("library/colecoes").items.find((c) => c.id === "longa");
check("ciano salvo como marcador, não como matiz", docCiano.corBarra && docCiano.corBarra.longbox === true && docCiano.corBarra.h === undefined, JSON.stringify(docCiano.corBarra));
check("barra lê o ciano ao vivo", m1.secao("Longa").querySelector(".shelf-wrap").style.getPropertyValue("--shelf-cor") === "var(--accent)");
check("só o ciano aparece marcado", m1.root.querySelectorAll(".cor-barra .swatch[data-on=\"true\"]").length === 1 && ciano.dataset.on === "true");
// Writes are debounced 500ms (scheduleSave), so wait past that before reading the db.
sw[4].click(); await sleep(700);
const doc = m1.docs.get("library/colecoes").items.find((c) => c.id === "longa");
check("cor salva na coleção", doc.corBarra && typeof doc.corBarra.h === "number", JSON.stringify(doc.corBarra));
const wrap = m1.secao("Longa").querySelector(".shelf-wrap");
check("barra pinta com a cor escolhida", wrap.style.getPropertyValue("--shelf-cor") !== "", wrap.getAttribute("style"));
check("botão oferece voltar à cor da editora", /Voltar para a cor da editora/.test(m1.root.querySelector(".cor-barra").textContent));
check("outra coleção não pega a cor", !m1.secao("Curta").querySelector(".shelf-wrap").style.getPropertyValue("--shelf-cor"));

[...m1.root.querySelectorAll(".cor-barra button")].find((b) => /Voltar para a cor da editora/.test(b.textContent)).click();
await sleep(700);
const doc2 = m1.docs.get("library/colecoes").items.find((c) => c.id === "longa");
check("voltar remove a cor da coleção", !("corBarra" in doc2), JSON.stringify(doc2));
check("barra volta a seguir a editora", !m1.secao("Longa").querySelector(".shelf-wrap").style.getPropertyValue("--shelf-cor"));
await m1.fechar();

await m1.gerenciar("Curta");
check("sem barra, sem opção de cor", !m1.root.querySelector(".cor-barra"));
check("a curta não herda o recolhido da longa", m1.root.querySelector(".ordem-head").getAttribute("aria-expanded") === "true");
await m1.fechar();

// v80: folded to its title the strip is gone, but the colour option stays.
m1.secao("Longa").querySelector('[aria-label="Esconder os volumes de Longa"]').click();
await sleep(120);
check("longa escondida não tem faixa montada", !m1.secao("Longa").querySelector(".coll-strip"));
await m1.gerenciar("Longa");
check("escondida ainda oferece a cor da barra", !!m1.root.querySelector(".cor-barra"));
await m1.fechar();
m1.secao("Curta").querySelector('[aria-label="Esconder os volumes de Curta"]').click();
await sleep(120);
await m1.gerenciar("Curta");
check("curta escondida continua sem opção de cor", !m1.root.querySelector(".cor-barra"));
check("sem erros (1)", m1.erros.length === 0, m1.erros[0]);

console.log("=== segunda montagem: recarregar ===");
const m2 = await montar({ sessao: { "longbox:aba": "colecoes", "longbox:ordem-recolhida": guardado } });
await m2.gerenciar("Longa");
check("recarregar mantém a ordem recolhida", m2.root.querySelector(".ordem-head").getAttribute("aria-expanded") === "false");

console.log("=== terceira montagem: visita nova ===");
const m3 = await montar({ sessao: { "longbox:aba": "colecoes" } });
await m3.gerenciar("Longa");
check("visita nova abre a ordem", m3.root.querySelector(".ordem-head").getAttribute("aria-expanded") === "true");

// v120: the reading order reads, it does not administer. Reorder and removal live in an
// "Editar ordem" mode; labels name the volume; removal from the collection can be undone.
console.log("=== quarta montagem: editar ordem ===");
const m4 = await montar({ sessao: { "longbox:aba": "colecoes" } });
await m4.gerenciar("Longa");
const R = m4.root;
const linhas = () => [...R.querySelectorAll(".sheet .ordem-linha")];
const titulos = () => linhas().map((l) => l.querySelector(".ordem-titulo")?.textContent);
const botao = (txt) => [...R.querySelectorAll(".sheet button")].find((b) => b.textContent.trim() === txt);
check("leitura: nenhum mover nem tirar", R.querySelectorAll('.sheet [aria-label^="Mover"], .sheet [aria-label^="Tirar"]').length === 0);
check("leitura: Lidas até aqui em cada linha", R.querySelectorAll(".sheet .ordem-ate").length === 8);
check("um personagem só: sem o nome repetido na linha", R.querySelectorAll(".sheet .ordem-sub").length === 0);
botao("Editar ordem")?.click(); await sleep(120);
check("editar: mover e tirar com o nome do volume", !!(R.querySelector('.sheet [aria-label="Mover Batman b0 para baixo"]') && R.querySelector('.sheet [aria-label="Tirar Batman b0 da coleção"]')));
check("editar: sem Lidas até aqui", R.querySelectorAll(".sheet .ordem-ate").length === 0);
check("editar: botão Pronto", !!botao("Pronto"));
const desce = R.querySelector('.sheet [aria-label="Mover Batman b0 para baixo"]');
if (desce) {
  desce.focus();
  desce.dispatchEvent(new m4.window.KeyboardEvent("keydown", { key: "ArrowDown", altKey: true, bubbles: true, cancelable: true }));
  await sleep(150);
}
check("Alt+↓ desce o volume", titulos()[0] === "Batman b1" && titulos()[1] === "Batman b0", titulos().slice(0, 2).join(","));
check("o foco vai junto", m4.window.document.activeElement?.closest?.(".ordem-linha") === linhas()[1]);
m4.window.document.activeElement.dispatchEvent(new m4.window.KeyboardEvent("keydown", { key: "ArrowUp", altKey: true, bubbles: true, cancelable: true }));
await sleep(150);
check("Alt+↑ sobe de volta", titulos()[0] === "Batman b0", titulos()[0]);
R.querySelector('.sheet [aria-label="Tirar Batman b2 da coleção"]')?.click();
await sleep(150);
const t4 = R.querySelector(".toast")?.textContent || "";
check("tirar mostra o nome e Desfazer", /Batman b2/.test(t4) && !!R.querySelector(".toast button"), t4);
check("tirou", linhas().length === 7, linhas().length);
R.querySelector(".toast button")?.click(); await sleep(150);
check("Desfazer devolve na mesma posição", linhas().length === 8 && titulos()[2] === "Batman b2", titulos().join(","));
botao("Pronto")?.click(); await sleep(120);
check("Pronto volta à leitura", R.querySelectorAll('.sheet [aria-label^="Mover"]').length === 0 && R.querySelectorAll(".sheet .ordem-ate").length === 8);
check("sem erros (4)", m4.erros.length === 0, m4.erros[0]);

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
