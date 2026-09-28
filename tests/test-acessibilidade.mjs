import { JSDOM } from "jsdom";
import fs from "node:fs";

// v132 (critique 4): the page says it is in Portuguese (the host's skeleton has no
// lang, so VoiceOver read pt-BR with an English voice), every surface has one hidden
// h1, the phone tab bar is named, a skip link lands on the first item of the tab,
// the séries counts read as "55 de 100 possuídas", "+ Edição" says "Nova edição" and
// N makes one while a série card is open, and the small print is normal case.

const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0, passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function montar(aba) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.test/" });
  const { window } = dom;
  const erros = [];
  window.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el }]); } unobserve() {} disconnect() {} };
  window.scrollTo = () => {};
  window.matchMedia = (q) => ({ matches: q.includes("pointer: fine"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  window.addEventListener("error", (e) => erros.push(e.error?.stack || e.message));
  window.console.error = (...a) => erros.push(a.join(" "));
  if (aba) window.sessionStorage.setItem("longbox:aba", aba);
  window.sessionStorage.setItem("longbox:series-abertas", JSON.stringify(["Batman"]));
  const eds = Array.from({ length: 10 }, (_, i) => ({ id: "e" + (i + 1), serieId: "s1", numero: String(i + 1), mes: "", ano: "", posicao: null }));
  const docs = new Map([
    ["library/volumes", { items: [
      { id: "v1", titulo: "Batman v1", personagem: "Batman", tipo: "Omnibus", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: ["e1", "e2", "e3"] },
      { id: "v2", titulo: "Batman v2", personagem: "Batman", tipo: "Omnibus", editora: "DC Comics", ano: "2021", status: "nao_lida", notas: "", edicoesColetadasIds: [] },
    ] }],
    ["library/colecoes", { items: [] }],
    ["library/series", { items: [{ id: "s1", nome: "Batman (Volume 1)", personagens: [{ nome: "Batman", de: null, ate: null }], editora: "DC Comics", anoInicio: "1940", anoFim: "", totalEdicoes: 10, ordem: null }] }],
    ["edicoes/s1", { items: eds }],
  ]);
  const makeDoc = (path) => ({ path, get: async () => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path), metadata: {} }), set: async (b) => { docs.set(path, b); }, delete: async () => { docs.delete(path); } });
  const colecao = (c) => ({ doc: (id) => makeDoc(c + "/" + id), get: async () => { const l = [...docs.keys()].filter((k) => k.startsWith(c + "/")).map((k) => ({ id: k.split("/").pop(), data: () => docs.get(k) })); return { docs: l, size: l.length, empty: !l.length, docChanges: () => [], metadata: {} }; } });
  window.claude = { use: async (n) => (n === "db" ? { doc: makeDoc, collection: colecao } : null) };
  window.eval(bundle);
  await sleep(450);
  const root = window.document.getElementById("root");
  const tecla = async (key) => { window.document.body.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })); await sleep(150); };
  return { window, root, erros, tecla };
}
const h1s = (root) => [...root.querySelectorAll("h1")].filter((h) => !h.closest("[inert]")).map((h) => h.textContent);

console.log("=== idioma, título, barra ===");
{
  const m = await montar(null);
  check("a página diz que está em português", m.window.document.documentElement.lang === "pt-BR", m.window.document.documentElement.lang);
  check("o hub tem um título principal", h1s(m.root).join("|") === "Longbox, início", h1s(m.root).join("|"));
  check("título escondido da vista", m.root.querySelector("h1")?.classList.contains("sr-only"));
  const t = await montar("volumes");
  check("a aba HQs tem o seu", h1s(t.root).join("|") === "Longbox, HQs", h1s(t.root).join("|"));
  check("a barra de abas tem nome", t.root.querySelector("nav.tabbar")?.getAttribute("aria-label") === "Seções");
  const pular = t.root.querySelector("a.pular");
  check("existe o link de pular", pular?.textContent === "Pular para as capas", pular?.textContent);
  pular?.click();
  await sleep(100);
  const foco = t.window.document.activeElement;
  check("ele leva à primeira capa", !!foco?.classList.contains("vol") && foco.textContent.includes("Batman v1"), foco?.className);
  check("sem erros", m.erros.length === 0 && t.erros.length === 0, m.erros[0] || t.erros[0]);
}

