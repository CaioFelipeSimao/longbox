import { useState, useEffect } from "react";

import { IMG_TYPES } from "./constantes";
import { store, salvarPendente } from "./armazenamento";
import { corDosPixels } from "./util";

export function coverUrl(volume) {
  return volume && volume.capaAssetId ? "/_blob/" + volume.capaAssetId : null;
}

// v85. Covers are stored at full size (968x1500 from Amazon), about 1.45
// megapixels each, and the shelves show them about 134px wide. The user's
// measurements pinned the tab-switch stutter on them: leaving Séries, which
// has no covers, Chrome drops the decoded ones, and coming back to HQs or
// Coleções held the next frame for up to 475ms while it decoded them all
// again (8ms with the covers hidden). So every shelf draws a 360px-wide copy
// instead, about 7 times fewer pixels to decode. The copies are made in the
// browser, one at a time while idle, and kept in this device's IndexedDB:
// nothing is uploaded and the shared library is never written. The volume
// sheet and the hub's suggestion keep the full cover. Every step fails soft:
// without IndexedDB they last the session, without canvas support the full
// cover is used, as before.
export const MINI_LARGURA = 360;
// JPEG, not WebP: Chrome decodes a JPEG straight to a reduced size when it is
// shown smaller, and cannot do that for WebP, so a WebP thumbnail measured no
// faster to decode than the full JPEG cover it replaced.
export const MINI_FORMATO = "image/jpeg";
export const MINI_BANCO = "longbox-miniaturas";
export const miniUrls = new Map();
// v124: the files behind those blob: URLs. The artifact frame refuses fetch() of
// a blob: URL, so an upload needs the Blob itself.
const miniBlobs = new Map();
export const miniOuvintes = new Map();
export const miniGerais = new Set();
export let miniAviso = 0;

// v123. A device's own copies above are still the first choice (the PC keeps
// drawing exactly what it drew before), but a device without them no longer
// makes its own from the full covers, which average ~760 KB (the Panini ones
// are PNGs of up to 2.6 MB): a new phone, or Safari after it cleared the site's
// storage, downloaded well over 100 MB for that. The first device to make a
// thumbnail uploads it and the volume records it as { capa, id }; everyone else
// draws that small file. A record made for another cover is ignored, so a
// swapped cover gets a fresh one whoever swapped it.
export const miniRemotas = new Map();

export function registrarMiniRemotas(volumes) {
  const novas = [];
  volumes.forEach((v) => {
    if (!v.capaAssetId || !v.mini || v.mini.capa !== v.capaAssetId || !v.mini.id) return;
    const url = "/_blob/" + v.mini.id;
    if (miniRemotas.get(v.capaAssetId) !== url) { miniRemotas.set(v.capaAssetId, url); novas.push(v.capaAssetId); }
  });
  return novas;
}

const melhorMini = (id) => miniUrls.get(id) || miniRemotas.get(id) || null;

export function miniUrl(volume) {
  return volume && volume.capaAssetId ? melhorMini(volume.capaAssetId) : null;
}

export function avisarMini(id) {
  const s = miniOuvintes.get(id);
  if (s) s.forEach((f) => f());
  // The hub backdrop wants to know about all of them; batched.
  if (!miniAviso) miniAviso = setTimeout(() => { miniAviso = 0; miniGerais.forEach((f) => f()); }, 400);
}

// Re-renders the caller when its cover's thumbnail arrives.
export function useMiniCapa(id) {
  const [, tocar] = useState(0);
  useEffect(() => {
    if (!id || miniUrls.has(id)) return undefined;
    const f = () => tocar((n) => n + 1);
    if (!miniOuvintes.has(id)) miniOuvintes.set(id, new Set());
    miniOuvintes.get(id).add(f);
    return () => { const s = miniOuvintes.get(id); if (s) s.delete(f); };
  }, [id]);
  return id ? melhorMini(id) : null;
}

// A number that moves whenever thumbnails arrive, for memoised lists of them.
export function useMiniVersao() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const f = () => setV((n) => n + 1);
    miniGerais.add(f);
    return () => miniGerais.delete(f);
  }, []);
  return v;
}

export function abrirMiniBanco() {
  return new Promise((res) => {
    try {
      if (typeof indexedDB === "undefined") { res(null); return; }
      const q = indexedDB.open(MINI_BANCO, 1);
      q.onupgradeneeded = () => q.result.createObjectStore("capas");
      q.onsuccess = () => res(q.result);
      q.onerror = () => res(null);
      q.onblocked = () => res(null);
    } catch (e) { res(null); }
  });
}
export const miniBanco = abrirMiniBanco();

