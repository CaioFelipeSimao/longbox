import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import { Plus, X, Download, Upload, Library, AlertTriangle, RotateCcw, SlidersHorizontal, ChevronLeft, Copy } from "lucide-react";
import CursorGrid from "../components/CursorGrid/CursorGrid";

import {
  ACCENT_HEX, DOC_LIMIT, ED_SEM, ED_TODAS, EMPTY_LIB, QUASE_FECHANDO, SESSION_SEED, TABS,
  TIPOS, editoraDe, seededPick, slugify,
} from "../lib/constantes";
import { parseNum, uid } from "../lib/util";
import { COR_LONGBOX, CoresContext, swatchColors, tintaSobre } from "../lib/cores";
import {
  anoRange, bytesOf, deleteColecao, deleteEdicao, deleteSerie, deleteVolume, ensureAvulsa,
  ensureRange, normalizeLib, parseImportText, personagensDaSerie, semearEditoras,
} from "../lib/biblioteca";
import { loadLibrary, scheduleSave, shardEdicoes, store } from "../lib/armazenamento";
import {
  assetErrorMessage, esperarMiniaturas, prepararMiniaturas, uploadCover,
} from "../lib/capas";
import { useHubUnlock, useLarguraDaBarra, usePonteiroFino } from "../lib/hooks";
import {
  lerAbaSalva, lerColecoesFechadas, lerFiltros, lerGruposAbertos, lerGruposFechados,
  lerOrdemRecolhida, salvarAba, salvarColecoesFechadas, salvarFiltros, salvarGruposAbertos,
  salvarGruposFechados, salvarOrdemRecolhida,
} from "../lib/sessao";
import { Aba, Modal, Toast } from "../ui/base";
import { SUGESTOES_DA_ABA, SearchBox, ordenarPorNome, ordenarSugestoes } from "../ui/Busca";
import { CorSheet } from "../ui/CorPersonagem";
import { EditoraBar, EditorasSheet } from "../ui/Editoras";
import { ColecoesSkeleton, HubSkeleton, SeriesSkeleton, ShelfSkeleton } from "../ui/Esqueletos";
import { OPCOES_STATUS, OPCOES_TIPO, OpcaoFiltro, PersonagemFiltro } from "../ui/Filtros";
import { ordenarGrupoVolumes } from "../ui/VolumeCard";
import { AbaColecoes } from "./AbaColecoes";
import { AbaHqs } from "./AbaHqs";
import { AbaSeries } from "./AbaSeries";
import { ColecaoSheet } from "./ColecaoSheet";
import { FormColecao, FormEdicao, FormSerie, FormVolume, ImportarEdicoes } from "./Formularios";
import { Hub } from "./Hub";
import { SerieSheet } from "./SerieSheet";
import { useArrastarVolumes } from "./useArrastarVolumes";
import { VolumeSheet } from "./VolumeSheet";

