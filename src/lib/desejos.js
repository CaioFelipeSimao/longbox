import { presencas } from "./constantes";
import { dobrar } from "./sessao";
import { porFixados, uid } from "./util";

export function colecaoDoAcervo(lib, cd) {
  return cd.colecaoId ? lib.colecoes.find((c) => c.id === cd.colecaoId) || null : null;
}

export function numeroNaFaixa(lib, cd, i) {
  return (colecaoDoAcervo(lib, cd)?.membros.length || 0) + i + 1;
}

export function colecaoDoDesejo(lib, desejoId) {
  return lib.desejosColecoes.find((c) => c.membros.includes(desejoId)) || null;
}

// presencas omits an empty publisher in the main app's publisher band. Here it
// gets its own group, while tambem still supplies the additional presences.
function presencasDoDesejo(desejo) {
  const pares = presencas(desejo);
  if (!(desejo.editora || "").trim()) {
    pares.unshift({ editora: "Sem editora", personagem: (desejo.personagem || "").trim() });
  }
  return pares;
}

export function filtrarDesejos(lib, { busca, tipo, personagem, editora }) {
  const q = dobrar((busca || "").trim());
  const membrosEncontrados = new Set();
  if (q) {
    lib.desejosColecoes.forEach((c) => {
      if (dobrar(c.nome).includes(q)) c.membros.forEach((id) => membrosEncontrados.add(id));
    });
  }
  const igual = (a, b) => dobrar((a || "").trim()) === dobrar((b || "").trim());
  return new Set(lib.desejos.filter((d) => {
    if (q && !dobrar(d.titulo).includes(q) && !membrosEncontrados.has(d.id)) return false;
    if (tipo && !igual(d.tipo, tipo)) return false;
    const pares = presencasDoDesejo(d);
    if (personagem && !pares.some((p) => igual(p.personagem, personagem))) return false;
    if (editora && !pares.some((p) => igual(p.editora, editora))) return false;
    return true;
  }).map((d) => d.id));
}

function porOrdemECampo(campo) {
  return (a, b) => {
    const oa = Number.isFinite(a.ordem) ? a.ordem : Infinity;
    const ob = Number.isFinite(b.ordem) ? b.ordem : Infinity;
    return oa !== ob ? oa - ob : (a[campo] || "").localeCompare(b[campo] || "", "pt-BR", { numeric: true });
  };
}

export function agruparDesejos(lib, visiveis, fixados) {
  const porId = new Map(lib.desejos.map((d) => [d.id, d]));
  const emColecao = new Set(lib.desejosColecoes.flatMap((c) => c.membros));
  const editoras = new Map();
  function grupo(editora, personagem) {
    if (!editoras.has(editora)) editoras.set(editora, new Map());
    const personagens = editoras.get(editora);
    if (!personagens.has(personagem)) personagens.set(personagem, { nome: personagem, soltos: [], colecoes: [] });
    return personagens.get(personagem);
  }
  lib.desejos.forEach((d) => {
    if (!visiveis.has(d.id) || emColecao.has(d.id)) return;
    presencasDoDesejo(d).forEach((p) => grupo(p.editora, p.personagem).soltos.push(d));
  });
  lib.desejosColecoes.forEach((colecao) => {
    // Group ownership is determined before filtering, so a hidden first member
    // cannot move the collection to another publisher or character.
    const primeiro = porId.get(colecao.membros[0]);
    const membros = colecao.membros.map((id) => porId.get(id)).filter((d) => d && visiveis.has(d.id));
    if (!primeiro || !membros.length) return;
    presencasDoDesejo(primeiro).forEach((p) => grupo(p.editora, p.personagem).colecoes.push({ colecao, membros }));
  });
  const compararPersonagens = porFixados(fixados);
  const compararColecoes = porOrdemECampo("nome");
  return [...editoras.entries()].sort(([a], [b]) => {
    if (a === "Sem editora") return 1;
    if (b === "Sem editora") return -1;
    return a.localeCompare(b, "pt-BR");
  }).map(([editora, personagens]) => ({
    editora,
    personagens: [...personagens.values()].sort((a, b) => compararPersonagens(a.nome, b.nome)).map((p) => ({
      ...p,
      soltos: p.soltos.sort(porOrdemECampo("titulo")),
      colecoes: p.colecoes.sort((a, b) => compararColecoes(a.colecao, b.colecao)),
    })),
  }));
}

export function comprarDesejo(lib, desejoId, novoId = uid) {
  const desejo = lib.desejos.find((d) => d.id === desejoId);
  if (!desejo) return lib;
  const ordens = lib.volumes.filter((v) => v.personagem === desejo.personagem && Number.isFinite(v.ordem)).map((v) => v.ordem);
  const { ordem, ...dados } = desejo;
  const volume = { ...dados, status: "nao_lida", ...(ordens.length ? { ordem: Math.max(...ordens) + 1 } : {}) };
  const cd = colecaoDoDesejo(lib, desejoId);
  let colecoes = lib.colecoes;
  let colecaoId;
  if (cd) {
    const acervo = colecaoDoAcervo(lib, cd);
    if (acervo) {
      colecaoId = acervo.id;
      const membros = acervo.membros.slice();
      const i = cd.membros.indexOf(desejoId);
      membros.splice(Math.min(acervo.membros.length + i, membros.length), 0, desejoId);
      colecoes = lib.colecoes.map((c) => c.id === acervo.id ? { ...c, membros } : c);
    } else {
      colecaoId = novoId();
      colecoes = [...lib.colecoes, { id: colecaoId, nome: cd.nome, corBarra: cd.corBarra, descricao: cd.descricao, membros: [desejoId] }];
    }
  }
  return {
    ...lib,
    desejos: lib.desejos.filter((d) => d.id !== desejoId),
    volumes: [...lib.volumes, volume],
    colecoes,
    desejosColecoes: lib.desejosColecoes.flatMap((c) => {
      if (!c.membros.includes(desejoId)) return [c];
      const membros = c.membros.filter((id) => id !== desejoId);
      return membros.length ? [{ ...c, membros, ...(c === cd ? { colecaoId } : {}) }] : [];
    }),
  };
}
