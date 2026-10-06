import { BookOpen, Layers, Library } from "lucide-react";

export const STATUS = {
  nao_lida: { label: "Não lida" },
  lendo: { label: "Lendo" },
  lida: { label: "Lida" },
};
export const STATUS_ORDER = ["nao_lida", "lendo", "lida"];
// v95: formats belong to publishers. Four exist for any publisher; each publisher
// adds its own lines, keyed by its name in lower case (the same comparison the
// publisher band uses). A publisher with no entry offers the common four only.
// The cataloguing skill reads these two constants from this file, so a new
// publisher or format is added here and nowhere else.
export const TIPOS_COMUNS = ["Trade Paperback", "Omnibus", "Hardcover", "Outro"];
export const TIPOS_POR_EDITORA = {
  "dc comics": ["Compendium", "Absolute Edition", "DC Finest"],
  "marvel comics": ["Epic Collection", "Marvel Masterworks"],
};
// Every format any publisher offers: the band's "Todas as editoras" filter, and
// the check that a saved filter still names a real format.
export const TIPOS = [
  "Trade Paperback",
  ...Object.values(TIPOS_POR_EDITORA).flat(),
  "Omnibus", "Hardcover", "Outro",
];
// A trailing " Comics" is ignored, so a publisher registered as "Marvel" still gets
// Marvel's formats (the harness and a hand-made entry both spell it that way).
export function chaveEditora(nome) {
  const k = (nome || "").trim().toLowerCase();
  return k.endsWith(" comics") ? k : k + " comics";
}
// Trade Paperback first (the default), then the publisher's own lines, then the
// rest of the common ones, "Outro" last.
export function tiposDaEditora(nome) {
  const proprios = TIPOS_POR_EDITORA[chaveEditora(nome)] || [];
  return ["Trade Paperback", ...proprios, "Omnibus", "Hardcover", "Outro"];
}
// Format names that were renamed after volumes were already stored with them
// (v77: "Encadernado (TPB)" became "Trade Paperback"; v78: "Capa Dura" became
// "Hardcover" and "Edição Absoluta" became "Absolute Edition"). normalizeLib rewrites
// them on load, so the stored value catches up on the next save.
export const TIPOS_RENOMEADOS = {
  "Encadernado (TPB)": "Trade Paperback",
  "Capa Dura": "Hardcover",
  "Edição Absoluta": "Absolute Edition",
};
export const DOC_LIMIT = 256 * 1024;
export const IMG_TYPES = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
};

// Module scope, not inside the component: SegmentedTabs' mount effect keys off
// this array's own identity to decide whether to re-measure, and a literal
// redeclared every render would look like a new array on every unrelated
// state change elsewhere in the app, forcing a gsap.set() that stomped any
// elastic tween already in flight. One stable array, read by both the mobile
// tabbar and the desktop segmented control.
export const TABS = [
  { key: "volumes", label: "HQs", icon: BookOpen },
  { key: "colecoes", label: "Coleções", icon: Layers },
  { key: "series", label: "Séries", icon: Library },
];

export const ACCENT_HUE = 187; // the cyan the UI owns; character hues steer clear of it
export const ACCENT_HEX = "#00B8D4"; // mirrors --accent; the lattice paints on canvas and cannot read a var
export const QUASE_FECHANDO = 0.5; // a series only counts as "almost there" past this
export const QUASE_MORNO = 0.65; // past this the hunt bar leaves its warm, needs-attention tier
export const QUASE_PRONTO = 0.8; // past this the hunt bar reads as nearly closed, not just started
// v140: four full rows on the user's PC, where the wall fits 21 a row (60 left the third
// row three short). 84 also fills the rows of 4, 6, 7, 12 and 14 on other widths.
export const SHELF_CAP = 84;
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
export const BACKDROP_ROWS = 6;
export const BACKDROP_COLS = 13;

// Drawn once per page load, so the shelf and the hunt rotate between visits but
// hold still while you use the page.
export const SESSION_SEED = Math.floor(Math.random() * 1e9);

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededPick(arr, n, seed) {
  const rnd = mulberry32(seed);
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = copy[i]; copy[i] = copy[j]; copy[j] = t;
  }
  return copy.slice(0, n);
}

export const EMPTY_LIB = {
  volumes: [], colecoes: [], desejos: [], desejosColecoes: [], series: [], edicoes: [], cores: {},
  editoras: [], editoraSel: null,
};

export const ED_TODAS = "__todas__";
export const ED_SEM = "__sem__";

export function slugify(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "editora";
}

// The publisher a volume or series already carries, normalised for comparison.
export function editoraDe(item) {
  return ((item && item.editora) || "").trim();
}

// One owned volume can appear under several publishers, each with its character.
export function presencas(v) {
  const vistos = new Set();
  const pares = [v, ...(Array.isArray(v?.tambem) ? v.tambem : [])];
  return pares.flatMap((p) => {
    const editora = typeof p?.editora === "string" ? p.editora.trim() : "";
    const chave = editora.toLowerCase();
    if (!editora || vistos.has(chave)) return [];
    vistos.add(chave);
    return [{ editora, personagem: typeof p.personagem === "string" ? p.personagem.trim() : "" }];
  });
}

export function editorasDe(item) {
  return presencas(item).map((p) => p.editora);
}

export function naFaixa(v, nomeEditora) {
  const chave = (nomeEditora || "").trim().toLowerCase();
  const p = presencas(v).find((x) => x.editora.toLowerCase() === chave);
  return p ? { ...v, editora: p.editora, personagem: p.personagem } : null;
}

// Publishers are discovered from data the user already entered, so the selector
// is populated without any setup step.
export function editorasDescobertas(lib) {
  const vistos = new Map();
  [...lib.volumes, ...lib.series].forEach((x) => {
    editorasDe(x).forEach((nome) => {
      const chave = nome.toLowerCase();
      if (!vistos.has(chave)) vistos.set(chave, nome);
    });
  });
  return [...vistos.values()];
}
