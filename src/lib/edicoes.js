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

// v147: a comma before a suffix belongs to the name ("José Marzan, Jr.", 74 owned
// edições carry one), so it is protected before splitting on , and ;.
const SUFIXO = /,(\s*(?:Jr|Sr)\.?|\s*(?:II|III|IV))(?=\s*(?:[,;]|$))/gi;
export function parseAutores(texto) {
  const vistos = new Set();
  return String(texto || "").replace(SUFIXO, "\u0001$1").split(/[;,]/).map((n) => n.replace(/\u0001/g, ",").trim()).filter((n) => {
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

// v149: the "Filtrar por autor" options, like the character filter's: only the séries
// passed in (the publisher band's), counted by série, the first spelling seen kept.
export function autoresDasSeries(series, edicoesPorSerie, ownedIds) {
  const n = {};
  series.forEach((s) => {
    const nesta = new Map();
    (edicoesPorSerie[s.id] || []).forEach((e) => {
      if (!ownedIds.has(e.id)) return;
      const a = autoresDe(e);
      FUNCOES.flatMap((f) => a[f]).forEach((nome) => { const k = dobrar(nome); if (!nesta.has(k)) nesta.set(k, nome); });
    });
    nesta.forEach((nome, k) => { (n[k] = n[k] || { nome, n: 0 }).n++; });
  });
  return Object.values(n).sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
}

// parcial=false: o nome inteiro (filtro). parcial=true: um pedaco do nome (busca livre).
export function serieTemAutor(eds, ownedIds, nome, parcial = false) {
  return eds.some((e) => ownedIds.has(e.id) && autoresQueCasam(e, nome, parcial).length > 0);
}

// v147: rows and maps count the same owned edições, once per issue even when
// the author appears in several roles. Empty searches must never highlight all.
export function edicoesDoAutor(eds, ownedIds, nome, parcial = false) {
  return eds.filter((e) => ownedIds.has(e.id) && autoresQueCasam(e, nome, parcial).length > 0);
}

// v147: the partial highlight's aria names the matching people, not the typed fragment.
export function autoresQueCasam(e, nome, parcial = false) {
  const alvo = dobrar(nome);
  if (!alvo) return [];
  const casa = (x) => (parcial ? dobrar(x).includes(alvo) : dobrar(x) === alvo);
  const a = autoresDe(e);
  return [...new Set(FUNCOES.flatMap((f) => a[f]).filter(casa))];
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

// v149: a key can hold several edições when two séries fold to the same name ("X-Men",
// "X Men"); the index keeps them all, with each série's publisher, and `achar` decides.
export function indiceEdicoes(series, edicoes) {
  const deSerie = new Map(series.map((s) => [s.id, s]));
  const ind = new Map();
  ind.editoraDe = new Map(series.map((s) => [s.id, s.editora || ""]));
  edicoes.forEach((e) => {
    const s = deSerie.get(e.serieId);
    if (!s) return;
    const k = chave(s.nome, e.numero);
    (ind.get(k) || ind.set(k, []).get(k)).push({ edicao: e, editora: s.editora || "" });
  });
  return ind;
}

// One candidate: that edição. Several: the one from the reprint's own publisher, if exactly
// one; otherwise ambiguous, treated as not in the library rather than guessed.
function achar(ind, f, editora) {
  const lista = ind.get(chave(f.serie, f.numero));
  if (!lista || !lista.length) return null;
  if (lista.length === 1) return lista[0].edicao;
  const mesma = lista.filter((x) => editora && x.editora === editora);
  return mesma.length === 1 ? mesma[0].edicao : null;
}

// null when the edição is not a reprint with sources. Otherwise the sources split into
// owned, missing, and "fora" (no such edição in the library at all). A source marked
// { inedita: true } is a story printed nowhere else (or a grab the skill could not read):
// it is never owned, so such a reprint can never count as covered (v147).
export function coberturaDe(e, ind, ownedIds) {
  if (!ehReimpressao(e) || !Array.isArray(e.fontes) || !e.fontes.length) return null;
  const r = { tenho: [], falta: [], fora: [], ineditas: 0, total: e.fontes.length };
  const editora = ind.editoraDe ? ind.editoraDe.get(e.serieId) : "";
  e.fontes.forEach((f) => {
    if (f.inedita) { r.ineditas++; return; }
    const alvo = achar(ind, f, editora);
    if (!alvo) r.fora.push(f);
    else (ownedIds.has(alvo.id) ? r.tenho : r.falta).push({ ...f, edicao: alvo });
  });
  return r;
}

// Reprints covered by physically owned sources. Takes the physical set only, so a
// covered reprint never covers another one (no chains, no loops). v147: the index comes
// in built (the app memoises it on the catalogue), so a shelf change costs only the walk
// over the reprints that have sources.
export function edicoesCobertas(ind, edicoes, ownedIds) {
  const cobertas = new Set();
  edicoes.forEach((e) => {
    if (!e.fontes || ownedIds.has(e.id)) return;
    const c = coberturaDe(e, ind, ownedIds);
    if (c && c.tenho.length === c.total) cobertas.add(e.id);
  });
  return cobertas;
}

// v147: the form edits only these fields. Saving starts from the edição as it is now in
// the library, so anything written elsewhere while the form was open (creators or fontes
// from the cadastro skill, a synced edit) survives. Unticking "reimpressão" drops origem
// and fontes with it; empty creators drop "autores".
const DO_FORM = ["numero", "mes", "ano", "posicao", "autores", "reimpressao", "origem"];
export function aplicarFormEdicao(atual, form) {
  if (!atual) return form;
  const fora = { ...atual };
  DO_FORM.forEach((k) => { if (k in form) fora[k] = form[k]; else delete fora[k]; });
  if (!form.reimpressao) delete fora.fontes;
  // v149: unticking an edição that WAS a reprint stores the user's "no", so the cadastro
  // skill never marks it again (it only fills reimpressao when the key is absent).
  if (!form.reimpressao && atual.reimpressao === true) fora.reimpressao = false;
  return fora;
}
