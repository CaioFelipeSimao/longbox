// Boot states: which tab the app opens on, and which skeleton it draws while the
// library is still in flight. Both live in a window test-render.mjs cannot reach:
// it waits 400ms for the app to settle before it looks, and by then the skeleton
// is gone and the tab has already been chosen. This harness holds the database
// open on purpose so the loading state can be read, and it seeds sessionStorage
// before the bundle evaluates, which is the only moment the saved tab is read.
//
// Run: node test-boot.mjs
import { JSDOM } from "jsdom";
import fs from "node:fs";

const bundle = fs.readFileSync("dist/app.js", "utf8");

const ABA_KEY = "longbox:aba";
// Long enough that the skeleton can be read and asserted without racing it.
const ATRASO = 400;

let falhas = 0;
function check(nome, ok, detalhe) {
  if (!ok) falhas++;
  console.log((ok ? "  PASS " : "  FAIL ") + nome + (ok || !detalhe ? "" : " (" + detalhe + ")"));
}

// A small library is enough here: every tab only has to have something to draw.
function seed() {
  const series = [
    { id: "s1", nome: "Nightwing (Volume 2)", personagens: [{ nome: "Nightwing", de: null, ate: null }], editora: "DC Comics", anoInicio: "1996", anoFim: "2009", totalEdicoes: 12, ordem: 1 },
  ];
  const edicoes = [];
  for (let i = 1; i <= 12; i++) edicoes.push({ id: "e1-" + i, serieId: "s1", numero: String(i), mes: "", ano: "", posicao: null });
  const volumes = [
    { id: "v1", titulo: "Nightwing: Ano Um", personagem: "Nightwing", tipo: "Encadernado (TPB)", editora: "DC Comics", ano: "2019", status: "lida", notas: "", edicoesColetadasIds: ["e1-1", "e1-2"] },
    { id: "v2", titulo: "Batman: Ano Um", personagem: "Batman", tipo: "Omnibus", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: [] },
  ];
  const colecoes = [{ id: "c1", nome: "Era Dixon", descricao: "Ordem de leitura", membros: ["v1"] }];
  return { volumes, colecoes, series, edicoes };
}

// One mounted app, with the database answering only after `ATRASO`. Returns the
// window and root so a caller can read the page mid-flight and again once settled.
function montar(abaSalva) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
    runScripts: "outside-only",
    pretendToBeVisual: true,
    url: "https://example.test/",
  });
  const { window } = dom;
  const erros = [];

  window.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; }
    observe(el) { this.cb([{ isIntersecting: true, target: el }]); }
    unobserve() {}
    disconnect() {}
  };
  window.scrollTo = () => {};
  window.matchMedia = (query) => ({
    matches: query.includes("pointer: fine"),
    media: query,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  });
  window.addEventListener("error", (e) => erros.push("window.error: " + (e.error?.stack || e.message)));
  window.console.error = (...a) => erros.push("console.error: " + a.join(" "));

  const lib = seed();
  const docs = new Map([
    ["library/volumes", { items: lib.volumes }],
    ["library/colecoes", { items: lib.colecoes }],
    ["library/series", { items: lib.series }],
  ]);
  const espera = () => new Promise((r) => setTimeout(r, ATRASO));
  const makeDoc = (path) => ({
    path,
    get: async () => {
      await espera();
      return {
        id: path.split("/").pop(),
        exists: docs.has(path),
        data: () => docs.get(path),
        metadata: { fromCache: false, hasPendingWrites: false },
      };
    },
    set: async (body) => { docs.set(path, body); },
    delete: async () => { docs.delete(path); },
  });
  window.claude = {
    use: async (name) => {
      if (name !== "db") return null;
      return {
        doc: makeDoc,
        collection: (cpath) => ({
          path: cpath,
          doc: (id) => makeDoc(cpath + "/" + id),
          get: async () => {
            await espera();
            const out = cpath === "edicoes"
              ? [{ id: "s1", exists: true, data: () => ({ items: lib.edicoes }), metadata: {} }]
              : [];
            return { docs: out, size: out.length, empty: !out.length, docChanges: () => [], metadata: {} };
          },
        }),
      };
    },
  };

  // Written before the bundle runs, because the saved tab is read once, when the
  // app's state is created. Setting it afterwards would prove nothing.
  if (abaSalva !== undefined) window.sessionStorage.setItem(ABA_KEY, abaSalva);

  window.eval(bundle);
  return { window, root: window.document.getElementById("root"), erros };
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

