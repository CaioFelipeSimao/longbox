import { ED_TODAS, TIPOS_RENOMEADOS, editorasDescobertas, slugify } from "./constantes";
import { parseNum, sortKey, uid } from "./util";

export function withoutId(arr, id) { return arr.filter((x) => x.id !== id); }

// Shared by the character counters and the detail sheet's range / Ver todas.
export function edicoesNaFaixa(edicoes, faixa) {
  if (!faixa || (faixa.de === null && faixa.ate === null)) return edicoes;
  return edicoes.filter((e) => {
    const n = sortKey(e);
    if (n === null) return false;
    if (faixa.de !== null && n < faixa.de) return false;
    if (faixa.ate !== null && n > faixa.ate) return false;
    return true;
  });
}

// The faixa picks issues by position; the ends shown to the reader are the numbers
// of the first and last issue inside it ("119.5" when that is the last one), and
// only fall back to the stored bound when the faixa holds no issue.
export function rotuloFaixa(edicoesDaFaixa, faixa) {
  let ini = null, fim = null;
  for (const e of edicoesDaFaixa) {
    const k = sortKey(e);
    if (k === null) continue;
    if (ini === null || k < sortKey(ini)) ini = e;
    if (fim === null || k >= sortKey(fim)) fim = e;
  }
  return { de: ini ? ini.numero : faixa.de ?? "?", ate: fim ? fim.numero : faixa.ate ?? "?" };
}

export function deleteVolume(lib, id) {
  return {
    ...lib,
    volumes: withoutId(lib.volumes, id),
    colecoes: lib.colecoes.map((c) => ({ ...c, membros: c.membros.filter((v) => v !== id) })),
  };
}
export function deleteColecao(lib, id) { return { ...lib, colecoes: withoutId(lib.colecoes, id) }; }
export function deleteDesejo(lib, id) {
  return {
    ...lib,
    desejos: withoutId(lib.desejos, id),
    desejosColecoes: lib.desejosColecoes
      .map((c) => ({ ...c, membros: c.membros.filter((d) => d !== id) }))
      .filter((c) => c.membros.length),
  };
}
export function deleteSerie(lib, id) {
  const edIds = lib.edicoes.filter((e) => e.serieId === id).map((e) => e.id);
  return {
    ...lib,
    series: withoutId(lib.series, id),
    edicoes: lib.edicoes.filter((e) => e.serieId !== id),
    volumes: lib.volumes.map((v) => ({
      ...v,
      edicoesColetadasIds: v.edicoesColetadasIds.filter((eid) => !edIds.includes(eid)),
    })),
    desejos: lib.desejos.map((v) => ({
      ...v,
      edicoesColetadasIds: v.edicoesColetadasIds.filter((eid) => !edIds.includes(eid)),
    })),
  };
}
export function deleteEdicao(lib, id) {
  return {
    ...lib,
    edicoes: withoutId(lib.edicoes, id),
    volumes: lib.volumes.map((v) => ({
      ...v,
      edicoesColetadasIds: v.edicoesColetadasIds.filter((eid) => eid !== id),
    })),
    desejos: lib.desejos.map((v) => ({
      ...v,
      edicoesColetadasIds: v.edicoesColetadasIds.filter((eid) => eid !== id),
    })),
  };
}

// v88: the text "Copiar faltantes" puts on the clipboard, e.g.
// "Demolidor (Volume 2): faltam 5, 12-14, 30, Anual 1, e mais 3 não catalogadas".
// eds are the edições on screen, already in reading order. Plain whole numbers
// that follow each other collapse into a range with a hyphen (the en dash is
// banned in this app); anything else (12.1, "Anual 1") is listed on its own after
// them. naoCatalogadas is how far the série's meta goes past what is catalogued.
// Returns null when there is nothing to say.
export function textoFaltantes(nome, eds, ownedIds, naoCatalogadas) {
  const faltando = eds.filter((e) => !ownedIds.has(e.id));
  const extra = naoCatalogadas > 0 ? naoCatalogadas : 0;
  if (!faltando.length && !extra) return null;

  const inteiros = [];
  const avulsas = [];
  faltando.forEach((e) => {
    const n = String(e.numero).trim();
    if (/^\d+$/.test(n)) inteiros.push(parseInt(n, 10)); else avulsas.push(n);
  });
  inteiros.sort((a, b) => a - b);
  const trechos = [];
  for (let i = 0; i < inteiros.length; i++) {
    let j = i;
    while (j + 1 < inteiros.length && inteiros[j + 1] === inteiros[j] + 1) j++;
    trechos.push(j > i ? inteiros[i] + "-" + inteiros[j] : String(inteiros[i]));
    i = j;
  }
  const partes = trechos.concat(avulsas);
  const mais = extra ? "mais " + extra + (extra === 1 ? " não catalogada" : " não catalogadas") : "";
  if (!partes.length) {
    return nome + (extra === 1 ? ": falta só 1 não catalogada" : ": faltam só as " + extra + " não catalogadas");
  }
  const verbo = faltando.length === 1 && !extra ? "falta " : "faltam ";
  return nome + ": " + verbo + partes.join(", ") + (mais ? ", e " + mais : "");
}

