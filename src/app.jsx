import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, useContext } from "react";
import { createRoot } from "react-dom/client";
import {
  Search, Plus, X, Pencil, Trash2, Download, Upload, BookOpen, Layers, Library,
  AlertTriangle, RotateCcw, ArrowUp, ArrowDown, Link2, SlidersHorizontal,
  ImagePlus, Check, ChevronLeft, ChevronDown, Copy, Shuffle,
} from "lucide-react";
import { gsap } from "gsap";
import GridMotion from "./components/GridMotion/GridMotion";
import CursorGrid from "./components/CursorGrid/CursorGrid";

/* ============================ constants ============================ */

const STATUS = {
  nao_lida: { label: "Não lida" },
  lendo: { label: "Lendo" },
  lida: { label: "Lida" },
};
const STATUS_ORDER = ["nao_lida", "lendo", "lida"];
const TIPOS = [
  "Trade Paperback", "Compendium", "Omnibus", "Absolute Edition",
  "DC Finest", "Hardcover", "Outro",
];
// Format names that were renamed after volumes were already stored with them
// (v77: "Encadernado (TPB)" became "Trade Paperback"; v78: "Capa Dura" became
// "Hardcover" and "Edição Absoluta" became "Absolute Edition"). normalizeLib rewrites
// them on load, so the stored value catches up on the next save.
const TIPOS_RENOMEADOS = {
  "Encadernado (TPB)": "Trade Paperback",
  "Capa Dura": "Hardcover",
  "Edição Absoluta": "Absolute Edition",
};
const DOC_LIMIT = 256 * 1024;
const IMG_TYPES = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
};

// Module scope, not inside the component: SegmentedTabs' mount effect keys off
// this array's own identity to decide whether to re-measure, and a literal
// redeclared every render would look like a new array on every unrelated
// state change elsewhere in the app, forcing a gsap.set() that stomped any
// elastic tween already in flight. One stable array, read by both the mobile
// tabbar and the desktop segmented control.
const TABS = [
  { key: "volumes", label: "HQs", icon: BookOpen },
  { key: "colecoes", label: "Coleções", icon: Layers },
  { key: "series", label: "Séries", icon: Library },
];

const ACCENT_HUE = 187; // the cyan the UI owns; character hues steer clear of it
const ACCENT_HEX = "#00B8D4"; // mirrors --accent; the lattice paints on canvas and cannot read a var
const QUASE_FECHANDO = 0.5; // a series only counts as "almost there" past this
const QUASE_MORNO = 0.65; // past this the hunt bar leaves its warm, needs-attention tier
const QUASE_PRONTO = 0.8; // past this the hunt bar reads as nearly closed, not just started
const SHELF_CAP = 60;
// Rotating the wall fifteen degrees means it has to overhang the box it fills in
// both directions and stay covered once the rows drift: it needs to be
// W*cos15 + H*sin15 wide, plus the 300px of travel, and W*sin15 + H*cos15 tall.
//
// The height in that pair is the hub's, not the window's, and a hub holding a
// couple of volumes is short. Tiles sized for a tall hub made a grid several
// times its box, centred and clipped, so only the middle row and a sliver of the
// one above it ever showed. Tiles are sized to fit a short hub now, and the grid
// widens to match: five by ten clears the overhang from a phone to a wide
// desktop. A smaller tile needs more of them, which is the whole of the trade.
//
// The counts are set by the worst case across the range, not by one screen: the
// columns are what a 1024px window needs, where the tile sits at its narrowest
// relative to the box, and the rows are what a phone needs, where the minimum
// tile width stops it shrinking any further.
const BACKDROP_ROWS = 6;
const BACKDROP_COLS = 13;

// Drawn once per page load, so the shelf and the hunt rotate between visits but
// hold still while you use the page.
const SESSION_SEED = Math.floor(Math.random() * 1e9);

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededPick(arr, n, seed) {
  const rnd = mulberry32(seed);
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = copy[i]; copy[i] = copy[j]; copy[j] = t;
  }
  return copy.slice(0, n);
}

const EMPTY_LIB = {
  volumes: [], colecoes: [], series: [], edicoes: [], cores: {},
  editoras: [], editoraSel: null,
};

const ED_TODAS = "__todas__";
const ED_SEM = "__sem__";

function slugify(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "editora";
}

// The publisher a volume or series already carries, normalised for comparison.
function editoraDe(item) {
  return ((item && item.editora) || "").trim();
}

// Publishers are discovered from data the user already entered, so the selector
// is populated without any setup step.
function editorasDescobertas(lib) {
  const vistos = new Map();
  [...lib.volumes, ...lib.series].forEach((x) => {
    const nome = editoraDe(x);
    if (!nome) return;
    const chave = nome.toLowerCase();
    if (!vistos.has(chave)) vistos.set(chave, nome);
  });
  return [...vistos.values()];
}

/* ============================ pure helpers ============================ */

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function parseNum(numero) {
  if (numero === null || numero === undefined || numero === "") return null;
  const m = String(numero).trim().match(/^\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function sortKey(e) {
  if (e.posicao !== null && e.posicao !== undefined && e.posicao !== "") {
    const p = parseFloat(e.posicao);
    if (!isNaN(p)) return p;
  }
  return parseNum(e.numero);
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// 24 hues at the house saturation, skipping the band around the interface accent
// so a character edge never competes with it, plus 8 specials that need their own
// saturation and lightness. Past roughly two dozen hues, neighbours stop being
// tellable apart in a 3px strip, which is why the extras vary depth, not hue.
// Chromatic entries sit in hue order, so the grid reads as one gradation and the
// deeper reds, greens and the navy land beside their own family rather than in a
// bolt-on tail. Neutrals have no hue to sort by, so they get their own group.
const PALETA_CROMATICA = [
  0, 12, 24, 36, 48, 60, 75, 90, 105, 120, 135, 150,
  210, 222, 234, 246, 258, 270, 282, 294, 306, 318, 330, 342,
].map((h) => ({ h }))
  .concat([
    { h: 358, s: 74, l: 54 }, // vermelho vivo
    { h: 348, s: 44, l: 34 }, // vinho
    { h: 142, s: 66, l: 46 }, // verde vibrante
    { h: 152, s: 44, l: 26 }, // verde escuro
    { h: 218, s: 58, l: 34 }, // azul marinho
    { h: 211.3, s: 96.7, l: 48.2 }, // azul vivo, #0476F2 exato
  ])
  .sort((a, b) => a.h - b.h);

// The Longbox cyan (v67 for collection bars, v68 in every picker at the user's
// request, characters included, which relaxes the chromatic list's rule of
// skipping the accent's band). Stored as a marker rather than a hue: a
// collection bar reads the live --accent from it and follows the theme, and
// everything drawn from a spec (cover edges, the band) resolves it to the
// accent's own numbers in swatchColors.
const COR_LONGBOX = { longbox: true };
const LONGBOX_HSL = { h: 188, s: 100, l: 42 }; // #00B8D4, the accent

const PALETA_NEUTRA = [
  { h: 220, s: 5, l: 38 },              // preto
  { h: 220, s: 6, l: 70 },              // cinza
  { h: 40, s: 14, l: 96, light: true }, // branco
  COR_LONGBOX,                          // ciano Longbox
];

const PALETA = PALETA_CROMATICA.concat(PALETA_NEUTRA);

function specForCharacter(personagem, cores) {
  const who = (personagem || "?").trim().toLowerCase();
  const escolhido = cores && cores[who];
  // Values written before the palette carried saturation were bare hues.
  if (typeof escolhido === "number") return { h: escolhido };
  if (escolhido && typeof escolhido === "object") return escolhido;
  let hue = hashString(who) % 360;
  if (Math.abs(hue - ACCENT_HUE) < 22) hue = (hue + 46) % 360;
  return { h: hue };
}

function sameSpec(a, b) {
  if (!a || !b) return false;
  return a.h === b.h && (a.s || 56) === (b.s || 56) &&
    (a.l || 56) === (b.l || 56) && !!a.light === !!b.light;
}

// One formula for every entry: the edge is the spec itself, the cover is that
// colour taken down (or up, for a light one) into something a title reads on.
// HSL lightness is not perceptual: hsl(60 100% 42%) is a bright yellow and
// hsl(240 100% 42%) a dark blue. A single fixed ink cannot serve both, and with
// the accent taking a publisher's hue it now has to. Measured against the dark
// ink, contrast across the wheel at that one lightness runs from 11.6 to 1.7,
// so the ink is picked per accent by whichever actually reads on it.
const INK_ESCURA = "#04191E";
const INK_CLARA = "#FFFFFF";

function canalLinear(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminancia([r, g, b]) {
  return 0.2126 * canalLinear(r) + 0.7152 * canalLinear(g) + 0.0722 * canalLinear(b);
}

function hslParaRgb(h, s, l) {
  const S = s / 100;
  const L = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function contraste(l1, l2) {
  const a = Math.max(l1, l2);
  const b = Math.min(l1, l2);
  return (a + 0.05) / (b + 0.05);
}

// The ink that reads on this fill, not the one the theme happens to name.
function tintaSobre(h, s, l) {
  const fundo = luminancia(hslParaRgb(h, s, l));
  const escura = contraste(fundo, luminancia([4, 25, 30]));
  const clara = contraste(fundo, luminancia([255, 255, 255]));
  return escura >= clara ? INK_ESCURA : INK_CLARA;
}

// A name for every swatch, shown on hover (v67). Kept beside the palette rather
// than inside each spec, because a picked spec is written to the database as is
// and the name has no business there. Keyed on the spec's own numbers, so a name
// cannot drift onto a neighbour if the palette is ever reordered.
const chaveCor = (s) => [s.h, s.s === undefined ? "" : s.s, s.l === undefined ? "" : s.l, s.light ? "c" : ""].join("|");
const NOMES_COR = new Map([
  [{ h: 0 }, "Vermelho"], [{ h: 12 }, "Coral"], [{ h: 24 }, "Laranja"], [{ h: 36 }, "Âmbar"],
  [{ h: 48 }, "Dourado"], [{ h: 60 }, "Amarelo"], [{ h: 75 }, "Pistache"], [{ h: 90 }, "Lima"],
  [{ h: 105 }, "Verde-claro"], [{ h: 120 }, "Verde"], [{ h: 135 }, "Esmeralda"],
  [{ h: 142, s: 66, l: 46 }, "Verde vivo"], [{ h: 150 }, "Jade"], [{ h: 152, s: 44, l: 26 }, "Verde escuro"],
  [{ h: 210 }, "Azul-céu"], [{ h: 211.3, s: 96.7, l: 48.2 }, "Azul vivo"], [{ h: 218, s: 58, l: 34 }, "Azul-marinho"],
  [{ h: 222 }, "Azul"], [{ h: 234 }, "Cobalto"], [{ h: 246 }, "Anil"], [{ h: 258 }, "Índigo"],
  [{ h: 270 }, "Violeta"], [{ h: 282 }, "Roxo"], [{ h: 294 }, "Orquídea"], [{ h: 306 }, "Magenta"],
  [{ h: 318 }, "Fúcsia"], [{ h: 330 }, "Rosa"], [{ h: 342 }, "Framboesa"],
  [{ h: 348, s: 44, l: 34 }, "Vinho"], [{ h: 358, s: 74, l: 54 }, "Vermelho vivo"],
  [{ h: 220, s: 5, l: 38 }, "Preto"], [{ h: 220, s: 6, l: 70 }, "Cinza"], [{ h: 40, s: 14, l: 96, light: true }, "Branco"],
].map(([spec, nome]) => [chaveCor(spec), nome]));
function nomeDaCor(spec) {
  if (spec && spec.longbox) return "Ciano Longbox";
  return (spec && NOMES_COR.get(chaveCor(spec))) || "Cor";
}

function swatchColors(spec, lift) {
  if (spec && spec.longbox) spec = LONGBOX_HSL;
  const h = spec.h || 0;
  const s = spec.s === undefined ? 56 : spec.s;
  const l = spec.l === undefined ? 56 : spec.l;
  const shift = lift || 0;
  if (spec.light) {
    return {
      a: "hsl(" + h + " " + Math.round(s * 1.6) + "% " + (90 - shift) + "%)",
      b: "hsl(" + h + " " + Math.round(s * 2.2) + "% " + (73 - shift) + "%)",
      edge: "hsl(" + h + " " + Math.round(s * 0.8) + "% 34%)",
      ink: "rgba(14,16,20,0.92)",
      inkSoft: "rgba(14,16,20,0.6)",
      rule: "rgba(14,16,20,0.45)",
    };
  }
  return {
    a: "hsl(" + h + " " + Math.round(s * 0.58) + "% " + (Math.round(l * 0.42) + shift) + "%)",
    b: "hsl(" + h + " " + Math.round(s * 0.68) + "% " + (Math.round(l * 0.17) + Math.round(shift / 2)) + "%)",
    edge: "hsl(" + h + " " + s + "% " + l + "%)",
    ink: "rgba(255,255,255,0.96)",
    inkSoft: "rgba(255,255,255,0.62)",
    rule: "rgba(255,255,255,0.5)",
  };
}

// Hue comes from the character so the shelf reads as a map of who you collect;
// lightness varies by title so a run of one character is not a flat block.
// The edge colour rides on every cover, uploaded art included, so the map
// survives however many real covers exist.
function coverColors(volume, cores) {
  const spec = specForCharacter(volume.personagem || volume.titulo, cores);
  const lift = (hashString(volume.titulo || "?") % 11) - 5;
  return swatchColors(spec, lift);
}

const CoresContext = React.createContext(null);
function useCores() { return useContext(CoresContext); }

function withoutId(arr, id) { return arr.filter((x) => x.id !== id); }

function deleteVolume(lib, id) {
  return {
    ...lib,
    volumes: withoutId(lib.volumes, id),
    colecoes: lib.colecoes.map((c) => ({ ...c, membros: c.membros.filter((v) => v !== id) })),
  };
}
function deleteColecao(lib, id) { return { ...lib, colecoes: withoutId(lib.colecoes, id) }; }
function deleteSerie(lib, id) {
  const edIds = lib.edicoes.filter((e) => e.serieId === id).map((e) => e.id);
  return {
    ...lib,
    series: withoutId(lib.series, id),
    edicoes: lib.edicoes.filter((e) => e.serieId !== id),
    volumes: lib.volumes.map((v) => ({
      ...v,
      edicoesColetadasIds: v.edicoesColetadasIds.filter((eid) => !edIds.includes(eid)),
    })),
  };
}
function deleteEdicao(lib, id) {
  return {
    ...lib,
    edicoes: withoutId(lib.edicoes, id),
    volumes: lib.volumes.map((v) => ({
      ...v,
      edicoesColetadasIds: v.edicoesColetadasIds.filter((eid) => eid !== id),
    })),
  };
}

function ensureRange(lib, serieId, de, ate) {
  const edicoes = [...lib.edicoes];
  const ids = [];
  for (let i = de; i <= ate; i++) {
    let ex = edicoes.find((e) => e.serieId === serieId && parseNum(e.numero) === i);
    if (!ex) {
      ex = { id: uid(), serieId, numero: String(i), mes: "", ano: "", posicao: null };
      edicoes.push(ex);
    }
    ids.push(ex.id);
  }
  return { edicoes, ids };
}

function ensureAvulsa(lib, serieId, numeroStr) {
  const edicoes = [...lib.edicoes];
  let ex = edicoes.find(
    (e) => e.serieId === serieId && e.numero.trim().toLowerCase() === numeroStr.trim().toLowerCase()
  );
  if (!ex) {
    ex = { id: uid(), serieId, numero: numeroStr.trim(), mes: "", ano: "", posicao: null };
    edicoes.push(ex);
  }
  return { edicoes, id: ex.id };
}

function parseImportText(texto) {
  const linhas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
  const registros = [];
  linhas.forEach((linha) => {
    const rangeMatch = linha.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const a = parseInt(rangeMatch[1], 10), b = parseInt(rangeMatch[2], 10);
      const de = Math.min(a, b), ate = Math.max(a, b);
      for (let i = de; i <= ate; i++) registros.push({ numero: String(i), mes: "", ano: "" });
      return;
    }
    const delim = linha.includes("\t") ? "\t" : ",";
    const partes = linha.split(delim);
    const numero = (partes[0] || "").trim();
    if (!numero) return;
    registros.push({ numero, mes: (partes[1] || "").trim(), ano: (partes[2] || "").trim() });
  });
  return registros;
}

function personagensDaSerie(s) {
  if (Array.isArray(s.personagens) && s.personagens.length) {
    return s.personagens.map((p) => (typeof p === "string" ? { nome: p, de: null, ate: null } : p));
  }
  if (s.personagem) return [{ nome: s.personagem, de: null, ate: null }];
  return [];
}

function anoRange(s) {
  const ini = s.anoInicio || "?";
  const fim = s.anoFim || "presente";
  return ini + "-" + fim;
}

function normalizeLib(raw) {
  const lib = {
    volumes: Array.isArray(raw?.volumes) ? raw.volumes : [],
    colecoes: Array.isArray(raw?.colecoes) ? raw.colecoes : [],
    series: Array.isArray(raw?.series) ? raw.series : [],
    edicoes: Array.isArray(raw?.edicoes) ? raw.edicoes : [],
  };
  lib.volumes = lib.volumes.map((v) => ({
    ...v,
    ...(TIPOS_RENOMEADOS[v.tipo] ? { tipo: TIPOS_RENOMEADOS[v.tipo] } : null),
    edicoesColetadasIds: Array.isArray(v.edicoesColetadasIds) ? v.edicoesColetadasIds : [],
  }));
  lib.colecoes = lib.colecoes.map((c) => ({
    ...c,
    membros: Array.isArray(c.membros) ? c.membros : [],
  }));
  lib.cores = raw && raw.cores && typeof raw.cores === "object" && !Array.isArray(raw.cores)
    ? raw.cores
    : {};
  lib.editoras = Array.isArray(raw?.editoras) ? raw.editoras : [];
  lib.editoraSel = typeof raw?.editoraSel === "string" ? raw.editoraSel : ED_TODAS;
  return lib;
}

// Creates an entry for every publisher already present in the data, so the
// selector is useful on first open with no setup. Never removes entries: a
// publisher the user renamed or emptied stays until they delete it.
function semearEditoras(lib) {
  const existentes = new Set((lib.editoras || []).map((e) => (e.nome || "").trim().toLowerCase()));
  const novas = editorasDescobertas(lib)
    .filter((nome) => !existentes.has(nome.toLowerCase()))
    .map((nome, i) => ({
      id: slugify(nome) + (existentes.has(slugify(nome)) ? "-" + i : ""),
      nome,
      cor: null,
      logoAssetId: null,
      logoFundo: "nenhum",
    }));
  if (!novas.length) return lib;
  return { ...lib, editoras: [...(lib.editoras || []), ...novas] };
}

function bytesOf(obj) {
  try { return new Blob([JSON.stringify(obj)]).size; }
  catch (e) { return JSON.stringify(obj).length; }
}
function formatBytes(b) {
  return b < 1024 * 1024 ? (b / 1024).toFixed(1) + " KB" : (b / (1024 * 1024)).toFixed(2) + " MB";
}

/* ============================ storage ============================ */

const store = {
  db: null,
  assets: null,
  downloads: null,
  lastVolumes: "",
  lastColecoes: "",
  lastSeries: "",
  lastCores: "",
  lastEditoras: "",
  lastEdicoes: new Map(),
  timer: null,
  inFlight: 0,
  onError: null,
};

function shardEdicoes(edicoes) {
  const m = new Map();
  edicoes.forEach((e) => {
    if (!m.has(e.serieId)) m.set(e.serieId, []);
    m.get(e.serieId).push(e);
  });
  return m;
}

async function loadLibrary(db) {
  const [volSnap, colSnap, serSnap, corSnap, ediSnap, edSnap] = await Promise.all([
    db.doc("library/volumes").get(),
    db.doc("library/colecoes").get(),
    db.doc("library/series").get(),
    db.doc("library/cores").get(),
    db.doc("library/editoras").get(),
    db.collection("edicoes").get(),
  ]);
  const volumes = volSnap.exists ? volSnap.data().items || [] : [];
  const colecoes = colSnap.exists ? colSnap.data().items || [] : [];
  const series = serSnap.exists ? serSnap.data().items || [] : [];
  const cores = corSnap.exists ? corSnap.data().mapa || {} : {};
  const editoras = ediSnap.exists ? ediSnap.data().itens || [] : [];
  const editoraSel = ediSnap.exists ? ediSnap.data().selecionada || ED_TODAS : ED_TODAS;
  const edicoes = [];
  edSnap.docs.forEach((d) => {
    const items = d.data()?.items;
    if (Array.isArray(items)) edicoes.push(...items);
  });

  store.lastVolumes = JSON.stringify(volumes);
  store.lastColecoes = JSON.stringify(colecoes);
  store.lastSeries = JSON.stringify(series);
  store.lastCores = JSON.stringify(cores);
  store.lastEditoras = JSON.stringify({ itens: editoras, selecionada: editoraSel });
  store.lastEdicoes = new Map();
  shardEdicoes(edicoes).forEach((items, sid) => store.lastEdicoes.set(sid, JSON.stringify(items)));

  return normalizeLib({ volumes, colecoes, series, edicoes, cores, editoras, editoraSel });
}

function dbErrorMessage(e) {
  const code = e && e.code;
  if (code === "invalid_argument") return "Esse item ficou grande demais pro limite de 256 KB por documento. Me avise pra reestruturarmos.";
  if (code === "quota_exceeded") return "O banco do artefato encheu. Apague algo antes de continuar.";
  if (code === "resource_exhausted") return "Muitas gravações seguidas. Espere um instante e tente de novo.";
  if (code === "revoked") return "O acesso ao armazenamento foi revogado nesta aba. Recarregue a página.";
  if (code === "unavailable") return "Armazenamento instável agora. Tente de novo em alguns segundos.";
  return "Não consegui salvar. Tente de novo.";
}

async function flushLibrary(lib) {
  const db = store.db;
  if (!db) return;

  const writes = [];
  const volumesJson = JSON.stringify(lib.volumes);
  if (volumesJson !== store.lastVolumes) {
    writes.push({ key: "volumes", ref: db.doc("library/volumes"), body: { items: lib.volumes }, json: volumesJson });
  }
  const colecoesJson = JSON.stringify(lib.colecoes);
  if (colecoesJson !== store.lastColecoes) {
    writes.push({ key: "colecoes", ref: db.doc("library/colecoes"), body: { items: lib.colecoes }, json: colecoesJson });
  }
  const seriesJson = JSON.stringify(lib.series);
  if (seriesJson !== store.lastSeries) {
    writes.push({ key: "series", ref: db.doc("library/series"), body: { items: lib.series }, json: seriesJson });
  }
  const coresJson = JSON.stringify(lib.cores || {});
  if (coresJson !== store.lastCores) {
    writes.push({ key: "cores", ref: db.doc("library/cores"), body: { mapa: lib.cores || {} }, json: coresJson });
  }
  const ediBody = { itens: lib.editoras || [], selecionada: lib.editoraSel || ED_TODAS };
  const ediJson = JSON.stringify(ediBody);
  if (ediJson !== store.lastEditoras) {
    writes.push({ key: "editoras", ref: db.doc("library/editoras"), body: ediBody, json: ediJson });
  }

  const shards = shardEdicoes(lib.edicoes);
  shards.forEach((items, sid) => {
    const json = JSON.stringify(items);
    if (json !== store.lastEdicoes.get(sid)) {
      writes.push({ key: "ed:" + sid, sid, ref: db.collection("edicoes").doc(sid), body: { items }, json });
    }
  });
  store.lastEdicoes.forEach((_, sid) => {
    if (!shards.has(sid)) writes.push({ key: "ed:" + sid, sid, ref: db.collection("edicoes").doc(sid), remove: true });
  });

  if (!writes.length) return;
  store.inFlight++;
  try {
    for (const w of writes) {
      try {
        if (w.remove) {
          await w.ref.delete();
          store.lastEdicoes.delete(w.sid);
        } else {
          await w.ref.set(w.body);
          if (w.key === "volumes") store.lastVolumes = w.json;
          else if (w.key === "colecoes") store.lastColecoes = w.json;
          else if (w.key === "series") store.lastSeries = w.json;
          else if (w.key === "cores") store.lastCores = w.json;
          else if (w.key === "editoras") store.lastEditoras = w.json;
          else store.lastEdicoes.set(w.sid, w.json);
        }
      } catch (e) {
        if (store.onError) store.onError(dbErrorMessage(e));
        return;
      }
    }
  } finally {
    store.inFlight--;
  }
}

function scheduleSave(lib) {
  if (!store.db) return;
  if (store.timer) clearTimeout(store.timer);
  store.timer = setTimeout(() => {
    store.timer = null;
    flushLibrary(lib);
  }, 500);
}

function storeIsBusy() { return store.timer !== null || store.inFlight > 0; }

/* ============================ assets ============================ */

function coverUrl(volume) {
  return volume && volume.capaAssetId ? "/_blob/" + volume.capaAssetId : null;
}

/* ============================ shelf thumbnails ============================ */

// v85. Covers are stored at full size (968x1500 from Amazon), about 1.45
// megapixels each, and the shelves show them about 134px wide. The user's
// measurements pinned the tab-switch stutter on them: leaving Séries, which
// has no covers, Chrome drops the decoded ones, and coming back to HQs or
// Coleções held the next frame for up to 475ms while it decoded them all
// again (8ms with the covers hidden). So every shelf draws a 360px-wide copy
// instead, about 7 times fewer pixels to decode. The copies are made in the
// browser, one at a time while idle, and kept in this device's IndexedDB:
// nothing is uploaded and the shared library is never written. The volume
// sheet and the hub's suggestion keep the full cover. Every step fails soft:
// without IndexedDB they last the session, without canvas support the full
// cover is used, as before.
const MINI_LARGURA = 360;
// JPEG, not WebP: Chrome decodes a JPEG straight to a reduced size when it is
// shown smaller, and cannot do that for WebP, so a WebP thumbnail measured no
// faster to decode than the full JPEG cover it replaced.
const MINI_FORMATO = "image/jpeg";
const MINI_BANCO = "longbox-miniaturas";
const miniUrls = new Map();
const miniOuvintes = new Map();
const miniGerais = new Set();
let miniAviso = 0;

function miniUrl(volume) {
  return volume && volume.capaAssetId ? miniUrls.get(volume.capaAssetId) || null : null;
}

function avisarMini(id) {
  const s = miniOuvintes.get(id);
  if (s) s.forEach((f) => f());
  // The hub backdrop wants to know about all of them; batched.
  if (!miniAviso) miniAviso = setTimeout(() => { miniAviso = 0; miniGerais.forEach((f) => f()); }, 400);
}

// Re-renders the caller when its cover's thumbnail arrives.
function useMiniCapa(id) {
  const [, tocar] = useState(0);
  useEffect(() => {
    if (!id || miniUrls.has(id)) return undefined;
    const f = () => tocar((n) => n + 1);
    if (!miniOuvintes.has(id)) miniOuvintes.set(id, new Set());
    miniOuvintes.get(id).add(f);
    return () => { const s = miniOuvintes.get(id); if (s) s.delete(f); };
  }, [id]);
  return id ? miniUrls.get(id) || null : null;
}

// A number that moves whenever thumbnails arrive, for memoised lists of them.
function useMiniVersao() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const f = () => setV((n) => n + 1);
    miniGerais.add(f);
    return () => miniGerais.delete(f);
  }, []);
  return v;
}

function abrirMiniBanco() {
  return new Promise((res) => {
    try {
      if (typeof indexedDB === "undefined") { res(null); return; }
      const q = indexedDB.open(MINI_BANCO, 1);
      q.onupgradeneeded = () => q.result.createObjectStore("capas");
      q.onsuccess = () => res(q.result);
      q.onerror = () => res(null);
      q.onblocked = () => res(null);
    } catch (e) { res(null); }
  });
}
const miniBanco = abrirMiniBanco();

// Everything already made on this device, read once at startup.
const miniCacheLido = miniBanco.then((db) => new Promise((res) => {
  if (!db) { res(); return; }
  try {
    const q = db.transaction("capas", "readonly").objectStore("capas").openCursor();
    q.onsuccess = () => {
      const c = q.result;
      if (!c) { res(); return; }
      const v = c.value;
      if (v && v.blob && v.largura === MINI_LARGURA && v.formato === MINI_FORMATO) miniUrls.set(c.key, URL.createObjectURL(v.blob));
      c.continue();
    };
    q.onerror = () => res();
  } catch (e) { res(); }
}));

// Waits for that read, but never longer than the given time: the covers can
// always fall back to full size.
function esperarMiniaturas(ms) {
  return Promise.race([miniCacheLido, new Promise((r) => setTimeout(r, ms))]);
}

async function gerarMini(id) {
  const url = "/_blob/" + id;
  let fonte = null;
  try {
    const r = await fetch(url);
    if (r.ok) fonte = await r.blob();
  } catch (e) { fonte = null; }
  if (!fonte) {
    const img = new Image();
    img.src = url;
    await img.decode();
    fonte = img;
  }
  // Size first, then the resized copy; the full-size bitmap is let go at once.
  const inteira = await createImageBitmap(fonte);
  const larg = Math.min(MINI_LARGURA, inteira.width);
  const altura = Math.round((larg * inteira.height) / inteira.width);
  if (inteira.close) inteira.close();
  const mini = await createImageBitmap(fonte, { resizeWidth: larg, resizeHeight: altura, resizeQuality: "high" });
  let blob;
  if (typeof OffscreenCanvas === "function") {
    const c = new OffscreenCanvas(larg, altura);
    c.getContext("2d").drawImage(mini, 0, 0);
    blob = await c.convertToBlob({ type: MINI_FORMATO, quality: 0.88 });
  } else {
    const c = document.createElement("canvas");
    c.width = larg; c.height = altura;
    c.getContext("2d").drawImage(mini, 0, 0);
    blob = await new Promise((r) => c.toBlob(r, MINI_FORMATO, 0.88));
  }
  if (mini.close) mini.close();
  if (!blob) throw new Error("sem blob");
  return blob;
}

const miniFila = [];
const miniNaFila = new Set();
let miniRodando = false;
const ocioso = (fn) => (typeof requestIdleCallback === "function"
  ? requestIdleCallback(fn, { timeout: 2000 })
  : setTimeout(fn, 60));

function rodarMiniFila() {
  if (miniRodando) return;
  const id = miniFila.shift();
  if (!id) return;
  miniRodando = true;
  ocioso(async () => {
    try {
      const blob = await gerarMini(id);
      if (!miniUrls.has(id)) miniUrls.set(id, URL.createObjectURL(blob));
      avisarMini(id);
      const db = await miniBanco;
      if (db) {
        try { db.transaction("capas", "readwrite").objectStore("capas").put({ blob, largura: MINI_LARGURA, formato: MINI_FORMATO }, id); } catch (e) { /* the session copy still works */ }
      }
    } catch (e) {
      // This cover keeps its full size; nothing else changes.
    }
    miniRodando = false;
    rodarMiniFila();
  });
}

// Queues a thumbnail for every cover in use that has none, and forgets the
// ones no volume uses any more.
async function prepararMiniaturas(ids) {
  if (typeof createImageBitmap !== "function") return;
  await miniCacheLido;
  const usados = new Set(ids);
  ids.forEach((id) => {
    if (miniUrls.has(id) || miniNaFila.has(id)) return;
    miniNaFila.add(id);
    miniFila.push(id);
  });
  rodarMiniFila();
  const db = await miniBanco;
  if (!db) return;
  try {
    const st = db.transaction("capas", "readwrite").objectStore("capas");
    const q = st.getAllKeys();
    q.onsuccess = () => (q.result || []).forEach((k) => { if (!usados.has(k)) st.delete(k); });
  } catch (e) { /* tidiness only */ }
}

function assetErrorMessage(e) {
  const code = e && e.code;
  if (code === "too_large") return "Imagem grande demais. O limite é 20 MB.";
  if (code === "unsupported_type") return "Formato não aceito. Use PNG, JPG, GIF ou WebP.";
  if (code === "quota_or_state") return "O espaço de imagens do artefato encheu.";
  if (code === "rate_limited") return "Muitos envios seguidos. Espere um pouco.";
  if (code === "invalid_request") return "Esse arquivo não deu pra ler como imagem.";
  if (code === "upstream_auth") return "Sessão expirada. Recarregue a página.";
  return "Não consegui enviar a capa.";
}

const COVER_MAX_W = 900;
const COVER_PASSTHROUGH_BYTES = 400 * 1024;

// Shrinks only genuinely oversized files (a phone photo). A cover saved from a
// store page is already small and is passed through untouched, because
// recompressing an already-compressed JPEG costs quality and buys nothing.
async function prepareCover(file) {
  if (file.size <= COVER_PASSTHROUGH_BYTES) return file;
  if (typeof createImageBitmap !== "function") return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (e) {
    return file;
  }
  try {
    if (bitmap.width <= COVER_MAX_W) return file;
    const w = COVER_MAX_W;
    const h = Math.round(bitmap.height * (w / bitmap.width));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], "capa.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

async function uploadCover(file) {
  if (!store.assets) throw { code: "not_granted", message: "sem assets" };
  const prepared = await prepareCover(file);
  let type = prepared.type;
  if (!type || !Object.values(IMG_TYPES).includes(type)) {
    const ext = (prepared.name.split(".").pop() || "").toLowerCase();
    type = IMG_TYPES[ext];
    if (!type) throw { code: "unsupported_type", message: "extensão desconhecida" };
  }
  return store.assets.upload(prepared, { type });
}

/* ============================ small components ============================ */

function useTransitionMount(open, exitMs) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let raf1, raf2, timer;
    if (open) {
      setMounted(true);
      raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setShown(true)); });
    } else {
      setShown(false);
      timer = setTimeout(() => setMounted(false), exitMs);
    }
    return () => {
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      if (timer) clearTimeout(timer);
    };
  }, [open, exitMs]);
  return [mounted, shown];
}