// Read while the database is still answering, then once it has.
async function carregando(root) { await pausa(120); return root.innerHTML; }
async function pronto(root) { await pausa(ATRASO + 400); return root.innerHTML; }

console.log("=== boot: aba salva e esqueleto por aba ===");

/* ---------- sem bilhete: o hub e o esqueleto do hub ---------- */
{
  const { root, erros } = montar(undefined);
  const meio = await carregando(root);
  console.log("\n--- primeira visita, sem bilhete ---");
  check("esqueleto do hub durante o carregamento", meio.includes("skel-hub"));
  check("nao desenha a prateleira de HQs", !meio.includes('class="shelf skel-wrap"'), meio.slice(0, 120));
  check("nao desenha os esqueletos das outras abas",
    !meio.includes("skel-head") && !meio.includes("coll-strip"));
  const fim = await pronto(root);
  check("abre no hub", fim.includes("suggest-title"));
  check("esqueleto sai quando a biblioteca chega", !fim.includes("skel-hub"));
  check("sem erros", erros.length === 0, erros[0]);
}

/* ---------- bilhete de HQs: prateleira ---------- */
{
  const { window, root, erros } = montar("volumes");
  const meio = await carregando(root);
  console.log("\n--- bilhete: volumes ---");
  check("esqueleto de prateleira durante o carregamento", meio.includes("skel-hqs") && meio.includes("skel-head") && meio.includes('class="shelf"') && meio.includes('data-w="fold"'));
  check("prateleira nao usa o esqueleto de series", !meio.includes("skel-series"));
  check("nao desenha o esqueleto do hub", !meio.includes("skel-hub"));
  check("barra de editoras ja presente durante o carregamento", meio.includes("ed-band"));
  check("contagem em branco enquanto carrega", !/ed-note[^>]*>\s*0\s/.test(meio));
  const fim = await pronto(root);
  check("abre na aba HQs, nao no hub", !fim.includes("suggest-title"));
  check("bilhete continua em volumes", window.sessionStorage.getItem(ABA_KEY) === "volumes");
  check("sem erros", erros.length === 0, erros[0]);
}

/* ---------- bilhete de series: lista ---------- */
{
  const { root, erros } = montar("series");
  const meio = await carregando(root);
  console.log("\n--- bilhete: series ---");
  check("esqueleto de series durante o carregamento",
    meio.includes("skel-series") && meio.includes("skel-head") && meio.includes('data-w="fold"') && !meio.includes("serie-row"));
  check("nao desenha a prateleira de HQs", !meio.includes("skel-hqs"));
  const fim = await pronto(root);
  // A aba Series abre com todos os personagens recolhidos, entao o nome de uma
  // serie nao esta no DOM: o que prova que abriu na aba certa, e nao no hub, sao
  // os cabecalhos de personagem e o controle de mostrar todas.
  check("abre na aba Series", !fim.includes("suggest-title") &&
    fim.includes("group-head") && fim.includes("fold-all") && !fim.includes("series-fold-all"));
  check("Series comeca recolhida", !fim.includes("serie-row"));
  check("sem erros", erros.length === 0, erros[0]);
}

/* ---------- bilhete de colecoes: lista ---------- */
{
  const { root } = montar("colecoes");
  const meio = await carregando(root);
  console.log("\n--- bilhete: colecoes ---");
  check("esqueleto de colecoes durante o carregamento",
    meio.includes("skel-colecoes") && meio.includes("coll-strip") && meio.includes('class="skel"') && meio.includes("skel-spines") && meio.includes('data-w="acao"'));
  check("nao desenha o esqueleto de series", !meio.includes("skel-head"));
  const fim = await pronto(root);
  check("abre na aba Colecoes", fim.includes("Era Dixon") && !fim.includes("suggest-title"));
}

/* ---------- bilhete estragado: cai no hub ---------- */
{
  const { root } = montar("lixo-que-nao-e-aba");
  const fim = await pronto(root);
  console.log("\n--- bilhete invalido ---");
  check("cai no hub em vez de tela em branco", fim.includes("suggest-title"));
}

