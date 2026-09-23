import React, { useState, useEffect, useMemo } from "react";
import {
  Search, Plus, X, Pencil, Trash2, Download, Upload, BookOpen, Layers, Library,
  AlertTriangle, RotateCcw, ChevronUp, ChevronDown, ArrowUp, ArrowDown, Link2, BarChart3, SlidersHorizontal,
} from "lucide-react";

const STORAGE_KEY = "biblioteca-hq-v2";

const C = {
  paper: "#DAD6C4", paperLight: "#E9E5D6", ink: "#1A1712", inkSoft: "#5A5344",
  kraft: "#C4A374", kraftDark: "#8B6A42", cyan: "#2E7D9E", magenta: "#B23A6B",
  signal: "#D9A62E", moss: "#5C7A52",
};

const STATUS = {
  lida: { label: "Lida", color: C.moss },
  lendo: { label: "Lendo", color: C.cyan },
  nao_lida: { label: "Não lida", color: C.signal },
};

const TIPOS = ["Encadernado (TPB)", "Omnibus", "Edição Absoluta", "Capa Dura", "Outro"];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function parseNum(numero) {
  if (numero === null || numero === undefined || numero === "") return null;
  const m = String(numero).trim().match(/^\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}
function sortKey(e) {
  if (e.posicao !== null && e.posicao !== undefined && e.posicao !== "") {
    const p = parseFloat(e.posicao);
    if (!isNaN(p)) return p;
  }
  return parseNum(e.numero);
}
function withoutId(arr, id) { return arr.filter((x) => x.id !== id); }

function deleteVolume(lib, id) {
  return {
    ...lib,
    volumes: withoutId(lib.volumes, id),
    colecoes: lib.colecoes.map((c) => ({ ...c, membros: c.membros.filter((v) => v !== id) })),
  };
}
function deleteColecao(lib, id) {
  return { ...lib, colecoes: withoutId(lib.colecoes, id) };
}
function deleteSerie(lib, id) {
  const edIds = lib.edicoes.filter((e) => e.serieId === id).map((e) => e.id);
  return {
    ...lib,
    series: withoutId(lib.series, id),
    edicoes: lib.edicoes.filter((e) => e.serieId !== id),
    volumes: lib.volumes.map((v) => ({ ...v, edicoesColetadasIds: v.edicoesColetadasIds.filter((eid) => !edIds.includes(eid)) })),
  };
}
function deleteEdicao(lib, id) {
  return {
    ...lib,
    edicoes: withoutId(lib.edicoes, id),
    volumes: lib.volumes.map((v) => ({ ...v, edicoesColetadasIds: v.edicoesColetadasIds.filter((eid) => eid !== id) })),
  };
}
function ensureRange(lib, serieId, de, ate) {
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
function ensureAvulsa(lib, serieId, numeroStr) {
  const edicoes = [...lib.edicoes];
  let ex = edicoes.find((e) => e.serieId === serieId && e.numero.trim().toLowerCase() === numeroStr.trim().toLowerCase());
  if (!ex) {
    ex = { id: uid(), serieId, numero: numeroStr.trim(), mes: "", ano: "", posicao: null };
    edicoes.push(ex);
  }
  return { edicoes, id: ex.id };
}

function parseImportText(texto) {
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
    const mes = (partes[1] || "").trim();
    const ano = (partes[2] || "").trim();
    registros.push({ numero, mes, ano });
  });
  return registros;
}

function personagensDaSerie(s) {
  if (Array.isArray(s.personagens) && s.personagens.length) {
    return s.personagens.map((p) => (typeof p === "string" ? { nome: p, de: null, ate: null } : p));
  }
  if (s.personagem) return [{ nome: s.personagem, de: null, ate: null }];
  return [];
}

const emptyVolume = () => ({ id: null, titulo: "", personagem: "", tipo: TIPOS[0], editora: "", ano: "", status: "nao_lida", notas: "" });
const emptyColecao = () => ({ id: null, nome: "", descricao: "" });
const emptySerie = () => ({ id: null, nome: "", personagensList: [{ nome: "", de: "", ate: "" }], editora: "", anoInicio: "", anoFim: "", totalEdicoes: "", ordem: "" });

function Chip({ children, color }) {
  return (
    <span className="f-mono text-[10px] px-1.5 py-0.5 rounded-sm inline-block" style={{ backgroundColor: color || C.kraft, color: C.paper }}>
      {children}
    </span>
  );
}
function GhostChip({ children }) {
  return (
    <span className="f-mono text-[10px] px-1.5 py-0.5 rounded-sm inline-block border" style={{ borderColor: C.inkSoft, color: C.inkSoft }}>
      {children}
    </span>
  );
}
function EmptyState({ title, subtitle }) {
  return (
    <div className="text-center py-14 border-2 border-dashed rounded-sm" style={{ borderColor: C.kraftDark }}>
      <BookOpen className="w-8 h-8 mx-auto mb-2" style={{ color: C.kraftDark }} />
      <p className="f-display text-xl" style={{ fontWeight: 900 }}>{title}</p>
      <p className="text-sm mt-1" style={{ color: C.inkSoft }}>{subtitle}</p>
    </div>
  );
}