// Everything already made on this device, read once at startup.
export const miniCacheLido = miniBanco.then((db) => new Promise((res) => {
  if (!db) { res(); return; }
  try {
    const q = db.transaction("capas", "readonly").objectStore("capas").openCursor();
    q.onsuccess = () => {
      const c = q.result;
      if (!c) { res(); return; }
      const v = c.value;
      if (v && v.blob && v.largura === MINI_LARGURA && v.formato === MINI_FORMATO) { miniUrls.set(c.key, URL.createObjectURL(v.blob)); miniBlobs.set(c.key, v.blob); }
      c.continue();
    };
    q.onerror = () => res();
  } catch (e) { res(); }
}));

// Waits for that read, but never longer than the given time: the covers can
// always fall back to full size.
export function esperarMiniaturas(ms) {
  return Promise.race([miniCacheLido, new Promise((r) => setTimeout(r, ms))]);
}

export async function gerarMini(id) {
  const url = "/_blob/" + id;
  let fonte = null;
  try {
    const r = await fetch(url);
    if (r.ok) fonte = await r.blob();
  } catch (e) { fonte = null; }
  if (!fonte) {
    const img = new Image();
    img.src = url;
    await img.decode();
    fonte = img;
  }
  // Size first, then the resized copy; the full-size bitmap is let go at once.
  const inteira = await createImageBitmap(fonte);
  const larg = Math.min(MINI_LARGURA, inteira.width);
  const altura = Math.round((larg * inteira.height) / inteira.width);
  if (inteira.close) inteira.close();
  const mini = await createImageBitmap(fonte, { resizeWidth: larg, resizeHeight: altura, resizeQuality: "high" });
  let blob;
  if (typeof OffscreenCanvas === "function") {
    const c = new OffscreenCanvas(larg, altura);
    c.getContext("2d").drawImage(mini, 0, 0);
    blob = await c.convertToBlob({ type: MINI_FORMATO, quality: 0.88 });
  } else {
    const c = document.createElement("canvas");
    c.width = larg; c.height = altura;
    c.getContext("2d").drawImage(mini, 0, 0);
    blob = await new Promise((r) => c.toBlob(r, MINI_FORMATO, 0.88));
  }
  if (mini.close) mini.close();
  if (!blob) throw new Error("sem blob");
  return blob;
}

export const miniFila = [];
export const miniNaFila = new Set();
export let miniRodando = false;
export const ocioso = (fn) => (typeof requestIdleCallback === "function"
  ? requestIdleCallback(fn, { timeout: 2000 })
  : setTimeout(fn, 60));

const miniFalhas = new Set();
let envioParado = false;
let aoEnviarMini = null;
let enviadas = {};
let envioAviso = 0;

// v123: uploads are recorded in batches, so the first device to run this makes
// a handful of library writes instead of one per cover.
function enviarLote() {
  if (envioAviso) clearTimeout(envioAviso);
  envioAviso = 0;
  const lote = enviadas;
  enviadas = {};
  if (Object.keys(lote).length && aoEnviarMini) aoEnviarMini(lote);
}
function registrarEnvio(capa, mini) {
  enviadas[capa] = mini;
  miniRemotas.set(capa, "/_blob/" + mini);
  if (!envioAviso) envioAviso = setTimeout(enviarLote, 3000);
}
// v124: a phone suspends a hidden page, timers included, so a batch still
// waiting there was lost with its uploads. It goes out as the page hides.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { enviarLote(); salvarPendente(); } });
}

export function rodarMiniFila() {
  if (miniRodando) return;
  const id = miniFila.shift();
  if (!id) return;
  miniRodando = true;
  ocioso(async () => {
    try {
      let blob = null;
      if (!miniUrls.has(id)) {
        blob = await gerarMini(id);
        miniUrls.set(id, URL.createObjectURL(blob));
        miniBlobs.set(id, blob);
        avisarMini(id);
        const db = await miniBanco;
        if (db) {
          try { db.transaction("capas", "readwrite").objectStore("capas").put({ blob, largura: MINI_LARGURA, formato: MINI_FORMATO }, id); } catch (e) { /* the session copy still works */ }
        }
      }
      if (!miniRemotas.has(id) && !envioParado && store.assets) {
        if (!blob) blob = miniBlobs.get(id);
        try {
          const r = await store.assets.upload(new File([blob], "miniatura.jpg", { type: MINI_FORMATO }), { type: MINI_FORMATO });
          registrarEnvio(id, r.id);
        } catch (e) {
          // Quota, rate limit or a lapsed session: stop for this session; the
          // local copies keep working and the next visit tries again.
          envioParado = true;
        }
      }
    } catch (e) {
      // This cover keeps its full size; nothing else changes.
      miniFalhas.add(id);
    }
    miniNaFila.delete(id);
    miniRodando = false;
    rodarMiniFila();
  });
}

