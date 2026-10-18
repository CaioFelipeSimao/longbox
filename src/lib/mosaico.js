import { EMBLEMAS } from "./emblemas";
// Keep this module independent of constantes, which imports React icons.
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function volumesDoEmblema(emblema, volumes) {
  const pool = new Set(emblema.pool);
  const vistos = new Set();
  return volumes.filter((v) => {
    const pertence = pool.has(v.personagem) || (Array.isArray(v.tambem) && v.tambem.some((p) => pool.has(p.personagem)));
    if (!pertence || vistos.has(v.id)) return false;
    vistos.add(v.id);
    return true;
  });
}

export function distribuirCapas(linhas, ids, seed) {
  const unicos = [...new Set(ids)];
  if (!unicos.length) return [];
  const rnd = mulberry32(seed);
  const embaralhar = () => {
    const a = unicos.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  let fila = embaralhar();
  const grade = new Map(), out = [];
  linhas.forEach((linha, r) => [...linha].forEach((c, q) => {
    if (c !== "#") return;
    const esquerda = grade.get(r + "," + (q - 1));
    const cima = grade.get((r - 1) + "," + q);
    let id;
    if (unicos.length === 1) id = unicos[0];
    else if (unicos.length === 2) {
      // With two covers, grid parity guarantees different neighbours. Some
      // molds (Aquaman) start with two cells of the same parity in a single
      // connected component: first-use uniqueness is impossible there.
      id = fila[(r + q) % 2];
    } else {
      if (!fila.length) fila = embaralhar();
      const indice = fila.findIndex((v) => v !== esquerda && v !== cima);
      if (indice >= 0) id = fila.splice(indice, 1)[0];
      else {
        // The remaining queue can contain only blocked neighbours. Defer those
        // ids and draw an allowed one. This never happens in the first deal:
        // every earlier id there was unique, so every unseen id is allowed.
        const permitidos = unicos.filter((v) => v !== esquerda && v !== cima);
        id = permitidos[Math.floor(rnd() * permitidos.length)];
      }
    }
    grade.set(r + "," + q, id);
    out.push(id);
  }));
  return out;
}

export function numerosDoPersonagem(volumesDoPool, edicoes) {
  const coletadas = new Set(volumesDoPool.flatMap((v) => v.edicoesColetadasIds || []));
  const anos = edicoes.filter((e) => coletadas.has(e.id))
    .map((e) => typeof e.ano === "number" || (typeof e.ano === "string" && e.ano.trim()) ? Number(e.ano) : NaN)
    .filter(Number.isFinite);
  const tipos = new Map();
  volumesDoPool.forEach((v) => { if (v.tipo) tipos.set(v.tipo, (tipos.get(v.tipo) || 0) + 1); });
  return {
    volumes: volumesDoPool.length,
    lidos: volumesDoPool.filter((v) => v.status === "lida").length,
    edicoesColetadas: coletadas.size,
    anoDe: anos.length ? Math.min(...anos) : null,
    anoAte: anos.length ? Math.max(...anos) : null,
    formatos: [...tipos].map(([tipo, contagem]) => ({ tipo, contagem }))
      .sort((a, b) => b.contagem - a.contagem || a.tipo.localeCompare(b.tipo, "pt-BR")).slice(0, 3),
  };
}

export function sortearEmblema(lib, seed, excluirId) {
  const possiveis = EMBLEMAS.filter((e) => volumesDoEmblema(e, lib.volumes).length > 0);
  const outros = possiveis.filter((e) => e.id !== excluirId);
  const candidatos = outros.length ? outros : possiveis;
  return candidatos.length ? candidatos[Math.floor(mulberry32(seed)() * candidatos.length)] : null;
}
