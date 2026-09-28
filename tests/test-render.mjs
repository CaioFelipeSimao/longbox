import { JSDOM } from "jsdom";
import fs from "node:fs";

const bundle = fs.readFileSync("dist/app.js", "utf8");
// The app's own source, every module under src/ (it was one app.jsx until the
// split), for the assertions that read code rather than the rendered page.
function fonteDoApp() {
  const andar = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? andar(d + "/" + e.name) : /[.]jsx?$/.test(e.name) ? [d + "/" + e.name] : []);
  return andar("src").map((p) => fs.readFileSync(p, "utf8")).join("\n");
}
const errors = [];
const logs = [];

const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
  runScripts: "outside-only",
  pretendToBeVisual: true,
  url: "https://example.test/",
});

const { window } = dom;

// JSDOM ships neither of these. The observer stub reports "visible", which is
// what the hub's bottom sentinel would report on a hub shorter than the viewport.
window.IntersectionObserver = class {
  constructor(cb) { this.cb = cb; }
  observe(el) { this.cb([{ isIntersecting: true, target: el }]); }
  unobserve() {}
  disconnect() {}
};
window.scrollTo = () => {};

// JSDOM answers every media query with false, which would keep the tab lattice
// behind its own pointer gate and leave that path untested. Report a fine
// pointer and nothing else, so prefers-reduced-motion still reads as no.
window.matchMedia = (query) => ({
  matches: query.includes("pointer: fine"),
  media: query,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
});

window.addEventListener("error", (e) => errors.push("window.error: " + (e.error?.stack || e.message)));
window.console.error = (...a) => errors.push("console.error: " + a.join(" "));
window.console.warn = (...a) => logs.push("warn: " + a.join(" "));

// Scenario under test: the no-capability path (window.claude absent),
// which is what a viewer without db/assets gets.
const scenario = process.argv[2] || "no-claude";

