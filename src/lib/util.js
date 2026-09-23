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
