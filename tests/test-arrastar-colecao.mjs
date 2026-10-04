import { JSDOM } from "jsdom";
import fs from "node:fs";

// Exercise the built app, not an isolated imitation of its persistence/sheets.
// Claude rebuilds dist/app.js before this suite. JSDOM geometry follows current
// DOM positions and scroll offsets, so targeting must use the fixed slots.
const bundle = fs.readFileSync("dist/app.js", "utf8");
let passes = 0, falhas = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const j = JSON.stringify;
const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });
const volume = (id) => ({ id, titulo: "Volume " + id.toUpperCase(), personagem: "Batman", editora: "DC Comics",
  tipo: "Trade Paperback", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: [] });
const colecoes = [
  { id: "one", nome: "Principal", descricao: "Keep every field", membros: ["a", "b", "c"], corBarra: { h: 25 } },
  { id: "two", nome: "Outra", descricao: "Unchanged", membros: ["c", "a"] },
  { id: "dup", nome: "Repetidos", descricao: "", membros: ["a", "a", "b"], corBarra: { longbox: true } },
];

async function montar(cols = colecoes, reduced = false) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.test/",
  });
  const { window: W } = dom, erros = [], writes = [];
  W.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el }]); } unobserve() {} disconnect() {} };
  W.scrollTo = () => {};
  W.HTMLElement.prototype.scrollIntoView = () => {};
  W.matchMedia = (q) => ({ matches: q.includes("pointer: fine") || (reduced && q.includes("prefers-reduced-motion")), media: q,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  W.addEventListener("error", (e) => erros.push(e.error?.stack || e.message));
  W.console.error = (...a) => erros.push(a.join(" "));
  W.sessionStorage.setItem("longbox:aba", "colecoes");
  Object.defineProperty(W, "innerHeight", { value: 800, configurable: true });
  const P = W.HTMLElement.prototype;
  P.setPointerCapture = () => {};
  P.releasePointerCapture = () => {};
  Object.defineProperty(P, "scrollWidth", { configurable: true, get() {
    return this.classList.contains("coll-strip") ? this.children.length * 100 - 10 : 0;
  } });
  Object.defineProperty(P, "clientWidth", { configurable: true, get() {
    return this.classList.contains("coll-strip") || this.classList.contains("content") ? 340 : 0;
  } });
  P.getBoundingClientRect = function () {
    const y = 200 - W.document.documentElement.scrollTop;
    if (this.classList.contains("coll-strip")) return rect(10, y, 340, 220);
    if (this.parentElement?.classList.contains("coll-strip")) {
      return rect(10 + [...this.parentElement.children].indexOf(this) * 100 - this.parentElement.scrollLeft, y, 90, 220);
    }
    if (this.classList.contains("vol") || this.classList.contains("cover")) {
      const slot = this.closest("[data-membro-indice]")?.getBoundingClientRect();
      if (slot) return rect(slot.left, slot.top + 20, 90, this.classList.contains("cover") ? 135 : 190);
    }
    return rect(0, 0, 340, 0);
  };
  const docs = new Map([
    ["library/volumes", { items: ["a", "b", "c", "d", "e", "f"].map(volume) }],
    ["library/colecoes", { items: JSON.parse(j(cols)) }],
    ["library/series", { items: [] }], ["library/cores", { mapa: {} }],
    ["library/editoras", { itens: [{ id: "dc", nome: "DC Comics", cor: { h: 220 }, logoAssetId: null, logoFundo: "nenhum" }], selecionada: "__todas__" }],
  ]);
  const makeDoc = (path) => ({ path,
    get: async () => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path), metadata: {} }),
    set: async (body) => { writes.push(path); docs.set(path, JSON.parse(j(body))); },
    delete: async () => docs.delete(path),
  });
  W.claude = { use: async (n) => n === "db" ? { doc: makeDoc,
    collection: (c) => ({ doc: (id) => makeDoc(c + "/" + id), get: async () => ({ docs: [], size: 0, empty: true, docChanges: () => [], metadata: {} }) }),
  } : null };
  W.eval(bundle);
  await sleep(750);
  writes.length = 0;
  const root = W.document.getElementById("root");
  const secao = (nome = "Principal") => [...root.querySelectorAll(".coll")].find((s) => s.querySelector("h2")?.textContent === nome);
  const strip = (nome) => secao(nome)?.querySelector(".coll-strip");
  const cards = (nome) => [...(strip(nome)?.querySelectorAll(".vol") || [])];
  const ids = (nome) => cards(nome).map((el) => el.dataset.vid).join();
  const saved = (id = "one") => docs.get("library/colecoes").items.find((c) => c.id === id);
  const ghost = () => W.document.querySelector('[data-drag-ghost="true"]');
  const pointer = (el, type, x, y = 260, pointerId = 1) => {
    const e = new W.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
    Object.defineProperty(e, "pointerId", { value: pointerId });
    el.dispatchEvent(e);
    return e;
  };
  const fechar = async () => { root.querySelector('.sheet [aria-label="Fechar"]')?.click(); await sleep(400); };
  return { dom, W, root, erros, writes, docs, secao, strip, cards, ids, saved, ghost, pointer, fechar };
}

