import { Library } from "lucide-react";

import { ED_TODAS } from "./constantes";
import { normalizeLib } from "./biblioteca";
import { mesclarEditoras, mesclarLista, mesclarMapa } from "./mesclar";

export const store = {
  db: null,
  assets: null,
  downloads: null,
  lastVolumes: "",
  lastColecoes: "",
  lastSeries: "",
  lastCores: "",
  lastEditoras: "",
  lastEdicoes: new Map(),
  timer: null,
  inFlight: 0,
  onError: null,
  onEstado: null,
  // v96: saves run one at a time, in order (a second flush used to be able to
  // overlap the first one).
  fila: Promise.resolve(),
  // v96: App hands these in. lerLib() is the library as the screen has it now;
  // aoMesclar(mudancas) takes documents that came back merged with changes made
  // elsewhere, either at save time or live, and puts them on screen.
  lerLib: null,
  aoMesclar: null,
};

// v96: the part of each document the app edits, how to read it out of the stored
// body, how to wrap it back, and how to merge three copies of it (see mesclar.js).
const DOCS = {
  volumes: { path: "library/volumes", parte: (d) => d?.items || [], corpo: (p) => ({ items: p }), mesclar: mesclarLista, last: "lastVolumes", daLib: (lib) => lib.volumes },
  colecoes: { path: "library/colecoes", parte: (d) => d?.items || [], corpo: (p) => ({ items: p }), mesclar: mesclarLista, last: "lastColecoes", daLib: (lib) => lib.colecoes },
  series: { path: "library/series", parte: (d) => d?.items || [], corpo: (p) => ({ items: p }), mesclar: mesclarLista, last: "lastSeries", daLib: (lib) => lib.series },
  cores: { path: "library/cores", parte: (d) => d?.mapa || {}, corpo: (p) => ({ mapa: p }), mesclar: mesclarMapa, last: "lastCores", daLib: (lib) => lib.cores || {} },
  editoras: {
    path: "library/editoras",
    parte: (d) => ({ itens: d?.itens || [], selecionada: d?.selecionada || ED_TODAS }),
    corpo: (p) => p, mesclar: mesclarEditoras, last: "lastEditoras",
    daLib: (lib) => ({ itens: lib.editoras || [], selecionada: lib.editoraSel || ED_TODAS }),
  },
};
const lerLast = (chave) => (chave.startsWith("ed:") ? store.lastEdicoes.get(chave.slice(3)) : store[DOCS[chave].last]);
function gravarLast(chave, json) {
  if (chave.startsWith("ed:")) {
    if (json === null) store.lastEdicoes.delete(chave.slice(3));
    else store.lastEdicoes.set(chave.slice(3), json);
  } else store[DOCS[chave].last] = json;
}
const parseOu = (json, vazio) => { try { return json ? JSON.parse(json) : vazio; } catch (e) { return vazio; } };

// v116: what this tab itself wrote lately, per document. The server echoes every
// write back to the tab's listener, and an echo can arrive after a later write: the
// echo of "edits 1-5" landing once "1-8" is saved looked like another device undoing
// 6-8, so the screen reverted 6-8, showed "atualizada em outro aparelho", and put
// them back when the next echo came. Comparing with the last write alone could not
// tell. Echoes equal to any recent own write are ignored.
// v117: entries expire after 20s (was 60s), long enough for a slow echo, short enough
// that a real change made elsewhere which happens to recreate one of this tab's recent
// states is rarely skipped (and a skipped one heals on the next save, which re-reads
// and merges). Kept as a fingerprint (length + FNV-1a hash), not the document text:
// the volumes document is ~116 KB and up to 12 were held per document.
const PROPRIAS_MS = 20000;
const proprias = new Map(); // chave -> [{ marca, quando }]
function marcaDe(json) {
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) { h ^= json.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return json.length + ":" + (h >>> 0).toString(36);
}
function registrarPropria(chave, json) {
  const agora = Date.now();
  const lista = (proprias.get(chave) || []).filter((p) => agora - p.quando < PROPRIAS_MS);
  lista.push({ marca: marcaDe(json), quando: agora });
  proprias.set(chave, lista.slice(-12));
}
function ehPropria(chave, json) {
  const agora = Date.now();
  const lista = proprias.get(chave);
  if (!lista || !lista.length) return false;
  const marca = marcaDe(json);
  return lista.some((p) => p.marca === marca && agora - p.quando < PROPRIAS_MS);
}