// Queues every cover in use that has no thumbnail anywhere (made here, then
// uploaded) or only a local one (uploaded), and forgets the local copies no
// volume uses any more. aoEnviar receives { capaAssetId: miniAssetId } batches.
export async function prepararMiniaturas(volumes, aoEnviar) {
  aoEnviarMini = aoEnviar;
  registrarMiniRemotas(volumes).forEach(avisarMini);
  if (typeof createImageBitmap !== "function") return;
  await miniCacheLido;
  const ids = [...new Set(volumes.map((v) => v.capaAssetId).filter(Boolean))];
  const usados = new Set(ids);
  ids.forEach((id) => {
    if (miniRemotas.has(id) || miniNaFila.has(id) || miniFalhas.has(id)) return;
    if (!miniUrls.has(id) || (store.assets && !envioParado)) {
      miniNaFila.add(id);
      miniFila.push(id);
    }
  });
  rodarMiniFila();
  const db = await miniBanco;
  if (!db) return;
  try {
    const st = db.transaction("capas", "readwrite").objectStore("capas");
    const q = st.getAllKeys();
    q.onsuccess = () => (q.result || []).forEach((k) => { if (!usados.has(k)) st.delete(k); });
  } catch (e) { /* tidiness only */ }
}

export function assetErrorMessage(e) {
  const code = e && e.code;
  if (code === "too_large") return "Imagem grande demais. O limite é 20 MB.";
  if (code === "unsupported_type") return "Formato não aceito. Use PNG, JPG, GIF ou WebP.";
  if (code === "quota_or_state") return "O espaço de imagens do artefato encheu.";
  if (code === "rate_limited") return "Muitos envios seguidos. Espere um pouco.";
  if (code === "invalid_request") return "Esse arquivo não deu pra ler como imagem.";
  if (code === "upstream_auth") return "Sessão expirada. Recarregue a página.";
  return "Não consegui enviar a capa.";
}

export const COVER_MAX_W = 900;
export const COVER_PASSTHROUGH_BYTES = 400 * 1024;

// Shrinks only genuinely oversized files (a phone photo). A cover saved from a
// store page is already small and is passed through untouched, because
// recompressing an already-compressed JPEG costs quality and buys nothing.
export async function prepareCover(file) {
  if (file.size <= COVER_PASSTHROUGH_BYTES) return file;
  if (typeof createImageBitmap !== "function") return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (e) {
    return file;
  }
  try {
    if (bitmap.width <= COVER_MAX_W) return file;
    const w = COVER_MAX_W;
    const h = Math.round(bitmap.height * (w / bitmap.width));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], "capa.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

export async function uploadCover(file) {
  if (!store.assets) throw { code: "not_granted", message: "sem assets" };
  const prepared = await prepareCover(file);
  let type = prepared.type;
  if (!type || !Object.values(IMG_TYPES).includes(type)) {
    const ext = (prepared.name.split(".").pop() || "").toLowerCase();
    type = IMG_TYPES[ext];
    if (!type) throw { code: "unsupported_type", message: "extensão desconhecida" };
  }
  return store.assets.upload(prepared, { type });
}

// v106: the colour that tints the top of the volume sheet, taken from the cover
// itself. The shelf thumbnail (already on this device) is drawn at 16x24 and its
// pixels are grouped by hue; the hue with the most saturated pixels wins, averaged
// within its group. A plain average would be mud on most covers. Near-black, near-
// white and grey pixels do not vote, so a cover that is mostly those gives null and
// the sheet uses the character's colour instead. Lightness is fixed and saturation
// clamped, so every wash sits at the same strength. One small draw per cover, cached.
const corCache = new Map();

export function corDominante(url) {
  if (corCache.has(url)) return Promise.resolve(corCache.get(url));
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      let cor = null;
      try {
        const W = 16, H = 24;
        const cv = document.createElement("canvas");
        cv.width = W; cv.height = H;
        const x = cv.getContext("2d", { willReadFrequently: true });
        x.drawImage(img, 0, 0, W, H);
        cor = corDosPixels(x.getImageData(0, 0, W, H).data);
      } catch (e) { cor = null; }
      corCache.set(url, cor);
      res(cor);
    };
    img.onerror = () => { corCache.set(url, null); res(null); };
    img.src = url;
  });
}

// The sheet's tint for this volume: the cover's colour once known, null before.
export function useCorDaCapa(volume) {
  const mini = useMiniCapa(volume && volume.capaAssetId);
  const [cor, setCor] = useState(null); // { url, cor }
  useEffect(() => {
    if (!mini) return undefined;
    let vivo = true;
    corDominante(mini).then((c) => { if (vivo) setCor({ url: mini, cor: c }); });
    return () => { vivo = false; };
  }, [mini]);
  return cor && cor.url === mini ? cor.cor : null;
}