/* ---------- trocar de aba grava, e grava na gaveta certa ---------- */
{
  const { window, root } = montar(undefined);
  await pronto(root);
  console.log("\n--- gravacao ---");
  const btns = [...root.querySelectorAll(".tabbar button")];
  const series = btns.find((b) => (b.textContent || "").includes("Séries"));
  series.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await pausa(120);
  check("trocar de aba grava o bilhete", window.sessionStorage.getItem(ABA_KEY) === "series",
    String(window.sessionStorage.getItem(ABA_KEY)));
  // A gaveta permanente tem de ficar intacta: e o que faz fechar o navegador
  // voltar ao hub em vez de restaurar a ultima aba.
  check("nada gravado no localStorage", window.localStorage.getItem(ABA_KEY) === null);
  const brand = root.querySelector("button.brand");
  brand.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await pausa(120);
  check("voltar ao hub grava o hub", window.sessionStorage.getItem(ABA_KEY) === "hub",
    String(window.sessionStorage.getItem(ABA_KEY)));
}

/* ---------- o pulso ---------- */
{
  console.log("\n--- pulso do esqueleto ---");
  const css = fs.readFileSync("src/styles.css", "utf8");
  // Every skeleton root has to carry the class, or one tab would sit still while
  // the others breathe.
  for (const aba of [undefined, "volumes", "colecoes", "series"]) {
    const { root } = montar(aba);
    const meio = await carregando(root);
    check("classe do pulso em " + (aba || "hub"), meio.includes("skel-wrap"));
  }
  check("pulso anima so a opacidade", /@keyframes skelPulse\s*\{\s*50%\s*\{\s*opacity/.test(css));

  // The pulse has to be declared INSIDE the no-preference block, not merely
  // switched off under reduce: the global reduce block clamps every animation to
  // 150ms, which would turn a breathing skeleton into a strobe. Walk the braces
  // from the block's opening to find where it closes, then see if the rule fell
  // inside it.
  const abre = css.indexOf("@media (prefers-reduced-motion: no-preference) {\n  .skel-wrap .skel,");
  let fecha = -1;
  if (abre !== -1) {
    let nivel = 0;
    for (let i = css.indexOf("{", abre); i < css.length; i++) {
      if (css[i] === "{") nivel++;
      else if (css[i] === "}" && --nivel === 0) { fecha = i; break; }
    }
  }
  const regra = css.indexOf("animation: skelPulse");
  check("pulso declarado dentro de no-preference",
    abre !== -1 && fecha !== -1 && regra > abre && regra < fecha,
    "abre " + abre + " regra " + regra + " fecha " + fecha);

  const { root } = montar("volumes");
  const meio = await carregando(root);
  check("avisa o leitor de tela que esta carregando",
    meio.includes('role="status"') && meio.includes("Carregando"));
  check("classe do aviso existe no css", css.includes(".sr-only"));
  check("aviso some quando termina", !(await pronto(root)).includes('role="status"'));
}

/* ---------- sem gaveta nenhuma: nao pode quebrar ---------- */
{
  console.log("\n--- navegador sem sessionStorage ---");
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
    runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.test/",
  });
  const { window } = dom;
  // A private window can refuse storage outright. Reading it must not take the
  // app down with it: the fallback is the hub, the way it behaved before.
  Object.defineProperty(window, "sessionStorage", {
    get() { throw new Error("storage bloqueado"); },
  });
  window.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el }]); } unobserve() {} disconnect() {} };
  window.scrollTo = () => {};
  window.matchMedia = (q) => ({ matches: q.includes("pointer: fine"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  const erros = [];
  window.addEventListener("error", (e) => erros.push("window.error: " + (e.error?.stack || e.message)));
  window.console.error = (...a) => erros.push("console.error: " + a.join(" "));
  window.claude = undefined;
  window.eval(bundle);
  await pausa(300);
  const html = window.document.getElementById("root").innerHTML;
  check("app monta mesmo assim", html.length > 500, "tamanho " + html.length);
  check("sem erros", erros.length === 0, erros[0]);
}

console.log("\n" + (falhas === 0 ? "TUDO PASSOU" : falhas + " FALHA(S)"));
// The GSAP ticker holds the event loop open, the same as in test-render.mjs.
process.exit(falhas === 0 ? 0 : 1);
