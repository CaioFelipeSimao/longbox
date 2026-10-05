import { JSDOM } from "jsdom";
import fs from "node:fs";
import esbuild from "esbuild";

// Claude rebuilds the app before this suite. Layout offsets deliberately stay
// independent of animated rects, including variable heights and body scrolling.
const bundle = fs.readFileSync("dist/app.js", "utf8");
let passes = 0, falhas = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const j = JSON.stringify;
const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });
const serie = (id) => ({ id, nome: "Serie " + id.toUpperCase(), editora: "DC Comics", anoInicio: "2000",
  personagens: [{ nome: "Batman", de: null, ate: null }], totalEdicoes: 16 });
const ed = (sid, n) => ({ id: sid + "-" + n, serieId: sid, numero: String(n), mes: "", ano: "", posicao: null });
const edicoes = [ed("s1", 1), ...Array.from({ length: 16 }, (_, i) => ed("s2", i + 1)), ed("s3", 1), ed("gone", 1), ed("s4", 1)];
const volume = (id) => ({ id, titulo: "Volume " + id.toUpperCase(), personagem: "Batman", editora: "DC Comics",
  tipo: "Trade Paperback", ano: "2020", status: "nao_lida", notas: "Keep this field", ordem: id === "a" ? 0 : 1,
  edicoesColetadasIds: edicoes.filter((e) => e.serieId !== "s4").map((e) => e.id) });

