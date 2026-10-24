import { JSDOM } from "jsdom";
import fs from "node:fs";
import esbuild from "esbuild";

// v185: hold a row on the séries tab and drag to reorder a character's séries.
// The order lives on that character's entry of each série (personagens[i].ordem).
const bundle = fs.readFileSync("dist/app.js", "utf8");
let passes = 0, falhas = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const j = JSON.stringify;
const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });

// The pure merge, compiled from the real source.
// The icons constantes.js imports are stubbed: only the pure functions are used.
const stub = { name: "stub", setup(b) {
  b.onResolve({ filter: /^lucide-react$/ }, () => ({ path: "icones", namespace: "stub" }));
  b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export const BookOpen = 0, Layers = 0, Library = 0;" }));
} };
const lib = (await esbuild.build({ entryPoints: ["src/lib/biblioteca.js"], bundle: true, format: "esm", write: false,
  plugins: [stub], logLevel: "silent" })).outputFiles[0].text;
const { ordenarSeriesDoPersonagem, compararNoGrupo } =
  await import("data:text/javascript;base64," + Buffer.from(lib).toString("base64"));
{
  const ss = [
    { id: "a", anoInicio: "1990", personagens: ["Batman"] },
    { id: "m", anoInicio: "1985", personagens: [{ nome: "Batman", de: null, ate: null }] }, // hidden by the band
    { id: "b", anoInicio: "2000", personagens: ["Batman", "Robin"] },
    { id: "r", anoInicio: "1970", personagens: ["Robin"] },
  ];
  const out = ordenarSeriesDoPersonagem(ss, "Batman", ["b", "a"]);
  const ord = (id, p = "Batman") => out.find((s) => s.id === id).personagens.find((x) => x.nome === p).ordem;
  check("a band-hidden série keeps its slot while the visible ones swap", ord("m") === 0 && ord("b") === 1 && ord("a") === 2,
    [ord("m"), ord("b"), ord("a")].join());
  check("the other character's entry and séries are untouched", out.find((s) => s.id === "b").personagens[1].ordem === undefined &&
    out.find((s) => s.id === "r") === ss[3]);
  const item = (ordem, ano) => ({ serie: { anoInicio: ano }, faixa: { ordem } });
  check("placed séries come first, then the rest by year", [item(undefined, "1960"), item(1, "2000"), item(0, "2010")]
    .sort(compararNoGrupo).map((i) => i.serie.anoInicio).join() === "2010,2000,1960");
}

const serie = (id, ano, personagens) => ({ id, nome: "Serie " + id.toUpperCase(), editora: "DC Comics", anoInicio: ano,
  anoFim: "", totalEdicoes: 1, ordem: null, personagens });
const HEIGHT = 70, GAP = 8;