export function shardEdicoes(edicoes) {
  const m = new Map();
  edicoes.forEach((e) => {
    if (!m.has(e.serieId)) m.set(e.serieId, []);
    m.get(e.serieId).push(e);
  });
  return m;
}

export async function loadLibrary(db) {
  const [volSnap, colSnap, serSnap, corSnap, ediSnap, edSnap] = await Promise.all([
    db.doc("library/volumes").get(),
    db.doc("library/colecoes").get(),
    db.doc("library/series").get(),
    db.doc("library/cores").get(),
    db.doc("library/editoras").get(),
    db.collection("edicoes").get(),
  ]);
  const volumes = volSnap.exists ? volSnap.data().items || [] : [];
  const colecoes = colSnap.exists ? colSnap.data().items || [] : [];
  const series = serSnap.exists ? serSnap.data().items || [] : [];
  const cores = corSnap.exists ? corSnap.data().mapa || {} : {};
  const editoras = ediSnap.exists ? ediSnap.data().itens || [] : [];
  const editoraSel = ediSnap.exists ? ediSnap.data().selecionada || ED_TODAS : ED_TODAS;
  const edicoes = [];
  edSnap.docs.forEach((d) => {
    const items = d.data()?.items;
    if (Array.isArray(items)) edicoes.push(...items);
  });

  store.lastVolumes = JSON.stringify(volumes);
  store.lastColecoes = JSON.stringify(colecoes);
  store.lastSeries = JSON.stringify(series);
  store.lastCores = JSON.stringify(cores);
  store.lastEditoras = JSON.stringify({ itens: editoras, selecionada: editoraSel });
  store.lastEdicoes = new Map();
  shardEdicoes(edicoes).forEach((items, sid) => store.lastEdicoes.set(sid, JSON.stringify(items)));

  return normalizeLib({ volumes, colecoes, series, edicoes, cores, editoras, editoraSel });
}

export function dbErrorMessage(e) {
  const code = e && e.code;
  if (code === "invalid_argument") return "Esse item ficou grande demais pro limite de 256 KB por documento. Me avise pra reestruturarmos.";
  if (code === "quota_exceeded") return "O banco do artefato encheu. Apague algo antes de continuar.";
  if (code === "resource_exhausted") return "Muitas gravações seguidas. Espere um instante e tente de novo.";
  if (code === "revoked") return "O acesso ao armazenamento foi revogado nesta aba. Recarregue a página.";
  if (code === "unavailable") return "Armazenamento instável agora. Tente de novo em alguns segundos.";
  return "Não consegui salvar. Tente de novo.";
}

// Writes what changed on this tab. v96: each changed document is read again
// right before it is written; if the server copy is no longer the one this tab
// last saw (someone else wrote in the meantime), the tab's changes are merged on
// top of it instead of replacing it, and the merged result goes back to the
// screen through store.aoMesclar.
export function flushLibrary(lib) {
  const vez = store.fila.then(() => flushAgora(lib));
  store.fila = vez.catch(() => {});
  return vez;
}

function avisarEstado(e) {
  store.estado = e;
  if (store.onEstado) store.onEstado(e);
}