async function montar({ stored, reduced = false, long = false } = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.test/",
  });
  const { window: W } = dom, erros = [], writes = [], downloads = [];
  W.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el }]); } unobserve() {} disconnect() {} };
  W.scrollTo = () => {};
  W.HTMLElement.prototype.scrollIntoView = () => {};
  W.matchMedia = (q) => ({ matches: q.includes("pointer: fine") || q.includes("max-width: 767px") ||
    (reduced && q.includes("prefers-reduced-motion")), media: q,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  W.addEventListener("error", (e) => erros.push(e.error?.stack || e.message));
  W.console.error = (...a) => erros.push(a.join(" "));
  W.sessionStorage.setItem("longbox:aba", "volumes");
  Object.defineProperty(W, "innerHeight", { value: 800, configurable: true });
  const P = W.HTMLElement.prototype;
  P.setPointerCapture = () => {};
  P.releasePointerCapture = () => {};
  const height = (el) => (el.dataset.serieKey === "s2" ? (long ? 700 : 180) :
    el.dataset.serieKey === "?" ? 60 : el.dataset.serieKey === "s3" ? 100 : 80);
  const top = (el) => 120 + [...el.parentElement.children].slice(0, [...el.parentElement.children].indexOf(el))
    .reduce((y, n) => y + height(n) + 8, 0);
  Object.defineProperty(P, "offsetParent", { configurable: true, get() {
    return this.hasAttribute("data-serie-key") ? this.closest(".sheet-body") : null;
  } });
  Object.defineProperty(P, "offsetTop", { configurable: true, get() {
    return this.hasAttribute("data-serie-key") ? top(this) : this.classList.contains("sheet-body") ? 100 : 0;
  } });
  Object.defineProperty(P, "offsetHeight", { configurable: true, get() {
    return this.hasAttribute("data-serie-key") ? height(this) : 0;
  } });
  Object.defineProperty(P, "clientHeight", { configurable: true, get() { return this.classList.contains("sheet-body") ? 640 : 0; } });
  Object.defineProperty(P, "scrollHeight", { configurable: true, get() { return this.classList.contains("sheet-body") ? (long ? 1800 : 640) : 0; } });
  P.getBoundingClientRect = function () {
    if (this.classList.contains("sheet-body")) return rect(0, 100, 360, 640);
    if (this.classList.contains("linked-series")) {
      return rect(20, 220 - this.closest(".sheet-body").scrollTop, 320,
        [...this.children].reduce((y, n) => y + height(n) + 8, -8));
    }
    if (this.hasAttribute("data-serie-key") && !this.dataset.dragGhost) {
      const dy = Number(this.style.transform.match(/translateY\(([-.\d]+)px\)/)?.[1] || 0);
      return rect(20, 100 + top(this) - this.closest(".sheet-body").scrollTop + dy, 320, height(this));
    }
    return rect(0, 0, 360, 0);
  };
  const docs = stored ? new Map(JSON.parse(j([...stored]))) : new Map([
    ["library/volumes", { items: [volume("a"), { ...volume("b"), ordemSeries: ["s3", "s1"] }] }],
    ["library/colecoes", { items: [] }],
    ["library/series", { items: ["s1", "s2", "s3", "s4"].map(serie) }],
    ["library/cores", { mapa: {} }],
    ["library/editoras", { itens: [{ id: "dc", nome: "DC Comics", cor: { h: 220 }, logoAssetId: null }], selecionada: "__todas__" }],
    ...["s1", "s2", "s3", "gone", "s4"].map((sid) => ["edicoes/" + sid, { items: edicoes.filter((e) => e.serieId === sid) }]),
  ]);
  const makeDoc = (path) => ({ path,
    get: async () => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path), metadata: {} }),
    set: async (body) => { writes.push(path); docs.set(path, JSON.parse(j(body))); },
    delete: async () => docs.delete(path),
  });
  W.claude = { use: async (n) => n === "downloads" ? { save: async (file) => downloads.push(file) } : n === "db" ? {
    doc: makeDoc, collection: (path) => ({ doc: (id) => makeDoc(path + "/" + id), get: async () => {
      const list = [...docs.keys()].filter((k) => k.startsWith(path + "/"))
        .map((k) => ({ id: k.split("/").pop(), data: () => docs.get(k), metadata: {} }));
      return { docs: list, size: list.length, empty: !list.length, docChanges: () => [], metadata: {} };
    } }),
  } : null };
  W.eval(bundle);
  await sleep(750);
  writes.length = 0;
  const root = W.document.getElementById("root");
  const sheet = () => root.querySelector('.sheet[data-variante="volume"][data-in="true"]');
  const cards = () => [...(sheet()?.querySelectorAll(".linked-series > [data-serie-key]") || [])];
  const keys = () => cards().map((el) => el.dataset.serieKey).join();
  const saved = (id = "a") => docs.get("library/volumes").items.find((v) => v.id === id);
  const ghost = () => W.document.querySelector('[data-drag-ghost="true"]');
  const pointer = (el, type, x, y, pointerId = 1) => {
    const e = new W.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
    Object.defineProperty(e, "pointerId", { value: pointerId });
    el.dispatchEvent(e);
    return e;
  };
  const touch = (el, type, x, y) => {
    const e = new W.Event(type, { bubbles: true, cancelable: true });
    const list = [{ clientX: x, clientY: y, identifier: 1 }];
    Object.defineProperty(e, "touches", { value: type === "touchend" ? [] : list });
    Object.defineProperty(e, "changedTouches", { value: list });
    el.dispatchEvent(e);
    return e;
  };
  const abrir = async (id = "a") => { root.querySelector('.vol[data-vid="' + id + '"]')?.click(); await sleep(220); };
  const fechar = async () => { [...root.querySelectorAll('.sheet[data-in="true"]')].at(-1)?.querySelector('[aria-label="Fechar"]')?.click(); await sleep(350); };
  const button = (scope, text) => [...scope.querySelectorAll("button")].find((b) => b.textContent.trim() === text);
  return { dom, W, root, docs, erros, writes, downloads, sheet, cards, keys, saved, ghost, pointer, touch, abrir, fechar, button };
}

const m = await montar();
await m.abrir();
check("a volume without ordemSeries keeps natural group order", m.keys() === "s1,s2,s3,?", m.keys());
check("series cards retain their variable layout heights", m.cards()[1].offsetHeight > m.cards()[0].offsetHeight);
const other = j(m.saved("b")), seriesBefore = j(m.docs.get("library/series"));
const fieldsBefore = j(m.saved());
const picked = m.cards()[0], title = picked.querySelector(".t-small");
const bodyBefore = m.W.document.body.getAttribute("style");
m.pointer(title, "pointerdown", 40, 240);
await sleep(200);
check("the sheet tint colours the existing rising fill and wave", picked.style.getPropertyValue("--hold-color") ===
  m.sheet().style.getPropertyValue("--sheet-tinta") && !!picked.querySelector(".vol-hold__crest") && Number(picked.style.getPropertyValue("--hold-p")) > 0);