export default function LongboxV2() {
  const [lib, setLib] = useState({ volumes: [], colecoes: [], series: [], edicoes: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("volumes");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Volumes
  const [openVolumeId, setOpenVolumeId] = useState(null);
  const [showVolumeForm, setShowVolumeForm] = useState(false);
  const [volumeForm, setVolumeForm] = useState(emptyVolume());
  const [volumeErrors, setVolumeErrors] = useState({});
  const [volumeDupWarning, setVolumeDupWarning] = useState(null);
  const [linkSerieId, setLinkSerieId] = useState(null);
  const [linkPickSerie, setLinkPickSerie] = useState("");
  const [linkNewSerie, setLinkNewSerie] = useState(false);
  const [rangeDe, setRangeDe] = useState("");
  const [rangeAte, setRangeAte] = useState("");
  const [avulsoNum, setAvulsoNum] = useState("");

  // Coleções
  const [openColecaoId, setOpenColecaoId] = useState(null);
  const [showColecaoForm, setShowColecaoForm] = useState(false);
  const [colecaoForm, setColecaoForm] = useState(emptyColecao());
  const [colecaoErrors, setColecaoErrors] = useState({});
  const [addMemberSel, setAddMemberSel] = useState("");

  // Séries
  const [openSerieId, setOpenSerieId] = useState(null);
  const [openSerieContexto, setOpenSerieContexto] = useState(null);
  const [verTudoSerie, setVerTudoSerie] = useState(false);
  const [showSerieForm, setShowSerieForm] = useState(false);
  const [serieForm, setSerieForm] = useState(emptySerie());
  const [serieErrors, setSerieErrors] = useState({});
  const [serieDupWarning, setSerieDupWarning] = useState(null);
  const [showEdicaoForm, setShowEdicaoForm] = useState(false);
  const [edicaoForm, setEdicaoForm] = useState({ id: null, serieId: "", numero: "", mes: "", ano: "", posicao: "" });
  const [selectedEdicaoId, setSelectedEdicaoId] = useState(null);
  const [serieBusca, setSerieBusca] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSerieId, setImportSerieId] = useState(null);
  const [importText, setImportText] = useState("");
  const [storageWarning, setStorageWarning] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) setLib(JSON.parse(res.value));
      } catch (e) {
        // biblioteca ainda vazia
      } finally {
        setLoading(false);
      }
      // Teste de round-trip: confirma que o armazenamento está realmente persistindo,
      // não só respondendo "sucesso" sem gravar de fato (ex: artefato ainda não publicado).
      try {
        const testVal = String(Date.now());
        await window.storage.set("__persist_check__", testVal, false);
        const readBack = await window.storage.get("__persist_check__", false);
        if (!readBack || readBack.value !== testVal) setStorageWarning(true);
      } catch (e) {
        setStorageWarning(true);
      }
    })();
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 2600); }

  async function persist(next) {
    setLib(next);
    try {
      const result = await window.storage.set(STORAGE_KEY, JSON.stringify(next), false);
      if (!result) showToast("Não foi possível salvar. Tente de novo.");
    } catch (e) {
      showToast("Erro ao salvar. Tente de novo.");
    }
  }

  const personagens = useMemo(() => {
    const set = new Set([...lib.volumes.map((v) => v.personagem), ...lib.series.flatMap((s) => personagensDaSerie(s).map((p) => p.nome))].filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [lib]);

  // Índices pré-computados: evita refazer .filter()/.find() em toda a lista a cada edição renderizada
  const edicaoParaVolumes = useMemo(() => {
    const map = {};
    lib.volumes.forEach((v) => {
      v.edicoesColetadasIds.forEach((eid) => {
        (map[eid] = map[eid] || []).push(v);
      });
    });
    return map;
  }, [lib.volumes]);
  const volumeParaColecoes = useMemo(() => {
    const map = {};
    lib.colecoes.forEach((c) => {
      c.membros.forEach((vid) => {
        (map[vid] = map[vid] || []).push(c);
      });
    });
    return map;
  }, [lib.colecoes]);
  const edicoesPorSerie = useMemo(() => {
    const map = {};
    lib.edicoes.forEach((e) => {
      (map[e.serieId] = map[e.serieId] || []).push(e);
    });
    return map;
  }, [lib.edicoes]);
  const serieById = useMemo(() => Object.fromEntries(lib.series.map((s) => [s.id, s])), [lib.series]);

  const statsGerais = useMemo(() => {
    let totalPossuidas = 0;
    const porSerie = lib.series.map((s) => {
      const eds = edicoesPorSerie[s.id] || [];
      const owned = eds.filter((e) => (edicaoParaVolumes[e.id] || []).length > 0).length;
      totalPossuidas += owned;
      return { serie: s, owned, total: s.totalEdicoes || null, catalogadas: eds.length };
    });
    const comMeta = porSerie.filter((p) => p.total);
    const maisCompletas = comMeta.slice().sort((a, b) => b.owned / b.total - a.owned / a.total).slice(0, 3);
    const maisFaltando = comMeta.filter((p) => p.total - p.owned > 0).slice().sort((a, b) => (b.total - b.owned) - (a.total - a.owned)).slice(0, 3);
    return { totalPossuidas, totalCatalogadas: lib.edicoes.length, maisCompletas, maisFaltando };
  }, [lib.series, lib.edicoes, edicoesPorSerie, edicaoParaVolumes]);
  const [showStats, setShowStats] = useState(false);

  const LIMITE_BYTES = 5 * 1024 * 1024;
  const tamanhoArmazenamento = useMemo(() => {
    let bytes = 0;
    try {
      bytes = new Blob([JSON.stringify(lib)]).size;
    } catch (e) {
      bytes = JSON.stringify(lib).length;
    }
    const pct = (bytes / LIMITE_BYTES) * 100;
    const formatado = bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return { bytes, pct, formatado };
  }, [lib]);

  function volumesQueColetam(edicaoId) {
    return edicaoParaVolumes[edicaoId] || [];
  }
  function colecoesDoVolume(volumeId) {
    return volumeParaColecoes[volumeId] || [];
  }
  function edicoesDoVolumeAgrupadas(volume) {
    const grupos = {};
    volume.edicoesColetadasIds.forEach((eid) => {
      const ed = lib.edicoes.find((e) => e.id === eid);
      if (!ed) return;
      const serie = serieById[ed.serieId];
      const key = serie ? serie.id : "?";
      if (!grupos[key]) grupos[key] = { serie, edicoes: [] };
      grupos[key].edicoes.push(ed);
    });
    Object.values(grupos).forEach((g) => g.edicoes.sort((a, b) => (parseNum(a.numero) ?? 999999) - (parseNum(b.numero) ?? 999999)));
    return Object.values(grupos);
  }

  // ---------- VOLUMES ----------
  const editorasVolumes = useMemo(() => {
    const set = new Set(lib.volumes.map((v) => v.editora).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [lib.volumes]);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroEditora, setFiltroEditora] = useState("");
  const [showFiltros, setShowFiltros] = useState(false);

  const volumesFiltrados = useMemo(() => {
    let vs = lib.volumes;
    if (query.trim()) {
      const q = query.toLowerCase();
      vs = vs.filter((v) => v.titulo.toLowerCase().includes(q) || v.personagem.toLowerCase().includes(q) || (v.editora || "").toLowerCase().includes(q));
    }
    if (filtroStatus) vs = vs.filter((v) => v.status === filtroStatus);
    if (filtroTipo) vs = vs.filter((v) => v.tipo === filtroTipo);
    if (filtroEditora) vs = vs.filter((v) => v.editora === filtroEditora);
    const grupos = {};
    vs.forEach((v) => { (grupos[v.personagem] = grupos[v.personagem] || []).push(v); });
    return Object.keys(grupos).sort((a, b) => a.localeCompare(b, "pt-BR")).map((p) => ({
      personagem: p,
      itens: grupos[p].sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR")),
    }));
  }, [lib.volumes, query, filtroStatus, filtroTipo, filtroEditora]);

  function tituloVolumeDuplicado(titulo) {
    return lib.volumes.find((v) => v.titulo.trim().toLowerCase() === titulo.trim().toLowerCase());
  }

  function openNovoVolume() { setVolumeForm(emptyVolume()); setVolumeErrors({}); setVolumeDupWarning(null); setShowVolumeForm(true); }
  function openEditarVolume(v) { setVolumeForm({ ...v }); setVolumeErrors({}); setVolumeDupWarning(null); setShowVolumeForm(true); }

  async function cicloStatusVolume(volumeId, atual) {
    const ordem = ["nao_lida", "lendo", "lida"];
    const prox = ordem[(ordem.indexOf(atual) + 1) % ordem.length];
    await persist({ ...lib, volumes: lib.volumes.map((v) => (v.id === volumeId ? { ...v, status: prox } : v)) });
  }

  function validarVolume() {
    const errs = {};
    if (!volumeForm.titulo.trim()) errs.titulo = "Informe o título do volume";
    if (!volumeForm.personagem.trim()) errs.personagem = "Informe o personagem principal";
    setVolumeErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function salvarVolume() {
    if (!validarVolume()) return;
    if (!volumeForm.id && !volumeDupWarning) {
      const dup = tituloVolumeDuplicado(volumeForm.titulo);
      if (dup) { setVolumeDupWarning(`Já existe "${dup.titulo}" cadastrado. Toque em Salvar de novo pra criar mesmo assim.`); return; }
    }
    let next;
    if (volumeForm.id) {
      next = { ...lib, volumes: lib.volumes.map((v) => (v.id === volumeForm.id ? { ...v, ...volumeForm } : v)) };
    } else {
      const novo = { ...volumeForm, id: uid(), edicoesColetadasIds: [] };
      next = { ...lib, volumes: [...lib.volumes, novo] };
    }
    await persist(next);
    setShowVolumeForm(false);
    setVolumeDupWarning(null);
    setOpenVolumeId(volumeForm.id || next.volumes[next.volumes.length - 1].id);
    showToast(volumeForm.id ? "Volume atualizado." : "Volume adicionado.");
  }

  async function salvarVolumeEContinuar() {
    if (!validarVolume()) return;
    if (!volumeDupWarning) {
      const dup = tituloVolumeDuplicado(volumeForm.titulo);
      if (dup) { setVolumeDupWarning(`Já existe "${dup.titulo}" cadastrado. Toque em "Salvar e cadastrar outro" de novo pra criar mesmo assim.`); return; }
    }
    const novo = { ...volumeForm, id: uid(), edicoesColetadasIds: [] };
    await persist({ ...lib, volumes: [...lib.volumes, novo] });
    showToast(`"${novo.titulo}" adicionado. Pronto pro próximo.`);
    setVolumeForm((f) => ({ ...emptyVolume(), personagem: f.personagem, tipo: f.tipo, editora: f.editora }));
    setVolumeErrors({});
    setVolumeDupWarning(null);
  }

  async function toggleLigacaoEdicao(volumeId, edicaoId) {
    const next = {
      ...lib,
      volumes: lib.volumes.map((v) => {
        if (v.id !== volumeId) return v;
        const has = v.edicoesColetadasIds.includes(edicaoId);
        return { ...v, edicoesColetadasIds: has ? v.edicoesColetadasIds.filter((id) => id !== edicaoId) : [...v.edicoesColetadasIds, edicaoId] };
      }),
    };
    await persist(next);
  }

  async function vincularIntervalo(volumeId, serieId) {
    const de = parseInt(rangeDe, 10), ate = parseInt(rangeAte, 10);
    if (!de || !ate || ate < de) { showToast("Intervalo inválido."); return; }
    const { edicoes, ids } = ensureRange(lib, serieId, de, ate);
    const volumes = lib.volumes.map((v) => v.id === volumeId ? { ...v, edicoesColetadasIds: Array.from(new Set([...v.edicoesColetadasIds, ...ids])) } : v);
    await persist({ ...lib, edicoes, volumes });
    setRangeDe(""); setRangeAte("");
    showToast(`Vinculado #${de} ao #${ate}.`);
  }

  async function vincularAvulsa(volumeId, serieId) {
    if (!avulsoNum.trim()) return;
    const { edicoes, id } = ensureAvulsa(lib, serieId, avulsoNum);
    const volumes = lib.volumes.map((v) => v.id === volumeId ? { ...v, edicoesColetadasIds: Array.from(new Set([...v.edicoesColetadasIds, id])) } : v);
    await persist({ ...lib, edicoes, volumes });
    setAvulsoNum("");
    showToast("Edição vinculada.");
  }

  // ---------- COLEÇÕES ----------
  const colecoesFiltradas = useMemo(() => {
    let cs = lib.colecoes;
    if (query.trim()) {
      const q = query.toLowerCase();
      cs = cs.filter((c) => c.nome.toLowerCase().includes(q));
    }
    return cs.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [lib.colecoes, query]);

  function personagensDaColecao(colecao) {
    const set = new Set(colecao.membros.map((vid) => lib.volumes.find((v) => v.id === vid)?.personagem).filter(Boolean));
    return Array.from(set);
  }

  function openNovaColecao() { setColecaoForm(emptyColecao()); setColecaoErrors({}); setShowColecaoForm(true); }
  function openEditarColecao(c) { setColecaoForm({ id: c.id, nome: c.nome, descricao: c.descricao }); setColecaoErrors({}); setShowColecaoForm(true); }

  async function salvarColecao() {
    const errs = {};
    if (!colecaoForm.nome.trim()) errs.nome = "Informe o nome da coleção";
    setColecaoErrors(errs);
    if (Object.keys(errs).length) return;
    let next;
    if (colecaoForm.id) {
      next = { ...lib, colecoes: lib.colecoes.map((c) => (c.id === colecaoForm.id ? { ...c, nome: colecaoForm.nome, descricao: colecaoForm.descricao } : c)) };
    } else {
      const nova = { id: uid(), nome: colecaoForm.nome.trim(), descricao: colecaoForm.descricao.trim(), membros: [] };
      next = { ...lib, colecoes: [...lib.colecoes, nova] };
    }
    await persist(next);
    setShowColecaoForm(false);
    setOpenColecaoId(colecaoForm.id || next.colecoes[next.colecoes.length - 1].id);
    showToast(colecaoForm.id ? "Coleção atualizada." : "Coleção criada.");
  }

  async function adicionarMembro(colecaoId, volumeId) {
    const next = { ...lib, colecoes: lib.colecoes.map((c) => c.id === colecaoId ? { ...c, membros: [...c.membros, volumeId] } : c) };
    await persist(next);
    setAddMemberSel("");
  }
  async function removerMembro(colecaoId, volumeId) {
    const next = { ...lib, colecoes: lib.colecoes.map((c) => c.id === colecaoId ? { ...c, membros: c.membros.filter((v) => v !== volumeId) } : c) };
    await persist(next);
  }
  async function moverMembro(colecaoId, index, direcao) {
    const c = lib.colecoes.find((x) => x.id === colecaoId);
    const membros = [...c.membros];
    const j = index + direcao;
    if (j < 0 || j >= membros.length) return;
    [membros[index], membros[j]] = [membros[j], membros[index]];
    const next = { ...lib, colecoes: lib.colecoes.map((x) => x.id === colecaoId ? { ...x, membros } : x) };
    await persist(next);
  }

  // ---------- SÉRIES ----------
  const seriesFiltradas = useMemo(() => {
    let ss = lib.series;
    if (query.trim()) {
      const q = query.toLowerCase();
      ss = ss.filter((s) => s.nome.toLowerCase().includes(q) || personagensDaSerie(s).some((p) => p.nome.toLowerCase().includes(q)));
    }
    const grupos = {};
    ss.forEach((s) => {
      const ps = personagensDaSerie(s);
      (ps.length ? ps : [{ nome: "(sem personagem)", de: null, ate: null }]).forEach((p) => {
        (grupos[p.nome] = grupos[p.nome] || []).push({ serie: s, faixa: p });
      });
    });
    return Object.keys(grupos).sort((a, b) => a.localeCompare(b, "pt-BR")).map((p) => ({
      personagem: p,
      itens: grupos[p].sort((a, b) => {
        const oa = a.serie.ordem !== null && a.serie.ordem !== undefined && a.serie.ordem !== "" ? a.serie.ordem : null;
        const ob = b.serie.ordem !== null && b.serie.ordem !== undefined && b.serie.ordem !== "" ? b.serie.ordem : null;
        if (oa !== null && ob !== null) return oa - ob;
        if (oa !== null) return -1;
        if (ob !== null) return 1;
        return (parseInt(a.serie.anoInicio, 10) || 9999) - (parseInt(b.serie.anoInicio, 10) || 9999);
      }),
    }));
  }, [lib.series, query]);

  function statsSerie(serie) {
    const eds = edicoesPorSerie[serie.id] || [];
    const owned = eds.filter((e) => volumesQueColetam(e.id).length > 0).length;
    return { total: eds.length, owned };
  }

  function nomeSerieDuplicado(nome) {
    return lib.series.find((s) => s.nome.trim().toLowerCase() === nome.trim().toLowerCase());
  }

  function openNovaSerie() { setSerieForm(emptySerie()); setSerieErrors({}); setSerieDupWarning(null); setShowSerieForm(true); }
  function openEditarSerie(s) {
    const lista = personagensDaSerie(s).map((p) => ({ nome: p.nome, de: p.de !== null && p.de !== undefined ? String(p.de) : "", ate: p.ate !== null && p.ate !== undefined ? String(p.ate) : "" }));
    setSerieForm({ ...s, personagensList: lista.length ? lista : [{ nome: "", de: "", ate: "" }], totalEdicoes: s.totalEdicoes || "", ordem: s.ordem !== null && s.ordem !== undefined ? String(s.ordem) : "" });
    setSerieErrors({}); setSerieDupWarning(null); setShowSerieForm(true);
  }
  function addPersonagemRow() { setSerieForm((f) => ({ ...f, personagensList: [...f.personagensList, { nome: "", de: "", ate: "" }] })); }
  function removePersonagemRow(idx) { setSerieForm((f) => ({ ...f, personagensList: f.personagensList.filter((_, i) => i !== idx) })); }
  function updatePersonagemRow(idx, patch) { setSerieForm((f) => ({ ...f, personagensList: f.personagensList.map((p, i) => (i === idx ? { ...p, ...patch } : p)) })); }

  async function salvarSerie() {
    const errs = {};
    if (!serieForm.nome.trim()) errs.nome = "Informe o nome da série";
    if (!serieForm.personagensList.some((p) => p.nome.trim())) errs.personagem = "Informe ao menos um personagem";
    setSerieErrors(errs);
    if (Object.keys(errs).length) return;
    if (!serieForm.id && !serieDupWarning) {
      const dup = nomeSerieDuplicado(serieForm.nome);
      if (dup) { setSerieDupWarning(`Já existe uma série chamada "${dup.nome}". Toque em Salvar de novo pra criar mesmo assim.`); return; }
    }
    const personagensArr = serieForm.personagensList
      .filter((p) => p.nome.trim())
      .map((p) => ({
        nome: p.nome.trim(),
        de: p.de !== "" && !isNaN(parseInt(p.de, 10)) ? parseInt(p.de, 10) : null,
        ate: p.ate !== "" && !isNaN(parseInt(p.ate, 10)) ? parseInt(p.ate, 10) : null,
      }));
    const payload = {
      nome: serieForm.nome.trim(),
      personagens: personagensArr,
      editora: serieForm.editora.trim(),
      anoInicio: serieForm.anoInicio.trim(),
      anoFim: serieForm.anoFim.trim(),
      totalEdicoes: serieForm.totalEdicoes ? parseInt(serieForm.totalEdicoes, 10) : null,
      ordem: serieForm.ordem.trim() !== "" && !isNaN(parseFloat(serieForm.ordem)) ? parseFloat(serieForm.ordem) : null,
    };
    let next;
    if (serieForm.id) {
      next = { ...lib, series: lib.series.map((s) => (s.id === serieForm.id ? { ...payload, id: s.id } : s)) };
    } else {
      const nova = { ...payload, id: uid() };
      next = { ...lib, series: [...lib.series, nova] };
    }
    await persist(next);
    setShowSerieForm(false);
    setSerieDupWarning(null);
    setOpenSerieId(serieForm.id || next.series[next.series.length - 1].id);
    showToast(serieForm.id ? "Série atualizada." : "Série criada.");
  }

  function openNovaEdicao(serieId, numeroPrefill) {
    setEdicaoForm({ id: null, serieId, numero: numeroPrefill || "", mes: "", ano: "", posicao: "" });
    setShowEdicaoForm(true);
  }
  function openEditarEdicao(ed) {
    setEdicaoForm({ ...ed, posicao: ed.posicao !== null && ed.posicao !== undefined ? String(ed.posicao) : "" });
    setShowEdicaoForm(true);
  }

  async function salvarEdicao() {
    if (!edicaoForm.numero.trim()) { showToast("Informe o número da edição."); return; }
    const payload = { ...edicaoForm, posicao: edicaoForm.posicao.trim() !== "" && !isNaN(parseFloat(edicaoForm.posicao)) ? parseFloat(edicaoForm.posicao) : null };
    let next;
    if (payload.id) {
      next = { ...lib, edicoes: lib.edicoes.map((e) => (e.id === payload.id ? payload : e)) };
    } else {
      next = { ...lib, edicoes: [...lib.edicoes, { ...payload, id: uid() }] };
    }
    await persist(next);
    setShowEdicaoForm(false);
    showToast("Edição salva.");
  }

  function openImportar(serieId) {
    setImportSerieId(serieId);
    setImportText("");
    setShowImportModal(true);
  }

  async function importarEdicoes() {
    const registros = parseImportText(importText);
    if (registros.length === 0) { showToast("Nada reconhecido pra importar."); return; }
    let edicoes = [...lib.edicoes];
    let criadas = 0, atualizadas = 0;
    registros.forEach((r) => {
      const ex = edicoes.find((e) => e.serieId === importSerieId && e.numero.trim().toLowerCase() === r.numero.trim().toLowerCase());
      if (ex) {
        edicoes = edicoes.map((e) => e.id === ex.id ? {
          ...e,
          mes: r.mes || e.mes,
          ano: r.ano || e.ano,
        } : e);
        atualizadas++;
      } else {
        edicoes.push({ id: uid(), serieId: importSerieId, numero: r.numero, mes: r.mes, ano: r.ano });
        criadas++;
      }
    });
    await persist({ ...lib, edicoes });
    setShowImportModal(false);
    setImportText("");
    showToast(`${criadas} criadas, ${atualizadas} atualizadas.`);
  }

  // ---------- EXCLUSÃO GENÉRICA ----------
  async function confirmarExclusao() {
    if (!confirmDelete) return;
    const { type, id } = confirmDelete;
    let next = lib;
    if (type === "volume") { next = deleteVolume(lib, id); if (openVolumeId === id) setOpenVolumeId(null); }
    if (type === "colecao") { next = deleteColecao(lib, id); if (openColecaoId === id) setOpenColecaoId(null); }
    if (type === "serie") { next = deleteSerie(lib, id); if (openSerieId === id) setOpenSerieId(null); }
    if (type === "edicao") { next = deleteEdicao(lib, id); }
    await persist(next);
    setConfirmDelete(null);
    showToast("Removido.");
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(lib, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "longbox.json"; a.click();
    URL.revokeObjectURL(url);
  }
  async function clearAll() {
    await persist({ volumes: [], colecoes: [], series: [], edicoes: [] });
    setOpenVolumeId(null); setOpenColecaoId(null); setOpenSerieId(null);
    showToast("Biblioteca zerada.");
  }

  const inputCls = "w-full rounded-sm px-3 py-2 text-sm bg-white/70 border focus:outline-none focus:ring-2 focus:ring-offset-1";
  const openVolume = lib.volumes.find((v) => v.id === openVolumeId);
  const openColecao = lib.colecoes.find((c) => c.id === openColecaoId);
  const openSerie = lib.series.find((s) => s.id === openSerieId);

  const TABS = [
    { key: "volumes", label: "HQs", icon: BookOpen },
    { key: "colecoes", label: "Coleções", icon: Layers },
    { key: "series", label: "Séries", icon: Library },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.paper }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&family=Libre+Franklin:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .f-display{font-family:'Big Shoulders Display',sans-serif;}
        .f-body{font-family:'Libre Franklin',sans-serif;}
        .f-mono{font-family:'IBM Plex Mono',monospace;}
        @media (prefers-reduced-motion: reduce){ *{ transition:none !important; animation:none !important; } }
      `}</style>
      <datalist id="personagens-list">
        {personagens.map((p) => <option key={p} value={p} />)}
      </datalist>

      <div className="max-w-2xl mx-auto px-4 pb-28 pt-6 f-body" style={{ color: C.ink }}>
        {storageWarning && (
          <div className="mb-4 p-3 rounded-sm text-xs" style={{ backgroundColor: C.magenta, color: C.paper }}>
            ⚠️ <strong>O armazenamento não confirmou a gravação de teste.</strong> Se este artefato ainda não foi publicado, publique-o agora (menu do artefato → Publicar) — sem isso, nada do que você cadastrar aqui vai ficar salvo entre sessões, mesmo aparecendo como salvo na hora.
          </div>
        )}
        <header className="mb-4">
          <div className="flex items-center justify-between">
            <h1 className="f-display text-4xl tracking-tight" style={{ fontWeight: 900 }}>LONGBOX</h1>
            <button onClick={() => setShowStats((s) => !s)} className="p-1.5 rounded-sm focus:outline-none" style={{ backgroundColor: showStats ? C.ink : C.kraft, color: showStats ? C.paper : C.ink }}>
              <BarChart3 className="w-4 h-4" />
            </button>
          </div>
          <p className="f-mono text-xs" style={{ color: C.inkSoft }}>
            {lib.volumes.length} volumes · {lib.colecoes.length} coleções · {lib.series.length} séries
          </p>
          {showStats && (
            <div className="mt-2 p-3 rounded-sm" style={{ backgroundColor: C.paperLight, border: `1px solid ${C.kraft}` }}>
              <p className="f-mono text-xs font-semibold">{statsGerais.totalPossuidas}/{statsGerais.totalCatalogadas} edições possuídas no total</p>
              {statsGerais.maisCompletas.length > 0 && (
                <div className="mt-2">
                  <p className="f-mono text-[10px] uppercase tracking-wide" style={{ color: C.inkSoft }}>Séries mais completas</p>
                  {statsGerais.maisCompletas.map((p) => (
                    <p key={p.serie.id} className="text-xs truncate">{p.serie.nome} — {p.owned}/{p.total} ({Math.round((p.owned / p.total) * 100)}%)</p>
                  ))}
                </div>
              )}
              {statsGerais.maisFaltando.length > 0 && (
                <div className="mt-2">
                  <p className="f-mono text-[10px] uppercase tracking-wide" style={{ color: C.inkSoft }}>Séries com mais faltando</p>
                  {statsGerais.maisFaltando.map((p) => (
                    <p key={p.serie.id} className="text-xs truncate">{p.serie.nome} — faltam {p.total - p.owned}</p>
                  ))}
                </div>
              )}
              {statsGerais.maisCompletas.length === 0 && (
                <p className="text-xs mt-1" style={{ color: C.inkSoft }}>Defina "total de edições" nas séries pra ver esse ranking.</p>
              )}
              <div className="mt-3 pt-2" style={{ borderTop: `1px solid ${C.kraft}` }}>
                <div className="flex items-center justify-between f-mono text-[11px]">
                  <span style={{ color: C.inkSoft }}>Armazenamento usado</span>
                  <span style={{ color: tamanhoArmazenamento.pct > 80 ? C.magenta : C.inkSoft }}>{tamanhoArmazenamento.formatado} / 5 MB ({tamanhoArmazenamento.pct.toFixed(1)}%)</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-sm overflow-hidden" style={{ backgroundColor: C.paper }}>
                  <div style={{ width: `${Math.min(tamanhoArmazenamento.pct, 100)}%`, backgroundColor: tamanhoArmazenamento.pct > 80 ? C.magenta : tamanhoArmazenamento.pct > 50 ? C.signal : C.moss, height: "100%" }} />
                </div>
                {tamanhoArmazenamento.pct > 80 && (
                  <p className="text-xs mt-1" style={{ color: C.magenta }}>Chegando perto do limite — me avise pra reestruturarmos o armazenamento por série.</p>
                )}
              </div>
            </div>
          )}
        </header>

        {/* TAB BAR — divisórias de longbox */}
        <div className="flex gap-1 mb-4">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setQuery(""); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-t-sm text-sm font-semibold f-mono focus:outline-none focus:ring-2"
                style={{ backgroundColor: active ? C.ink : C.kraft, color: active ? C.paper : C.ink, transform: active ? "translateY(0)" : "translateY(4px)" }}
              >
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
        <div className="h-0.5 mb-4" style={{ backgroundColor: C.ink }} />

        {/* BUSCA */}
        <div className="flex gap-2 mb-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4" style={{ color: C.inkSoft }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar..." className="w-full pl-8 pr-3 py-2 rounded-sm text-sm bg-white/70 border focus:outline-none focus:ring-2" style={{ borderColor: C.kraft }} />
          </div>
          {tab === "volumes" && (
            <button onClick={() => setShowFiltros((s) => !s)} className="p-2 rounded-sm shrink-0 focus:outline-none" style={{ backgroundColor: showFiltros ? C.ink : C.kraft, color: showFiltros ? C.paper : C.ink }}>
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => { if (tab === "volumes") openNovoVolume(); if (tab === "colecoes") openNovaColecao(); if (tab === "series") openNovaSerie(); }}
            className="flex items-center gap-1 px-3 py-2 rounded-sm text-sm font-semibold shrink-0 focus:outline-none focus:ring-2"
            style={{ backgroundColor: C.ink, color: C.paper }}
          >
            <Plus className="w-4 h-4" /> Novo
          </button>
        </div>
        {tab === "volumes" && showFiltros && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="text-xs rounded-sm px-2 py-1.5 bg-white/70 border" style={{ borderColor: C.kraft }}>
              <option value="">Status: todos</option>
              {Object.entries(STATUS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="text-xs rounded-sm px-2 py-1.5 bg-white/70 border" style={{ borderColor: C.kraft }}>
              <option value="">Tipo: todos</option>
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filtroEditora} onChange={(e) => setFiltroEditora(e.target.value)} className="text-xs rounded-sm px-2 py-1.5 bg-white/70 border" style={{ borderColor: C.kraft }}>
              <option value="">Editora: todas</option>
              {editorasVolumes.map((ed) => <option key={ed} value={ed}>{ed}</option>)}
            </select>
          </div>
        )}
        <div className="mb-3" />

        {loading && <p className="text-sm" style={{ color: C.inkSoft }}>Carregando...</p>}

        {/* ===================== ABA VOLUMES (HQs) ===================== */}
        {!loading && tab === "volumes" && (
          <>
            {openVolume && (
              <div className="mb-6 rounded-sm border-2 overflow-hidden" style={{ borderColor: C.kraftDark, backgroundColor: C.paperLight }}>
                <div className="flex items-start justify-between p-3" style={{ backgroundColor: C.kraft }}>
                  <div className="min-w-0">
                    <p className="f-display text-2xl leading-none truncate" style={{ fontWeight: 900 }}>{openVolume.titulo.toUpperCase()}</p>
                    <p className="text-xs mt-1">{openVolume.tipo} · {openVolume.editora}{openVolume.ano ? ` · ${openVolume.ano}` : ""}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEditarVolume(openVolume)} className="p-1 focus:outline-none"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setConfirmDelete({ type: "volume", id: openVolume.id })} className="p-1 focus:outline-none"><Trash2 className="w-4 h-4" style={{ color: C.magenta }} /></button>
                    <button onClick={() => setOpenVolumeId(null)} className="p-1 focus:outline-none"><X className="w-5 h-5" /></button>
                  </div>
                </div>

                <div className="p-3 flex flex-wrap gap-1.5">
                  <Chip color={STATUS[openVolume.status].color}>{STATUS[openVolume.status].label}</Chip>
                  <GhostChip>Personagem: {openVolume.personagem}</GhostChip>
                  {colecoesDoVolume(openVolume.id).map((c) => <GhostChip key={c.id}>Coleção: {c.nome}</GhostChip>)}
                </div>
                {openVolume.notas && <p className="px-3 pb-2 text-xs italic" style={{ color: C.inkSoft }}>{openVolume.notas}</p>}

                {/* Edições coletadas, agrupadas por série */}
                <div className="px-3 pb-3">
                  <p className="f-mono text-[10px] uppercase tracking-wide mb-1" style={{ color: C.inkSoft }}>Edições coletadas</p>
                  {edicoesDoVolumeAgrupadas(openVolume).length === 0 && (
                    <p className="text-xs mb-2" style={{ color: C.inkSoft }}>Nenhuma edição vinculada ainda.</p>
                  )}
                  {edicoesDoVolumeAgrupadas(openVolume).map((g) => (
                    <div key={g.serie?.id || "?"} className="mb-2 rounded-sm bg-white/70 p-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold truncate">{g.serie ? g.serie.nome : "Série removida"}</p>
                        {g.serie && (
                          <button onClick={() => { setLinkSerieId(g.serie.id); setLinkPickSerie(g.serie.id); }} className="f-mono text-[10px] underline shrink-0" style={{ color: C.cyan }}>gerenciar</button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {g.edicoes.map((e) => <Chip key={e.id}>#{e.numero}</Chip>)}
                      </div>
                    </div>
                  ))}

                  {/* Painel de vínculo */}
                  {linkSerieId === null ? (
                    <button
                      onClick={() => { setLinkSerieId("__pick__"); setLinkPickSerie(""); setLinkNewSerie(false); }}
                      className="flex items-center gap-1 f-mono text-xs mt-1 underline"
                      style={{ color: C.cyan }}
                    >
                      <Link2 className="w-3.5 h-3.5" /> vincular edições de outra série
                    </button>
                  ) : linkSerieId === "__pick__" ? (
                    <div className="mt-2 p-2 rounded-sm border" style={{ borderColor: C.kraftDark, backgroundColor: "white" }}>
                      <div className="flex gap-2 text-xs f-mono mb-2">
                        <button onClick={() => setLinkNewSerie(false)} className="flex-1 py-1 rounded-sm border" style={{ borderColor: C.kraftDark, backgroundColor: !linkNewSerie ? C.kraft : "transparent" }}>Existente</button>
                        <button onClick={() => setLinkNewSerie(true)} className="flex-1 py-1 rounded-sm border" style={{ borderColor: C.kraftDark, backgroundColor: linkNewSerie ? C.kraft : "transparent" }}>+ Nova série</button>
                      </div>
                      {!linkNewSerie ? (
                        <>
                          <select value={linkPickSerie} onChange={(e) => setLinkPickSerie(e.target.value)} className={inputCls} style={{ borderColor: C.kraft }}>
                            <option value="">Selecione a série...</option>
                            {lib.series.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                          </select>
                          <button onClick={() => { if (linkPickSerie) setLinkSerieId(linkPickSerie); }} className="mt-2 w-full py-1.5 rounded-sm text-sm font-semibold" style={{ backgroundColor: C.ink, color: C.paper }}>Continuar</button>
                        </>
                      ) : (
                        <MiniSerieForm
                          onCancel={() => setLinkSerieId(null)}
                          onSave={async (fields) => {
                            const nova = { id: uid(), nome: fields.nome.trim(), personagens: fields.personagem.split(",").map((p) => p.trim()).filter(Boolean), editora: fields.editora.trim(), anoInicio: fields.anoInicio.trim(), anoFim: fields.anoFim.trim(), totalEdicoes: fields.totalEdicoes ? parseInt(fields.totalEdicoes, 10) : null };
                            await persist({ ...lib, series: [...lib.series, nova] });
                            setLinkSerieId(nova.id);
                          }}
                          inputCls={inputCls}
                        />
                      )}
                      <button onClick={() => setLinkSerieId(null)} className="mt-2 text-xs underline" style={{ color: C.inkSoft }}>cancelar</button>
                    </div>
                  ) : (
                    <LinkPanel
                      volume={openVolume}
                      serie={lib.series.find((s) => s.id === linkSerieId)}
                      edicoesDaSerie={lib.edicoes.filter((e) => e.serieId === linkSerieId).sort((a, b) => (parseNum(a.numero) ?? 999999) - (parseNum(b.numero) ?? 999999))}
                      rangeDe={rangeDe} setRangeDe={setRangeDe}
                      rangeAte={rangeAte} setRangeAte={setRangeAte}
                      avulsoNum={avulsoNum} setAvulsoNum={setAvulsoNum}
                      onRange={() => vincularIntervalo(openVolume.id, linkSerieId)}
                      onAvulsa={() => vincularAvulsa(openVolume.id, linkSerieId)}
                      onToggle={(edId) => toggleLigacaoEdicao(openVolume.id, edId)}
                      onClose={() => setLinkSerieId(null)}
                      inputCls={inputCls}
                    />
                  )}
                </div>
              </div>
            )}

            {volumesFiltrados.length === 0 ? (
              <EmptyState title={lib.volumes.length === 0 ? "SUA CAIXA ESTÁ VAZIA" : "NADA ENCONTRADO"} subtitle={lib.volumes.length === 0 ? "Toque em “Novo” para catalogar seu primeiro volume." : "Tente outro termo de busca."} />
            ) : (
              volumesFiltrados.map((grupo) => (
                <div key={grupo.personagem} className="mb-4">
                  <div className="px-2 py-1 mb-1.5 rounded-sm f-display text-lg" style={{ backgroundColor: C.kraft, color: C.ink, fontWeight: 900 }}>
                    {grupo.personagem.toUpperCase()}
                  </div>
                  <div className="space-y-1.5">
                    {grupo.itens.map((v) => (
                      <div
                        key={v.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setOpenVolumeId(v.id === openVolumeId ? null : v.id)}
                        onKeyDown={(e) => { if (e.key === "Enter") setOpenVolumeId(v.id === openVolumeId ? null : v.id); }}
                        className="w-full text-left flex items-center gap-2 rounded-sm px-2 py-2 border-2 cursor-pointer focus:outline-none focus:ring-2"
                        style={{ borderColor: v.id === openVolumeId ? C.ink : C.kraft, backgroundColor: C.paperLight }}
                      >
                        <div className="w-9 h-11 shrink-0 rounded-sm overflow-hidden flex items-center justify-center" style={{ backgroundColor: C.kraft }}>
                          <span className="f-mono text-[9px]" style={{ color: C.ink }}>{v.titulo.slice(0, 2).toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{v.titulo}</p>
                          <p className="text-[11px] truncate" style={{ color: C.inkSoft }}>{v.tipo} · {v.editora}{v.ano ? ` · ${v.ano}` : ""}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); cicloStatusVolume(v.id, v.status); }}
                          className="shrink-0 focus:outline-none"
                          title="Toque pra mudar o status"
                        >
                          <Chip color={STATUS[v.status].color}>{STATUS[v.status].label}</Chip>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* ===================== ABA COLEÇÕES ===================== */}
        {!loading && tab === "colecoes" && (
          <>
            {openColecao && (
              <div className="mb-6 rounded-sm border-2 overflow-hidden" style={{ borderColor: C.kraftDark, backgroundColor: C.paperLight }}>
                <div className="flex items-start justify-between p-3" style={{ backgroundColor: C.kraft }}>
                  <div className="min-w-0">
                    <p className="f-display text-2xl leading-none truncate" style={{ fontWeight: 900 }}>{openColecao.nome.toUpperCase()}</p>
                    {openColecao.descricao && <p className="text-xs mt-1">{openColecao.descricao}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEditarColecao(openColecao)} className="p-1 focus:outline-none"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setConfirmDelete({ type: "colecao", id: openColecao.id })} className="p-1 focus:outline-none"><Trash2 className="w-4 h-4" style={{ color: C.magenta }} /></button>
                    <button onClick={() => setOpenColecaoId(null)} className="p-1 focus:outline-none"><X className="w-5 h-5" /></button>
                  </div>
                </div>
                <div className="p-3 flex flex-wrap gap-1.5">
                  {personagensDaColecao(openColecao).map((p) => <GhostChip key={p}>{p}</GhostChip>)}
                  {personagensDaColecao(openColecao).length === 0 && <p className="text-xs" style={{ color: C.inkSoft }}>Nenhum volume ainda.</p>}
                </div>
                <div className="px-3 pb-3 space-y-1.5">
                  {openColecao.membros.map((vid, idx) => {
                    const v = lib.volumes.find((x) => x.id === vid);
                    if (!v) return null;
                    return (
                      <div key={vid} className="flex items-center gap-2 rounded-sm px-3 py-2 bg-white/80">
                        <span className="f-mono text-xs w-6 text-center shrink-0" style={{ color: C.inkSoft }}>{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{v.titulo}</p>
                          <p className="text-[11px]" style={{ color: C.inkSoft }}>{v.personagem}</p>
                        </div>
                        <button onClick={() => moverMembro(openColecao.id, idx, -1)} className="p-1 focus:outline-none"><ArrowUp className="w-3.5 h-3.5" /></button>
                        <button onClick={() => moverMembro(openColecao.id, idx, 1)} className="p-1 focus:outline-none"><ArrowDown className="w-3.5 h-3.5" /></button>
                        <button onClick={() => removerMembro(openColecao.id, vid)} className="p-1 focus:outline-none"><X className="w-3.5 h-3.5" style={{ color: C.magenta }} /></button>
                      </div>
                    );
                  })}
                  <div className="pt-1">
                    <select
                      value={addMemberSel}
                      onChange={(e) => { if (e.target.value) adicionarMembro(openColecao.id, e.target.value); }}
                      className={inputCls}
                      style={{ borderColor: C.kraft }}
                    >
                      <option value="">+ Adicionar volume...</option>
                      {lib.volumes.filter((v) => !openColecao.membros.includes(v.id)).map((v) => (
                        <option key={v.id} value={v.id}>{v.titulo} ({v.personagem})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {colecoesFiltradas.length === 0 ? (
              <EmptyState title={lib.colecoes.length === 0 ? "NENHUMA COLEÇÃO AINDA" : "NADA ENCONTRADO"} subtitle="Uma coleção agrupa volumes, como uma saga com vários TPBs." />
            ) : (
              <div className="space-y-1.5">
                {colecoesFiltradas.map((c) => (
                  <button key={c.id} onClick={() => setOpenColecaoId(c.id === openColecaoId ? null : c.id)} className="w-full text-left flex items-center gap-2 rounded-sm px-3 py-2 border-2 focus:outline-none focus:ring-2" style={{ borderColor: c.id === openColecaoId ? C.ink : C.kraft, backgroundColor: C.paperLight }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{c.nome}</p>
                      <p className="text-[11px] truncate" style={{ color: C.inkSoft }}>{personagensDaColecao(c).join(", ") || "sem volumes"}</p>
                    </div>
                    <span className="f-mono text-[11px]" style={{ color: C.inkSoft }}>{c.membros.length} vol.</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ===================== ABA SÉRIES ===================== */}
        {!loading && tab === "series" && (
          <>
            {openSerie && (() => {
              const edsTotal = (edicoesPorSerie[openSerie.id] || [])
                .slice()
                .sort((a, b) => {
                  const na = sortKey(a), nb = sortKey(b);
                  if (na === null && nb === null) return a.numero.localeCompare(b.numero, "pt-BR");
                  if (na === null) return 1;
                  if (nb === null) return -1;
                  return na - nb;
                });
              const faixaAtiva = openSerieContexto && (openSerieContexto.de !== null || openSerieContexto.ate !== null) && !verTudoSerie;
              const eds = faixaAtiva
                ? edsTotal.filter((e) => {
                    const n = sortKey(e);
                    if (n === null) return false;
                    if (openSerieContexto.de !== null && n < openSerieContexto.de) return false;
                    if (openSerieContexto.ate !== null && n > openSerieContexto.ate) return false;
                    return true;
                  })
                : edsTotal;
              const ownedCount = eds.filter((e) => volumesQueColetam(e.id).length > 0).length;
              const selecionada = eds.find((e) => e.id === selectedEdicaoId);
              const edsFiltradas = serieBusca.trim() ? eds.filter((e) => e.numero.toLowerCase().includes(serieBusca.trim().toLowerCase())) : eds;
              const useGroups = !serieBusca.trim() && eds.length > 60;
              const grupos = {};
              if (useGroups) {
                edsFiltradas.forEach((e) => {
                  const sk = sortKey(e);
                  const bucketStart = sk === null ? "outras" : Math.floor(sk / 100) * 100;
                  const key = sk === null ? "outras" : `${bucketStart}`;
                  if (!grupos[key]) grupos[key] = { label: sk === null ? "Especiais / sem número" : `Nº ${bucketStart}–${bucketStart + 99}`, itens: [] };
                  grupos[key].itens.push(e);
                });
              }
              const renderTile = (e) => {
                const tem = volumesQueColetam(e.id).length > 0;
                const sel = e.id === selectedEdicaoId;
                return (
                  <button
                    key={e.id}
                    onClick={() => setSelectedEdicaoId(sel ? null : e.id)}
                    className="f-mono text-xs px-2 py-1 rounded-sm border-2 focus:outline-none focus:ring-2"
                    style={{
                      borderColor: sel ? C.ink : tem ? C.moss : C.inkSoft,
                      backgroundColor: tem ? C.moss : "transparent",
                      color: tem ? C.paper : C.inkSoft,
                      borderStyle: tem ? "solid" : "dashed",
                    }}
                  >
                    {e.numero}
                  </button>
                );
              };
              return (
                <div className="mb-6 rounded-sm border-2 overflow-hidden" style={{ borderColor: C.kraftDark, backgroundColor: C.paperLight }}>
                  <div className="flex items-start justify-between p-3" style={{ backgroundColor: C.kraft }}>
                    <div className="min-w-0">
                      <p className="f-display text-2xl leading-none truncate" style={{ fontWeight: 900 }}>{openSerie.nome.toUpperCase()}</p>
                      <p className="text-xs mt-1">{personagensDaSerie(openSerie).map((p) => p.nome).join(" / ")} · {openSerie.editora} · {openSerie.anoInicio || "?"}–{openSerie.anoFim || "presente"}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEditarSerie(openSerie)} className="p-1 focus:outline-none"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setConfirmDelete({ type: "serie", id: openSerie.id })} className="p-1 focus:outline-none"><Trash2 className="w-4 h-4" style={{ color: C.magenta }} /></button>
                      <button onClick={() => { setOpenSerieId(null); setOpenSerieContexto(null); setVerTudoSerie(false); setSelectedEdicaoId(null); setSerieBusca(""); }} className="p-1 focus:outline-none"><X className="w-5 h-5" /></button>
                    </div>
                  </div>
                  {openSerieContexto && (openSerieContexto.de !== null || openSerieContexto.ate !== null) && (
                    <div className="px-3 pt-2 flex items-center justify-between f-mono text-[11px]" style={{ color: C.cyan }}>
                      <span>Mostrando só edições {openSerieContexto.de ?? "?"}–{openSerieContexto.ate ?? "?"} ({openSerieContexto.nome}){verTudoSerie ? " — desativado" : ""}</span>
                      <button onClick={() => setVerTudoSerie((v) => !v)} className="underline shrink-0 ml-2">{verTudoSerie ? "aplicar filtro" : "ver todas"}</button>
                    </div>
                  )}
                  <div className="p-3 flex items-center justify-between">
                    <p className="f-mono text-xs" style={{ color: C.inkSoft }}>
                      {ownedCount}/{eds.length} possuídas{openSerie.totalEdicoes ? ` · meta: ${openSerie.totalEdicoes}` : ""}
                    </p>
                    <div className="flex gap-3">
                      <button onClick={() => openImportar(openSerie.id)} className="flex items-center gap-1 f-mono text-xs underline" style={{ color: C.cyan }}><Upload className="w-3 h-3" /> importar lista</button>
                      <button onClick={() => openNovaEdicao(openSerie.id)} className="f-mono text-xs underline" style={{ color: C.cyan }}>+ catalogar edição</button>
                    </div>
                  </div>

                  {eds.length === 0 ? (
                    <p className="px-3 pb-3 text-xs" style={{ color: C.inkSoft }}>Nenhuma edição catalogada ainda. Adicione uma por uma — inclusive nº 0, anuais ou edições fracionárias (ex: 12.1).</p>
                  ) : (
                    <div className="px-3 pb-3">
                      {eds.length > 20 && (
                        <div className="relative mb-2">
                          <Search className="absolute left-2 top-2 w-3.5 h-3.5" style={{ color: C.inkSoft }} />
                          <input
                            value={serieBusca}
                            onChange={(e) => setSerieBusca(e.target.value)}
                            placeholder="buscar número..."
                            className="w-full pl-7 pr-2 py-1.5 rounded-sm text-xs bg-white/70 border focus:outline-none focus:ring-2"
                            style={{ borderColor: C.kraft }}
                          />
                        </div>
                      )}
                      <p className="f-mono text-[10px] uppercase tracking-wide mb-1.5" style={{ color: C.inkSoft }}>
                        Toque num número pra ver se já tem e em qual HQ
                      </p>

                      {useGroups ? (
                        <div className="space-y-1.5">
                          {Object.keys(grupos).sort((a, b) => (a === "outras" ? 1 : b === "outras" ? -1 : parseFloat(a) - parseFloat(b))).map((key) => {
                            const g = grupos[key];
                            const ownedNoGrupo = g.itens.filter((e) => volumesQueColetam(e.id).length > 0).length;
                            return (
                              <details key={key} className="rounded-sm bg-white/50">
                                <summary className="f-mono text-xs px-2 py-1.5 cursor-pointer select-none" style={{ color: C.ink }}>
                                  {g.label} <span style={{ color: C.inkSoft }}>({ownedNoGrupo}/{g.itens.length})</span>
                                </summary>
                                <div className="flex flex-wrap gap-1.5 p-2 pt-0.5">
                                  {g.itens.map(renderTile)}
                                </div>
                              </details>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {edsFiltradas.length === 0 ? (
                            <p className="text-xs" style={{ color: C.inkSoft }}>Nada encontrado pra "{serieBusca}".</p>
                          ) : (
                            edsFiltradas.map(renderTile)
                          )}
                        </div>
                      )}

                      {selecionada && (
                        <div className="mt-3 rounded-sm bg-white/80 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">Nº {selecionada.numero}</p>
                            <div className="flex gap-1">
                              <button onClick={() => openEditarEdicao(selecionada)} className="p-1 focus:outline-none"><Pencil className="w-3.5 h-3.5" style={{ color: C.inkSoft }} /></button>
                              <button onClick={() => { setConfirmDelete({ type: "edicao", id: selecionada.id }); }} className="p-1 focus:outline-none"><Trash2 className="w-3.5 h-3.5" style={{ color: C.magenta }} /></button>
                              <button onClick={() => setSelectedEdicaoId(null)} className="p-1 focus:outline-none"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                          <p className="text-xs mt-1" style={{ color: C.inkSoft }}>
                            {selecionada.mes || selecionada.ano ? `${selecionada.mes || "?"}/${selecionada.ano || "?"}` : "sem data"}
                          </p>
                          {selecionada.posicao !== null && selecionada.posicao !== undefined && (
                            <p className="f-mono text-[10px] mt-1" style={{ color: C.cyan }}>posição manual no checklist: {selecionada.posicao}</p>
                          )}
                          <p className="f-mono text-[10px] uppercase tracking-wide mt-2 mb-1" style={{ color: C.inkSoft }}>Você tem em:</p>
                          <div className="flex flex-wrap gap-1">
                            {volumesQueColetam(selecionada.id).length === 0 ? (
                              <GhostChip>nenhum volume vinculado ainda</GhostChip>
                            ) : (
                              volumesQueColetam(selecionada.id).map((v) => <Chip key={v.id} color={C.moss}>{v.titulo}</Chip>)
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {seriesFiltradas.length === 0 ? (
              <EmptyState title={lib.series.length === 0 ? "NENHUMA SÉRIE AINDA" : "NADA ENCONTRADO"} subtitle="Cadastre uma série para acompanhar suas edições." />
            ) : (
              seriesFiltradas.map((grupo) => (
                <div key={grupo.personagem} className="mb-4">
                  <div className="px-2 py-1 mb-1.5 rounded-sm f-display text-lg" style={{ backgroundColor: C.kraft, color: C.ink, fontWeight: 900 }}>{grupo.personagem.toUpperCase()}</div>
                  <div className="space-y-1.5">
                    {grupo.itens.map((item) => {
                      const s = item.serie;
                      const st = statsSerie(s);
                      const temFaixa = item.faixa.de !== null || item.faixa.ate !== null;
                      const chaveClique = s.id === openSerieId && openSerieContexto && openSerieContexto.nome === item.faixa.nome;
                      return (
                        <button key={s.id + "-" + item.faixa.nome} onClick={() => { setOpenSerieId(chaveClique ? null : s.id); setOpenSerieContexto(chaveClique ? null : item.faixa); setVerTudoSerie(false); setSelectedEdicaoId(null); setSerieBusca(""); }} className="w-full text-left flex items-center gap-2 rounded-sm px-3 py-2 border-2 focus:outline-none focus:ring-2" style={{ borderColor: chaveClique ? C.ink : C.kraft, backgroundColor: C.paperLight }}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{s.nome}</p>
                            <p className="text-[11px]" style={{ color: C.inkSoft }}>
                              {s.anoInicio || "?"}–{s.anoFim || "presente"} · {st.owned}{s.totalEdicoes ? `/${s.totalEdicoes}` : ` de ${st.total}`} possuídas
                              {temFaixa && ` · edições ${item.faixa.de ?? "?"}–${item.faixa.ate ?? "?"}`}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        <div className="flex justify-center gap-4 mt-8 f-mono text-xs" style={{ color: C.inkSoft }}>
          <button onClick={exportJson} className="flex items-center gap-1 underline"><Download className="w-3.5 h-3.5" /> exportar JSON</button>
          {(lib.volumes.length > 0 || lib.series.length > 0) && (
            <button onClick={() => setConfirmDelete({ type: "all" })} className="flex items-center gap-1 underline" style={{ color: C.magenta }}><RotateCcw className="w-3.5 h-3.5" /> zerar tudo</button>
          )}
        </div>
      </div>

      {/* MODAL: FORM VOLUME */}
      {showVolumeForm && (
        <Modal title={volumeForm.id ? "EDITAR VOLUME" : "NOVO VOLUME"} onClose={() => setShowVolumeForm(false)}>
          <Field label="Título *" error={volumeErrors.titulo}>
            <input value={volumeForm.titulo} onChange={(e) => setVolumeForm((f) => ({ ...f, titulo: e.target.value }))} className={inputCls} style={{ borderColor: volumeErrors.titulo ? C.magenta : C.kraft }} />
          </Field>
          <Field label="Personagem principal *" error={volumeErrors.personagem}>
            <input list="personagens-list" value={volumeForm.personagem} onChange={(e) => setVolumeForm((f) => ({ ...f, personagem: e.target.value }))} className={inputCls} style={{ borderColor: volumeErrors.personagem ? C.magenta : C.kraft }} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tipo">
              <select value={volumeForm.tipo} onChange={(e) => setVolumeForm((f) => ({ ...f, tipo: e.target.value }))} className={inputCls} style={{ borderColor: C.kraft }}>
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Ano">
              <input value={volumeForm.ano} onChange={(e) => setVolumeForm((f) => ({ ...f, ano: e.target.value }))} className={inputCls} style={{ borderColor: C.kraft }} />
            </Field>
          </div>
          <Field label="Editora">
            <input value={volumeForm.editora} onChange={(e) => setVolumeForm((f) => ({ ...f, editora: e.target.value }))} className={inputCls} style={{ borderColor: C.kraft }} />
          </Field>
          <Field label="Status de leitura">
            <div className="flex gap-2 mt-1">
              {Object.entries(STATUS).map(([key, meta]) => (
                <button key={key} onClick={() => setVolumeForm((f) => ({ ...f, status: key }))} className="flex-1 text-xs py-1.5 rounded-sm border-2 f-mono" style={{ borderColor: meta.color, backgroundColor: volumeForm.status === key ? meta.color : "transparent", color: volumeForm.status === key ? C.paper : C.ink }}>{meta.label}</button>
              ))}
            </div>
          </Field>
          <Field label="Notas">
            <textarea value={volumeForm.notas} onChange={(e) => setVolumeForm((f) => ({ ...f, notas: e.target.value }))} rows={2} className={inputCls} style={{ borderColor: C.kraft }} />
          </Field>
          {volumeDupWarning && (
            <p className="text-xs p-2 rounded-sm" style={{ backgroundColor: C.signal, color: C.ink }}>{volumeDupWarning}</p>
          )}
          {volumeForm.id ? (
            <ModalActions onCancel={() => setShowVolumeForm(false)} onSave={salvarVolume} />
          ) : (
            <div className="flex flex-col gap-2 pt-2 sticky bottom-0" style={{ backgroundColor: C.paper }}>
              <div className="flex gap-2">
                <button onClick={() => setShowVolumeForm(false)} className="flex-1 py-2 rounded-sm border-2 text-sm font-semibold focus:outline-none" style={{ borderColor: C.kraftDark }}>Cancelar</button>
                <button onClick={salvarVolume} className="flex-1 py-2 rounded-sm text-sm font-semibold focus:outline-none" style={{ backgroundColor: C.ink, color: C.paper }}>Salvar e fechar</button>
              </div>
              <button onClick={salvarVolumeEContinuar} className="w-full py-2 rounded-sm border-2 text-sm font-semibold focus:outline-none" style={{ borderColor: C.cyan, color: C.cyan }}>Salvar e cadastrar outro</button>
            </div>
          )}
        </Modal>
      )}

      {/* MODAL: FORM COLEÇÃO */}
      {showColecaoForm && (
        <Modal title={colecaoForm.id ? "EDITAR COLEÇÃO" : "NOVA COLEÇÃO"} onClose={() => setShowColecaoForm(false)}>
          <Field label="Nome *" error={colecaoErrors.nome}>
            <input value={colecaoForm.nome} onChange={(e) => setColecaoForm((f) => ({ ...f, nome: e.target.value }))} className={inputCls} style={{ borderColor: colecaoErrors.nome ? C.magenta : C.kraft }} />
          </Field>
          <Field label="Descrição">
            <textarea value={colecaoForm.descricao} onChange={(e) => setColecaoForm((f) => ({ ...f, descricao: e.target.value }))} rows={2} className={inputCls} style={{ borderColor: C.kraft }} />
          </Field>
          <ModalActions onCancel={() => setShowColecaoForm(false)} onSave={salvarColecao} />
        </Modal>
      )}

      {/* MODAL: FORM SÉRIE */}
      {showSerieForm && (
        <Modal title={serieForm.id ? "EDITAR SÉRIE" : "NOVA SÉRIE"} onClose={() => setShowSerieForm(false)}>
          <Field label="Nome *" error={serieErrors.nome}>
            <input value={serieForm.nome} onChange={(e) => setSerieForm((f) => ({ ...f, nome: e.target.value }))} placeholder="ex: Nightwing (Volume 2)" className={inputCls} style={{ borderColor: serieErrors.nome ? C.magenta : C.kraft }} />
          </Field>
          <Field label="Personagem(ns) *" error={serieErrors.personagem}>
            {serieForm.personagensList.map((p, idx) => (
              <div key={idx} className="flex gap-1.5 items-center mb-1.5">
                <input list="personagens-list" value={p.nome} onChange={(e) => updatePersonagemRow(idx, { nome: e.target.value })} placeholder="Personagem" className={inputCls + " flex-1"} style={{ borderColor: serieErrors.personagem ? C.magenta : C.kraft }} />
                <input type="number" value={p.de} onChange={(e) => updatePersonagemRow(idx, { de: e.target.value })} placeholder="de #" className={inputCls} style={{ borderColor: C.kraft, width: "4.2rem" }} />
                <input type="number" value={p.ate} onChange={(e) => updatePersonagemRow(idx, { ate: e.target.value })} placeholder="até #" className={inputCls} style={{ borderColor: C.kraft, width: "4.2rem" }} />
                {serieForm.personagensList.length > 1 && (
                  <button onClick={() => removePersonagemRow(idx)} className="shrink-0 focus:outline-none"><X className="w-4 h-4" style={{ color: C.magenta }} /></button>
                )}
              </div>
            ))}
            <button onClick={addPersonagemRow} className="text-xs underline" style={{ color: C.cyan }}>+ adicionar personagem</button>
            <p className="text-xs mt-1" style={{ color: C.inkSoft }}>Deixe "de/até" em branco pra esse personagem mostrar todas as edições (padrão — bom pra crossovers tipo Nightwing/Huntress). Preencha só quando o protagonista muda no meio da numeração, tipo Green Arrow.</p>
          </Field>
          <Field label="Editora">
            <input value={serieForm.editora} onChange={(e) => setSerieForm((f) => ({ ...f, editora: e.target.value }))} className={inputCls} style={{ borderColor: C.kraft }} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Ano início"><input value={serieForm.anoInicio} onChange={(e) => setSerieForm((f) => ({ ...f, anoInicio: e.target.value }))} className={inputCls} style={{ borderColor: C.kraft }} /></Field>
            <Field label="Ano fim"><input value={serieForm.anoFim} onChange={(e) => setSerieForm((f) => ({ ...f, anoFim: e.target.value }))} placeholder="presente" className={inputCls} style={{ borderColor: C.kraft }} /></Field>
            <Field label="Total edições"><input type="number" min="0" value={serieForm.totalEdicoes} onChange={(e) => setSerieForm((f) => ({ ...f, totalEdicoes: e.target.value }))} placeholder="opcional" className={inputCls} style={{ borderColor: C.kraft }} /></Field>
          </div>
          <Field label="Ordem manual dentro do personagem (opcional)">
            <input type="number" step="0.1" value={serieForm.ordem} onChange={(e) => setSerieForm((f) => ({ ...f, ordem: e.target.value }))} placeholder="ex: 1, 2, 3..." className={inputCls} style={{ borderColor: C.kraft }} />
            <p className="text-xs mt-1" style={{ color: C.inkSoft }}>Deixe em branco pra ordenar automaticamente por ano de início. Preenchendo, séries com número menor aparecem primeiro dentro do grupo do personagem.</p>
          </Field>
          {serieDupWarning && (
            <p className="text-xs p-2 rounded-sm" style={{ backgroundColor: C.signal, color: C.ink }}>{serieDupWarning}</p>
          )}
          <ModalActions onCancel={() => setShowSerieForm(false)} onSave={salvarSerie} />
        </Modal>
      )}

      {/* MODAL: FORM EDIÇÃO */}
      {showEdicaoForm && (
        <Modal title={edicaoForm.id ? "EDITAR EDIÇÃO" : "CATALOGAR EDIÇÃO"} onClose={() => setShowEdicaoForm(false)}>
          <Field label="Número *">
            <input value={edicaoForm.numero} onChange={(e) => setEdicaoForm((f) => ({ ...f, numero: e.target.value }))} className={inputCls} style={{ borderColor: C.kraft }} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Mês"><input value={edicaoForm.mes} onChange={(e) => setEdicaoForm((f) => ({ ...f, mes: e.target.value }))} placeholder="ex: Outubro" className={inputCls} style={{ borderColor: C.kraft }} /></Field>
            <Field label="Ano"><input value={edicaoForm.ano} onChange={(e) => setEdicaoForm((f) => ({ ...f, ano: e.target.value }))} className={inputCls} style={{ borderColor: C.kraft }} /></Field>
          </div>
          <Field label="Posição no checklist (opcional)">
            <input value={edicaoForm.posicao} onChange={(e) => setEdicaoForm((f) => ({ ...f, posicao: e.target.value }))} placeholder="ex: 25.5 pra ficar entre a 25 e a 26" className={inputCls} style={{ borderColor: C.kraft }} />
          </Field>
          <p className="text-xs" style={{ color: C.inkSoft }}>Deixe em branco pra ordenar pelo número normal. Só preencha pra casos fora da numeração, tipo edições especiais que se leem em outro ponto da história.</p>
          <ModalActions onCancel={() => setShowEdicaoForm(false)} onSave={salvarEdicao} />
        </Modal>
      )}

      {/* MODAL: IMPORTAR EDIÇÕES EM LOTE */}
      {showImportModal && (
        <Modal title="IMPORTAR EDIÇÕES" onClose={() => setShowImportModal(false)}>
          <p className="text-xs" style={{ color: C.inkSoft }}>
            Uma edição por linha. Formato: <span className="f-mono">número, mês, ano</span> — só o número é obrigatório. Também aceita um intervalo numa linha (ex: <span className="f-mono">1-20</span>) pra criar várias edições em branco de uma vez. Se o número já existir na série, os dados são atualizados, não duplicados. Colar direto de uma planilha (com tabulação) também funciona.
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={10}
            placeholder={"1, Outubro, 1996\n2, Novembro, 1996\n0\n12.1, Janeiro, 2012\n21-30"}
            className="w-full rounded-sm px-3 py-2 text-xs f-mono bg-white/70 border focus:outline-none focus:ring-2"
            style={{ borderColor: C.kraft }}
          />
          <ModalActions onCancel={() => setShowImportModal(false)} onSave={importarEdicoes} saveLabel="Importar" />
        </Modal>
      )}

      {/* CONFIRMAÇÃO DE EXCLUSÃO */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xs rounded-sm border-2 p-4" style={{ backgroundColor: C.paper, borderColor: C.magenta }}>
            <AlertTriangle className="w-6 h-6 mb-2" style={{ color: C.magenta }} />
            <p className="text-sm mb-1 font-semibold">
              {confirmDelete.type === "all" ? "Zerar toda a biblioteca?" : "Remover este item?"}
            </p>
            <p className="text-xs mb-4" style={{ color: C.inkSoft }}>
              {confirmDelete.type === "volume" && "O volume some das coleções em que estava, mas as edições da série continuam catalogadas."}
              {confirmDelete.type === "colecao" && "Só remove o agrupamento — os volumes continuam na Aba HQs."}
              {confirmDelete.type === "serie" && "Remove a série e todas as suas edições, e desvincula de qualquer volume."}
              {confirmDelete.type === "edicao" && "Remove essa edição e desvincula de qualquer volume que a colete."}
              {confirmDelete.type === "all" && "Apaga volumes, coleções, séries e edições. Exporte um backup antes, se quiser."}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-1.5 rounded-sm border-2 text-sm" style={{ borderColor: C.kraftDark }}>Cancelar</button>
              <button onClick={() => confirmDelete.type === "all" ? clearAll().then(() => setConfirmDelete(null)) : confirmarExclusao()} className="flex-1 py-1.5 rounded-sm text-sm font-semibold" style={{ backgroundColor: C.magenta, color: C.paper }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-sm text-sm f-mono" style={{ backgroundColor: C.ink, color: C.paper }}>{toast}</div>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/50">
      <div className="w-full sm:max-w-md max-h-[88vh] overflow-y-auto rounded-t-lg sm:rounded-sm border-2 f-body" style={{ backgroundColor: C.paper, borderColor: C.kraftDark, color: C.ink }}>
        <div className="flex items-center justify-between p-4 border-b-2" style={{ borderColor: C.kraft }}>
          <p className="f-display text-2xl" style={{ fontWeight: 900 }}>{title}</p>
          <button onClick={onClose} className="focus:outline-none"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">{children}</div>
      </div>
    </div>
  );
}
function ModalActions({ onCancel, onSave, saveLabel }) {
  return (
    <div className="flex gap-2 pt-2 sticky bottom-0" style={{ backgroundColor: C.paper }}>
      <button onClick={onCancel} className="flex-1 py-2 rounded-sm border-2 text-sm font-semibold focus:outline-none" style={{ borderColor: C.kraftDark }}>Cancelar</button>
      <button onClick={onSave} className="flex-1 py-2 rounded-sm text-sm font-semibold focus:outline-none" style={{ backgroundColor: C.ink, color: C.paper }}>{saveLabel || "Salvar"}</button>
    </div>
  );
}
function Field({ label, error, children }) {
  return (
    <div>
      <label className="text-xs font-semibold">{label}</label>
      {children}
      {error && <p className="text-xs mt-0.5" style={{ color: C.magenta }}>{error}</p>}
    </div>
  );
}
function MiniSerieForm({ onCancel, onSave, inputCls }) {
  const [f, setF] = useState({ nome: "", personagem: "", editora: "", anoInicio: "", anoFim: "", totalEdicoes: "" });
  return (
    <div className="space-y-2">
      <input placeholder="Nome da série *" list="personagens-list" value={f.nome} onChange={(e) => setF((x) => ({ ...x, nome: e.target.value }))} className={inputCls} style={{ borderColor: C.kraft }} />
      <input placeholder="Personagem(ns) * — ex: Nightwing, Huntress" list="personagens-list" value={f.personagem} onChange={(e) => setF((x) => ({ ...x, personagem: e.target.value }))} className={inputCls} style={{ borderColor: C.kraft }} />
      <div className="grid grid-cols-3 gap-1.5">
        <input placeholder="Editora" value={f.editora} onChange={(e) => setF((x) => ({ ...x, editora: e.target.value }))} className={inputCls} style={{ borderColor: C.kraft }} />
        <input placeholder="Ano início" value={f.anoInicio} onChange={(e) => setF((x) => ({ ...x, anoInicio: e.target.value }))} className={inputCls} style={{ borderColor: C.kraft }} />
        <input placeholder="Total ed." type="number" value={f.totalEdicoes} onChange={(e) => setF((x) => ({ ...x, totalEdicoes: e.target.value }))} className={inputCls} style={{ borderColor: C.kraft }} />
      </div>
      <button
        onClick={() => { if (f.nome.trim() && f.personagem.trim()) onSave(f); }}
        className="w-full py-1.5 rounded-sm text-sm font-semibold"
        style={{ backgroundColor: C.ink, color: C.paper }}
      >
        Criar série e continuar
      </button>
    </div>
  );
}
function LinkPanel({ volume, serie, edicoesDaSerie, rangeDe, setRangeDe, rangeAte, setRangeAte, avulsoNum, setAvulsoNum, onRange, onAvulsa, onToggle, onClose, inputCls }) {
  if (!serie) return null;
  return (
    <div className="mt-2 p-2 rounded-sm border" style={{ borderColor: C.kraftDark, backgroundColor: "white" }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold truncate">{serie.nome}</p>
        <button onClick={onClose} className="text-xs underline" style={{ color: C.inkSoft }}>fechar</button>
      </div>
      <p className="f-mono text-[10px] uppercase mb-1" style={{ color: C.inkSoft }}>Vincular intervalo</p>
      <div className="flex gap-2 mb-2">
        <input type="number" placeholder="de #" value={rangeDe} onChange={(e) => setRangeDe(e.target.value)} className={inputCls} style={{ borderColor: C.kraft }} />
        <input type="number" placeholder="até #" value={rangeAte} onChange={(e) => setRangeAte(e.target.value)} className={inputCls} style={{ borderColor: C.kraft }} />
        <button onClick={onRange} className="px-3 rounded-sm text-xs font-semibold shrink-0" style={{ backgroundColor: C.ink, color: C.paper }}>Vincular</button>
      </div>
      <p className="f-mono text-[10px] uppercase mb-1" style={{ color: C.inkSoft }}>Vincular avulsa</p>
      <div className="flex gap-2 mb-3">
        <input placeholder="ex: Anual 1" value={avulsoNum} onChange={(e) => setAvulsoNum(e.target.value)} className={inputCls} style={{ borderColor: C.kraft }} />
        <button onClick={onAvulsa} className="px-3 rounded-sm text-xs font-semibold shrink-0" style={{ backgroundColor: C.ink, color: C.paper }}>Vincular</button>
      </div>
      <p className="f-mono text-[10px] uppercase mb-1" style={{ color: C.inkSoft }}>Edições da série</p>
      <div className="max-h-40 overflow-y-auto space-y-1">
        {edicoesDaSerie.length === 0 && <p className="text-xs" style={{ color: C.inkSoft }}>Nenhuma edição catalogada ainda nesta série.</p>}
        {edicoesDaSerie.map((ed) => (
          <label key={ed.id} className="flex items-center gap-2 text-xs bg-white/60 rounded-sm px-2 py-1">
            <input type="checkbox" checked={volume.edicoesColetadasIds.includes(ed.id)} onChange={() => onToggle(ed.id)} />
            <span>Nº {ed.numero}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