console.log("=== séries ===");
{
  const m = await montar("series");
  const linha = m.root.querySelector('.aba[data-ativa="true"] .serie-row');
  check("o pular diz séries", m.root.querySelector("a.pular")?.textContent === "Pular para as séries");
  check("a contagem é lida como possuídas", /3 de 10 possuídas/.test(linha?.textContent || ""), linha?.textContent);
  check("o número visível continua 3/10", linha?.querySelector('[aria-hidden="true"]')?.textContent === "3/10");
  linha?.click();
  await sleep(200);
  const sheet = [...m.root.querySelectorAll(".sheet")].find((s) => s.dataset.in === "true");
  check("o botão diz Nova edição", [...(sheet?.querySelectorAll("button") || [])].some((b) => b.textContent.trim() === "Nova edição"));
  const frase = [...(sheet?.querySelectorAll("p") || [])].find((p) => /Escolha um número/.test(p.textContent));
  check("a frase do mapa não é mais em maiúsculas miúdas", !!frase && !frase.classList.contains("t-micro"), frase?.className);
  await m.tecla("n");
  const modal = m.root.querySelector(".modal .t-display")?.textContent;
  check("N com a ficha da série aberta cataloga uma edição", modal === "Catalogar edição", modal);
  check("sem erros", m.erros.length === 0, m.erros[0]);
}

console.log("=== v134: desfazer mais longo e o topo do app do Claude ===");
{
  const m = await montar("series");
  m.root.querySelector('.aba[data-ativa="true"] .serie-row')?.click();
  await sleep(200);
  const sheet = [...m.root.querySelectorAll(".sheet")].find((s) => s.dataset.in === "true");
  sheet?.querySelector(".btn-remover")?.click();
  await sleep(150);
  const confirmar = [...m.root.querySelectorAll(".modal button")].find((b) => /Remover|Apagar/.test(b.textContent));
  confirmar?.click();
  await sleep(200);
  const desfazerBotao = () => [...m.root.querySelectorAll(".toast button")].find((b) => /Desfazer/.test(b.textContent));
  check("remover a série oferece desfazer", !!desfazerBotao(), m.root.querySelector(".toast")?.textContent);
  await sleep(9000);
  check("com edições, o desfazer ainda está lá depois de 9 s", !!desfazerBotao(), m.root.querySelector(".toast")?.textContent);
  const css = fs.readFileSync("src/styles.css", "utf8");
  // v135: the padding alone; a sticky top on top of it counted the inset twice.
  check("o hub respeita o espaço do cabeçalho do app, uma vez só", css.includes("padding-top: env(safe-area-inset-top, 0px);") && !css.includes(".hub-capa > .topbar { top: env("));
  // v137: the strip belongs to every header now, the hub's included.
  check("a faixa acima do cabeçalho do hub é pintada (v136)", /\n\.topbar::before \{[^}]*height: env\(safe-area-inset-top, 0px\);[^}]*background: var\(--bg\);/.test(css));
  // v137: the tabs' sticky bars pin below the Claude app's bar; the hub resets it.
  check("cabeçalho, faixa e grupos das abas grudam abaixo do app do Claude",
    css.includes("--topo: env(safe-area-inset-top, 0px);") &&
    /\.topbar \{\s*position: sticky;\s*top: var\(--topo\);/.test(css) &&
    css.includes("top: calc(var(--topo) + var(--topbar-h));") &&
    css.includes("top: calc(var(--topo) + var(--topbar-h) + var(--edbar-h));") &&
    /\.hub-capa \{[^}]*--topo: 0px;/.test(css));
  check("o pular não existe em tela de toque e aceita clique", css.includes("@media (hover: none) and (pointer: coarse) { .pular { display: none; } }") && css.includes(".pular:focus { transform: none; }"));
  check("sem erros", m.erros.length === 0, m.erros[0]);
}

console.log("=== detalhes ===");
{
  const css = fs.readFileSync("src/styles.css", "utf8");
  check("setas diferentes para esconder e mostrar", /\.fold-all svg\[data-rot="false"\] \{ transform: rotate\(180deg\); \}/.test(css));
  const m = await montar("volumes");
  const conta = m.root.querySelector(".ed-note");
  check("a contagem da faixa sai da fonte de código", !!conta && !conta.classList.contains("num"), conta?.className);
}

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas === 0 ? 0 : 1);