function seedLibrary() {
  const series = [
    { id: "s1", nome: "Nightwing (Volume 2)", personagens: [{ nome: "Nightwing", de: null, ate: null }], editora: "DC Comics", anoInicio: "1996", anoFim: "2009", totalEdicoes: 153, ordem: 1 },
    { id: "s2", nome: "Detective Comics", personagens: [{ nome: "Batman", de: null, ate: null }], editora: "DC Comics", anoInicio: "1937", anoFim: "presente", totalEdicoes: 1000, ordem: null },
  ];
  // s3 sits well past the near-complete threshold, s1 and s2 far below it, so the
  // hunt filter has something to include and something to exclude.
  series.push({ id: "s3", nome: "Demolidor (Volume 2)", personagens: [{ nome: "Demolidor", de: null, ate: null }], editora: "Marvel", anoInicio: "1998", anoFim: "2011", totalEdicoes: 119, ordem: null });
  const edicoes = [];
  for (let i = 1; i <= 153; i++) edicoes.push({ id: "e1-" + i, serieId: "s1", numero: String(i), mes: "", ano: "", posicao: null });
  for (let i = 1; i <= 400; i++) edicoes.push({ id: "e2-" + i, serieId: "s2", numero: String(i), mes: "", ano: "", posicao: null });
  for (let i = 1; i <= 119; i++) edicoes.push({ id: "e3-" + i, serieId: "s3", numero: String(i), mes: "", ano: "", posicao: null });
  const volumes = [
    { id: "v1", titulo: "Nightwing: Ano Um", personagem: "Nightwing", tipo: "Encadernado (TPB)", editora: "DC Comics", ano: "2019", status: "lida", notas: "", edicoesColetadasIds: ["e1-101", "e1-102", "e1-103"], capaAssetId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
    { id: "v2", titulo: "Nightwing: Morcegos Ferozes", personagem: "Nightwing", tipo: "Capa Dura", editora: "DC Comics", ano: "2021", status: "lendo", notas: "Releitura", edicoesColetadasIds: ["e1-1", "e1-2"] },
    { id: "v3", titulo: "Batman: Ano Um", personagem: "Batman", tipo: "Omnibus", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: ["e2-1", "e2-2", "e2-3"] },
    { id: "v4", titulo: "Demolidor por Bendis", personagem: "Demolidor", tipo: "Omnibus", editora: "Marvel", ano: "2022", status: "lida", notas: "", edicoesColetadasIds: Array.from({ length: 100 }, (_, i) => "e3-" + (i + 1)) },
    { id: "v5", titulo: "Volume sem editora", personagem: "Constantine", tipo: "Outro", editora: "", ano: "", status: "nao_lida", notas: "", edicoesColetadasIds: [] },
  ];
  // 100 volumes, past the shelf's 84 (v140). Deliberately lopsided, so the shelf's proportional sampling has to work:
  // one character dominates and one has a single volume.
  const extra = [["Batman", 64], ["Nightwing", 18], ["Demolidor", 12], ["Constantine", 1]];
  extra.forEach(([pers, n]) => {
    for (let i = 1; i <= n; i++) {
      volumes.push({
        id: "x-" + pers + "-" + i,
        titulo: pers + " Vol. " + i,
        personagem: pers,
        tipo: "Encadernado (TPB)",
        editora: pers === "Demolidor" ? "Marvel" : "DC Comics",
        ano: "2020",
        status: "nao_lida",
        notas: "",
        edicoesColetadasIds: [],
      });
    }
  });
  const colecoes = [{ id: "c1", nome: "Era Dixon", descricao: "Ordem de leitura", membros: ["v2", "v1"] }];
  return { volumes, colecoes, series, edicoes };
}

const docs = new Map();
if (scenario === "with-claude" || scenario === "seeded") {
  const edShards = new Map();
  if (scenario === "seeded") {
    const lib = seedLibrary();
    docs.set("library/volumes", { items: lib.volumes });
    docs.set("library/colecoes", { items: lib.colecoes });
    docs.set("library/series", { items: lib.series });
    // Written by the version that stored a bare hue. It must still resolve.
    docs.set("library/cores", { mapa: { batman: 300 } });
    lib.edicoes.forEach((e) => {
      if (!edShards.has(e.serieId)) edShards.set(e.serieId, []);
      edShards.get(e.serieId).push(e);
    });
  }
  const makeDoc = (path) => ({
    path,
    get: async () => ({
      id: path.split("/").pop(),
      exists: docs.has(path),
      data: () => docs.get(path),
      metadata: { fromCache: false, hasPendingWrites: false },
    }),
    set: async (body) => { docs.set(path, body); },
    delete: async () => { docs.delete(path); },
  });
  window.claude = {
    use: async (name) => {
      if (name === "db") {
        return {
          doc: makeDoc,
          collection: (cpath) => ({
            path: cpath,
            doc: (id) => makeDoc(cpath + "/" + id),
            get: async () => {
              const out = [];
              if (cpath === "edicoes") {
                edShards.forEach((items, sid) => {
                  out.push({ id: sid, exists: true, data: () => ({ items }), metadata: {} });
                });
              }
              return { docs: out, size: out.length, empty: !out.length, docChanges: () => [], metadata: {} };
            },
          }),
        };
      }
      if (name === "assets") {
        return { upload: async () => ({ id: "x".repeat(32), url: "/_blob/" + "x".repeat(32) }) };
      }
      return null;
    },
  };
}

try {
  window.eval(bundle);
} catch (e) {
  errors.push("EVAL THREW: " + (e.stack || e.message));
}

await new Promise((r) => setTimeout(r, 400));

const root = window.document.getElementById("root");

// v80: the three tabs stay mounted, the ones not in use hidden. Everything below
// asserts what is on screen, so queries skip anything inside a hidden tab, and
// "the page's HTML" is the page with the hidden tabs taken out.
// v126: the app under the hub cover is built but inert, so it counts as hidden too.
const naAbaEscondida = (el) => !!(el.closest && el.closest('.aba[data-ativa="false"], .app-base[inert]'));
const visiveis = (sel) => [...root.querySelectorAll(sel)].filter((el) => !naAbaEscondida(el));
const visivel = (sel) => visiveis(sel)[0] || null;
const htmlVisivel = () => {
  const copia = root.cloneNode(true);
  copia.querySelectorAll('.aba[data-ativa="false"], .app-base[inert]').forEach((el) => el.remove());
  return copia.innerHTML;
};
const html = htmlVisivel();

console.log("=== SCENARIO:", scenario, "===");
console.log("ERRORS:", errors.length);
errors.forEach((e) => console.log("  " + e.slice(0, 400)));
console.log("ROOT LENGTH:", html.length);

const huntText = [...visiveis(".prog .prog-row")].map((r) => r.textContent).join(" | ");

const checks = {
  "wordmark rendered": html.includes("LONG") && html.includes("BOX"),
  // v126: built under the hub cover, not shown over it.
  "tabbar rendered under the cover": root.innerHTML.includes("tabbar") && !html.includes("tabbar"),
  "no raw undefined": !html.includes(">undefined<"),
  "no NaN": !html.includes("NaN"),
  "no [object Object]": !html.includes("[object Object]"),
};
if (scenario === "seeded") {
  Object.assign(checks, {
    "hub is the landing view": html.includes("suggest-title"),
    "hub shows volume total": html.includes("hub-figures"),
    "hub shows a suggestion, not continuando": html.includes("Do seu acervo") && !html.includes("Lendo agora"),
    "suggestion can be rerolled": html.includes("Outro"),
    "hunt uses a continuous bar, not run blocks": html.includes("prog-bar") && !html.includes('class="run"'),
    // Scoped to the hunt section: these series names also legitimately appear in
    // the storage meter, which names the largest document.
    "hunt shows the series past the threshold": huntText.includes("Demolidor (Volume 2)"),
    "hunt excludes series below the threshold":
      !huntText.includes("Detective Comics") && !huntText.includes("Nightwing (Volume 2)"),
    "hunt counts issues remaining": html.includes("faltam ") || html.includes("falta 1"),
    // Counted as buttons labelled exactly "Outro" since v89: "Seu acervo" folds small
    // characters into an "Outros" row, which a plain text count mistook for a reroll.
    "hunt has no reroll button of its own":
      [...visiveis("button")].filter((b) => b.textContent.trim() === "Outro").length === 1,
    "degenerate most-complete stat gone": !html.includes("Mais completas") && !html.includes("mais completas"),
    "shelf wall rendered": html.includes('class="wall"'),
    "covers carry a character edge": html.includes("--edge"),
    "hub shows storage meter": html.includes("meter"),
    "brand mark rendered": html.includes('class="mark"'),
    "wordmark two-tone": html.includes("LONG<b>BOX</b>"),
    "no back chevron on hub": !html.includes("brand-chev"),
    "search hidden on hub": !html.includes('aria-label="Buscar na biblioteca"'),
    "export and import offered": html.includes("Exportar backup") && html.includes("Importar backup"),
    "hub enter row present": html.includes("hub-enter"),
    "minha colecao button on hub": html.includes("Minha coleção"),
    "novo is secondary on hub": html.includes("btn btn-quiet"),
  });
} else {
  checks["empty state rendered"] = html.includes("caixa está vazia") || html.includes("skel");
}
Object.entries(checks).forEach(([k, v]) => console.log((v ? "  PASS " : "  FAIL ") + k));

// Punctuation bans, checked against the rendered output and the bundle's string table.
const emDash = (html.match(/—/g) || []).length;
const enDash = (html.match(/–/g) || []).length;
console.log("EM-DASH in DOM:", emDash, " EN-DASH in DOM:", enDash);

if (scenario === "seeded") {
  const wallCards = [...visiveis(".wall .vol")];
  // The character comes from the cover's own footer, not from parsing titles:
  // titles like "Demolidor por Bendis" made the old parse invent a character.
  const perChar = new Map();
  // Only fallback covers carry a readable character footer. A volume with real
  // cover art shows the art instead, so it has nothing to contribute here and is
  // skipped rather than counted as an unknown character.
  wallCards.forEach((card) => {
    const foot = card.querySelector(".cover-fb-foot");
    if (!foot) return;
    const who = foot.textContent || "?";
    const edge = card.querySelector(".cover").style.getPropertyValue("--edge");
    if (!perChar.has(who)) perChar.set(who, new Set());
    perChar.get(who).add(edge);
  });
  const multi = [...perChar.entries()].filter(([, set]) => set.size > 1);

  console.log("\n--- shelf sampling ---");
  console.log("  capped at 84: " + (wallCards.length === 84 ? "PASS" : "FAIL (" + wallCards.length + ")"));
  console.log("  every character represented: " + (perChar.size === 4 ? "PASS (4)" : "FAIL (" + [...perChar.keys()].join(", ") + ")"));
  // Two characters sharing a hue is legitimate: a chosen colour may coincide with
  // another character's automatic one. One character with two hues would be a bug.
  console.log("  exactly one colour per character: " + (multi.length === 0 ? "PASS" : "FAIL (" + multi.map(([k]) => k).join(", ") + ")"));
  console.log("  wall cards carry no caption: " + (visivel(".wall .vol-title") ? "FAIL" : "PASS"));

  // The hub backdrop. It draws from the collection's own covers, so the check that
  // matters is that the tiles resolved to real blob URLs: the upstream component
  // only treated strings starting with http as images and would have printed the
  // "/_blob/..." path as text instead.
  console.log("\n--- hub backdrop ---");
  // The hub has the cover wall; the lattice belongs to the tabs. Both at once
  // would be two moving grounds arguing under the same column of text.
  console.log("  lattice stays off the hub: " +
    (!visivel(".cursor-grid") ? "PASS" : "FAIL"));
  const gm = visivel(".hub > .hub-topo > .gm");
  console.log("  backdrop mounted behind the hub: " + (gm ? "PASS" : "FAIL"));
  if (gm) {
    const rows = gm.querySelectorAll(".gm-row");
    const tiles = gm.querySelectorAll(".gm-item");
    const imgs = [...gm.querySelectorAll("img.gm-item-img")];
    const srcs = imgs.map((el) => el.getAttribute("src") || "");
    const want = rows.length * 13;
    console.log("  six rows by thirteen: " + (rows.length === 6 && tiles.length === 78 ? "PASS (78)" : "FAIL (" + rows.length + " rows, " + tiles.length + " tiles)"));
    console.log("  covers are img elements, not backgrounds: " +
      (imgs.length > 0 && !gm.querySelector(".gm-item-img[style*='background']") ? "PASS" : "FAIL"));
    console.log("  tiles point at real covers: " +
      (srcs.length > 0 && srcs.every((s) => s.startsWith("/_blob/")) ? "PASS" : "FAIL (" + srcs[0] + ")"));
    // The fixture photographs one of its five volumes, so exactly one tile carries
    // art and the rest stay on their own grey, each shaped like a comic.
    console.log("  one tile per cover, never twice: " +
      (new Set(srcs).size === srcs.length ? "PASS (" + srcs.length + ")" : "FAIL (" + srcs.length + " tiles, " + new Set(srcs).size + " covers)"));
    const vazios = [...tiles].filter((el) => el.getAttribute("data-empty") === "true");
    console.log("  the rest are left empty: " +
      (vazios.length === want - imgs.length ? "PASS (" + vazios.length + ")" : "FAIL (" + vazios.length + ")"));
    console.log("  hidden from assistive tech: " + (gm.getAttribute("aria-hidden") === "true" ? "PASS" : "FAIL"));
    const strays = [...gm.querySelectorAll(".gm-item-content")]
      .map((el) => el.textContent || "")
      .filter((x) => x.includes("/_blob/") || x.startsWith("http") || /^Item \d+$/.test(x));
    console.log("  no path or placeholder printed as text: " + (strays.length === 0 ? "PASS" : "FAIL (" + strays[0] + ")"));
  }
}

const srcText = fonteDoApp();
const srcEm = [...srcText.matchAll(/.{0,60}[—–].{0,60}/g)].map((m) => m[0]);
console.log("EM/EN-DASH in source:", srcEm.length);
srcEm.forEach((s) => console.log("   >>> " + s.replace(/\n/g, " ")));

const cssText = fs.readFileSync("src/styles.css", "utf8");
const cssEm = [...cssText.matchAll(/.{0,50}[—–].{0,50}/g)].map((m) => m[0]);
console.log("EM/EN-DASH in css:", cssEm.length);
cssEm.forEach((s) => console.log("   >>> " + s.replace(/\n/g, " ")));

// Exercise the other tabs and the detail sheets, which the initial render never touches.
if (scenario === "seeded") {
  const click = async (el, label) => {
    if (!el) { errors.push("MISSING ELEMENT: " + label); return; }
    el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 120));
  };
  console.log("\n--- scroll to enter ---");
  const wheel = (deltaY) => {
    const e = new window.Event("wheel", { bubbles: true });
    e.deltaY = deltaY;
    window.dispatchEvent(e);
  };
  const onHub = () => htmlVisivel().includes("suggest-title");

  // Remount the hub so the arming window is genuinely open. Measuring from page
  // load raced the 350ms timer and passed by luck rather than by behaviour.
  const minhaColecao = () => visiveis(".hub-capa button").find((b) => b.textContent.includes("Minha coleção"));
  await click(minhaColecao(), "into the collection");
  await click(visivel("button.brand"), "back to hub, fresh mount");

  // Before the arming delay elapses, a wheel burst must be ignored, so momentum
  // carried in from a previous screen cannot throw you straight back out.
  wheel(400);
  await new Promise((r) => setTimeout(r, 80));
  console.log("  ignored while arming: " + (onHub() ? "PASS" : "FAIL"));
  await new Promise((r) => setTimeout(r, 260));
  console.log("  still on hub after the burst settles: " + (onHub() ? "PASS" : "FAIL"));

  wheel(-300);
  await new Promise((r) => setTimeout(r, 60));
  console.log("  upward scroll does not enter: " + (onHub() ? "PASS" : "FAIL"));

  wheel(40);
  await new Promise((r) => setTimeout(r, 40));
  console.log("  small nudge below threshold: " + (onHub() ? "PASS" : "FAIL"));

  // The surface must actually track the gesture, not just wait for a threshold.
  // v126: the whole cover moves, and stays opaque: it is lifted, not faded.
  const hubEl = visivel(".hub-capa");
  const tf = hubEl ? hubEl.style.transform : "";
  const op = hubEl ? hubEl.style.opacity : "";
  console.log("  surface tracks the gesture: " + (tf === "translateY(-40px)" ? "PASS" : "FAIL (" + tf + ")") +
              ", stays opaque while travelling " + (op === "" ? "PASS" : "FAIL (" + op + ")"));

  wheel(80);
  await new Promise((r) => setTimeout(r, 340));
  const enteredHtml = htmlVisivel();
  console.log("  accumulated past threshold enters: " + (enteredHtml.includes("shelf") && !onHub() ? "PASS" : "FAIL"));

  await click(visivel("button.brand"), "brand back to hub");
  await new Promise((r) => setTimeout(r, 400));

  // v137: a wheel turned notch by notch, slower than 160ms apart, used to spring
  // the cover back between notches, so a slow wheel never unlocked (PC report).
  for (let i = 0; i < 3; i++) { wheel(60); await new Promise((r) => setTimeout(r, 260)); }
  await new Promise((r) => setTimeout(r, 500));
  console.log("  slow notches add up and enter: " + (!onHub() ? "PASS" : "FAIL"));
  await click(visivel("button.brand"), "back to hub for the long spin");
  await new Promise((r) => setTimeout(r, 400));

  // v137: one unbroken spin from above into the end never unlocked either, since
  // only a 250ms pause re-read "at the end". Arriving still must not throw the
  // cover; pushing on against the end for a while must.
  const capa = visivel(".hub-capa");
  let rolado = 0;
  Object.defineProperty(capa, "scrollHeight", { configurable: true, get: () => 2000 });
  Object.defineProperty(capa, "clientHeight", { configurable: true, get: () => 1000 });
  Object.defineProperty(capa, "scrollTop", { configurable: true, get: () => rolado, set: (v) => { rolado = v; } });
  for (let i = 0; i < 4; i++) { wheel(50); await new Promise((r) => setTimeout(r, 80)); }
  rolado = 1000; // reached the end mid-spin
  for (let i = 0; i < 3; i++) { wheel(50); await new Promise((r) => setTimeout(r, 80)); }
  console.log("  arriving at the end mid-spin does not lift: " + (onHub() && !capa.style.transform ? "PASS" : "FAIL (" + capa.style.transform + ")"));
  for (let i = 0; i < 12 && onHub(); i++) { wheel(50); await new Promise((r) => setTimeout(r, 80)); }
  await new Promise((r) => setTimeout(r, 500));
  console.log("  spinning on against the end enters: " + (!onHub() ? "PASS" : "FAIL"));
  await click(visivel("button.brand"), "back to hub");
  await new Promise((r) => setTimeout(r, 400));

  console.log("\n--- tab walk ---");

  await click(minhaColecao(), "lift the cover");
  const tabButtons = [...visiveis(".tabbar button")];
  await click(tabButtons[0], "tab volumes");
  let h = htmlVisivel();

  // The band's tabs answer to the pointer like every other control around them.
  // JSDOM cannot hover, so what is checked here is that the rules have something
  // to hang on: the press class, a hover rule that is not the active pill, and
  // that the rule sits behind the pointer gate so a tap does not stick.
  // The lattice is the tab content's ground. It belongs to the tabs, never to the
  // hub, which has the cover wall instead.
  const cssSrcTop = fs.readFileSync("src/styles.css", "utf8");
  const malha = visivel(".content .cursor-grid");
  const area = visivel(".content");
  console.log("  tab lattice: mounted " + (malha ? "PASS" : "FAIL") +
              ", area flagged " + (area && area.getAttribute("data-lattice") === "true" ? "PASS" : "FAIL") +
              ", carries a canvas " + (malha && malha.querySelector("canvas.cursor-grid__canvas") ? "PASS" : "FAIL"));
  // The colour the canvas burns cannot come from a CSS variable, so it is written
  // twice; this is what catches the two drifting apart.
  const accentDecl = cssSrcTop.split("--accent:")[1];
  const accentTok = accentDecl ? accentDecl.split(";")[0].trim() : "";
  const appSrcTop = fonteDoApp();
  const hexDecl = appSrcTop.split("ACCENT_HEX = ")[1];
  const hexTok = hexDecl ? hexDecl.split(";")[0].trim().replace(/"/g, "") : "";
  console.log("  lattice accent matches the token: " +
    (accentTok && accentTok.toLowerCase() === hexTok.toLowerCase() ? "PASS (" + hexTok + ")" : "FAIL (" + hexTok + " vs " + accentTok + ")"));

  const segBtns = [...visiveis(".ed-segmented button")];
  const cssSrc = cssSrcTop;
  // Hover moved off the button and onto .seg-ghost, a pill that slides between
  // the tabs, so what used to be one background rule is now two halves: the
  // travelling pill, and the label brightening to meet it. Both are still
  // required, and the label half still has to sit behind the pointer gate.
  const hoverAt = cssSrc.indexOf(".segmented button:hover");
  const gateAt = cssSrc.lastIndexOf("@media (hover: hover) and (pointer: fine) {", hoverAt);
  let gateDepth = 0;
  for (let i = gateAt; i > -1 && i < hoverAt; i++) {
    if (cssSrc[i] === "{") gateDepth++;
    else if (cssSrc[i] === "}") gateDepth--;
  }
  // The header and the strip borrow the publisher's hue. The fixture has no
  // publishers, so what is proven here is the quiet half: no publisher, no shift.
  const hdr = visivel(".topbar");
  const bandEl = visivel(".ed-band");
  // The character band was the page colour and so was invisible until the lattice
  // went behind it. It has to stay opaque, being sticky, so the tint is mixed in.
  const heads = [...visiveis(".group-head")];
  const tinted = heads.filter((el) => (el.getAttribute("style") || "").includes("--grp-cor"));
  console.log("  character band: headings tinted " +
    (heads.length > 0 && tinted.length === heads.length ? "PASS (" + heads.length + ")" : "FAIL (" + tinted.length + " of " + heads.length + ")") +
    ", mixed not alpha " + (cssSrcTop.includes("color-mix(in srgb, var(--grp-cor, var(--bg)) 8%, var(--bg))") ? "PASS" : "FAIL") +
    ", rounded and bled " + (fs.readFileSync("src/styles.css","utf8").includes("margin-inline: -12px;") ? "PASS" : "FAIL") + ", stays opaque " + (!cssSrcTop.includes("var(--grp-cor) 15%, transparent") ? "PASS" : "FAIL"));

  // The ink on the primary button is chosen by measured contrast, because at one
  // HSL lightness a yellow and a blue are nowhere near the same brightness. Run
  // the real picker rather than trusting it: blue must take white, yellow dark.
  const srcInk = appSrcTop.slice(appSrcTop.indexOf("const INK_ESCURA"), appSrcTop.indexOf("function swatchColors"));
  const tintaSobre = new Function(srcInk.replace(/^export /gm, "") + "; return tintaSobre;")();
  const azul = tintaSobre(240, 100, 42);
  const amarelo = tintaSobre(60, 100, 42);
  const seuAzul = tintaSobre(211.3, 100, 42);
  // A layer bled to a bare 100vw overhangs the visible area by the scrollbar and
  // puts a horizontal scrollbar under the whole page.
  const bleeds = cssSrcTop.split("width: 100vw;").length - 1;
  const corrigidos = cssSrcTop.split("width: calc(100vw - var(--sbw, 0px));").length - 1;
  // .app keeps room under the content for the mobile tab bar, and the lattice has
  // to reach into the same room or it leaves a bare strip at the very bottom. The
  // room is a token so both read one number; this is what stops it being inlined
  // back into .app, where the lattice could not see it.
  const temToken = cssSrcTop.includes("--app-pad-b: calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px));");
  const appUsaToken = /\.app \{[^}]*padding-bottom: var\(--app-pad-b\);/.test(cssSrcTop);
  // v79: the sideways-overflow guard on .app must stay clip, never hidden,
  // which would make .app a scroll container and unstick the header and band.
  console.log("  app clips sideways overflow without breaking sticky: " +
    (/\.app \{[^}]*overflow-x: clip;/.test(cssSrcTop) && !/\.app \{[^}]*overflow-x: hidden/.test(cssSrcTop) ? "PASS" : "FAIL"));
  // v79: the sheet search has no .search-field, so the magnifier rule must
  // cover a direct child of .search too.
  console.log("  magnifier rule reaches the sheet search: " +
    (cssSrcTop.includes(".search > svg") && !cssSrcTop.includes(".search svg {") ? "PASS" : "FAIL"));
  // The lattice used to stretch to the end of the content and reach into this
  // reserved strip with a negative bottom. Since v47 it is fixed to the window
  // instead, because sizing it to the page made its canvas 25.9 megapixels on
  // the séries tab and cost 122ms a frame. Fixed with bottom: 0 reaches the
  // window's own edge, so the strip is still covered, by a cheaper route.
  const malhaUsaToken = cssSrcTop.includes(".cursor-grid {") &&
    /\.cursor-grid \{[^}]*position: fixed;[^}]*bottom: 0;/.test(cssSrcTop);
  const desktop = cssSrcTop.includes("--app-pad-b: 48px;");
  console.log("  mobile tab bar room: kept " + (temToken && desktop ? "PASS" : "FAIL") +
    ", app reads it " + (appUsaToken ? "PASS" : "FAIL") +
    ", lattice reaches it " + (malhaUsaToken ? "PASS" : "FAIL"));

  console.log("  bled layers subtract the scrollbar: " +
    (bleeds === 0 && corrigidos === 2 ? "PASS (" + corrigidos + ")" : "FAIL (" + bleeds + " bare, " + corrigidos + " fixed)") +
    ", width published from js " + (appSrcTop.includes("--sbw") ? "PASS" : "FAIL"));

  console.log("  accent ink follows the fill: blue takes white " + (azul === "#FFFFFF" ? "PASS" : "FAIL (" + azul + ")") +
    ", yellow takes dark " + (amarelo === "#04191E" ? "PASS" : "FAIL (" + amarelo + ")") +
    ", the collection blue takes white " + (seuAzul === "#FFFFFF" ? "PASS" : "FAIL (" + seuAzul + ")"));

  console.log("  chrome hue: absent without a publisher " +
    (hdr && !hdr.getAttribute("data-ed-hue") && bandEl && !bandEl.getAttribute("data-ed-hue") ? "PASS" : "FAIL") +
    ", composed per theme " +
    (cssSrcTop.includes("[data-ed-hue] {") &&
     cssSrcTop.split("[data-ed-hue] {").length === 3 ? "PASS" : "FAIL") +
    ", hue only, never a literal colour " +
    (cssSrcTop.includes("hsl(var(--ed-hue)") ? "PASS" : "FAIL"));

  console.log("  band tabs: three " + (segBtns.length === 3 ? "PASS" : "FAIL (" + segBtns.length + ")") +
              ", press feedback " + (segBtns.every((b) => b.classList.contains("press")) ? "PASS" : "FAIL") +
              ", hover rule " + (hoverAt > -1 ? "PASS" : "FAIL") +
              ", gated to pointers " + (gateAt > -1 && gateDepth === 1 ? "PASS" : "FAIL") +
              ", hover pill exists " + (cssSrc.includes(".seg-ghost {") ? "PASS" : "FAIL") +
              ", hover pill is not the active pill " +
                (segBtns.length === 3 && visivel(".seg-ghost") &&
                 visivel(".seg-thumb") &&
                 visivel(".seg-ghost") !== visivel(".seg-thumb") ? "PASS" : "FAIL") +
              ", no second hover background on the button " +
                (cssSrc.includes(".segmented button:not([data-active=\"true\"]):hover") ? "FAIL" : "PASS") +
              ", transform transitions " +
                (cssSrc.includes("transform 120ms var(--ease-out);") ? "PASS" : "FAIL"));
  // v86: the hub backdrop must take blob: thumbnails as images, not text.
  {
    const gm = fs.readFileSync(new URL("../src/components/GridMotion/GridMotion.jsx", import.meta.url), "utf8");
    console.log("  hub backdrop treats blob: URLs as images: " + (gm.includes("content.startsWith(\"blob:\")") ? "PASS" : "FAIL"));
  }
  // v82: the active pill moves by transform. A clip-path written each frame
  // repainted the page every frame of the switch, the séries-tab stutter.
  {
    const pilula = visivel(".seg-thumb");
    // v83: a window clipping a body, both only translated; never scaled, since
    // v82's scaled 1px middle smeared on a real GPU.
    const partes = pilula ? [pilula.querySelector(".pil-janela"), pilula.querySelector(".pil-corpo")] : [];
    console.log("  active pill slides two layers, no clip-path, no scale: " +
      (partes.length === 2 && partes.every(Boolean) && !pilula.style.clipPath &&
       partes.every((p) => p.style.transform.includes("translate3d") && !p.style.transform.includes("scale")) ? "PASS" : "FAIL"));
  }
  // A tinted band paints its selected tab in the publisher's colour, so the hover
  // wash there has to follow the same hue instead of the neutral one.
  const tintAt = cssSrc.indexOf(".ed-band[data-tinted=\"true\"] .seg-ghost");
  console.log("  tinted band hover follows the publisher: " +
    (tintAt > -1 && cssSrc.slice(tintAt, tintAt + 200).includes("var(--ed-cor)") ? "PASS" : "FAIL"));
  console.log("  volumes tab: shelf " + (h.includes("shelf") ? "PASS" : "FAIL") +
              ", grouped " + (h.includes("Nightwing") && h.includes("Batman") ? "PASS" : "FAIL") +
              ", fallback cover " + (h.includes("cover-fb-title") ? "PASS" : "FAIL") +
              ", status bars " + (h.includes('data-s="lida"') && h.includes('data-s="lendo"') ? "PASS" : "FAIL") +
              ", none on nao_lida " + (!h.includes('data-s="nao_lida"') ? "PASS" : "FAIL"));
  // A real cover is an <img>, and browsers make images natively draggable by
  // default, which fights a press-and-hold reorder: the OS/browser's own image
  // drag would hijack the gesture before the app's pointer handlers ever see it.
  console.log("  real cover image is not natively draggable: " +
              (h.includes('draggable="false"') ? "PASS" : "FAIL"));
  console.log("  header in tab: back chevron " + (h.includes("brand-chev") ? "PASS" : "FAIL") +
              ", search shown " + (h.includes('aria-label="Buscar na biblioteca"') ? "PASS" : "FAIL"));

  await click(tabButtons[2], "tab series");
  h = htmlVisivel();
  // The tab opens with every character folded away, so the rows genuinely are
  // not in the DOM yet. Assert that first, then unfold, or every assertion
  // below would be checking the empty state without saying so.
  console.log("  series tab starts folded: headers " + (h.includes("group-head") ? "PASS" : "FAIL") +
              ", no rows yet " + (h.includes("serie-row") ? "FAIL" : "PASS") +
              ", fold-all offered " + (h.includes("fold-all") ? "PASS" : "FAIL"));

  await click(visivel(".fold-all button"), "unfold every character");
  h = htmlVisivel();
  console.log("  series tab: run bar " + (h.includes('class="run"') ? "PASS" : "FAIL") +
              ", rows " + (h.includes("serie-row") ? "PASS" : "FAIL") +
              ", owned segments " + (h.includes('data-owned="true"') ? "PASS" : "FAIL"));

  await click(visivel(".group-toggle"), "fold one character back");
  console.log("  folding one character hides its rows: " +
              (visiveis(".serie-row").length < visiveis(".group-head").length
                ? "PASS" : "FAIL"));
  await click(visivel(".group-toggle"), "unfold it again");
  h = htmlVisivel();

  await click(visivel(".serie-row"), "first serie row");
  h = htmlVisivel();
  console.log("  serie sheet: open " + (h.includes('class="sheet"') ? "PASS" : "FAIL") +
              ", buckets " + (h.includes("bucket") ? "PASS (long run bucketed)" : "no buckets") +
              ", tiles " + (h.includes('class="tile"') ? "PASS" : "FAIL"));
  // v81: rows are memoised, so check one still redraws when its own prop moves.
  console.log("  memoised row marks the open série: " +
              (visiveis('.serie-row[data-open="true"]').length === 1 ? "PASS" : "FAIL"));

  // Inspecting an issue deep in a 400-issue run must not push the panel off screen.
  const tiles = [...visiveis(".sheet .tile")];
  await click(tiles[250], "tile deep in the run");
  h = htmlVisivel();
  const panel = visivel(".edicao-pinned");
  console.log("  issue panel: opens " + (panel ? "PASS" : "FAIL") +
              ", pinned to sheet foot " + (panel && panel.className.includes("edicao-pinned") ? "PASS" : "FAIL") +
              ", tile count " + tiles.length);

  await click(tiles[251], "next tile updates in place");
  const panel2 = visivel(".edicao-pinned");
  console.log("  panel updates in place: " + (panel2 && visiveis(".edicao-pinned").length === 1 ? "PASS" : "FAIL"));

  await click(visivel('.sheet [aria-label="Fechar"]'), "close serie sheet");

  await click(tabButtons[1], "tab colecoes");
  h = htmlVisivel();
  console.log("  colecoes tab: strip " + (h.includes("coll-strip") ? "PASS" : "FAIL") +
              ", order numbers " + (h.includes("slot-order") ? "PASS" : "FAIL"));
  // v60: every strip carries its own spine bar, and the native bar stays hidden.
  // Where the old styled bar never showed: scrollbar-width on the same rule made
  // Chrome skip the ::-webkit-scrollbar ones, so the thin setting must not return.
  {
    const strips = visiveis(".coll-strip");
    const bars = visiveis(".shelf-bar");
    const track = visivel(".shelf-track");
    const css = fs.readFileSync(new URL("../dist/styles.css", import.meta.url), "utf8");
    const rule = (css.match(/\.coll-strip \{[^}]*\}/) || [""])[0];
    console.log("  colecoes spine bar: one per strip " + (strips.length > 0 && bars.length === strips.length ? "PASS" : "FAIL") +
                ", track is a scrollbar " + (track && track.getAttribute("role") === "scrollbar" && track.tabIndex === 0 ? "PASS" : "FAIL") +
                ", lit window present " + (track && track.querySelector(".shelf-window .shelf-spines") ? "PASS" : "FAIL") +
                ", native bar hidden " + (rule.includes("scrollbar-width: none") && !rule.includes("thin") ? "PASS" : "FAIL"));
  }

  await click(tabButtons[0], "tab volumes");
  h = htmlVisivel();
  // Opposite default from the séries tab: HQs opens fully unfolded on a first
  // visit (no sessionStorage yet), so the shelf itself must already be in the
  // DOM here, not hidden behind a fold.
  console.log("  HQs tab starts unfolded: headers " + (h.includes("group-head") ? "PASS" : "FAIL") +
              ", shelf already shown " + (h.includes('class="shelf stagger"') ? "PASS" : "FAIL") +
              ", fold-all offered " + (h.includes("fold-all") ? "PASS" : "FAIL"));

  // v80: leaving a tab and coming back finds the very same cards, hidden while
  // away, not a copy rebuilt from scratch with every cover loading again.
  {
    const cartao = visivel(".shelf .vol");
    await click(tabButtons[2], "away to series");
    const escondido = !!cartao && cartao.isConnected && naAbaEscondida(cartao);
    // React 18 drops inert={true} silently; it has to be the empty string.
    const inerte = !!cartao && cartao.closest(".aba").getAttribute("inert") === "";
    await click(tabButtons[0], "back to HQs");
    console.log("  tabs stay mounted: hidden while away " + (escondido ? "PASS" : "FAIL") +
                ", same card on return " + (cartao && visivel(".shelf .vol") === cartao ? "PASS" : "FAIL") +
                ", inert while away " + (inerte ? "PASS" : "FAIL") +
                ", one tab on screen " + (root.querySelectorAll('.aba[data-ativa="true"]').length === 1 ? "PASS" : "FAIL"));
  }
  h = htmlVisivel();

  const shelvesAbertas = visiveis(".shelf").length;
  await click(visivel(".group-toggle"), "fold one HQs character");
  console.log("  folding one HQs character hides its shelf: " +
              (visiveis(".shelf").length < shelvesAbertas ? "PASS" : "FAIL"));
  // Not every group is open now (one was just folded), so the smart toggle's
  // first click opens the rest to match — same "open unless everything
  // already is" logic as the séries tab's own fold-all button.
  await click(visivel(".fold-all button"), "reopen every HQs character");
  h = htmlVisivel();
  console.log("  HQs fold-all reopens what was folded: " +
              (visiveis(".shelf").length === shelvesAbertas ? "PASS" : "FAIL"));
  await click(visivel(".fold-all button"), "hide every HQs character");
  h = htmlVisivel();
  console.log("  HQs fold-all hides every shelf: " + (h.includes('class="shelf stagger"') ? "FAIL" : "PASS"));
  await click(visivel(".fold-all button"), "show every HQs character again");
  h = htmlVisivel();
  console.log("  HQs fold-all restores every shelf: " + (h.includes('class="shelf stagger"') ? "PASS" : "FAIL"));

  const volCards = [...visiveis(".shelf .vol")];
  const linked = volCards.find((c) => (c.textContent || "").includes("Morcegos Ferozes"));
  await click(linked || volCards[0], "volume that collects issues");
  h = htmlVisivel();
  console.log("  volume sheet: open " + (h.includes('class="sheet"') ? "PASS" : "FAIL") +
              ", deflist " + (h.includes("deflist") ? "PASS" : "FAIL") +
              ", status control " + (h.includes("seg3") ? "PASS" : "FAIL") +
              ", linked issues " + (h.includes("linked-serie") ? "PASS" : "FAIL"));

  await click(visivel('.sheet [aria-label="Fechar"]'), "close volume sheet");

  // Character colour: the group heading is the control, and the choice has to
  // reach both the covers and the store.
  const groupBtn = visivel(".group-cor");
  const edgeBefore = visivel(".shelf .cover").style.getPropertyValue("--edge");
  console.log("  legacy bare-hue value still resolves: " +
              (edgeBefore.includes("hsl(300") ? "PASS" : "FAIL (" + edgeBefore + ")") +
              ", heading marked as custom " +
              (groupBtn.querySelector('[data-custom="true"]') ? "PASS" : "FAIL"));
  await click(groupBtn, "character heading");
  const groups = [...visiveis(".swatches")];
  const swatches = [...visiveis(".swatch")];
  const chromatic = groups[0] ? groups[0].querySelectorAll(".swatch").length : 0;
  const neutral = groups[1] ? groups[1].querySelectorAll(".swatch").length : 0;
  console.log("  colour picker: opens from the heading " + (swatches.length ? "PASS" : "FAIL") +
              ", 30 chromatic " + (chromatic === 30 ? "PASS" : "FAIL (" + chromatic + ")") +
              ", 4 neutral (Longbox cyan included) " + (neutral === 4 ? "PASS" : "FAIL (" + neutral + ")"));

  // The chromatic group must read as one gradation, so hues have to ascend.
  const hues = [...groups[0].querySelectorAll(".swatch")].map((s) => {
    const m = s.style.getPropertyValue("--edge").match(/hsl\((\d+)/);
    return m ? parseInt(m[1], 10) : -1;
  });
  const ascending = hues.every((v, i) => i === 0 || v >= hues[i - 1]);
  console.log("  chromatic swatches ascend by hue: " + (ascending ? "PASS" : "FAIL"));

  // A light swatch must not print its title in white on a light ground.
  const lightSwatch = groups[1].querySelectorAll(".swatch")[2];
  const lightInk = lightSwatch ? lightSwatch.style.color : "";
  console.log("  white uses dark ink: " + (lightInk.includes("14") ? "PASS" : "FAIL (" + lightInk + ")"));

  await click(swatches[3], "pick a colour");
  await new Promise((r) => setTimeout(r, 700));
  const edgeAfter = visivel(".shelf .cover").style.getPropertyValue("--edge");
  const coresDoc = docs.get("library/cores");
  console.log("  applying it: cover edge changed " + (edgeBefore !== edgeAfter ? "PASS" : "FAIL (" + edgeAfter + ")") +
              ", saved to library/cores " + (coresDoc && Object.keys(coresDoc.mapa || {}).length ? "PASS" : "FAIL") +
              ", sheet closed " + (!visivel(".swatches") ? "PASS" : "FAIL"));

  // Cataloguing speed-ups: paste a cover, duplicate a volume, wider search.
  console.log("\n--- cataloguing ---");
  await click(tabButtons[0], "tab volumes");
  const cardParaColar = [...visiveis(".shelf .vol")]
    .find((c) => (c.textContent || "").includes("Morcegos Ferozes"));
  await click(cardParaColar, "open a volume");

  const pasteEvent = new window.Event("paste", { bubbles: true });
  const fakeImage = new window.File(["fake-bytes"], "capa.png", { type: "image/png" });
  pasteEvent.clipboardData = {
    items: [{ kind: "file", type: "image/png", getAsFile: () => fakeImage }],
  };
  window.dispatchEvent(pasteEvent);
  await new Promise((r) => setTimeout(r, 800));
  const volsAgora = (docs.get("library/volumes") || {}).items || [];
  const colado = volsAgora.find((v) => v.id === "v2");
  console.log("  pasting an image sets the cover: " + (colado && colado.capaAssetId ? "PASS" : "FAIL"));
  console.log("  the sheet advertises the shortcut: " + (htmlVisivel().includes("Ctrl+V") ? "PASS" : "FAIL"));

  await click(visivel('.sheet [aria-label="Duplicar este volume"]'), "duplicate");
  await new Promise((r) => setTimeout(r, 150));
  const form = visivel(".modal");
  const campos = form ? [...form.querySelectorAll("input")].map((i) => i.value) : [];
  console.log("  duplicate prefills the form: " +
              (campos.includes("Nightwing: Morcegos Ferozes") && campos.includes("Nightwing") ? "PASS" : "FAIL (" + campos.join(" | ") + ")"));
  await click(visivel('.modal [aria-label="Fechar"]'), "close form");
  await click(visivel('.sheet [aria-label="Fechar"]'), "close sheet");

  // Publishers: discovered from data, filtering the tabs, bypassed by search.
  await click(tabButtons[0], "tab volumes");
  const bar = visivel(".ed-bar");
  const sel = visivel("#filtro-editora");
  const edRows = () => [...visiveis("#filtro-editora-lista [role=option]")];
  const edTexto = (o) => o.querySelector(".sug-title").textContent;
  const escolherEditora = async (nome) => {
    sel.click();
    await new Promise((r) => setTimeout(r, 100));
    const alvo = edRows().find((o) => edTexto(o) === nome);
    if (alvo) alvo.click();
    await new Promise((r) => setTimeout(r, 150));
  };
  let opts = [];
  if (sel) {
    sel.click();
    await new Promise((r) => setTimeout(r, 100));
    opts = edRows().map(edTexto);
    console.log("  publisher list is the app's own, not a native select: " +
                (sel.tagName === "BUTTON" && !visivel(".ed-bar select") && visivel("#filtro-editora-lista.pfiltro-lista") ? "PASS" : "FAIL"));
    console.log("  manage is a separate action at the end: " +
                (visivel("#filtro-editora-lista .pfiltro-sep") && edTexto(edRows().at(-1)) === "Gerenciar editoras..." ? "PASS" : "FAIL"));
    sel.click();
    await new Promise((r) => setTimeout(r, 100));
    console.log("  list closes again: " + (!visivel("#filtro-editora-lista") ? "PASS" : "FAIL"));
  }
  console.log("\n--- publishers ---");
  console.log("  strip present in the collection view: " + (bar ? "PASS" : "FAIL"));
  console.log("  discovered from existing data: " +
              (opts.includes("DC Comics") && opts.includes("Marvel") ? "PASS" : "FAIL (" + opts.join(", ") + ")"));
  console.log("  offers all and none: " +
              (opts.includes("Todas as editoras") && opts.includes("Sem editora") ? "PASS" : "FAIL"));

  const countCards = () => visiveis(".shelf .vol").length;
  const todos = countCards();

  const marvelOpt = opts.includes("Marvel") ? "Marvel" : null;
  await escolherEditora("Marvel");
  await new Promise((r) => setTimeout(r, 150));
  const soMarvel = countCards();
  const marvelChars = new Set([...visiveis(".group .group-head h2")].map((n) => n.textContent));
  console.log("  selecting one narrows the shelf: " +
              (soMarvel > 0 && soMarvel < todos ? "PASS (" + todos + " to " + soMarvel + ")" : "FAIL (" + todos + " to " + soMarvel + ")"));
  console.log("  and only that publisher's characters remain: " +
              (marvelChars.size === 1 && marvelChars.has("Demolidor") ? "PASS" : "FAIL (" + [...marvelChars].join(", ") + ")"));

  // React tracks a controlled input's value through its own setter, so assigning
  // .value directly and firing the event leaves state untouched. Go through the
  // native setter instead, or the test silently measures nothing.
  const type = async (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 150));
  };

  const search = visivel('input[aria-label="Buscar na biblioteca"]');
  await type(search, "Batman");
  const buscaChars = new Set([...visiveis(".shelf .cover-fb-foot")].map((n) => n.textContent));
  console.log("  search ignores the filter: " +
              (buscaChars.has("Batman") ? "PASS" : "FAIL (" + [...buscaChars].join(", ") + ")") +
              ", and says so " + (htmlVisivel().includes("todo o acervo") ? "PASS" : "FAIL"));

  // Searching a series name must find the volume that collects it, even though
  // that name appears nowhere in the volume's own fields.
  // Read titles from the card caption, not the fallback cover: a volume with an
  // uploaded cover has no fallback, and an earlier step in this walk pastes one.
  const titulos = () => [...visiveis(".shelf .vol-title")].map((n) => n.textContent);

  await type(search, "Detective");
  const porSerie = titulos();
  console.log("  search reaches the series a volume collects: " +
              (porSerie.some((t) => t.includes("Batman: Ano Um")) ? "PASS" : "FAIL (" + porSerie.join(", ") + ")"));

  await type(search, "Releitura");
  const porNota = titulos();
  console.log("  search reaches notes: " +
              (porNota.length === 1 && porNota[0].includes("Morcegos") ? "PASS" : "FAIL (" + porNota.join(", ") + ")"));

  await type(search, "");
  console.log("  clearing search restores the filter: " + (countCards() === soMarvel ? "PASS" : "FAIL (" + countCards() + " vs " + soMarvel + ")"));

  await escolherEditora("Sem editora");
  await new Promise((r) => setTimeout(r, 150));
  const semChars = [...visiveis(".shelf .cover-fb-title")].map((n) => n.textContent);
  console.log("  items with no publisher are reachable: " +
              (semChars.some((t) => t.includes("sem editora")) ? "PASS" : "FAIL (" + semChars.join(", ") + ")"));

  // --- search suggestions ---
  console.log("\n--- search suggestions ---");

  await escolherEditora("Todas as editoras");
  await new Promise((r) => setTimeout(r, 150));

  const sugTitulos = () => [...visiveis(".sug-row .sug-title")].map((n) => n.textContent);
  const key = async (el, k) => {
    el.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true }));
    await new Promise((r) => setTimeout(r, 150));
  };

  await type(search, "");
  console.log("  closed while the field is empty: " + (!visivel(".sug") ? "PASS" : "FAIL"));

  await type(search, "Bat");
  const sBat = sugTitulos();
  console.log("  opens on typing: " + (visivel(".sug") ? "PASS" : "FAIL") +
              ", rows " + (sBat.length > 0 ? "PASS (" + sBat.length + ")" : "FAIL"));
  console.log("  capped at 8: " + (sBat.length <= 8 ? "PASS" : "FAIL (" + sBat.length + ")"));
  console.log("  a title match outranks a notes match: " +
              (sBat[0] && sBat[0].toLowerCase().includes("bat") ? "PASS" : "FAIL (" + sBat[0] + ")"));
  console.log("  rows carry a cover: " +
              (visivel(".sug-row .sug-cover") ? "PASS" : "FAIL"));

  // The whole point of the feature: the publisher you are browsing must not hide
  // a volume you are looking for.
  if (marvelOpt) {
    await escolherEditora("Marvel");
    await new Promise((r) => setTimeout(r, 150));
    await type(search, "Bat");
    const sFiltrado = sugTitulos();
    console.log("  ignores the publisher filter: " +
                (sFiltrado.length === sBat.length ? "PASS" : "FAIL (" + sFiltrado.length + " vs " + sBat.length + ")"));
    await escolherEditora("Todas as editoras");
    await new Promise((r) => setTimeout(r, 150));
    await type(search, "Bat");
  }

  await key(search, "ArrowDown");
  const marcada = visivel('.sug-row[data-on="true"]');
  const ordem = [...visiveis(".sug-row")].indexOf(marcada);
  console.log("  arrow down moves the highlight: " + (ordem === 1 ? "PASS" : "FAIL (" + ordem + ")"));

  await key(search, "ArrowUp");
  const voltou = [...visiveis(".sug-row")].indexOf(visivel('.sug-row[data-on="true"]'));
  console.log("  arrow up moves it back: " + (voltou === 0 ? "PASS" : "FAIL (" + voltou + ")"));

  const alvo = sugTitulos()[0];
  await key(search, "Enter");
  console.log("  enter opens the highlighted volume: " +
              (htmlVisivel().includes(alvo.slice(0, 12)) ? "PASS" : "FAIL (" + alvo + ")") +
              ", list closed " + (!visivel(".sug") ? "PASS" : "FAIL"));

  await type(search, "zzzqqq");
  console.log("  says so when nothing matches: " +
              (visivel(".sug-empty") ? "PASS" : "FAIL"));

  // v77: volumes stored as "Encadernado (TPB)" load as "Trade Paperback".
  await type(search, "");
  const legendas = [...visiveis(".vol-meta")].map((n) => n.textContent).join(" | ");
  console.log("  old format names migrated on load (TPB, Capa Dura): " +
              (legendas.includes("Trade Paperback") && !htmlVisivel().includes("Encadernado (TPB)") &&
               legendas.includes("Hardcover") && !legendas.includes("Capa Dura") ? "PASS" : "FAIL"));
  await type(search, "zzzqqq");
  await key(search, "Escape");
  console.log("  escape closes it: " + (!visivel(".sug") ? "PASS" : "FAIL"));

  // v73: outside HQs, the tab's four best come first, then four HQs; with no
  // match in the tab, only four HQs.
  const irAba = async (rot) => {
    const b = [...visiveis(".ed-segmented button")].find((x) => x.textContent.includes(rot));
    await click(b, "tab " + rot);
  };
  const secoes = () => [...visiveis(".sug-secao")].map((n) => n.textContent);
  const tipos = () => [...visiveis(".sug-row")].map((n) => (n.querySelector(".sug-icone") ? "aba" : "hq"));

  await type(search, "Night");
  const naHqs = tipos();
  console.log("  HQs tab: only HQs, no headings: " +
              (naHqs.length > 0 && naHqs.every((t) => t === "hq") && secoes().length === 0 ? "PASS" : "FAIL (" + naHqs.join(",") + ")"));

  await type(search, "");
  await irAba("Séries");
  await type(search, "Night");
  const naSeries = tipos();
  const primeiroHq = naSeries.indexOf("hq");
  console.log("  Séries tab: série first, then HQs: " +
              (naSeries[0] === "aba" && primeiroHq > 0 && naSeries.slice(primeiroHq).every((t) => t === "hq") ? "PASS" : "FAIL (" + naSeries.join(",") + ")") +
              ", headings " + (secoes().join("|") === "Séries|HQs" ? "PASS" : "FAIL (" + secoes().join("|") + ")") +
              ", at most 4 each " + (primeiroHq <= 4 && naSeries.length - primeiroHq <= 4 ? "PASS" : "FAIL"));
  console.log("  série row names the série: " +
              (sugTitulos()[0] === "Nightwing (Volume 2)" ? "PASS" : "FAIL (" + sugTitulos()[0] + ")"));
  await key(search, "Enter");
  console.log("  enter on a série opens it: " +
              ([...visiveis(".sheet")].some((s) => s.textContent.includes("Nightwing (Volume 2)")) ? "PASS" : "FAIL") +
              ", stays on Séries " + ((visivel('.ed-segmented button[data-active="true"]')?.textContent || "").includes("Séries") ? "PASS" : "FAIL"));

  await type(search, "");
  await irAba("Coleções");
  await type(search, "Dixon");
  console.log("  Coleções tab: the collection is listed: " +
              (tipos()[0] === "aba" && sugTitulos()[0] === "Era Dixon" ? "PASS" : "FAIL (" + sugTitulos().join(",") + ")"));
  await type(search, "Night");
  const semNaAba = tipos();
  console.log("  no match in the tab: only 4 HQs: " +
              (semNaAba.length > 0 && semNaAba.length <= 4 && semNaAba.every((t) => t === "hq") ? "PASS" : "FAIL (" + semNaAba.join(",") + ")"));
  await key(search, "Escape");

  await type(search, "");

  await click(visivel('button.brand'), "brand back to hub");
  h = htmlVisivel();
  console.log("  strip absent on the hub: " + (!visivel(".ed-bar") ? "PASS" : "FAIL"));
  console.log("  brand returns to hub: " + (h.includes("suggest-title") ? "PASS" : "FAIL") +
              ", chevron gone " + (!h.includes("brand-chev") ? "PASS" : "FAIL"));

  console.log("\nERRORS AFTER INTERACTION:", errors.length);
  errors.forEach((e) => console.log("  " + e.slice(0, 400)));
}



// The hub backdrop runs a gsap ticker, and gsap drives it off requestAnimationFrame.
// JSDOM's rAF is a real timer, so that loop holds the event loop open and the run
// never exits on its own. Everything above has already printed by this point, so
// the run is genuinely over: close the window and leave with a real status code.
dom.window.close();
process.exit(errors.length > 0 ? 1 : 0);
