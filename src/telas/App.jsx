import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import { Plus, X, Pencil, Trash2, Download, Upload, BookOpen, Layers, Library, AlertTriangle, RotateCcw, ArrowUp, ArrowDown, SlidersHorizontal, ChevronLeft, ChevronDown, Copy } from "lucide-react";
import CursorGrid from "../components/CursorGrid/CursorGrid";

import {
  ACCENT_HEX, DOC_LIMIT, ED_SEM, ED_TODAS, EMPTY_LIB, QUASE_FECHANDO, SESSION_SEED, STATUS,
  STATUS_ORDER, TABS, TIPOS, editoraDe, seededPick, slugify,
} from "../lib/constantes";
import { parseNum, uid } from "../lib/util";
import {
  COR_LONGBOX, CoresContext, PALETA_CROMATICA, PALETA_NEUTRA, swatchColors, tintaSobre,
} from "../lib/cores";
import {
  anoRange, bytesOf, deleteColecao, deleteEdicao, deleteSerie, deleteVolume, ensureAvulsa,
  ensureRange, normalizeLib, parseImportText, personagensDaSerie, semearEditoras,
} from "../lib/biblioteca";
import { loadLibrary, scheduleSave, shardEdicoes, store } from "../lib/armazenamento";
import {
  assetErrorMessage, esperarMiniaturas, prepararMiniaturas, uploadCover,
} from "../lib/capas";
import {
  HOLD_EASE_LINEAR, HOLD_EASE_OUT, prefersReducedMotion, useHubUnlock, useLarguraDaBarra,
  usePonteiroFino,
} from "../lib/hooks";
import {
  lerAbaSalva, lerColecoesFechadas, lerFiltros, lerGruposAbertos, lerGruposFechados,
  lerOrdemRecolhida, salvarAba, salvarColecoesFechadas, salvarFiltros, salvarGruposAbertos,
  salvarGruposFechados, salvarOrdemRecolhida,
} from "../lib/sessao";
import { VolumeCard, ordenarGrupoVolumes } from "../ui/VolumeCard";
import { SUGESTOES_DA_ABA, SearchBox, ordenarPorNome, ordenarSugestoes } from "../ui/Busca";
import { Aba, EmptyState, Field, Modal, Sheet, Toast } from "../ui/base";
import { CorSheet, GroupHead, Swatch } from "../ui/CorPersonagem";
import { EditoraBar, EditorasSheet } from "../ui/Editoras";
import { ColecoesSkeleton, HubSkeleton, SeriesSkeleton, ShelfSkeleton } from "../ui/Esqueletos";
import { ShelfStrip } from "../ui/Prateleira";
import { SEM_EDICOES, SerieLinha } from "../ui/Series";
import { OPCOES_STATUS, OPCOES_TIPO, OpcaoFiltro, PersonagemFiltro } from "../ui/Filtros";
import { Hub } from "./Hub";
import { VolumeSheet } from "./VolumeSheet";
import { SerieSheet } from "./SerieSheet";

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

  const showToast = useCallback((msg) => {
    setToast({ msg, id: uid() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
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
  // A long press tells a hold apart from a tap or the start of a scroll. Pointer
  // events cover mouse and touch alike, which native HTML5 drag and drop does not
  // on a tablet. 450ms, raised from 350: the user found 350 too easy to trigger
  // by accident while just scrolling or tapping a cover.
  const HOLD_MS = 450;
  // How long the FLIP slide takes to settle, and therefore how long a new target
  // is locked out after one commits. The lockout is the whole fix for a drag that
  // felt unstable: without it, every pixel of pointer movement could re-target the
  // reflow mid-animation, and elementFromPoint would sometimes hit a card that was
  // still sliding rather than the one actually under the pointer. Holding the
  // target still for one settle window turns that into a deliberate, one-slot-at-
  // a-time snap instead of a flicker, which is the "aim assist" the user asked for.
  const FLIP_MS = 220;
  // How long the fill takes to let go once the pointer comes up. Matches the
  // old CSS transition's own release timing, kept here now that release is
  // driven the same way the rise is.
  const HOLD_RELEASE_MS = 150;
  // Speed of the wave's sideways drift, in crests per second. Expressed
  // against time rather than against HOLD_MS so the wave keeps the same
  // speed if the press duration is ever retuned again — only the number of
  // crests that fit in one press changes with it.
  const HOLD_WAVE_CRISTAS_POR_S = 5;
  const dragRef = useRef({ id: null, personagem: null, ids: null, startX: 0, startY: 0, active: false, timer: null });
  // Drives --hold-p on whichever card is filling, once per frame, the same
  // way the HoldButton reference this was adapted from drives --hb-p: a CSS
  // transition cannot give the wave crest both its scroll (tied to progress,
  // not to elapsed time) and its vanish-at-full behaviour, since both need the
  // exact same progress number the fill's own clip-path is using that frame.
  // el !== the last-driven element resets p to 0 instead of carrying over,
  // so a fresh press on a different card never inherits the tail of whatever
  // the previous card's release was mid-animating.
  const holdMotionRef = useRef({ raf: 0, p: 0, el: null });
  const suppressClickRef = useRef(false);
  const cardNodesRef = useRef(new Map()); // volume id -> its .vol DOM node, for FLIP
  const flipSnapshotRef = useRef(null); // rects captured just before a live reorder
  const flipCleanupRef = useRef(new Map()); // volume id -> fallback timer clearing its transform
  const flipBusyRef = useRef(false); // true while the last reflow is still settling
  const flipBusyTimerRef = useRef(null);
  const [dragVisual, setDragVisual] = useState(null); // { id, ids, personagem } while a drag is armed

  // The press-fill and the dragged card both take their tint from the volume's
  // own editora, the same "hue only" swatch every publisher-coloured element in
  // the app already uses. A volume whose editora has no colour, or isn't in the
  // list at all, falls back to the interface's own accent further down in CSS.
  const editoraCorPorNome = useMemo(() => {
    const mapa = {};
    (lib.editoras || []).forEach((ed) => {
      if (ed.cor) mapa[(ed.nome || "").trim().toLowerCase()] = swatchColors(ed.cor, 0).edge;
    });
    return mapa;
  }, [lib.editoras]);

  function registrarCardNode(id, el) {
    if (el) cardNodesRef.current.set(id, el); else cardNodesRef.current.delete(id);
  }

  // Two things have to both be true for a move to retarget something. First,
  // the pointer has to have actually left the dragged card's own current box:
  // comparing raw distance-to-centre alone (the first cut of this) retargeted
  // the instant a neighbour's centre was fractionally closer, which fired while
  // the pointer was still plainly sitting over the card being dragged — the
  // opposite of what holding a card should feel like. Second, once outside that
  // box, elementFromPoint has dead zones: the grid gap between cards belongs to
  // no card, and hovering it used to read as "no target" and drop the group back
  // to its unmoved order. Picking whichever OTHER card's centre is nearest
  // covers every point past the dragged card's own edge, gaps included, without
  // widening the hitbox any click uses the rest of the time.
  function alvoParaMover(personagem, draggedId, x, y) {
    const draggedEl = cardNodesRef.current.get(draggedId);
    if (draggedEl) {
      const r = draggedEl.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return null;
    }
    let melhorId = null;
    let melhorDist = Infinity;
    cardNodesRef.current.forEach((el, id) => {
      if (id === draggedId || el.dataset.personagem !== personagem) return;
      const r = el.getBoundingClientRect();
      const dx = x - (r.left + r.width / 2);
      const dy = y - (r.top + r.height / 2);
      const d = dx * dx + dy * dy;
      if (d < melhorDist) { melhorDist = d; melhorId = id; }
    });
    return melhorId;
  }

  function capturarRects(ids) {
    const rects = new Map();
    ids.forEach((id) => {
      const el = cardNodesRef.current.get(id);
      if (el) rects.set(id, el.getBoundingClientRect());
    });
    return rects;
  }

  // FLIP: the previous render's rects were captured synchronously before this
  // update: invert every card straight to where it used to be (no transition),
  // force layout, then release into a transition to its real spot. Only
  // transform animates, per the rule that padding/width/height touch layout.
  // The release is scheduled on rAF, which is the usual way to guarantee the
  // inverted state actually painted first — but a rAF callback that never gets
  // a turn (a backgrounded tab, a dropped frame) would leave the transform
  // stuck forever, and the next flip would then invert from that already-offset
  // position instead of a clean one. flipCleanupRef holds one fallback timer per
  // card, past FLIP_MS, that force-clears it regardless; a healthy rAF beats it
  // to the punch every time, so this only ever fires as real insurance.
  useLayoutEffect(() => {
    const before = flipSnapshotRef.current;
    if (!before) return;
    flipSnapshotRef.current = null;
    if (prefersReducedMotion()) return; // snap instead of sliding the group around
    before.forEach((prevRect, id) => {
      const el = cardNodesRef.current.get(id);
      if (!el) return;
      clearTimeout(flipCleanupRef.current.get(id));
      const now = el.getBoundingClientRect();
      const dx = prevRect.left - now.left;
      const dy = prevRect.top - now.top;
      if (!dx && !dy) { el.style.transition = ""; el.style.transform = ""; return; }
      el.style.transition = "none";
      el.style.transform = "translate(" + dx + "px," + dy + "px)";
      el.getBoundingClientRect(); // force reflow so the jump above isn't itself animated
      const liberar = () => { el.style.transition = "transform " + FLIP_MS + "ms var(--ease-in-out)"; el.style.transform = ""; };
      requestAnimationFrame(liberar);
      flipCleanupRef.current.set(id, setTimeout(liberar, FLIP_MS + 150));
    });
  }, [dragVisual]);

  // The committed order is exactly the live preview's own ids, not a fresh
  // single move computed against the persisted order: the preview is what the
  // user watched build up over the whole gesture, so it is what should land.
  function persistirOrdemGrupo(personagem, ids) {
    const grupo = lib.volumes.filter((v) => v.personagem === personagem);
    const outros = lib.volumes.filter((v) => v.personagem !== personagem);
    const porId = new Map(grupo.map((v) => [v.id, v]));
    const ordenado = ids.map((id, i) => porId.has(id) ? { ...porId.get(id), ordem: i } : null).filter(Boolean);
    persist({ ...lib, volumes: [...outros, ...ordenado] });
  }

  // Measured once per gesture, not tracked live: a card resizing mid-press
  // (only a window resize could do it) is rare enough that re-measuring on
  // every frame would be paying a layout read for a case that essentially
  // never happens. cover is the box the fill and crest actually paint over;
  // the button also has the title/meta text below it, which is not part of
  // that box.
  function comecarPreenchimento(cardEl) {
    const cover = cardEl.querySelector(".cover");
    if (!cover) return;
    const r = cover.getBoundingClientRect();
    cover.style.setProperty("--hold-w", r.width + "px");
    cover.style.setProperty("--hold-h", r.height + "px");
    // Crests that drift past any given point over the whole press. Counted
    // in crests, not in card widths: HoldButton's holdTime/1100 ratio came
    // out to about three quarters of ONE crest over these 450ms, and against
    // a fill that climbs the cover's full height in the same time, a wave
    // that never completes a single crest does not read as moving at all.
    cover.style.setProperty("--hold-cycles", (HOLD_MS / 1000) * HOLD_WAVE_CRISTAS_POR_S);
    driveHold(cover, 1, HOLD_MS, HOLD_EASE_LINEAR);
  }

  function soltarPreenchimento(cardEl) {
    const cover = cardEl && cardEl.querySelector(".cover");
    if (!cover) return;
    driveHold(cover, 0, HOLD_RELEASE_MS, HOLD_EASE_OUT);
  }

  function driveHold(el, to, duration, ease) {
    const m = holdMotionRef.current;
    cancelAnimationFrame(m.raf);
    if (m.el !== el) m.p = to === 1 ? 0 : m.p; // a different card never inherits a leftover value
    if (m.el !== el && to !== 1) return; // releasing a card that was never driven: nothing to unwind
    m.el = el;
    const from = m.p;
    const start = performance.now();
    const step = (now) => {
      if (m.el !== el) return; // superseded by a newer drive
      const t = duration > 0 ? Math.min(1, (now - start) / duration) : 1;
      m.p = from + (to - from) * ease(t);
      el.style.setProperty("--hold-p", m.p.toFixed(4));
      if (t < 1) { m.raf = requestAnimationFrame(step); return; }
      m.raf = 0;
    };
    m.raf = requestAnimationFrame(step);
  }

  function volDragPointerDown(e, volume, personagem) {
    const info = dragRef.current;
    clearTimeout(info.timer);
    info.id = volume.id;
    info.personagem = personagem;
    info.ids = null;
    info.startX = e.clientX;
    info.startY = e.clientY;
    info.active = false;
    const target = e.currentTarget;
    try { target.setPointerCapture(e.pointerId); } catch {}
    comecarPreenchimento(target);
    info.timer = setTimeout(() => {
      info.active = true;
      target.style.touchAction = "none";
      // The fill itself is not touched here on purpose: driveHold's own rAF
      // loop is already most of the way to --hold-p:1 by the time this fires,
      // and it keeps running past this point, through the whole drag, only
      // unwinding in finalizarDrag() when the pointer actually comes up.
      const grupo = lib.volumes.filter((v) => v.personagem === personagem);
      info.ids = ordenarGrupoVolumes(grupo).map((v) => v.id);
      setDragVisual({ id: volume.id, ids: info.ids, personagem });
    }, HOLD_MS);
  }

  function volDragPointerMove(e) {
    const info = dragRef.current;
    if (!info.id) return;
    if (!info.active) {
      const dist = Math.hypot(e.clientX - info.startX, e.clientY - info.startY);
      if (dist > 10) { clearTimeout(info.timer); info.id = null; soltarPreenchimento(e.currentTarget); }
      return;
    }
    e.preventDefault();
    if (flipBusyRef.current) return; // the last slot change hasn't settled yet
    const alvoId = alvoParaMover(info.personagem, info.id, e.clientX, e.clientY);
    if (!alvoId) return; // still over the dragged card's own box: nothing to do
    const fromIdx = info.ids.indexOf(info.id);
    const toIdx = info.ids.indexOf(alvoId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    flipSnapshotRef.current = capturarRects(info.ids);
    const next = info.ids.slice();
    const [item] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, item);
    info.ids = next;
    setDragVisual({ id: info.id, ids: next, personagem: info.personagem });
    flipBusyRef.current = true;
    clearTimeout(flipBusyTimerRef.current);
    flipBusyTimerRef.current = setTimeout(() => { flipBusyRef.current = false; }, FLIP_MS);
  }

  // Shared by the card's own onPointerUp/onPointerCancel and by the window-level
  // safety net below, so both paths end a drag the exact same way. Guarded by
  // info.id so a second call (both can legitimately fire for one release) is a
  // harmless no-op instead of double-committing.
  function finalizarDrag() {
    const info = dragRef.current;
    if (!info.id) return;
    clearTimeout(info.timer);
    clearTimeout(flipBusyTimerRef.current);
    flipBusyRef.current = false;
    const el = cardNodesRef.current.get(info.id);
    soltarPreenchimento(el);
    if (el && el.style) el.style.touchAction = "";
    if (info.active && info.ids) {
      persistirOrdemGrupo(info.personagem, info.ids);
      suppressClickRef.current = true;
    }
    info.id = null;
    info.active = false;
    info.ids = null;
    setDragVisual(null);
  }

  function volDragPointerEnd() {
    finalizarDrag();
  }

  // Safety net: setPointerCapture should keep pointerup routed to the dragged
  // card no matter where the button comes up, but releasing over a spot with no
  // card under it (or the window losing focus mid-drag) has been seen to leave
  // the gesture stuck armed forever, with no further pointer event ever reaching
  // a .vol handler to end it. A window-level listener, live only while a drag is
  // actually armed, guarantees the drag always ends when the button comes up
  // (or focus leaves), regardless of what capture did or didn't do.
  useEffect(() => {
    if (!dragVisual) return undefined;
    const finalizar = () => finalizarDrag();
    window.addEventListener("pointerup", finalizar, true);
    window.addEventListener("pointercancel", finalizar, true);
    window.addEventListener("blur", finalizar);
    return () => {
      window.removeEventListener("pointerup", finalizar, true);
      window.removeEventListener("pointercancel", finalizar, true);
      window.removeEventListener("blur", finalizar);
    };
  }, [dragVisual]);

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
  function confirmarExclusao() {
    if (!confirmDelete) return;
    const { type, id } = confirmDelete;
    let next = lib;
    if (type === "volume") { next = deleteVolume(lib, id); if (openVolumeId === id) setOpenVolumeId(null); }
    if (type === "colecao") { next = deleteColecao(lib, id); if (openColecaoId === id) setOpenColecaoId(null); }
    if (type === "serie") { next = deleteSerie(lib, id); if (openSerieId === id) setOpenSerieId(null); }
    if (type === "edicao") { next = deleteEdicao(lib, id); setSelectedEdicaoId(null); }
    if (type === "all") {
      next = EMPTY_LIB;
      setOpenVolumeId(null); setOpenColecaoId(null); setOpenSerieId(null);
    }
    persist(next);
    setConfirmDelete(null);
    showToast(type === "all" ? "Biblioteca zerada." : "Removido.");
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
          volumesFiltrados.length === 0 ? (
            <EmptyState icon={BookOpen} title={lib.volumes.length === 0 ? "Sua caixa está vazia" : "Nada encontrado"}>
              {lib.volumes.length === 0
                ? 'Toque em "Novo" para catalogar seu primeiro volume.'
                : "Tente outro termo de busca ou limpe os filtros."}
            </EmptyState>
          ) : (
            <>
              {/* Hidden while searching, same reason as the séries tab's own
                  toggle: a search already forces every matching group open. */}
              {!buscando && (
                <div className="fold-all">
                  <button
                    className="btn btn-quiet press"
                    onClick={() => alternarTodosVolumes(volumesFiltrados, !volumesFiltrados.every((g) => !gruposFechados.has(g.personagem)))}
                  >
                    <ChevronDown
                      size={14}
                      data-rot={volumesFiltrados.every((g) => !gruposFechados.has(g.personagem)) ? "false" : "true"}
                    />
                    {volumesFiltrados.every((g) => !gruposFechados.has(g.personagem)) ? "Esconder todas" : "Mostrar todas"}
                  </button>
                </div>
              )}
            {volumesFiltrados.map((grupo) => {
              const arrastandoNesteGrupo = dragVisual != null && dragVisual.personagem === grupo.personagem;
              const itensExibidos = arrastandoNesteGrupo
                ? dragVisual.ids.map((id) => grupo.itens.find((v) => v.id === id)).filter(Boolean)
                : grupo.itens;
              const aberto = grupoAbertoVolumes(grupo.personagem) || arrastandoNesteGrupo;
              return (
              <section className="group" key={grupo.personagem}>
                <GroupHead
                  personagem={grupo.personagem}
                  count={grupo.itens.length}
                  onPickColor={setCorPersonagem}
                  aberto={aberto}
                  onAlternar={alternarGrupoVolumes}
                  itemLabel="HQs"
                />
                {aberto && (
                <div className="shelf stagger">
                  {itensExibidos.map((v, i) => (
                    <VolumeCard
                      key={v.id}
                      volume={v}
                      index={i}
                      open={v.id === openVolumeId}
                      onClick={() => abrirVolumeCard(v.id)}
                      reordenavel={podeReordenarVolumes}
                      personagem={grupo.personagem}
                      dragging={dragVisual != null && dragVisual.id === v.id}
                      holdColor={editoraCorPorNome[(v.editora || "").trim().toLowerCase()]}
                      cardRef={(el) => registrarCardNode(v.id, el)}
                      onDragPointerDown={(e) => volDragPointerDown(e, v, grupo.personagem)}
                      onDragPointerMove={volDragPointerMove}
                      onDragPointerEnd={volDragPointerEnd}
                    />
                  ))}
                </div>
                )}
              </section>
              );
            })}
            </>
          )
          )} />
        )}

        {/* ===================== Coleções ===================== */}
        {!loading && abaMontada("colecoes") && (
          <Aba ativa={tab === "colecoes"} render={() => (
          colecoesFiltradas.length === 0 ? (
            <EmptyState icon={Layers} title={lib.colecoes.length === 0 ? "Nenhuma coleção ainda" : "Nada encontrado"}>
              Uma coleção agrupa volumes em ordem de leitura, como uma saga espalhada por vários encadernados.
            </EmptyState>
          ) : (
            <>
            {/* Same control and same wording as the HQs tab; hidden while
                searching, which forces every collection open anyway. */}
            {!buscando && (
              <div className="fold-all">
                <button
                  className="btn btn-quiet press"
                  onClick={() => alternarTodasColecoes(colecoesFiltradas, !colecoesFiltradas.every((col) => !colecoesFechadas.has(col.id)))}
                >
                  <ChevronDown
                    size={14}
                    data-rot={colecoesFiltradas.every((col) => !colecoesFechadas.has(col.id)) ? "false" : "true"}
                  />
                  {colecoesFiltradas.every((col) => !colecoesFechadas.has(col.id)) ? "Esconder todas" : "Mostrar todas"}
                </button>
              </div>
            )}
            {colecoesFiltradas.map((c) => {
              const membros = c.membros.map((vid) => lib.volumes.find((v) => v.id === vid)).filter(Boolean);
              const aberta = colecaoAberta(c.id);
              return (
                <section className="coll" key={c.id} data-aberta={aberta ? "true" : "false"}>
                  <div className="coll-head">
                    <div style={{ minWidth: 0 }}>
                      <h2 className="t-display" style={{ margin: 0 }}>{c.nome}</h2>
                      <p className="t-small muted truncate" style={{ margin: "3px 0 0" }}>
                        {membros.length === 0 ? "Sem volumes ainda" : membros.length + " volumes"}
                      </p>
                    </div>
                    <div className="coll-acoes">
                      <button className="btn btn-quiet" onClick={() => setOpenColecaoId(c.id)}>Gerenciar</button>
                      <button
                        className="btn-icon"
                        onClick={() => alternarColecao(c.id)}
                        aria-expanded={aberta ? "true" : "false"}
                        aria-label={(aberta ? "Esconder" : "Mostrar") + " os volumes de " + c.nome}
                        data-dica={aberta ? "Esconder volumes" : "Mostrar volumes"}
                      >
                        <ChevronDown size={16} data-rot={aberta ? "false" : "true"} />
                      </button>
                    </div>
                  </div>
                  {!aberta ? null : membros.length === 0 ? (
                    <p className="t-small muted">Abra em Gerenciar para adicionar volumes.</p>
                  ) : (
                    <ShelfStrip total={membros.length} cor={c.corBarra}>
                      {membros.map((v, i) => (
                        <div key={v.id + ":" + i}>
                          <div className="slot-order">{String(i + 1).padStart(2, "0")}</div>
                          <VolumeCard
                            volume={v}
                            index={0}
                            open={false}
                            onClick={() => { switchTab("volumes"); setOpenVolumeId(v.id); }}
                          />
                        </div>
                      ))}
                    </ShelfStrip>
                  )}
                </section>
              );
            })}
            </>
          )
          )} />
        )}

        {/* ===================== Séries ===================== */}
        {!loading && abaMontada("series") && (
          <Aba ativa={tab === "series"} render={() => (
          seriesFiltradas.length === 0 ? (
            <EmptyState icon={Library} title={lib.series.length === 0 ? "Nenhuma série ainda" : "Nada encontrado"}>
              Cadastre uma série para acompanhar quais edições você já tem e quais faltam.
            </EmptyState>
          ) : (
            <>
              {/* Hidden while searching on purpose: a search already forces every
                  matching group open, so this would either read as broken or
                  quietly rewrite a state the user cannot see the effect of. */}
              {!buscando && (
                <div className="fold-all">
                  <button
                    className="btn btn-quiet press"
                    onClick={() => alternarTodos(seriesFiltradas, !seriesFiltradas.every((g) => gruposAbertos.has(g.personagem)))}
                  >
                    <ChevronDown
                      size={14}
                      data-rot={seriesFiltradas.every((g) => gruposAbertos.has(g.personagem)) ? "false" : "true"}
                    />
                    {seriesFiltradas.every((g) => gruposAbertos.has(g.personagem)) ? "Esconder todas" : "Mostrar todas"}
                  </button>
                </div>
              )}
              {seriesFiltradas.map((grupo) => (
              <section className="group" key={grupo.personagem}>
                <GroupHead
                  personagem={grupo.personagem}
                  count={grupo.itens.length}
                  onPickColor={setCorPersonagem}
                  aberto={grupoAberto(grupo.personagem)}
                  onAlternar={alternarGrupo}
                />
                {grupoAberto(grupo.personagem) && grupo.itens.map((item) => (
                  <SerieLinha
                    key={item.serie.id + ":" + item.faixa.nome}
                    serie={item.serie}
                    faixa={item.faixa}
                    eds={edicoesPorSerie[item.serie.id] || SEM_EDICOES}
                    ownedIds={ownedEdicaoIds}
                    aberta={item.serie.id === openSerieId}
                    onAbrir={abrirSerieNaFaixa}
                  />
                ))}
              </section>
              ))}
            </>
          )
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
        onDelete={() => setConfirmDelete({ type: "volume", id: openVolume.id })}
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
      <Sheet
        open={!!openColecao}
        onClose={() => setOpenColecaoId(null)}
        title={openColecao ? openColecao.nome : ""}
        subtitle={openColecao && openColecao.descricao ? openColecao.descricao : null}
        actions={openColecao && (
          <>
            <button className="btn-icon" onClick={() => openEditarColecao(openColecao)} aria-label="Editar"><Pencil size={16} /></button>
            <button className="btn-icon" onClick={() => setConfirmDelete({ type: "colecao", id: openColecao.id })} aria-label="Remover">
              <Trash2 size={16} color="var(--danger-text)" />
            </button>
          </>
        )}
      >
        {openColecao && (
          <>
            {personagensDaColecao(openColecao).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {personagensDaColecao(openColecao).map((p) => <span className="chip" key={p}>{p}</span>)}
              </div>
            )}
            <div>
              <button
                type="button"
                className="ordem-head"
                onClick={() => alternarOrdem(openColecao.id)}
                aria-expanded={ordemRecolhida.has(openColecao.id) ? "false" : "true"}
              >
                <span className="t-micro">Ordem de leitura</span>
                <span className="t-small muted num">{openColecao.membros.length}</span>
                <ChevronDown size={16} data-rot={ordemRecolhida.has(openColecao.id) ? "true" : "false"} />
              </button>
              {!ordemRecolhida.has(openColecao.id) && (<>
              {openColecao.membros.length === 0 && (
                <p className="t-small muted" style={{ margin: 0 }}>Nenhum volume nesta coleção ainda.</p>
              )}
              {openColecao.membros.map((vid, idx) => {
                const v = lib.volumes.find((x) => x.id === vid);
                if (!v) return null;
                return (
                  <div key={vid + ":" + idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                    <span className="num t-small muted" style={{ width: 22, flexShrink: 0 }}>{idx + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="t-small truncate" style={{ margin: 0, fontWeight: 500 }}>{v.titulo}</p>
                      <p className="t-small muted truncate" style={{ margin: 0 }}>{v.personagem}</p>
                    </div>
                    <button className="btn-icon" onClick={() => moverMembro(openColecao.id, idx, -1)} aria-label="Mover para cima"><ArrowUp size={14} /></button>
                    <button className="btn-icon" onClick={() => moverMembro(openColecao.id, idx, 1)} aria-label="Mover para baixo"><ArrowDown size={14} /></button>
                    <button className="btn-icon" onClick={() => removerMembro(openColecao.id, vid)} aria-label="Remover da coleção">
                      <X size={14} color="var(--danger-text)" />
                    </button>
                  </div>
                );
              })}
              </>)}
            </div>
            {/* Only offered when this collection's strip is long enough to have
                a bar, folded or not: a colour for a bar that cannot exist would
                change nothing. */}
            {colecaoRola(openColecao) && (
              <div className="cor-barra">
                <p className="t-micro" style={{ margin: "0 0 8px" }}>Cor da barra</p>
                <div className="swatches">
                  {PALETA_CROMATICA.map((spec, i) => (
                    <Swatch key={"c" + i} spec={spec} atual={openColecao.corBarra}
                      onPick={(_, s) => definirCorBarra(openColecao.id, s)} />
                  ))}
                </div>
                <p className="t-micro" style={{ margin: "14px 0 8px" }}>Neutros</p>
                <div className="swatches">
                  {PALETA_NEUTRA.map((spec, i) => (
                    <Swatch key={"n" + i} spec={spec} atual={openColecao.corBarra}
                      onPick={(_, s) => definirCorBarra(openColecao.id, s)} />
                  ))}
                </div>
                <button
                  className="btn btn-quiet"
                  style={{ width: "100%", marginTop: 10 }}
                  data-on={!openColecao.corBarra ? "true" : "false"}
                  onClick={() => definirCorBarra(openColecao.id, null)}
                >
                  {!openColecao.corBarra ? "Usando a cor da editora" : "Voltar para a cor da editora"}
                </button>
              </div>
            )}
            <Field label="Adicionar volume">
              <select
                className="select"
                value={addMemberSel}
                onChange={(e) => { if (e.target.value) adicionarMembro(openColecao.id, e.target.value); }}
              >
                <option value="">Escolha um volume</option>
                {lib.volumes.filter((v) => !openColecao.membros.includes(v.id)).map((v) => (
                  <option key={v.id} value={v.id}>{v.titulo}</option>
                ))}
              </select>
            </Field>
          </>
        )}
      </Sheet>

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
        onDelete={() => setConfirmDelete({ type: "serie", id: openSerie.id })}
        onImport={() => { setImportSerieId(openSerie.id); setImportText(""); setShowImportModal(true); }}
        onNovaEdicao={() => { setEdicaoForm({ id: null, serieId: openSerie.id, numero: "", mes: "", ano: "", posicao: "" }); setShowEdicaoForm(true); }}
        onEditEdicao={(ed) => { setEdicaoForm({ ...ed, posicao: ed.posicao !== null && ed.posicao !== undefined ? String(ed.posicao) : "" }); setShowEdicaoForm(true); }}
        onDeleteEdicao={(ed) => setConfirmDelete({ type: "edicao", id: ed.id })}
      />

      {/* ===================== forms ===================== */}
      {volumeForm && (
        <Modal
          open={showVolumeForm}
          onClose={() => setShowVolumeForm(false)}
          title={volumeForm.id ? "Editar volume" : "Novo volume"}
          footer={
            volumeForm.id ? (
              <div className="row">
                <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setShowVolumeForm(false)}>Cancelar</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={salvarVolume}>Salvar</button>
              </div>
            ) : (
              <>
                <div className="row">
                  <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setShowVolumeForm(false)}>Cancelar</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={salvarVolume}>Salvar e fechar</button>
                </div>
                <div className="row row-center">
                  <button className="btn btn-ghost" onClick={salvarVolumeEContinuar}>Salvar e cadastrar outro</button>
                </div>
              </>
            )
          }
        >
          <Field label="Título" error={volumeErrors.titulo}>
            <input
              className="input"
              data-invalid={volumeErrors.titulo ? "true" : "false"}
              value={volumeForm.titulo}
              onChange={(e) => setVolumeForm((f) => ({ ...f, titulo: e.target.value }))}
            />
          </Field>
          <Field label="Personagem principal" error={volumeErrors.personagem}>
            <input
              className="input"
              list="personagens-list"
              data-invalid={volumeErrors.personagem ? "true" : "false"}
              value={volumeForm.personagem}
              onChange={(e) => setVolumeForm((f) => ({ ...f, personagem: e.target.value }))}
            />
          </Field>
          <div className="grid-2">
            <Field label="Tipo">
              <select className="select" value={volumeForm.tipo} onChange={(e) => setVolumeForm((f) => ({ ...f, tipo: e.target.value }))}>
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Ano">
              <input className="input" value={volumeForm.ano} onChange={(e) => setVolumeForm((f) => ({ ...f, ano: e.target.value }))} />
            </Field>
          </div>
          <Field label="Editora">
            <input className="input" value={volumeForm.editora} onChange={(e) => setVolumeForm((f) => ({ ...f, editora: e.target.value }))} />
          </Field>
          <Field label="Status de leitura">
            <div className="seg3">
              {STATUS_ORDER.map((k) => (
                <button
                  key={k}
                  data-kind={k}
                  data-on={volumeForm.status === k ? "true" : "false"}
                  onClick={() => setVolumeForm((f) => ({ ...f, status: k }))}
                >
                  {STATUS[k].label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Notas">
            <textarea className="textarea" value={volumeForm.notas} onChange={(e) => setVolumeForm((f) => ({ ...f, notas: e.target.value }))} />
          </Field>
          {volumeDupWarning && <p className="field-error">{volumeDupWarning}</p>}
        </Modal>
      )}

      {colecaoForm && (
        <Modal
          open={showColecaoForm}
          onClose={() => setShowColecaoForm(false)}
          title={colecaoForm.id ? "Editar coleção" : "Nova coleção"}
          footer={
            <div className="row">
              <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setShowColecaoForm(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={salvarColecao}>Salvar</button>
            </div>
          }
        >
          <Field label="Nome" error={colecaoErrors.nome}>
            <input
              className="input"
              data-invalid={colecaoErrors.nome ? "true" : "false"}
              value={colecaoForm.nome}
              onChange={(e) => setColecaoForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </Field>
          <Field label="Descrição">
            <textarea className="textarea" value={colecaoForm.descricao} onChange={(e) => setColecaoForm((f) => ({ ...f, descricao: e.target.value }))} />
          </Field>
        </Modal>
      )}

      {serieForm && (
        <Modal
          open={showSerieForm}
          onClose={() => setShowSerieForm(false)}
          title={serieForm.id ? "Editar série" : "Nova série"}
          footer={
            <div className="row">
              <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setShowSerieForm(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={salvarSerie}>Salvar</button>
            </div>
          }
        >
          <Field label="Nome" error={serieErrors.nome}>
            <input
              className="input"
              placeholder="Nightwing (Volume 2)"
              data-invalid={serieErrors.nome ? "true" : "false"}
              value={serieForm.nome}
              onChange={(e) => setSerieForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </Field>
          <Field
            label="Personagens"
            error={serieErrors.personagem}
            hint='Deixe "de" e "até" em branco para o personagem valer na série toda. Preencha só quando o protagonista muda no meio da numeração.'
          >
            {serieForm.personagensList.map((p, idx) => (
              <div className="row" key={idx} style={{ marginBottom: 6, alignItems: "center" }}>
                <input
                  className="input"
                  list="personagens-list"
                  placeholder="Personagem"
                  style={{ flex: 1 }}
                  value={p.nome}
                  onChange={(e) => setSerieForm((f) => ({ ...f, personagensList: f.personagensList.map((x, i) => (i === idx ? { ...x, nome: e.target.value } : x)) }))}
                />
                <input
                  className="input" type="number" placeholder="de" style={{ width: 68 }}
                  value={p.de}
                  onChange={(e) => setSerieForm((f) => ({ ...f, personagensList: f.personagensList.map((x, i) => (i === idx ? { ...x, de: e.target.value } : x)) }))}
                />
                <input
                  className="input" type="number" placeholder="até" style={{ width: 68 }}
                  value={p.ate}
                  onChange={(e) => setSerieForm((f) => ({ ...f, personagensList: f.personagensList.map((x, i) => (i === idx ? { ...x, ate: e.target.value } : x)) }))}
                />
                {serieForm.personagensList.length > 1 && (
                  <button
                    className="btn-icon"
                    onClick={() => setSerieForm((f) => ({ ...f, personagensList: f.personagensList.filter((_, i) => i !== idx) }))}
                    aria-label="Remover personagem"
                  >
                    <X size={15} color="var(--danger-text)" />
                  </button>
                )}
              </div>
            ))}
            <button
              className="btn btn-quiet"
              onClick={() => setSerieForm((f) => ({ ...f, personagensList: [...f.personagensList, { nome: "", de: "", ate: "" }] }))}
            >
              <Plus size={14} /> Adicionar personagem
            </button>
          </Field>
          <Field label="Editora">
            <input className="input" value={serieForm.editora} onChange={(e) => setSerieForm((f) => ({ ...f, editora: e.target.value }))} />
          </Field>
          <div className="grid-3">
            <Field label="Ano início">
              <input className="input" value={serieForm.anoInicio} onChange={(e) => setSerieForm((f) => ({ ...f, anoInicio: e.target.value }))} />
            </Field>
            <Field label="Ano fim">
              <input className="input" placeholder="presente" value={serieForm.anoFim} onChange={(e) => setSerieForm((f) => ({ ...f, anoFim: e.target.value }))} />
            </Field>
            <Field label="Total edições">
              <input className="input" type="number" min="0" value={serieForm.totalEdicoes} onChange={(e) => setSerieForm((f) => ({ ...f, totalEdicoes: e.target.value }))} />
            </Field>
          </div>
          <Field
            label="Ordem manual dentro do personagem"
            hint="Em branco ordena pelo ano de início. Preenchendo, número menor aparece primeiro."
          >
            <input className="input" type="number" step="0.1" value={serieForm.ordem} onChange={(e) => setSerieForm((f) => ({ ...f, ordem: e.target.value }))} />
          </Field>
          {serieDupWarning && <p className="field-error">{serieDupWarning}</p>}
        </Modal>
      )}

      {edicaoForm && (
        <Modal
          open={showEdicaoForm}
          onClose={() => setShowEdicaoForm(false)}
          title={edicaoForm.id ? "Editar edição" : "Catalogar edição"}
          footer={
            <div className="row">
              <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setShowEdicaoForm(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={salvarEdicao}>Salvar</button>
            </div>
          }
        >
          <Field label="Número">
            <input className="input" value={edicaoForm.numero} onChange={(e) => setEdicaoForm((f) => ({ ...f, numero: e.target.value }))} />
          </Field>
          <div className="grid-2">
            <Field label="Mês">
              <input className="input" placeholder="Outubro" value={edicaoForm.mes} onChange={(e) => setEdicaoForm((f) => ({ ...f, mes: e.target.value }))} />
            </Field>
            <Field label="Ano">
              <input className="input" value={edicaoForm.ano} onChange={(e) => setEdicaoForm((f) => ({ ...f, ano: e.target.value }))} />
            </Field>
          </div>
          <Field
            label="Posição no checklist"
            hint="Em branco ordena pelo número normal. Use 25.5 para ficar entre a 25 e a 26."
          >
            <input className="input" value={edicaoForm.posicao} onChange={(e) => setEdicaoForm((f) => ({ ...f, posicao: e.target.value }))} />
          </Field>
        </Modal>
      )}

      <Modal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Importar edições"
        footer={
          <div className="row">
            <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setShowImportModal(false)}>Cancelar</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={importarEdicoes}>Importar</button>
          </div>
        }
      >
        <p className="t-small muted" style={{ margin: 0 }}>
          Uma edição por linha, no formato <span className="num">número, mês, ano</span>. Só o número
          é obrigatório. Uma linha como <span className="num">21-30</span> cria o intervalo inteiro de
          uma vez. Número que já existe na série é atualizado, não duplicado. Colar de planilha funciona.
        </p>
        <textarea
          className="textarea num"
          rows={9}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder={"1, Outubro, 1996\n2, Novembro, 1996\n0\n12.1, Janeiro, 2012\n21-30"}
        />
      </Modal>

      {/* ===================== confirm ===================== */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={confirmDelete && confirmDelete.type === "all" ? "Zerar a biblioteca?" : "Remover este item?"}
        footer={
          <div className="row">
            <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setConfirmDelete(null)}>Cancelar</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmarExclusao}>Confirmar</button>
          </div>
        }
      >
        <p className="t-body" style={{ margin: 0 }}>
          {confirmDelete && confirmDelete.type === "volume" && "O volume sai das coleções em que estava. As edições da série continuam catalogadas."}
          {confirmDelete && confirmDelete.type === "colecao" && "Só o agrupamento é removido. Os volumes continuam na aba HQs."}
          {confirmDelete && confirmDelete.type === "serie" && "Remove a série, todas as suas edições, e desfaz o vínculo com qualquer volume."}
          {confirmDelete && confirmDelete.type === "edicao" && "Remove a edição e desfaz o vínculo com qualquer volume que a colete."}
          {confirmDelete && confirmDelete.type === "all" && "Apaga volumes, coleções, séries e edições. Exporte um backup antes se quiser poder voltar."}
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

      {toast && <Toast key={toast.id} message={toast.msg} />}
    </div>
    </CoresContext.Provider>
  );
}
