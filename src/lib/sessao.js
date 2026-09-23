import { STATUS_ORDER, TIPOS, TIPOS_RENOMEADOS } from "./constantes";

// Which tab the app opens on. The note is kept in sessionStorage, not
// localStorage, and the difference is the whole feature: sessionStorage belongs
// to the browser tab, so reloading the page keeps you where you were, and closing
// the tab throws the note away so the next visit lands on the hub. The hub stays
// the front door; this only stops a reload from being one.
export const ABA_KEY = "longbox:aba";
export const ABAS = ["hub", "volumes", "colecoes", "series"];

export function lerAbaSalva() {
  try {
    if (typeof window === "undefined") return "hub";
    const salva = window.sessionStorage.getItem(ABA_KEY);
    return ABAS.indexOf(salva) === -1 ? "hub" : salva;
  } catch {
    // A private window can refuse storage outright. Landing on the hub is the
    // behaviour this app had for its whole life, so it is a safe floor.
    return "hub";
  }
}

export function salvarAba(key) {
  try {
    if (typeof window !== "undefined") window.sessionStorage.setItem(ABA_KEY, key);
  } catch {
    // Nothing to do: the tab simply will not be remembered here.
  }
}

// Which character groups are open on the séries tab. Same storage and the same
// reasoning as the tab above, deliberately: a reload keeps what you had open,
// and a fresh visit starts closed again. Closed is the default because the tab
// is a reference list rather than something to read top to bottom, and with a
// real library it opens several thousand pixels long.
//
// It stores the names that are OPEN, so a character cataloguing brings in later
// is closed like all the rest without needing to be listed anywhere.
export const GRUPOS_KEY = "longbox:series-abertas";

export function lerGruposAbertos() {
  try {
    if (typeof window === "undefined") return new Set();
    const salvo = window.sessionStorage.getItem(GRUPOS_KEY);
    if (!salvo) return new Set();
    const lista = JSON.parse(salvo);
    // Anything but an array of strings is somebody else's data or a half-written
    // value; starting closed is the same floor the tab note falls back to.
    return Array.isArray(lista) ? new Set(lista.filter((x) => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

export function salvarGruposAbertos(abertos) {
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(GRUPOS_KEY, JSON.stringify([...abertos]));
    }
  } catch {
    // Same as the tab: not remembered here, and nothing else breaks.
  }
}

// Which character groups are folded on the HQs tab. Same storage shape and
// the same per-session lifetime as the séries tab above, but the default is
// reversed: the shelf is what you came here to look at, so it opens fully
// the first time and only remembers what you deliberately closed.
//
// It stores the names that are CLOSED (the opposite of the séries key), so a
// character cataloguing brings in later opens like all the rest without
// needing to be listed anywhere — the empty set, on a first visit, means
// nothing is closed rather than nothing is open.
export const GRUPOS_FECHADOS_KEY = "longbox:hqs-fechadas";

export function lerGruposFechados() {
  try {
    if (typeof window === "undefined") return new Set();
    const salvo = window.sessionStorage.getItem(GRUPOS_FECHADOS_KEY);
    if (!salvo) return new Set();
    const lista = JSON.parse(salvo);
    return Array.isArray(lista) ? new Set(lista.filter((x) => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

export function salvarGruposFechados(fechados) {
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(GRUPOS_FECHADOS_KEY, JSON.stringify([...fechados]));
    }
  } catch {
    // Same as the séries key: not remembered here, and nothing else breaks.
  }
}

// Which collections are folded to their title on the Coleções tab (v68). The
// HQs tab's rule exactly: a fresh visit opens everything, a reload keeps what
// you closed. Stores the CLOSED ids, so the empty set means all open.
export const COLECOES_FECHADAS_KEY = "longbox:colecoes-fechadas";

export function lerColecoesFechadas() {
  try {
    if (typeof window === "undefined") return new Set();
    const salvo = window.sessionStorage.getItem(COLECOES_FECHADAS_KEY);
    if (!salvo) return new Set();
    const lista = JSON.parse(salvo);
    return Array.isArray(lista) ? new Set(lista.filter((x) => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

export function salvarColecoesFechadas(ids) {
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(COLECOES_FECHADAS_KEY, JSON.stringify([...ids]));
    }
  } catch {
    // Not remembered here, and nothing else breaks.
  }
}

// Which collections have their reading order folded in the manage sheet (v66).
// Same lifetime as the fold keys above: a reload keeps it, a fresh visit opens
// every list again. Stores the ids that are FOLDED, so a new collection opens.
export const ORDEM_RECOLHIDA_KEY = "longbox:ordem-recolhida";

export function lerOrdemRecolhida() {
  try {
    if (typeof window === "undefined") return new Set();
    const salvo = window.sessionStorage.getItem(ORDEM_RECOLHIDA_KEY);
    if (!salvo) return new Set();
    const lista = JSON.parse(salvo);
    return Array.isArray(lista) ? new Set(lista.filter((x) => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

export function salvarOrdemRecolhida(ids) {
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(ORDEM_RECOLHIDA_KEY, JSON.stringify([...ids]));
    }
  } catch {
    // Not remembered here, and nothing else breaks.
  }
}

// The HQs tab's filters (status, tipo, personagem). Same lifetime as everything
// above: a reload keeps them, a fresh visit starts with none. Switching tabs never
// touched them, since they live in the app's own state; only a reload lost them.
// The publisher band is not here on purpose: it is saved in the database, so it
// also survives a fresh visit and follows the user between devices.
export const FILTROS_KEY = "longbox:filtros-hqs";
export const FILTROS_VAZIOS = { status: "", tipo: "", personagem: "" };

export function lerFiltros() {
  try {
    if (typeof window === "undefined") return FILTROS_VAZIOS;
    const salvo = window.sessionStorage.getItem(FILTROS_KEY);
    if (!salvo) return FILTROS_VAZIOS;
    const f = JSON.parse(salvo) || {};
    return {
      // A value the app no longer offers falls back to "all", not to a filter
      // that can never match anything.
      status: STATUS_ORDER.includes(f.status) ? f.status : "",
      tipo: TIPOS.includes(TIPOS_RENOMEADOS[f.tipo] || f.tipo) ? (TIPOS_RENOMEADOS[f.tipo] || f.tipo) : "",
      personagem: typeof f.personagem === "string" ? f.personagem : "",
    };
  } catch {
    return FILTROS_VAZIOS;
  }
}

export function salvarFiltros(f) {
  try {
    if (typeof window === "undefined") return;
    if (!f.status && !f.tipo && !f.personagem) window.sessionStorage.removeItem(FILTROS_KEY);
    else window.sessionStorage.setItem(FILTROS_KEY, JSON.stringify(f));
  } catch {
    // Not remembered here, and the filters still work for this page load.
  }
}

// Accent- and case-blind, so "robin" finds "Róbin" and "asa" finds "Asa Noturna".
export function dobrar(s) {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
