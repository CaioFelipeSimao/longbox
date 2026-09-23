import React, { useContext } from "react";

import { ACCENT_HUE } from "./constantes";
import { hashString } from "./util";

// 24 hues at the house saturation, skipping the band around the interface accent
// so a character edge never competes with it, plus 8 specials that need their own
// saturation and lightness. Past roughly two dozen hues, neighbours stop being
// tellable apart in a 3px strip, which is why the extras vary depth, not hue.
// Chromatic entries sit in hue order, so the grid reads as one gradation and the
// deeper reds, greens and the navy land beside their own family rather than in a
// bolt-on tail. Neutrals have no hue to sort by, so they get their own group.
export const PALETA_CROMATICA = [
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
export const COR_LONGBOX = { longbox: true };
export const LONGBOX_HSL = { h: 188, s: 100, l: 42 }; // #00B8D4, the accent

export const PALETA_NEUTRA = [
  { h: 220, s: 5, l: 38 },              // preto
  { h: 220, s: 6, l: 70 },              // cinza
  { h: 40, s: 14, l: 96, light: true }, // branco
  COR_LONGBOX,                          // ciano Longbox
];

export const PALETA = PALETA_CROMATICA.concat(PALETA_NEUTRA);

export function specForCharacter(personagem, cores) {
  const who = (personagem || "?").trim().toLowerCase();
  const escolhido = cores && cores[who];
  // Values written before the palette carried saturation were bare hues.
  if (typeof escolhido === "number") return { h: escolhido };
  if (escolhido && typeof escolhido === "object") return escolhido;
  let hue = hashString(who) % 360;
  if (Math.abs(hue - ACCENT_HUE) < 22) hue = (hue + 46) % 360;
  return { h: hue };
}

export function sameSpec(a, b) {
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
export const INK_ESCURA = "#04191E";
export const INK_CLARA = "#FFFFFF";

export function canalLinear(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function luminancia([r, g, b]) {
  return 0.2126 * canalLinear(r) + 0.7152 * canalLinear(g) + 0.0722 * canalLinear(b);
}

export function hslParaRgb(h, s, l) {
  const S = s / 100;
  const L = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

export function contraste(l1, l2) {
  const a = Math.max(l1, l2);
  const b = Math.min(l1, l2);
  return (a + 0.05) / (b + 0.05);
}

// The ink that reads on this fill, not the one the theme happens to name.
export function tintaSobre(h, s, l) {
  const fundo = luminancia(hslParaRgb(h, s, l));
  const escura = contraste(fundo, luminancia([4, 25, 30]));
  const clara = contraste(fundo, luminancia([255, 255, 255]));
  return escura >= clara ? INK_ESCURA : INK_CLARA;
}

// A name for every swatch, shown on hover (v67). Kept beside the palette rather
// than inside each spec, because a picked spec is written to the database as is
// and the name has no business there. Keyed on the spec's own numbers, so a name
// cannot drift onto a neighbour if the palette is ever reordered.
export const chaveCor = (s) => [s.h, s.s === undefined ? "" : s.s, s.l === undefined ? "" : s.l, s.light ? "c" : ""].join("|");
export const NOMES_COR = new Map([
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
export function nomeDaCor(spec) {
  if (spec && spec.longbox) return "Ciano Longbox";
  return (spec && NOMES_COR.get(chaveCor(spec))) || "Cor";
}

export function swatchColors(spec, lift) {
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
export function coverColors(volume, cores) {
  const spec = specForCharacter(volume.personagem || volume.titulo, cores);
  const lift = (hashString(volume.titulo || "?") % 11) - 5;
  return swatchColors(spec, lift);
}

export const CoresContext = React.createContext(null);
export function useCores() { return useContext(CoresContext); }