check("a short hold has not created a ghost", !m.ghost());
await sleep(300);
check("holding the title arms a fixed inert ghost over the sheet", m.ghost()?.parentElement === m.W.document.body &&
  m.ghost().style.position === "fixed" && m.ghost().style.zIndex === "90" && m.ghost().hasAttribute("inert") &&
  m.ghost().style.pointerEvents === "none" && m.ghost().getAttribute("aria-hidden") === "true");
check("arming leaves the original card as a hole", picked.dataset.dragHole === "true" && picked.parentElement.classList.contains("linked-series"));
check("the clone retains buttons without adding duplicate ids", !!m.ghost()?.querySelector("button.tile") && !m.ghost().querySelector("[id]"));
const move = m.pointer(picked, "pointermove", 40, 650);
await sleep(100);
check("the first card inserts directly after all shorter and taller neighbours", m.keys() === "s2,s3,?,s1", m.keys());
check("the armed pointer move prevents native movement", move.defaultPrevented);
check("the ghost retains the title grab offset", m.ghost()?.style.transform === "translate(20px, 630px) scale(1.06)", m.ghost()?.style.transform);
check("the live preview persists nothing", m.writes.length === 0 && !("ordemSeries" in m.saved()));
const neighbour = m.cards()[0];
neighbour.getBoundingClientRect = () => rect(20, 620, 320, 180);
await sleep(100);
check("animated neighbour rectangles never change the insertion decision", m.keys() === "s2,s3,?,s1");
delete neighbour.getBoundingClientRect;
m.pointer(m.W, "pointercancel", 40, 650, 2);
check("another pointer cannot cancel an armed reorder", !!m.ghost());
m.pointer(m.W, "pointerup", 40, 650);
check("release keeps the ghost while gliding to the final slot", !!m.ghost());
picked.querySelector("button.tile").dispatchEvent(new m.W.MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }));
await sleep(50);
check("the pointer click produced by a drag cannot open an issue", m.sheet()?.dataset.behind !== "true");
await sleep(750);
check("release writes the complete ordemSeries including the removed group", m.saved().ordemSeries?.join() === "s2,s3,?,s1");
check("only the volume document is written", m.writes.length === 1 && m.writes[0] === "library/volumes", m.writes.join());
check("the other volume and its own series order are unchanged", j(m.saved("b")) === other);
const { ordemSeries, ...remaining } = m.saved();
check("all the selected volume's other fields are preserved", j(remaining) === fieldsBefore);
check("series themselves are not reordered", j(m.docs.get("library/series")) === seriesBefore);
check("the sheet keeps the committed order after the preview ends", m.keys() === "s2,s3,?,s1");
check("release removes the ghost and hole without touching body styles", !m.ghost() && !m.sheet().querySelector("[data-drag-hole]") && m.W.document.body.getAttribute("style") === bodyBefore);

const reload = await montar({ stored: m.docs });
await reload.abrir();
check("reloading the library preserves the saved sheet order", reload.keys() === "s2,s3,?,s1", reload.keys());
await reload.fechar(); await reload.abrir("b");
check("listed groups precede unlisted groups in their natural relative order", reload.keys() === "s3,s1,s2,?", reload.keys());

m.writes.length = 0;
const persisted = j(m.docs.get("library/volumes"));
const cancelled = m.cards().at(-1);
m.pointer(cancelled, "pointerdown", 40, 610); await sleep(500);
m.pointer(cancelled, "pointermove", 40, 215); await sleep(80);
check("a later drag starts from the saved series order", m.keys() === "s1,s2,s3,?");
m.pointer(cancelled, "pointermove", 500, 215); await sleep(80);
check("leaving the expanded cards box restores the original preview", m.keys() === "s2,s3,?,s1");
m.pointer(m.W, "pointerup", 500, 215); await sleep(750);
check("release outside persists nothing", m.writes.length === 0 && j(m.docs.get("library/volumes")) === persisted);
check("outside release removes the ghost and hole", !m.ghost() && !m.sheet().querySelector("[data-drag-hole]"));

