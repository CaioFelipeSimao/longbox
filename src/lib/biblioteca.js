import { ED_TODAS, TIPOS_RENOMEADOS, editorasDescobertas, slugify } from "./constantes";
import { parseNum, uid } from "./util";

export function withoutId(arr, id) { return arr.filter((x) => x.id !== id); }

export function deleteVolume(lib, id) {
  return {
    ...lib,
    volumes: withoutId(lib.volumes, id),
    colecoes: lib.colecoes.map((c) => ({ ...c, membros: c.membros.filter((v) => v !== id) })),
  };
}
export function deleteColecao(lib, id) { return { ...lib, colecoes: withoutId(lib.colecoes, id) }; }
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
  };
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

export function anoRange(s) {
  const ini = s.anoInicio || "?";
  const fim = s.anoFim || "presente";
  return ini + "-" + fim;
}

export function normalizeLib(raw) {
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