async function flushAgora(lib) {
  const db = store.db;
  if (!db) return;

  const writes = [];
  for (const chave of Object.keys(DOCS)) {
    const local = DOCS[chave].daLib(lib);
    const json = JSON.stringify(local);
    if (json !== lerLast(chave)) writes.push({ chave, ref: db.doc(DOCS[chave].path), local, json });
  }
  const shards = shardEdicoes(lib.edicoes);
  shards.forEach((items, sid) => {
    const json = JSON.stringify(items);
    if (json !== store.lastEdicoes.get(sid)) writes.push({ chave: "ed:" + sid, ref: db.collection("edicoes").doc(sid), local: items, json });
  });
  store.lastEdicoes.forEach((_, sid) => {
    if (!shards.has(sid)) writes.push({ chave: "ed:" + sid, ref: db.collection("edicoes").doc(sid), local: [], json: "[]", remover: true });
  });

  // v125: a save that merged schedules this follow-up, which usually finds nothing
  // left to write; it closes the "Salvando…" the merging save left open.
  if (!writes.length) {
    if (store.estado === "salvando" && store.inFlight === 0 && store.timer === null) avisarEstado("salvo");
    return;
  }
  const mescladas = [];
  store.inFlight++;
  // v113: "Salvando…" / "Salvo" beside the wordmark. Only real writes report; a
  // save with nothing changed stays silent, and a failure leaves it to the toast.
  let ok = true;
  avisarEstado("salvando");
  try {
    for (const w of writes) {
      try {
        const ed = w.chave.startsWith("ed:");
        const cfg = ed ? null : DOCS[w.chave];
        const snap = await w.ref.get();
        const remoto = ed ? (snap.exists ? snap.data()?.items || [] : []) : cfg.parte(snap.exists ? snap.data() : null);
        const baseJson = lerLast(w.chave);
        let final = w.local, finalJson = w.json;
        // The server copy moved since this tab last saw it: merge, don't overwrite.
        if (JSON.stringify(remoto) !== (baseJson ?? (ed ? "[]" : JSON.stringify(cfg.parte(null))))) {
          const base = parseOu(baseJson, ed ? [] : cfg.parte(null));
          final = (ed ? mesclarLista : cfg.mesclar)(base, w.local, remoto);
          finalJson = JSON.stringify(final);
          mescladas.push({ chave: w.chave, parte: final, local: w.local });
        }
        if (ed && Array.isArray(final) && !final.length) {
          registrarPropria(w.chave, "[]");
          await w.ref.delete();
          gravarLast(w.chave, null);
        } else {
          // Recorded before the write goes out: its echo can come back before set() resolves.
          registrarPropria(w.chave, finalJson);
          await w.ref.set(ed ? { items: final } : cfg.corpo(final));
          gravarLast(w.chave, finalJson);
        }
      } catch (e) {
        ok = false;
        if (store.onError) store.onError(dbErrorMessage(e));
        return;
      }
    }
  } finally {
    store.inFlight--;
    if (mescladas.length && store.aoMesclar) store.aoMesclar(mescladas, "ao-salvar");
    if (store.inFlight === 0 && store.timer === null) avisarEstado(ok ? "salvo" : null);
  }
}

// v96: live updates. Listens to the library documents and the edições
// collection; when something changes on the server that this tab did not write,
// it is merged into the screen (nothing to merge against while the tab has no
// unsaved change, so the server copy simply replaces the tab's). While a save is
// pending or running the change waits: the save reads the server first and merges
// it anyway, and applying it underneath a pending save would lose the tab's edit.
// Snapshots of an unchanged document are the same object, and ones equal to what
// this tab last wrote are ignored, so a quiet library costs nothing.
export function ouvirMudancas(db) {
  const pendentes = new Map(); // chave -> última parte remota ainda não aplicada
  let agendado = null;

  function aplicar() {
    agendado = null;
    if (storeIsBusy()) { agendado = setTimeout(aplicar, 600); return; }
    const lib = store.lerLib ? store.lerLib() : null;
    if (!lib || !pendentes.size) return;
    const mudancas = [];
    pendentes.forEach((remoto, chave) => {
      const json = JSON.stringify(remoto);
      if (json === lerLast(chave) || ehPropria(chave, json)) return;
      const ed = chave.startsWith("ed:");
      const local = ed ? lib.edicoes.filter((e) => e.serieId === chave.slice(3)) : DOCS[chave].daLib(lib);
      const vazio = ed ? [] : DOCS[chave].parte(null);
      const final = (ed ? mesclarLista : DOCS[chave].mesclar)(parseOu(lerLast(chave), vazio), local, remoto);
      gravarLast(chave, ed && !remoto.length ? null : json);
      mudancas.push({ chave, parte: final, local });
    });
    pendentes.clear();
    if (mudancas.length && store.aoMesclar) store.aoMesclar(mudancas, "ao-vivo");
  }
  function chegou(chave, remoto) {
    pendentes.set(chave, remoto);
    if (!agendado) agendado = setTimeout(aplicar, 150); // coalesce a burst of snapshots
  }

  const cancelar = [];
  const erro = () => {}; // a dead subscription only means no live updates; saves still merge
  for (const chave of Object.keys(DOCS)) {
    let ultimo = null;
    cancelar.push(db.doc(DOCS[chave].path).onSnapshot((snap) => {
      if (snap.metadata?.hasPendingWrites) return;
      const d = snap.exists ? snap.data() : null;
      if (d === ultimo) return;
      ultimo = d;
      chegou(chave, DOCS[chave].parte(d));
    }, erro));
  }
  const ultimos = new Map();
  cancelar.push(db.collection("edicoes").onSnapshot((qs) => {
    if (qs.metadata?.hasPendingWrites) return;
    for (const ch of qs.docChanges()) {
      const d = ch.type === "removed" ? null : ch.doc.data();
      if (d && ultimos.get(ch.doc.id) === d) continue;
      ultimos.set(ch.doc.id, d);
      chegou("ed:" + ch.doc.id, d?.items || []);
    }
  }, erro));
  return () => { cancelar.forEach((f) => { try { f(); } catch (e) {} }); if (agendado) clearTimeout(agendado); };
}