const UNLOCK_COMMIT_PX = 120;
const UNLOCK_FLICK_V = 0.35; // px per ms
const UNLOCK_FADE_OVER = 420; // px of travel over which the hub fades out

// The lattice follows a cursor, and a finger is not one. On touch the only thing
// it could do is drag a lit trail around while the page scrolls, repainting a
// canvas through the whole gesture on the device least able to spare it, and fire
// a ring on every tap that opens a sheet. So it is not mounted there at all.
// Read live rather than once: a tablet with a mouse plugged in should get it.
// 100vw includes the vertical scrollbar and the visible area does not, so a layer
// bled to 100vw overhangs by exactly the scrollbar's width and the page grows a
// horizontal scrollbar. CSS cannot measure that gap, so it is published here as
// --sbw for the bled layers to subtract.
//
// Measured in a browser rather than assumed: the scrollbar appears when the
// library finishes loading and the page outgrows the window, and that transition
// fires no resize event, and no ResizeObserver either, on the root or on the
// body. What it does do is render. So the measurement runs after every render,
// which costs two property reads and writes only when the number moved.
function useLarguraDaBarra() {
  const ultimo = useRef(null);
  const medir = useCallback(() => {
    if (typeof window === "undefined") return;
    const raiz = document.documentElement;
    const vao = Math.max(0, window.innerWidth - raiz.clientWidth);
    if (ultimo.current === vao) return;
    ultimo.current = vao;
    raiz.style.setProperty("--sbw", vao + "px");
  }, []);

  useEffect(medir);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [medir]);
}

function usePonteiroFino() {
  const [fino, setFino] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const ler = () => setFino(mq.matches);
    ler();
    mq.addEventListener("change", ler);
    return () => mq.removeEventListener("change", ler);
  }, []);
  return fino;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const HOLD_EASE_LINEAR = (t) => t;
const HOLD_EASE_OUT = (t) => 1 - Math.pow(1 - t, 3);

// Phone-unlock gesture: past the end of the hub, the surface tracks the finger
// 1:1 and is thrown clear on release. Gated on a bottom sentinel so a hub taller
// than the viewport stays readable. Transforms are written straight to the node,
// so nothing re-renders per frame.
function useHubUnlock(active, atBottomRef, elRef, onEnter) {
  useEffect(() => {
    if (!active) return;
    const el = elRef.current;
    if (!el) return;

    const reduce = prefersReducedMotion();
    let offset = 0;
    let tracking = false;
    let startY = 0;
    let startOffset = 0;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0;
    let committed = false;
    let armed = false;
    let wheelIdle = null;
    const armTimer = setTimeout(() => { armed = true; }, 350);

    const paint = (v) => {
      offset = v;
      if (v <= 0) {
        el.style.transform = "";
        el.style.opacity = "";
      } else {
        el.style.transform = "translateY(" + -v + "px)";
        el.style.opacity = String(Math.max(0, 1 - v / UNLOCK_FADE_OVER));
      }
    };

    const commit = () => {
      if (committed) return;
      committed = true;
      el.style.willChange = "";
      if (reduce) {
        el.style.transition = "opacity 150ms var(--ease-out)";
        el.style.opacity = "0";
        setTimeout(onEnter, 130);
        return;
      }
      el.style.transition = "transform 260ms var(--ease-drawer), opacity 200ms var(--ease-out)";
      el.style.transform = "translateY(-100%)";
      el.style.opacity = "0";
      setTimeout(onEnter, 230);
    };

    // Friction rather than a wall: pulling the wrong way resists instead of refusing.
    const damp = (v) => (v < 0 ? v * 0.25 : v);

    const release = () => {
      tracking = false;
      if (committed) return;
      if (offset >= UNLOCK_COMMIT_PX || velocity > UNLOCK_FLICK_V) { commit(); return; }
      if (offset === 0) return;
      el.style.transition = "transform 220ms var(--ease-drawer), opacity 180ms var(--ease-out)";
      paint(0);
      setTimeout(() => {
        if (committed) return;
        el.style.transition = "";
        el.style.willChange = "";
      }, 240);
    };

    const onTouchStart = (e) => {
      if (!armed || committed || e.touches.length > 1) return;
      lastY = e.touches[0].clientY;
      lastT = Date.now();
      velocity = 0;
      tracking = false;
    };

    const onTouchMove = (e) => {
      if (!armed || committed || e.touches.length > 1) return;
      const y = e.touches[0].clientY;
      const now = Date.now();
      const dt = Math.max(1, now - lastT);
      velocity = (lastY - y) / dt;
      lastY = y;
      lastT = now;

      if (!atBottomRef.current) {
        if (offset > 0) release();
        tracking = false;
        return;
      }
      if (!tracking) {
        // Start from wherever the finger is now, so reaching the bottom mid-swipe
        // does not make the surface jump.
        tracking = true;
        startY = y;
        startOffset = offset;
        el.style.transition = "";
        el.style.willChange = "transform, opacity";
      }
      if (reduce) {
        if (startY - y > UNLOCK_COMMIT_PX) commit();
        return;
      }
      paint(damp(startOffset + (startY - y)));
    };

    const onWheel = (e) => {
      if (!armed || committed) return;
      if (!atBottomRef.current) { if (offset > 0) release(); return; }
      if (e.deltaY <= 0 && offset <= 0) return;
      if (reduce) {
        if (e.deltaY > 0) { startOffset += e.deltaY; if (startOffset > UNLOCK_COMMIT_PX) commit(); }
        return;
      }
      el.style.transition = "";
      el.style.willChange = "transform, opacity";
      paint(Math.max(0, offset + e.deltaY));
      if (offset >= UNLOCK_COMMIT_PX) { commit(); return; }
      // A wheel has no finger-up, so idleness stands in for release.
      if (wheelIdle) clearTimeout(wheelIdle);
      wheelIdle = setTimeout(() => { velocity = 0; release(); }, 160);
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", release, { passive: true });
    window.addEventListener("touchcancel", release, { passive: true });
    return () => {
      clearTimeout(armTimer);
      if (wheelIdle) clearTimeout(wheelIdle);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", release);
      window.removeEventListener("touchcancel", release);
    };
  }, [active, atBottomRef, elRef, onEnter]);
}

// Pasting an image beats the save-to-disk-then-pick dance: copy the cover on a
// store page, press Ctrl+V here. Only fires on an image in the clipboard, so
// pasting text into the form's fields is untouched.
function usePasteImage(active, onImage) {
  useEffect(() => {
    if (!active) return;
    const onPaste = (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === "file" && it.type && it.type.indexOf("image/") === 0) {
          const file = it.getAsFile();
          if (file) { e.preventDefault(); onImage(file); return; }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [active, onImage]);
}

function useEscape(active, onClose) {
  useEffect(() => {
    if (!active) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [active, onClose]);
}

function CoverArt({ volume, grande }) {
  const mini = useMiniCapa(grande ? null : volume && volume.capaAssetId);
  const [miniFalhou, setMiniFalhou] = useState(false);
  const usandoMini = !!mini && !miniFalhou;
  const url = usandoMini ? mini : coverUrl(volume);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); setMiniFalhou(false); }, [volume && volume.capaAssetId]);
  const c = coverColors(volume, useCores());

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={"Capa de " + volume.titulo}
        // A thumbnail is already on this device and small, so it loads at
        // once. Left lazy, a cover in a hidden tab kept showing the full image
        // it had before its thumbnail arrived, and decoded that on the switch.
        loading={usandoMini ? "eager" : "lazy"}
        draggable={false}
        // A thumbnail that will not load falls back to the full cover, not
        // to the drawn one.
        onError={() => (usandoMini ? setMiniFalhou(true) : setFailed(true))}
      />
    );
  }
  return (
    <div
      className="cover-fb"
      style={{ "--fb-a": c.a, "--fb-b": c.b, "--fb-ink": c.ink, "--fb-ink-soft": c.inkSoft, "--fb-rule": c.rule }}
    >
      <div>
        <div className="cover-rule" />
        <div className="cover-fb-title">{volume.titulo}</div>
      </div>
      <div className="cover-fb-foot">{volume.personagem || ""}</div>
    </div>
  );
}

// Volumes carry an optional `ordem`: absent until the user drags one for the
// first time in that personagem group, so nothing changes until they ask for
// manual order. Ordered items sort by it; anything without one (new arrivals
// in an already-ordered group included) falls in alphabetically after them,
// which is what keeps a freshly catalogued volume from jumping to a random spot.
function ordenarGrupoVolumes(itens) {
  const temOrdem = itens.some((v) => typeof v.ordem === "number");
  if (!temOrdem) return itens.slice().sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
  return itens.slice().sort((a, b) => {
    const oa = typeof a.ordem === "number" ? a.ordem : Infinity;
    const ob = typeof b.ordem === "number" ? b.ordem : Infinity;
    return oa !== ob ? oa - ob : a.titulo.localeCompare(b.titulo, "pt-BR");
  });
}

function VolumeCard({
  volume, open, onClick, index, bare,
  reordenavel, personagem, dragging, holdColor, cardRef,
  onDragPointerDown, onDragPointerMove, onDragPointerEnd,
}) {
  const c = coverColors(volume, useCores());
  return (
    <button
      ref={cardRef}
      className="vol press"
      data-open={open ? "true" : "false"}
      data-vol-id={reordenavel ? volume.id : undefined}
      data-personagem={reordenavel ? personagem : undefined}
      data-dragging={dragging ? "true" : undefined}
      style={{ "--i": Math.min(index, 11), "--hold-color": holdColor || undefined }}
      onClick={onClick}
      onPointerDown={reordenavel ? onDragPointerDown : undefined}
      onPointerMove={reordenavel ? onDragPointerMove : undefined}
      onPointerUp={reordenavel ? onDragPointerEnd : undefined}
      onPointerCancel={reordenavel ? onDragPointerEnd : undefined}
      title={bare ? volume.titulo : undefined}
    >
      <div className="cover" style={{ "--edge": c.edge }}>
        <CoverArt volume={volume} />
        {reordenavel && (
          <>
            <div className="vol-hold" aria-hidden="true" />
            <div className="vol-hold__crest" aria-hidden="true" />
          </>
        )}
      </div>
      {!bare && <div className="vol-title clamp-2">{volume.titulo}</div>}
      {/* v75: the status in words beside the format, so it no longer rests on
          the bottom bar's colour alone. Unread says nothing: it is the default. */}
      {!bare && (
        <div className="vol-meta vol-meta-linha">
          {/* The format gives way when the row is tight; the status never does. */}
          {volume.tipo && <span className="truncate">{volume.tipo}</span>}
          {volume.status !== "nao_lida" && STATUS[volume.status] && (
            <span className="vol-status-wrap">
              {volume.tipo ? "· " : ""}
              <span className="vol-status" data-s={volume.status}>{STATUS[volume.status].label}</span>
            </span>
          )}
        </div>
      )}
    </button>
  );
}

const MAX_SUGESTOES = 8;

/* Ranked by where the match lands. A title that starts with what you typed is
   almost always the one you meant, and a hit that only exists in the notes is
   almost never it, so the two cannot sit side by side unordered. */
function ordenarSugestoes(volumes, textoBusca, q) {
  const termo = q.trim().toLowerCase();
  if (!termo) return [];
  const achados = [];
  volumes.forEach((v) => {
    if (!(textoBusca[v.id] || "").includes(termo)) return;
    const titulo = (v.titulo || "").toLowerCase();
    const personagem = (v.personagem || "").toLowerCase();
    const peso = titulo.startsWith(termo) ? 0
      : titulo.includes(termo) ? 1
      : personagem.includes(termo) ? 2
      : 3;
    achados.push({ v, peso });
  });
  achados.sort((a, b) => a.peso - b.peso || a.v.titulo.localeCompare(b.v.titulo, "pt-BR"));
  return achados.slice(0, MAX_SUGESTOES).map((a) => a.v);
}

// Collections and séries rank the way volumes do: name starts with the term,
// then name contains it, then a secondary text (a série's characters) does.
// What counts as a match mirrors each tab's own search filter (v73).
const SUGESTOES_DA_ABA = 4;
function ordenarPorNome(itens, termoBruto, secundario) {
  const termo = termoBruto.trim().toLowerCase();
  if (!termo) return [];
  const achados = [];
  itens.forEach((it) => {
    const nome = (it.nome || "").toLowerCase();
    const extra = secundario ? secundario(it).toLowerCase() : "";
    const peso = nome.startsWith(termo) ? 0 : nome.includes(termo) ? 1 : extra.includes(termo) ? 2 : -1;
    if (peso >= 0) achados.push({ it, peso });
  });
  achados.sort((x, y) => x.peso - y.peso || x.it.nome.localeCompare(y.it.nome, "pt-BR"));
  return achados.map((x) => x.it);
}

/* The suggestions never obey the publisher filter or the status and type filters:
   looking for a volume you half remember should not depend on what you happen to be
   browsing. Under 768px the field takes the whole screen when focused, because the
   on-screen keyboard would otherwise leave a dropdown two rows tall. */
