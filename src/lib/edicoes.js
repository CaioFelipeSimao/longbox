// v145: campos opcionais da edição. Edições antigas não os têm, então toda leitura
// passa por aqui em vez de olhar e.autores direto.
const dobrar = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const FUNCOES = ["writer", "penciler", "inker"];

export function autoresDe(e) {
  const a = (e && e.autores) || {};
  const lista = (f) => (Array.isArray(a[f]) ? a[f].map((n) => String(n).trim()).filter(Boolean) : []);
  return { writer: lista("writer"), penciler: lista("penciler"), inker: lista("inker") };
}

export function textoAutores(e) {
  const a = autoresDe(e);
  return FUNCOES.flatMap((f) => a[f]).join(" ").toLowerCase();
}

export const ehReimpressao = (e) => !!e && e.reimpressao === true;

export function parseAutores(texto) {
  const vistos = new Set();
  return String(texto || "").split(/[;,]/).map((n) => n.trim()).filter((n) => {
    if (!n || vistos.has(dobrar(n))) return false;
    vistos.add(dobrar(n));
    return true;
  });
}

export function autoresPossuidos(edicoes, ownedIds) {
  const n = {};
  edicoes.forEach((e) => {
    if (!ownedIds.has(e.id)) return;
    const a = autoresDe(e);
    const deste = new Set(FUNCOES.flatMap((f) => a[f]).map(dobrar));
    FUNCOES.flatMap((f) => a[f]).forEach((nome) => {
      const k = dobrar(nome);
      if (!deste.has(k)) return;
      deste.delete(k);
      (n[k] = n[k] || { nome, n: 0 }).n++;
    });
  });
  return Object.values(n).sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
}

// parcial=false: o nome inteiro (filtro). parcial=true: um pedaco do nome (busca livre).
export function serieTemAutor(eds, ownedIds, nome, parcial = false) {
  const alvo = dobrar(nome);
  if (!alvo) return false;
  const casa = (x) => (parcial ? dobrar(x).includes(alvo) : dobrar(x) === alvo);
  return eds.some((e) => ownedIds.has(e.id) && FUNCOES.some((f) => autoresDe(e)[f].some(casa)));
}

export const serieTemReimpressao = (eds) => eds.some(ehReimpressao);

// v146: a reprint lists its sources as { serie, numero } (the série name as the Longbox
// writes it, from the wiki's StoryGrab). It counts as owned when every source is owned:
// DC reissues the originals, never the Giants (user's rule, 2026-10-03). Matching is by
// série name, case and accent blind, and the exact issue number.
// A one-volume série is often stored without "(Volume 1)" ("Flash Special"), while the
// wiki always says "Vol 1", so that one suffix is ignored; "(Volume 2)" still counts.
const chaveSerie = (nome) => dobrar(nome).replace(/\s*\(volume 1\)\s*$/, "").replace(/[^a-z0-9]/g, "");
const chave = (serieNome, numero) => chaveSerie(serieNome) + "#" + String(numero).trim().toLowerCase();

export function indiceEdicoes(series, edicoes) {
  const nomeDe = new Map(series.map((s) => [s.id, s.nome]));
  const ind = new Map();
  edicoes.forEach((e) => { if (nomeDe.has(e.serieId)) ind.set(chave(nomeDe.get(e.serieId), e.numero), e); });
  return ind;
}

// null when the edição is not a reprint with sources. Otherwise the sources split into
// owned, missing, and "fora" (no such edição in the library at all).
export function coberturaDe(e, ind, ownedIds) {
  if (!ehReimpressao(e) || !Array.isArray(e.fontes) || !e.fontes.length) return null;
  const r = { tenho: [], falta: [], fora: [], total: e.fontes.length };
  e.fontes.forEach((f) => {
    const alvo = ind.get(chave(f.serie, f.numero));
    if (!alvo) r.fora.push(f);
    else (ownedIds.has(alvo.id) ? r.tenho : r.falta).push({ ...f, edicao: alvo });
  });
  return r;
}

// Reprints covered by physically owned sources. Takes the physical set only, so a
// covered reprint never covers another one (no chains, no loops).
export function edicoesCobertas(series, edicoes, ownedIds) {
  const ind = indiceEdicoes(series, edicoes);
  const cobertas = new Set();
  edicoes.forEach((e) => {
    if (ownedIds.has(e.id)) return;
    const c = coberturaDe(e, ind, ownedIds);
    if (c && c.tenho.length === c.total) cobertas.add(e.id);
  });
  return cobertas;
}