// v88: when the library was last backed up, in its own document rather than in
// the library: it is shared by both devices like everything else in db, but it
// never rides inside a backup file (importing an old one would otherwise rewrite
// it) and undo, which restores the library, cannot touch it. library/meta holds
// only this field, so set() replacing the whole document is fine; a future field
// here would need to be written alongside it.
export async function lerUltimoBackup(db) {
  try {
    const snap = await db.doc("library/meta").get();
    return snap.exists ? snap.data().ultimoBackup || null : null;
  } catch (e) {
    return null;
  }
}

export async function gravarUltimoBackup(quando) {
  if (!store.db) return;
  try {
    await store.db.doc("library/meta").set({ ultimoBackup: quando });
  } catch (e) {
    if (store.onError) store.onError(dbErrorMessage(e));
  }
}

// v141: up to three pinned characters, first on the HQs and Séries tabs. Its own
// document, like library/meta: shared by both devices, outside backups and undo.
// v142: live. Own writes are remembered so their echo never rolls the list back
// (two quick pins would otherwise flicker to the first); a change from the other
// device arrives through onSnapshot. ponytail: last write wins, no merge; a pin on
// both devices at the same instant keeps whichever saved last.
const fixadosProprios = new Set();
export function ouvirFixados(db, aoMudar) {
  let ultimo = null;
  return db.doc("library/fixados").onSnapshot((snap) => {
    if (snap.metadata?.hasPendingWrites) return;
    const d = snap.exists ? snap.data() : null;
    if (d === ultimo) return;
    ultimo = d;
    const lista = (d && d.personagens) || [];
    const json = JSON.stringify(lista);
    if (fixadosProprios.has(json)) return;
    fixadosProprios.clear();
    aoMudar(lista);
  }, () => {});
}

export async function lerFixados(db) {
  try {
    const snap = await db.doc("library/fixados").get();
    return snap.exists ? snap.data().personagens || [] : [];
  } catch (e) {
    return [];
  }
}

export async function gravarFixados(personagens) {
  if (!store.db) return;
  try {
    fixadosProprios.add(JSON.stringify(personagens));
    await store.db.doc("library/fixados").set({ personagens });
  } catch (e) {
    if (store.onError) store.onError(dbErrorMessage(e));
  }
}

export function scheduleSave(lib) {
  if (!store.db) return;
  if (store.timer) clearTimeout(store.timer);
  store.pendente = lib;
  store.timer = setTimeout(salvarPendente, 500);
}
export function salvarPendente() {
  if (store.timer) clearTimeout(store.timer);
  store.timer = null;
  const lib = store.pendente;
  store.pendente = null;
  if (lib) flushLibrary(lib);
}
// v124: a phone suspends a hidden page, timers included, so an edit still inside
// the 500ms wait was never saved. It is saved as the page hides.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && store.timer) salvarPendente(); });
}

export function storeIsBusy() { return store.timer !== null || store.inFlight > 0; }

// v96: puts documents that came back merged (at save time or live) into the
// library on screen. `local` is the copy the merge started from: if the screen
// moved on since (the person kept editing), those newer edits are merged on top
// again rather than dropped.
export function aplicarMescladas(lib, mudancas) {
  let next = { ...lib };
  for (const m of mudancas) {
    if (m.chave.startsWith("ed:")) {
      const sid = m.chave.slice(3);
      const atual = next.edicoes.filter((e) => e.serieId === sid);
      const parte = JSON.stringify(atual) === JSON.stringify(m.local) ? m.parte : mesclarLista(m.local, atual, m.parte);
      next.edicoes = [...next.edicoes.filter((e) => e.serieId !== sid), ...parte];
      continue;
    }
    const cfg = DOCS[m.chave];
    const atual = cfg.daLib(next);
    const parte = JSON.stringify(atual) === JSON.stringify(m.local) ? m.parte : cfg.mesclar(m.local, atual, m.parte);
    if (m.chave === "editoras") { next.editoras = parte.itens; next.editoraSel = parte.selecionada; }
    else next[m.chave] = parte;
  }
  return normalizeLib(next);
}