export function ensureRange(lib, serieId, de, ate) {
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

export function ensureAvulsa(lib, serieId, numeroStr) {
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

export function parseImportText(texto) {
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

export function personagensDaSerie(s) {
  if (Array.isArray(s.personagens) && s.personagens.length) {
    return s.personagens.map((p) => (typeof p === "string" ? { nome: p, de: null, ate: null } : p));
  }
  if (s.personagem) return [{ nome: s.personagem, de: null, ate: null }];
  return [];
}

// The séries tab's group for a série with no character, and what the character
// filter offers for it (v93).
export const SEM_PERSONAGEM = "(sem personagem)";

// Whether a série sits in the named character's group on the séries tab.
export function serieDoGrupo(s, personagem) {
  const ps = personagensDaSerie(s);
  return ps.length ? ps.some((p) => p.nome === personagem) : personagem === SEM_PERSONAGEM;
}

// v185: a série's place in one character's group on the séries tab lives on that
// character's entry (ordem), so a série shared by two characters keeps a place in
// each. Placed séries first; the rest, and any added later, by starting year.
export function compararNoGrupo(a, b) {
  const oa = a.faixa.ordem ?? a.serie.ordem ?? null, ob = b.faixa.ordem ?? b.serie.ordem ?? null;
  if (oa !== null && ob !== null) return oa - ob;
  if (oa !== null) return -1;
  if (ob !== null) return 1;
  return (parseInt(a.serie.anoInicio, 10) || 9999) - (parseInt(b.serie.anoInicio, 10) || 9999);
}

// visiveis is the dragged group's new order (série ids). Séries of the character
// that the publisher band hides keep their slots; every série of it gets an ordem.
export function ordenarSeriesDoPersonagem(series, personagem, visiveis) {
  const atual = series.flatMap((serie) => personagensDaSerie(serie).filter((p) => p.nome === personagem)
    .slice(0, 1).map((faixa) => ({ serie, faixa }))).sort(compararNoGrupo).map((i) => i.serie.id);
  const mostrados = new Set(visiveis);
  let k = 0;
  const pos = new Map(atual.map((id) => (mostrados.has(id) ? visiveis[k++] : id)).map((id, i) => [id, i]));
  return series.map((s) => !pos.has(s.id) ? s : {
    ...s, personagens: personagensDaSerie(s).map((p) => (p.nome === personagem ? { ...p, ordem: pos.get(s.id) } : p)),
  });
}

export function anoRange(s) {
  const ini = s.anoInicio || "?";
  const fim = s.anoFim || "presente";
  return ini + "-" + fim;
}

function normalizarVolume(v) {
  const { tambem, ordemSeries, ...volume } = v;
  const validas = Array.isArray(tambem) ? tambem.filter((p) =>
    typeof p?.editora === "string" && p.editora.trim() && typeof p.personagem === "string"
  ).map((p) => ({ editora: p.editora.trim(), personagem: p.personagem.trim() })) : [];
  return {
    ...volume,
    ...(Array.isArray(ordemSeries) && ordemSeries.every((id) => typeof id === "string" && id.trim())
      ? { ordemSeries: ordemSeries.slice() } : {}),
    ...(validas.length ? { tambem: validas } : {}),
    ...(TIPOS_RENOMEADOS[v.tipo] ? { tipo: TIPOS_RENOMEADOS[v.tipo] } : null),
    edicoesColetadasIds: Array.isArray(v.edicoesColetadasIds) ? v.edicoesColetadasIds : [],
  };
}

export function normalizeLib(raw) {
  const lib = {
    volumes: Array.isArray(raw?.volumes) ? raw.volumes : [],
    colecoes: Array.isArray(raw?.colecoes) ? raw.colecoes : [],
    desejos: Array.isArray(raw?.desejos) ? raw.desejos : [],
    desejosColecoes: Array.isArray(raw?.desejosColecoes) ? raw.desejosColecoes : [],
    series: Array.isArray(raw?.series) ? raw.series : [],
    edicoes: Array.isArray(raw?.edicoes) ? raw.edicoes : [],
  };
  lib.volumes = lib.volumes.map(normalizarVolume);
  lib.desejos = lib.desejos.map((v) => {
    const { status, ...desejo } = normalizarVolume(v);
    return desejo;
  });
  lib.colecoes = lib.colecoes.map((c) => ({
    ...c,
    membros: Array.isArray(c.membros) ? c.membros : [],
  }));
  lib.desejosColecoes = lib.desejosColecoes.map((c) => ({
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
export function semearEditoras(lib) {
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

export function bytesOf(obj) {
  try { return new Blob([JSON.stringify(obj)]).size; }
  catch (e) { return JSON.stringify(obj).length; }
}
export function formatBytes(b) {
  return b < 1024 * 1024 ? (b / 1024).toFixed(1) + " KB" : (b / (1024 * 1024)).toFixed(2) + " MB";
}