const tile = m.cards()[0].querySelector("button.tile");
m.pointer(tile, "pointerdown", 40, 270); await sleep(500);
check("holding an issue tile never arms", !m.ghost() && !m.sheet().querySelector("[data-drag-hole]"));
m.pointer(tile, "pointerup", 40, 270); tile.click(); await sleep(220);
check("the tile still opens its issue in a stacked series sheet", m.sheet()?.dataset.behind === "true" &&
  [...m.root.querySelectorAll('.sheet[data-in="true"]')].some((s) => s !== m.sheet() && s.querySelector(".dialog-titulo")?.textContent === "Serie S2"));
await m.fechar();
const manage = m.button(m.cards()[0], "Gerenciar");
m.pointer(manage, "pointerdown", 280, 240); await sleep(500);
check("holding Gerenciar never arms", !m.ghost());
m.pointer(manage, "pointerup", 280, 240); manage.click(); await sleep(100);
check("Gerenciar still opens its linking panel", !!m.sheet().querySelector(".checkline input") &&
  !!m.button(m.sheet(), "Fechar"));
m.button(m.sheet(), "Fechar").click(); await sleep(80);

const early = m.cards()[0];
m.pointer(early, "pointerdown", 40, 240);
const scrollMove = m.pointer(m.W, "pointermove", 40, 252); await sleep(500);
check("moving more than 10px before arming preserves normal scrolling", !scrollMove.defaultPrevented && !m.ghost());
m.pointer(early, "pointerdown", 40, 240); m.pointer(m.W, "pointerup", 500, 240); await sleep(500);
check("a window release during the hold cancels the timer", !m.ghost());

const missing = m.cards().find((el) => el.dataset.serieKey === "?");
const missingY = missing.getBoundingClientRect().top + 20;
m.pointer(missing.querySelector(".t-small"), "pointerdown", 40, missingY); await sleep(500);
m.pointer(m.W, "pointerup", 40, 215); await sleep(750);
check("Serie removida is orderable with the question-mark key", m.saved().ordemSeries?.join() === "?,s2,s3,s1" && m.keys() === "?,s2,s3,s1");

