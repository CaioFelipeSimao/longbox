import { ED_TODAS } from "./constantes";
import { normalizeLib } from "./biblioteca";

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
};

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

export async function flushLibrary(lib) {
  const db = store.db;
  if (!db) return;

  const writes = [];
  const volumesJson = JSON.stringify(lib.volumes);
  if (volumesJson !== store.lastVolumes) {
    writes.push({ key: "volumes", ref: db.doc("library/volumes"), body: { items: lib.volumes }, json: volumesJson });
  }
  const colecoesJson = JSON.stringify(lib.colecoes);
  if (colecoesJson !== store.lastColecoes) {
    writes.push({ key: "colecoes", ref: db.doc("library/colecoes"), body: { items: lib.colecoes }, json: colecoesJson });
  }
  const seriesJson = JSON.stringify(lib.series);
  if (seriesJson !== store.lastSeries) {
    writes.push({ key: "series", ref: db.doc("library/series"), body: { items: lib.series }, json: seriesJson });
  }
  const coresJson = JSON.stringify(lib.cores || {});
  if (coresJson !== store.lastCores) {
    writes.push({ key: "cores", ref: db.doc("library/cores"), body: { mapa: lib.cores || {} }, json: coresJson });
  }
  const ediBody = { itens: lib.editoras || [], selecionada: lib.editoraSel || ED_TODAS };
  const ediJson = JSON.stringify(ediBody);
  if (ediJson !== store.lastEditoras) {
    writes.push({ key: "editoras", ref: db.doc("library/editoras"), body: ediBody, json: ediJson });
  }

  const shards = shardEdicoes(lib.edicoes);
  shards.forEach((items, sid) => {
    const json = JSON.stringify(items);
    if (json !== store.lastEdicoes.get(sid)) {
      writes.push({ key: "ed:" + sid, sid, ref: db.collection("edicoes").doc(sid), body: { items }, json });
    }
  });
  store.lastEdicoes.forEach((_, sid) => {
    if (!shards.has(sid)) writes.push({ key: "ed:" + sid, sid, ref: db.collection("edicoes").doc(sid), remove: true });
  });

  if (!writes.length) return;
  store.inFlight++;
  try {
    for (const w of writes) {
      try {
        if (w.remove) {
          await w.ref.delete();
          store.lastEdicoes.delete(w.sid);
        } else {
          await w.ref.set(w.body);
          if (w.key === "volumes") store.lastVolumes = w.json;
          else if (w.key === "colecoes") store.lastColecoes = w.json;
          else if (w.key === "series") store.lastSeries = w.json;
          else if (w.key === "cores") store.lastCores = w.json;
          else if (w.key === "editoras") store.lastEditoras = w.json;
          else store.lastEdicoes.set(w.sid, w.json);
        }
      } catch (e) {
        if (store.onError) store.onError(dbErrorMessage(e));
        return;
      }
    }
  } finally {
    store.inFlight--;
  }
}

export function scheduleSave(lib) {
  if (!store.db) return;
  if (store.timer) clearTimeout(store.timer);
  store.timer = setTimeout(() => {
    store.timer = null;
    flushLibrary(lib);
  }, 500);
}

export function storeIsBusy() { return store.timer !== null || store.inFlight > 0; }
