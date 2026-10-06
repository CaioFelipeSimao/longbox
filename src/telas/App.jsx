import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import { Plus, X, Download, Upload, Library, AlertTriangle, RotateCcw, SlidersHorizontal, ChevronLeft, Copy, Keyboard, ShoppingCart } from "lucide-react";
import CursorGrid from "../components/CursorGrid/CursorGrid";

import {
  ACCENT_HEX, DOC_LIMIT, ED_SEM, ED_TODAS, EMPTY_LIB, QUASE_FECHANDO, SESSION_SEED, TABS,
  TIPOS, editorasDe, presencas, naFaixa, seededPick, slugify, tiposDaEditora, TIPOS_COMUNS, STATUS } from "../lib/constantes";
import { parseNum, porFixados, uid } from "../lib/util";
import { autoresDasSeries as contarAutoresDasSeries, autoresDe, parseAutores, textoAutores, autoresPossuidos, serieTemAutor, indiceEdicoes, coberturaDe, edicoesCobertas, aplicarFormEdicao } from "../lib/edicoes";
import { COR_LONGBOX, CoresContext, swatchColors, tintaSobre } from "../lib/cores";
import {
  anoRange, bytesOf, deleteColecao, deleteEdicao, deleteSerie, deleteVolume, deleteDesejo, ensureAvulsa,
  ensureRange, normalizeLib, parseImportText, personagensDaSerie, SEM_PERSONAGEM, serieDoGrupo, semearEditoras,
} from "../lib/biblioteca";
import {
  aplicarMescladas, gravarFixados, ouvirFixados, gravarUltimoBackup, lerFixados, lerUltimoBackup, loadLibrary, ouvirMudancas, scheduleSave, shardEdicoes, store,
} from "../lib/armazenamento";
import {
  assetErrorMessage, esperarMiniaturas, prepararMiniaturas, registrarMiniRemotas, uploadCover,
} from "../lib/capas";
import { useCelular, useHubUnlock, useLarguraDaBarra, usePonteiroFino } from "../lib/hooks";
import {
  FILTRO_COLECOES_KEY, lerAbaSalva, lerColecoesFechadas, lerFiltroSeries, lerFiltros, lerGruposAbertos, lerGruposFechados,
  lerOrdemRecolhida, lerCorRecolhida, lerAbaBase, salvarAba, salvarAbaBase,salvarColecoesFechadas, salvarFiltroSeries, salvarFiltros, salvarGruposAbertos,
  salvarGruposFechados, salvarOrdemRecolhida, salvarCorRecolhida, dobrar, lerFiltroAutor, salvarFiltroAutor,
} from "../lib/sessao";
import { Aba, Modal, Toast } from "../ui/base";
import { SUGESTOES_DA_ABA, SearchBox, ordenarPorNome, ordenarSugestoes } from "../ui/Busca";
import { CorSheet } from "../ui/CorPersonagem";
import { EditoraBar, EditorasSheet } from "../ui/Editoras";
import { ColecoesSkeleton, HubSkeleton, SeriesSkeleton, ShelfSkeleton } from "../ui/Esqueletos";
import { OPCOES_STATUS, OpcaoFiltro, PersonagemFiltro } from "../ui/Filtros";
import { ordenarGrupoVolumes } from "../ui/VolumeCard";
import { AbaColecoes } from "./AbaColecoes";
import { AbaHqs } from "./AbaHqs";
import { AbaSeries } from "./AbaSeries";
import { ColecaoSheet } from "./ColecaoSheet";
import { FormColecao, FormEdicao, FormSerie, FormVolume, ImportarEdicoes, salvarDesejoDoForm } from "./Formularios";
import { colecaoDoDesejo, comprarDesejo } from "../lib/desejos";
import { TelaDesejos } from "./TelaDesejos";
import { Hub } from "./Hub";
import { PainelAtalhos } from "./PainelAtalhos";
import { SerieSheet } from "./SerieSheet";
import { useArrastarVolumes } from "./useArrastarVolumes";
import { useAtalhos } from "./useAtalhos";
import { VolumeSheet } from "./VolumeSheet";