const m = await montar();
check("collection swatch supplies the hold colour", m.cards()[0].style.getPropertyValue("--hold-color") === m.secao().querySelector(".shelf-wrap").style.getPropertyValue("--shelf-cor"));
check("without a swatch the card carries no hold colour of its own", m.cards("Outra")[0].style.getPropertyValue("--hold-color") === "");
{
  // The ring then follows what the bar draws with, the band's accent, resolved when the press starts.
  const carta = m.cards("Outra")[0];
  carta.closest(".coll-strip").style.setProperty("--ed-accent", "rgb(1, 2, 3)");
  m.pointer(carta, "pointerdown", 100);
  check("without a swatch the ring takes the bar accent at press time", carta.style.getPropertyValue("--hold-color") === "rgb(1, 2, 3)", carta.style.getPropertyValue("--hold-color"));
  m.pointer(carta, "pointerup", 100);
}
check("Longbox swatch uses the accent variable", m.cards("Repetidos")[0].style.getPropertyValue("--hold-color") === "var(--accent)");
const before = j(m.docs.get("library/volumes")), other = j(m.saved("two")), duplicates = j(m.saved("dup"));
const picked = m.cards()[0];
m.pointer(picked, "pointerdown", 40);
await sleep(200);
check("hold uses the existing fill and crest", !!picked.querySelector(".vol-hold__crest") && Number(picked.querySelector(".cover").style.getPropertyValue("--hold-p")) > 0 && !m.ghost());
await sleep(300);
check("450ms hold creates a fixed body ghost below chrome", m.ghost()?.parentElement === m.W.document.body && m.ghost().style.position === "fixed" && m.ghost().style.zIndex === "14" && m.ghost().style.pointerEvents === "none");
check("ghost shares the existing lifted wiggle selector", m.ghost()?.dataset.dragging === "true" && !m.ghost().dataset.dragSettling);
check("real card leaves a layout hole", picked.dataset.dragHole === "true" && picked.closest(".coll-strip") === m.strip());
check("strip ancestors are not lifted", !m.strip().style.zIndex && !m.strip().closest(".aba").style.zIndex);
const move = m.pointer(picked, "pointermove", 250);
await sleep(100);
check("live preview reinserts directly at the fixed target", m.ids() === "b,c,a" && m.cards()[2] === picked);
check("badges renumber live along the preview", [...m.strip().querySelectorAll(".slot-order")].map((el) => el.textContent).join() === "01,02,03" && picked.previousElementSibling.textContent === "03");
check("ghost follows the pointer and grab offset", m.ghost()?.style.transform === "translate(220px, 220px) scale(1.06)", m.ghost()?.style.transform);
check("armed pointermove prevents native movement", move.defaultPrevented);
check("preview persists nothing before release", m.writes.length === 0 && m.saved().membros.join() === "a,b,c");
m.pointer(m.W, "pointercancel", 250, 260, 2); await sleep(50);
check("another pointer cannot cancel the drag", !!m.ghost() && m.ids() === "b,c,a");
const touch = new m.W.Event("touchmove", { bubbles: true, cancelable: true });
m.W.dispatchEvent(touch);
check("armed drag blocks native touch movement", touch.defaultPrevented);
// Animated neighbours cannot change which fixed slot owns the point.
const neighbour = m.cards()[0].parentElement;
neighbour.getBoundingClientRect = () => rect(240, 200, 90, 220);
await sleep(100);
check("targeting ignores an animated neighbour rectangle", m.ids() === "b,c,a");
delete neighbour.getBoundingClientRect;
m.pointer(picked, "pointerup", 250);
picked.click(); await sleep(50);
check("drag click does not open the volume", !m.root.querySelector('.sheet[data-in="true"]'));
check("ghost settles while the real card remains hidden", !!m.ghost()?.dataset.dragSettling && picked.dataset.dragHole === "true");
await sleep(700);
check("release writes the collection member order", m.saved().membros.join() === "b,c,a");
check("only the collection document is written", m.writes.length === 1 && m.writes[0] === "library/colecoes", m.writes.join());
check("volumes and HQ order are untouched", j(m.docs.get("library/volumes")) === before);
check("other collections are untouched", j(m.saved("two")) === other && j(m.saved("dup")) === duplicates);
check("collection fields besides membros stay intact", m.saved().descricao === "Keep every field" && j(m.saved().corBarra) === '{"h":25}' && m.saved().nome === "Principal");
check("ghost and hole are removed after release", !m.ghost() && !m.strip().querySelector("[data-drag-hole]"));
[...m.secao().querySelectorAll("button")].find((b) => b.textContent === "Gerenciar").click(); await sleep(180);
check("Gerenciar reads the same persisted reading order", [...m.root.querySelectorAll(".sheet .ordem-titulo")].map((el) => el.textContent).join() === "Volume B,Volume C,Volume A");
await m.fechar();