async function montar(stored) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.test/",
  });
  const { window: W } = dom, erros = [], writes = [];
  W.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el }]); } unobserve() {} disconnect() {} };
  W.scrollTo = () => {};
  W.HTMLElement.prototype.scrollIntoView = () => {};
  W.matchMedia = (q) => ({ matches: q.includes("pointer: fine"), media: q,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  W.addEventListener("error", (e) => erros.push(e.error?.stack || e.message));
  W.console.error = (...a) => erros.push(a.join(" "));
  W.sessionStorage.setItem("longbox:aba", "series");
  Object.defineProperty(W, "innerHeight", { value: 800, configurable: true });
  const P = W.HTMLElement.prototype;
  P.setPointerCapture = () => {};
  P.releasePointerCapture = () => {};
  // Each group's rows stack from a page top of 200 + 400 per group, in DOM order.
  const linha = (el) => el.classList.contains("serie-arrasto") && !el.dataset.dragGhost;
  const listas = () => [...W.document.querySelectorAll(".series-lista")];
  const topoLista = (l) => 200 + 400 * listas().indexOf(l);
  const top = (el) => topoLista(el.parentElement) + [...el.parentElement.children].indexOf(el) * (HEIGHT + GAP);
  Object.defineProperty(P, "offsetParent", { configurable: true, get() { return null; } });
  Object.defineProperty(P, "offsetTop", { configurable: true, get() { return linha(this) ? top(this) : 0; } });
  Object.defineProperty(P, "offsetHeight", { configurable: true, get() { return linha(this) ? HEIGHT : 0; } });
  P.getBoundingClientRect = function () {
    if (this.classList.contains("series-lista")) {
      return rect(20, topoLista(this), 320, this.children.length * (HEIGHT + GAP) - GAP);
    }
    if (linha(this)) {
      const dy = Number(this.style.transform.match(/translateY\(([-.\d]+)px\)/)?.[1] || 0);
      return rect(20, top(this) + dy, 320, HEIGHT);
    }
    return rect(0, 0, 360, 0);
  };
  const docs = stored ? new Map(JSON.parse(j([...stored]))) : new Map([
    ["library/volumes", { items: [] }],
    ["library/colecoes", { items: [] }],
    ["library/series", { items: [
      serie("s1", "1990", [{ nome: "Batman", de: null, ate: null }]),
      serie("s2", "1980", [{ nome: "Batman", de: null, ate: null }]),
      serie("s3", "2000", [{ nome: "Batman", de: null, ate: null }]),
      serie("s4", "1970", ["Batman", "Robin"]),
      serie("s5", "1975", [{ nome: "Robin", de: null, ate: null }]),
      serie("x1", "1990", []), serie("x2", "1991", []),
    ] }],
    ["library/cores", { mapa: { batman: { h: 30 } } }],
    ["library/editoras", { itens: [{ id: "dc", nome: "DC Comics", cor: { h: 220 }, logoAssetId: null }], selecionada: "__todas__" }],
  ]);
  const makeDoc = (path) => ({ path,
    get: async () => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path), metadata: {} }),
    set: async (body) => { writes.push(path); docs.set(path, JSON.parse(j(body))); },
    delete: async () => docs.delete(path),
  });
  W.claude = { use: async (n) => n === "db" ? {
    doc: makeDoc, collection: (path) => ({ doc: (id) => makeDoc(path + "/" + id),
      get: async () => ({ docs: [], size: 0, empty: true, docChanges: () => [], metadata: {} }) }),
  } : null };
  W.eval(bundle);
  await sleep(600);
  writes.length = 0;
  const root = W.document.getElementById("root");
  const aba = () => root.querySelector('.aba[data-ativa="true"]');
  const grupo = (nome) => [...aba().querySelectorAll("section.group")].find((g) => g.querySelector(".group-head h2")?.textContent === nome);
  const linhas = (nome) => [...(grupo(nome)?.querySelectorAll(".series-lista > .serie-arrasto") || [])];
  const keys = (nome) => linhas(nome).map((el) => el.dataset.serieKey).join();
  const ordem = (id, p) => personagens(id).find((x) => (x.nome ?? x) === p)?.ordem;
  const personagens = (id) => docs.get("library/series").items.find((s) => s.id === id).personagens;
  const ghost = () => W.document.querySelector('[data-drag-ghost="true"]');
  const pointer = (el, type, x, y) => {
    const e = new W.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
    Object.defineProperty(e, "pointerId", { value: 1 });
    el.dispatchEvent(e);
    return e;
  };
  const yDe = (el) => el.getBoundingClientRect().top + 30;
  return { W, root, docs, erros, writes, aba, grupo, linhas, keys, ordem, personagens, ghost, pointer, yDe };
}

const m = await montar();
// Groups open by default on the séries tab only when pinned; open the two we use.
for (const nome of ["Batman", "Robin", "(sem personagem)"]) {
  if (!m.linhas(nome).length) { m.grupo(nome)?.querySelector(".group-toggle")?.click(); await sleep(60); }
}
check("an unordered group keeps the year order", m.keys("Batman") === "s4,s2,s1,s3", m.keys("Batman"));
check("each row is wrapped with the rising fill and wave", m.linhas("Batman").every((el) =>
  el.querySelector(":scope > .serie-row") && el.querySelector(":scope > .vol-hold") && el.querySelector(":scope > .vol-hold__crest")));
const cabeca = m.grupo("Batman").querySelector(".group-head").style.getPropertyValue("--grp-cor");
check("the fill takes the character's colour, the group swatch", !!cabeca &&
  m.linhas("Batman").every((el) => el.style.getPropertyValue("--hold-color") === cabeca), cabeca);

const ultima = m.linhas("Batman").at(-1);
m.pointer(ultima.querySelector(".serie-row .t-title"), "pointerdown", 40, m.yDe(ultima));
await sleep(200);
check("a short hold starts the fill but no ghost", !m.ghost() && Number(ultima.style.getPropertyValue("--hold-p")) > 0);
await sleep(300);
check("holding a row arms a page ghost under the header", m.ghost()?.style.zIndex === "14" && m.ghost().style.position === "fixed" &&
  ultima.dataset.dragHole === "true");