export function App() {
  const [lib, setLib] = useState(EMPTY_LIB);
  const [loading, setLoading] = useState(true);
  const [storageMode, setStorageMode] = useState("checking");
  const [canUpload, setCanUpload] = useState(false);
  // v126: the hub is a cover over the app, so `tab` is always a real tab (the one
  // under the cover) and hubAberto says whether the cover is down.
  const [hubAberto, setHubAberto] = useState(() => lerAbaSalva() === "hub");
  const [tab, setTab] = useState(() => { const s = lerAbaSalva(); return s === "hub" ? lerAbaBase() : s; });
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [exportText, setExportText] = useState(null);
  const [importPendente, setImportPendente] = useState(null);
  // v113: "salvando" while a write runs, "salvo" for 2s after, then null.
  const [salvamento, setSalvamento] = useState(null);
  useEffect(() => {
    if (salvamento !== "salvo") return undefined;
    const t = setTimeout(() => setSalvamento(null), 2000);
    return () => clearTimeout(t);
  }, [salvamento]);
  const [ultimoBackup, setUltimoBackup] = useState(null);
  const [fixados, setFixados] = useState([]);
  const [fixadosDesejos, setFixadosDesejos] = useState([]);
  const [desejosAberto, setDesejosAberto] = useState(false);
  const desejosTelaRef = useRef(null);
  const [corPersonagem, setCorPersonagem] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const sentinelRef = useRef(null);
  const hubElRef = useRef(null);
  const [hubReturning, setHubReturning] = useState(false);
  const [hubRolado, setHubRolado] = useState(false);

  const libRef = useRef(lib);
  libRef.current = lib;

  /* ---------- boot ---------- */
  useEffect(() => {
    let cancelled = false;
    let pararDeOuvir = null;
    (async () => {
      const claude = window.claude;
      const db = claude && claude.use ? await claude.use("db") : null;
      if (cancelled) return;
      store.db = db;
      store.onError = (msg) => showToast(msg);
      store.onEstado = (e) => setSalvamento(e);
      // v96: changes written elsewhere (another device, or Claude cataloguing
      // books) arrive merged with this tab's own; they go on screen here, with a
      // quiet toast at most every few seconds. Any undo on offer expires by
      // itself, since the library is no longer the one it would restore over.
      store.lerLib = () => libRef.current;
      let ultimoAviso = 0;
      store.aoMesclar = (mudancas) => {
        if (cancelled) return;
        const next = aplicarMescladas(libRef.current, mudancas);
        setLib(next);
        libRef.current = next;
        scheduleSave(next); // only writes if the merge left something unsaved
        const agora = Date.now();
        if (agora - ultimoAviso > 4000) { ultimoAviso = agora; showToast("Biblioteca atualizada em outro aparelho"); }
      };

      if (!db) {
        setStorageMode("memory");
        setLoading(false);
      } else {
        setStorageMode("db");
        // Read alongside the library, never before the page shows: the hub
        // footer can fill this in a moment later (v88).
        lerUltimoBackup(db).then((quando) => { if (!cancelled) setUltimoBackup(quando); });
        lerFixados(db).then((lista) => { if (!cancelled) setFixados(lista); });
        lerFixados(db, "library/fixadosDesejos").then((lista) => { if (!cancelled) setFixadosDesejos(lista); });
        try {
          const loaded = await loadLibrary(db);
          const semeado = semearEditoras(loaded);
          if (!cancelled) {
            setLib(semeado);
            libRef.current = semeado;
            if (semeado !== loaded) scheduleSave(semeado);
          }
          // v96: listen only after the library is on screen, so the first
          // snapshots compare against what was just loaded and cost nothing.
          if (!cancelled && typeof db.doc("library/volumes").onSnapshot === "function") {
            const pararLib = ouvirMudancas(db);
            const pararPins = ouvirFixados(db, (lista) => { if (!cancelled) setFixados(lista); });
            const pararPinsDesejos = ouvirFixados(db, (lista) => { if (!cancelled) setFixadosDesejos(lista); }, "library/fixadosDesejos");
            pararDeOuvir = () => { pararLib(); pararPins(); pararPinsDesejos(); };
          }
        } catch (e) {
          if (!cancelled) showToast("Não consegui carregar a biblioteca. Recarregue a página.");
        }
        // Usually long done by now; the cap keeps a slow disk from holding the app.
        await esperarMiniaturas(400);
        // v123: known before the first shelf renders, so no full cover starts
        // downloading for a volume that has a shared thumbnail.
        registrarMiniRemotas([...libRef.current.volumes, ...libRef.current.desejos]);
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
    return () => { cancelled = true; if (pararDeOuvir) pararDeOuvir(); };
  }, []);

  // desfazer, when given, is { antes, depois, reabrir } from a removal (v88): the
  // toast then offers "Desfazer" and stays up long enough to reach it.
  const showToast = useCallback((msg, desfazer) => {
    setToast({ msg, id: uid(), desfazer: desfazer || null });
  }, []);

  useEffect(() => {
    if (!toast) return;
    // v134: 15s when the removal took more than one thing with it (a série and its
    // edições, or everything); once this toast is gone only a backup brings it back.
    const t = setTimeout(() => setToast(null), toast.desfazer ? (toast.desfazer.longo ? 15000 : 8000) : 3000);
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

  // Owned on the shelf: in some volume's list.
  const possuidasFisicas = useMemo(() => {
    const s = new Set();
    lib.volumes.forEach((v) => v.edicoesColetadasIds.forEach((id) => s.add(id)));
    return s;
  }, [lib.volumes]);
  // v146: a reprint whose sources are all on the shelf counts as owned everywhere
  // (tiles, counts, faltantes), the user's rule. This is the one place "owned" is
  // computed, so every screen follows. Sources are checked against the shelf only.
  const indiceCatalogo = useMemo(() => indiceEdicoes(lib.series, lib.edicoes), [lib.series, lib.edicoes]);
  // v147: only these can be covered, so a shelf change walks a handful, not 12,800.
  const reimpressoesComFontes = useMemo(() => lib.edicoes.filter((e) => e.reimpressao === true && Array.isArray(e.fontes) && e.fontes.length), [lib.edicoes]);
  const ownedEdicaoIds = useMemo(() => {
    const cobertas = edicoesCobertas(indiceCatalogo, reimpressoesComFontes, possuidasFisicas);
    if (!cobertas.size) return possuidasFisicas;
    const s = new Set(possuidasFisicas);
    cobertas.forEach((id) => s.add(id));
    return s;
  }, [indiceCatalogo, reimpressoesComFontes, possuidasFisicas]);
  const coberturaDaEdicao = useCallback((e) => coberturaDe(e, indiceCatalogo, possuidasFisicas), [indiceCatalogo, possuidasFisicas]);

  const volumesQueColetam = useCallback((edId) => edicaoParaVolumes[edId] || [], [edicaoParaVolumes]);
  const colecoesDoVolume = useCallback((vid) => volumeParaColecoes[vid] || [], [volumeParaColecoes]);

  /* ---------- volumes ---------- */
  const [openVolumeId, setOpenVolumeId] = useState(null);
  // v88: where the open volume was opened from, which decides what ‹ › step
  // through (see sequenciaDoVolume), and which way the last step went.
  const [navVolume, setNavVolume] = useState({ tipo: "todas" });
  const [navDirecao, setNavDirecao] = useState(null);
  const [showVolumeForm, setShowVolumeForm] = useState(false);
  const [formDesejo, setFormDesejo] = useState(false);
  const [volumeForm, setVolumeForm] = useState(null);
  const [volumeErrors, setVolumeErrors] = useState({});
  const [volumeDupWarning, setVolumeDupWarning] = useState(null);
  // Read once, when the state is created; written back on every change below.
  const [filtrosSalvos] = useState(lerFiltros);
  const [filtroStatus, setFiltroStatus] = useState(filtrosSalvos.status);
  const [filtroTipo, setFiltroTipo] = useState(filtrosSalvos.tipo);
  const [filtroPersonagem, setFiltroPersonagem] = useState(filtrosSalvos.personagem);
  const [filtroSerie, setFiltroSerie] = useState(lerFiltroSeries);
  const [filtroColecao, setFiltroColecao] = useState(() => lerFiltroSeries(FILTRO_COLECOES_KEY));
  const [filtroAutor, setFiltroAutor] = useState(lerFiltroAutor);
  const [showFiltros, setShowFiltros] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  // v114: a cover picked in the "Novo volume" form, uploaded once the volume exists.
  const [capaNova, setCapaNova] = useState(null);
  useEffect(() => { if (!showVolumeForm) setCapaNova(null); }, [showVolumeForm]);

  useEffect(() => {
    salvarFiltros({ status: filtroStatus, tipo: filtroTipo, personagem: filtroPersonagem });
  }, [filtroStatus, filtroTipo, filtroPersonagem]);

  // With the panel closed a filter is still narrowing the shelf, so the button
  // carries the count; otherwise a reload or a trip to the hub could leave a
  // filtered shelf with nothing on screen saying so.
  const filtrosAtivos = [filtroStatus, filtroTipo, filtroPersonagem].filter(Boolean).length;
  useEffect(() => { salvarFiltroSeries(filtroSerie); }, [filtroSerie]);
  useEffect(() => { salvarFiltroSeries(filtroColecao, FILTRO_COLECOES_KEY); }, [filtroColecao]);
  useEffect(() => { salvarFiltroAutor(filtroAutor); }, [filtroAutor]);
  // What the filter button counts: each tab has its own filters.
  const filtrosAtivosAba = tab === "series" ? (filtroSerie ? 1 : 0) + (filtroAutor ? 1 : 0)
    : tab === "colecoes" ? (filtroColecao ? 1 : 0) : filtrosAtivos;

  const buscando = query.trim().length > 0;
  const editoraAtual = useMemo(
    () => (lib.editoras || []).find((e) => e.id === lib.editoraSel) || null,
    [lib.editoras, lib.editoraSel]
  );

  // v149: the search follows the publisher band too (the user's call, reversing the old
  // rule); when the band hides every match, foraDaEditora below says how many are
  // elsewhere and offers "Ver em todas as editoras".
  const casaEditora = useCallback((item) => {
    const sel = lib.editoraSel || ED_TODAS;
    if (sel === ED_TODAS) return true;
    const nomes = editorasDe(item);
    if (sel === ED_SEM) return !nomes.length;
    return editoraAtual ? nomes.some((nome) => nome.toLowerCase() === (editoraAtual.nome || "").trim().toLowerCase()) : true;
  }, [lib.editoraSel, editoraAtual]);

  // Display projections keep the real id; every write still uses lib.volumes.
  // Todas and Sem editora retain the primary pair and a single owned copy.
  const volumesDaFaixa = useMemo(() => {
    const volumes = lib.volumes.filter(casaEditora);
    const sel = lib.editoraSel || ED_TODAS;
    return sel !== ED_TODAS && sel !== ED_SEM && editoraAtual
      ? volumes.map((v) => naFaixa(v, editoraAtual.nome)).filter(Boolean)
      : volumes;
  }, [lib.volumes, lib.editoraSel, casaEditora, editoraAtual]);

  // Searching "Detective" should find the Omnibus that collects it, not just
  // volumes with the word in the title, so the series a volume draws from are
  // part of its searchable text.
  const textoBusca = useMemo(() => {
    const serieDaEdicao = {};
    const edicaoPorId = {};
    lib.edicoes.forEach((e) => { serieDaEdicao[e.id] = e.serieId; edicaoPorId[e.id] = e; });
    const mapa = {};
    lib.volumes.forEach((v) => {
      const series = new Set();
      v.edicoesColetadasIds.forEach((eid) => {
        const s = serieById[serieDaEdicao[eid]];
        if (s) series.add(s.nome);
      });
      const autores = v.edicoesColetadasIds.map((eid) => textoAutores(edicaoPorId[eid]));
      mapa[v.id] = dobrar([v.titulo, v.personagem, ...presencas(v).flatMap((p) => [p.editora, p.personagem]), v.notas, ...series, ...autores]
        .filter(Boolean).join(" "));
    });
    return mapa;
  }, [lib.volumes, lib.edicoes, serieById]);

  // v73: on HQs, the eight best volumes. On Coleções or Séries, the four best
  // of that tab first, then the four best volumes; when nothing in the tab
  // matches, just those four volumes. Like the volumes, the tab's results ignore
  // the publisher filter.
  const sugestoes = useMemo(() => {
    // v149: suggestions follow the publisher band, like the tabs.
    const hqs = ordenarSugestoes(volumesDaFaixa, textoBusca, query);
    const comoVolume = (v) => ({
      tipo: "volume", chave: "v-" + v.id, id: v.id, volume: v, titulo: v.titulo,
      meta: [{ editora: v.editora, personagem: v.personagem },
        ...presencas(lib.volumes.find((x) => x.id === v.id)).filter((p) => p.editora.toLowerCase() !== (v.editora || "").trim().toLowerCase())].map((p) =>
        [p.personagem, p.editora].filter(Boolean).join(" · ")).join(" · ") || v.personagem,
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
      // v93: with the character filter on, only that character's séries, matched
      // by name alone (the character is already fixed); the HQs below stay whole.
      const candidatas = lib.series.filter(casaEditora).filter((s) =>
        (!filtroSerie || serieDoGrupo(s, filtroSerie)) &&
        (!filtroAutor || serieTemAutor(edicoesPorSerie[s.id] || [], ownedEdicaoIds, filtroAutor)));
      const porPersonagem = (s) => [
        ...(!filtroSerie ? personagensDaSerie(s).map((p) => p.nome) : []),
        ...(edicoesPorSerie[s.id] || []).filter((e) => ownedEdicaoIds.has(e.id)).map(textoAutores),
      ].join(" ");
      daAba = ordenarPorNome(candidatas, query, porPersonagem)
        .slice(0, SUGESTOES_DA_ABA).map((s) => {
          const eds = edicoesPorSerie[s.id] || [];
          const tenho = eds.filter((e) => ownedEdicaoIds.has(e.id)).length;
          return {
            tipo: "serie", chave: "s-" + s.id, id: s.id, titulo: s.nome, secao: filtroSerie ? "Séries · " + filtroSerie : "Séries",
            meta: [personagensDaSerie(s).map((p) => p.nome).join(", "), anoRange(s),
              eds.length ? tenho + " de " + eds.length : ""].filter(Boolean).join(" · "),
          };
        });
    }
    return daAba.concat(hqs.slice(0, SUGESTOES_DA_ABA).map((v) => ({ ...comoVolume(v), secao: "HQs" })));
  }, [tab, volumesDaFaixa, lib.volumes, lib.colecoes, lib.series, textoBusca, query, edicoesPorSerie, ownedEdicaoIds, filtroSerie, filtroAutor, casaEditora]);

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
    volumesDaFaixa.forEach((v) => {
      if (v.personagem) n[v.personagem] = (n[v.personagem] || 0) + 1;
    });
    return Object.keys(n).sort((x, y) => x.localeCompare(y, "pt-BR")).map((nome) => ({ nome, n: n[nome] }));
  }, [volumesDaFaixa]);

  // Switching the band to a publisher this character has nothing under would
  // leave an empty shelf with no visible reason, so the filter lets go instead.
  // Not while loading: the library is empty then, and every saved choice would
  // look missing and be thrown away before the real list arrived.
  useEffect(() => {
    if (loading || !filtroPersonagem) return;
    if (!personagensDisponiveis.some((o) => o.nome === filtroPersonagem)) setFiltroPersonagem("");
  }, [loading, filtroPersonagem, personagensDisponiveis]);

  // v95: the format filter offers what the band's publisher has: its own list
  // under a publisher, the common four under "Sem editora", everything under
  // "Todas as editoras".
  const opcoesTipo = useMemo(() => {
    const sel = lib.editoraSel || ED_TODAS;
    const lista = sel === ED_TODAS ? TIPOS : sel === ED_SEM ? TIPOS_COMUNS : tiposDaEditora(editoraAtual ? editoraAtual.nome : "");
    return lista.map((t) => ({ valor: t, rotulo: t }));
  }, [lib.editoraSel, editoraAtual]);
  // Same release as the character filter when the band no longer has the format.
  useEffect(() => {
    if (loading || !filtroTipo) return;
    if (!opcoesTipo.some((o) => o.valor === filtroTipo)) setFiltroTipo("");
  }, [loading, filtroTipo, opcoesTipo]);

  const volumesFiltrados = useMemo(() => {
    let vs = volumesDaFaixa;
    if (query.trim()) {
      const q = dobrar(query.trim());
      vs = vs.filter((v) => (textoBusca[v.id] || "").includes(q));
    }
    if (filtroStatus) vs = vs.filter((v) => v.status === filtroStatus);
    if (filtroTipo) vs = vs.filter((v) => v.tipo === filtroTipo);
    if (filtroPersonagem) vs = vs.filter((v) => v.personagem === filtroPersonagem);
    const grupos = {};
    vs.forEach((v) => { (grupos[v.personagem] = grupos[v.personagem] || []).push(v); });
    return Object.keys(grupos).sort(porFixados(fixados)).map((p) => ({
      personagem: p,
      itens: ordenarGrupoVolumes(grupos[p]),
    }));
  }, [volumesDaFaixa, query, filtroStatus, filtroTipo, filtroPersonagem, textoBusca, fixados]);

  // Reordering is restricted to the plain, unfiltered view: a search or filter
  // shows a subset of the group, and reordering only what is visible would
  // silently scramble the order of whatever is hidden. The character filter is
  // the exception: it hides whole groups, never part of one, so the group being
  // dragged in is always complete.
  const podeReordenarVolumes = !query.trim() && !filtroStatus && !filtroTipo;

  /* ---------- drag to reorder HQs, held to one personagem group ---------- */
  const {
    suppressClickRef, dragVisual, editoraCorPorNome, registrarCardNode, volDragPointerDown,
    volDragPointerMove, volDragPointerEnd, gradeRef,
  } = useArrastarVolumes(lib, persist, volumesDaFaixa);

  function abrirVolumeCard(volumeId) {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    abrirVolume(volumeId, { tipo: "hqs" });
  }

  const volumeDesejo = navVolume.tipo === "desejo";
  const openVolume = (volumeDesejo ? lib.desejos : lib.volumes).find((v) => v.id === openVolumeId) || null;
  const chaveVolumeAberto = volumeDesejo ? "desejos" : "volumes";

  /* ---------- stepping between volumes in the open sheet (v88) ---------- */
  // contexto is { tipo: "hqs" } for the HQs tab, { tipo: "colecao", id } for a
  // collection, { tipo: "todas" } for the hub and the search box.
  function abrirVolume(id, contexto) {
    setNavVolume(contexto);
    setNavDirecao(null);
    setOpenVolumeId(id);
  }

  // Worked out when asked, not stored, so a filter, a fold or a removal since the
  // sheet opened is already reflected. The HQs tab is what is on screen: filtered
  // groups only, folded ones left out. A collection is its reading order. The full
  // order is the HQs tab with nothing applied, publisher band included, since the
  // hub and the search ignore it too. A volume missing from its own sequence (a
  // filter changed under it) falls back to the full order.
  function sequenciaDoVolume() {
    if (volumeDesejo) return lib.desejos.map((v) => v.id);
    let seq = null;
    if (navVolume.tipo === "hqs") {
      seq = volumesFiltrados.filter((g) => grupoAbertoVolumes(g.personagem)).flatMap((g) => g.itens.map((v) => v.id));
    } else if (navVolume.tipo === "colecao") {
      const c = lib.colecoes.find((x) => x.id === navVolume.id);
      if (c) seq = c.membros.filter((id) => lib.volumes.some((v) => v.id === id));
    }
    if (!seq || !seq.includes(openVolumeId)) {
      const grupos = {};
      lib.volumes.forEach((v) => { (grupos[v.personagem] = grupos[v.personagem] || []).push(v); });
      seq = Object.keys(grupos).sort(porFixados(fixados))
        .flatMap((p) => ordenarGrupoVolumes(grupos[p]).map((v) => v.id));
    }
    return seq;
  }
  const vizinhosDoVolume = (() => {
    if (!openVolume) return { anterior: null, proximo: null, posicao: 0, total: 0 };
    const seq = sequenciaDoVolume();
    const i = seq.indexOf(openVolumeId);
    return {
      anterior: i > 0 ? seq[i - 1] : null,
      proximo: i >= 0 && i < seq.length - 1 ? seq[i + 1] : null,
      posicao: i + 1,
      total: seq.length,
    };
  })();

  function navegarVolume(id, direcao) {
    if (!id) return;
    setNavDirecao(direcao);
    setOpenVolumeId(id);
    setLinkSerieId(null);
  }

  function openNovoVolume(desejo = false) {
    desejo = desejo === true;
    setFormDesejo(desejo);
    // Prefilled from whichever publisher is being browsed, so cataloguing inside
    // a publisher view does not leave the field blank and drop the volume into
    // the "Sem editora" bucket.
    const ed = !desejo && editoraAtual ? editoraAtual.nome : "";
    setVolumeForm({ id: null, titulo: "", personagem: "", tipo: TIPOS[0], editora: ed, editora2: "", personagem2: "", ano: "", status: "nao_lida", notas: "" });
    setVolumeErrors({}); setVolumeDupWarning(null); setShowVolumeForm(true);
  }

  function duplicarVolume(v, desejo = false) {
    setFormDesejo(desejo);
    setVolumeForm({
      id: null,
      titulo: v.titulo,
      personagem: v.personagem,
      tipo: v.tipo,
      editora: v.editora,
      editora2: Array.isArray(v.tambem) ? v.tambem[0]?.editora || "" : "",
      personagem2: Array.isArray(v.tambem) ? v.tambem[0]?.personagem || "" : "",
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
  function openEditarVolume(v, desejo = false) {
    setFormDesejo(desejo);
    const colecao = desejo ? colecaoDoDesejo(lib, v.id) : null;
    setVolumeForm({ ...v,
      ...(desejo ? { colecaoDesejoEscolhida: colecao ? "desejo:" + colecao.id : "" } : {}),
      editora2: Array.isArray(v.tambem) ? v.tambem[0]?.editora || "" : "",
      personagem2: Array.isArray(v.tambem) ? v.tambem[0]?.personagem || "" : "",
    }); setVolumeErrors({}); setVolumeDupWarning(null); setShowVolumeForm(true);
  }

  function validarVolume() {
    const errs = {};
    if (!volumeForm.titulo.trim()) errs.titulo = formDesejo ? "Informe o título do desejo" : "Informe o título do volume";
    if (!volumeForm.personagem.trim()) errs.personagem = "Informe o personagem principal";
    if (formDesejo && volumeForm.colecaoDesejoEscolhida === "nova" && !volumeForm.novaColecaoNome?.trim()) errs.novaColecaoNome = "Informe o nome da coleção";
    if (volumeForm.editora2?.trim() && volumeForm.editora2.trim().toLowerCase() === (volumeForm.editora || "").trim().toLowerCase()) {
      errs.editora2 = "Escolha uma editora diferente da editora principal";
    }
    setVolumeErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function tituloDuplicado(titulo) {
    return (formDesejo ? lib.desejos : lib.volumes).find((v) => v.titulo.trim().toLowerCase() === titulo.trim().toLowerCase());
  }

  function volumeDoForm(base = {}) {
    const { editora2, personagem2, tambem, colecaoDesejoEscolhida, novaColecaoNome, ...volume } = { ...base, ...volumeForm };
    const segunda = (editora2 || "").trim();
    return {
      ...volume,
      ...(segunda ? { tambem: [{ editora: segunda, personagem: (personagem2 || "").trim() || volume.personagem.trim() }] } : {}),
    };
  }

  function salvarVolume() {
    if (!validarVolume()) return;
    if (!volumeForm.id && !volumeDupWarning) {
      const dup = tituloDuplicado(volumeForm.titulo);
      if (dup) { setVolumeDupWarning('Já existe "' + dup.titulo + '" cadastrado. Toque em Salvar de novo pra criar mesmo assim.'); return; }
    }
    let next, novoId = volumeForm.id;
    if (formDesejo) {
      novoId = novoId || uid();
      const base = lib.desejos.find((d) => d.id === novoId) || { edicoesColetadasIds: [] };
      next = salvarDesejoDoForm(lib, { ...volumeDoForm(base), id: novoId }, volumeForm.colecaoDesejoEscolhida, volumeForm.novaColecaoNome);
    } else if (volumeForm.id) {
      next = { ...lib, volumes: lib.volumes.map((v) => (v.id === volumeForm.id ? volumeDoForm(v) : v)) };
    } else {
      novoId = uid();
      next = { ...lib, volumes: [...lib.volumes, { ...volumeDoForm(), id: novoId, edicoesColetadasIds: [] }] };
    }
    persist(next);
    if (!volumeForm.id && capaNova) handleCoverPick(novoId, capaNova, formDesejo ? "desejos" : "volumes");
    setShowVolumeForm(false);
    setVolumeDupWarning(null);
    if (formDesejo || volumeDesejo) abrirVolume(novoId, { tipo: formDesejo ? "desejo" : "todas" });
    else setOpenVolumeId(novoId);
    showToast(formDesejo ? (volumeForm.id ? "Desejo atualizado." : "Desejo adicionado.") : (volumeForm.id ? "Volume atualizado." : "Volume adicionado."));
  }

  function salvarVolumeEContinuar() {
    if (!validarVolume()) return;
    if (!volumeDupWarning) {
      const dup = tituloDuplicado(volumeForm.titulo);
      if (dup) { setVolumeDupWarning('Já existe "' + dup.titulo + '" cadastrado. Toque em "Salvar e cadastrar outro" de novo pra criar mesmo assim.'); return; }
    }
    const novo = { ...volumeDoForm(), id: uid(), edicoesColetadasIds: [] };
    persist(formDesejo ? salvarDesejoDoForm(lib, novo, volumeForm.colecaoDesejoEscolhida, volumeForm.novaColecaoNome) : { ...lib, volumes: [...lib.volumes, novo] });
    if (capaNova) handleCoverPick(novo.id, capaNova, formDesejo ? "desejos" : "volumes");
    setCapaNova(null);
    showToast('"' + novo.titulo + '" adicionado. Pronto pro próximo.');
    setVolumeForm((f) => ({
      id: null, titulo: "", personagem: f.personagem, tipo: f.tipo,
      editora: f.editora, editora2: f.editora2, personagem2: f.personagem2, ano: "", status: "nao_lida", notas: "",
      ...(formDesejo ? { colecaoDesejoEscolhida: colecaoDoDesejo(libRef.current, novo.id) ? "desejo:" + colecaoDoDesejo(libRef.current, novo.id).id : "" } : {}),
    }));
    setVolumeErrors({});
    setVolumeDupWarning(null);
  }

  // v119: J K L. In the volume sheet the segmented control shows the change, so no
  // toast; on a focused cover nothing else would, so the toast names the volume and
  // offers Desfazer (and Ctrl+Z), like a removal. Nothing under the série, colour or
  // publisher sheets, or a collection sheet alone (its rows are not covers).
  function marcarStatusTecla(status, alvo) {
    if (desejosAberto || (openVolume && volumeDesejo)) return false;
    if (openSerieId || corPersonagem || showEditoras) return false;
    if (openVolumeId) { setStatusVolume(openVolumeId, status); return true; }
    if (openColecaoId) return false;
    const card = alvo && alvo.closest ? alvo.closest(".vol[data-vid]") : null;
    const v = card && lib.volumes.find((x) => x.id === card.dataset.vid);
    if (!v) return false;
    const rotulo = v.titulo + " · " + STATUS[status].label.toLowerCase();
    if (v.status === status) { showToast(rotulo); return true; }
    const next = { ...lib, volumes: lib.volumes.map((x) => (x.id === v.id ? { ...x, status } : x)) };
    persist(next);
    showToast(rotulo, { antes: lib, depois: next, reabrir: null });
    return true;
  }

  function setStatusVolume(volumeId, status) {
    persist({ ...lib, volumes: lib.volumes.map((v) => (v.id === volumeId ? { ...v, status } : v)) });
  }

  async function handleCoverPick(volumeId, file, chave = "volumes") {
    if (!file) return;
    setUploadingCover(true);
    try {
      const res = await uploadCover(file);
      const current = libRef.current;
      persist({
        ...current,
        [chave]: current[chave].map((v) => (v.id === volumeId ? { ...v, capaAssetId: res.id } : v)),
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

  // v165: a collection belongs to every character any of its volumes has, within the
  // band's publisher (a crossover saga shows under each character in it; user's choice).
  const personagensNaFaixa = useCallback((c) => {
    const sel = lib.editoraSel || ED_TODAS;
    const nomeBanda = (editoraAtual?.nome || "").trim().toLowerCase();
    const nomes = new Set();
    c.membros.forEach((vid) => {
      const v = lib.volumes.find((x) => x.id === vid);
      if (!v) return;
      if (sel === ED_SEM) { if (!presencas(v).length && v.personagem) nomes.add(v.personagem); return; }
      presencas(v).forEach((p) => {
        if (p.personagem && (sel === ED_TODAS || p.editora.toLowerCase() === nomeBanda)) nomes.add(p.personagem);
      });
    });
    return nomes;
  }, [lib.volumes, lib.editoraSel, editoraAtual]);

  const colecoesDaFaixa = useMemo(() => lib.colecoes.filter((c) => {
    // A collection has no publisher of its own, so it inherits from its members:
    // it shows under any publisher it holds a volume from, which is what a
    // crossover saga should do.
    if ((lib.editoraSel || ED_TODAS) === ED_TODAS) return true;
    const membros = c.membros.map((vid) => lib.volumes.find((v) => v.id === vid)).filter(Boolean);
    if (!membros.length) return (lib.editoraSel || ED_TODAS) === ED_SEM;
    return membros.some(casaEditora);
  }), [lib.colecoes, lib.volumes, lib.editoraSel, casaEditora]);

  const personagensDasColecoes = useMemo(() => {
    const n = {};
    colecoesDaFaixa.forEach((c) => personagensNaFaixa(c).forEach((nome) => { n[nome] = (n[nome] || 0) + 1; }));
    return Object.keys(n).sort((x, y) => x.localeCompare(y, "pt-BR")).map((nome) => ({ nome, n: n[nome] }));
  }, [colecoesDaFaixa, personagensNaFaixa]);
  // Released when the band leaves the character with no collection, as on Séries.
  useEffect(() => {
    if (loading || !filtroColecao) return;
    if (!personagensDasColecoes.some((o) => o.nome === filtroColecao)) setFiltroColecao("");
  }, [loading, filtroColecao, personagensDasColecoes]);

  const colecoesFiltradas = useMemo(() => {
    let cs = colecoesDaFaixa;
    if (filtroColecao) cs = cs.filter((c) => personagensNaFaixa(c).has(filtroColecao));
    if (query.trim()) {
      const q = query.toLowerCase();
      cs = cs.filter((c) => c.nome.toLowerCase().includes(q));
    }
    return cs.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
  }, [colecoesDaFaixa, filtroColecao, personagensNaFaixa, query, buscando]);

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
  const [corRecolhida, setCorRecolhida] = useState(lerCorRecolhida);

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

  function alternarCor(id) {
    setCorRecolhida((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      salvarCorRecolhida(n);
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
  // v138: several at once, in the order they were tapped, one save and one undo.
  function adicionarMembros(colecaoId, ids) {
    const next = { ...lib, colecoes: lib.colecoes.map((c) => (c.id === colecaoId ? { ...c, membros: [...c.membros, ...ids.filter((id) => !c.membros.includes(id))] } : c)) };
    persist(next);
    const v = ids.length === 1 && lib.volumes.find((x) => x.id === ids[0]);
    showToast(v ? v.titulo + " entrou na coleção." : ids.length + " volumes entraram na coleção.", { antes: lib, depois: next, reabrir: null });
  }
  // v120: taking a volume out of a collection names it and can be undone (it used to
  // vanish at once, one tap beside the move buttons).
  function removerMembro(colecaoId, volumeId) {
    const next = { ...lib, colecoes: lib.colecoes.map((c) => (c.id === colecaoId ? { ...c, membros: c.membros.filter((v) => v !== volumeId) } : c)) };
    persist(next);
    const v = lib.volumes.find((x) => x.id === volumeId);
    showToast((v ? v.titulo : "Volume") + " saiu da coleção.", { antes: lib, depois: next, reabrir: null });
  }
  // v114: "Lidas até aqui" in a collection's reading order marks that volume and
  // every one before it as read, in one save, with the usual undo.
  function marcarLidasAte(colecaoId, index) {
    const c = lib.colecoes.find((x) => x.id === colecaoId);
    if (!c) return;
    const alvo = new Set(c.membros.slice(0, index + 1));
    let n = 0;
    const next = {
      ...lib,
      volumes: lib.volumes.map((v) => {
        if (!alvo.has(v.id) || v.status === "lida") return v;
        n++;
        return { ...v, status: "lida" };
      }),
    };
    if (!n) return;
    persist(next);
    showToast(n + (n === 1 ? " volume marcado como lido." : " volumes marcados como lidos."), { antes: lib, depois: next, reabrir: null });
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
  // Picking a character opens its group for the same reason as on HQs: the one
  // group left on screen, folded, would read as an empty result.
  const grupoAberto = (personagem) => buscando || personagem === filtroSerie || gruposAbertos.has(personagem);

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

  // v93: a search is matched per row (a série inside one character's group), not
  // per série. A row stays when the série's name matches or when its own group's
  // character does, so "batman" no longer drags in every other group a Batman
  // série also sits in. With the character filter on, only that group, and the
  // search looks at the série's name alone.
  // The characters the séries filter offers: every group the tab can show under
  // the publisher band, counted in séries, the way the HQs filter counts volumes.
  const personagensDasSeries = useMemo(() => {
    const n = {};
    lib.series.filter(casaEditora).forEach((s) => {
      const ps = personagensDaSerie(s);
      (ps.length ? ps.map((p) => p.nome) : [SEM_PERSONAGEM]).forEach((nome) => { n[nome] = (n[nome] || 0) + 1; });
    });
    return Object.keys(n).sort((x, y) => x.localeCompare(y, "pt-BR")).map((nome) => ({ nome, n: n[nome] }));
  }, [lib.series, casaEditora]);
  // Same release as the HQs filter when the band leaves the character with nothing.
  useEffect(() => {
    if (loading || !filtroSerie) return;
    if (!personagensDasSeries.some((o) => o.nome === filtroSerie)) setFiltroSerie("");
  }, [loading, filtroSerie, personagensDasSeries]);

  // v149: the band's séries only, counted by série, like the character filter.
  const autoresDasSeries = useMemo(() => contarAutoresDasSeries(lib.series.filter(casaEditora), edicoesPorSerie, ownedEdicaoIds), [lib.series, casaEditora, edicoesPorSerie, ownedEdicaoIds]);
  useEffect(() => {
    if (loading || !filtroAutor) return;
    // v149: folded, so a casing or accent variant of the saved name keeps the filter.
    if (!autoresDasSeries.some((o) => dobrar(o.nome) === dobrar(filtroAutor))) setFiltroAutor("");
  }, [loading, filtroAutor, autoresDasSeries]);

  const seriesFiltradas = useMemo(() => {
    const q = dobrar(query.trim());
    const grupos = {};
    lib.series.filter(casaEditora).forEach((s) => {
      if (filtroAutor && !serieTemAutor(edicoesPorSerie[s.id] || [], ownedEdicaoIds, filtroAutor)) return;
      const ps = personagensDaSerie(s);
      const nomeCasa = !q || dobrar(s.nome).includes(q) || serieTemAutor(edicoesPorSerie[s.id] || [], ownedEdicaoIds, q, true);
      (ps.length ? ps : [{ nome: SEM_PERSONAGEM, de: null, ate: null, vazio: true }]).forEach((p) => {
        if (filtroSerie && p.nome !== filtroSerie) return;
        if (!nomeCasa && (filtroSerie || p.vazio || !dobrar(p.nome).includes(q))) return;
        (grupos[p.nome] = grupos[p.nome] || []).push({ serie: s, faixa: p });
      });
    });
    return Object.keys(grupos).sort(porFixados(fixados)).map((p) => ({
      personagem: p,
      itens: grupos[p].sort((a, b) => {
        const oa = a.serie.ordem ?? null, ob = b.serie.ordem ?? null;
        if (oa !== null && ob !== null) return oa - ob;
        if (oa !== null) return -1;
        if (ob !== null) return 1;
        return (parseInt(a.serie.anoInicio, 10) || 9999) - (parseInt(b.serie.anoInicio, 10) || 9999);
      }),
    }));
  }, [lib.series, query, casaEditora, filtroSerie, filtroAutor, fixados, edicoesPorSerie, ownedEdicaoIds]);

  // v149: a search that the band empties says how many matches live elsewhere.
  const foraDaEditora = useMemo(() => {
    const sel = lib.editoraSel || ED_TODAS;
    const q = dobrar(query.trim());
    if (!q || sel === ED_TODAS || loading) return 0;
    if (tab === "volumes") {
      if (volumesFiltrados.length) return 0;
      const naFaixaIds = new Set(volumesDaFaixa.map((v) => v.id));
      return lib.volumes.filter((v) => !naFaixaIds.has(v.id) && (textoBusca[v.id] || "").includes(q)).length;
    }
    if (tab === "series") {
      if (seriesFiltradas.length) return 0;
      return lib.series.filter((s) => !casaEditora(s) && (dobrar(s.nome).includes(q)
        || personagensDaSerie(s).some((p) => dobrar(p.nome).includes(q))
        || serieTemAutor(edicoesPorSerie[s.id] || [], ownedEdicaoIds, q, true))).length;
    }
    if (tab === "colecoes") {
      if (colecoesFiltradas.length) return 0;
      return lib.colecoes.filter((c) => dobrar(c.nome).includes(q)).length;
    }
    return 0;
  }, [lib.editoraSel, query, loading, tab, volumesFiltrados, volumesDaFaixa, seriesFiltradas, colecoesFiltradas, lib.volumes, lib.series, lib.colecoes, casaEditora, textoBusca, edicoesPorSerie, ownedEdicaoIds]);

  // v141: pin a character to the top of the HQs and Séries tabs, three at most.
  function alternarFixado(personagem, desejo = false) {
    const lista = desejo ? fixadosDesejos : fixados;
    let proxima;
    if (lista.includes(personagem)) proxima = lista.filter((p) => p !== personagem);
    else if (lista.length >= 3) { showToast("Você já fixou 3. Desafixe um para fixar outro."); return; }
    else proxima = [...lista, personagem];
    (desejo ? setFixadosDesejos : setFixados)(proxima);
    gravarFixados(proxima, desejo ? "library/fixadosDesejos" : "library/fixados");
  }

  function comprarDesejoAberto() {
    if (!openVolume || !volumeDesejo) return;
    const antes = libRef.current;
    const depois = comprarDesejo(antes, openVolume.id);
    persist(depois);
    setOpenVolumeId(null); setLinkSerieId(null);
    showToast("Movido para o acervo", { antes, depois });
  }

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
    // v145: reimpressao/origem are written only while the box is ticked, so an
    // unticked edição goes back to having neither field.
    // v146: the three text fields become lists; "autores" is left out when all are empty.
    const { reimpressao, origem, autoresWriter, autoresPenciler, autoresInker, autores: _antes, ...resto } = edicaoForm;
    const autores = { writer: parseAutores(autoresWriter), penciler: parseAutores(autoresPenciler), inker: parseAutores(autoresInker) };
    const temAutor = autores.writer.length || autores.penciler.length || autores.inker.length;
    const payload = {
      ...resto,
      ...(temAutor ? { autores } : null),
      ...(reimpressao ? { reimpressao: true, origem: (origem || "").trim() } : null),
      posicao: edicaoForm.posicao.trim() !== "" && !isNaN(parseFloat(edicaoForm.posicao)) ? parseFloat(edicaoForm.posicao) : null,
    };
    const next = payload.id
      // v147: onto the edição as it is now, not the copy taken when the form opened.
      ? { ...lib, edicoes: lib.edicoes.map((e) => (e.id === payload.id ? aplicarFormEdicao(e, payload) : e)) }
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
  const [rangeDe, setRangeDe] = useState("");
  const [rangeAte, setRangeAte] = useState("");
  const [avulsoNum, setAvulsoNum] = useState("");

  function toggleLigacaoEdicao(volumeId, edicaoId, chave = "volumes") {
    persist({
      ...lib,
      [chave]: lib[chave].map((v) => {
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

  function vincularIntervalo(volumeId, serieId, chave = "volumes") {
    const de = parseInt(rangeDe, 10), ate = parseInt(rangeAte, 10);
    if (!de || !ate || ate < de) { showToast("Intervalo inválido."); return; }
    const { edicoes, ids } = ensureRange(lib, serieId, de, ate);
    persist({
      ...lib,
      edicoes,
      [chave]: lib[chave].map((v) => (v.id === volumeId
        ? { ...v, edicoesColetadasIds: Array.from(new Set([...v.edicoesColetadasIds, ...ids])) }
        : v)),
    });
    setRangeDe(""); setRangeAte("");
    showToast("Vinculado do " + de + " ao " + ate + ".");
  }

  function vincularAvulsa(volumeId, serieId, chave = "volumes") {
    if (!avulsoNum.trim()) return;
    const { edicoes, id } = ensureAvulsa(lib, serieId, avulsoNum);
    persist({
      ...lib,
      edicoes,
      [chave]: lib[chave].map((v) => (v.id === volumeId
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
      if (!grupos[key]) grupos[key] = { key, serie, edicoes: [] };
      grupos[key].edicoes.push(ed);
    });
    Object.values(grupos).forEach((g) =>
      g.edicoes.sort((a, b) => (parseNum(a.numero) ?? 1e9) - (parseNum(b.numero) ?? 1e9))
    );
    const ordem = new Map();
    (volume.ordemSeries || []).forEach((key, i) => { if (!ordem.has(key)) ordem.set(key, i); });
    // Stable sort leaves newly linked groups in their natural relative order.
    return Object.values(grupos).sort((a, b) =>
      (ordem.get(a.key) ?? Infinity) - (ordem.get(b.key) ?? Infinity));
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
    if (type === "desejo") {
      next = deleteDesejo(lib, id);
      if (openVolumeId === id) { setOpenVolumeId(null); setLinkSerieId(null); reabrir = () => { setDesejosAberto(true); abrirVolume(id, { tipo: "desejo" }); }; }
    }
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
    const longo = type === "all" || (type === "serie" && antes.edicoes.some((e) => e.serieId === id));
    showToast(avisoRemocao(type, id, antes), { antes, depois: next, reabrir, longo });
  }

  // v113: the toast says how much went, and what stayed, where it is more than one thing.
  // v121: and names it, so a slip on the tablet is recognisable. "saiu" for a volume,
  // since a title can be either gender; "Série X removida" agrees with "Série".
  function avisoRemocao(type, id, antes) {
    if (type === "desejo") {
      const d = antes.desejos.find((x) => x.id === id);
      return d ? d.titulo + " saiu da lista de desejos." : "Desejo removido.";
    }
    if (type === "volume") {
      const v = antes.volumes.find((x) => x.id === id);
      return v ? v.titulo + " saiu da biblioteca." : AVISO_REMOCAO.volume;
    }
    if (type === "serie") {
      const s = antes.series.find((x) => x.id === id);
      const nome = s ? "Série " + s.nome + " removida" : "Série removida";
      const n = antes.edicoes.filter((e) => e.serieId === id).length;
      return n ? nome + ", com " + n + (n === 1 ? " edição" : " edições") + ". Os volumes continuam na biblioteca." : nome + ".";
    }
    if (type === "colecao") {
      const col = antes.colecoes.find((c) => c.id === id);
      const nome = col ? "Coleção " + col.nome + " removida." : "Coleção removida.";
      const n = col ? col.membros.length : 0;
      return n ? nome + " " + (n === 1 ? "O volume continua" : "Os " + n + " volumes continuam") + " na biblioteca." : nome;
    }
    return AVISO_REMOCAO[type];
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
  // v88: only an export that actually landed counts (a saved file, or the JSON
  // copied), never one that was declined; the hub footer reads this date.
  function registrarBackup() {
    const agora = new Date().toISOString();
    setUltimoBackup(agora);
    gravarUltimoBackup(agora);
  }

  async function exportJson() {
    const data = JSON.stringify(libRef.current, null, 2);
    if (store.downloads) {
      try {
        await store.downloads.save({ filename: "longbox.json", data });
        registrarBackup();
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
      registrarBackup();
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
        // v99: the file only replaces the library after the person has seen both
        // counts side by side; a wrong or old backup used to wipe everything at once.
        setImportPendente(normalizeLib(raw));
      } catch (e) {
        showToast("Não consegui ler esse arquivo JSON.");
      }
    };
    reader.readAsText(file);
  }

  function confirmarImport() {
    const incoming = importPendente;
    if (!incoming) return;
    const antes = libRef.current;
    setImportPendente(null);
    persist(incoming);
    setOpenVolumeId(null); setOpenColecaoId(null); setOpenSerieId(null);
    // Same undo as a removal: the whole library as it was just before.
    showToast(
      incoming.volumes.length + " volumes, " + incoming.series.length +
      " séries e " + incoming.edicoes.length + " edições importadas.",
      { antes, depois: incoming, reabrir: null }
    );
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
        return a.serie.nome.localeCompare(b.serie.nome, "pt-BR", { numeric: true });
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

  const isHub = hubAberto;

  // v80: the three tabs stay mounted once built, hidden when not in use, so
  // coming back to one does not rebuild every card and cover from scratch. The
  // tab on screen is built at once; the others are built just after the
  // library loads, in a quiet moment, so they are ready before the first switch.
  // v85: shelf thumbnails for every cover in use, made once per device.
  // Only with a loaded, non-empty library: the same call forgets thumbnails no
  // volume uses, and an empty list after a failed load would forget them all.
  // v123: the key also moves when a shared thumbnail is recorded (here or on
  // another device), and the effect reruns once uploads become possible.
  const idsCapas = useMemo(
    () => [...new Set([...lib.volumes, ...lib.desejos].filter((v) => v.capaAssetId).map((v) => v.capaAssetId + ":" + (v.mini ? v.mini.capa + v.mini.id : "")))].join("|"),
    [lib.volumes, lib.desejos]
  );
  useEffect(() => {
    if (loading || !idsCapas) return;
    prepararMiniaturas([...libRef.current.volumes, ...libRef.current.desejos], (lote) => {
      const atual = libRef.current;
      persist({
        ...atual,
        volumes: atual.volumes.map((v) => (lote[v.capaAssetId] ? { ...v, mini: { capa: v.capaAssetId, id: lote[v.capaAssetId] } } : v)),
        desejos: atual.desejos.map((v) => (lote[v.capaAssetId] ? { ...v, mini: { capa: v.capaAssetId, id: lote[v.capaAssetId] } } : v)),
      });
    });
  }, [loading, idsCapas, canUpload]);

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
  // v126: the tab under the hub keeps its colours, since lifting the cover shows it.
  const edCroma = useMemo(() => {
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
  }, [lib.editoras, lib.editoraSel]);
  const edHue = edCroma ? edCroma.h : null;
  // v153: a white or very light grey publisher (Image Comics) has no hue to lend, so the
  // chrome used to fall back to the Longbox cyan. It takes a neutral accent instead:
  // light buttons with dark ink on the dark theme, graphite with white ink on the light one.
  const edNeutro = useMemo(() => {
    const atual = (lib.editoras || []).find((e) => e.id === (lib.editoraSel || ED_TODAS));
    const spec = atual && atual.cor;
    return !!spec && spec.s !== undefined && spec.s < 12 && (spec.l === undefined ? 56 : spec.l) >= 70;
  }, [lib.editoras, lib.editoraSel]);

  // The publisher's backdrop colour, for the gradient that now runs from the very
  // top of the page through the header into the band (v68). The hub is a layer of
  // its own (v126) and never takes it.
  const edFundo = useMemo(() => {
    const sel = lib.editoraSel || ED_TODAS;
    const atual = (lib.editoras || []).find((e) => e.id === sel);
    // Both ends of the colour: the deep cover shade tints the dark theme, the
    // vivid edge tints the light one (v79; the deep shade read as grey smoke
    // on a light page).
    const par = (c) => ({ fundo: c.b, vivo: c.edge });
    if (atual) return atual.cor ? par(swatchColors(atual.cor, 0)) : null;
    // Todas as editoras: the Longbox cyan, as in the band (v70).
    return sel === ED_SEM ? null : par(swatchColors(COR_LONGBOX, 0));
  }, [lib.editoras, lib.editoraSel]);

  const malhaCor = useMemo(() => {
    const sel = lib.editoraSel || ED_TODAS;
    const atual = (lib.editoras || []).find((e) => e.id === sel);
    return atual && atual.cor ? swatchColors(atual.cor, 0).edge : ACCENT_HEX;
  }, [lib.editoras, lib.editoraSel]);

  // "hub" lowers the cover over whatever tab is open, which stays where it was
  // scrolled; any other key lifts the cover onto that tab.
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const hubAbertoRef = useRef(hubAberto);
  hubAbertoRef.current = hubAberto;
  const celular = useCelular();
  const [buscaNaBarra, setBuscaNaBarra] = useState(false);
  const switchTab = useCallback((key) => {
    setQuery("");
    setBuscaNaBarra(false);
    if (key === "hub") {
      // Coming back to the hub reverses the unlock: it drops in from the top,
      // the same path it left by.
      if (!hubAbertoRef.current) { setHubReturning(true); setHubRolado(false); setHubAberto(true); }
      return;
    }
    setHubAberto(false);
    if (key !== tabRef.current) {
      setTab(key);
      if (typeof window !== "undefined" && window.scrollTo) window.scrollTo(0, 0);
    }
  }, []);

  // Written from the state rather than from switchTab, so every route into a tab
  // is covered, including the scroll gesture that unlocks the hub.
  useEffect(() => { salvarAba(hubAberto ? "hub" : tab); salvarAbaBase(tab); }, [tab, hubAberto]);

  const entrarNaColecao = useCallback(() => setHubAberto(false), []);

  // v131: in the Claude iOS app (not Safari) the tab bar's glass is drawn wrong,
  // in tiles showing stale backdrop, for about half a second whenever the images
  // behind it change, i.e. after every tab switch. A throwaway probe page settled it:
  // any backdrop filter over <img> content does it there, however the glass or the
  // tabs are built, and a bar that turns solid for 0.7s after a switch never shows
  // it. So the bar does that (data-trocando, styles.css) and fades back to glass.
  // (v128's one-frame transform nudge only shortened the glitch; this replaces it.)
  const tabbarRef = useRef(null);
  const [trocandoAba, setTrocandoAba] = useState(false);
  const primeiraTroca = useRef(true);
  useEffect(() => {
    if (primeiraTroca.current) { primeiraTroca.current = false; return undefined; }
    setTrocandoAba(true);
    const t = setTimeout(() => setTrocandoAba(false), 700);
    return () => clearTimeout(t);
  }, [tab, hubAberto]);

  // The page's own scrollbar is made transparent under the cover (styles.css).
  useEffect(() => {
    document.documentElement.dataset.capa = hubAberto ? "true" : "false";
  }, [hubAberto]);

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

  // D1 (v89): a bar in the hub's "Seu acervo" opens the HQs tab on exactly that
  // slice. Everything else is let go (search, the other filters, the publisher
  // band, unless the bar is a publisher), so the shelf shows the same count the
  // hub did; the panel opens so the filter doing it is in plain sight.
  function abrirRecorte({ status = "", tipo = "", personagem = "", editora = null }) {
    setQuery("");
    setFiltroStatus(status);
    setFiltroTipo(tipo);
    setFiltroPersonagem(personagem);
    const faixa = editora || ED_TODAS;
    if ((lib.editoraSel || ED_TODAS) !== faixa) selecionarEditora(faixa);
    setShowFiltros(!editora);
    switchTab("volumes");
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

  // v121: the button says what it makes; the hub's makes a volume (its own button, v126).
  const rotuloNovo = tab === "colecoes" ? "Nova coleção" : tab === "series" ? "Nova série" : "Novo volume";
  function novaEdicao(serie) {
    setEdicaoForm({ id: null, serieId: serie.id, numero: "", mes: "", ano: "", posicao: "", reimpressao: false, origem: "", autoresWriter: "", autoresPenciler: "", autoresInker: "" });
    setShowEdicaoForm(true);
  }
  // v132: N while the série card is in front makes an edição of it (the card's
  // "Nova edição"); with any other card open N still does nothing.
  function novaEdicaoNaFicha() {
    if (!openSerie || corPersonagem || showEditoras) return false;
    novaEdicao(openSerie);
    return true;
  }
  function novoNaAba() {
    if (desejosAberto) openNovoVolume(true);
    else if (isHub) openNovoVolume();
    else if (tab === "colecoes") openNovaColecao();
    else if (tab === "series") openNovaSerie();
    else openNovoVolume();
  }

  /* ---------- keyboard shortcuts (Q4, v91) ---------- */
  const [showAtalhos, setShowAtalhos] = useState(false);
  // The série sheet sits on top of the volume sheet when both are open, so E edits
  // the one in front.
  function editarAberto() {
    if (openSerie) { openEditarSerie(openSerie); return true; }
    if (openVolume) { openEditarVolume(openVolume, volumeDesejo); return true; }
    if (openColecao) { openEditarColecao(openColecao); return true; }
    return false;
  }
  // The search box lives under the hub, so from the hub "/" lifts the cover first
  // and focuses the box once it is no longer inert.
  function focarBusca() {
    if (desejosAberto) { desejosTelaRef.current?.focarBusca(); return; }
    if (isHub) entrarNaColecao();
    let tentativas = 0;
    const tentar = () => {
      const campo = document.querySelector(".search input");
      if (campo && !campo.closest("[inert]")) { campo.focus(); return; }
      if (++tentativas < 20) setTimeout(tentar, 30);
    };
    tentar();
  }
  // v94: Q does what the tab's "Esconder todas / Mostrar todas" does, and only
  // while that button is on screen (not during a search, not under the séries
  // character filter), so the key never acts on a state the user cannot see.
  function alternarDobra() {
    if (desejosAberto) return desejosTelaRef.current?.alternarTudo() || false;
    if (buscando) return false;
    if (tab === "volumes" && volumesFiltrados.length) {
      alternarTodosVolumes(volumesFiltrados, !volumesFiltrados.every((g) => !gruposFechados.has(g.personagem)));
      return true;
    }
    if (tab === "series" && !filtroSerie && seriesFiltradas.length) {
      alternarTodos(seriesFiltradas, !seriesFiltradas.every((g) => gruposAbertos.has(g.personagem)));
      return true;
    }
    return false;
  }
  // v115: sheets can open over the hub now, and scrolling inside one must not
  // count as scrolling past the hub's end into the collection.
  const folhaAberta = !!(openVolumeId || openSerieId || openColecaoId || corPersonagem || showEditoras);
  useHubUnlock(isHub && !desejosAberto && !loading && !folhaAberta, hubElRef, entrarNaColecao);
  useEffect(() => {
    if (!desejosAberto) return;
    const h = (e) => {
      if (e.key === "Escape" && !folhaAberta && !document.querySelector(".modal, .sheet")) setDesejosAberto(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [desejosAberto, folhaAberta]);
  useAtalhos({
    alternarDobra,
    podeDesfazer: !!desfazerAtual,
    desfazer,
    mostrarAtalhos: () => setShowAtalhos(true),
    fichaAberta: !!(openVolumeId || openSerieId || openColecaoId || corPersonagem || showEditoras),
    editarAberto,
    focarBusca,
    abrirAba: switchTab,
    alternarDesejos: () => setDesejosAberto((s) => !s),
    novo: novoNaAba,
    novaEdicaoNaFicha,
    marcarStatus: marcarStatusTecla,
  });

  /* ============================ render ============================ */
  const cartButton = <button className="btn-icon btn-desejos" onClick={() => setDesejosAberto((s) => !s)} aria-label={"Lista de desejos, " + lib.desejos.length + " itens"} aria-expanded={desejosAberto} data-dica="Lista de desejos · 4">
    <ShoppingCart size={18} />{lib.desejos.length > 0 && <span className="btn-badge" aria-hidden="true">{lib.desejos.length}</span>}
  </button>;

  function pularParaConteudo(e) {
    e.preventDefault();
    const aba = document.querySelector('.aba[data-ativa="true"]');
    const alvo = aba && (aba.querySelector('.vol[tabindex="0"]') || aba.querySelector("button, a[href]"));
    if (alvo) alvo.focus();
  }
  function escolherSugestao(s) {
    if (s.tipo === "colecao") { setOpenColecaoId(s.id); return; }
    if (s.tipo === "serie") {
      setOpenSerieId(s.id);
      setOpenSerieContexto(null);
      setVerTudoSerie(false);
      setSelectedEdicaoId(null);
      setSerieBusca("");
      return;
    }
    // v115: sheets open over the tab you are on; the tab no longer changes.
    abrirVolume(s.id, { tipo: "todas" });
  }
  const abaAtual = TABS.find((t) => t.key === tab) || TABS[0];
  // v133: the phone shows the tab's fold-all as an icon in the publisher band; the
  // same rules as the tabs' own button (hidden while searching, and on Séries
  // under the character filter).
  const dobraDaAba = (() => {
    if (!celular || loading || buscando) return null;
    if (tab === "volumes" && volumesFiltrados.length) {
      const aberto = volumesFiltrados.every((g) => !gruposFechados.has(g.personagem));
      return { aberto, alternar: () => alternarTodosVolumes(volumesFiltrados, !aberto) };
    }
    if (tab === "series" && !filtroSerie && seriesFiltradas.length) {
      const aberto = seriesFiltradas.every((g) => gruposAbertos.has(g.personagem));
      return { aberto, alternar: () => alternarTodos(seriesFiltradas, !aberto) };
    }
    if (tab === "colecoes" && colecoesFiltradas.length) {
      const aberto = colecoesFiltradas.every((c) => !colecoesFechadas.has(c.id));
      return { aberto, alternar: () => alternarTodasColecoes(colecoesFiltradas, !aberto) };
    }
    return null;
  })();
  const IconeAbaAtual = abaAtual.icon;

  // Both in the app's header and in the hub cover's (v126).
  const avisoSalvamento = (
    <span className="salvamento" aria-live="polite" data-estado={salvamento || "nada"}>
      {salvamento === "salvando" ? "Salvando…" : salvamento === "salvo" ? "Salvo" : ""}
    </span>
  );
  const avisoMemoria = storageMode === "memory" && (
    <div className="banner" data-tone="warn">
      <AlertTriangle size={16} />
      <div>
        <strong>Nada está sendo salvo nesta visualização.</strong> O armazenamento do
        artefato não está disponível aqui, então tudo que você cadastrar some ao
        recarregar. Abra o artefato publicado na sua conta para usar de verdade.
      </div>
    </div>
  );

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

      {/* v159: taken out of the flow. In the flow this 1px row pushed the sticky header 1px down while the
          page was at the top, leaving a hairline above it through which what lies behind showed (seen on
          the user's PC, measured with `.topbar top: 1.0`). The observer only needs it to exist. */}
      <div ref={sentinelRef} style={{ position: "absolute", top: 0, left: 0, width: 1, height: 1, pointerEvents: "none" }} aria-hidden="true" />

      {/* v126: everything under the hub cover. Inert while the cover is down, so
          Tab and screen readers stay on the hub; the sheets sit outside it because
          they open over the hub too. display: contents keeps the sticky header and
          band working as before. */}
      <div className="app-base" inert={isHub || desejosAberto ? "" : undefined}>
      {/* v132: the keyboard way past the header to the tab's first item. */}
      <a className="pular" href="#conteudo" onClick={pularParaConteudo}>
        {tab === "series" ? "Pular para as séries" : tab === "colecoes" ? "Pular para as coleções" : "Pular para as capas"}
      </a>
      <header
        className="topbar"
        data-scrolled={scrolled ? "true" : "false"}
        data-ed-hue={edHue == null ? undefined : "true"}
        data-ed-neutro={edNeutro ? "true" : undefined}
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
          <button className="brand" onClick={() => switchTab("hub")} aria-label="Voltar ao início" data-dica="Início · 0">
            <ChevronLeft size={18} className="brand-chev" />
            <span className="mark" aria-hidden="true"><i /><i /><i /><i /></span>
            <span className="wordmark">LONG<b>BOX</b></span>
          </button>
          {avisoSalvamento}

          {/* v129: on a phone the search sits in the floating tab bar; the spacer
              keeps the header's buttons on the right. */}
          {/* v165: on a phone the cart is a glass circle in the tab bar (no room up here). */}
          {!celular && cartButton}
          {celular ? <div style={{ flex: 1 }} /> : (
            <SearchBox query={query} setQuery={setQuery} sugestoes={sugestoes} onPick={escolherSugestao} />
          )}
          {/* v102: the way in to the shortcuts panel, which only "?" opened before.
              Hidden on touch, where there is no keyboard to use them with. */}
          <button className="btn-icon so-teclado" onClick={() => setShowAtalhos(true)} aria-label="Atalhos do teclado" data-dica="Atalhos · ?">
            <Keyboard size={16} />
          </button>
          {(tab === "volumes" || tab === "series" || tab === "colecoes") && (
            <button
              className="btn-icon btn-filtros"
              data-active={showFiltros ? "true" : "false"}
              data-filtrando={filtrosAtivosAba > 0 ? "true" : "false"}
              onClick={() => setShowFiltros((s) => !s)}
              aria-label={filtrosAtivosAba > 0 ? "Filtros, " + filtrosAtivosAba + (filtrosAtivosAba === 1 ? " ativo" : " ativos") : "Filtros"}
              aria-expanded={showFiltros ? "true" : "false"}
              data-dica={(showFiltros ? "Esconder filtros" : "Mostrar filtros") +
                (filtrosAtivosAba > 0 ? " (" + filtrosAtivosAba + (filtrosAtivosAba === 1 ? " ativo)" : " ativos)") : "")}
            >
              <SlidersHorizontal size={16} />
              {filtrosAtivosAba > 0 && <span className="btn-badge" aria-hidden="true">{filtrosAtivosAba}</span>}
            </button>
          )}
          <button className="btn btn-primary" onClick={novoNaAba} data-dica={rotuloNovo + " · N"} aria-label={rotuloNovo}>
            <Plus size={15} /> <span className="novo-rotulo">{rotuloNovo}</span>
          </button>
        </div>
      </header>

      {/* Drawn during the load too, so the content does not jump down the page the
          moment the library lands. The count is held blank until there is a real
          one: a "0 HQs" that turns into 47 reads as a wrong answer, not a wait. */}
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
          edNeutro={edNeutro}
          dobra={dobraDaAba}
          contagem={
            // v147: singular for one ("1 série", not "1 séries").
            loading ? ""
              : tab === "volumes" ? ((n) => n + (n === 1 ? " HQ" : " HQs"))(volumesFiltrados.reduce((s, g) => s + g.itens.length, 0))
              : tab === "colecoes" ? ((n) => n + (n === 1 ? " coleção" : " coleções"))(colecoesFiltradas.length)
              : ((n) => n + (n === 1 ? " série" : " séries"))(seriesFiltradas.reduce((s, g) => s + g.itens.length, 0))
          }
        />

      <main className="content" id="conteudo" ref={conteudoRef} data-lattice={comMalha ? "true" : "false"}>
        <h1 className="sr-only">{"Longbox, " + abaAtual.label}</h1>
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
        {avisoMemoria}

        {tab === "volumes" && showFiltros && (
          <div className="filtros-hqs" style={{ marginBottom: 20 }}>
          <div className="filtros-linha" data-campos="3">
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
              opcoes={opcoesTipo}
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

        {tab === "series" && showFiltros && (
          <div className="filtros-hqs" style={{ marginBottom: 20 }}>
          <div className="filtros-linha" data-campos="2">
            <PersonagemFiltro
              id="filtro-personagem-series"
              valor={filtroSerie}
              opcoes={personagensDasSeries}
              onChange={setFiltroSerie}
            />
            <PersonagemFiltro
              id="filtro-autor-series"
              rotulo="Filtrar por autor"
              todos="Todos os autores"
              lista="Autores"
              semCor
              vazio="Nenhum autor com"
              valor={filtroAutor}
              opcoes={autoresDasSeries}
              onChange={setFiltroAutor}
            />
            <button
              type="button"
              className="btn btn-quiet filtros-limpar"
              disabled={!filtroSerie && !filtroAutor}
              aria-label="Limpar filtros"
              onClick={() => { setFiltroSerie(""); setFiltroAutor(""); }}
            >
              <X size={14} /> <span className="label-wide">Limpar filtros</span>
            </button>
          </div>
          </div>
        )}

        {tab === "colecoes" && showFiltros && (
          <div className="filtros-hqs" style={{ marginBottom: 20 }}>
          <div className="filtros-linha" data-campos="1">
            <PersonagemFiltro
              id="filtro-personagem-colecoes"
              valor={filtroColecao}
              opcoes={personagensDasColecoes}
              onChange={setFiltroColecao}
            />
            <button
              type="button"
              className="btn btn-quiet filtros-limpar"
              disabled={!filtroColecao}
              aria-label="Limpar filtros"
              onClick={() => setFiltroColecao("")}
            >
              <X size={14} /> <span className="label-wide">Limpar filtros</span>
            </button>
          </div>
          </div>
        )}

        {/* Under the cover nothing is drawn while loading: the hub skeleton is
            what shows, and it carries the status line. */}
        {foraDaEditora > 0 && (
          <div className="banner busca-fora" role="status">
            <span>Nada em {editoraAtual ? editoraAtual.nome : "Sem editora"}. {foraDaEditora} {foraDaEditora === 1 ? "resultado" : "resultados"} em outras editoras.</span>
            <button type="button" className="btn btn-quiet" onClick={() => selecionarEditora(ED_TODAS)}>Ver em todas as editoras</button>
          </div>
        )}

        {loading && !isHub && (
          <>
            {/* The blocks themselves are hidden from a screen reader, since a
                grey rectangle has nothing to say. This line does the talking. */}
            <p className="sr-only" role="status">Carregando sua biblioteca</p>
            {tab === "volumes" ? <ShelfSkeleton />
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
            fixados={fixados}
            alternarFixado={alternarFixado}
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
            gradeRef={gradeRef}
            abrirVolumeCard={abrirVolumeCard}
          />
          )} />
        )}

        {/* ===================== Coleções ===================== */}
        {!loading && abaMontada("colecoes") && (
          <Aba ativa={tab === "colecoes"} render={() => (
          <AbaColecoes
            persist={persist}
            lib={lib}
            abrirVolume={abrirVolume}
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
            fixados={fixados}
            alternarFixado={alternarFixado}
            edicoesPorSerie={edicoesPorSerie}
            ownedEdicaoIds={ownedEdicaoIds}
            buscando={buscando}
            filtrando={!!filtroSerie}
            filtroAutor={filtroAutor}
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

      </main>

      {/* v129: a floating glass capsule (iOS tab bar) with the search circle beside
          it. The pill behind the active tab slides by transform; while searching,
          the capsule folds into a circle with the tab's icon, which closes the
          search. Phone only: from 768px the tabs are in the header. */}
      <nav
        className="tabbar"
        ref={tabbarRef}
        aria-label="Seções"
        data-buscando={buscaNaBarra ? "true" : "false"}
        data-trocando={trocandoAba ? "true" : undefined}
        style={{ "--aba-i": TABS.indexOf(abaAtual) }}
      >
        <div className="tabbar-capsula">
          <span className="tabbar-pill" aria-hidden="true" />
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.key} data-active={tab === t.key ? "true" : "false"} aria-current={tab === t.key ? "page" : undefined} onClick={() => switchTab(t.key)} tabIndex={buscaNaBarra ? -1 : undefined}>
                <Icon size={20} />
                {t.label}
              </button>
            );
          })}
          {buscaNaBarra && (
            <button className="tabbar-voltar" aria-label={"Fechar a busca e voltar para " + abaAtual.label} onClick={() => { setBuscaNaBarra(false); setQuery(""); }}>
              <IconeAbaAtual size={20} />
            </button>
          )}
        </div>
        {celular && (
          <SearchBox
            barra
            expandida={buscaNaBarra}
            setExpandida={setBuscaNaBarra}
            query={query}
            setQuery={setQuery}
            sugestoes={sugestoes}
            onPick={escolherSugestao}
          />
        )}
        {celular && !buscaNaBarra && (
          <button className="tabbar-carrinho" onClick={() => setDesejosAberto((s) => !s)} aria-label={"Lista de desejos, " + lib.desejos.length + " itens"} aria-expanded={desejosAberto}>
            <ShoppingCart size={20} />{lib.desejos.length > 0 && <span className="btn-badge" aria-hidden="true">{lib.desejos.length}</span>}
          </button>
        )}
      </nav>
      </div>

      {/* v126: the hub, a cover laid over the app with its own scroll. The unlock
          gesture lifts this whole layer and the tab under it is already there. */}
      {isHub && (
        <div
          className="hub-capa"
          inert={desejosAberto ? "" : undefined}
          ref={hubElRef}
          data-returning={hubReturning ? "true" : "false"}
          onScroll={(e) => setHubRolado(e.currentTarget.scrollTop > 0)}
        >
          <header className="topbar" data-scrolled={hubRolado ? "true" : "false"}>
            <div className="topbar-inner">
              <span className="brand">
                <span className="mark" aria-hidden="true"><i /><i /><i /><i /></span>
                <span className="wordmark">LONG<b>BOX</b></span>
              </span>
              {avisoSalvamento}
              <div style={{ flex: 1 }} />
              {cartButton}
              {/* v118: on a narrow hub "Novo" folds to its icon so the primary button keeps
                  its whole name; "Coleção" alone read as the Coleções tab below it. */}
              <button className="btn btn-quiet novo-hub" onClick={openNovoVolume} data-dica="Novo volume · N" aria-label="Novo volume">
                <Plus size={15} /> <span className="novo-rotulo">Novo volume</span>
              </button>
              <button className="btn btn-primary" onClick={entrarNaColecao}>
                <Library size={15} />
                <span>Minha coleção</span>
              </button>
            </div>
          </header>
          <main className="content hub-conteudo">
            <h1 className="sr-only">Longbox, início</h1>
            {avisoMemoria}
            {loading ? (
              <>
                <p className="sr-only" role="status">Carregando sua biblioteca</p>
                <HubSkeleton />
              </>
            ) : (
              <>
                <Hub
                  lib={lib}
                  stats={statsGerais}
                  docUsage={docUsage}
                  edicoesPorSerie={edicoesPorSerie}
                  ownedIds={ownedEdicaoIds}
                  onOpenVolume={(id) => abrirVolume(id, { tipo: "todas" })}
                  onOpenSerie={(id) => { setOpenSerieId(id); setOpenSerieContexto(null); }}
                  onNovo={openNovoVolume}
                  onEnter={entrarNaColecao}
                  backup={storageMode === "db" ? { ultimo: ultimoBackup } : null}
                  onBackup={exportJson}
                  onRecorte={abrirRecorte}
                />
                <div className="footer-actions">
                  <button className="btn btn-ghost" onClick={exportJson}>
                    <Download size={14} /> Exportar backup
                  </button>
                  {/* v99: the two actions that replace the library sit apart from the safe one. */}
                  <span className="footer-sep" aria-hidden="true" />
                  <button className="btn btn-ghost" onClick={() => fileInputRef.current && fileInputRef.current.click()}>
                    <Upload size={14} /> Importar backup
                  </button>
                  {(lib.volumes.length > 0 || lib.series.length > 0) && (
                    <button className="btn btn-ghost" style={{ color: "var(--danger-text)" }} onClick={() => setConfirmDelete({ type: "all" })}>
                      <RotateCcw size={14} /> Zerar tudo
                    </button>
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      )}
      {desejosAberto && <TelaDesejos
        ref={desejosTelaRef}
        lib={lib}
        persist={persist}
        fixados={fixadosDesejos}
        alternarFixado={(p) => alternarFixado(p, true)}
        setCorPersonagem={setCorPersonagem}
        abrirDesejo={(id) => abrirVolume(id, { tipo: "desejo" })}
        novoDesejo={() => openNovoVolume(true)}
        onClose={() => setDesejosAberto(false)}
        cartButton={celular ? null : cartButton}
      />}
      {/* Outside both layers: neither inert under the cover nor gone with it. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => { importBackup(e.target.files[0]); e.target.value = ""; }}
      />

      {/* ===================== volume detail ===================== */}
      <VolumeSheet
        volume={openVolume}
        desejo={volumeDesejo}
        onComprar={comprarDesejoAberto}
        onClose={() => { setOpenVolumeId(null); setLinkSerieId(null); }}
        onEdit={() => openEditarVolume(openVolume, volumeDesejo)}
        onDuplicate={() => duplicarVolume(openVolume, volumeDesejo)}
        onDelete={() => remover({ type: volumeDesejo ? "desejo" : "volume", id: openVolume.id })}
        onStatus={(s) => setStatusVolume(openVolume.id, s)}
        colecoes={openVolume ? (volumeDesejo ? lib.desejosColecoes.filter((c) => c.membros.includes(openVolume.id)) : colecoesDoVolume(openVolume.id)) : []}
        grupos={openVolume ? edicoesDoVolumeAgrupadas(openVolume) : []}
        onReordenarSeries={(volumeId, keys) => {
          const atual = libRef.current;
          persist({ ...atual, [chaveVolumeAberto]: atual[chaveVolumeAberto].map((v) =>
            v.id === volumeId ? { ...v, ordemSeries: keys.slice() } : v) });
        }}
        canUpload={canUpload}
        uploading={uploadingCover}
        onCoverPick={(f) => handleCoverPick(openVolume.id, f, chaveVolumeAberto)}
        series={lib.series}
        edicoesPorSerie={edicoesPorSerie}
        linkSerieId={linkSerieId}
        setLinkSerieId={setLinkSerieId}
        rangeDe={rangeDe} setRangeDe={setRangeDe}
        rangeAte={rangeAte} setRangeAte={setRangeAte}
        avulsoNum={avulsoNum} setAvulsoNum={setAvulsoNum}
        onRange={() => vincularIntervalo(openVolume.id, linkSerieId, chaveVolumeAberto)}
        onAvulsa={() => vincularAvulsa(openVolume.id, linkSerieId, chaveVolumeAberto)}
        onToggle={(edId) => toggleLigacaoEdicao(openVolume.id, edId, chaveVolumeAberto)}
        onOpenEdicaoNaSerie={abrirEdicaoNaSerie}
        recede={!!openSerieId}
        anterior={vizinhosDoVolume.anterior}
        proximo={vizinhosDoVolume.proximo}
        posicao={vizinhosDoVolume.posicao}
        total={vizinhosDoVolume.total}
        onNavegar={navegarVolume}
        direcao={navDirecao}
      />

      {/* ===================== collection detail ===================== */}
      <ColecaoSheet
        lib={lib}
        onRemover={remover}
        setOpenColecaoId={setOpenColecaoId}
        openColecao={openColecao}
        colecaoRola={colecaoRola}
        ordemRecolhida={ordemRecolhida}
        alternarOrdem={alternarOrdem}
        corRecolhida={corRecolhida}
        alternarCor={alternarCor}
        definirCorBarra={definirCorBarra}
        openEditarColecao={openEditarColecao}
        adicionarMembros={adicionarMembros}
        removerMembro={removerMembro}
        moverMembro={moverMembro}
        personagensDaColecao={personagensDaColecao}
        onLidasAte={marcarLidasAte}
        onStatus={setStatusVolume}
      />

      {/* ===================== series detail ===================== */}
      <SerieSheet
        serie={openSerie}
        filtroAutor={tab === "series" ? filtroAutor : ""}
        query={tab === "series" ? query : ""}
        contexto={openSerieContexto}
        verTudo={verTudoSerie}
        setVerTudo={setVerTudoSerie}
        edicoes={openSerie ? edicoesPorSerie[openSerie.id] || [] : []}
        ownedIds={ownedEdicaoIds}
        volumesQueColetam={volumesQueColetam}
        coberturaDaEdicao={coberturaDaEdicao}
        busca={serieBusca}
        setBusca={setSerieBusca}
        selectedId={selectedEdicaoId}
        setSelectedId={setSelectedEdicaoId}
        onClose={() => { setOpenSerieId(null); setOpenSerieContexto(null); setSelectedEdicaoId(null); setSerieBusca(""); }}
        onEdit={() => openEditarSerie(openSerie)}
        onDelete={() => remover({ type: "serie", id: openSerie.id })}
        onImport={() => { setImportSerieId(openSerie.id); setImportText(""); setShowImportModal(true); }}
        onNovaEdicao={() => novaEdicao(openSerie)}
        onEditEdicao={(ed) => { const a = autoresDe(ed); setEdicaoForm({ ...ed, posicao: ed.posicao !== null && ed.posicao !== undefined ? String(ed.posicao) : "", autoresWriter: a.writer.join(", "), autoresPenciler: a.penciler.join(", "), autoresInker: a.inker.join(", ") }); setShowEdicaoForm(true); }}
        onDeleteEdicao={(ed) => remover({ type: "edicao", id: ed.id })}
        avisar={showToast}
        volumes={lib.volumes}
        onVincular={(volumeId, edicaoId) => {
          toggleLigacaoEdicao(volumeId, edicaoId);
          const vol = lib.volumes.find((v) => v.id === volumeId);
          showToast("Vinculado a " + (vol ? vol.titulo : "o volume") + ".");
        }}
      />

      {/* ===================== forms ===================== */}
      <FormVolume
        desejo={formDesejo}
        desejosColecoes={lib.desejosColecoes}
        colecoes={lib.colecoes}
        personagens={personagens}
        editoras={lib.editoras}
        showVolumeForm={showVolumeForm}
        setShowVolumeForm={setShowVolumeForm}
        volumeForm={volumeForm}
        setVolumeForm={setVolumeForm}
        volumeErrors={volumeErrors}
        volumeDupWarning={volumeDupWarning}
        salvarVolume={salvarVolume}
        salvarVolumeEContinuar={salvarVolumeEContinuar}
        canUpload={canUpload}
        capaNova={capaNova}
        setCapaNova={setCapaNova}
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
        editoras={lib.editoras}
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
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmarExclusao}>Apagar tudo</button>
          </div>
        }
      >
        <p className="t-body" style={{ margin: 0 }}>
          Apaga {lib.volumes.length} {lib.volumes.length === 1 ? "volume" : "volumes"}, {lib.colecoes.length}{" "}
          {lib.colecoes.length === 1 ? "coleção" : "coleções"}, {lib.series.length} {lib.series.length === 1 ? "série" : "séries"} e{" "}
          {lib.edicoes.length} {lib.edicoes.length === 1 ? "edição" : "edições"}. Dá para desfazer logo em seguida, mas
          exporte um backup antes se quiser uma cópia guardada.
        </p>
      </Modal>

      <Modal
        open={!!importPendente}
        onClose={() => setImportPendente(null)}
        title="Substituir a biblioteca?"
        footer={
          <div className="row">
            <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setImportPendente(null)}>Cancelar</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmarImport}>Substituir</button>
          </div>
        }
      >
        {importPendente && (
          <>
            <table className="import-compara">
              <thead>
                <tr><th /><th>Agora</th><th>No arquivo</th></tr>
              </thead>
              <tbody>
                {[["Volumes", "volumes"], ["Coleções", "colecoes"], ["Séries", "series"], ["Edições", "edicoes"]].map(([rotulo, k]) => (
                  <tr key={k}>
                    <th scope="row">{rotulo}</th>
                    <td>{lib[k].length}</td>
                    <td data-menos={importPendente[k].length < lib[k].length ? "true" : "false"}>{importPendente[k].length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="t-body" style={{ margin: "12px 0 0" }}>
              Tudo o que está agora na biblioteca é trocado pelo conteúdo do arquivo. Dá para desfazer logo em seguida.
            </p>
          </>
        )}
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

      <PainelAtalhos open={showAtalhos} onClose={() => setShowAtalhos(false)} />

      <CorSheet
        personagem={corPersonagem}
        cores={lib.cores || {}}
        onPick={escolherCor}
        onClose={() => setCorPersonagem(null)}
      />

      {toast && <Toast key={toast.id} message={toast.msg} acao={desfazerAtual ? { rotulo: "Desfazer", onClick: desfazer, dica: "Desfazer · Ctrl+Z" } : null} />}
    </div>
    </CoresContext.Provider>
  );
}