const saved = j(m.docs.get("library/colecoes"));
m.writes.length = 0;
const cancelCard = m.cards()[2];
m.pointer(cancelCard, "pointerdown", 240); await sleep(500);
m.pointer(cancelCard, "pointermove", 40); await sleep(100);
check("a subsequent drag has its own original order", m.ids() === "a,b,c");
m.pointer(cancelCard, "pointermove", 600); await sleep(100);
check("leaving the strip restores the original preview", m.ids() === "b,c,a");
m.pointer(cancelCard, "pointerup", 600); await sleep(750);
check("release outside the strip persists nothing", m.writes.length === 0 && j(m.docs.get("library/colecoes")) === saved);
check("outside release removes the ghost and hole", !m.ghost() && !m.strip().querySelector("[data-drag-hole]"));
// A normal pointer press/release resets suppression and still opens the volume.
const tap = m.cards()[0];
m.pointer(tap, "pointerdown", 40); m.pointer(tap, "pointerup", 40); tap.click(); await sleep(180);
check("a plain tap opens the volume after a cancelled drag", m.root.querySelector('.sheet[data-in="true"] .dialog-titulo')?.textContent === "Volume B");
await m.fechar();

const cancel = async (type) => {
  const el = m.cards()[0];
  m.pointer(el, "pointerdown", 40); await sleep(500);
  m.pointer(el, "pointermove", 250); await sleep(100);
  if (type === "blur") m.W.dispatchEvent(new m.W.Event("blur")); else m.pointer(m.W, type, 250);
  await sleep(750);
};
await cancel("pointercancel");
check("window pointercancel removes ghost and restores order", !m.ghost() && m.ids() === "b,c,a" && j(m.docs.get("library/colecoes")) === saved);
await cancel("blur");
check("blur removes ghost without persisting", !m.ghost() && m.writes.length === 0 && j(m.docs.get("library/colecoes")) === saved);
const keyboardCard = m.cards()[0];
keyboardCard.focus();
keyboardCard.dispatchEvent(new m.W.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
keyboardCard.click(); // JSDOM does not perform the browser's native Enter click.
await sleep(180);
check("keyboard activation works after a cancelled drag", m.root.querySelector('.sheet[data-in="true"] .dialog-titulo')?.textContent === "Volume B");
await m.fechar();
const early = m.cards()[0];
m.pointer(early, "pointerdown", 40); m.pointer(m.W, "pointerup", 600); await sleep(550);
check("release outside during the hold disarms its timer", !m.ghost() && !early.dataset.dragHole);
early.focus();
early.dispatchEvent(new m.W.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
check("strip keyboard navigation still works", m.W.document.activeElement === m.cards()[1]);

const duplicate = m.cards("Repetidos")[1];
m.pointer(duplicate, "pointerdown", 140); await sleep(500);
m.pointer(duplicate, "pointermove", 250); await sleep(100);
check("duplicate ids drag by occurrence index", m.ids("Repetidos") === "a,b,a" && m.cards("Repetidos")[2] === duplicate);
m.pointer(m.W, "pointerup", 250); await sleep(750);
check("duplicate occurrences persist without loss or duplication", m.saved("dup").membros.join() === "a,b,a" && m.saved("dup").membros.length === 3);
check("duplicate drag leaves both other collections intact", m.saved().membros.join() === "b,c,a" && j(m.saved("two")) === other);
const foldCard = m.cards()[0];
m.pointer(foldCard, "pointerdown", 40); await sleep(500);
m.secao().querySelector('[aria-label="Esconder os volumes de Principal"]').click(); await sleep(100);
check("folding an armed collection cleans its ghost immediately", !m.ghost() && !m.strip() && m.saved().membros.join() === "b,c,a");
// Removing through Gerenciar models the collection disappearing during a drag.
[...m.secao("Repetidos").querySelectorAll("button")].find((b) => b.textContent === "Gerenciar").click(); await sleep(180);
const removedCard = m.cards("Repetidos")[0];
m.pointer(removedCard, "pointerdown", 40); await sleep(500);
m.root.querySelector('.sheet[data-in="true"] [aria-label="Remover"]').click(); await sleep(100);
check("removing an armed collection cleans its ghost immediately", !m.ghost() && !m.secao("Repetidos"));
await sleep(700);
check("collection removal during a drag does not commit its preview", !m.saved("dup") && m.saved().membros.join() === "b,c,a" && j(m.saved("two")) === other && j(m.docs.get("library/volumes")) === before);
check("no runtime errors in collection gestures", m.erros.length === 0, m.erros[0]);

const long = await montar([{ ...colecoes[0], membros: ["a", "b", "c", "d", "e", "f"] }]);
const longCard = long.cards()[0];
long.pointer(longCard, "pointerdown", 40); await sleep(500);
long.pointer(longCard, "pointermove", 340); await sleep(180);
check("armed drag scrolls the strip horizontally", long.strip().scrollLeft > 0 && long.strip().scrollLeft <= 250, long.strip().scrollLeft);
check("content-coordinate targets advance as the strip scrolls", long.cards().indexOf(longCard) >= 3);
long.pointer(long.W, "pointercancel", 340); await sleep(300);
check("horizontal scroll cancellation cleans the ghost", !long.ghost() && long.saved().membros.join() === "a,b,c,d,e,f");
const page = long.W.document.documentElement;
Object.defineProperty(page, "scrollHeight", { configurable: true, value: 2000 });
page.scrollTop = 0;
const topbar = long.root.querySelector(".topbar"), band = long.root.querySelector(".ed-band");
topbar.style.position = "sticky"; topbar.style.top = "0px"; topbar.getBoundingClientRect = () => rect(0, 0, 800, 76);
band.style.position = "sticky"; band.style.top = "76px"; band.getBoundingClientRect = () => rect(0, 76, 800, 54);
const pageCard = long.cards()[0];
long.pointer(pageCard, "pointerdown", 40); await sleep(500);
page.scrollTop = 400;
long.pointer(pageCard, "pointermove", 40, 100); await sleep(100);
check("page auto-scroll runs at the chrome-aware top edge", page.scrollTop < 400);
long.pointer(long.W, "pointercancel", 40, 100); await sleep(300);
check("no runtime errors in horizontal and page auto-scroll", long.erros.length === 0, long.erros[0]);

const reduced = await montar([{ ...colecoes[0], membros: ["a", "missing", "b", "c"] }], true);
const snap = reduced.cards()[0];
reduced.pointer(snap, "pointerdown", 40); await sleep(500);
check("reduced motion ghost does not scale", reduced.ghost()?.style.transform.endsWith("scale(1)"));
reduced.pointer(snap, "pointerup", 250); await sleep(50);
check("reduced motion settlement removes the ghost immediately", !reduced.ghost() && !reduced.strip().querySelector("[data-drag-hole]"));
await sleep(700);
check("missing member ids survive reordering", reduced.saved().membros.join() === "missing,b,c,a");
check("no runtime errors with reduced motion and missing ids", reduced.erros.length === 0, reduced.erros[0]);

for (const mounted of [m, long, reduced]) mounted.dom.window.close();
console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