function SearchBox({ query, setQuery, sugestoes, onPick }) {
  const [aberta, setAberta] = useState(false);
  const [idx, setIdx] = useState(0);
  const [full, setFull] = useState(false);
  const raiz = useRef(null);
  const campo = useRef(null);
  const cores = useCores();

  useEffect(() => { setIdx(0); }, [query]);

  const fechar = useCallback(() => { setAberta(false); setFull(false); }, []);

  useEffect(() => {
    if (!aberta) return;
    const fora = (e) => { if (raiz.current && !raiz.current.contains(e.target)) fechar(); };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberta, fechar]);

  const mostrando = aberta && query.trim().length > 0;

  const escolher = (v) => {
    if (!v) return;
    fechar();
    onPick(v);
  };

  const tecla = (e) => {
    if (e.key === "Escape") {
      fechar();
      if (campo.current) campo.current.blur();
      return;
    }
    if (!mostrando || sugestoes.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => Math.min(i + 1, sugestoes.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      escolher(sugestoes[idx]);
    }
  };

  return (
    <div className="search" data-full={full ? "true" : "false"} ref={raiz}>
      <div className="search-field">
        <Search size={15} />
        <input
          ref={campo}
          id="busca-acervo"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setAberta(true); }}
          onFocus={() => { setAberta(true); setFull(true); }}
          onKeyDown={tecla}
          placeholder="Buscar"
          aria-label="Buscar na biblioteca"
          role="combobox"
          aria-expanded={mostrando ? "true" : "false"}
          aria-controls="busca-sugestoes"
          aria-autocomplete="list"
          aria-activedescendant={
            mostrando && sugestoes[idx] ? "sug-" + sugestoes[idx].chave : undefined
          }
        />
        <button className="search-cancel" onClick={fechar}>Cancelar</button>
      </div>

      {mostrando && (
        <div
          className="sug"
          id="busca-sugestoes"
          role="listbox"
          aria-label="Sugestões da busca"
          onMouseDown={(e) => e.preventDefault()}
        >
          {sugestoes.length === 0 ? (
            <p className="sug-empty">Nada encontrado para "{query.trim()}".</p>
          ) : (
            sugestoes.map((s, i) => (
              <React.Fragment key={s.chave}>
              {/* A heading wherever the kind changes, so a tab's results and
                  the HQs under them read as two lists (v73). */}
              {s.secao && (i === 0 || sugestoes[i - 1].secao !== s.secao) && (
                <p className="sug-secao" aria-hidden="true">{s.secao}</p>
              )}
              <button
                id={"sug-" + s.chave}
                className="sug-row"
                role="option"
                aria-selected={i === idx ? "true" : "false"}
                data-on={i === idx ? "true" : "false"}
                onMouseEnter={() => setIdx(i)}
                onClick={() => escolher(s)}
              >
                {s.tipo === "volume" ? (
                  <span className="cover sug-cover" style={{ "--edge": coverColors(s.volume, cores).edge }}>
                    <CoverArt volume={s.volume} />
                  </span>
                ) : (
                  <span className="sug-cover sug-icone">
                    {s.tipo === "colecao" ? <Layers size={15} /> : <Library size={15} />}
                  </span>
                )}
                <span className="sug-text">
                  <span className="sug-title truncate">{s.titulo}</span>
                  <span className="sug-meta truncate">{s.meta}</span>
                </span>
              </button>
              </React.Fragment>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, error, hint, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {error && <p className="field-error">{error}</p>}
      {hint && !error && <p className="field-hint">{hint}</p>}
    </div>
  );
}

function Sheet({ open, onClose, title, subtitle, actions, children, recede }) {
  const [mounted, shown] = useTransitionMount(open, 220);
  // While another sheet is stacked on top of this one, it recedes instead of
  // closing: no scrim of its own (the front sheet's scrim already dims the
  // page), no escape-to-close (that must reach the front sheet first), and no
  // pointer events (its controls sit under the front sheet visually, but
  // without this they would still be clickable through the gap).
  useEscape(mounted && !recede, onClose);
  if (!mounted) return null;
  return (
    <>
      {!recede && <div className="scrim" data-in={shown ? "true" : "false"} onClick={onClose} />}
      <div
        className="sheet"
        data-in={shown ? "true" : "false"}
        data-out={shown ? "false" : "true"}
        data-behind={recede ? "true" : "false"}
        role="dialog"
        aria-modal="true"
        // pointer-events:none (in CSS) keeps the mouse out, but a receded
        // sheet's inputs and buttons would still be reachable by Tab and
        // still announced to screen readers without this: inert removes it
        // from both the focus order and the accessibility tree. React 18
        // does not treat `inert` as boolean (a bare `true` renders nothing,
        // silently, with only a dev warning) — it wants the empty string.
        inert={recede ? "" : undefined}
      >
        <div className="sheet-grab"><i /></div>
        <div className="sheet-head">
          <div style={{ minWidth: 0 }}>
            <p className="t-display" style={{ margin: 0 }}>{title}</p>
            {subtitle && <p className="t-small muted" style={{ margin: "3px 0 0" }}>{subtitle}</p>}
          </div>
          <div className="sheet-actions">
            {actions}
            <button className="btn-icon" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>
  );
}

function Modal({ open, onClose, title, children, footer }) {
  const [mounted, shown] = useTransitionMount(open, 220);
  useEscape(mounted, onClose);
  if (!mounted) return null;
  return (
    <>
      <div className="scrim" data-in={shown ? "true" : "false"} onClick={onClose} />
      <div className="modal-wrap">
        <div className="modal" data-in={shown ? "true" : "false"} data-out={shown ? "false" : "true"} role="dialog" aria-modal="true">
          <div className="modal-head">
            <p className="t-display" style={{ margin: 0 }}>{title}</p>
            <button className="btn-icon" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-foot">{footer}</div>}
        </div>
      </div>
    </>
  );
}

// The character is a real thing in this app, not just a field: it groups both
// tabs. So its heading is where its colour is set. onAlternar is what makes
// the group collapsible; both tabs pass it now, each with its own fold state
// (see lerGruposAbertos/lerGruposFechados below) and its own default.
function GroupHead({ personagem, count, onPickColor, aberto, onAlternar, itemLabel = "séries" }) {
  const cores = useCores();
  const spec = specForCharacter(personagem, cores);
  const guardado = cores && cores[(personagem || "").trim().toLowerCase()];
  const custom = guardado !== undefined && guardado !== null;
  const cor = swatchColors(spec, 0).edge;
  return (
    <div className="group-head" style={{ "--grp-cor": cor }}>
      <button className="group-name press" onClick={() => onPickColor(personagem)} title="Escolher a cor deste personagem">
        <span className="group-swatch" style={{ background: cor }} data-custom={custom ? "true" : "false"} />
        <h2>{personagem}</h2>
      </button>
      <span className="group-count">{count}</span>
      {onAlternar && (
        <button
          className="btn-icon group-fold"
          onClick={() => onAlternar(personagem)}
          aria-expanded={aberto ? "true" : "false"}
          aria-label={(aberto ? "Esconder" : "Mostrar") + " as " + itemLabel + " de " + personagem}
        >
          <ChevronDown size={16} data-rot={aberto ? "false" : "true"} />
        </button>
      )}
    </div>
  );
}

function Swatch({ spec, atual, onPick, personagem }) {
  const nome = nomeDaCor(spec);
  const longbox = !!spec.longbox;
  const c = swatchColors(spec, 0);
  const on = longbox ? !!(atual && atual.longbox) : !(atual && atual.longbox) && sameSpec(atual, spec);
  // The label lives on a wrapper: the swatch clips its own overflow (the cover
  // miniature) and already uses ::after for its edge stripe.
  return (
    <span className="dica dica-swatch" data-dica={nome}>
      <button
        className="swatch press"
        style={{ background: "linear-gradient(160deg," + c.a + "," + c.b + ")", "--edge": c.edge, color: c.ink }}
        data-on={on ? "true" : "false"}
        onClick={() => onPick(personagem, spec)}
        aria-label={nome}
      >
        {on && <Check size={14} />}
      </button>
    </span>
  );
}

function CorSheet({ personagem, cores, onPick, onClose }) {
  const bruto = personagem ? cores[personagem.trim().toLowerCase()] : undefined;
  const definido = bruto !== undefined && bruto !== null;
  const atual = typeof bruto === "number" ? { h: bruto } : bruto;

  return (
    <Sheet
      open={!!personagem}
      onClose={onClose}
      title={personagem || ""}
      subtitle="Cor deste personagem na estante"
    >
      <div className="swatches">
        {PALETA_CROMATICA.map((spec, i) => (
          <Swatch key={"c" + i} spec={spec} atual={atual} onPick={onPick} personagem={personagem} />
        ))}
      </div>

      <div>
        <p className="t-micro" style={{ margin: "0 0 8px" }}>Neutros</p>
        <div className="swatches">
          {PALETA_NEUTRA.map((spec, i) => (
            <Swatch key={"n" + i} spec={spec} atual={atual} onPick={onPick} personagem={personagem} />
          ))}
        </div>
      </div>

      <button
        className="btn btn-quiet"
        style={{ width: "100%" }}
        data-on={!definido ? "true" : "false"}
        onClick={() => onPick(personagem, null)}
      >
        {!definido ? "Usando cor automática" : "Voltar para a cor automática"}
      </button>
      <p className="t-small muted" style={{ margin: 0 }}>
        A cor vale para todos os volumes e séries deste personagem, e aparece na borda de
        cada capa, inclusive nas que você subir.
      </p>
    </Sheet>
  );
}

function EditoraLogo({ editora, size }) {
  if (!editora || !editora.logoAssetId) return null;
  return (
    <span className="ed-logo" data-plate={editora.logoFundo || "nenhum"}>
      <img src={"/_blob/" + editora.logoAssetId} alt={editora.nome} style={{ height: size || 37 }} />
    </span>
  );
}

// The HQs/Coleções/Séries pill: one shared thumb slid under whichever button
// is active, instead of each button painting its own background. A single
// element can carry an elastic gsap tween on tab switches; three independent
// buttons fading their own backgrounds in and out cannot read as one thing
// moving. Click-only, on purpose — the reference this was adapted from can
// also be grabbed and dragged between slots, but that meant reimplementing
// pointer capture, flick velocity and rubber-band clamping for a control that
// never needed anything but a tap.
function SegmentedTabs({ tabs, tab, onTab }) {
  const trackRef = useRef(null);
  const thumbRef = useRef(null);
  const btnRefs = useRef(new Map());
  const mounted = useRef(false);
  // The two edges gsap actually animates. A plain object, not a DOM node: the
  // clip-path string is repainted from these in onUpdate, so the tween never
  // touches width or left directly, which would put a layout reflow in every
  // frame of every switch. The reflow was one of two separate causes of the
  // jank here; the other, which outlived this change and only showed on the
  // far jumps, is written up at the tween itself below.
  const edgesRef = useRef({ left: 0, right: 0, top: 0, bottom: 0 });
  // The hover pill runs the identical clip-path mechanism on its own element
  // and its own pair of edges, one layer below the active pill, so a hover
  // that lands on the open tab simply disappears under it.
  const ghostRef = useRef(null);
  const ghostEdgesRef = useRef({ left: 0, right: 0, top: 0, bottom: 0 });
  const ghostAtivoRef = useRef(false);
  // Which button the pointer is over, or null. The resize handler reads it
  // too, having no other way to know where to put the hover pill back.
  const hoverRef = useRef(null);
  const larguraRef = useRef(0);

  function registrarBtn(key, el) {
    if (el) btnRefs.current.set(key, el); else btnRefs.current.delete(key);
  }

  function edgesDoBotao(key) {
    const track = trackRef.current;
    const btn = btnRefs.current.get(key);
    if (!track || !btn) return null;
    const t = track.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    return { left: b.left - t.left, right: b.right - t.left, top: b.top - t.top, bottom: b.bottom - t.top };
  }

  function edgesDoAtivo() { return edgesDoBotao(tab); }

  // Top and bottom used to be hardcoded to 0 — "no vertical clip" — so the pill
  // always spanned the track's full height, padding included, rather than the
  // button's own. Horizontally it hugged the button exactly (edges.left/right
  // come straight from the button's own rect), so the two only ever disagreed
  // on the vertical axis: the pill taller than the button by the track's own
  // padding, on both top and bottom. A :focus-visible ring sized to the real
  // button then reads as smaller than the pill and sitting inside it — exactly
  // backwards from the horizontal case this was first mistaken for, where the
  // ring was outline-offset pushing it outside the pill (see the CSS fix
  // above). Reported live 2026-09-20, caught only by testing against the real
  // published artifact, not the local harness: a local shim without the
  // project's own fonts loaded didn't reproduce it.
  function pintarEm(el, edges) {
    const track = trackRef.current;
    if (!el || !track) return;
    // getBoundingClientRect, not clientWidth/clientHeight: edges.* above are
    // themselves measured against the track's getBoundingClientRect (it has a
    // 1px border, so clientWidth/clientHeight — content+padding only — run
    // ~1-2px short of it on every side). Mixing the two metrics is exactly
    // what put the pill a couple of pixels short of the button's real edges,
    // on every side, until this was measured precisely against the live page
    // and caught. Same ruler for both halves of the subtraction now.
    const r = track.getBoundingClientRect();
    el.style.clipPath =
      "inset(" + Math.max(0, edges.top) + "px " + Math.max(0, r.width - edges.right) + "px " +
      Math.max(0, r.height - edges.bottom) + "px " + Math.max(0, edges.left) + "px round var(--r-sm))";
  }

  // v82: the active pill moves by transform only. A clip-path written from
  // JS every frame is a repaint every frame, and on a touch tablet (no cursor
  // lattice, so the tab content is not its own layer) each repaint walked the
  // whole tab: worst on Séries, about 9,000 elements, which is where the
  // stutter showed.
  // v83: two layers that only slide, one clipping the other. The window is as
  // wide as the track, rounded on its right and clipping what it holds, and
  // its right edge sits on the pill's right edge. Inside it the body, rounded
  // on its left, has its left edge on the pill's left edge. What shows is where
  // they overlap: exactly the pill, both ends rounded, nothing scaled. v82 used
  // a 1px middle scaled up instead, and on the user's machine Chrome drew that
  // 1px and then stretched the drawing, smearing its edges into a gap before
  // the right cap (it never showed in headless Chrome).
  const pecasRef = useRef(null);
  const geoRef = useRef({ largura: 0, dx: 0, dy: 0, top: null, alt: null });
  function medirPilula() {
    const el = thumbRef.current, track = trackRef.current;
    if (!el || !track) return;
    const t = track.getBoundingClientRect();
    const p = el.getBoundingClientRect();
    const g = geoRef.current;
    // The track's border widths: the pill element sits inside them.
    g.dx = p.left - t.left;
    g.dy = p.top - t.top;
    const janela = el.firstElementChild;
    const corpo = janela && janela.firstElementChild;
    if (!corpo) return;
    // As wide as the space inside the track, so any pill fits in the overlap.
    g.largura = p.width;
    janela.style.width = p.width + "px";
    corpo.style.width = p.width + "px";
    pecasRef.current = [janela, corpo];
  }
  function pintarClip() {
    const el = thumbRef.current, track = trackRef.current;
    if (!el || !track) return;
    if (!pecasRef.current) medirPilula();
    const g = geoRef.current;
    const e = edgesRef.current;
    const t = track.getBoundingClientRect();
    // The same box the old clip-path cut, to the pixel: its inset was taken
    // from the track's border box but applied inside the border, which leaves
    // the pill 1px inside the button on every side. That is the look the user
    // approved, so it is kept on purpose. Held inside the track, as the old
    // Math.max did.
    const l = Math.max(0, e.left);
    const r = t.width - 2 * g.dx - Math.max(0, t.width - e.right);
    const top = Math.max(0, e.top);
    const alt = Math.max(0, t.height - 2 * g.dy - Math.max(0, t.height - e.bottom) - top);
    // Vertical extent only changes on a resize, so it is written only then.
    if (top !== g.top || alt !== g.alt) {
      g.top = top; g.alt = alt;
      el.style.top = top + "px";
      el.style.height = alt + "px";
    }
    if (!pecasRef.current) return;
    const [janela, corpo] = pecasRef.current;
    const x = r - g.largura;
    janela.style.transform = "translate3d(" + x + "px,0,0)";
    corpo.style.transform = "translate3d(" + (l - x) + "px,0,0)";
  }
  function pintarGhost() { pintarEm(ghostRef.current, ghostEdgesRef.current); }

  // Lays the thumb under the active button with no animation: first paint,
  // and any resize that could leave it sized for a layout that no longer
  // exists (the band going from wide desktop labels to a narrower window).
  function posicionarSemAnimar() {
    const e = edgesDoAtivo();
    if (!e) return;
    medirPilula();
    gsap.killTweensOf(edgesRef.current);
    edgesRef.current.left = e.left;
    edgesRef.current.right = e.right;
    edgesRef.current.top = e.top;
    edgesRef.current.bottom = e.bottom;
    pintarClip();
  }

  useLayoutEffect(() => {
    posicionarSemAnimar();
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === "undefined") return undefined;
    larguraRef.current = track.clientWidth;
    const ro = new ResizeObserver(() => {
      const w = track.clientWidth;
      // Two guards, and the switch this component exists to animate trips
      // both. Opening a tab changes how tall the page is, so the scrollbar
      // appears or goes away, so the band gets re-measured — mid-tween, a
      // few frames after the click. The old handler snapped the pill to its
      // destination right there, killing the tween in flight: the pill set
      // off, stopped dead partway, and turned up already arrived.
      //
      // Same width means nothing about this pill's geometry moved, whatever
      // else on the page did, so there is nothing to correct.
      if (w === larguraRef.current) return;
      larguraRef.current = w;
      // A real width change mid-switch makes the tween's destination stale
      // rather than wrong to be playing: re-aim it, never cut it.
      if (gsap.isTweening(edgesRef.current)) { animarParaAtivo(); return; }
      posicionarSemAnimar();
      if (ghostAtivoRef.current) {
        const g = edgesDoBotao(hoverRef.current);
        if (g) {
          ghostEdgesRef.current.left = g.left; ghostEdgesRef.current.right = g.right;
          ghostEdgesRef.current.top = g.top; ghostEdgesRef.current.bottom = g.bottom;
          pintarGhost();
        }
      }
    });
    ro.observe(track);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs]);

  function animarParaAtivo() {
    const e = edgesDoAtivo();
    if (!e) return;
    if (prefersReducedMotion()) {
      edgesRef.current.left = e.left;
      edgesRef.current.right = e.right;
      edgesRef.current.top = e.top;
      edgesRef.current.bottom = e.bottom;
      pintarClip();
      return;
    }
    // Vertical extent never animates — every button in the row shares the same
    // height, so there is nothing to tween — only left/right travel.
    edgesRef.current.top = e.top;
    edgesRef.current.bottom = e.bottom;
    // Two tweens, not one: the edge leading the move runs ahead on a plain
    // ease-out while the edge behind it lags on the elastic, so the pill
    // stretches toward the tab being opened and its tail snaps up after.
    //
    // Which edge carries the elastic is the whole point, not a detail. On
    // the leading edge its overshoot runs past the destination button and,
    // for the two outer tabs, past the end of the track: measured against
    // this band's real geometry, HQs -> Séries overshot 26px beyond the
    // right wall and pintarClip's Math.max held it pinned there for 8 of
    // the tween's ~31 frames. That pin is what read as the animation
    // freezing mid-flight, and why only the far jumps showed it — the
    // adjacent ones overshoot into a neighbouring button, never a wall.
    // A trailing edge can only ever overshoot into the pill's own span, so
    // it stays inside the track by construction, at any distance.
    const paraDireita = e.left > edgesRef.current.left;
    const lider = paraDireita ? "right" : "left";
    const cauda = paraDireita ? "left" : "right";
    // Killed up front, so both tweens below can run with overwrite off:
    // overwrite: true would have the second one kill the first, they share
    // a target. A click landing mid-bounce still cuts everything short.
    gsap.killTweensOf(edgesRef.current);
    gsap.to(edgesRef.current, {
      [lider]: e[lider], duration: 0.34, ease: "power3.out", overwrite: false,
    });
    // Only this one repaints: it is the longer of the two, and pintarClip
    // reads both edges every time, so one callback per frame covers both.
    gsap.to(edgesRef.current, {
      // Amplitude 0.6, not the 1 this used before it moved off the leading
      // edge: with the bounce living in the trailing edge it shows up as the
      // pill's width wobbling rather than its position, and at full amplitude
      // the far jumps squeezed it to little over half its settled width.
      [cauda]: e[cauda], duration: 0.62, ease: "elastic.out(0.6, 0.65)",
      overwrite: false, onUpdate: pintarClip,
    });
  }

  useEffect(() => {
    // The very first render already landed the thumb via the layout effect
    // above; animating that same placement would play the elastic settle on
    // load, for a "change" nothing actually made.
    if (!mounted.current) { mounted.current = true; return; }
    animarParaAtivo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function entrarNoBotao(key) {
    const g = edgesDoBotao(key);
    if (!g) return;
    hoverRef.current = key;
    const ghost = ghostRef.current;
    if (!ghost) return;
    // Coming from nowhere, the pill has no position worth travelling from:
    // sliding in from wherever it was last left would read as an object
    // flying in from another tab the pointer never touched. It appears in
    // place and fades up; only a move BETWEEN buttons travels.
    if (!ghostAtivoRef.current || prefersReducedMotion()) {
      gsap.killTweensOf(ghostEdgesRef.current);
      ghostEdgesRef.current.left = g.left;
      ghostEdgesRef.current.right = g.right;
      ghostEdgesRef.current.top = g.top;
      ghostEdgesRef.current.bottom = g.bottom;
      pintarGhost();
      ghostAtivoRef.current = true;
      ghost.style.opacity = "1";
      return;
    }
    ghost.style.opacity = "1";
    // Plainly eased and quicker than the active pill's 0.62s: this one is
    // chasing a pointer that can already be somewhere else, so it has to
    // keep up, and a second bouncing pill next to the real one just reads
    // as noise. The travel is the whole signal here, not the settle.
    // Vertical extent is set immediately, not tweened, same reasoning as the
    // active pill: it never actually changes between buttons in this row.
    ghostEdgesRef.current.top = g.top;
    ghostEdgesRef.current.bottom = g.bottom;
    gsap.to(ghostEdgesRef.current, {
      left: g.left, right: g.right, duration: 0.26, ease: "power3.out",
      overwrite: true, onUpdate: pintarGhost,
    });
  }

  function sairDaFaixa() {
    hoverRef.current = null;
    ghostAtivoRef.current = false;
    const ghost = ghostRef.current;
    if (ghost) ghost.style.opacity = "0";
  }

  return (
    <div
      className="segmented ed-segmented"
      ref={trackRef}
      onPointerLeave={sairDaFaixa}
    >
      <span ref={ghostRef} className="seg-ghost" aria-hidden="true" />
      <span ref={thumbRef} className="seg-thumb" aria-hidden="true"><i className="pil-janela"><i className="pil-corpo" /></i></span>
      {tabs.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            ref={(el) => registrarBtn(t.key, el)}
            className="press"
            data-active={tab === t.key ? "true" : "false"}
            onClick={() => onTab(t.key)}
            // pointerenter, not mouseenter: a stylus hovering the tablet
            // reports as a pointer and should light the same preview.
            onPointerEnter={(ev) => { if (ev.pointerType !== "touch") entrarNoBotao(t.key); }}
          >
            <Icon size={14} /> {t.label}
          </button>
        );
      })}
    </div>
  );
}

function EditoraBar({
  editoras, selecionada, onSelect, onManage, buscando, tabs, tab, onTab, contagem, edCroma,
}) {
  const edHue = edCroma ? edCroma.h : null;
  const atual = editoras.find((e) => e.id === selecionada) || null;
  // "Todas as editoras" (and a stale id, which reads as Todas) wears the Longbox
  // cyan (v70), so the band is tinted on every view but "Sem editora".
  const todas = !atual && selecionada !== ED_SEM;
  const cor = atual && atual.cor ? swatchColors(atual.cor, 0)
    : todas ? swatchColors(COR_LONGBOX, 0) : null;
  // Each publisher carries its own colour in the list, as characters do theirs.
  const opcoesEditora = useMemo(() => [
    // The Longbox cyan, as a literal: inside the band --accent is the selected
    // publisher's hue, so the variable would paint "Todas" in someone else's colour.
    { valor: ED_TODAS, rotulo: "Todas as editoras", cor: ACCENT_HEX },
    ...editoras.map((e) => ({ valor: e.id, rotulo: e.nome, cor: e.cor ? swatchColors(e.cor, 0).edge : undefined })),
    { valor: ED_SEM, rotulo: "Sem editora" },
  ], [editoras]);
  const acaoGerenciar = useMemo(() => ({ rotulo: "Gerenciar editoras...", onClick: onManage }), [onManage]);
  const rotulo = selecionada === ED_TODAS ? "Todas as editoras"
    : selecionada === ED_SEM ? "Sem editora"
    : atual ? atual.nome : "Todas as editoras";

  return (
    <div
      className="ed-band"
      style={
        cor || edHue != null
          ? {
              ...(cor ? { "--ed-cor": cor.edge, "--ed-fundo": cor.b } : null),
              ...(edCroma == null
                ? null
                : {
                    "--ed-hue": edCroma.h,
                    "--ed-ink-escuro": edCroma.tintaEscuro,
                    "--ed-ink-claro": edCroma.tintaClaro,
                  }),
            }
          : undefined
      }
      data-tinted={cor ? "true" : "false"}
      data-ed-hue={edHue == null ? undefined : "true"}
    >
    <div className="ed-bar">
      <EditoraLogo editora={atual} />

      <SegmentedTabs tabs={tabs} tab={tab} onTab={onTab} />

      <div className="ed-right">
        {buscando ? (
          <span className="ed-note">Buscando em todo o acervo</span>
        ) : (
          <span className="num ed-note">{contagem}</span>
        )}
        <OpcaoFiltro
          id="filtro-editora"
          rotulo="Editora"
          className="ed-select"
          listaClassName="ed-lista"
          valor={selecionada}
          opcoes={opcoesEditora}
          onChange={onSelect}
          acao={acaoGerenciar}
        />
      </div>
    </div>
    </div>
  );
}

function EditorasSheet({ open, editoras, onClose, onChange, onLogo, canUpload, enviando }) {
  const [novo, setNovo] = useState("");
  const fileRefs = useRef({});

  return (
    <Sheet open={open} onClose={onClose} title="Editoras" subtitle="Nome, cor e logo de cada uma">
      {editoras.length === 0 && (
        <p className="t-small muted" style={{ margin: 0 }}>
          Nenhuma editora ainda. Elas aparecem sozinhas conforme você preenche o campo
          Editora nos volumes e séries, ou adicione uma abaixo.
        </p>
      )}

      {editoras.map((ed) => (
        <div className="ed-card" key={ed.id}>
          <div className="ed-card-top">
            <input
              className="input"
              value={ed.nome}
              onChange={(e) => onChange(ed.id, { nome: e.target.value })}
              aria-label="Nome da editora"
            />
            <button
              className="btn-icon"
              onClick={() => onChange(ed.id, { customOculta: !ed.customOculta })}
              aria-expanded={ed.customOculta ? "false" : "true"}
              aria-label={(ed.customOculta ? "Mostrar" : "Ocultar") + " personalização de " + ed.nome}
            >
              <ChevronDown size={16} data-rot={ed.customOculta ? "true" : "false"} />
            </button>
            <button
              className="btn-icon"
              onClick={() => onChange(ed.id, null)}
              aria-label={"Remover " + ed.nome}
            >
              <Trash2 size={16} color="var(--danger-text)" />
            </button>
          </div>

          <div className="ed-card-logo">
            {ed.logoAssetId
              ? <EditoraLogo editora={ed} size={34} />
              : <span className="t-small muted">Sem logo</span>}
            {canUpload && (
              <>
                <button className="btn btn-quiet" disabled={enviando} onClick={() => fileRefs.current[ed.id] && fileRefs.current[ed.id].click()}>
                  <ImagePlus size={13} /> {ed.logoAssetId ? "Trocar" : "Enviar logo"}
                </button>
                <input
                  ref={(el) => { fileRefs.current[ed.id] = el; }}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                  hidden
                  onChange={(e) => { onLogo(ed.id, e.target.files[0]); e.target.value = ""; }}
                />
              </>
            )}
          </div>

          {!ed.customOculta && ed.logoAssetId && (
            <div className="seg3">
              {[["nenhum", "Sem fundo"], ["escuro", "Fundo escuro"], ["claro", "Fundo claro"]].map(([v, l]) => (
                <button key={v} data-on={(ed.logoFundo || "nenhum") === v ? "true" : "false"} onClick={() => onChange(ed.id, { logoFundo: v })}>
                  {l}
                </button>
              ))}
            </div>
          )}

          {!ed.customOculta && (
            <div>
              <p className="t-micro" style={{ margin: "0 0 8px" }}>Cor</p>
              <div className="swatches">
                {PALETA_CROMATICA.concat(PALETA_NEUTRA).map((spec, i) => (
                  <Swatch
                    key={i}
                    spec={spec}
                    atual={ed.cor}
                    personagem={ed.id}
                    onPick={(id, s) => onChange(id, { cor: s })}
                  />
                ))}
              </div>
              {ed.cor && (
                <button className="btn btn-quiet" style={{ width: "100%", marginTop: 8 }} onClick={() => onChange(ed.id, { cor: null })}>
                  Remover a cor
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      <div className="row">
        <input
          className="input"
          placeholder="Nova editora"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && novo.trim()) { onChange(null, { nome: novo.trim() }); setNovo(""); } }}
        />
        <button
          className="btn btn-primary"
          onClick={() => { if (novo.trim()) { onChange(null, { nome: novo.trim() }); setNovo(""); } }}
        >
          <Plus size={14} /> Adicionar
        </button>
      </div>

      <p className="t-small muted" style={{ margin: 0 }}>
        Remover uma editora daqui não apaga nenhum volume nem série. Só tira a entrada do
        seletor. O nome precisa bater com o que está escrito no campo Editora dos seus itens.
      </p>
    </Sheet>
  );
}

function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="empty">
      <Icon size={26} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

// Three skeletons, because the three layout families do not look alike and a
// skeleton that describes the wrong one is worse than none: it promises a screen
// that never arrives. Each one is shaped like the tab it stands in for.
// HQs (v68): the fold-all control, then covers grouped under character bands,
// the shape the tab has had since v57, not the one flat grid it had before.
function ShelfSkeleton() {
  return (
    <div className="skel-wrap skel-hqs" aria-hidden="true">
      <div className="fold-all"><div className="skel-line" data-w="fold" /></div>
      {[7, 4].map((n, g) => (
        <div className="group" key={g}>
          <div className="skel-head"><div className="skel-line" data-w="name" /></div>
          <div className="shelf">
            {Array.from({ length: n }).map((_, i) => (
              <div key={i}>
                <div className="skel" />
                <div className="skel-line" />
                <div className="skel-line" data-w="short" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Séries: a character band over cards, each card a name, a meta line and a run
// bar. It borrows the real row's own class so the padding and border match
// exactly rather than being guessed at.
// Séries (v68): the tab opens with every character folded, so its skeleton is
// the fold-all control over a column of closed bands, and no rows.
function SeriesSkeleton() {
  return (
    <div className="skel-wrap skel-series" aria-hidden="true">
      <div className="fold-all"><div className="skel-line" data-w="fold" /></div>
      {[0.2, 0.14, 0.24, 0.12, 0.18].map((w, g) => (
        <div className="group" key={g}>
          <div className="skel-head"><div className="skel-line" data-w="name" style={{ width: w * 100 + "%" }} /></div>
        </div>
      ))}
    </div>
  );
}

// Coleções: a title over a horizontal strip of covers, one strip per collection.
function ColecoesSkeleton() {
  return (
    <div className="skel-wrap skel-colecoes" aria-hidden="true">
      <div className="fold-all"><div className="skel-line" data-w="fold" /></div>
      {[3, 2].map((n, g) => (
        <div className="coll" key={g}>
          <div className="coll-head">
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="skel-line" data-w="name" />
              <div className="skel-line" data-w="micro" />
            </div>
            <div className="skel-line" data-w="acao" />
          </div>
          <div className="coll-strip">
            {Array.from({ length: n }).map((_, i) => (
              <div key={i}>
                <div className="skel" />
                <div className="skel-line" />
                <div className="skel-line" data-w="short" />
              </div>
            ))}
          </div>
          {/* Only a collection too long for the row gets the spine bar. */}
          {g === 0 && <div className="skel-spines" />}
        </div>
      ))}
    </div>
  );
}

// The scrollbar under a collection's strip. The native bar is hidden; this one
// is a row of short spines at the logo's rhythm, filling the whole width so a
// small collection does not get a short bar. The spines mean nothing on their
// own: only the lit window over them does, and that is what you drag. The count
// beside it pads to the total's own digit count, so the row does not change
// width when the range crosses from 9 to 10.
const SHELF_SPINE_H = [20, 24, 18, 26, 22, 19, 25, 21, 23, 17, 26, 20, 24, 22];

function ShelfBar({ stripRef, total }) {
  const rowRef = useRef(null);
  const trackRef = useRef(null);
  const winRef = useRef(null);
  const innerRef = useRef(null);
  const countRef = useRef(null);
  const grabRef = useRef(null);
  const spanRef = useRef([0, 0]);
  const [ticks, setTicks] = useState(0);
  const digits = String(total).length;
  const fmt = (k) => String(k).padStart(digits, "0");

  useLayoutEffect(() => {
    const strip = stripRef.current;
    const track = trackRef.current;
    if (!strip || !track) return;
    let raf = 0;
    const paint = () => {
      raf = 0;
      // Unrounded: clientWidth rounds, and the lit copy of the spines then spaces
      // itself a fraction of a pixel off the row it sits on.
      const tw = track.getBoundingClientRect().width;
      // 5px spine plus 6px gap, the same step as the mockup the user approved.
      setTicks(Math.max(2, Math.floor((tw + 6) / 11)));
      const max = strip.scrollWidth - strip.clientWidth;
      rowRef.current.hidden = max <= 1;
      if (max <= 1) return;
      const w = Math.max(28, (tw * strip.clientWidth) / strip.scrollWidth);
      const p = Math.min(1, Math.max(0, strip.scrollLeft / max));
      const l = p * (tw - w);
      spanRef.current = [l, l + w];
      winRef.current.style.width = w + "px";
      winRef.current.style.transform = "translateX(" + l + "px)";
      innerRef.current.style.width = tw + "px";
      innerRef.current.style.transform = "translateX(" + -l + "px)";
      track.setAttribute("aria-valuenow", String(Math.round(p * 100)));
      // A cover counts as on screen once at least half of it is.
      const r = strip.getBoundingClientRect();
      let first = -1, last = -1;
      Array.from(strip.children).forEach((el, i) => {
        const c = el.getBoundingClientRect();
        if (Math.min(c.right, r.right) - Math.max(c.left, r.left) >= c.width / 2) {
          if (first < 0) first = i;
          last = i;
        }
      });
      if (first >= 0) countRef.current.textContent = fmt(first + 1) + " a " + fmt(last + 1);
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(paint); };
    paint();
    strip.addEventListener("scroll", queue, { passive: true });
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(queue) : null;
    if (ro) { ro.observe(strip); ro.observe(track); }
    return () => {
      strip.removeEventListener("scroll", queue);
      if (ro) ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [stripRef, total]);

  useEffect(() => {
    // The drag must end even when released outside the track or the window.
    const end = () => {
      if (grabRef.current == null) return;
      grabRef.current = null;
      if (trackRef.current) delete trackRef.current.dataset.drag;
      if (stripRef.current) delete stripRef.current.dataset.dragging;
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", end);
    };
  }, [stripRef]);

  const scrollFor = (left) => {
    const strip = stripRef.current;
    const [a, b] = spanRef.current;
    const room = trackRef.current.getBoundingClientRect().width - (b - a);
    const p = room > 0 ? Math.min(1, Math.max(0, left / room)) : 0;
    return p * (strip.scrollWidth - strip.clientWidth);
  };
  const xOf = (e) => e.clientX - trackRef.current.getBoundingClientRect().left;
  const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const onPointerDown = (e) => {
    const strip = stripRef.current;
    const bx = xOf(e);
    const [a, b] = spanRef.current;
    if (bx >= a && bx <= b) {
      grabRef.current = bx - a;
    } else {
      grabRef.current = (b - a) / 2;
      strip.scrollTo({ left: scrollFor(bx - grabRef.current), behavior: reduced() ? "auto" : "smooth" });
    }
    trackRef.current.setPointerCapture?.(e.pointerId);
    trackRef.current.dataset.drag = "";
    strip.dataset.dragging = "";
  };
  const onPointerMove = (e) => {
    if (grabRef.current == null) return;
    stripRef.current.scrollTo({ left: scrollFor(xOf(e) - grabRef.current), behavior: "auto" });
  };
  const onKeyDown = (e) => {
    const strip = stripRef.current;
    const step = strip.clientWidth * 0.8;
    const behavior = reduced() ? "auto" : "smooth";
    if (e.key === "ArrowRight") { strip.scrollBy({ left: step, behavior }); e.preventDefault(); }
    if (e.key === "ArrowLeft") { strip.scrollBy({ left: -step, behavior }); e.preventDefault(); }
  };

  const spines = Array.from({ length: ticks }, (_, i) => (
    <i key={i} style={{ height: SHELF_SPINE_H[(i * 5 + (i >> 2)) % SHELF_SPINE_H.length] }} />
  ));

  return (
    <div className="shelf-bar" ref={rowRef}>
      <div
        className="shelf-track"
        ref={trackRef}
        role="scrollbar"
        aria-orientation="horizontal"
        aria-label="Posição na coleção"
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
      >
        <div className="shelf-spines">{spines}</div>
        <div className="shelf-window" ref={winRef}>
          <div className="shelf-spines" ref={innerRef}>{spines}</div>
        </div>
      </div>
      <span className="shelf-count"><b ref={countRef} /> de {total}</span>
    </div>
  );
}

// One tab's content, kept mounted while hidden (v80). A hidden tab skips its
// renders entirely: its content is a function that is only called when the tab
// renders, and the memo holds while it stays hidden. Showing it again renders it
// once with the current state, against the DOM it already has.
// v81: the render that hides it reuses the last drawing too. Handing React the
// very same elements makes it skip the whole subtree; before, leaving the séries
// tab redrew all of its rows just to hide them.
const Aba = React.memo(
  function Aba({ ativa, render }) {
    const ultimo = useRef(null);
    if (ativa || ultimo.current === null) ultimo.current = render();
    return (
      <div className="aba" data-ativa={ativa ? "true" : "false"} inert={ativa ? undefined : ""} aria-hidden={ativa ? undefined : "true"}>
        {ultimo.current}
      </div>
    );
  },
  (antes, depois) => !antes.ativa && !depois.ativa
);

// One collection's strip with its bar. Its own component so the strip's ref has
// a stable owner per collection.
function ShelfStrip({ total, cor, children }) {
  const stripRef = useRef(null);
  // A collection's own bar colour (v66), from the character palette; without
  // one the lit spines follow the publisher, as before.
  const estilo = cor
    ? { "--shelf-cor": cor.longbox ? "var(--accent)" : swatchColors(cor, 0).edge }
    : undefined;
  return (
    <div className="shelf-wrap" style={estilo}>
      <div className="coll-strip" ref={stripRef}>{children}</div>
      <ShelfBar stripRef={stripRef} total={total} />
    </div>
  );
}

// The hub: the suggestion card, the hunt rows under it, and the three figures at
// the foot. The backdrop is left out, since it is built from covers that have not
// loaded yet and would only flash in.
function HubSkeleton() {
  return (
    <div className="hub skel-hub skel-wrap" aria-hidden="true">
      <section className="suggest">
        <div className="suggest-cover"><div className="skel" /></div>
        <div className="suggest-body">
          <div className="skel-line" data-w="micro" />
          <div className="skel-line" data-w="title" />
          <div className="skel-line" data-w="short" />
        </div>
      </section>
      <section>
        <div className="hub-section-head"><div className="skel-line" data-w="head" /></div>
        <div className="prog">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i}>
              <div className="skel-line" data-w="row" />
              <div className="skel-run" />
            </div>
          ))}
        </div>
      </section>
      <div className="hub-foot">
        <div className="hub-figures">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="skel-line" data-w="figure" />
              <div className="skel-line" data-w="short" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// One row of the séries tab (v81). Memoised, so coming back to the tab redraws
// only the rows whose série, issues or ownership changed, not all of them with
// their run bars (about 4,000 segments across the real library).
const SEM_EDICOES = [];
const SerieLinha = React.memo(function SerieLinha({ serie: s, faixa, eds, ownedIds, aberta, onAbrir }) {
  const owned = useMemo(() => eds.filter((e) => ownedIds.has(e.id)).length, [eds, ownedIds]);
  const temFaixa = faixa.de !== null || faixa.ate !== null;
  return (
    <button
      className="serie-row"
      data-open={aberta ? "true" : "false"}
      onClick={() => onAbrir(s, faixa)}
    >
      <div className="serie-top">
        <span className="t-title truncate">{s.nome}</span>
        <span className="num t-small muted" style={{ flexShrink: 0 }}>
          {owned}/{s.totalEdicoes || eds.length}
        </span>
      </div>
      <div className="serie-meta truncate">
        {anoRange(s)}
        {s.editora ? " · " + s.editora : ""}
        {temFaixa ? " (edições " + (faixa.de ?? "?") + "-" + (faixa.ate ?? "?") + ")" : ""}
      </div>
      <RunBar edicoes={eds} ownedIds={ownedIds} />
    </button>
  );
});

function RunBar({ edicoes, ownedIds }) {
  const segments = useMemo(() => {
    const sorted = edicoes.slice().sort((a, b) => (sortKey(a) ?? 1e9) - (sortKey(b) ?? 1e9));
    const max = 60;
    if (sorted.length <= max) {
      return sorted.map((e) => (ownedIds.has(e.id) ? 1 : 0));
    }
    const per = sorted.length / max;
    const out = [];
    for (let i = 0; i < max; i++) {
      const slice = sorted.slice(Math.floor(i * per), Math.floor((i + 1) * per));
      if (!slice.length) { out.push(0); continue; }
      const owned = slice.filter((e) => ownedIds.has(e.id)).length;
      out.push(owned / slice.length >= 0.5 ? 1 : 0);
    }
    return out;
  }, [edicoes, ownedIds]);

  if (!segments.length) return null;
  return (
    <div className="run" aria-hidden="true">
      {segments.map((s, i) => <i key={i} data-owned={s ? "true" : "false"} />)}
    </div>
  );
}

// The hub's own bar, continuous rather than bucketed: the hunt is three series
// at a time, so there is room to read an exact percentage instead of the
// coarse blocks the séries tab needs for runs of hundreds of issues.
function HuntProgress({ owned, total }) {
  const pct = total > 0 ? Math.min(100, (owned / total) * 100) : 0;
  const fracao = pct / 100;
  const tier = fracao < QUASE_MORNO ? "baixo" : fracao < QUASE_PRONTO ? "medio" : "alto";
  return (
    <div className="prog-bar" aria-hidden="true">
      {/* transform, not width: width is a layout property and would thrash on animate */}
      <i style={{ transform: "scaleX(" + fracao + ")" }} data-tier={tier} />
    </div>
  );
}

/* ============================ app ============================ */

// Which tab the app opens on. The note is kept in sessionStorage, not
// localStorage, and the difference is the whole feature: sessionStorage belongs
// to the browser tab, so reloading the page keeps you where you were, and closing
// the tab throws the note away so the next visit lands on the hub. The hub stays
// the front door; this only stops a reload from being one.
const ABA_KEY = "longbox:aba";
const ABAS = ["hub", "volumes", "colecoes", "series"];

function lerAbaSalva() {
  try {
    if (typeof window === "undefined") return "hub";
    const salva = window.sessionStorage.getItem(ABA_KEY);
    return ABAS.indexOf(salva) === -1 ? "hub" : salva;
  } catch {
    // A private window can refuse storage outright. Landing on the hub is the
    // behaviour this app had for its whole life, so it is a safe floor.
    return "hub";
  }
}

function salvarAba(key) {
  try {
    if (typeof window !== "undefined") window.sessionStorage.setItem(ABA_KEY, key);
  } catch {
    // Nothing to do: the tab simply will not be remembered here.
  }
}

// Which character groups are open on the séries tab. Same storage and the same
// reasoning as the tab above, deliberately: a reload keeps what you had open,
// and a fresh visit starts closed again. Closed is the default because the tab
// is a reference list rather than something to read top to bottom, and with a
// real library it opens several thousand pixels long.
//
// It stores the names that are OPEN, so a character cataloguing brings in later
// is closed like all the rest without needing to be listed anywhere.
const GRUPOS_KEY = "longbox:series-abertas";

function lerGruposAbertos() {
  try {
    if (typeof window === "undefined") return new Set();
    const salvo = window.sessionStorage.getItem(GRUPOS_KEY);
    if (!salvo) return new Set();
    const lista = JSON.parse(salvo);
    // Anything but an array of strings is somebody else's data or a half-written
    // value; starting closed is the same floor the tab note falls back to.
    return Array.isArray(lista) ? new Set(lista.filter((x) => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function salvarGruposAbertos(abertos) {
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(GRUPOS_KEY, JSON.stringify([...abertos]));
    }
  } catch {
    // Same as the tab: not remembered here, and nothing else breaks.
  }
}

// Which character groups are folded on the HQs tab. Same storage shape and
// the same per-session lifetime as the séries tab above, but the default is
// reversed: the shelf is what you came here to look at, so it opens fully
// the first time and only remembers what you deliberately closed.
//
// It stores the names that are CLOSED (the opposite of the séries key), so a
// character cataloguing brings in later opens like all the rest without
// needing to be listed anywhere — the empty set, on a first visit, means
// nothing is closed rather than nothing is open.
const GRUPOS_FECHADOS_KEY = "longbox:hqs-fechadas";

function lerGruposFechados() {
  try {
    if (typeof window === "undefined") return new Set();
    const salvo = window.sessionStorage.getItem(GRUPOS_FECHADOS_KEY);
    if (!salvo) return new Set();
    const lista = JSON.parse(salvo);
    return Array.isArray(lista) ? new Set(lista.filter((x) => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function salvarGruposFechados(fechados) {
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(GRUPOS_FECHADOS_KEY, JSON.stringify([...fechados]));
    }
  } catch {
    // Same as the séries key: not remembered here, and nothing else breaks.
  }
}

// Which collections are folded to their title on the Coleções tab (v68). The
// HQs tab's rule exactly: a fresh visit opens everything, a reload keeps what
// you closed. Stores the CLOSED ids, so the empty set means all open.
const COLECOES_FECHADAS_KEY = "longbox:colecoes-fechadas";

function lerColecoesFechadas() {
  try {
    if (typeof window === "undefined") return new Set();
    const salvo = window.sessionStorage.getItem(COLECOES_FECHADAS_KEY);
    if (!salvo) return new Set();
    const lista = JSON.parse(salvo);
    return Array.isArray(lista) ? new Set(lista.filter((x) => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function salvarColecoesFechadas(ids) {
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(COLECOES_FECHADAS_KEY, JSON.stringify([...ids]));
    }
  } catch {
    // Not remembered here, and nothing else breaks.
  }
}

// Which collections have their reading order folded in the manage sheet (v66).
// Same lifetime as the fold keys above: a reload keeps it, a fresh visit opens
// every list again. Stores the ids that are FOLDED, so a new collection opens.
const ORDEM_RECOLHIDA_KEY = "longbox:ordem-recolhida";

function lerOrdemRecolhida() {
  try {
    if (typeof window === "undefined") return new Set();
    const salvo = window.sessionStorage.getItem(ORDEM_RECOLHIDA_KEY);
    if (!salvo) return new Set();
    const lista = JSON.parse(salvo);
    return Array.isArray(lista) ? new Set(lista.filter((x) => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function salvarOrdemRecolhida(ids) {
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(ORDEM_RECOLHIDA_KEY, JSON.stringify([...ids]));
    }
  } catch {
    // Not remembered here, and nothing else breaks.
  }
}

// The HQs tab's filters (status, tipo, personagem). Same lifetime as everything
// above: a reload keeps them, a fresh visit starts with none. Switching tabs never
// touched them, since they live in the app's own state; only a reload lost them.
// The publisher band is not here on purpose: it is saved in the database, so it
// also survives a fresh visit and follows the user between devices.
const FILTROS_KEY = "longbox:filtros-hqs";
const FILTROS_VAZIOS = { status: "", tipo: "", personagem: "" };

function lerFiltros() {
  try {
    if (typeof window === "undefined") return FILTROS_VAZIOS;
    const salvo = window.sessionStorage.getItem(FILTROS_KEY);
    if (!salvo) return FILTROS_VAZIOS;
    const f = JSON.parse(salvo) || {};
    return {
      // A value the app no longer offers falls back to "all", not to a filter
      // that can never match anything.
      status: STATUS_ORDER.includes(f.status) ? f.status : "",
      tipo: TIPOS.includes(TIPOS_RENOMEADOS[f.tipo] || f.tipo) ? (TIPOS_RENOMEADOS[f.tipo] || f.tipo) : "",
      personagem: typeof f.personagem === "string" ? f.personagem : "",
    };
  } catch {
    return FILTROS_VAZIOS;
  }
}

function salvarFiltros(f) {
  try {
    if (typeof window === "undefined") return;
    if (!f.status && !f.tipo && !f.personagem) window.sessionStorage.removeItem(FILTROS_KEY);
    else window.sessionStorage.setItem(FILTROS_KEY, JSON.stringify(f));
  } catch {
    // Not remembered here, and the filters still work for this page load.
  }
}

// Accent- and case-blind, so "robin" finds "Róbin" and "asa" finds "Asa Noturna".
function dobrar(s) {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const OPCOES_STATUS = STATUS_ORDER.map((k) => ({ valor: k, rotulo: STATUS[k].label }));
const OPCOES_TIPO = TIPOS.map((t) => ({ valor: t, rotulo: t }));

/* Status and tipo on the HQs tab: the character filter's look without its typing,
   since three statuses and eight types need no search. A native select was used
   before, but its open list is drawn by the operating system (white, blue
   highlight) and no stylesheet reaches it, so it could not match. Keyboard follows
   the ARIA select-only combobox: arrows, Enter or Space to open and pick, Escape. */
function OpcaoFiltro({ id, valor, todos, opcoes, onChange, rotulo, acao, className = "", listaClassName = "" }) {
  const [aberta, setAberta] = useState(false);
  const [idx, setIdx] = useState(0);
  const raiz = useRef(null);
  // `todos` adds the "no filter" row with the empty value; the publisher band
  // passes its own "Todas" in `opcoes` instead, since its value is not empty.
  // `acao` is a command row after a rule (Gerenciar editoras), not a value.
  const lista = useMemo(() => {
    const base = todos != null ? [{ valor: "", rotulo: todos }, ...opcoes] : opcoes;
    return acao ? [...base, { valor: "__acao__", rotulo: acao.rotulo, acao: true }] : base;
  }, [todos, opcoes, acao]);
  const atual = lista.find((o) => o.valor === valor) || lista[0];
  const comCor = opcoes.some((o) => o.cor);

  const fechar = useCallback(() => setAberta(false), []);
  useEffect(() => {
    if (!aberta) return;
    const fora = (e) => { if (raiz.current && !raiz.current.contains(e.target)) fechar(); };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberta, fechar]);

  const abrir = () => {
    const i = lista.findIndex((o) => o.valor === valor);
    setIdx(i < 0 ? 0 : i);
    setAberta(true);
  };
  const escolher = (o) => {
    fechar();
    if (!o) return;
    if (o.acao) acao.onClick();
    else onChange(o.valor);
  };

  const tecla = (e) => {
    if (e.key === "Escape") { if (aberta) { e.preventDefault(); fechar(); } return; }
    if (!aberta) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, lista.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); escolher(lista[idx]); }
    else if (e.key === "Tab") fechar();
  };

  const optId = (i) => id + "-op-" + i;

  return (
    <div className="pfiltro" ref={raiz}>
      <button
        type="button"
        id={id}
        className={"select pfiltro-input pfiltro-botao " + className}
        data-on={valor ? "true" : "false"}
        onClick={() => (aberta ? fechar() : abrir())}
        onKeyDown={tecla}
        role="combobox"
        aria-label={rotulo}
        aria-haspopup="listbox"
        aria-expanded={aberta ? "true" : "false"}
        aria-controls={id + "-lista"}
        aria-activedescendant={aberta ? optId(idx) : undefined}
      >
        <span className="truncate">{atual.rotulo}</span>
      </button>
      {aberta && (
        <div
          className={"sug pfiltro-lista " + listaClassName}
          id={id + "-lista"}
          role="listbox"
          aria-label={rotulo}
          onMouseDown={(e) => e.preventDefault()}
        >
          {lista.map((o, i) => (
            <React.Fragment key={o.valor || "__todos"}>
              {o.acao && <div className="pfiltro-sep" role="separator" />}
              <button
                id={optId(i)}
                type="button"
                tabIndex={-1}
                className={"sug-row pfiltro-row" + (o.acao ? " pfiltro-acao" : "")}
                role="option"
                aria-selected={!o.acao && o.valor === valor ? "true" : "false"}
                data-on={i === idx ? "true" : "false"}
                onMouseEnter={() => setIdx(i)}
                onClick={() => escolher(o)}
              >
                {comCor && !o.acao && (o.cor
                  ? <span className="group-swatch" style={{ background: o.cor }} />
                  : <span className="pfiltro-todos" aria-hidden="true" />)}
                <span className="sug-title truncate">{o.rotulo}</span>
                {!o.acao && o.valor === valor && <Check size={14} className="pfiltro-check" />}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

/* The character filter on the HQs tab: a field you can type into that narrows a
   list, with "Todos os personagens" always first. Closed, it shows the choice;
   open, it is a search over the choices. Keys and outside-click follow SearchBox. */
function PersonagemFiltro({ valor, opcoes, onChange }) {
  const [aberta, setAberta] = useState(false);
  const [texto, setTexto] = useState("");
  const [idx, setIdx] = useState(0);
  const raiz = useRef(null);
  const campo = useRef(null);
  const cores = useCores();

  const lista = useMemo(() => {
    const q = dobrar(texto.trim());
    const achados = q ? opcoes.filter((o) => dobrar(o.nome).includes(q)) : opcoes;
    return q ? achados : [{ nome: "", n: null }, ...achados];
  }, [texto, opcoes]);

  const fechar = useCallback(() => { setAberta(false); setTexto(""); }, []);

  useEffect(() => {
    if (!aberta) return;
    const fora = (e) => { if (raiz.current && !raiz.current.contains(e.target)) fechar(); };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberta, fechar]);

  const abrir = () => {
    setAberta(true);
    // Land on the current choice, so Enter right away changes nothing.
    const i = [{ nome: "" }, ...opcoes].findIndex((o) => o.nome === valor);
    setIdx(i < 0 ? 0 : i);
  };

  const escolher = (o) => {
    if (!o) return;
    onChange(o.nome);
    fechar();
    if (campo.current) campo.current.blur();
  };

  const tecla = (e) => {
    if (e.key === "Escape") {
      fechar();
      if (campo.current) campo.current.blur();
      return;
    }
    if (!aberta) {
      if (e.key === "ArrowDown" || e.key === "Enter") { e.preventDefault(); abrir(); }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => Math.min(i + 1, lista.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      escolher(lista[idx]);
    }
  };

  const optId = (o) => "pf-" + (o.nome ? dobrar(o.nome).replace(/[^a-z0-9]+/g, "-") : "todos");

  return (
    <div className="pfiltro" ref={raiz}>
      <input
        ref={campo}
        id="filtro-personagem"
        className="select pfiltro-input"
        data-on={valor ? "true" : "false"}
        value={aberta ? texto : valor}
        onChange={(e) => { setTexto(e.target.value); setIdx(0); setAberta(true); }}
        onFocus={abrir}
        onClick={() => { if (!aberta) abrir(); }}
        onKeyDown={tecla}
        placeholder={aberta && valor ? valor : "Todos os personagens"}
        aria-label="Filtrar por personagem"
        role="combobox"
        aria-expanded={aberta ? "true" : "false"}
        aria-controls="filtro-personagem-lista"
        aria-autocomplete="list"
        aria-activedescendant={aberta && lista[idx] ? optId(lista[idx]) : undefined}
        autoComplete="off"
        spellCheck={false}
      />
      {aberta && (
        <div
          className="sug pfiltro-lista"
          id="filtro-personagem-lista"
          role="listbox"
          aria-label="Personagens"
          onMouseDown={(e) => e.preventDefault()}
        >
          {lista.length === 0 ? (
            <p className="sug-empty">Nenhum personagem com "{texto.trim()}".</p>
          ) : (
            lista.map((o, i) => (
              <button
                key={o.nome || "__todos"}
                id={optId(o)}
                type="button"
                className="sug-row pfiltro-row"
                role="option"
                aria-selected={o.nome === valor ? "true" : "false"}
                data-on={i === idx ? "true" : "false"}
                onMouseEnter={() => setIdx(i)}
                onClick={() => escolher(o)}
              >
                {o.nome ? (
                  <span className="group-swatch" style={{ background: swatchColors(specForCharacter(o.nome, cores), 0).edge }} />
                ) : (
                  <span className="pfiltro-todos" aria-hidden="true" />
                )}
                <span className="sug-title truncate">{o.nome || "Todos os personagens"}</span>
                {o.n != null && <span className="pfiltro-n">{o.n}</span>}
                {o.nome === valor && <Check size={14} className="pfiltro-check" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function App() {
  const [lib, setLib] = useState(EMPTY_LIB);
  const [loading, setLoading] = useState(true);
  const [storageMode, setStorageMode] = useState("checking");
  const [canUpload, setCanUpload] = useState(false);
  const [tab, setTab] = useState(lerAbaSalva);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [exportText, setExportText] = useState(null);
  const [corPersonagem, setCorPersonagem] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const sentinelRef = useRef(null);
  const hubAtBottom = useRef(false);
  const hubObserver = useRef(null);
  const hubElRef = useRef(null);
  const [hubReturning, setHubReturning] = useState(false);

  // Callback ref: the sentinel lives inside Hub, which mounts and unmounts, so
  // the observer has to follow the node rather than run once on mount.
  const hubSentinelRef = useCallback((node) => {
    if (hubObserver.current) {
      hubObserver.current.disconnect();
      hubObserver.current = null;
    }
    hubAtBottom.current = false;
    if (!node || typeof IntersectionObserver !== "function") return;
    const io = new IntersectionObserver(
      ([entry]) => { hubAtBottom.current = entry.isIntersecting; },
      { threshold: 0 }
    );
    io.observe(node);
    hubObserver.current = io;
  }, []);

  const libRef = useRef(lib);
  libRef.current = lib;

  /* ---------- boot ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const claude = window.claude;
      const db = claude && claude.use ? await claude.use("db") : null;
      if (cancelled) return;
      store.db = db;
      store.onError = (msg) => showToast(msg);

      if (!db) {
        setStorageMode("memory");
        setLoading(false);
      } else {
        setStorageMode("db");
        try {
          const loaded = await loadLibrary(db);
          const semeado = semearEditoras(loaded);
          if (!cancelled) {
            setLib(semeado);
            libRef.current = semeado;
            if (semeado !== loaded) scheduleSave(semeado);
          }
        } catch (e) {
          if (!cancelled) showToast("Não consegui carregar a biblioteca. Recarregue a página.");
        }
        // Usually long done by now; the cap keeps a slow disk from holding the app.
        await esperarMiniaturas(400);
        if (!cancelled) setLoading(false);
      }

      const [assets, downloads] = await Promise.all([
        claude && claude.use ? claude.use("assets") : null,
        claude && claude.use ? claude.use("downloads") : null,
      ]);
      if (cancelled) return;
      store.assets = assets;
      store.downloads = downloads;
      setCanUpload(!!assets);
    })();
    return () => { cancelled = true; };
  }, []);

  const showToast = useCallback((msg) => {
    setToast({ msg, id: uid() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Scroll edge for the header. IntersectionObserver on a sentinel rather than
  // a scroll listener, which would fire on every frame.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver !== "function") return;
    const io = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const persist = useCallback((next) => {
    setLib(next);
    libRef.current = next;
    scheduleSave(next);
  }, []);

  /* ---------- derived indexes ---------- */
  const personagens = useMemo(() => {
    const set = new Set([
      ...lib.volumes.map((v) => v.personagem),
      ...lib.series.flatMap((s) => personagensDaSerie(s).map((p) => p.nome)),
    ].filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [lib]);

  const edicaoParaVolumes = useMemo(() => {
    const map = {};
    lib.volumes.forEach((v) => {
      v.edicoesColetadasIds.forEach((eid) => { (map[eid] = map[eid] || []).push(v); });
    });
    return map;
  }, [lib.volumes]);

  const volumeParaColecoes = useMemo(() => {
    const map = {};
    lib.colecoes.forEach((c) => {
      c.membros.forEach((vid) => { (map[vid] = map[vid] || []).push(c); });
    });
    return map;
  }, [lib.colecoes]);

  const edicoesPorSerie = useMemo(() => {
    const map = {};
    lib.edicoes.forEach((e) => { (map[e.serieId] = map[e.serieId] || []).push(e); });
    return map;
  }, [lib.edicoes]);

  const serieById = useMemo(
    () => Object.fromEntries(lib.series.map((s) => [s.id, s])),
    [lib.series]
  );

  const ownedEdicaoIds = useMemo(() => {
    const s = new Set();
    lib.volumes.forEach((v) => v.edicoesColetadasIds.forEach((id) => s.add(id)));
    return s;
  }, [lib.volumes]);

  const volumesQueColetam = useCallback((edId) => edicaoParaVolumes[edId] || [], [edicaoParaVolumes]);
  const colecoesDoVolume = useCallback((vid) => volumeParaColecoes[vid] || [], [volumeParaColecoes]);

  /* ---------- volumes ---------- */
  const [openVolumeId, setOpenVolumeId] = useState(null);
  const [showVolumeForm, setShowVolumeForm] = useState(false);
  const [volumeForm, setVolumeForm] = useState(null);
  const [volumeErrors, setVolumeErrors] = useState({});
  const [volumeDupWarning, setVolumeDupWarning] = useState(null);
  // Read once, when the state is created; written back on every change below.
  const [filtrosSalvos] = useState(lerFiltros);
  const [filtroStatus, setFiltroStatus] = useState(filtrosSalvos.status);
  const [filtroTipo, setFiltroTipo] = useState(filtrosSalvos.tipo);
  const [filtroPersonagem, setFiltroPersonagem] = useState(filtrosSalvos.personagem);
  const [showFiltros, setShowFiltros] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    salvarFiltros({ status: filtroStatus, tipo: filtroTipo, personagem: filtroPersonagem });
  }, [filtroStatus, filtroTipo, filtroPersonagem]);

  // With the panel closed a filter is still narrowing the shelf, so the button
  // carries the count; otherwise a reload or a trip to the hub could leave a
  // filtered shelf with nothing on screen saying so.
  const filtrosAtivos = [filtroStatus, filtroTipo, filtroPersonagem].filter(Boolean).length;

  const buscando = query.trim().length > 0;
  const editoraAtual = useMemo(
    () => (lib.editoras || []).find((e) => e.id === lib.editoraSel) || null,
    [lib.editoras, lib.editoraSel]
  );

  // Search deliberately ignores the publisher filter: looking for a title you
  // half remember should not depend on which publisher happens to be selected.
  const casaEditora = useCallback((item) => {
    if (buscando) return true;
    const sel = lib.editoraSel || ED_TODAS;
    if (sel === ED_TODAS) return true;
    const nome = editoraDe(item);
    if (sel === ED_SEM) return !nome;
    return editoraAtual ? nome.toLowerCase() === (editoraAtual.nome || "").toLowerCase() : true;
  }, [buscando, lib.editoraSel, editoraAtual]);

  // Searching "Detective" should find the Omnibus that collects it, not just
  // volumes with the word in the title, so the series a volume draws from are
  // part of its searchable text.
  const textoBusca = useMemo(() => {
    const serieDaEdicao = {};
    lib.edicoes.forEach((e) => { serieDaEdicao[e.id] = e.serieId; });
    const mapa = {};
    lib.volumes.forEach((v) => {
      const series = new Set();
      v.edicoesColetadasIds.forEach((eid) => {
        const s = serieById[serieDaEdicao[eid]];
        if (s) series.add(s.nome);
      });
      mapa[v.id] = [v.titulo, v.personagem, v.editora, v.notas, ...series]
        .filter(Boolean).join(" ").toLowerCase();
    });
    return mapa;
  }, [lib.volumes, lib.edicoes, serieById]);

  // v73: on HQs, the eight best volumes. On Coleções or Séries, the four best
  // of that tab first, then the four best volumes; when nothing in the tab
  // matches, just those four volumes. Like the volumes, the tab's results ignore
  // the publisher filter.
  const sugestoes = useMemo(() => {
    const hqs = ordenarSugestoes(lib.volumes, textoBusca, query);
    const comoVolume = (v) => ({
      tipo: "volume", chave: "v-" + v.id, id: v.id, volume: v, titulo: v.titulo,
      meta: [v.personagem, v.editora].filter(Boolean).join(" · "),
    });
    if (tab !== "colecoes" && tab !== "series") return hqs.map(comoVolume);
    let daAba;
    if (tab === "colecoes") {
      daAba = ordenarPorNome(lib.colecoes, query).slice(0, SUGESTOES_DA_ABA).map((col) => {
        const n = col.membros.filter((vid) => lib.volumes.some((v) => v.id === vid)).length;
        return {
          tipo: "colecao", chave: "c-" + col.id, id: col.id, titulo: col.nome, secao: "Coleções",
          meta: n === 0 ? "Sem volumes ainda" : n === 1 ? "1 volume" : n + " volumes",
        };
      });
    } else {
      daAba = ordenarPorNome(lib.series, query, (s) => personagensDaSerie(s).map((p) => p.nome).join(" "))
        .slice(0, SUGESTOES_DA_ABA).map((s) => {
          const eds = edicoesPorSerie[s.id] || [];
          const tenho = eds.filter((e) => ownedEdicaoIds.has(e.id)).length;
          return {
            tipo: "serie", chave: "s-" + s.id, id: s.id, titulo: s.nome, secao: "Séries",
            meta: [personagensDaSerie(s).map((p) => p.nome).join(", "), anoRange(s),
              eds.length ? tenho + " de " + eds.length : ""].filter(Boolean).join(" · "),
          };
        });
    }
    return daAba.concat(hqs.slice(0, SUGESTOES_DA_ABA).map((v) => ({ ...comoVolume(v), secao: "HQs" })));
  }, [tab, lib.volumes, lib.colecoes, lib.series, textoBusca, query, edicoesPorSerie, ownedEdicaoIds]);

  // Fold state for the HQs tab's character groups — see lerGruposFechados'
  // own comment for why this stores the closed names, inverted from the
  // séries tab's gruposAbertos below.
  const [gruposFechados, setGruposFechados] = useState(lerGruposFechados);
  // A search forces every matching group open, and so does picking a character:
  // filtering to one group and finding it folded would read as broken.
  const grupoAbertoVolumes = (personagem) =>
    buscando || personagem === filtroPersonagem || !gruposFechados.has(personagem);
  function alternarGrupoVolumes(personagem) {
    setGruposFechados((antes) => {
      const proximo = new Set(antes);
      if (proximo.has(personagem)) proximo.delete(personagem);
      else proximo.add(personagem);
      salvarGruposFechados(proximo);
      return proximo;
    });
  }
  function alternarTodosVolumes(grupos, abrir) {
    setGruposFechados((antes) => {
      const proximo = new Set(antes);
      grupos.forEach((g) => { if (abrir) proximo.delete(g.personagem); else proximo.add(g.personagem); });
      salvarGruposFechados(proximo);
      return proximo;
    });
  }

  // Characters on offer: only those with a volume under the publisher band's
  // current choice, since that is what the shelf can show. The count is what the
  // row will hold before the status and tipo filters narrow it further.
  const personagensDisponiveis = useMemo(() => {
    const n = {};
    lib.volumes.filter(casaEditora).forEach((v) => {
      if (v.personagem) n[v.personagem] = (n[v.personagem] || 0) + 1;
    });
    return Object.keys(n).sort((x, y) => x.localeCompare(y, "pt-BR")).map((nome) => ({ nome, n: n[nome] }));
  }, [lib.volumes, casaEditora]);

  // Switching the band to a publisher this character has nothing under would
  // leave an empty shelf with no visible reason, so the filter lets go instead.
  // Not while loading: the library is empty then, and every saved choice would
  // look missing and be thrown away before the real list arrived.
  useEffect(() => {
    if (loading || !filtroPersonagem) return;
    if (!personagensDisponiveis.some((o) => o.nome === filtroPersonagem)) setFiltroPersonagem("");
  }, [loading, filtroPersonagem, personagensDisponiveis]);

  const volumesFiltrados = useMemo(() => {
    let vs = lib.volumes.filter(casaEditora);
    if (query.trim()) {
      const q = query.toLowerCase();
      vs = vs.filter((v) => (textoBusca[v.id] || "").includes(q));
    }
    if (filtroStatus) vs = vs.filter((v) => v.status === filtroStatus);
    if (filtroTipo) vs = vs.filter((v) => v.tipo === filtroTipo);
    if (filtroPersonagem) vs = vs.filter((v) => v.personagem === filtroPersonagem);
    const grupos = {};
    vs.forEach((v) => { (grupos[v.personagem] = grupos[v.personagem] || []).push(v); });
    return Object.keys(grupos).sort((a, b) => a.localeCompare(b, "pt-BR")).map((p) => ({
      personagem: p,
      itens: ordenarGrupoVolumes(grupos[p]),
    }));
  }, [lib.volumes, query, filtroStatus, filtroTipo, filtroPersonagem, casaEditora, textoBusca]);

  // Reordering is restricted to the plain, unfiltered view: a search or filter
  // shows a subset of the group, and reordering only what is visible would
  // silently scramble the order of whatever is hidden. The character filter is
  // the exception: it hides whole groups, never part of one, so the group being
  // dragged in is always complete.
  const podeReordenarVolumes = !query.trim() && !filtroStatus && !filtroTipo;

  /* ---------- drag to reorder HQs, held to one personagem group ---------- */
  // A long press tells a hold apart from a tap or the start of a scroll. Pointer
  // events cover mouse and touch alike, which native HTML5 drag and drop does not
  // on a tablet. 450ms, raised from 350: the user found 350 too easy to trigger
  // by accident while just scrolling or tapping a cover.
  const HOLD_MS = 450;
  // How long the FLIP slide takes to settle, and therefore how long a new target
  // is locked out after one commits. The lockout is the whole fix for a drag that
  // felt unstable: without it, every pixel of pointer movement could re-target the
  // reflow mid-animation, and elementFromPoint would sometimes hit a card that was
  // still sliding rather than the one actually under the pointer. Holding the
  // target still for one settle window turns that into a deliberate, one-slot-at-
  // a-time snap instead of a flicker, which is the "aim assist" the user asked for.
  const FLIP_MS = 220;
  // How long the fill takes to let go once the pointer comes up. Matches the
  // old CSS transition's own release timing, kept here now that release is
  // driven the same way the rise is.
  const HOLD_RELEASE_MS = 150;
  // Speed of the wave's sideways drift, in crests per second. Expressed
  // against time rather than against HOLD_MS so the wave keeps the same
  // speed if the press duration is ever retuned again — only the number of
  // crests that fit in one press changes with it.
  const HOLD_WAVE_CRISTAS_POR_S = 5;
  const dragRef = useRef({ id: null, personagem: null, ids: null, startX: 0, startY: 0, active: false, timer: null });
  // Drives --hold-p on whichever card is filling, once per frame, the same
  // way the HoldButton reference this was adapted from drives --hb-p: a CSS
  // transition cannot give the wave crest both its scroll (tied to progress,
  // not to elapsed time) and its vanish-at-full behaviour, since both need the
  // exact same progress number the fill's own clip-path is using that frame.
  // el !== the last-driven element resets p to 0 instead of carrying over,
  // so a fresh press on a different card never inherits the tail of whatever
  // the previous card's release was mid-animating.
  const holdMotionRef = useRef({ raf: 0, p: 0, el: null });
  const suppressClickRef = useRef(false);
  const cardNodesRef = useRef(new Map()); // volume id -> its .vol DOM node, for FLIP
  const flipSnapshotRef = useRef(null); // rects captured just before a live reorder
  const flipCleanupRef = useRef(new Map()); // volume id -> fallback timer clearing its transform
  const flipBusyRef = useRef(false); // true while the last reflow is still settling
  const flipBusyTimerRef = useRef(null);
  const [dragVisual, setDragVisual] = useState(null); // { id, ids, personagem } while a drag is armed

  // The press-fill and the dragged card both take their tint from the volume's
  // own editora, the same "hue only" swatch every publisher-coloured element in
  // the app already uses. A volume whose editora has no colour, or isn't in the
  // list at all, falls back to the interface's own accent further down in CSS.
  const editoraCorPorNome = useMemo(() => {
    const mapa = {};
    (lib.editoras || []).forEach((ed) => {
      if (ed.cor) mapa[(ed.nome || "").trim().toLowerCase()] = swatchColors(ed.cor, 0).edge;
    });
    return mapa;
  }, [lib.editoras]);

  function registrarCardNode(id, el) {
    if (el) cardNodesRef.current.set(id, el); else cardNodesRef.current.delete(id);
  }

  // Two things have to both be true for a move to retarget something. First,
  // the pointer has to have actually left the dragged card's own current box:
  // comparing raw distance-to-centre alone (the first cut of this) retargeted
  // the instant a neighbour's centre was fractionally closer, which fired while
  // the pointer was still plainly sitting over the card being dragged — the
  // opposite of what holding a card should feel like. Second, once outside that
  // box, elementFromPoint has dead zones: the grid gap between cards belongs to
  // no card, and hovering it used to read as "no target" and drop the group back
  // to its unmoved order. Picking whichever OTHER card's centre is nearest
  // covers every point past the dragged card's own edge, gaps included, without
  // widening the hitbox any click uses the rest of the time.
  function alvoParaMover(personagem, draggedId, x, y) {
    const draggedEl = cardNodesRef.current.get(draggedId);
    if (draggedEl) {
      const r = draggedEl.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return null;
    }
    let melhorId = null;
    let melhorDist = Infinity;
    cardNodesRef.current.forEach((el, id) => {
      if (id === draggedId || el.dataset.personagem !== personagem) return;
      const r = el.getBoundingClientRect();
      const dx = x - (r.left + r.width / 2);
      const dy = y - (r.top + r.height / 2);
      const d = dx * dx + dy * dy;
      if (d < melhorDist) { melhorDist = d; melhorId = id; }
    });
    return melhorId;
  }

  function capturarRects(ids) {
    const rects = new Map();
    ids.forEach((id) => {
      const el = cardNodesRef.current.get(id);
      if (el) rects.set(id, el.getBoundingClientRect());
    });
    return rects;
  }

  // FLIP: the previous render's rects were captured synchronously before this
  // update: invert every card straight to where it used to be (no transition),
  // force layout, then release into a transition to its real spot. Only
  // transform animates, per the rule that padding/width/height touch layout.
  // The release is scheduled on rAF, which is the usual way to guarantee the
  // inverted state actually painted first — but a rAF callback that never gets
  // a turn (a backgrounded tab, a dropped frame) would leave the transform
  // stuck forever, and the next flip would then invert from that already-offset
  // position instead of a clean one. flipCleanupRef holds one fallback timer per
  // card, past FLIP_MS, that force-clears it regardless; a healthy rAF beats it
  // to the punch every time, so this only ever fires as real insurance.
  useLayoutEffect(() => {
    const before = flipSnapshotRef.current;
    if (!before) return;
    flipSnapshotRef.current = null;
    if (prefersReducedMotion()) return; // snap instead of sliding the group around
    before.forEach((prevRect, id) => {
      const el = cardNodesRef.current.get(id);
      if (!el) return;
      clearTimeout(flipCleanupRef.current.get(id));
      const now = el.getBoundingClientRect();
      const dx = prevRect.left - now.left;
      const dy = prevRect.top - now.top;
      if (!dx && !dy) { el.style.transition = ""; el.style.transform = ""; return; }
      el.style.transition = "none";
      el.style.transform = "translate(" + dx + "px," + dy + "px)";
      el.getBoundingClientRect(); // force reflow so the jump above isn't itself animated
      const liberar = () => { el.style.transition = "transform " + FLIP_MS + "ms var(--ease-in-out)"; el.style.transform = ""; };
      requestAnimationFrame(liberar);
      flipCleanupRef.current.set(id, setTimeout(liberar, FLIP_MS + 150));
    });
  }, [dragVisual]);

  // The committed order is exactly the live preview's own ids, not a fresh
  // single move computed against the persisted order: the preview is what the
  // user watched build up over the whole gesture, so it is what should land.
  function persistirOrdemGrupo(personagem, ids) {
    const grupo = lib.volumes.filter((v) => v.personagem === personagem);
    const outros = lib.volumes.filter((v) => v.personagem !== personagem);
    const porId = new Map(grupo.map((v) => [v.id, v]));
    const ordenado = ids.map((id, i) => porId.has(id) ? { ...porId.get(id), ordem: i } : null).filter(Boolean);
    persist({ ...lib, volumes: [...outros, ...ordenado] });
  }

  // Measured once per gesture, not tracked live: a card resizing mid-press
  // (only a window resize could do it) is rare enough that re-measuring on
  // every frame would be paying a layout read for a case that essentially
  // never happens. cover is the box the fill and crest actually paint over;
  // the button also has the title/meta text below it, which is not part of
  // that box.
  function comecarPreenchimento(cardEl) {
    const cover = cardEl.querySelector(".cover");
    if (!cover) return;
    const r = cover.getBoundingClientRect();
    cover.style.setProperty("--hold-w", r.width + "px");
    cover.style.setProperty("--hold-h", r.height + "px");
    // Crests that drift past any given point over the whole press. Counted
    // in crests, not in card widths: HoldButton's holdTime/1100 ratio came
    // out to about three quarters of ONE crest over these 450ms, and against
    // a fill that climbs the cover's full height in the same time, a wave
    // that never completes a single crest does not read as moving at all.
    cover.style.setProperty("--hold-cycles", (HOLD_MS / 1000) * HOLD_WAVE_CRISTAS_POR_S);
    driveHold(cover, 1, HOLD_MS, HOLD_EASE_LINEAR);
  }

  function soltarPreenchimento(cardEl) {
    const cover = cardEl && cardEl.querySelector(".cover");
    if (!cover) return;
    driveHold(cover, 0, HOLD_RELEASE_MS, HOLD_EASE_OUT);
  }

  function driveHold(el, to, duration, ease) {
    const m = holdMotionRef.current;
    cancelAnimationFrame(m.raf);
    if (m.el !== el) m.p = to === 1 ? 0 : m.p; // a different card never inherits a leftover value
    if (m.el !== el && to !== 1) return; // releasing a card that was never driven: nothing to unwind
    m.el = el;
    const from = m.p;
    const start = performance.now();
    const step = (now) => {
      if (m.el !== el) return; // superseded by a newer drive
      const t = duration > 0 ? Math.min(1, (now - start) / duration) : 1;
      m.p = from + (to - from) * ease(t);
      el.style.setProperty("--hold-p", m.p.toFixed(4));
      if (t < 1) { m.raf = requestAnimationFrame(step); return; }
      m.raf = 0;
    };
    m.raf = requestAnimationFrame(step);
  }

  function volDragPointerDown(e, volume, personagem) {
    const info = dragRef.current;
    clearTimeout(info.timer);
    info.id = volume.id;
    info.personagem = personagem;
    info.ids = null;
    info.startX = e.clientX;
    info.startY = e.clientY;
    info.active = false;
    const target = e.currentTarget;
    try { target.setPointerCapture(e.pointerId); } catch {}
    comecarPreenchimento(target);
    info.timer = setTimeout(() => {
      info.active = true;
      target.style.touchAction = "none";
      // The fill itself is not touched here on purpose: driveHold's own rAF
      // loop is already most of the way to --hold-p:1 by the time this fires,
      // and it keeps running past this point, through the whole drag, only
      // unwinding in finalizarDrag() when the pointer actually comes up.
      const grupo = lib.volumes.filter((v) => v.personagem === personagem);
      info.ids = ordenarGrupoVolumes(grupo).map((v) => v.id);
      setDragVisual({ id: volume.id, ids: info.ids, personagem });
    }, HOLD_MS);
  }

  function volDragPointerMove(e) {
    const info = dragRef.current;
    if (!info.id) return;
    if (!info.active) {
      const dist = Math.hypot(e.clientX - info.startX, e.clientY - info.startY);
      if (dist > 10) { clearTimeout(info.timer); info.id = null; soltarPreenchimento(e.currentTarget); }
      return;
    }
    e.preventDefault();
    if (flipBusyRef.current) return; // the last slot change hasn't settled yet
    const alvoId = alvoParaMover(info.personagem, info.id, e.clientX, e.clientY);
    if (!alvoId) return; // still over the dragged card's own box: nothing to do
    const fromIdx = info.ids.indexOf(info.id);
    const toIdx = info.ids.indexOf(alvoId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    flipSnapshotRef.current = capturarRects(info.ids);
    const next = info.ids.slice();
    const [item] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, item);
    info.ids = next;
    setDragVisual({ id: info.id, ids: next, personagem: info.personagem });
    flipBusyRef.current = true;
    clearTimeout(flipBusyTimerRef.current);
    flipBusyTimerRef.current = setTimeout(() => { flipBusyRef.current = false; }, FLIP_MS);
  }

  // Shared by the card's own onPointerUp/onPointerCancel and by the window-level
  // safety net below, so both paths end a drag the exact same way. Guarded by
  // info.id so a second call (both can legitimately fire for one release) is a
  // harmless no-op instead of double-committing.
  function finalizarDrag() {
    const info = dragRef.current;
    if (!info.id) return;
    clearTimeout(info.timer);
    clearTimeout(flipBusyTimerRef.current);
    flipBusyRef.current = false;
    const el = cardNodesRef.current.get(info.id);
    soltarPreenchimento(el);
    if (el && el.style) el.style.touchAction = "";
    if (info.active && info.ids) {
      persistirOrdemGrupo(info.personagem, info.ids);
      suppressClickRef.current = true;
    }
    info.id = null;
    info.active = false;
    info.ids = null;
    setDragVisual(null);
  }

  function volDragPointerEnd() {
    finalizarDrag();
  }

  // Safety net: setPointerCapture should keep pointerup routed to the dragged
  // card no matter where the button comes up, but releasing over a spot with no
  // card under it (or the window losing focus mid-drag) has been seen to leave
  // the gesture stuck armed forever, with no further pointer event ever reaching
  // a .vol handler to end it. A window-level listener, live only while a drag is
  // actually armed, guarantees the drag always ends when the button comes up
  // (or focus leaves), regardless of what capture did or didn't do.
  useEffect(() => {
    if (!dragVisual) return undefined;
    const finalizar = () => finalizarDrag();
    window.addEventListener("pointerup", finalizar, true);
    window.addEventListener("pointercancel", finalizar, true);
    window.addEventListener("blur", finalizar);
    return () => {
      window.removeEventListener("pointerup", finalizar, true);
      window.removeEventListener("pointercancel", finalizar, true);
      window.removeEventListener("blur", finalizar);
    };
  }, [dragVisual]);

  function abrirVolumeCard(volumeId) {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    setOpenVolumeId(volumeId);
  }

  const openVolume = lib.volumes.find((v) => v.id === openVolumeId) || null;

  function openNovoVolume() {
    // Prefilled from whichever publisher is being browsed, so cataloguing inside
    // a publisher view does not leave the field blank and drop the volume into
    // the "Sem editora" bucket.
    const ed = editoraAtual ? editoraAtual.nome : "";
    setVolumeForm({ id: null, titulo: "", personagem: "", tipo: TIPOS[0], editora: ed, ano: "", status: "nao_lida", notas: "" });
    setVolumeErrors({}); setVolumeDupWarning(null); setShowVolumeForm(true);
  }

  function duplicarVolume(v) {
    setVolumeForm({
      id: null,
      titulo: v.titulo,
      personagem: v.personagem,
      tipo: v.tipo,
      editora: v.editora,
      ano: v.ano,
      status: "nao_lida",
      notas: "",
    });
    setVolumeErrors({});
    // The duplicate warning is pre-armed: the title is knowingly the same until
    // it gets edited, so saving should not stop to ask about it.
    setVolumeDupWarning(null);
    setShowVolumeForm(true);
  }
  function openEditarVolume(v) {
    setVolumeForm({ ...v }); setVolumeErrors({}); setVolumeDupWarning(null); setShowVolumeForm(true);
  }

  function validarVolume() {
    const errs = {};
    if (!volumeForm.titulo.trim()) errs.titulo = "Informe o título do volume";
    if (!volumeForm.personagem.trim()) errs.personagem = "Informe o personagem principal";
    setVolumeErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function tituloDuplicado(titulo) {
    return lib.volumes.find((v) => v.titulo.trim().toLowerCase() === titulo.trim().toLowerCase());
  }

  function salvarVolume() {
    if (!validarVolume()) return;
    if (!volumeForm.id && !volumeDupWarning) {
      const dup = tituloDuplicado(volumeForm.titulo);
      if (dup) { setVolumeDupWarning('Já existe "' + dup.titulo + '" cadastrado. Toque em Salvar de novo pra criar mesmo assim.'); return; }
    }
    let next, novoId = volumeForm.id;
    if (volumeForm.id) {
      next = { ...lib, volumes: lib.volumes.map((v) => (v.id === volumeForm.id ? { ...v, ...volumeForm } : v)) };
    } else {
      novoId = uid();
      next = { ...lib, volumes: [...lib.volumes, { ...volumeForm, id: novoId, edicoesColetadasIds: [] }] };
    }
    persist(next);
    setShowVolumeForm(false);
    setVolumeDupWarning(null);
    setOpenVolumeId(novoId);
    showToast(volumeForm.id ? "Volume atualizado." : "Volume adicionado.");
  }

  function salvarVolumeEContinuar() {
    if (!validarVolume()) return;
    if (!volumeDupWarning) {
      const dup = tituloDuplicado(volumeForm.titulo);
      if (dup) { setVolumeDupWarning('Já existe "' + dup.titulo + '" cadastrado. Toque em "Salvar e cadastrar outro" de novo pra criar mesmo assim.'); return; }
    }
    const novo = { ...volumeForm, id: uid(), edicoesColetadasIds: [] };
    persist({ ...lib, volumes: [...lib.volumes, novo] });
    showToast('"' + novo.titulo + '" adicionado. Pronto pro próximo.');
    setVolumeForm((f) => ({
      id: null, titulo: "", personagem: f.personagem, tipo: f.tipo,
      editora: f.editora, ano: "", status: "nao_lida", notas: "",
    }));
    setVolumeErrors({});
    setVolumeDupWarning(null);
  }

  function setStatusVolume(volumeId, status) {
    persist({ ...lib, volumes: lib.volumes.map((v) => (v.id === volumeId ? { ...v, status } : v)) });
  }

  async function handleCoverPick(volumeId, file) {
    if (!file) return;
    setUploadingCover(true);
    try {
      const res = await uploadCover(file);
      const current = libRef.current;
      persist({
        ...current,
        volumes: current.volumes.map((v) => (v.id === volumeId ? { ...v, capaAssetId: res.id } : v)),
      });
      showToast("Capa atualizada.");
    } catch (e) {
      showToast(assetErrorMessage(e));
    } finally {
      setUploadingCover(false);
    }
  }

  /* ---------- coleções ---------- */
  const [openColecaoId, setOpenColecaoId] = useState(null);
  const [showColecaoForm, setShowColecaoForm] = useState(false);
  const [colecaoForm, setColecaoForm] = useState(null);
  const [colecaoErrors, setColecaoErrors] = useState({});
  const [addMemberSel, setAddMemberSel] = useState("");

  const colecoesFiltradas = useMemo(() => {
    // A collection has no publisher of its own, so it inherits from its members:
    // it shows under any publisher it holds a volume from, which is what a
    // crossover saga should do.
    let cs = lib.colecoes.filter((c) => {
      if (buscando || (lib.editoraSel || ED_TODAS) === ED_TODAS) return true;
      const membros = c.membros.map((vid) => lib.volumes.find((v) => v.id === vid)).filter(Boolean);
      if (!membros.length) return (lib.editoraSel || ED_TODAS) === ED_SEM;
      return membros.some(casaEditora);
    });
    if (query.trim()) {
      const q = query.toLowerCase();
      cs = cs.filter((c) => c.nome.toLowerCase().includes(q));
    }
    return cs.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [lib.colecoes, lib.volumes, query, buscando, lib.editoraSel, casaEditora]);

  const openColecao = lib.colecoes.find((c) => c.id === openColecaoId) || null;

  // Whether a collection's strip is wider than the column, and so has a spine
  // bar to colour. v66 asked the bar itself, but a folded collection has no
  // strip mounted, so its colour option vanished with it (v80). Worked out from
  // sizes instead: the strip spans the column's content box, and its covers are
  // .coll-strip's flex-basis (108px, 124px from 640px) with 14px gaps.
  const conteudoRef = useRef(null);
  const [larguraConteudo, setLarguraConteudo] = useState(0);
  useLayoutEffect(() => {
    const el = conteudoRef.current;
    if (!el) return undefined;
    const medir = () => {
      const cs = getComputedStyle(el);
      setLarguraConteudo(el.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0));
    };
    medir();
    if (typeof ResizeObserver !== "function") return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const colecaoRola = (c) => {
    const n = c.membros.filter((vid) => lib.volumes.some((v) => v.id === vid)).length;
    if (n === 0) return false;
    const largo = typeof window !== "undefined" && window.matchMedia
      && window.matchMedia("(min-width: 640px)").matches;
    const capa = largo ? 124 : 108;
    // Unknown width (before the first measure) offers the option rather than hiding it.
    return larguraConteudo <= 0 || n * capa + (n - 1) * 14 > larguraConteudo + 1;
  };

  const [ordemRecolhida, setOrdemRecolhida] = useState(lerOrdemRecolhida);

  const [colecoesFechadas, setColecoesFechadas] = useState(lerColecoesFechadas);
  // A search forces every collection open, as it does every HQs group.
  const colecaoAberta = (id) => buscando || !colecoesFechadas.has(id);
  function alternarColecao(id) {
    setColecoesFechadas((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      salvarColecoesFechadas(n);
      return n;
    });
  }
  function alternarTodasColecoes(lista, abrir) {
    setColecoesFechadas((prev) => {
      const n = new Set(prev);
      lista.forEach((col) => { if (abrir) n.delete(col.id); else n.add(col.id); });
      salvarColecoesFechadas(n);
      return n;
    });
  }
  function alternarOrdem(id) {
    setOrdemRecolhida((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      salvarOrdemRecolhida(n);
      return n;
    });
  }

  function definirCorBarra(colecaoId, spec) {
    persist({
      ...lib,
      colecoes: lib.colecoes.map((c) => {
        if (c.id !== colecaoId) return c;
        const { corBarra, ...resto } = c;
        return spec ? { ...resto, corBarra: spec } : resto;
      }),
    });
  }

  function openNovaColecao() {
    setColecaoForm({ id: null, nome: "", descricao: "" }); setColecaoErrors({}); setShowColecaoForm(true);
  }
  function openEditarColecao(c) {
    setColecaoForm({ id: c.id, nome: c.nome, descricao: c.descricao }); setColecaoErrors({}); setShowColecaoForm(true);
  }
  function salvarColecao() {
    const errs = {};
    if (!colecaoForm.nome.trim()) errs.nome = "Informe o nome da coleção";
    setColecaoErrors(errs);
    if (Object.keys(errs).length) return;
    let next, novoId = colecaoForm.id;
    if (colecaoForm.id) {
      next = { ...lib, colecoes: lib.colecoes.map((c) => (c.id === colecaoForm.id ? { ...c, nome: colecaoForm.nome.trim(), descricao: colecaoForm.descricao.trim() } : c)) };
    } else {
      novoId = uid();
      next = { ...lib, colecoes: [...lib.colecoes, { id: novoId, nome: colecaoForm.nome.trim(), descricao: colecaoForm.descricao.trim(), membros: [] }] };
    }
    persist(next);
    setShowColecaoForm(false);
    setOpenColecaoId(novoId);
    showToast(colecaoForm.id ? "Coleção atualizada." : "Coleção criada.");
  }
  function adicionarMembro(colecaoId, volumeId) {
    persist({ ...lib, colecoes: lib.colecoes.map((c) => (c.id === colecaoId ? { ...c, membros: [...c.membros, volumeId] } : c)) });
    setAddMemberSel("");
  }
  function removerMembro(colecaoId, volumeId) {
    persist({ ...lib, colecoes: lib.colecoes.map((c) => (c.id === colecaoId ? { ...c, membros: c.membros.filter((v) => v !== volumeId) } : c)) });
  }
  function moverMembro(colecaoId, index, direcao) {
    const c = lib.colecoes.find((x) => x.id === colecaoId);
    const membros = [...c.membros];
    const j = index + direcao;
    if (j < 0 || j >= membros.length) return;
    const tmp = membros[index]; membros[index] = membros[j]; membros[j] = tmp;
    persist({ ...lib, colecoes: lib.colecoes.map((x) => (x.id === colecaoId ? { ...x, membros } : x)) });
  }
  function personagensDaColecao(colecao) {
    const set = new Set(colecao.membros.map((vid) => lib.volumes.find((v) => v.id === vid)?.personagem).filter(Boolean));
    return Array.from(set);
  }

  /* ---------- séries ---------- */
  const [openSerieId, setOpenSerieId] = useState(null);
  const [gruposAbertos, setGruposAbertos] = useState(lerGruposAbertos);

  // A search opens every group that matched, without writing to gruposAbertos:
  // the set keeps what the user chose by hand, and the search only overrides how
  // it is read while a query exists. Clearing the field puts the list back
  // exactly as they left it, instead of having quietly opened half of it.
  const grupoAberto = (personagem) => buscando || gruposAbertos.has(personagem);

  function alternarGrupo(personagem) {
    setGruposAbertos((antes) => {
      const proximo = new Set(antes);
      if (proximo.has(personagem)) proximo.delete(personagem);
      else proximo.add(personagem);
      salvarGruposAbertos(proximo);
      return proximo;
    });
  }

  // Only ever touches the groups currently on screen. Clearing the whole set
  // instead would also forget characters that a publisher filter is hiding
  // right now, which the user never asked to close.
  function alternarTodos(grupos, abrir) {
    setGruposAbertos((antes) => {
      const proximo = new Set(antes);
      grupos.forEach((g) => { if (abrir) proximo.add(g.personagem); else proximo.delete(g.personagem); });
      salvarGruposAbertos(proximo);
      return proximo;
    });
  }
  const [openSerieContexto, setOpenSerieContexto] = useState(null);
  const [verTudoSerie, setVerTudoSerie] = useState(false);
  const [showSerieForm, setShowSerieForm] = useState(false);
  const [serieForm, setSerieForm] = useState(null);
  const [serieErrors, setSerieErrors] = useState({});
  const [serieDupWarning, setSerieDupWarning] = useState(null);
  const [showEdicaoForm, setShowEdicaoForm] = useState(false);
  const [edicaoForm, setEdicaoForm] = useState(null);
  const [selectedEdicaoId, setSelectedEdicaoId] = useState(null);
  const [serieBusca, setSerieBusca] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSerieId, setImportSerieId] = useState(null);
  const [importText, setImportText] = useState("");

  const seriesFiltradas = useMemo(() => {
    let ss = lib.series.filter(casaEditora);
    if (query.trim()) {
      const q = query.toLowerCase();
      ss = ss.filter((s) => s.nome.toLowerCase().includes(q) || personagensDaSerie(s).some((p) => p.nome.toLowerCase().includes(q)));
    }
    const grupos = {};
    ss.forEach((s) => {
      const ps = personagensDaSerie(s);
      (ps.length ? ps : [{ nome: "(sem personagem)", de: null, ate: null }]).forEach((p) => {
        (grupos[p.nome] = grupos[p.nome] || []).push({ serie: s, faixa: p });
      });
    });
    return Object.keys(grupos).sort((a, b) => a.localeCompare(b, "pt-BR")).map((p) => ({
      personagem: p,
      itens: grupos[p].sort((a, b) => {
        const oa = a.serie.ordem ?? null, ob = b.serie.ordem ?? null;
        if (oa !== null && ob !== null) return oa - ob;
        if (oa !== null) return -1;
        if (ob !== null) return 1;
        return (parseInt(a.serie.anoInicio, 10) || 9999) - (parseInt(b.serie.anoInicio, 10) || 9999);
      }),
    }));
  }, [lib.series, query, casaEditora]);

  const openSerie = lib.series.find((s) => s.id === openSerieId) || null;

  // A séries row opens its série limited to the row's own range. Only setters
  // inside, so it stays one function and the memoised rows can skip renders.
  const abrirSerieNaFaixa = useCallback((serie, faixa) => {
    setOpenSerieId(serie.id);
    setOpenSerieContexto(faixa);
    setVerTudoSerie(false);
    setSelectedEdicaoId(null);
    setSerieBusca("");
  }, []);

  function openNovaSerie() {
    setSerieForm({ id: null, nome: "", personagensList: [{ nome: "", de: "", ate: "" }], editora: "", anoInicio: "", anoFim: "", totalEdicoes: "", ordem: "" });
    setSerieErrors({}); setSerieDupWarning(null); setShowSerieForm(true);
  }
  function openEditarSerie(s) {
    const lista = personagensDaSerie(s).map((p) => ({
      nome: p.nome,
      de: p.de !== null && p.de !== undefined ? String(p.de) : "",
      ate: p.ate !== null && p.ate !== undefined ? String(p.ate) : "",
    }));
    setSerieForm({
      ...s,
      personagensList: lista.length ? lista : [{ nome: "", de: "", ate: "" }],
      totalEdicoes: s.totalEdicoes || "",
      ordem: s.ordem !== null && s.ordem !== undefined ? String(s.ordem) : "",
    });
    setSerieErrors({}); setSerieDupWarning(null); setShowSerieForm(true);
  }
  function salvarSerie() {
    const errs = {};
    if (!serieForm.nome.trim()) errs.nome = "Informe o nome da série";
    if (!serieForm.personagensList.some((p) => p.nome.trim())) errs.personagem = "Informe ao menos um personagem";
    setSerieErrors(errs);
    if (Object.keys(errs).length) return;
    if (!serieForm.id && !serieDupWarning) {
      const dup = lib.series.find((s) => s.nome.trim().toLowerCase() === serieForm.nome.trim().toLowerCase());
      if (dup) { setSerieDupWarning('Já existe uma série chamada "' + dup.nome + '". Toque em Salvar de novo pra criar mesmo assim.'); return; }
    }
    const payload = {
      nome: serieForm.nome.trim(),
      personagens: serieForm.personagensList.filter((p) => p.nome.trim()).map((p) => ({
        nome: p.nome.trim(),
        de: p.de !== "" && !isNaN(parseInt(p.de, 10)) ? parseInt(p.de, 10) : null,
        ate: p.ate !== "" && !isNaN(parseInt(p.ate, 10)) ? parseInt(p.ate, 10) : null,
      })),
      editora: serieForm.editora.trim(),
      anoInicio: serieForm.anoInicio.trim(),
      anoFim: serieForm.anoFim.trim(),
      totalEdicoes: serieForm.totalEdicoes ? parseInt(serieForm.totalEdicoes, 10) : null,
      ordem: serieForm.ordem.trim() !== "" && !isNaN(parseFloat(serieForm.ordem)) ? parseFloat(serieForm.ordem) : null,
    };
    let next, novoId = serieForm.id;
    if (serieForm.id) {
      next = { ...lib, series: lib.series.map((s) => (s.id === serieForm.id ? { ...payload, id: s.id } : s)) };
    } else {
      novoId = uid();
      next = { ...lib, series: [...lib.series, { ...payload, id: novoId }] };
    }
    persist(next);
    setShowSerieForm(false);
    setSerieDupWarning(null);
    setOpenSerieId(novoId);
    showToast(serieForm.id ? "Série atualizada." : "Série criada.");
  }

  function salvarEdicao() {
    if (!edicaoForm.numero.trim()) { showToast("Informe o número da edição."); return; }
    const payload = {
      ...edicaoForm,
      posicao: edicaoForm.posicao.trim() !== "" && !isNaN(parseFloat(edicaoForm.posicao)) ? parseFloat(edicaoForm.posicao) : null,
    };
    const next = payload.id
      ? { ...lib, edicoes: lib.edicoes.map((e) => (e.id === payload.id ? payload : e)) }
      : { ...lib, edicoes: [...lib.edicoes, { ...payload, id: uid() }] };
    persist(next);
    setShowEdicaoForm(false);
    showToast("Edição salva.");
  }

  function importarEdicoes() {
    const registros = parseImportText(importText);
    if (!registros.length) { showToast("Nada reconhecido pra importar."); return; }
    let edicoes = [...lib.edicoes];
    let criadas = 0, atualizadas = 0;
    registros.forEach((r) => {
      const ex = edicoes.find((e) => e.serieId === importSerieId && e.numero.trim().toLowerCase() === r.numero.trim().toLowerCase());
      if (ex) {
        edicoes = edicoes.map((e) => (e.id === ex.id ? { ...e, mes: r.mes || e.mes, ano: r.ano || e.ano } : e));
        atualizadas++;
      } else {
        edicoes.push({ id: uid(), serieId: importSerieId, numero: r.numero, mes: r.mes, ano: r.ano, posicao: null });
        criadas++;
      }
    });
    persist({ ...lib, edicoes });
    setShowImportModal(false);
    setImportText("");
    showToast(criadas + " criadas, " + atualizadas + " atualizadas.");
  }

  /* ---------- linking ---------- */
  const [linkSerieId, setLinkSerieId] = useState(null);
  const [linkPickSerie, setLinkPickSerie] = useState("");
  const [rangeDe, setRangeDe] = useState("");
  const [rangeAte, setRangeAte] = useState("");
  const [avulsoNum, setAvulsoNum] = useState("");

  function toggleLigacaoEdicao(volumeId, edicaoId) {
    persist({
      ...lib,
      volumes: lib.volumes.map((v) => {
        if (v.id !== volumeId) return v;
        const has = v.edicoesColetadasIds.includes(edicaoId);
        return {
          ...v,
          edicoesColetadasIds: has
            ? v.edicoesColetadasIds.filter((id) => id !== edicaoId)
            : [...v.edicoesColetadasIds, edicaoId],
        };
      }),
    });
  }

  function vincularIntervalo(volumeId, serieId) {
    const de = parseInt(rangeDe, 10), ate = parseInt(rangeAte, 10);
    if (!de || !ate || ate < de) { showToast("Intervalo inválido."); return; }
    const { edicoes, ids } = ensureRange(lib, serieId, de, ate);
    persist({
      ...lib,
      edicoes,
      volumes: lib.volumes.map((v) => (v.id === volumeId
        ? { ...v, edicoesColetadasIds: Array.from(new Set([...v.edicoesColetadasIds, ...ids])) }
        : v)),
    });
    setRangeDe(""); setRangeAte("");
    showToast("Vinculado do " + de + " ao " + ate + ".");
  }

  function vincularAvulsa(volumeId, serieId) {
    if (!avulsoNum.trim()) return;
    const { edicoes, id } = ensureAvulsa(lib, serieId, avulsoNum);
    persist({
      ...lib,
      edicoes,
      volumes: lib.volumes.map((v) => (v.id === volumeId
        ? { ...v, edicoesColetadasIds: Array.from(new Set([...v.edicoesColetadasIds, id])) }
        : v)),
    });
    setAvulsoNum("");
    showToast("Edição vinculada.");
  }

  function edicoesDoVolumeAgrupadas(volume) {
    const grupos = {};
    volume.edicoesColetadasIds.forEach((eid) => {
      const ed = lib.edicoes.find((e) => e.id === eid);
      if (!ed) return;
      const serie = serieById[ed.serieId];
      const key = serie ? serie.id : "?";
      if (!grupos[key]) grupos[key] = { serie, edicoes: [] };
      grupos[key].edicoes.push(ed);
    });
    Object.values(grupos).forEach((g) =>
      g.edicoes.sort((a, b) => (parseNum(a.numero) ?? 1e9) - (parseNum(b.numero) ?? 1e9))
    );
    return Object.values(grupos);
  }

  /* ---------- deletion ---------- */
  function confirmarExclusao() {
    if (!confirmDelete) return;
    const { type, id } = confirmDelete;
    let next = lib;
    if (type === "volume") { next = deleteVolume(lib, id); if (openVolumeId === id) setOpenVolumeId(null); }
    if (type === "colecao") { next = deleteColecao(lib, id); if (openColecaoId === id) setOpenColecaoId(null); }
    if (type === "serie") { next = deleteSerie(lib, id); if (openSerieId === id) setOpenSerieId(null); }
    if (type === "edicao") { next = deleteEdicao(lib, id); setSelectedEdicaoId(null); }
    if (type === "all") {
      next = EMPTY_LIB;
      setOpenVolumeId(null); setOpenColecaoId(null); setOpenSerieId(null);
    }
    persist(next);
    setConfirmDelete(null);
    showToast(type === "all" ? "Biblioteca zerada." : "Removido.");
  }

  /* ---------- backup ---------- */
  const fileInputRef = useRef(null);

  // A page-initiated download is inert inside the artifact sandbox, so the
  // export goes through the downloads capability, with copy-to-clipboard as
  // the fallback for views where that capability is not available.
  async function exportJson() {
    const data = JSON.stringify(libRef.current, null, 2);
    if (store.downloads) {
      try {
        await store.downloads.save({ filename: "longbox.json", data });
        showToast("Backup salvo.");
        return;
      } catch (e) {
        const code = e && e.code;
        if (code === "declined") return;
        if (code === "rate_limited") { showToast("Já tem um pedido de download aberto."); return; }
        if (code === "too_large") { showToast("O backup ficou grande demais para salvar assim."); return; }
      }
    }
    setExportText(data);
  }

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(exportText);
      showToast("Backup copiado. Cole num arquivo .json e guarde.");
    } catch (e) {
      showToast("Não consegui copiar. Selecione o texto e copie na mão.");
    }
  }

  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        if (!raw || typeof raw !== "object" || !Array.isArray(raw.volumes)) {
          showToast("Esse arquivo não parece um backup do Longbox.");
          return;
        }
        const incoming = normalizeLib(raw);
        persist(incoming);
        setOpenVolumeId(null); setOpenColecaoId(null); setOpenSerieId(null);
        showToast(
          incoming.volumes.length + " volumes, " + incoming.series.length +
          " séries e " + incoming.edicoes.length + " edições importadas."
        );
      } catch (e) {
        showToast("Não consegui ler esse arquivo JSON.");
      }
    };
    reader.readAsText(file);
  }

  /* ---------- stats ---------- */
  const statsGerais = useMemo(() => {
    let totalPossuidas = 0;
    const porSerie = lib.series.map((s) => {
      const eds = edicoesPorSerie[s.id] || [];
      const owned = eds.filter((e) => ownedEdicaoIds.has(e.id)).length;
      totalPossuidas += owned;
      return { serie: s, owned, total: s.totalEdicoes || null };
    });
    // Only series genuinely near the finish line, then three of them at random.
    // Ranking by percentage was the old bug: a complete 4-issue miniseries is
    // not an achievement, and it topped the chart forever.
    const comMeta = porSerie.filter((p) => p.total);
    const quase = comMeta.filter(
      (p) => p.total - p.owned > 0 && p.owned / p.total >= QUASE_FECHANDO
    );
    return {
      totalPossuidas,
      totalCatalogadas: lib.edicoes.length,
      // Drawn at random, then ordered: the three that show are still a random
      // three of everything past the threshold (the point being to surface
      // something forgotten), but among themselves they read closest-to-done
      // first, so the list has a direction instead of arriving shuffled.
      //
      // Compared by cross-multiplication rather than by owned / total: the
      // ratios are only ever used to rank, and two genuinely equal fractions
      // divided out as floats are not reliably equal afterwards, which would
      // hand ties to whatever the draw happened to produce instead of to the
      // alphabet. Integers multiplied out are exact, so a tie is a real tie.
      faltaPouco: seededPick(quase, 3, SESSION_SEED).sort((a, b) => {
        const porCompletude = b.owned * a.total - a.owned * b.total;
        if (porCompletude !== 0) return porCompletude;
        return a.serie.nome.localeCompare(b.serie.nome, "pt-BR");
      }),
      quaseFechando: quase.length,
      temMetas: comMeta.length > 0,
    };
  }, [lib.series, lib.edicoes, edicoesPorSerie, ownedEdicaoIds]);

  const docUsage = useMemo(() => {
    const docs = [
      { nome: "Volumes", bytes: bytesOf({ items: lib.volumes }) },
      { nome: "Coleções", bytes: bytesOf({ items: lib.colecoes }) },
      { nome: "Séries", bytes: bytesOf({ items: lib.series }) },
    ];
    shardEdicoes(lib.edicoes).forEach((items, sid) => {
      const s = serieById[sid];
      docs.push({ nome: "Edições de " + (s ? s.nome : "série removida"), bytes: bytesOf({ items }) });
    });
    const maior = docs.reduce((a, b) => (b.bytes > a.bytes ? b : a), docs[0]);
    return { maior, pct: (maior.bytes / DOC_LIMIT) * 100 };
  }, [lib, serieById]);

  const isHub = tab === "hub";

  // v80: the three tabs stay mounted once built, hidden when not in use, so
  // coming back to one does not rebuild every card and cover from scratch. The
  // tab on screen is built at once; the others are built just after the
  // library loads, in a quiet moment, so they are ready before the first switch.
  // v85: shelf thumbnails for every cover in use, made once per device.
  // Only with a loaded, non-empty library: the same call forgets thumbnails no
  // volume uses, and an empty list after a failed load would forget them all.
  const idsCapas = useMemo(
    () => [...new Set(lib.volumes.map((v) => v.capaAssetId).filter(Boolean))].join("|"),
    [lib.volumes]
  );
  useEffect(() => {
    if (loading || !idsCapas) return;
    prepararMiniaturas(idsCapas.split("|"));
  }, [loading, idsCapas]);

  const [abasProntas, setAbasProntas] = useState(false);
  const abaMontada = (k) => tab === k || abasProntas;
  useEffect(() => {
    if (loading || abasProntas) return undefined;
    const ric = typeof window !== "undefined" && window.requestIdleCallback;
    const id = ric ? ric(() => setAbasProntas(true), { timeout: 1500 }) : setTimeout(() => setAbasProntas(true), 400);
    return () => { if (ric) window.cancelIdleCallback(id); else clearTimeout(id); };
  }, [loading, abasProntas]);

  // The lattice under the tabs burns in the colour of the publisher being read,
  // the same one the band is tinted with, and falls back to the cyan the
  // interface owns when no publisher is chosen.
  useLarguraDaBarra();
  const ponteiroFino = usePonteiroFino();
  // The lattice is the ground the tab content sits on, so it is there from the
  // first paint: waiting for the library would swap the background mid-load.
  const comMalha = !isHub && ponteiroFino;
  // Only the hue travels to the header and the strip; the accent's own
  // saturation and lightness stay, so contrast never moves. A publisher with no
  // colour, or a greyscale one, lends nothing: hue 0 would come out red.
  const edCroma = useMemo(() => {
    if (isHub) return null;
    const sel = lib.editoraSel || ED_TODAS;
    const atual = (lib.editoras || []).find((e) => e.id === sel);
    const spec = atual && atual.cor;
    if (!spec || spec.h === undefined || spec.h === null) return null;
    if (spec.s !== undefined && spec.s < 12) return null;
    // The two themes render the hue at their own lightness, so each gets its own
    // reading and they do not always agree.
    return {
      h: spec.h,
      tintaEscuro: tintaSobre(spec.h, 100, 42),
      tintaClaro: tintaSobre(spec.h, 100, 33),
    };
  }, [isHub, lib.editoras, lib.editoraSel]);
  const edHue = edCroma ? edCroma.h : null;

  // The publisher's backdrop colour, for the gradient that now runs from the very
  // top of the page through the header into the band (v68). Only where the band
  // is tinted, so never on the hub.
  const edFundo = useMemo(() => {
    if (isHub) return null;
    const sel = lib.editoraSel || ED_TODAS;
    const atual = (lib.editoras || []).find((e) => e.id === sel);
    // Both ends of the colour: the deep cover shade tints the dark theme, the
    // vivid edge tints the light one (v79; the deep shade read as grey smoke
    // on a light page).
    const par = (c) => ({ fundo: c.b, vivo: c.edge });
    if (atual) return atual.cor ? par(swatchColors(atual.cor, 0)) : null;
    // Todas as editoras: the Longbox cyan, as in the band (v70).
    return sel === ED_SEM ? null : par(swatchColors(COR_LONGBOX, 0));
  }, [isHub, lib.editoras, lib.editoraSel]);

  const malhaCor = useMemo(() => {
    const sel = lib.editoraSel || ED_TODAS;
    const atual = (lib.editoras || []).find((e) => e.id === sel);
    return atual && atual.cor ? swatchColors(atual.cor, 0).edge : ACCENT_HEX;
  }, [lib.editoras, lib.editoraSel]);

  const switchTab = useCallback((key) => {
    setTab((prev) => {
      // Coming back to the hub reverses the unlock: it drops in from the top,
      // the same path it left by.
      if (key === "hub" && prev !== "hub") setHubReturning(true);
      return key;
    });
    setQuery("");
    if (typeof window !== "undefined" && window.scrollTo) window.scrollTo(0, 0);
  }, []);

  // Written from the state rather than from switchTab, so every route into a tab
  // is covered, including the scroll gesture that unlocks the hub.
  useEffect(() => { salvarAba(tab); }, [tab]);

  const entrarNaColecao = useCallback(() => switchTab("volumes"), [switchTab]);

  // From a volume's "Edições coletadas" tile: open that edição's série card
  // stacked on top of the volume sheet, without touching the active tab or
  // closing the volume underneath it — closing the série sheet reveals the
  // volume sheet again, exactly as it was. Unfiltered (no faixa contexto) so
  // the clicked edição is guaranteed visible and lands selected, same as
  // clicking a tile inside the séries tab itself.
  const abrirEdicaoNaSerie = useCallback((serieId, edicaoId) => {
    setOpenSerieId(serieId);
    setOpenSerieContexto(null);
    setSelectedEdicaoId(edicaoId);
  }, []);

  useHubUnlock(isHub && !loading, hubAtBottom, hubElRef, entrarNaColecao);

  useEffect(() => {
    if (!hubReturning) return;
    const t = setTimeout(() => setHubReturning(false), 320);
    return () => clearTimeout(t);
  }, [hubReturning]);

  function escolherCor(personagem, spec) {
    const chave = (personagem || "").trim().toLowerCase();
    if (!chave) return;
    const cores = { ...(lib.cores || {}) };
    if (spec === null) delete cores[chave];
    else cores[chave] = spec;
    persist({ ...lib, cores });
    setCorPersonagem(null);
  }

  const [showEditoras, setShowEditoras] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);

  function selecionarEditora(id) {
    persist({ ...lib, editoraSel: id });
  }

  // One handler for the three shapes: null id adds, null patch removes, otherwise merge.
  function alterarEditora(id, patch) {
    if (id === null) {
      const nome = (patch.nome || "").trim();
      if (!nome) return;
      const existe = (lib.editoras || []).some((e) => (e.nome || "").toLowerCase() === nome.toLowerCase());
      if (existe) { showToast("Já existe uma editora com esse nome."); return; }
      const nova = { id: slugify(nome) + "-" + uid().slice(0, 4), nome, cor: null, logoAssetId: null, logoFundo: "nenhum" };
      persist({ ...lib, editoras: [...(lib.editoras || []), nova] });
      return;
    }
    if (patch === null) {
      const next = { ...lib, editoras: (lib.editoras || []).filter((e) => e.id !== id) };
      if (lib.editoraSel === id) next.editoraSel = ED_TODAS;
      persist(next);
      return;
    }
    persist({
      ...lib,
      editoras: (lib.editoras || []).map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  }

  async function enviarLogo(id, file) {
    if (!file) return;
    setEnviandoLogo(true);
    try {
      const res = await uploadCover(file);
      const atual = libRef.current;
      persist({
        ...atual,
        editoras: (atual.editoras || []).map((e) => (e.id === id ? { ...e, logoAssetId: res.id } : e)),
      });
      showToast("Logo enviado.");
    } catch (e) {
      showToast(assetErrorMessage(e));
    } finally {
      setEnviandoLogo(false);
    }
  }

  function novoNaAba() {
    if (tab === "colecoes") openNovaColecao();
    else if (tab === "series") openNovaSerie();
    else openNovoVolume();
  }

  /* ============================ render ============================ */

  return (
    <CoresContext.Provider value={lib.cores || null}>
    <div
      className="app"
      data-ed-tint={edCroma ? "true" : undefined}
      data-ed-fundo={edFundo ? "true" : undefined}
      style={edCroma || edFundo ? {
        ...(edCroma ? { "--ed-hue": edCroma.h } : null),
        ...(edFundo ? { "--ed-fundo": edFundo.fundo, "--ed-vivo": edFundo.vivo } : null),
      } : undefined}
    >
      <datalist id="personagens-list">
        {personagens.map((p) => <option key={p} value={p} />)}
      </datalist>

      <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />

      <header
        className="topbar"
        data-scrolled={scrolled ? "true" : "false"}
        data-ed-hue={edHue == null ? undefined : "true"}
        style={
          edCroma == null
            ? undefined
            : {
                "--ed-hue": edCroma.h,
                "--ed-ink-escuro": edCroma.tintaEscuro,
                "--ed-ink-claro": edCroma.tintaClaro,
              }
        }
      >
        <div className="topbar-inner">
          {isHub ? (
            <span className="brand">
              <span className="mark" aria-hidden="true"><i /><i /><i /><i /></span>
              <span className="wordmark">LONG<b>BOX</b></span>
            </span>
          ) : (
            <button className="brand" onClick={() => switchTab("hub")} aria-label="Voltar ao início">
              <ChevronLeft size={18} className="brand-chev" />
              <span className="mark" aria-hidden="true"><i /><i /><i /><i /></span>
              <span className="wordmark">LONG<b>BOX</b></span>
            </button>
          )}

          <div style={{ flex: 1 }} />

          {!isHub && (
            <SearchBox
              query={query}
              setQuery={setQuery}
              sugestoes={sugestoes}
              onPick={(s) => {
                if (s.tipo === "colecao") { setOpenColecaoId(s.id); return; }
                if (s.tipo === "serie") {
                  setOpenSerieId(s.id);
                  setOpenSerieContexto(null);
                  setVerTudoSerie(false);
                  setSelectedEdicaoId(null);
                  setSerieBusca("");
                  return;
                }
                switchTab("volumes");
                setOpenVolumeId(s.id);
              }}
            />
          )}
          {tab === "volumes" && (
            <button
              className="btn-icon btn-filtros"
              data-active={showFiltros ? "true" : "false"}
              data-filtrando={filtrosAtivos > 0 ? "true" : "false"}
              onClick={() => setShowFiltros((s) => !s)}
              aria-label={filtrosAtivos > 0 ? "Filtros, " + filtrosAtivos + (filtrosAtivos === 1 ? " ativo" : " ativos") : "Filtros"}
              aria-expanded={showFiltros ? "true" : "false"}
              data-dica={(showFiltros ? "Esconder filtros" : "Mostrar filtros") +
                (filtrosAtivos > 0 ? " (" + filtrosAtivos + (filtrosAtivos === 1 ? " ativo)" : " ativos)") : "")}
            >
              <SlidersHorizontal size={16} />
              {filtrosAtivos > 0 && <span className="btn-badge" aria-hidden="true">{filtrosAtivos}</span>}
            </button>
          )}
          <button className={isHub ? "btn btn-quiet" : "btn btn-primary"} onClick={novoNaAba}>
            <Plus size={15} /> Novo
          </button>
          {isHub && (
            <button className="btn btn-primary" onClick={entrarNaColecao}>
              <Library size={15} />
              <span><span className="label-wide">Minha </span>Coleção</span>
            </button>
          )}
        </div>
      </header>

      {/* Drawn during the load too, so the content does not jump down the page the
          moment the library lands. The count is held blank until there is a real
          one: a "0 HQs" that turns into 47 reads as a wrong answer, not a wait. */}
      {!isHub && (
        <EditoraBar
          editoras={lib.editoras || []}
          selecionada={lib.editoraSel || ED_TODAS}
          onSelect={selecionarEditora}
          onManage={() => setShowEditoras(true)}
          buscando={!loading && buscando}
          tabs={TABS}
          tab={tab}
          onTab={switchTab}
          edCroma={edCroma}
          contagem={
            loading ? ""
              : tab === "volumes" ? volumesFiltrados.reduce((s, g) => s + g.itens.length, 0) + " HQs"
              : tab === "colecoes" ? colecoesFiltradas.length + " coleções"
              : seriesFiltradas.reduce((s, g) => s + g.itens.length, 0) + " séries"
          }
        />
      )}

      <main className="content" ref={conteudoRef} data-lattice={comMalha ? "true" : "false"}>
        {comMalha && (
          <CursorGrid
            pointerTarget={typeof window === "undefined" ? null : window}
            color={malhaCor}
            cellSize={38}
            radius={130}
            falloff="smooth"
            holdTime={220}
            fadeDuration={650}
            lineWidth={1}
            maxOpacity={0.3}
            fillOpacity={0.05}
            gridOpacity={0.025}
            cellRadius={4}
            clickPulse
            pulseSpeed={850}
          />
        )}
        {storageMode === "memory" && (
          <div className="banner" data-tone="warn">
            <AlertTriangle size={16} />
            <div>
              <strong>Nada está sendo salvo nesta visualização.</strong> O armazenamento do
              artefato não está disponível aqui, então tudo que você cadastrar some ao
              recarregar. Abra o artefato publicado na sua conta para usar de verdade.
            </div>
          </div>
        )}

        {!loading && isHub && (
          <Hub
            lib={lib}
            stats={statsGerais}
            docUsage={docUsage}
            edicoesPorSerie={edicoesPorSerie}
            ownedIds={ownedEdicaoIds}
            onOpenVolume={(id) => { switchTab("volumes"); setOpenVolumeId(id); }}
            onOpenSerie={(id) => { switchTab("series"); setOpenSerieId(id); setOpenSerieContexto(null); }}
            onNovo={openNovoVolume}
            onEnter={entrarNaColecao}
            sentinelRef={hubSentinelRef}
            rootRef={hubElRef}
            returning={hubReturning}
          />
        )}

        {tab === "volumes" && showFiltros && (
          <div className="filtros-hqs" style={{ marginBottom: 20 }}>
          <div className="filtros-linha">
            <OpcaoFiltro
              id="filtro-status"
              rotulo="Filtrar por status"
              todos="Todos os status"
              valor={filtroStatus}
              opcoes={OPCOES_STATUS}
              onChange={setFiltroStatus}
            />
            <OpcaoFiltro
              id="filtro-tipo"
              rotulo="Filtrar por tipo"
              todos="Todos os tipos"
              valor={filtroTipo}
              opcoes={OPCOES_TIPO}
              onChange={setFiltroTipo}
            />
            <PersonagemFiltro
              valor={filtroPersonagem}
              opcoes={personagensDisponiveis}
              onChange={setFiltroPersonagem}
            />
            {/* Always in the row, so the row never reflows; enabled only when a
                filter is set. The publisher band is left alone: it is its own
                choice, saved in the database. */}
            <button
              type="button"
              className="btn btn-quiet filtros-limpar"
              disabled={filtrosAtivos === 0}
              aria-label="Limpar filtros"
              onClick={() => { setFiltroStatus(""); setFiltroTipo(""); setFiltroPersonagem(""); }}
            >
              <X size={14} /> <span className="label-wide">Limpar filtros</span>
            </button>
          </div>
          </div>
        )}

        {loading && (
          <>
            {/* The blocks themselves are hidden from a screen reader, since a
                grey rectangle has nothing to say. This line does the talking. */}
            <p className="sr-only" role="status">Carregando sua biblioteca</p>
            {isHub ? <HubSkeleton />
              : tab === "volumes" ? <ShelfSkeleton />
              : tab === "colecoes" ? <ColecoesSkeleton />
              : <SeriesSkeleton />}
          </>
        )}

        {/* ===================== HQs ===================== */}
        {!loading && abaMontada("volumes") && (
          <Aba ativa={tab === "volumes"} render={() => (
          volumesFiltrados.length === 0 ? (
            <EmptyState icon={BookOpen} title={lib.volumes.length === 0 ? "Sua caixa está vazia" : "Nada encontrado"}>
              {lib.volumes.length === 0
                ? 'Toque em "Novo" para catalogar seu primeiro volume.'
                : "Tente outro termo de busca ou limpe os filtros."}
            </EmptyState>
          ) : (
            <>
              {/* Hidden while searching, same reason as the séries tab's own
                  toggle: a search already forces every matching group open. */}
              {!buscando && (
                <div className="fold-all">
                  <button
                    className="btn btn-quiet press"
                    onClick={() => alternarTodosVolumes(volumesFiltrados, !volumesFiltrados.every((g) => !gruposFechados.has(g.personagem)))}
                  >
                    <ChevronDown
                      size={14}
                      data-rot={volumesFiltrados.every((g) => !gruposFechados.has(g.personagem)) ? "false" : "true"}
                    />
                    {volumesFiltrados.every((g) => !gruposFechados.has(g.personagem)) ? "Esconder todas" : "Mostrar todas"}
                  </button>
                </div>
              )}
            {volumesFiltrados.map((grupo) => {
              const arrastandoNesteGrupo = dragVisual != null && dragVisual.personagem === grupo.personagem;
              const itensExibidos = arrastandoNesteGrupo
                ? dragVisual.ids.map((id) => grupo.itens.find((v) => v.id === id)).filter(Boolean)
                : grupo.itens;
              const aberto = grupoAbertoVolumes(grupo.personagem) || arrastandoNesteGrupo;
              return (
              <section className="group" key={grupo.personagem}>
                <GroupHead
                  personagem={grupo.personagem}
                  count={grupo.itens.length}
                  onPickColor={setCorPersonagem}
                  aberto={aberto}
                  onAlternar={alternarGrupoVolumes}
                  itemLabel="HQs"
                />
                {aberto && (
                <div className="shelf stagger">
                  {itensExibidos.map((v, i) => (
                    <VolumeCard
                      key={v.id}
                      volume={v}
                      index={i}
                      open={v.id === openVolumeId}
                      onClick={() => abrirVolumeCard(v.id)}
                      reordenavel={podeReordenarVolumes}
                      personagem={grupo.personagem}
                      dragging={dragVisual != null && dragVisual.id === v.id}
                      holdColor={editoraCorPorNome[(v.editora || "").trim().toLowerCase()]}
                      cardRef={(el) => registrarCardNode(v.id, el)}
                      onDragPointerDown={(e) => volDragPointerDown(e, v, grupo.personagem)}
                      onDragPointerMove={volDragPointerMove}
                      onDragPointerEnd={volDragPointerEnd}
                    />
                  ))}
                </div>
                )}
              </section>
              );
            })}
            </>
          )
          )} />
        )}

        {/* ===================== Coleções ===================== */}
        {!loading && abaMontada("colecoes") && (
          <Aba ativa={tab === "colecoes"} render={() => (
          colecoesFiltradas.length === 0 ? (
            <EmptyState icon={Layers} title={lib.colecoes.length === 0 ? "Nenhuma coleção ainda" : "Nada encontrado"}>
              Uma coleção agrupa volumes em ordem de leitura, como uma saga espalhada por vários encadernados.
            </EmptyState>
          ) : (
            <>
            {/* Same control and same wording as the HQs tab; hidden while
                searching, which forces every collection open anyway. */}
            {!buscando && (
              <div className="fold-all">
                <button
                  className="btn btn-quiet press"
                  onClick={() => alternarTodasColecoes(colecoesFiltradas, !colecoesFiltradas.every((col) => !colecoesFechadas.has(col.id)))}
                >
                  <ChevronDown
                    size={14}
                    data-rot={colecoesFiltradas.every((col) => !colecoesFechadas.has(col.id)) ? "false" : "true"}
                  />
                  {colecoesFiltradas.every((col) => !colecoesFechadas.has(col.id)) ? "Esconder todas" : "Mostrar todas"}
                </button>
              </div>
            )}
            {colecoesFiltradas.map((c) => {
              const membros = c.membros.map((vid) => lib.volumes.find((v) => v.id === vid)).filter(Boolean);
              const aberta = colecaoAberta(c.id);
              return (
                <section className="coll" key={c.id} data-aberta={aberta ? "true" : "false"}>
                  <div className="coll-head">
                    <div style={{ minWidth: 0 }}>
                      <h2 className="t-display" style={{ margin: 0 }}>{c.nome}</h2>
                      <p className="t-small muted truncate" style={{ margin: "3px 0 0" }}>
                        {membros.length === 0 ? "Sem volumes ainda" : membros.length + " volumes"}
                      </p>
                    </div>
                    <div className="coll-acoes">
                      <button className="btn btn-quiet" onClick={() => setOpenColecaoId(c.id)}>Gerenciar</button>
                      <button
                        className="btn-icon"
                        onClick={() => alternarColecao(c.id)}
                        aria-expanded={aberta ? "true" : "false"}
                        aria-label={(aberta ? "Esconder" : "Mostrar") + " os volumes de " + c.nome}
                        data-dica={aberta ? "Esconder volumes" : "Mostrar volumes"}
                      >
                        <ChevronDown size={16} data-rot={aberta ? "false" : "true"} />
                      </button>
                    </div>
                  </div>
                  {!aberta ? null : membros.length === 0 ? (
                    <p className="t-small muted">Abra em Gerenciar para adicionar volumes.</p>
                  ) : (
                    <ShelfStrip total={membros.length} cor={c.corBarra}>
                      {membros.map((v, i) => (
                        <div key={v.id + ":" + i}>
                          <div className="slot-order">{String(i + 1).padStart(2, "0")}</div>
                          <VolumeCard
                            volume={v}
                            index={0}
                            open={false}
                            onClick={() => { switchTab("volumes"); setOpenVolumeId(v.id); }}
                          />
                        </div>
                      ))}
                    </ShelfStrip>
                  )}
                </section>
              );
            })}
            </>
          )
          )} />
        )}

        {/* ===================== Séries ===================== */}
        {!loading && abaMontada("series") && (
          <Aba ativa={tab === "series"} render={() => (
          seriesFiltradas.length === 0 ? (
            <EmptyState icon={Library} title={lib.series.length === 0 ? "Nenhuma série ainda" : "Nada encontrado"}>
              Cadastre uma série para acompanhar quais edições você já tem e quais faltam.
            </EmptyState>
          ) : (
            <>
              {/* Hidden while searching on purpose: a search already forces every
                  matching group open, so this would either read as broken or
                  quietly rewrite a state the user cannot see the effect of. */}
              {!buscando && (
                <div className="fold-all">
                  <button
                    className="btn btn-quiet press"
                    onClick={() => alternarTodos(seriesFiltradas, !seriesFiltradas.every((g) => gruposAbertos.has(g.personagem)))}
                  >
                    <ChevronDown
                      size={14}
                      data-rot={seriesFiltradas.every((g) => gruposAbertos.has(g.personagem)) ? "false" : "true"}
                    />
                    {seriesFiltradas.every((g) => gruposAbertos.has(g.personagem)) ? "Esconder todas" : "Mostrar todas"}
                  </button>
                </div>
              )}
              {seriesFiltradas.map((grupo) => (
              <section className="group" key={grupo.personagem}>
                <GroupHead
                  personagem={grupo.personagem}
                  count={grupo.itens.length}
                  onPickColor={setCorPersonagem}
                  aberto={grupoAberto(grupo.personagem)}
                  onAlternar={alternarGrupo}
                />
                {grupoAberto(grupo.personagem) && grupo.itens.map((item) => (
                  <SerieLinha
                    key={item.serie.id + ":" + item.faixa.nome}
                    serie={item.serie}
                    faixa={item.faixa}
                    eds={edicoesPorSerie[item.serie.id] || SEM_EDICOES}
                    ownedIds={ownedEdicaoIds}
                    aberta={item.serie.id === openSerieId}
                    onAbrir={abrirSerieNaFaixa}
                  />
                ))}
              </section>
              ))}
            </>
          )
          )} />
        )}

        {!loading && isHub && (
          <div className="footer-actions">
            <button className="btn btn-ghost" onClick={exportJson}>
              <Download size={14} /> Exportar backup
            </button>
            <button className="btn btn-ghost" onClick={() => fileInputRef.current && fileInputRef.current.click()}>
              <Upload size={14} /> Importar backup
            </button>
            {(lib.volumes.length > 0 || lib.series.length > 0) && (
              <button className="btn btn-ghost" style={{ color: "var(--danger-text)" }} onClick={() => setConfirmDelete({ type: "all" })}>
                <RotateCcw size={14} /> Zerar tudo
              </button>
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => { importBackup(e.target.files[0]); e.target.value = ""; }}
        />
      </main>

      <nav className="tabbar">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} data-active={tab === t.key ? "true" : "false"} onClick={() => switchTab(t.key)}>
              <Icon size={18} />
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* ===================== volume detail ===================== */}
      <VolumeSheet
        volume={openVolume}
        onClose={() => { setOpenVolumeId(null); setLinkSerieId(null); }}
        onEdit={() => openEditarVolume(openVolume)}
        onDuplicate={() => duplicarVolume(openVolume)}
        onDelete={() => setConfirmDelete({ type: "volume", id: openVolume.id })}
        onStatus={(s) => setStatusVolume(openVolume.id, s)}
        colecoes={openVolume ? colecoesDoVolume(openVolume.id) : []}
        grupos={openVolume ? edicoesDoVolumeAgrupadas(openVolume) : []}
        canUpload={canUpload}
        uploading={uploadingCover}
        onCoverPick={(f) => handleCoverPick(openVolume.id, f)}
        series={lib.series}
        edicoesPorSerie={edicoesPorSerie}
        linkSerieId={linkSerieId}
        setLinkSerieId={setLinkSerieId}
        linkPickSerie={linkPickSerie}
        setLinkPickSerie={setLinkPickSerie}
        rangeDe={rangeDe} setRangeDe={setRangeDe}
        rangeAte={rangeAte} setRangeAte={setRangeAte}
        avulsoNum={avulsoNum} setAvulsoNum={setAvulsoNum}
        onRange={() => vincularIntervalo(openVolume.id, linkSerieId)}
        onAvulsa={() => vincularAvulsa(openVolume.id, linkSerieId)}
        onToggle={(edId) => toggleLigacaoEdicao(openVolume.id, edId)}
        onOpenEdicaoNaSerie={abrirEdicaoNaSerie}
        recede={!!openSerieId}
      />

      {/* ===================== collection detail ===================== */}
      <Sheet
        open={!!openColecao}
        onClose={() => setOpenColecaoId(null)}
        title={openColecao ? openColecao.nome : ""}
        subtitle={openColecao && openColecao.descricao ? openColecao.descricao : null}
        actions={openColecao && (
          <>
            <button className="btn-icon" onClick={() => openEditarColecao(openColecao)} aria-label="Editar"><Pencil size={16} /></button>
            <button className="btn-icon" onClick={() => setConfirmDelete({ type: "colecao", id: openColecao.id })} aria-label="Remover">
              <Trash2 size={16} color="var(--danger-text)" />
            </button>
          </>
        )}
      >
        {openColecao && (
          <>
            {personagensDaColecao(openColecao).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {personagensDaColecao(openColecao).map((p) => <span className="chip" key={p}>{p}</span>)}
              </div>
            )}
            <div>
              <button
                type="button"
                className="ordem-head"
                onClick={() => alternarOrdem(openColecao.id)}
                aria-expanded={ordemRecolhida.has(openColecao.id) ? "false" : "true"}
              >
                <span className="t-micro">Ordem de leitura</span>
                <span className="t-small muted num">{openColecao.membros.length}</span>
                <ChevronDown size={16} data-rot={ordemRecolhida.has(openColecao.id) ? "true" : "false"} />
              </button>
              {!ordemRecolhida.has(openColecao.id) && (<>
              {openColecao.membros.length === 0 && (
                <p className="t-small muted" style={{ margin: 0 }}>Nenhum volume nesta coleção ainda.</p>
              )}
              {openColecao.membros.map((vid, idx) => {
                const v = lib.volumes.find((x) => x.id === vid);
                if (!v) return null;
                return (
                  <div key={vid + ":" + idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                    <span className="num t-small muted" style={{ width: 22, flexShrink: 0 }}>{idx + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="t-small truncate" style={{ margin: 0, fontWeight: 500 }}>{v.titulo}</p>
                      <p className="t-small muted truncate" style={{ margin: 0 }}>{v.personagem}</p>
                    </div>
                    <button className="btn-icon" onClick={() => moverMembro(openColecao.id, idx, -1)} aria-label="Mover para cima"><ArrowUp size={14} /></button>
                    <button className="btn-icon" onClick={() => moverMembro(openColecao.id, idx, 1)} aria-label="Mover para baixo"><ArrowDown size={14} /></button>
                    <button className="btn-icon" onClick={() => removerMembro(openColecao.id, vid)} aria-label="Remover da coleção">
                      <X size={14} color="var(--danger-text)" />
                    </button>
                  </div>
                );
              })}
              </>)}
            </div>
            {/* Only offered when this collection's strip is long enough to have
                a bar, folded or not: a colour for a bar that cannot exist would
                change nothing. */}
            {colecaoRola(openColecao) && (
              <div className="cor-barra">
                <p className="t-micro" style={{ margin: "0 0 8px" }}>Cor da barra</p>
                <div className="swatches">
                  {PALETA_CROMATICA.map((spec, i) => (
                    <Swatch key={"c" + i} spec={spec} atual={openColecao.corBarra}
                      onPick={(_, s) => definirCorBarra(openColecao.id, s)} />
                  ))}
                </div>
                <p className="t-micro" style={{ margin: "14px 0 8px" }}>Neutros</p>
                <div className="swatches">
                  {PALETA_NEUTRA.map((spec, i) => (
                    <Swatch key={"n" + i} spec={spec} atual={openColecao.corBarra}
                      onPick={(_, s) => definirCorBarra(openColecao.id, s)} />
                  ))}
                </div>
                <button
                  className="btn btn-quiet"
                  style={{ width: "100%", marginTop: 10 }}
                  data-on={!openColecao.corBarra ? "true" : "false"}
                  onClick={() => definirCorBarra(openColecao.id, null)}
                >
                  {!openColecao.corBarra ? "Usando a cor da editora" : "Voltar para a cor da editora"}
                </button>
              </div>
            )}
            <Field label="Adicionar volume">
              <select
                className="select"
                value={addMemberSel}
                onChange={(e) => { if (e.target.value) adicionarMembro(openColecao.id, e.target.value); }}
              >
                <option value="">Escolha um volume</option>
                {lib.volumes.filter((v) => !openColecao.membros.includes(v.id)).map((v) => (
                  <option key={v.id} value={v.id}>{v.titulo}</option>
                ))}
              </select>
            </Field>
          </>
        )}
      </Sheet>

      {/* ===================== series detail ===================== */}
      <SerieSheet
        serie={openSerie}
        contexto={openSerieContexto}
        verTudo={verTudoSerie}
        setVerTudo={setVerTudoSerie}
        edicoes={openSerie ? edicoesPorSerie[openSerie.id] || [] : []}
        ownedIds={ownedEdicaoIds}
        volumesQueColetam={volumesQueColetam}
        busca={serieBusca}
        setBusca={setSerieBusca}
        selectedId={selectedEdicaoId}
        setSelectedId={setSelectedEdicaoId}
        onClose={() => { setOpenSerieId(null); setOpenSerieContexto(null); setSelectedEdicaoId(null); setSerieBusca(""); }}
        onEdit={() => openEditarSerie(openSerie)}
        onDelete={() => setConfirmDelete({ type: "serie", id: openSerie.id })}
        onImport={() => { setImportSerieId(openSerie.id); setImportText(""); setShowImportModal(true); }}
        onNovaEdicao={() => { setEdicaoForm({ id: null, serieId: openSerie.id, numero: "", mes: "", ano: "", posicao: "" }); setShowEdicaoForm(true); }}
        onEditEdicao={(ed) => { setEdicaoForm({ ...ed, posicao: ed.posicao !== null && ed.posicao !== undefined ? String(ed.posicao) : "" }); setShowEdicaoForm(true); }}
        onDeleteEdicao={(ed) => setConfirmDelete({ type: "edicao", id: ed.id })}
      />

      {/* ===================== forms ===================== */}
      {volumeForm && (
        <Modal
          open={showVolumeForm}
          onClose={() => setShowVolumeForm(false)}
          title={volumeForm.id ? "Editar volume" : "Novo volume"}
          footer={
            volumeForm.id ? (
              <div className="row">
                <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setShowVolumeForm(false)}>Cancelar</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={salvarVolume}>Salvar</button>
              </div>
            ) : (
              <>
                <div className="row">
                  <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setShowVolumeForm(false)}>Cancelar</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={salvarVolume}>Salvar e fechar</button>
                </div>
                <div className="row row-center">
                  <button className="btn btn-ghost" onClick={salvarVolumeEContinuar}>Salvar e cadastrar outro</button>
                </div>
              </>
            )
          }
        >
          <Field label="Título" error={volumeErrors.titulo}>
            <input
              className="input"
              data-invalid={volumeErrors.titulo ? "true" : "false"}
              value={volumeForm.titulo}
              onChange={(e) => setVolumeForm((f) => ({ ...f, titulo: e.target.value }))}
            />
          </Field>
          <Field label="Personagem principal" error={volumeErrors.personagem}>
            <input
              className="input"
              list="personagens-list"
              data-invalid={volumeErrors.personagem ? "true" : "false"}
              value={volumeForm.personagem}
              onChange={(e) => setVolumeForm((f) => ({ ...f, personagem: e.target.value }))}
            />
          </Field>
          <div className="grid-2">
            <Field label="Tipo">
              <select className="select" value={volumeForm.tipo} onChange={(e) => setVolumeForm((f) => ({ ...f, tipo: e.target.value }))}>
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Ano">
              <input className="input" value={volumeForm.ano} onChange={(e) => setVolumeForm((f) => ({ ...f, ano: e.target.value }))} />
            </Field>
          </div>
          <Field label="Editora">
            <input className="input" value={volumeForm.editora} onChange={(e) => setVolumeForm((f) => ({ ...f, editora: e.target.value }))} />
          </Field>
          <Field label="Status de leitura">
            <div className="seg3">
              {STATUS_ORDER.map((k) => (
                <button
                  key={k}
                  data-kind={k}
                  data-on={volumeForm.status === k ? "true" : "false"}
                  onClick={() => setVolumeForm((f) => ({ ...f, status: k }))}
                >
                  {STATUS[k].label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Notas">
            <textarea className="textarea" value={volumeForm.notas} onChange={(e) => setVolumeForm((f) => ({ ...f, notas: e.target.value }))} />
          </Field>
          {volumeDupWarning && <p className="field-error">{volumeDupWarning}</p>}
        </Modal>
      )}

      {colecaoForm && (
        <Modal
          open={showColecaoForm}
          onClose={() => setShowColecaoForm(false)}
          title={colecaoForm.id ? "Editar coleção" : "Nova coleção"}
          footer={
            <div className="row">
              <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setShowColecaoForm(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={salvarColecao}>Salvar</button>
            </div>
          }
        >
          <Field label="Nome" error={colecaoErrors.nome}>
            <input
              className="input"
              data-invalid={colecaoErrors.nome ? "true" : "false"}
              value={colecaoForm.nome}
              onChange={(e) => setColecaoForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </Field>
          <Field label="Descrição">
            <textarea className="textarea" value={colecaoForm.descricao} onChange={(e) => setColecaoForm((f) => ({ ...f, descricao: e.target.value }))} />
          </Field>
        </Modal>
      )}

      {serieForm && (
        <Modal
          open={showSerieForm}
          onClose={() => setShowSerieForm(false)}
          title={serieForm.id ? "Editar série" : "Nova série"}
          footer={
            <div className="row">
              <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setShowSerieForm(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={salvarSerie}>Salvar</button>
            </div>
          }
        >
          <Field label="Nome" error={serieErrors.nome}>
            <input
              className="input"
              placeholder="Nightwing (Volume 2)"
              data-invalid={serieErrors.nome ? "true" : "false"}
              value={serieForm.nome}
              onChange={(e) => setSerieForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </Field>
          <Field
            label="Personagens"
            error={serieErrors.personagem}
            hint='Deixe "de" e "até" em branco para o personagem valer na série toda. Preencha só quando o protagonista muda no meio da numeração.'
          >
            {serieForm.personagensList.map((p, idx) => (
              <div className="row" key={idx} style={{ marginBottom: 6, alignItems: "center" }}>
                <input
                  className="input"
                  list="personagens-list"
                  placeholder="Personagem"
                  style={{ flex: 1 }}
                  value={p.nome}
                  onChange={(e) => setSerieForm((f) => ({ ...f, personagensList: f.personagensList.map((x, i) => (i === idx ? { ...x, nome: e.target.value } : x)) }))}
                />
                <input
                  className="input" type="number" placeholder="de" style={{ width: 68 }}
                  value={p.de}
                  onChange={(e) => setSerieForm((f) => ({ ...f, personagensList: f.personagensList.map((x, i) => (i === idx ? { ...x, de: e.target.value } : x)) }))}
                />
                <input
                  className="input" type="number" placeholder="até" style={{ width: 68 }}
                  value={p.ate}
                  onChange={(e) => setSerieForm((f) => ({ ...f, personagensList: f.personagensList.map((x, i) => (i === idx ? { ...x, ate: e.target.value } : x)) }))}
                />
                {serieForm.personagensList.length > 1 && (
                  <button
                    className="btn-icon"
                    onClick={() => setSerieForm((f) => ({ ...f, personagensList: f.personagensList.filter((_, i) => i !== idx) }))}
                    aria-label="Remover personagem"
                  >
                    <X size={15} color="var(--danger-text)" />
                  </button>
                )}
              </div>
            ))}
            <button
              className="btn btn-quiet"
              onClick={() => setSerieForm((f) => ({ ...f, personagensList: [...f.personagensList, { nome: "", de: "", ate: "" }] }))}
            >
              <Plus size={14} /> Adicionar personagem
            </button>
          </Field>
          <Field label="Editora">
            <input className="input" value={serieForm.editora} onChange={(e) => setSerieForm((f) => ({ ...f, editora: e.target.value }))} />
          </Field>
          <div className="grid-3">
            <Field label="Ano início">
              <input className="input" value={serieForm.anoInicio} onChange={(e) => setSerieForm((f) => ({ ...f, anoInicio: e.target.value }))} />
            </Field>
            <Field label="Ano fim">
              <input className="input" placeholder="presente" value={serieForm.anoFim} onChange={(e) => setSerieForm((f) => ({ ...f, anoFim: e.target.value }))} />
            </Field>
            <Field label="Total edições">
              <input className="input" type="number" min="0" value={serieForm.totalEdicoes} onChange={(e) => setSerieForm((f) => ({ ...f, totalEdicoes: e.target.value }))} />
            </Field>
          </div>
          <Field
            label="Ordem manual dentro do personagem"
            hint="Em branco ordena pelo ano de início. Preenchendo, número menor aparece primeiro."
          >
            <input className="input" type="number" step="0.1" value={serieForm.ordem} onChange={(e) => setSerieForm((f) => ({ ...f, ordem: e.target.value }))} />
          </Field>
          {serieDupWarning && <p className="field-error">{serieDupWarning}</p>}
        </Modal>
      )}

      {edicaoForm && (
        <Modal
          open={showEdicaoForm}
          onClose={() => setShowEdicaoForm(false)}
          title={edicaoForm.id ? "Editar edição" : "Catalogar edição"}
          footer={
            <div className="row">
              <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setShowEdicaoForm(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={salvarEdicao}>Salvar</button>
            </div>
          }
        >
          <Field label="Número">
            <input className="input" value={edicaoForm.numero} onChange={(e) => setEdicaoForm((f) => ({ ...f, numero: e.target.value }))} />
          </Field>
          <div className="grid-2">
            <Field label="Mês">
              <input className="input" placeholder="Outubro" value={edicaoForm.mes} onChange={(e) => setEdicaoForm((f) => ({ ...f, mes: e.target.value }))} />
            </Field>
            <Field label="Ano">
              <input className="input" value={edicaoForm.ano} onChange={(e) => setEdicaoForm((f) => ({ ...f, ano: e.target.value }))} />
            </Field>
          </div>
          <Field
            label="Posição no checklist"
            hint="Em branco ordena pelo número normal. Use 25.5 para ficar entre a 25 e a 26."
          >
            <input className="input" value={edicaoForm.posicao} onChange={(e) => setEdicaoForm((f) => ({ ...f, posicao: e.target.value }))} />
          </Field>
        </Modal>
      )}

      <Modal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Importar edições"
        footer={
          <div className="row">
            <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setShowImportModal(false)}>Cancelar</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={importarEdicoes}>Importar</button>
          </div>
        }
      >
        <p className="t-small muted" style={{ margin: 0 }}>
          Uma edição por linha, no formato <span className="num">número, mês, ano</span>. Só o número
          é obrigatório. Uma linha como <span className="num">21-30</span> cria o intervalo inteiro de
          uma vez. Número que já existe na série é atualizado, não duplicado. Colar de planilha funciona.
        </p>
        <textarea
          className="textarea num"
          rows={9}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder={"1, Outubro, 1996\n2, Novembro, 1996\n0\n12.1, Janeiro, 2012\n21-30"}
        />
      </Modal>

      {/* ===================== confirm ===================== */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={confirmDelete && confirmDelete.type === "all" ? "Zerar a biblioteca?" : "Remover este item?"}
        footer={
          <div className="row">
            <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setConfirmDelete(null)}>Cancelar</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmarExclusao}>Confirmar</button>
          </div>
        }
      >
        <p className="t-body" style={{ margin: 0 }}>
          {confirmDelete && confirmDelete.type === "volume" && "O volume sai das coleções em que estava. As edições da série continuam catalogadas."}
          {confirmDelete && confirmDelete.type === "colecao" && "Só o agrupamento é removido. Os volumes continuam na aba HQs."}
          {confirmDelete && confirmDelete.type === "serie" && "Remove a série, todas as suas edições, e desfaz o vínculo com qualquer volume."}
          {confirmDelete && confirmDelete.type === "edicao" && "Remove a edição e desfaz o vínculo com qualquer volume que a colete."}
          {confirmDelete && confirmDelete.type === "all" && "Apaga volumes, coleções, séries e edições. Exporte um backup antes se quiser poder voltar."}
        </p>
      </Modal>

      <Modal
        open={!!exportText}
        onClose={() => setExportText(null)}
        title="Backup da biblioteca"
        footer={
          <div className="row">
            <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setExportText(null)}>Fechar</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={copyExport}>
              <Copy size={14} /> Copiar
            </button>
          </div>
        }
      >
        <p className="t-small muted" style={{ margin: 0 }}>
          Esta visualização não consegue salvar arquivos, então copie o texto abaixo e cole
          num arquivo chamado <span className="num">longbox.json</span>. Ele serve para
          reimportar tudo depois.
        </p>
        <textarea
          className="textarea num"
          rows={10}
          readOnly
          value={exportText || ""}
          onFocus={(e) => e.target.select()}
        />
      </Modal>

      <EditorasSheet
        open={showEditoras}
        editoras={lib.editoras || []}
        onClose={() => setShowEditoras(false)}
        onChange={alterarEditora}
        onLogo={enviarLogo}
        canUpload={canUpload}
        enviando={enviandoLogo}
      />

      <CorSheet
        personagem={corPersonagem}
        cores={lib.cores || {}}
        onPick={escolherCor}
        onClose={() => setCorPersonagem(null)}
      />

      {toast && <Toast key={toast.id} message={toast.msg} />}
    </div>
    </CoresContext.Provider>
  );
}

/* ============================ hub ============================ */

// A representative sample, not the first N: capping a character-sorted list
// alphabetically would erase whoever sorts last, and the shelf is meant to read
// as a map of the whole collection. Characters stay in alphabetical order so the
// colour blocks hold their shape; within each one the window slides by the
// session seed, so successive visits eventually show everything.
function buildShelf(volumes, cap, seed) {
  const byChar = {};
  volumes.forEach((v) => {
    const k = v.personagem || "";
    (byChar[k] = byChar[k] || []).push(v);
  });
  const chars = Object.keys(byChar).sort((a, b) => a.localeCompare(b, "pt-BR"));
  chars.forEach((k) => byChar[k].sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR")));
  if (volumes.length <= cap) return chars.flatMap((k) => byChar[k]);

  const windowOf = (list, n, offset) => {
    if (n >= list.length) return list;
    const start = ((offset % list.length) + list.length) % list.length;
    const out = [];
    for (let i = 0; i < n; i++) out.push(list[(start + i) % list.length]);
    return out;
  };

  const quotas = chars.map((k) => ({
    k,
    n: Math.max(1, Math.floor((byChar[k].length / volumes.length) * cap)),
  }));
  let total = quotas.reduce((s, q) => s + q.n, 0);
  // Hand any rounding slack to the biggest shelves first.
  const order = quotas.slice().sort((a, b) => byChar[b.k].length - byChar[a.k].length);
  let i = 0;
  while (total > cap && order.length) {
    const q = order[i % order.length];
    if (q.n > 1) { q.n--; total--; }
    i++;
    if (i > chars.length * 40) break;
  }
  i = 0;
  while (total < cap && order.length) {
    const q = order[i % order.length];
    if (q.n < byChar[q.k].length) { q.n++; total++; }
    i++;
    if (i > chars.length * 40) break;
  }
  return quotas.flatMap((q, idx) => windowOf(byChar[q.k], q.n, seed + idx * 7));
}

// No cover is ever laid twice. A repeat would put the same book on the wall in two
// places, which is exactly what a shelf cannot do, so a library smaller than the
// grid leaves the leftover tiles on their own empty grey and the wall fills in as
// the collection gets photographed.
//
// The covers are scattered across the grid rather than packed into the first
// tiles: a filled block above empty ones would read as a loading state. Both the
// order and the positions come from the session seed, like the shelf and unlike
// the suggestion, so the wall holds still while you use the page and is dealt
// again on every reload.
function buildBackdrop(volumes, count, seed) {
  const urls = volumes.map((v) => miniUrl(v) || coverUrl(v)).filter(Boolean);
  if (urls.length === 0) return [];
  const slots = new Array(count).fill(null);
  const todas = Array.from({ length: count }, (_, i) => i);
  const posicoes = seededPick(todas, Math.min(urls.length, count), seed);
  const capas = seededPick(urls, urls.length, seed + 1);
  posicoes.forEach((p, i) => { slots[p] = capas[i]; });
  return slots;
}

function Hub({
  lib, stats, docUsage, edicoesPorSerie, ownedIds,
  onOpenVolume, onOpenSerie, onNovo, onEnter, sentinelRef, rootRef, returning,
}) {
  const vazia = lib.volumes.length === 0 && lib.series.length === 0;
  const cores = useCores();

  // Picked once per visit to the hub, so it stays put while you use the page
  // but is different the next time you come back.
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 100000));
  const sugestao = lib.volumes.length ? lib.volumes[seed % lib.volumes.length] : null;
  const outraSugestao = () => setSeed((s) => s + 1 + Math.floor(Math.random() * 7));

  const shelf = useMemo(() => buildShelf(lib.volumes, SHELF_CAP, SESSION_SEED), [lib.volumes]);
  const miniVersao = useMiniVersao();
  const backdrop = useMemo(
    () => buildBackdrop(lib.volumes, BACKDROP_ROWS * BACKDROP_COLS, SESSION_SEED),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lib.volumes, miniVersao]
  );

  if (vazia) {
    return (
      <div className="hub" ref={rootRef} data-returning={returning ? "true" : "false"}>
        <EmptyState icon={BookOpen} title="Sua caixa está vazia">
          Comece catalogando um volume. Depois dá para cadastrar as séries e marcar quais
          edições cada volume coleta.
        </EmptyState>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button className="btn btn-primary" onClick={onNovo}>
            <Plus size={15} /> Catalogar o primeiro volume
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hub" ref={rootRef} data-returning={returning ? "true" : "false"}>
      {backdrop.length > 0 && (
        <GridMotion items={backdrop} rows={BACKDROP_ROWS} cols={BACKDROP_COLS} />
      )}
      {sugestao && (
        <section className="suggest">
          <div className="suggest-cover">
            <div className="cover" style={{ "--edge": coverColors(sugestao, cores).edge }}>
              <CoverArt volume={sugestao} grande />
            </div>
          </div>
          <div className="suggest-body">
            <p className="t-micro" style={{ margin: 0 }}>Do seu acervo</p>
            <h2 className="suggest-title">{sugestao.titulo}</h2>
            <p className="t-small muted" style={{ margin: "4px 0 0" }}>
              {sugestao.personagem}
              {sugestao.tipo ? " · " + sugestao.tipo : ""}
            </p>
            <div className="suggest-actions">
              <button className="btn btn-primary" onClick={() => onOpenVolume(sugestao.id)}>Abrir</button>
              <button className="btn btn-quiet" onClick={outraSugestao}>
                <Shuffle size={14} /> Outro
              </button>
            </div>
          </div>
        </section>
      )}

      {stats.faltaPouco.length > 0 && (
        <section>
          <div className="hub-section-head">
            <h2>Falta pouco</h2>
            {stats.quaseFechando > 3 && (
              <span className="group-count">
                {stats.quaseFechando} passaram de {Math.round(QUASE_FECHANDO * 100)}%
              </span>
            )}
          </div>
          <div className="prog">
            {stats.faltaPouco.map((p) => (
              <HuntRow
                key={p.serie.id}
                item={p}
                onClick={() => onOpenSerie(p.serie.id)}
              />
            ))}
          </div>
        </section>
      )}

      {stats.faltaPouco.length === 0 && lib.series.length > 0 && (
        <section>
          <div className="hub-section-head">
            <h2>Falta pouco</h2>
          </div>
          <p className="hub-note">
            {stats.temMetas
              ? "Nenhuma série passou de " + Math.round(QUASE_FECHANDO * 100) +
                "% ainda. Quando uma chegar lá, ela aparece aqui."
              : 'Preencha "total de edições" nas séries para acompanhar aqui o que falta fechar.'}
          </p>
        </section>
      )}

      <section>
        <div className="hub-section-head">
          <h2>Sua estante</h2>
          {lib.volumes.length > shelf.length && (
            <span className="group-count">{shelf.length} de {lib.volumes.length}</span>
          )}
        </div>
        <div className="wall">
          {shelf.map((v) => (
            <VolumeCard key={v.id} volume={v} index={0} open={false} bare onClick={() => onOpenVolume(v.id)} />
          ))}
        </div>
      </section>

      <div className="hub-foot">
        <div className="hub-figures">
          <div className="hub-figure">
            <span>{lib.volumes.length}</span>
            <small>volumes</small>
          </div>
          <div className="hub-figure">
            <span>{lib.series.length}</span>
            <small>séries</small>
          </div>
          <div className="hub-figure">
            <span>{stats.totalPossuidas}</span>
            <small>edições possuídas</small>
          </div>
        </div>

        <div className="hub-storage">
          <div className="hub-storage-top">
            <span className="t-micro" style={{ margin: 0 }}>Maior documento</span>
            <span className="num t-small muted">{formatBytes(docUsage.maior.bytes)} de 256 KB</span>
          </div>
          <div className="meter">
            <i style={{ width: Math.min(docUsage.pct, 100) + "%" }} data-over={docUsage.pct > 80 ? "true" : "false"} />
          </div>
          <p className="t-small muted">{docUsage.maior.nome}</p>
          {docUsage.pct > 80 && (
            <p className="t-small hub-storage-warn">
              Chegando no limite. Me avise para reestruturar o armazenamento.
            </p>
          )}
        </div>
      </div>

      <button className="hub-enter" onClick={onEnter}>
        Continue rolando para abrir sua coleção
        <ChevronDown size={15} />
      </button>

      <div ref={sentinelRef} style={{ height: 1, marginTop: -1 }} aria-hidden="true" />
    </div>
  );
}

function HuntRow({ item, onClick }) {
  const faltam = item.total - item.owned;
  return (
    <button className="prog-row press" onClick={onClick}>
      <div className="prog-top">
        <span className="t-small truncate" style={{ fontWeight: 500 }}>{item.serie.nome}</span>
        <span className="num t-small" style={{ flexShrink: 0, color: "var(--accent-text)" }}>
          {faltam === 1 ? "falta 1" : "faltam " + faltam}
        </span>
      </div>
      <HuntProgress owned={item.owned} total={item.total} />
    </button>
  );
}

function Toast({ message }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const r1 = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(r1);
  }, []);
  return <div className="toast" data-in={shown ? "true" : "false"} role="status">{message}</div>;
}

/* ============================ volume sheet ============================ */

function VolumeSheet({
  volume, onClose, onEdit, onDuplicate, onDelete, onStatus, colecoes, grupos,
  canUpload, uploading, onCoverPick, series, edicoesPorSerie,
  linkSerieId, setLinkSerieId, linkPickSerie, setLinkPickSerie,
  rangeDe, setRangeDe, rangeAte, setRangeAte, avulsoNum, setAvulsoNum,
  onRange, onAvulsa, onToggle, onOpenEdicaoNaSerie, recede,
}) {
  const inputRef = useRef(null);
  const kept = useRef(null);
  if (volume) kept.current = volume;
  const v = volume || kept.current;

  usePasteImage(!!volume && canUpload, onCoverPick);

  return (
    <Sheet
      open={!!volume}
      onClose={onClose}
      recede={recede}
      title={v ? v.titulo : ""}
      subtitle={v ? v.personagem : null}
      actions={v && (
        <>
          <button className="btn-icon" onClick={onEdit} aria-label="Editar"><Pencil size={16} /></button>
          <button className="btn-icon" onClick={onDuplicate} aria-label="Duplicar este volume"><Copy size={16} /></button>
          <button className="btn-icon" onClick={onDelete} aria-label="Remover">
            <Trash2 size={16} color="var(--danger-text)" />
          </button>
        </>
      )}
    >
      {v && (
        <>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div className="detail-cover">
              <div className="cover"><CoverArt volume={v} grande /></div>
              {canUpload && (
                <>
                  <button className="cover-upload" onClick={() => inputRef.current && inputRef.current.click()} disabled={uploading}>
                    <ImagePlus size={13} />
                    {uploading ? "Enviando" : v.capaAssetId ? "Trocar capa" : "Adicionar capa"}
                  </button>
                  <p className="cover-paste-hint">ou cole a imagem com Ctrl+V</p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    hidden
                    onChange={(e) => { onCoverPick(e.target.files[0]); e.target.value = ""; }}
                  />
                </>
              )}
            </div>
            <dl className="deflist" style={{ flex: 1, minWidth: 0 }}>
              <dt>Tipo</dt><dd>{v.tipo}</dd>
              {v.editora && <><dt>Editora</dt><dd>{v.editora}</dd></>}
              {v.ano && <><dt>Ano</dt><dd className="num">{v.ano}</dd></>}
              {colecoes.length > 0 && (
                <><dt>Coleções</dt><dd>{colecoes.map((c) => c.nome).join(", ")}</dd></>
              )}
            </dl>
          </div>

          <div>
            <p className="t-micro" style={{ margin: "0 0 8px" }}>Status de leitura</p>
            <div className="seg3">
              {STATUS_ORDER.map((k) => (
                <button key={k} data-kind={k} data-on={v.status === k ? "true" : "false"} onClick={() => onStatus(k)}>
                  {STATUS[k].label}
                </button>
              ))}
            </div>
          </div>

          {v.notas && (
            <div>
              <p className="t-micro" style={{ margin: "0 0 6px" }}>Notas</p>
              <p className="t-small" style={{ margin: 0 }}>{v.notas}</p>
            </div>
          )}

          <div>
            <p className="t-micro" style={{ margin: "0 0 8px" }}>Edições coletadas</p>
            {grupos.length === 0 && (
              <p className="t-small muted" style={{ margin: "0 0 10px" }}>Nenhuma edição vinculada ainda.</p>
            )}
            {grupos.map((g) => (
              <div className="linked-serie" key={g.serie ? g.serie.id : "removida"}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                  <span className="t-small truncate" style={{ fontWeight: 500 }}>
                    {g.serie ? g.serie.nome : "Série removida"}
                  </span>
                  {g.serie && (
                    <button
                      className="btn btn-ghost"
                      style={{ padding: 0, fontSize: "0.75rem", color: "var(--accent-text)" }}
                      onClick={() => { setLinkSerieId(g.serie.id); setLinkPickSerie(g.serie.id); }}
                    >
                      Gerenciar
                    </button>
                  )}
                </div>
                <div className="tiles" style={{ marginTop: 8 }}>
                  {g.edicoes.map((e) => (
                    g.serie ? (
                      <button
                        type="button"
                        className="tile"
                        data-owned="true"
                        key={e.id}
                        onClick={() => onOpenEdicaoNaSerie(g.serie.id, e.id)}
                      >
                        {e.numero}
                      </button>
                    ) : (
                      <span className="tile" data-owned="true" key={e.id}>{e.numero}</span>
                    )
                  ))}
                </div>
              </div>
            ))}

            {linkSerieId === null ? (
              <button
                className="btn btn-quiet"
                style={{ width: "100%", marginTop: 4 }}
                onClick={() => { setLinkSerieId("__pick__"); setLinkPickSerie(""); }}
              >
                <Link2 size={14} /> Vincular edições de uma série
              </button>
            ) : linkSerieId === "__pick__" ? (
              <div className="linked-serie">
                <Field label="Série">
                  <select className="select" value={linkPickSerie} onChange={(e) => setLinkPickSerie(e.target.value)}>
                    <option value="">Escolha a série</option>
                    {series.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </Field>
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setLinkSerieId(null)}>Cancelar</button>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => { if (linkPickSerie) setLinkSerieId(linkPickSerie); }}
                  >
                    Continuar
                  </button>
                </div>
              </div>
            ) : (
              <LinkPanel
                volume={v}
                serie={series.find((s) => s.id === linkSerieId)}
                edicoesDaSerie={(edicoesPorSerie[linkSerieId] || []).slice().sort((a, b) => (parseNum(a.numero) ?? 1e9) - (parseNum(b.numero) ?? 1e9))}
                rangeDe={rangeDe} setRangeDe={setRangeDe}
                rangeAte={rangeAte} setRangeAte={setRangeAte}
                avulsoNum={avulsoNum} setAvulsoNum={setAvulsoNum}
                onRange={onRange} onAvulsa={onAvulsa} onToggle={onToggle}
                onClose={() => setLinkSerieId(null)}
              />
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}

function LinkPanel({
  volume, serie, edicoesDaSerie, rangeDe, setRangeDe, rangeAte, setRangeAte,
  avulsoNum, setAvulsoNum, onRange, onAvulsa, onToggle, onClose,
}) {
  if (!serie) return null;
  return (
    <div className="linked-serie">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginBottom: 12 }}>
        <span className="t-small truncate" style={{ fontWeight: 500 }}>{serie.nome}</span>
        <button className="btn btn-ghost" style={{ padding: 0, fontSize: "0.75rem" }} onClick={onClose}>Fechar</button>
      </div>

      <Field label="Vincular um intervalo">
        <div className="row">
          <input className="input" type="number" placeholder="de" value={rangeDe} onChange={(e) => setRangeDe(e.target.value)} />
          <input className="input" type="number" placeholder="até" value={rangeAte} onChange={(e) => setRangeAte(e.target.value)} />
          <button className="btn btn-primary" onClick={onRange}>Vincular</button>
        </div>
      </Field>

      <div style={{ height: 12 }} />

      <Field label="Vincular uma avulsa">
        <div className="row">
          <input className="input" placeholder="Anual 1" value={avulsoNum} onChange={(e) => setAvulsoNum(e.target.value)} />
          <button className="btn btn-primary" onClick={onAvulsa}>Vincular</button>
        </div>
      </Field>

      <div style={{ height: 14 }} />

      <p className="t-micro" style={{ margin: "0 0 6px" }}>Edições catalogadas</p>
      <div style={{ maxHeight: 190, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {edicoesDaSerie.length === 0 && (
          <p className="t-small muted" style={{ margin: 0 }}>Nenhuma edição catalogada nesta série ainda.</p>
        )}
        {edicoesDaSerie.map((ed) => (
          <label className="checkline" key={ed.id}>
            <input
              type="checkbox"
              checked={volume.edicoesColetadasIds.includes(ed.id)}
              onChange={() => onToggle(ed.id)}
            />
            <span className="num">{ed.numero}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/* ============================ serie sheet ============================ */

function SerieSheet({
  serie, contexto, verTudo, setVerTudo, edicoes, ownedIds, volumesQueColetam,
  busca, setBusca, selectedId, setSelectedId, onClose, onEdit, onDelete,
  onImport, onNovaEdicao, onEditEdicao, onDeleteEdicao,
}) {
  const kept = useRef(null);
  if (serie) kept.current = serie;
  const s = serie || kept.current;

  const edsTotal = useMemo(() => (
    edicoes.slice().sort((a, b) => {
      const na = sortKey(a), nb = sortKey(b);
      if (na === null && nb === null) return a.numero.localeCompare(b.numero, "pt-BR");
      if (na === null) return 1;
      if (nb === null) return -1;
      return na - nb;
    })
  ), [edicoes]);

  const faixaAtiva = contexto && (contexto.de !== null || contexto.ate !== null) && !verTudo;
  const eds = useMemo(() => {
    if (!faixaAtiva) return edsTotal;
    return edsTotal.filter((e) => {
      const n = sortKey(e);
      if (n === null) return false;
      if (contexto.de !== null && n < contexto.de) return false;
      if (contexto.ate !== null && n > contexto.ate) return false;
      return true;
    });
  }, [edsTotal, faixaAtiva, contexto]);

  const edsFiltradas = busca.trim()
    ? eds.filter((e) => e.numero.toLowerCase().includes(busca.trim().toLowerCase()))
    : eds;
  const ownedCount = eds.filter((e) => ownedIds.has(e.id)).length;
  const selecionada = eds.find((e) => e.id === selectedId);
  const useGroups = !busca.trim() && eds.length > 60;

  const grupos = useMemo(() => {
    if (!useGroups) return null;
    const g = {};
    edsFiltradas.forEach((e) => {
      const sk = sortKey(e);
      const start = sk === null ? "outras" : Math.floor(sk / 100) * 100;
      const key = sk === null ? "outras" : String(start);
      if (!g[key]) {
        g[key] = { label: sk === null ? "Especiais e sem número" : "Nº " + start + "-" + (start + 99), itens: [] };
      }
      g[key].itens.push(e);
    });
    return g;
  }, [useGroups, edsFiltradas]);

  const renderTile = (e) => (
    <button
      key={e.id}
      className="tile"
      data-owned={ownedIds.has(e.id) ? "true" : "false"}
      data-sel={e.id === selectedId ? "true" : "false"}
      onClick={() => setSelectedId(e.id === selectedId ? null : e.id)}
    >
      {e.numero}
    </button>
  );

  return (
    <Sheet
      open={!!serie}
      onClose={onClose}
      title={s ? s.nome : ""}
      subtitle={s ? anoRange(s) + (s.editora ? " · " + s.editora : "") : null}
      actions={s && (
        <>
          <button className="btn-icon" onClick={onEdit} aria-label="Editar"><Pencil size={16} /></button>
          <button className="btn-icon" onClick={onDelete} aria-label="Remover">
            <Trash2 size={16} color="var(--danger-text)" />
          </button>
        </>
      )}
    >
      {s && (
        <>
          {contexto && (contexto.de !== null || contexto.ate !== null) && (
            <div className="banner" style={{ marginBottom: 0 }}>
              <div>
                Mostrando as edições {contexto.de ?? "?"} a {contexto.ate ?? "?"}, a faixa de{" "}
                {contexto.nome}.{" "}
                <button
                  className="btn btn-ghost"
                  style={{ padding: 0, fontSize: "0.8125rem", color: "var(--accent-text)" }}
                  onClick={() => setVerTudo(!verTudo)}
                >
                  {verTudo ? "Aplicar a faixa" : "Ver todas"}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span className="num t-small muted">
              {ownedCount} de {eds.length} possuídas
              {s.totalEdicoes ? " (meta " + s.totalEdicoes + ")" : ""}
            </span>
            <div className="row">
              <button className="btn btn-quiet" onClick={onImport}><Upload size={13} /> Importar</button>
              <button className="btn btn-quiet" onClick={onNovaEdicao}><Plus size={13} /> Edição</button>
            </div>
          </div>

          {eds.length === 0 ? (
            <p className="t-small muted" style={{ margin: 0 }}>
              Nenhuma edição catalogada ainda. Dá pra cadastrar nº 0, anuais e fracionárias como 12.1.
            </p>
          ) : (
            <div>
              {eds.length > 20 && (
                <div className="search" style={{ marginBottom: 12 }}>
                  <Search size={14} />
                  <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar número" />
                </div>
              )}
              <p className="t-micro" style={{ margin: "0 0 8px" }}>
                Toque num número para ver se você tem e em qual volume
              </p>

              {useGroups ? (
                Object.keys(grupos)
                  .sort((a, b) => (a === "outras" ? 1 : b === "outras" ? -1 : parseFloat(a) - parseFloat(b)))
                  .map((key) => {
                    const g = grupos[key];
                    const owned = g.itens.filter((e) => ownedIds.has(e.id)).length;
                    return (
                      <details className="bucket" key={key}>
                        <summary>
                          {g.label} <span className="muted">{owned}/{g.itens.length}</span>
                        </summary>
                        <div className="tiles">{g.itens.map(renderTile)}</div>
                      </details>
                    );
                  })
              ) : (
                <div className="tiles">
                  {edsFiltradas.length === 0
                    ? <p className="t-small muted" style={{ margin: 0 }}>Nada encontrado para "{busca}".</p>
                    : edsFiltradas.map(renderTile)}
                </div>
              )}

              {selecionada && (
                <div className="linked-serie edicao-pinned">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <span className="t-title num">Nº {selecionada.numero}</span>
                    <div className="row">
                      <button className="btn-icon" onClick={() => onEditEdicao(selecionada)} aria-label="Editar edição"><Pencil size={14} /></button>
                      <button className="btn-icon" onClick={() => onDeleteEdicao(selecionada)} aria-label="Remover edição">
                        <Trash2 size={14} color="var(--danger-text)" />
                      </button>
                      <button className="btn-icon" onClick={() => setSelectedId(null)} aria-label="Fechar"><X size={14} /></button>
                    </div>
                  </div>
                  <p className="t-small muted" style={{ margin: "4px 0 0" }}>
                    {selecionada.mes || selecionada.ano
                      ? (selecionada.mes || "?") + "/" + (selecionada.ano || "?")
                      : "Sem data"}
                  </p>
                  {selecionada.posicao !== null && selecionada.posicao !== undefined && (
                    <p className="t-small num" style={{ margin: "4px 0 0", color: "var(--accent-text)" }}>
                      Posição manual no checklist: {selecionada.posicao}
                    </p>
                  )}
                  <p className="t-micro" style={{ margin: "12px 0 6px" }}>Você tem em</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {volumesQueColetam(selecionada.id).length === 0
                      ? <span className="chip">Nenhum volume vinculado</span>
                      : volumesQueColetam(selecionada.id).map((v) => (
                          <span className="chip" key={v.id}><Check size={12} color="var(--read)" /> <strong>{v.titulo}</strong></span>
                        ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}

createRoot(document.getElementById("root")).render(<App />);