export function App() {
  const [lib, setLib] = useState(EMPTY_LIB);
  const [loading, setLoading] = useState(true);
  const [storageMode, setStorageMode] = useState("checking");
  const [canUpload, setCanUpload] = useState(false);
  const [tab, setTab] = useState(lerAbaSalva);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [exportText, setExportText] = useState(null);
  const [corPersonagem, setCorPersonagem] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const sentinelRef = useRef(null);
  const hubAtBottom = useRef(false);
  const hubObserver = useRef(null);
  const hubElRef = useRef(null);
  const [hubReturning, setHubReturning] = useState(false);

  // Callback ref: the sentinel lives inside Hub, which mounts and unmounts, so
  // the observer has to follow the node rather than run once on mount.
  const hubSentinelRef = useCallback((node) => {
    if (hubObserver.current) {
      hubObserver.current.disconnect();
      hubObserver.current = null;
    }
    hubAtBottom.current = false;
    if (!node || typeof IntersectionObserver !== "function") return;
    const io = new IntersectionObserver(
      ([entry]) => { hubAtBottom.current = entry.isIntersecting; },
      { threshold: 0 }
    );
    io.observe(node);
    hubObserver.current = io;
  }, []);

  const libRef = useRef(lib);
  libRef.current = lib;

  /* ---------- boot ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const claude = window.claude;
      const db = claude && claude.use ? await claude.use("db") : null;
      if (cancelled) return;
      store.db = db;
      store.onError = (msg) => showToast(msg);

      if (!db) {
        setStorageMode("memory");
        setLoading(false);
      } else {
        setStorageMode("db");
        try {
          const loaded = await loadLibrary(db);
          const semeado = semearEditoras(loaded);
          if (!cancelled) {
            setLib(semeado);
            libRef.current = semeado;
            if (semeado !== loaded) scheduleSave(semeado);
          }
        } catch (e) {
          if (!cancelled) showToast("Não consegui carregar a biblioteca. Recarregue a página.");
        }
        // Usually long done by now; the cap keeps a slow disk from holding the app.
        await esperarMiniaturas(400);
        if (!cancelled) setLoading(false);
      }

      const [assets, downloads] = await Promise.all([
        claude && claude.use ? claude.use("assets") : null,
        claude && claude.use ? claude.use("downloads") : null,
      ]);
      if (cancelled) return;
      store.assets = assets;
      store.downloads = downloads;
      setCanUpload(!!assets);
    })();
    return () => { cancelled = true; };
  }, []);

  // desfazer, when given, is { antes, depois, reabrir } from a removal (v88): the
  // toast then offers "Desfazer" and stays up long enough to reach it.
  const showToast = useCallback((msg, desfazer) => {
    setToast({ msg, id: uid(), desfazer: desfazer || null });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.desfazer ? 8000 : 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Scroll edge for the header. IntersectionObserver on a sentinel rather than
  // a scroll listener, which would fire on every frame.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver !== "function") return;
    const io = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const persist = useCallback((next) => {
    setLib(next);
    libRef.current = next;
    scheduleSave(next);
  }, []);

  /* ---------- derived indexes ---------- */
  const personagens = useMemo(() => {
    const set = new Set([
      ...lib.volumes.map((v) => v.personagem),
      ...lib.series.flatMap((s) => personagensDaSerie(s).map((p) => p.nome)),
    ].filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [lib]);

  const edicaoParaVolumes = useMemo(() => {
    const map = {};
    lib.volumes.forEach((v) => {
      v.edicoesColetadasIds.forEach((eid) => { (map[eid] = map[eid] || []).push(v); });
    });
    return map;
  }, [lib.volumes]);

  const volumeParaColecoes = useMemo(() => {
    const map = {};
    lib.colecoes.forEach((c) => {
      c.membros.forEach((vid) => { (map[vid] = map[vid] || []).push(c); });
    });
    return map;
  }, [lib.colecoes]);

  const edicoesPorSerie = useMemo(() => {
    const map = {};
    lib.edicoes.forEach((e) => { (map[e.serieId] = map[e.serieId] || []).push(e); });
    return map;
  }, [lib.edicoes]);

  const serieById = useMemo(
    () => Object.fromEntries(lib.series.map((s) => [s.id, s])),
    [lib.series]
  );

  const ownedEdicaoIds = useMemo(() => {
    const s = new Set();
    lib.volumes.forEach((v) => v.edicoesColetadasIds.forEach((id) => s.add(id)));
    return s;
  }, [lib.volumes]);

  const volumesQueColetam = useCallback((edId) => edicaoParaVolumes[edId] || [], [edicaoParaVolumes]);
  const colecoesDoVolume = useCallback((vid) => volumeParaColecoes[vid] || [], [volumeParaColecoes]);

  /* ---------- volumes ---------- */
  const [openVolumeId, setOpenVolumeId] = useState(null);
  const [showVolumeForm, setShowVolumeForm] = useState(false);
  const [volumeForm, setVolumeForm] = useState(null);
  const [volumeErrors, setVolumeErrors] = useState({});
  const [volumeDupWarning, setVolumeDupWarning] = useState(null);
  // Read once, when the state is created; written back on every change below.
  const [filtrosSalvos] = useState(lerFiltros);
  const [filtroStatus, setFiltroStatus] = useState(filtrosSalvos.status);
  const [filtroTipo, setFiltroTipo] = useState(filtrosSalvos.tipo);
  const [filtroPersonagem, setFiltroPersonagem] = useState(filtrosSalvos.personagem);
  const [showFiltros, setShowFiltros] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    salvarFiltros({ status: filtroStatus, tipo: filtroTipo, personagem: filtroPersonagem });
  }, [filtroStatus, filtroTipo, filtroPersonagem]);

  // With the panel closed a filter is still narrowing the shelf, so the button
  // carries the count; otherwise a reload or a trip to the hub could leave a
  // filtered shelf with nothing on screen saying so.
  const filtrosAtivos = [filtroStatus, filtroTipo, filtroPersonagem].filter(Boolean).length;

  const buscando = query.trim().length > 0;
  const editoraAtual = useMemo(
    () => (lib.editoras || []).find((e) => e.id === lib.editoraSel) || null,
    [lib.editoras, lib.editoraSel]
  );

  // Search deliberately ignores the publisher filter: looking for a title you
  // half remember should not depend on which publisher happens to be selected.
  const casaEditora = useCallback((item) => {
    if (buscando) return true;
    const sel = lib.editoraSel || ED_TODAS;
    if (sel === ED_TODAS) return true;
    const nome = editoraDe(item);
    if (sel === ED_SEM) return !nome;
    return editoraAtual ? nome.toLowerCase() === (editoraAtual.nome || "").toLowerCase() : true;
  }, [buscando, lib.editoraSel, editoraAtual]);

  // Searching "Detective" should find the Omnibus that collects it, not just
  // volumes with the word in the title, so the series a volume draws from are
  // part of its searchable text.
  const textoBusca = useMemo(() => {
    const serieDaEdicao = {};
    lib.edicoes.forEach((e) => { serieDaEdicao[e.id] = e.serieId; });
    const mapa = {};
    lib.volumes.forEach((v) => {
      const series = new Set();
      v.edicoesColetadasIds.forEach((eid) => {
        const s = serieById[serieDaEdicao[eid]];
        if (s) series.add(s.nome);
      });
      mapa[v.id] = [v.titulo, v.personagem, v.editora, v.notas, ...series]
        .filter(Boolean).join(" ").toLowerCase();
    });
    return mapa;
  }, [lib.volumes, lib.edicoes, serieById]);

  // v73: on HQs, the eight best volumes. On Coleções or Séries, the four best
  // of that tab first, then the four best volumes; when nothing in the tab
  // matches, just those four volumes. Like the volumes, the tab's results ignore
  // the publisher filter.
  const sugestoes = useMemo(() => {
    const hqs = ordenarSugestoes(lib.volumes, textoBusca, query);
    const comoVolume = (v) => ({
      tipo: "volume", chave: "v-" + v.id, id: v.id, volume: v, titulo: v.titulo,
      meta: [v.personagem, v.editora].filter(Boolean).join(" · "),
    });
    if (tab !== "colecoes" && tab !== "series") return hqs.map(comoVolume);
    let daAba;
    if (tab === "colecoes") {
      daAba = ordenarPorNome(lib.colecoes, query).slice(0, SUGESTOES_DA_ABA).map((col) => {
        const n = col.membros.filter((vid) => lib.volumes.some((v) => v.id === vid)).length;
        return {
          tipo: "colecao", chave: "c-" + col.id, id: col.id, titulo: col.nome, secao: "Coleções",
          meta: n === 0 ? "Sem volumes ainda" : n === 1 ? "1 volume" : n + " volumes",
        };
      });
    } else {
      daAba = ordenarPorNome(lib.series, query, (s) => personagensDaSerie(s).map((p) => p.nome).join(" "))
        .slice(0, SUGESTOES_DA_ABA).map((s) => {
          const eds = edicoesPorSerie[s.id] || [];
          const tenho = eds.filter((e) => ownedEdicaoIds.has(e.id)).length;
          return {
            tipo: "serie", chave: "s-" + s.id, id: s.id, titulo: s.nome, secao: "Séries",
            meta: [personagensDaSerie(s).map((p) => p.nome).join(", "), anoRange(s),
              eds.length ? tenho + " de " + eds.length : ""].filter(Boolean).join(" · "),
          };
        });
    }
    return daAba.concat(hqs.slice(0, SUGESTOES_DA_ABA).map((v) => ({ ...comoVolume(v), secao: "HQs" })));
  }, [tab, lib.volumes, lib.colecoes, lib.series, textoBusca, query, edicoesPorSerie, ownedEdicaoIds]);

  // Fold state for the HQs tab's character groups — see lerGruposFechados'
  // own comment for why this stores the closed names, inverted from the
  // séries tab's gruposAbertos below.
  const [gruposFechados, setGruposFechados] = useState(lerGruposFechados);
  // A search forces every matching group open, and so does picking a character:
  // filtering to one group and finding it folded would read as broken.
  const grupoAbertoVolumes = (personagem) =>
    buscando || personagem === filtroPersonagem || !gruposFechados.has(personagem);
  function alternarGrupoVolumes(personagem) {
    setGruposFechados((antes) => {
      const proximo = new Set(antes);
      if (proximo.has(personagem)) proximo.delete(personagem);
      else proximo.add(personagem);
      salvarGruposFechados(proximo);
      return proximo;
    });
  }
  function alternarTodosVolumes(grupos, abrir) {
    setGruposFechados((antes) => {
      const proximo = new Set(antes);
      grupos.forEach((g) => { if (abrir) proximo.delete(g.personagem); else proximo.add(g.personagem); });
      salvarGruposFechados(proximo);
      return proximo;
    });
  }

  // Characters on offer: only those with a volume under the publisher band's
  // current choice, since that is what the shelf can show. The count is what the
  // row will hold before the status and tipo filters narrow it further.
  const personagensDisponiveis = useMemo(() => {
    const n = {};
    lib.volumes.filter(casaEditora).forEach((v) => {
      if (v.personagem) n[v.personagem] = (n[v.personagem] || 0) + 1;
    });
    return Object.keys(n).sort((x, y) => x.localeCompare(y, "pt-BR")).map((nome) => ({ nome, n: n[nome] }));
  }, [lib.volumes, casaEditora]);

  // Switching the band to a publisher this character has nothing under would
  // leave an empty shelf with no visible reason, so the filter lets go instead.
  // Not while loading: the library is empty then, and every saved choice would
  // look missing and be thrown away before the real list arrived.
  useEffect(() => {
    if (loading || !filtroPersonagem) return;
    if (!personagensDisponiveis.some((o) => o.nome === filtroPersonagem)) setFiltroPersonagem("");
  }, [loading, filtroPersonagem, personagensDisponiveis]);

  const volumesFiltrados = useMemo(() => {
    let vs = lib.volumes.filter(casaEditora);
    if (query.trim()) {
      const q = query.toLowerCase();
      vs = vs.filter((v) => (textoBusca[v.id] || "").includes(q));
    }
    if (filtroStatus) vs = vs.filter((v) => v.status === filtroStatus);
    if (filtroTipo) vs = vs.filter((v) => v.tipo === filtroTipo);
    if (filtroPersonagem) vs = vs.filter((v) => v.personagem === filtroPersonagem);
    const grupos = {};
    vs.forEach((v) => { (grupos[v.personagem] = grupos[v.personagem] || []).push(v); });
    return Object.keys(grupos).sort((a, b) => a.localeCompare(b, "pt-BR")).map((p) => ({
      personagem: p,
      itens: ordenarGrupoVolumes(grupos[p]),
    }));
  }, [lib.volumes, query, filtroStatus, filtroTipo, filtroPersonagem, casaEditora, textoBusca]);

  // Reordering is restricted to the plain, unfiltered view: a search or filter
  // shows a subset of the group, and reordering only what is visible would
  // silently scramble the order of whatever is hidden. The character filter is
  // the exception: it hides whole groups, never part of one, so the group being
  // dragged in is always complete.
  const podeReordenarVolumes = !query.trim() && !filtroStatus && !filtroTipo;

  /* ---------- drag to reorder HQs, held to one personagem group ---------- */
  const {
    suppressClickRef, dragVisual, editoraCorPorNome, registrarCardNode, volDragPointerDown,
    volDragPointerMove, volDragPointerEnd,
  } = useArrastarVolumes(lib, persist);

  function abrirVolumeCard(volumeId) {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    setOpenVolumeId(volumeId);
  }

  const openVolume = lib.volumes.find((v) => v.id === openVolumeId) || null;

  function openNovoVolume() {
    // Prefilled from whichever publisher is being browsed, so cataloguing inside
    // a publisher view does not leave the field blank and drop the volume into
    // the "Sem editora" bucket.
    const ed = editoraAtual ? editoraAtual.nome : "";
    setVolumeForm({ id: null, titulo: "", personagem: "", tipo: TIPOS[0], editora: ed, ano: "", status: "nao_lida", notas: "" });
    setVolumeErrors({}); setVolumeDupWarning(null); setShowVolumeForm(true);
  }

  function duplicarVolume(v) {
    setVolumeForm({
      id: null,
      titulo: v.titulo,
      personagem: v.personagem,
      tipo: v.tipo,
      editora: v.editora,
      ano: v.ano,
      status: "nao_lida",
      notas: "",
    });
    setVolumeErrors({});
    // The duplicate warning is pre-armed: the title is knowingly the same until
    // it gets edited, so saving should not stop to ask about it.
    setVolumeDupWarning(null);
    setShowVolumeForm(true);
  }
  function openEditarVolume(v) {
    setVolumeForm({ ...v }); setVolumeErrors({}); setVolumeDupWarning(null); setShowVolumeForm(true);
  }

  function validarVolume() {
    const errs = {};
    if (!volumeForm.titulo.trim()) errs.titulo = "Informe o título do volume";
    if (!volumeForm.personagem.trim()) errs.personagem = "Informe o personagem principal";
    setVolumeErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function tituloDuplicado(titulo) {
    return lib.volumes.find((v) => v.titulo.trim().toLowerCase() === titulo.trim().toLowerCase());
  }

  function salvarVolume() {
    if (!validarVolume()) return;
    if (!volumeForm.id && !volumeDupWarning) {
      const dup = tituloDuplicado(volumeForm.titulo);
      if (dup) { setVolumeDupWarning('Já existe "' + dup.titulo + '" cadastrado. Toque em Salvar de novo pra criar mesmo assim.'); return; }
    }
    let next, novoId = volumeForm.id;
    if (volumeForm.id) {
      next = { ...lib, volumes: lib.volumes.map((v) => (v.id === volumeForm.id ? { ...v, ...volumeForm } : v)) };
    } else {
      novoId = uid();
      next = { ...lib, volumes: [...lib.volumes, { ...volumeForm, id: novoId, edicoesColetadasIds: [] }] };
    }
    persist(next);
    setShowVolumeForm(false);
    setVolumeDupWarning(null);
    setOpenVolumeId(novoId);
    showToast(volumeForm.id ? "Volume atualizado." : "Volume adicionado.");
  }

  function salvarVolumeEContinuar() {
    if (!validarVolume()) return;
    if (!volumeDupWarning) {
      const dup = tituloDuplicado(volumeForm.titulo);
      if (dup) { setVolumeDupWarning('Já existe "' + dup.titulo + '" cadastrado. Toque em "Salvar e cadastrar outro" de novo pra criar mesmo assim.'); return; }
    }
    const novo = { ...volumeForm, id: uid(), edicoesColetadasIds: [] };
    persist({ ...lib, volumes: [...lib.volumes, novo] });
    showToast('"' + novo.titulo + '" adicionado. Pronto pro próximo.');
    setVolumeForm((f) => ({
      id: null, titulo: "", personagem: f.personagem, tipo: f.tipo,
      editora: f.editora, ano: "", status: "nao_lida", notas: "",
    }));
    setVolumeErrors({});
    setVolumeDupWarning(null);
  }

  function setStatusVolume(volumeId, status) {
    persist({ ...lib, volumes: lib.volumes.map((v) => (v.id === volumeId ? { ...v, status } : v)) });
  }

  async function handleCoverPick(volumeId, file) {
    if (!file) return;
    setUploadingCover(true);
    try {
      const res = await uploadCover(file);
      const current = libRef.current;
      persist({
        ...current,
        volumes: current.volumes.map((v) => (v.id === volumeId ? { ...v, capaAssetId: res.id } : v)),
      });
      showToast("Capa atualizada.");
    } catch (e) {
      showToast(assetErrorMessage(e));
    } finally {
      setUploadingCover(false);
    }
  }

  /* ---------- coleções ---------- */
  const [openColecaoId, setOpenColecaoId] = useState(null);
  const [showColecaoForm, setShowColecaoForm] = useState(false);
  const [colecaoForm, setColecaoForm] = useState(null);
  const [colecaoErrors, setColecaoErrors] = useState({});
  const [addMemberSel, setAddMemberSel] = useState("");

  const colecoesFiltradas = useMemo(() => {
    // A collection has no publisher of its own, so it inherits from its members:
    // it shows under any publisher it holds a volume from, which is what a
    // crossover saga should do.
    let cs = lib.colecoes.filter((c) => {
      if (buscando || (lib.editoraSel || ED_TODAS) === ED_TODAS) return true;
      const membros = c.membros.map((vid) => lib.volumes.find((v) => v.id === vid)).filter(Boolean);
      if (!membros.length) return (lib.editoraSel || ED_TODAS) === ED_SEM;
      return membros.some(casaEditora);
    });
    if (query.trim()) {
      const q = query.toLowerCase();
      cs = cs.filter((c) => c.nome.toLowerCase().includes(q));
    }
    return cs.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [lib.colecoes, lib.volumes, query, buscando, lib.editoraSel, casaEditora]);

  const openColecao = lib.colecoes.find((c) => c.id === openColecaoId) || null;

  // Whether a collection's strip is wider than the column, and so has a spine
  // bar to colour. v66 asked the bar itself, but a folded collection has no
  // strip mounted, so its colour option vanished with it (v80). Worked out from
  // sizes instead: the strip spans the column's content box, and its covers are
  // .coll-strip's flex-basis (108px, 124px from 640px) with 14px gaps.
  const conteudoRef = useRef(null);
  const [larguraConteudo, setLarguraConteudo] = useState(0);
  useLayoutEffect(() => {
    const el = conteudoRef.current;
    if (!el) return undefined;
    const medir = () => {
      const cs = getComputedStyle(el);
      setLarguraConteudo(el.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0));
    };
    medir();
    if (typeof ResizeObserver !== "function") return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const colecaoRola = (c) => {
    const n = c.membros.filter((vid) => lib.volumes.some((v) => v.id === vid)).length;
    if (n === 0) return false;
    const largo = typeof window !== "undefined" && window.matchMedia
      && window.matchMedia("(min-width: 640px)").matches;
    const capa = largo ? 124 : 108;
    // Unknown width (before the first measure) offers the option rather than hiding it.
    return larguraConteudo <= 0 || n * capa + (n - 1) * 14 > larguraConteudo + 1;
  };

  const [ordemRecolhida, setOrdemRecolhida] = useState(lerOrdemRecolhida);

  const [colecoesFechadas, setColecoesFechadas] = useState(lerColecoesFechadas);
  // A search forces every collection open, as it does every HQs group.
  const colecaoAberta = (id) => buscando || !colecoesFechadas.has(id);
  function alternarColecao(id) {
    setColecoesFechadas((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      salvarColecoesFechadas(n);
      return n;
    });
  }
  function alternarTodasColecoes(lista, abrir) {
    setColecoesFechadas((prev) => {
      const n = new Set(prev);
      lista.forEach((col) => { if (abrir) n.delete(col.id); else n.add(col.id); });
      salvarColecoesFechadas(n);
      return n;
    });
  }
  function alternarOrdem(id) {
    setOrdemRecolhida((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      salvarOrdemRecolhida(n);
      return n;
    });
  }

  function definirCorBarra(colecaoId, spec) {
    persist({
      ...lib,
      colecoes: lib.colecoes.map((c) => {
        if (c.id !== colecaoId) return c;
        const { corBarra, ...resto } = c;
        return spec ? { ...resto, corBarra: spec } : resto;
      }),
    });
  }

  function openNovaColecao() {
    setColecaoForm({ id: null, nome: "", descricao: "" }); setColecaoErrors({}); setShowColecaoForm(true);
  }
  function openEditarColecao(c) {
    setColecaoForm({ id: c.id, nome: c.nome, descricao: c.descricao }); setColecaoErrors({}); setShowColecaoForm(true);
  }
  function salvarColecao() {
    const errs = {};
    if (!colecaoForm.nome.trim()) errs.nome = "Informe o nome da coleção";
    setColecaoErrors(errs);
    if (Object.keys(errs).length) return;
    let next, novoId = colecaoForm.id;
    if (colecaoForm.id) {
      next = { ...lib, colecoes: lib.colecoes.map((c) => (c.id === colecaoForm.id ? { ...c, nome: colecaoForm.nome.trim(), descricao: colecaoForm.descricao.trim() } : c)) };
    } else {
      novoId = uid();
      next = { ...lib, colecoes: [...lib.colecoes, { id: novoId, nome: colecaoForm.nome.trim(), descricao: colecaoForm.descricao.trim(), membros: [] }] };
    }
    persist(next);
    setShowColecaoForm(false);
    setOpenColecaoId(novoId);
    showToast(colecaoForm.id ? "Coleção atualizada." : "Coleção criada.");
  }
  function adicionarMembro(colecaoId, volumeId) {
    persist({ ...lib, colecoes: lib.colecoes.map((c) => (c.id === colecaoId ? { ...c, membros: [...c.membros, volumeId] } : c)) });
    setAddMemberSel("");
  }
  function removerMembro(colecaoId, volumeId) {
    persist({ ...lib, colecoes: lib.colecoes.map((c) => (c.id === colecaoId ? { ...c, membros: c.membros.filter((v) => v !== volumeId) } : c)) });
  }
  function moverMembro(colecaoId, index, direcao) {
    const c = lib.colecoes.find((x) => x.id === colecaoId);
    const membros = [...c.membros];
    const j = index + direcao;
    if (j < 0 || j >= membros.length) return;
    const tmp = membros[index]; membros[index] = membros[j]; membros[j] = tmp;
    persist({ ...lib, colecoes: lib.colecoes.map((x) => (x.id === colecaoId ? { ...x, membros } : x)) });
  }
  function personagensDaColecao(colecao) {
    const set = new Set(colecao.membros.map((vid) => lib.volumes.find((v) => v.id === vid)?.personagem).filter(Boolean));
    return Array.from(set);
  }

  /* ---------- séries ---------- */
  const [openSerieId, setOpenSerieId] = useState(null);
  const [gruposAbertos, setGruposAbertos] = useState(lerGruposAbertos);

  // A search opens every group that matched, without writing to gruposAbertos:
  // the set keeps what the user chose by hand, and the search only overrides how
  // it is read while a query exists. Clearing the field puts the list back
  // exactly as they left it, instead of having quietly opened half of it.
  const grupoAberto = (personagem) => buscando || gruposAbertos.has(personagem);

  function alternarGrupo(personagem) {
    setGruposAbertos((antes) => {
      const proximo = new Set(antes);
      if (proximo.has(personagem)) proximo.delete(personagem);
      else proximo.add(personagem);
      salvarGruposAbertos(proximo);
      return proximo;
    });
  }

  // Only ever touches the groups currently on screen. Clearing the whole set
  // instead would also forget characters that a publisher filter is hiding
  // right now, which the user never asked to close.
  function alternarTodos(grupos, abrir) {
    setGruposAbertos((antes) => {
      const proximo = new Set(antes);
      grupos.forEach((g) => { if (abrir) proximo.add(g.personagem); else proximo.delete(g.personagem); });
      salvarGruposAbertos(proximo);
      return proximo;
    });
  }
  const [openSerieContexto, setOpenSerieContexto] = useState(null);
  const [verTudoSerie, setVerTudoSerie] = useState(false);
  const [showSerieForm, setShowSerieForm] = useState(false);
  const [serieForm, setSerieForm] = useState(null);
  const [serieErrors, setSerieErrors] = useState({});
  const [serieDupWarning, setSerieDupWarning] = useState(null);
  const [showEdicaoForm, setShowEdicaoForm] = useState(false);
  const [edicaoForm, setEdicaoForm] = useState(null);
  const [selectedEdicaoId, setSelectedEdicaoId] = useState(null);
  const [serieBusca, setSerieBusca] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSerieId, setImportSerieId] = useState(null);
  const [importText, setImportText] = useState("");

  const seriesFiltradas = useMemo(() => {
    let ss = lib.series.filter(casaEditora);
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
        const oa = a.serie.ordem ?? null, ob = b.serie.ordem ?? null;
        if (oa !== null && ob !== null) return oa - ob;
        if (oa !== null) return -1;
        if (ob !== null) return 1;
        return (parseInt(a.serie.anoInicio, 10) || 9999) - (parseInt(b.serie.anoInicio, 10) || 9999);
      }),
    }));
  }, [lib.series, query, casaEditora]);

  const openSerie = lib.series.find((s) => s.id === openSerieId) || null;

  // A séries row opens its série limited to the row's own range. Only setters
  // inside, so it stays one function and the memoised rows can skip renders.
  const abrirSerieNaFaixa = useCallback((serie, faixa) => {
    setOpenSerieId(serie.id);
    setOpenSerieContexto(faixa);
    setVerTudoSerie(false);
    setSelectedEdicaoId(null);
    setSerieBusca("");
  }, []);

  function openNovaSerie() {
    setSerieForm({ id: null, nome: "", personagensList: [{ nome: "", de: "", ate: "" }], editora: "", anoInicio: "", anoFim: "", totalEdicoes: "", ordem: "" });
    setSerieErrors({}); setSerieDupWarning(null); setShowSerieForm(true);
  }
  function openEditarSerie(s) {
    const lista = personagensDaSerie(s).map((p) => ({
      nome: p.nome,
      de: p.de !== null && p.de !== undefined ? String(p.de) : "",
      ate: p.ate !== null && p.ate !== undefined ? String(p.ate) : "",
    }));
    setSerieForm({
      ...s,
      personagensList: lista.length ? lista : [{ nome: "", de: "", ate: "" }],
      totalEdicoes: s.totalEdicoes || "",
      ordem: s.ordem !== null && s.ordem !== undefined ? String(s.ordem) : "",
    });
    setSerieErrors({}); setSerieDupWarning(null); setShowSerieForm(true);
  }
  function salvarSerie() {
    const errs = {};
    if (!serieForm.nome.trim()) errs.nome = "Informe o nome da série";
    if (!serieForm.personagensList.some((p) => p.nome.trim())) errs.personagem = "Informe ao menos um personagem";
    setSerieErrors(errs);
    if (Object.keys(errs).length) return;
    if (!serieForm.id && !serieDupWarning) {
      const dup = lib.series.find((s) => s.nome.trim().toLowerCase() === serieForm.nome.trim().toLowerCase());
      if (dup) { setSerieDupWarning('Já existe uma série chamada "' + dup.nome + '". Toque em Salvar de novo pra criar mesmo assim.'); return; }
    }
    const payload = {
      nome: serieForm.nome.trim(),
      personagens: serieForm.personagensList.filter((p) => p.nome.trim()).map((p) => ({
        nome: p.nome.trim(),
        de: p.de !== "" && !isNaN(parseInt(p.de, 10)) ? parseInt(p.de, 10) : null,
        ate: p.ate !== "" && !isNaN(parseInt(p.ate, 10)) ? parseInt(p.ate, 10) : null,
      })),
      editora: serieForm.editora.trim(),
      anoInicio: serieForm.anoInicio.trim(),
      anoFim: serieForm.anoFim.trim(),
      totalEdicoes: serieForm.totalEdicoes ? parseInt(serieForm.totalEdicoes, 10) : null,
      ordem: serieForm.ordem.trim() !== "" && !isNaN(parseFloat(serieForm.ordem)) ? parseFloat(serieForm.ordem) : null,
    };
    let next, novoId = serieForm.id;
    if (serieForm.id) {
      next = { ...lib, series: lib.series.map((s) => (s.id === serieForm.id ? { ...payload, id: s.id } : s)) };
    } else {
      novoId = uid();
      next = { ...lib, series: [...lib.series, { ...payload, id: novoId }] };
    }
    persist(next);
    setShowSerieForm(false);
    setSerieDupWarning(null);
    setOpenSerieId(novoId);
    showToast(serieForm.id ? "Série atualizada." : "Série criada.");
  }

  function salvarEdicao() {
    if (!edicaoForm.numero.trim()) { showToast("Informe o número da edição."); return; }
    const payload = {
      ...edicaoForm,
      posicao: edicaoForm.posicao.trim() !== "" && !isNaN(parseFloat(edicaoForm.posicao)) ? parseFloat(edicaoForm.posicao) : null,
    };
    const next = payload.id
      ? { ...lib, edicoes: lib.edicoes.map((e) => (e.id === payload.id ? payload : e)) }
      : { ...lib, edicoes: [...lib.edicoes, { ...payload, id: uid() }] };
    persist(next);
    setShowEdicaoForm(false);
    showToast("Edição salva.");
  }

  function importarEdicoes() {
    const registros = parseImportText(importText);
    if (!registros.length) { showToast("Nada reconhecido pra importar."); return; }
    let edicoes = [...lib.edicoes];
    let criadas = 0, atualizadas = 0;
    registros.forEach((r) => {
      const ex = edicoes.find((e) => e.serieId === importSerieId && e.numero.trim().toLowerCase() === r.numero.trim().toLowerCase());
      if (ex) {
        edicoes = edicoes.map((e) => (e.id === ex.id ? { ...e, mes: r.mes || e.mes, ano: r.ano || e.ano } : e));
        atualizadas++;
      } else {
        edicoes.push({ id: uid(), serieId: importSerieId, numero: r.numero, mes: r.mes, ano: r.ano, posicao: null });
        criadas++;
      }
    });
    persist({ ...lib, edicoes });
    setShowImportModal(false);
    setImportText("");
    showToast(criadas + " criadas, " + atualizadas + " atualizadas.");
  }

  /* ---------- linking ---------- */
  const [linkSerieId, setLinkSerieId] = useState(null);
  const [linkPickSerie, setLinkPickSerie] = useState("");
  const [rangeDe, setRangeDe] = useState("");
  const [rangeAte, setRangeAte] = useState("");
  const [avulsoNum, setAvulsoNum] = useState("");

  function toggleLigacaoEdicao(volumeId, edicaoId) {
    persist({
      ...lib,
      volumes: lib.volumes.map((v) => {
        if (v.id !== volumeId) return v;
        const has = v.edicoesColetadasIds.includes(edicaoId);
        return {
          ...v,
          edicoesColetadasIds: has
            ? v.edicoesColetadasIds.filter((id) => id !== edicaoId)
            : [...v.edicoesColetadasIds, edicaoId],
        };
      }),
    });
  }

  function vincularIntervalo(volumeId, serieId) {
    const de = parseInt(rangeDe, 10), ate = parseInt(rangeAte, 10);
    if (!de || !ate || ate < de) { showToast("Intervalo inválido."); return; }
    const { edicoes, ids } = ensureRange(lib, serieId, de, ate);
    persist({
      ...lib,
      edicoes,
      volumes: lib.volumes.map((v) => (v.id === volumeId
        ? { ...v, edicoesColetadasIds: Array.from(new Set([...v.edicoesColetadasIds, ...ids])) }
        : v)),
    });
    setRangeDe(""); setRangeAte("");
    showToast("Vinculado do " + de + " ao " + ate + ".");
  }

  function vincularAvulsa(volumeId, serieId) {
    if (!avulsoNum.trim()) return;
    const { edicoes, id } = ensureAvulsa(lib, serieId, avulsoNum);
    persist({
      ...lib,
      edicoes,
      volumes: lib.volumes.map((v) => (v.id === volumeId
        ? { ...v, edicoesColetadasIds: Array.from(new Set([...v.edicoesColetadasIds, id])) }
        : v)),
    });
    setAvulsoNum("");
    showToast("Edição vinculada.");
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
    Object.values(grupos).forEach((g) =>
      g.edicoes.sort((a, b) => (parseNum(a.numero) ?? 1e9) - (parseNum(b.numero) ?? 1e9))
    );
    return Object.values(grupos);
  }

  /* ---------- deletion ---------- */
  // v88: a single item goes at once, with "Desfazer" in the toast instead of a
  // question first; only "Zerar tudo" still asks. Undo restores the whole library
  // as it was just before, which is what brings back everything a removal touched
  // (a volume's place in its collections, a série's edições and the volumes' links
  // to them) without a restore rule per type. That is only safe while nothing else
  // has changed since, so the offer holds exactly while the library is still the
  // one the removal produced: persist is the only thing that replaces it.
  const AVISO_REMOCAO = {
    volume: "Volume removido.", colecao: "Coleção removida.", serie: "Série removida.",
    edicao: "Edição removida.", all: "Biblioteca zerada.",
  };

  function remover({ type, id }) {
    const antes = lib;
    let next = lib;
    let reabrir = null;
    if (type === "volume") {
      next = deleteVolume(lib, id);
      if (openVolumeId === id) { setOpenVolumeId(null); reabrir = () => setOpenVolumeId(id); }
    }
    if (type === "colecao") {
      next = deleteColecao(lib, id);
      if (openColecaoId === id) { setOpenColecaoId(null); reabrir = () => setOpenColecaoId(id); }
    }
    if (type === "serie") {
      next = deleteSerie(lib, id);
      if (openSerieId === id) { setOpenSerieId(null); reabrir = () => setOpenSerieId(id); }
    }
    if (type === "edicao") {
      next = deleteEdicao(lib, id);
      if (selectedEdicaoId === id) reabrir = () => setSelectedEdicaoId(id);
      setSelectedEdicaoId(null);
    }
    if (type === "all") {
      next = EMPTY_LIB;
      setOpenVolumeId(null); setOpenColecaoId(null); setOpenSerieId(null);
    }
    persist(next);
    showToast(AVISO_REMOCAO[type], { antes, depois: next, reabrir });
  }

  function confirmarExclusao() {
    if (!confirmDelete) return;
    remover(confirmDelete);
    setConfirmDelete(null);
  }

  const desfazerAtual = toast && toast.desfazer && lib === toast.desfazer.depois ? toast.desfazer : null;

  function desfazer() {
    if (!desfazerAtual || libRef.current !== desfazerAtual.depois) return;
    persist(desfazerAtual.antes);
    if (desfazerAtual.reabrir) desfazerAtual.reabrir();
    showToast("Desfeito.");
  }

  /* ---------- backup ---------- */
  const fileInputRef = useRef(null);

  // A page-initiated download is inert inside the artifact sandbox, so the
  // export goes through the downloads capability, with copy-to-clipboard as
  // the fallback for views where that capability is not available.
  async function exportJson() {
    const data = JSON.stringify(libRef.current, null, 2);
    if (store.downloads) {
      try {
        await store.downloads.save({ filename: "longbox.json", data });
        showToast("Backup salvo.");
        return;
      } catch (e) {
        const code = e && e.code;
        if (code === "declined") return;
        if (code === "rate_limited") { showToast("Já tem um pedido de download aberto."); return; }
        if (code === "too_large") { showToast("O backup ficou grande demais para salvar assim."); return; }
      }
    }
    setExportText(data);
  }

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(exportText);
      showToast("Backup copiado. Cole num arquivo .json e guarde.");
    } catch (e) {
      showToast("Não consegui copiar. Selecione o texto e copie na mão.");
    }
  }

  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        if (!raw || typeof raw !== "object" || !Array.isArray(raw.volumes)) {
          showToast("Esse arquivo não parece um backup do Longbox.");
          return;
        }
        const incoming = normalizeLib(raw);
        persist(incoming);
        setOpenVolumeId(null); setOpenColecaoId(null); setOpenSerieId(null);
        showToast(
          incoming.volumes.length + " volumes, " + incoming.series.length +
          " séries e " + incoming.edicoes.length + " edições importadas."
        );
      } catch (e) {
        showToast("Não consegui ler esse arquivo JSON.");
      }
    };
    reader.readAsText(file);
  }

  /* ---------- stats ---------- */
  const statsGerais = useMemo(() => {
    let totalPossuidas = 0;
    const porSerie = lib.series.map((s) => {
      const eds = edicoesPorSerie[s.id] || [];
      const owned = eds.filter((e) => ownedEdicaoIds.has(e.id)).length;
      totalPossuidas += owned;
      return { serie: s, owned, total: s.totalEdicoes || null };
    });
    // Only series genuinely near the finish line, then three of them at random.
    // Ranking by percentage was the old bug: a complete 4-issue miniseries is
    // not an achievement, and it topped the chart forever.
    const comMeta = porSerie.filter((p) => p.total);
    const quase = comMeta.filter(
      (p) => p.total - p.owned > 0 && p.owned / p.total >= QUASE_FECHANDO
    );
    return {
      totalPossuidas,
      totalCatalogadas: lib.edicoes.length,
      // Drawn at random, then ordered: the three that show are still a random
      // three of everything past the threshold (the point being to surface
      // something forgotten), but among themselves they read closest-to-done
      // first, so the list has a direction instead of arriving shuffled.
      //
      // Compared by cross-multiplication rather than by owned / total: the
      // ratios are only ever used to rank, and two genuinely equal fractions
      // divided out as floats are not reliably equal afterwards, which would
      // hand ties to whatever the draw happened to produce instead of to the
      // alphabet. Integers multiplied out are exact, so a tie is a real tie.
      faltaPouco: seededPick(quase, 3, SESSION_SEED).sort((a, b) => {
        const porCompletude = b.owned * a.total - a.owned * b.total;
        if (porCompletude !== 0) return porCompletude;
        return a.serie.nome.localeCompare(b.serie.nome, "pt-BR");
      }),
      quaseFechando: quase.length,
      temMetas: comMeta.length > 0,
    };
  }, [lib.series, lib.edicoes, edicoesPorSerie, ownedEdicaoIds]);

  const docUsage = useMemo(() => {
    const docs = [
      { nome: "Volumes", bytes: bytesOf({ items: lib.volumes }) },
      { nome: "Coleções", bytes: bytesOf({ items: lib.colecoes }) },
      { nome: "Séries", bytes: bytesOf({ items: lib.series }) },
    ];
    shardEdicoes(lib.edicoes).forEach((items, sid) => {
      const s = serieById[sid];
      docs.push({ nome: "Edições de " + (s ? s.nome : "série removida"), bytes: bytesOf({ items }) });
    });
    const maior = docs.reduce((a, b) => (b.bytes > a.bytes ? b : a), docs[0]);
    return { maior, pct: (maior.bytes / DOC_LIMIT) * 100 };
  }, [lib, serieById]);

  const isHub = tab === "hub";

  // v80: the three tabs stay mounted once built, hidden when not in use, so
  // coming back to one does not rebuild every card and cover from scratch. The
  // tab on screen is built at once; the others are built just after the
  // library loads, in a quiet moment, so they are ready before the first switch.
  // v85: shelf thumbnails for every cover in use, made once per device.
  // Only with a loaded, non-empty library: the same call forgets thumbnails no
  // volume uses, and an empty list after a failed load would forget them all.
  const idsCapas = useMemo(
    () => [...new Set(lib.volumes.map((v) => v.capaAssetId).filter(Boolean))].join("|"),
    [lib.volumes]
  );
  useEffect(() => {
    if (loading || !idsCapas) return;
    prepararMiniaturas(idsCapas.split("|"));
  }, [loading, idsCapas]);

  const [abasProntas, setAbasProntas] = useState(false);
  const abaMontada = (k) => tab === k || abasProntas;
  useEffect(() => {
    if (loading || abasProntas) return undefined;
    const ric = typeof window !== "undefined" && window.requestIdleCallback;
    const id = ric ? ric(() => setAbasProntas(true), { timeout: 1500 }) : setTimeout(() => setAbasProntas(true), 400);
    return () => { if (ric) window.cancelIdleCallback(id); else clearTimeout(id); };
  }, [loading, abasProntas]);

  // The lattice under the tabs burns in the colour of the publisher being read,
  // the same one the band is tinted with, and falls back to the cyan the
  // interface owns when no publisher is chosen.
  useLarguraDaBarra();
  const ponteiroFino = usePonteiroFino();
  // The lattice is the ground the tab content sits on, so it is there from the
  // first paint: waiting for the library would swap the background mid-load.
  const comMalha = !isHub && ponteiroFino;
  // Only the hue travels to the header and the strip; the accent's own
  // saturation and lightness stay, so contrast never moves. A publisher with no
  // colour, or a greyscale one, lends nothing: hue 0 would come out red.
  const edCroma = useMemo(() => {
    if (isHub) return null;
    const sel = lib.editoraSel || ED_TODAS;
    const atual = (lib.editoras || []).find((e) => e.id === sel);
    const spec = atual && atual.cor;
    if (!spec || spec.h === undefined || spec.h === null) return null;
    if (spec.s !== undefined && spec.s < 12) return null;
    // The two themes render the hue at their own lightness, so each gets its own
    // reading and they do not always agree.
    return {
      h: spec.h,
      tintaEscuro: tintaSobre(spec.h, 100, 42),
      tintaClaro: tintaSobre(spec.h, 100, 33),
    };
  }, [isHub, lib.editoras, lib.editoraSel]);
  const edHue = edCroma ? edCroma.h : null;

  // The publisher's backdrop colour, for the gradient that now runs from the very
  // top of the page through the header into the band (v68). Only where the band
  // is tinted, so never on the hub.
  const edFundo = useMemo(() => {
    if (isHub) return null;
    const sel = lib.editoraSel || ED_TODAS;
    const atual = (lib.editoras || []).find((e) => e.id === sel);
    // Both ends of the colour: the deep cover shade tints the dark theme, the
    // vivid edge tints the light one (v79; the deep shade read as grey smoke
    // on a light page).
    const par = (c) => ({ fundo: c.b, vivo: c.edge });
    if (atual) return atual.cor ? par(swatchColors(atual.cor, 0)) : null;
    // Todas as editoras: the Longbox cyan, as in the band (v70).
    return sel === ED_SEM ? null : par(swatchColors(COR_LONGBOX, 0));
  }, [isHub, lib.editoras, lib.editoraSel]);

  const malhaCor = useMemo(() => {
    const sel = lib.editoraSel || ED_TODAS;
    const atual = (lib.editoras || []).find((e) => e.id === sel);
    return atual && atual.cor ? swatchColors(atual.cor, 0).edge : ACCENT_HEX;
  }, [lib.editoras, lib.editoraSel]);

  const switchTab = useCallback((key) => {
    setTab((prev) => {
      // Coming back to the hub reverses the unlock: it drops in from the top,
      // the same path it left by.
      if (key === "hub" && prev !== "hub") setHubReturning(true);
      return key;
    });
    setQuery("");
    if (typeof window !== "undefined" && window.scrollTo) window.scrollTo(0, 0);
  }, []);

  // Written from the state rather than from switchTab, so every route into a tab
  // is covered, including the scroll gesture that unlocks the hub.
  useEffect(() => { salvarAba(tab); }, [tab]);

  const entrarNaColecao = useCallback(() => switchTab("volumes"), [switchTab]);

  // From a volume's "Edições coletadas" tile: open that edição's série card
  // stacked on top of the volume sheet, without touching the active tab or
  // closing the volume underneath it — closing the série sheet reveals the
  // volume sheet again, exactly as it was. Unfiltered (no faixa contexto) so
  // the clicked edição is guaranteed visible and lands selected, same as
  // clicking a tile inside the séries tab itself.
  const abrirEdicaoNaSerie = useCallback((serieId, edicaoId) => {
    setOpenSerieId(serieId);
    setOpenSerieContexto(null);
    setSelectedEdicaoId(edicaoId);
  }, []);

  useHubUnlock(isHub && !loading, hubAtBottom, hubElRef, entrarNaColecao);

  useEffect(() => {
    if (!hubReturning) return;
    const t = setTimeout(() => setHubReturning(false), 320);
    return () => clearTimeout(t);
  }, [hubReturning]);

  function escolherCor(personagem, spec) {
    const chave = (personagem || "").trim().toLowerCase();
    if (!chave) return;
    const cores = { ...(lib.cores || {}) };
    if (spec === null) delete cores[chave];
    else cores[chave] = spec;
    persist({ ...lib, cores });
    setCorPersonagem(null);
  }

  const [showEditoras, setShowEditoras] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);

  function selecionarEditora(id) {
    persist({ ...lib, editoraSel: id });
  }

  // One handler for the three shapes: null id adds, null patch removes, otherwise merge.
  function alterarEditora(id, patch) {
    if (id === null) {
      const nome = (patch.nome || "").trim();
      if (!nome) return;
      const existe = (lib.editoras || []).some((e) => (e.nome || "").toLowerCase() === nome.toLowerCase());
      if (existe) { showToast("Já existe uma editora com esse nome."); return; }
      const nova = { id: slugify(nome) + "-" + uid().slice(0, 4), nome, cor: null, logoAssetId: null, logoFundo: "nenhum" };
      persist({ ...lib, editoras: [...(lib.editoras || []), nova] });
      return;
    }
    if (patch === null) {
      const next = { ...lib, editoras: (lib.editoras || []).filter((e) => e.id !== id) };
      if (lib.editoraSel === id) next.editoraSel = ED_TODAS;
      persist(next);
      return;
    }
    persist({
      ...lib,
      editoras: (lib.editoras || []).map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  }

  async function enviarLogo(id, file) {
    if (!file) return;
    setEnviandoLogo(true);
    try {
      const res = await uploadCover(file);
      const atual = libRef.current;
      persist({
        ...atual,
        editoras: (atual.editoras || []).map((e) => (e.id === id ? { ...e, logoAssetId: res.id } : e)),
      });
      showToast("Logo enviado.");
    } catch (e) {
      showToast(assetErrorMessage(e));
    } finally {
      setEnviandoLogo(false);
    }
  }

  function novoNaAba() {
    if (tab === "colecoes") openNovaColecao();
    else if (tab === "series") openNovaSerie();
    else openNovoVolume();
  }

  /* ============================ render ============================ */

  return (
    <CoresContext.Provider value={lib.cores || null}>
    <div
      className="app"
      data-ed-tint={edCroma ? "true" : undefined}
      data-ed-fundo={edFundo ? "true" : undefined}
      style={edCroma || edFundo ? {
        ...(edCroma ? { "--ed-hue": edCroma.h } : null),
        ...(edFundo ? { "--ed-fundo": edFundo.fundo, "--ed-vivo": edFundo.vivo } : null),
      } : undefined}
    >
      <datalist id="personagens-list">
        {personagens.map((p) => <option key={p} value={p} />)}
      </datalist>

      <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />

      <header
        className="topbar"
        data-scrolled={scrolled ? "true" : "false"}
        data-ed-hue={edHue == null ? undefined : "true"}
        style={
          edCroma == null
            ? undefined
            : {
                "--ed-hue": edCroma.h,
                "--ed-ink-escuro": edCroma.tintaEscuro,
                "--ed-ink-claro": edCroma.tintaClaro,
              }
        }
      >
        <div className="topbar-inner">
          {isHub ? (
            <span className="brand">
              <span className="mark" aria-hidden="true"><i /><i /><i /><i /></span>
              <span className="wordmark">LONG<b>BOX</b></span>
            </span>
          ) : (
            <button className="brand" onClick={() => switchTab("hub")} aria-label="Voltar ao início">
              <ChevronLeft size={18} className="brand-chev" />
              <span className="mark" aria-hidden="true"><i /><i /><i /><i /></span>
              <span className="wordmark">LONG<b>BOX</b></span>
            </button>
          )}

          <div style={{ flex: 1 }} />

          {!isHub && (
            <SearchBox
              query={query}
              setQuery={setQuery}
              sugestoes={sugestoes}
              onPick={(s) => {
                if (s.tipo === "colecao") { setOpenColecaoId(s.id); return; }
                if (s.tipo === "serie") {
                  setOpenSerieId(s.id);
                  setOpenSerieContexto(null);
                  setVerTudoSerie(false);
                  setSelectedEdicaoId(null);
                  setSerieBusca("");
                  return;
                }
                switchTab("volumes");
                setOpenVolumeId(s.id);
              }}
            />
          )}
          {tab === "volumes" && (
            <button
              className="btn-icon btn-filtros"
              data-active={showFiltros ? "true" : "false"}
              data-filtrando={filtrosAtivos > 0 ? "true" : "false"}
              onClick={() => setShowFiltros((s) => !s)}
              aria-label={filtrosAtivos > 0 ? "Filtros, " + filtrosAtivos + (filtrosAtivos === 1 ? " ativo" : " ativos") : "Filtros"}
              aria-expanded={showFiltros ? "true" : "false"}
              data-dica={(showFiltros ? "Esconder filtros" : "Mostrar filtros") +
                (filtrosAtivos > 0 ? " (" + filtrosAtivos + (filtrosAtivos === 1 ? " ativo)" : " ativos)") : "")}
            >
              <SlidersHorizontal size={16} />
              {filtrosAtivos > 0 && <span className="btn-badge" aria-hidden="true">{filtrosAtivos}</span>}
            </button>
          )}
          <button className={isHub ? "btn btn-quiet" : "btn btn-primary"} onClick={novoNaAba}>
            <Plus size={15} /> Novo
          </button>
          {isHub && (
            <button className="btn btn-primary" onClick={entrarNaColecao}>
              <Library size={15} />
              <span><span className="label-wide">Minha </span>Coleção</span>
            </button>
          )}
        </div>
      </header>

      {/* Drawn during the load too, so the content does not jump down the page the
          moment the library lands. The count is held blank until there is a real
          one: a "0 HQs" that turns into 47 reads as a wrong answer, not a wait. */}
      {!isHub && (
        <EditoraBar
          editoras={lib.editoras || []}
          selecionada={lib.editoraSel || ED_TODAS}
          onSelect={selecionarEditora}
          onManage={() => setShowEditoras(true)}
          buscando={!loading && buscando}
          tabs={TABS}
          tab={tab}
          onTab={switchTab}
          edCroma={edCroma}
          contagem={
            loading ? ""
              : tab === "volumes" ? volumesFiltrados.reduce((s, g) => s + g.itens.length, 0) + " HQs"
              : tab === "colecoes" ? colecoesFiltradas.length + " coleções"
              : seriesFiltradas.reduce((s, g) => s + g.itens.length, 0) + " séries"
          }
        />
      )}

      <main className="content" ref={conteudoRef} data-lattice={comMalha ? "true" : "false"}>
        {comMalha && (
          <CursorGrid
            pointerTarget={typeof window === "undefined" ? null : window}
            color={malhaCor}
            cellSize={38}
            radius={130}
            falloff="smooth"
            holdTime={220}
            fadeDuration={650}
            lineWidth={1}
            maxOpacity={0.3}
            fillOpacity={0.05}
            gridOpacity={0.025}
            cellRadius={4}
            clickPulse
            pulseSpeed={850}
          />
        )}
        {storageMode === "memory" && (
          <div className="banner" data-tone="warn">
            <AlertTriangle size={16} />
            <div>
              <strong>Nada está sendo salvo nesta visualização.</strong> O armazenamento do
              artefato não está disponível aqui, então tudo que você cadastrar some ao
              recarregar. Abra o artefato publicado na sua conta para usar de verdade.
            </div>
          </div>
        )}

        {!loading && isHub && (
          <Hub
            lib={lib}
            stats={statsGerais}
            docUsage={docUsage}
            edicoesPorSerie={edicoesPorSerie}
            ownedIds={ownedEdicaoIds}
            onOpenVolume={(id) => { switchTab("volumes"); setOpenVolumeId(id); }}
            onOpenSerie={(id) => { switchTab("series"); setOpenSerieId(id); setOpenSerieContexto(null); }}
            onNovo={openNovoVolume}
            onEnter={entrarNaColecao}
            sentinelRef={hubSentinelRef}
            rootRef={hubElRef}
            returning={hubReturning}
          />
        )}

        {tab === "volumes" && showFiltros && (
          <div className="filtros-hqs" style={{ marginBottom: 20 }}>
          <div className="filtros-linha">
            <OpcaoFiltro
              id="filtro-status"
              rotulo="Filtrar por status"
              todos="Todos os status"
              valor={filtroStatus}
              opcoes={OPCOES_STATUS}
              onChange={setFiltroStatus}
            />
            <OpcaoFiltro
              id="filtro-tipo"
              rotulo="Filtrar por tipo"
              todos="Todos os tipos"
              valor={filtroTipo}
              opcoes={OPCOES_TIPO}
              onChange={setFiltroTipo}
            />
            <PersonagemFiltro
              valor={filtroPersonagem}
              opcoes={personagensDisponiveis}
              onChange={setFiltroPersonagem}
            />
            {/* Always in the row, so the row never reflows; enabled only when a
                filter is set. The publisher band is left alone: it is its own
                choice, saved in the database. */}
            <button
              type="button"
              className="btn btn-quiet filtros-limpar"
              disabled={filtrosAtivos === 0}
              aria-label="Limpar filtros"
              onClick={() => { setFiltroStatus(""); setFiltroTipo(""); setFiltroPersonagem(""); }}
            >
              <X size={14} /> <span className="label-wide">Limpar filtros</span>
            </button>
          </div>
          </div>
        )}

        {loading && (
          <>
            {/* The blocks themselves are hidden from a screen reader, since a
                grey rectangle has nothing to say. This line does the talking. */}
            <p className="sr-only" role="status">Carregando sua biblioteca</p>
            {isHub ? <HubSkeleton />
              : tab === "volumes" ? <ShelfSkeleton />
              : tab === "colecoes" ? <ColecoesSkeleton />
              : <SeriesSkeleton />}
          </>
        )}

        {/* ===================== HQs ===================== */}
        {!loading && abaMontada("volumes") && (
          <Aba ativa={tab === "volumes"} render={() => (
          <AbaHqs
            lib={lib}
            setCorPersonagem={setCorPersonagem}
            openVolumeId={openVolumeId}
            buscando={buscando}
            gruposFechados={gruposFechados}
            grupoAbertoVolumes={grupoAbertoVolumes}
            alternarGrupoVolumes={alternarGrupoVolumes}
            alternarTodosVolumes={alternarTodosVolumes}
            volumesFiltrados={volumesFiltrados}
            podeReordenarVolumes={podeReordenarVolumes}
            dragVisual={dragVisual}
            editoraCorPorNome={editoraCorPorNome}
            registrarCardNode={registrarCardNode}
            volDragPointerDown={volDragPointerDown}
            volDragPointerMove={volDragPointerMove}
            volDragPointerEnd={volDragPointerEnd}
            abrirVolumeCard={abrirVolumeCard}
          />
          )} />
        )}

        {/* ===================== Coleções ===================== */}
        {!loading && abaMontada("colecoes") && (
          <Aba ativa={tab === "colecoes"} render={() => (
          <AbaColecoes
            lib={lib}
            setOpenVolumeId={setOpenVolumeId}
            buscando={buscando}
            setOpenColecaoId={setOpenColecaoId}
            colecoesFiltradas={colecoesFiltradas}
            colecoesFechadas={colecoesFechadas}
            colecaoAberta={colecaoAberta}
            alternarColecao={alternarColecao}
            alternarTodasColecoes={alternarTodasColecoes}
            switchTab={switchTab}
          />
          )} />
        )}

        {/* ===================== Séries ===================== */}
        {!loading && abaMontada("series") && (
          <Aba ativa={tab === "series"} render={() => (
          <AbaSeries
            lib={lib}
            setCorPersonagem={setCorPersonagem}
            edicoesPorSerie={edicoesPorSerie}
            ownedEdicaoIds={ownedEdicaoIds}
            buscando={buscando}
            openSerieId={openSerieId}
            gruposAbertos={gruposAbertos}
            grupoAberto={grupoAberto}
            alternarGrupo={alternarGrupo}
            alternarTodos={alternarTodos}
            seriesFiltradas={seriesFiltradas}
            abrirSerieNaFaixa={abrirSerieNaFaixa}
          />
          )} />
        )}

        {!loading && isHub && (
          <div className="footer-actions">
            <button className="btn btn-ghost" onClick={exportJson}>
              <Download size={14} /> Exportar backup
            </button>
            <button className="btn btn-ghost" onClick={() => fileInputRef.current && fileInputRef.current.click()}>
              <Upload size={14} /> Importar backup
            </button>
            {(lib.volumes.length > 0 || lib.series.length > 0) && (
              <button className="btn btn-ghost" style={{ color: "var(--danger-text)" }} onClick={() => setConfirmDelete({ type: "all" })}>
                <RotateCcw size={14} /> Zerar tudo
              </button>
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => { importBackup(e.target.files[0]); e.target.value = ""; }}
        />
      </main>

      <nav className="tabbar">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} data-active={tab === t.key ? "true" : "false"} onClick={() => switchTab(t.key)}>
              <Icon size={18} />
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* ===================== volume detail ===================== */}
      <VolumeSheet
        volume={openVolume}
        onClose={() => { setOpenVolumeId(null); setLinkSerieId(null); }}
        onEdit={() => openEditarVolume(openVolume)}
        onDuplicate={() => duplicarVolume(openVolume)}
        onDelete={() => remover({ type: "volume", id: openVolume.id })}
        onStatus={(s) => setStatusVolume(openVolume.id, s)}
        colecoes={openVolume ? colecoesDoVolume(openVolume.id) : []}
        grupos={openVolume ? edicoesDoVolumeAgrupadas(openVolume) : []}
        canUpload={canUpload}
        uploading={uploadingCover}
        onCoverPick={(f) => handleCoverPick(openVolume.id, f)}
        series={lib.series}
        edicoesPorSerie={edicoesPorSerie}
        linkSerieId={linkSerieId}
        setLinkSerieId={setLinkSerieId}
        linkPickSerie={linkPickSerie}
        setLinkPickSerie={setLinkPickSerie}
        rangeDe={rangeDe} setRangeDe={setRangeDe}
        rangeAte={rangeAte} setRangeAte={setRangeAte}
        avulsoNum={avulsoNum} setAvulsoNum={setAvulsoNum}
        onRange={() => vincularIntervalo(openVolume.id, linkSerieId)}
        onAvulsa={() => vincularAvulsa(openVolume.id, linkSerieId)}
        onToggle={(edId) => toggleLigacaoEdicao(openVolume.id, edId)}
        onOpenEdicaoNaSerie={abrirEdicaoNaSerie}
        recede={!!openSerieId}
      />

      {/* ===================== collection detail ===================== */}
      <ColecaoSheet
        lib={lib}
        onRemover={remover}
        setOpenColecaoId={setOpenColecaoId}
        addMemberSel={addMemberSel}
        openColecao={openColecao}
        colecaoRola={colecaoRola}
        ordemRecolhida={ordemRecolhida}
        alternarOrdem={alternarOrdem}
        definirCorBarra={definirCorBarra}
        openEditarColecao={openEditarColecao}
        adicionarMembro={adicionarMembro}
        removerMembro={removerMembro}
        moverMembro={moverMembro}
        personagensDaColecao={personagensDaColecao}
      />

      {/* ===================== series detail ===================== */}
      <SerieSheet
        serie={openSerie}
        contexto={openSerieContexto}
        verTudo={verTudoSerie}
        setVerTudo={setVerTudoSerie}
        edicoes={openSerie ? edicoesPorSerie[openSerie.id] || [] : []}
        ownedIds={ownedEdicaoIds}
        volumesQueColetam={volumesQueColetam}
        busca={serieBusca}
        setBusca={setSerieBusca}
        selectedId={selectedEdicaoId}
        setSelectedId={setSelectedEdicaoId}
        onClose={() => { setOpenSerieId(null); setOpenSerieContexto(null); setSelectedEdicaoId(null); setSerieBusca(""); }}
        onEdit={() => openEditarSerie(openSerie)}
        onDelete={() => remover({ type: "serie", id: openSerie.id })}
        onImport={() => { setImportSerieId(openSerie.id); setImportText(""); setShowImportModal(true); }}
        onNovaEdicao={() => { setEdicaoForm({ id: null, serieId: openSerie.id, numero: "", mes: "", ano: "", posicao: "" }); setShowEdicaoForm(true); }}
        onEditEdicao={(ed) => { setEdicaoForm({ ...ed, posicao: ed.posicao !== null && ed.posicao !== undefined ? String(ed.posicao) : "" }); setShowEdicaoForm(true); }}
        onDeleteEdicao={(ed) => remover({ type: "edicao", id: ed.id })}
        avisar={showToast}
      />

      {/* ===================== forms ===================== */}
      <FormVolume
        personagens={personagens}
        showVolumeForm={showVolumeForm}
        setShowVolumeForm={setShowVolumeForm}
        volumeForm={volumeForm}
        setVolumeForm={setVolumeForm}
        volumeErrors={volumeErrors}
        volumeDupWarning={volumeDupWarning}
        salvarVolume={salvarVolume}
        salvarVolumeEContinuar={salvarVolumeEContinuar}
      />

      <FormColecao
        showColecaoForm={showColecaoForm}
        setShowColecaoForm={setShowColecaoForm}
        colecaoForm={colecaoForm}
        setColecaoForm={setColecaoForm}
        colecaoErrors={colecaoErrors}
        salvarColecao={salvarColecao}
      />

      <FormSerie
        personagens={personagens}
        showSerieForm={showSerieForm}
        setShowSerieForm={setShowSerieForm}
        serieForm={serieForm}
        setSerieForm={setSerieForm}
        serieErrors={serieErrors}
        serieDupWarning={serieDupWarning}
        salvarSerie={salvarSerie}
      />

      <FormEdicao
        showEdicaoForm={showEdicaoForm}
        setShowEdicaoForm={setShowEdicaoForm}
        edicaoForm={edicaoForm}
        setEdicaoForm={setEdicaoForm}
        salvarEdicao={salvarEdicao}
      />

      <ImportarEdicoes
        showImportModal={showImportModal}
        setShowImportModal={setShowImportModal}
        importText={importText}
        setImportText={setImportText}
        importarEdicoes={importarEdicoes}
      />

      {/* ===================== confirm ===================== */}
      {/* Only "Zerar tudo" asks since v88; single items go at once and can be undone. */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Zerar a biblioteca?"
        footer={
          <div className="row">
            <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setConfirmDelete(null)}>Cancelar</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmarExclusao}>Confirmar</button>
          </div>
        }
      >
        <p className="t-body" style={{ margin: 0 }}>
          Apaga volumes, coleções, séries e edições. Dá para desfazer logo em seguida, mas
          exporte um backup antes se quiser uma cópia guardada.
        </p>
      </Modal>

      <Modal
        open={!!exportText}
        onClose={() => setExportText(null)}
        title="Backup da biblioteca"
        footer={
          <div className="row">
            <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setExportText(null)}>Fechar</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={copyExport}>
              <Copy size={14} /> Copiar
            </button>
          </div>
        }
      >
        <p className="t-small muted" style={{ margin: 0 }}>
          Esta visualização não consegue salvar arquivos, então copie o texto abaixo e cole
          num arquivo chamado <span className="num">longbox.json</span>. Ele serve para
          reimportar tudo depois.
        </p>
        <textarea
          className="textarea num"
          rows={10}
          readOnly
          value={exportText || ""}
          onFocus={(e) => e.target.select()}
        />
      </Modal>

      <EditorasSheet
        open={showEditoras}
        editoras={lib.editoras || []}
        onClose={() => setShowEditoras(false)}
        onChange={alterarEditora}
        onLogo={enviarLogo}
        canUpload={canUpload}
        enviando={enviandoLogo}
      />

      <CorSheet
        personagem={corPersonagem}
        cores={lib.cores || {}}
        onPick={escolherCor}
        onClose={() => setCorPersonagem(null)}
      />

      {toast && <Toast key={toast.id} message={toast.msg} acao={desfazerAtual ? { rotulo: "Desfazer", onClick: desfazer } : null} />}
    </div>
    </CoresContext.Provider>
  );
}