const alvoY = m.linhas("Batman")[0].getBoundingClientRect().top + 5;
const mov = m.pointer(ultima, "pointermove", 40, alvoY);
await sleep(100);
check("dragging to the top previews the new order", m.keys("Batman") === "s3,s4,s2,s1", m.keys("Batman"));
check("the armed move blocks native scrolling", mov.defaultPrevented);
check("the preview writes nothing", m.writes.length === 0);
m.pointer(m.W, "pointerup", 40, alvoY);
const linhaArrastada = m.linhas("Batman").find((el) => el.dataset.serieKey === "s3");
linhaArrastada.querySelector(".serie-row").dispatchEvent(new m.W.MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }));
await sleep(700);
check("the click that ends a drag does not open the série", !m.root.querySelector('.sheet[data-in="true"]'));
check("release stores the place on each Batman entry", ["s3", "s4", "s2", "s1"].every((id, i) => m.ordem(id, "Batman") === i),
  ["s3", "s4", "s2", "s1"].map((id) => m.ordem(id, "Batman")).join());
check("only library/series is written", m.writes.length === 1 && m.writes[0] === "library/series", m.writes.join());
check("the shared série keeps no place in Robin", m.ordem("s4", "Robin") === undefined && m.ordem("s5", "Robin") === undefined);
check("the Robin group is unchanged", m.keys("Robin") === "s4,s5", m.keys("Robin"));
check("the tab keeps the new order", m.keys("Batman") === "s3,s4,s2,s1" && !m.ghost(), m.keys("Batman"));

const re = await montar(m.docs);
for (const nome of ["Batman"]) if (!re.linhas(nome).length) { re.grupo(nome)?.querySelector(".group-toggle")?.click(); await sleep(60); }
check("a reload shows the saved order", re.keys("Batman") === "s3,s4,s2,s1", re.keys("Batman"));

// A plain tap still opens the série.
const tap = m.linhas("Batman")[1].querySelector(".serie-row");
tap.click(); await sleep(250);
check("a tap still opens the série", tap.dataset.open === "true");

// Editing the série in the form keeps its place.
m.writes.length = 0;
const editar = m.root.querySelector('.sheet[data-in="true"] [aria-label="Editar"]');
editar?.click(); await sleep(150);
const modal = m.W.document.querySelector(".modal");
// Rename it, so the save is a real write (an unchanged library is not written).
const nome = modal?.querySelector("input");
if (nome) {
  Object.getOwnPropertyDescriptor(m.W.HTMLInputElement.prototype, "value").set.call(nome, "Serie S4 renomeada");
  nome.dispatchEvent(new m.W.Event("input", { bubbles: true })); await sleep(80);
}
[...(modal?.querySelectorAll("button") || [])].find((b) => b.textContent.trim() === "Salvar")?.click(); await sleep(800);
check("saving the série form keeps its place in Batman", m.writes.includes("library/series") &&
  m.docs.get("library/series").items.find((x) => x.id === "s4").nome === "Serie S4 renomeada" && m.ordem("s4", "Batman") === 1,
  j(m.personagens("s4")));
[...m.root.querySelectorAll('.sheet[data-in="true"] [aria-label="Fechar"]')].at(-1)?.click(); await sleep(350);

// The group with no character never arms.
const semP = m.linhas("(sem personagem)")[0];
m.writes.length = 0;
if (semP) { m.pointer(semP.querySelector(".serie-row"), "pointerdown", 40, m.yDe(semP)); await sleep(500); }
check("the no-character group never arms", !!semP && !m.ghost(), m.keys("(sem personagem)"));
if (semP) { m.pointer(m.W, "pointerup", 40, m.yDe(semP)); await sleep(300); }

// While searching only part of a group shows: no reordering.
const busca = m.root.querySelector("#busca-acervo");
Object.getOwnPropertyDescriptor(m.W.HTMLInputElement.prototype, "value").set.call(busca, "Serie");
busca.dispatchEvent(new m.W.Event("input", { bubbles: true })); await sleep(250);
const comBusca = m.linhas("Batman")[0];
m.pointer(comBusca.querySelector(".serie-row"), "pointerdown", 40, m.yDe(comBusca)); await sleep(500);
check("a search turns the drag off", !!comBusca && !m.ghost());
m.pointer(m.W, "pointerup", 40, m.yDe(comBusca)); await sleep(300);
check("nothing was written by the disabled holds", m.writes.length === 0, m.writes.join());

check("no errors", m.erros.length === 0 && re.erros.length === 0, [...m.erros, ...re.erros].join(" | ").slice(0, 400));
for (const x of [m, re]) x.W.close();
console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