for (const type of ["pointercancel", "blur"]) {
  const el = m.cards()[0];
  m.pointer(el, "pointerdown", 40, 240); await sleep(500);
  m.pointer(el, "pointermove", 40, 650); await sleep(80);
  if (type === "blur") m.W.dispatchEvent(new m.W.Event("blur")); else m.pointer(m.W, type, 40, 650);
  await sleep(350);
}
check("pointercancel and blur restore the order and remove ghosts", !m.ghost() && m.keys() === "?,s2,s3,s1" && m.saved().ordemSeries.join() === "?,s2,s3,s1");
await sleep(500); m.writes.length = 0;
const el = m.cards()[0];
m.pointer(el, "pointerdown", 40, 240); m.touch(el, "touchstart", 40, 240);
m.pointer(el, "pointermove", 40, 249); m.touch(el, "touchmove", 40, 249);
await sleep(500);
const touchMove = m.touch(el, "touchmove", 200, 420);
m.pointer(m.W, "pointerup", 40, 240);
m.touch(el, "touchend", 200, 249); await sleep(350);
check("an armed touch cannot dismiss or navigate the sheet", touchMove.defaultPrevented && m.sheet()?.querySelector(".dialog-titulo")?.textContent === "Volume A" && !m.sheet().style.transform);
const afterTouch = m.touch(el, "touchmove", 40, 450);
check("settlement removes the window touch blocker", !afterTouch.defaultPrevented && !m.ghost());
await sleep(500); m.writes.length = 0;
const navCard = m.cards()[0];
m.pointer(navCard, "pointerdown", 40, 240); await sleep(500);
m.W.dispatchEvent(new m.W.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
await sleep(120);
check("arrow navigation mid-drag removes the ghost without committing", !m.ghost() && m.sheet()?.querySelector(".dialog-titulo")?.textContent === "Volume B" && m.writes.length === 0);
const closeCard = m.cards()[0];
m.pointer(closeCard, "pointerdown", 40, 240); await sleep(500);
await m.fechar();
check("closing the sheet mid-drag removes ghost and window listeners", !m.ghost() && m.writes.length === 0 && !m.touch(m.W, "touchmove", 40, 420).defaultPrevented);

// Link a previously unlisted series through the real picker and LinkPanel.
await m.abrir();
m.button(m.sheet(), "Vincular edições de uma série").click(); await sleep(80);
const picker = m.root.querySelector("#vincular-serie");
picker.focus(); picker.click(); await sleep(100);
[...m.root.querySelectorAll('#vincular-serie-lista [role="option"]')].find((n) => n.textContent.includes("Serie S4"))?.click();
await sleep(100);
m.sheet().querySelector(".checkline input")?.click(); await sleep(750);
check("a newly linked series is appended after all saved groups", m.keys() === "?,s2,s3,s1,s4", m.keys());
check("linking preserves the saved order field", m.saved().ordemSeries?.join() === "?,s2,s3,s1");
await m.fechar();

// The real exporter serializes the full library, and import normalizes it.
// The export lives in the hub footer: go home first.
m.root.querySelector('[aria-label="Voltar ao início"]').click(); await sleep(500);
m.button(m.root, "Exportar backup").click(); await sleep(100);
const backup = JSON.parse(m.downloads.at(-1).data);
check("backup export retains the per-volume order", backup.volumes.find((v) => v.id === "a").ordemSeries.join() === "?,s2,s3,s1");
const imported = { ...backup, volumes: backup.volumes.map((v) => v.id === "a" ? { ...v, ordemSeries: ["s4", "?", "s1", "s3", "s2"] } : v) };
const fileInput = m.root.querySelector('input[type="file"][accept="application/json,.json"]') ||
  [...m.root.querySelectorAll('input[type="file"]')].find((n) => n.accept.includes("json"));
Object.defineProperty(fileInput, "files", { configurable: true, value: [new m.W.File([j(imported)], "longbox.json", { type: "application/json" })] });
fileInput.dispatchEvent(new m.W.Event("change", { bubbles: true })); await sleep(100);
m.button(m.root.querySelector(".modal"), "Substituir").click(); await sleep(750);
await m.abrir();
check("backup import preserves and renders the imported series order", m.keys() === "s4,?,s1,s3,s2" && m.saved().ordemSeries.join() === "s4,?,s1,s3,s2");
m.sheet().querySelector('[aria-label="Duplicar este volume"]').click(); await sleep(100);
const duplicateModal = m.root.querySelector(".modal"), duplicateTitle = duplicateModal.querySelector("input.input");
Object.getOwnPropertyDescriptor(m.W.HTMLInputElement.prototype, "value").set.call(duplicateTitle, "Separate copy");
duplicateTitle.dispatchEvent(new m.W.Event("input", { bubbles: true })); await sleep(80);
duplicateModal.querySelector(".btn-primary").click(); await sleep(750);
const duplicate = m.docs.get("library/volumes").items.find((v) => v.titulo === "Separate copy");
check("duplicating a volume does not copy ordemSeries", !!duplicate && !("ordemSeries" in duplicate));
check("duplicating leaves the source volume order intact", m.saved().ordemSeries.join() === "s4,?,s1,s3,s2");

const long = await montar({ long: true }); await long.abrir();
const longCard = long.cards()[0], body = long.sheet().querySelector(".sheet-body");
long.pointer(longCard, "pointerdown", 40, 240); await sleep(500);
long.pointer(longCard, "pointermove", 40, 730); await sleep(200);
check("auto-scroll runs inside the sheet body", body.scrollTop > 0 && long.W.document.documentElement.scrollTop === 0, body.scrollTop);
body.scrollTop = body.scrollHeight - body.clientHeight;
await sleep(60);
check("sheet auto-scroll stops at its bottom", body.scrollTop === body.scrollHeight - body.clientHeight);
long.pointer(long.W, "pointercancel", 40, 730); await sleep(350);
check("auto-scroll cancellation removes the ghost without persisting", !long.ghost() && !("ordemSeries" in long.saved()));
body.scrollTop = 0;
long.pointer(longCard, "pointerdown", 40, 240); await sleep(500);
long.pointer(long.W, "pointerup", 40, 240); await sleep(750);
check("committing the natural order still writes an explicit ordemSeries", long.saved().ordemSeries?.join() === "s1,s2,s3,?", long.saved().ordemSeries?.join());

const reduced = await montar({ reduced: true }); await reduced.abrir();
const snap = reduced.cards()[0];
reduced.pointer(snap, "pointerdown", 40, 240); await sleep(500);
check("reduced motion does not scale the sheet ghost", reduced.ghost()?.style.transform.endsWith("scale(1)"));
reduced.pointer(reduced.W, "pointerup", 40, 650); await sleep(50);
check("reduced motion snaps into place and removes the ghost immediately", !reduced.ghost() && !reduced.sheet().querySelector("[data-drag-hole]"));
await sleep(700);
check("reduced motion still commits the complete order", reduced.saved().ordemSeries?.join() === "s2,s3,?,s1");

// Follow the other model suites: import the actual modules, without exposing
// test-only app globals. This build is run by Claude with npm run check.
const out = esbuild.buildSync({ stdin: { contents: 'export { normalizeLib } from "./src/lib/biblioteca"; export { aplicarMescladas } from "./src/lib/armazenamento";', resolveDir: process.cwd() }, bundle: true, format: "esm", write: false });
const { normalizeLib, aplicarMescladas } = await import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
const valid = ["s3", "?", "s1"];
const normalized = normalizeLib({ volumes: [
  { ...volume("valid"), ordemSeries: valid }, { ...volume("empty"), ordemSeries: [] }, volume("absent"),
  ...[null, "s1", {}, ["s1", ""], ["s1", "  "], ["s1", 4]].map((ordemSeries, i) => ({ ...volume("bad" + i), ordemSeries })),
] });
check("normalizeLib keeps valid series ids and the removed key", normalized.volumes[0].ordemSeries.join() === "s3,?,s1" && normalized.volumes[0].ordemSeries !== valid);
check("normalizeLib keeps an empty valid array", Array.isArray(normalized.volumes[1].ordemSeries) && normalized.volumes[1].ordemSeries.length === 0);
check("normalizeLib drops every malformed series order", normalized.volumes.slice(3).every((v) => !("ordemSeries" in v)));
check("normalizeLib leaves the field absent on older volumes", !("ordemSeries" in normalized.volumes[2]));
const base = normalizeLib({ volumes: [volume("a"), volume("b")] });
const local = { ...base, volumes: base.volumes.map((v) => v.id === "a" ? { ...v, ordemSeries: valid } : v) };
const remote = base.volumes.map((v) => v.id === "b" ? { ...v, notas: "Remote edit", ordemSeries: ["s2"] } : v);
const merged = aplicarMescladas(local, [{ chave: "volumes", local: base.volumes, parte: remote }]);
check("armazenamento merge preserves a local reorder and a remote volume edit", merged.volumes[0].ordemSeries.join() === valid.join() && merged.volumes[1].notas === "Remote edit" && merged.volumes[1].ordemSeries.join() === "s2");
check("normalization after JSON backup round-trip keeps ordemSeries", normalizeLib(JSON.parse(j(local))).volumes[0].ordemSeries.join() === valid.join());
check("no runtime errors in sheet reorders, reload, linking, backup and scrolling", [m, reload, long, reduced].every((n) => n.erros.length === 0), [m, reload, long, reduced].flatMap((n) => n.erros).join("\n"));

for (const mounted of [m, reload, long, reduced]) mounted.dom.window.close();
console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
