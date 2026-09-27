export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

export function parseNum(numero) {
  if (numero === null || numero === undefined || numero === "") return null;
  const m = String(numero).trim().match(/^\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

export function sortKey(e) {
  if (e.posicao !== null && e.posicao !== undefined && e.posicao !== "") {
    const p = parseFloat(e.posicao);
    if (!isNaN(p)) return p;
  }
  return parseNum(e.numero);
}

export function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// v106: the most prominent colour of a small RGBA pixel array (a cover drawn at
// 16x24), as a CSS colour, or null when most pixels are near-black, near-white or
// grey. Pixels are grouped in 20-degree hue bins weighted by saturation; the heaviest
// bin wins, averaged within itself. Lightness is fixed at 45% and saturation clamped
// to 35-80%, so every wash drawn from it has the same strength.
export function corDosPixels(px) {
  const grupos = Array.from({ length: 18 }, () => ({ peso: 0, h: 0, s: 0 }));
  let votos = 0;
  const total = px.length / 4;
  for (let i = 0; i < px.length; i += 4) {
    const [h, s, l] = rgbParaHsl(px[i], px[i + 1], px[i + 2]);
    if (s < 0.25 || l < 0.12 || l > 0.9) continue;
    const g = grupos[Math.floor(h / 20) % 18];
    g.peso += s; g.h += h * s; g.s += s * s;
    votos++;
  }
  const top = grupos.reduce((a, b) => (b.peso > a.peso ? b : a));
  if (votos < total * 0.15 || !top.peso) return null;
  const h = Math.round(top.h / top.peso);
  const s = Math.round(Math.min(0.8, Math.max(0.35, top.s / top.peso)) * 100);
  return "hsl(" + h + " " + s + "% 45%)";
}

function rgbParaHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
