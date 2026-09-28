import { useEffect, useRef } from "react";

// Q4 (v91): the keyboard shortcuts, one window listener for all of them.
//   /        search                    1 2 3   HQs, Coleções, Séries (0 the hub, v93)
//   N        new, as the tab's "Novo"  E       edit what the open sheet shows
//   Ctrl+Z   undo the last removal     ?       the list of shortcuts
//   Q        fold or unfold every group on HQs and Séries (v94)
//   J K L    Não lida / Lendo / Lida: the open volume sheet, or the focused cover (v119)
// Esc and ← → live with the sheets that own them (useEscape, VolumeSheet).
// Rules: nothing fires while typing in a field or under a modal; letters and digits
// never with Ctrl, Alt or Cmd, since Ctrl+1 and Ctrl+N are the browser's; Ctrl+Z is
// taken only while a removal can be undone, otherwise it stays the browser's (and in
// a field it is always the field's own undo). With a sheet open only E and J K L work, so a
// stray digit cannot switch the tab out from under it.
export function useAtalhos(acoes) {
  const atual = useRef(acoes);
  atual.current = acoes;
  useEffect(() => {
    const h = (e) => {
      if (e.defaultPrevented) return;
      const a = atual.current;
      const k = e.key;
      const alvo = e.target;
      const digitando = !!(alvo && alvo.closest && alvo.closest("input, textarea, select, [contenteditable]"));
      const modal = !!document.querySelector(".modal");

      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (k === "z" || k === "Z")) {
        if (digitando || modal || !a.podeDesfazer) return;
        e.preventDefault();
        a.desfazer();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (digitando || modal) return;

      if (k === "?") { e.preventDefault(); a.mostrarAtalhos(); return; }
      if (k === "e" || k === "E") {
        if (a.editarAberto()) e.preventDefault();
        return;
      }
      if (k === "j" || k === "J" || k === "k" || k === "K" || k === "l" || k === "L") {
        if (a.marcarStatus({ j: "nao_lida", k: "lendo", l: "lida" }[k.toLowerCase()], alvo)) e.preventDefault();
        return;
      }
      if ((k === "n" || k === "N") && a.novaEdicaoNaFicha && a.novaEdicaoNaFicha()) { e.preventDefault(); return; }
      if (a.fichaAberta) return;
      if (k === "/") { e.preventDefault(); a.focarBusca(); return; }
      if (k === "0" || k === "1" || k === "2" || k === "3") {
        e.preventDefault();
        a.abrirAba(["hub", "volumes", "colecoes", "series"][Number(k)]);
        return;
      }
      if (k === "n" || k === "N") { e.preventDefault(); a.novo(); return; }
      if (k === "q" || k === "Q") { if (a.alternarDobra()) e.preventDefault(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // The artifact host injects a runtime that hands an unhandled Esc to claude.ai,
  // which pulls focus out of the whole app (and with it every shortcut). It skips
  // an Esc whose default was prevented, so claim every Esc here, in the capture
  // phase so it runs before the host's own listener. The app's Esc handlers
  // (useEscape, search, dropdowns) never check defaultPrevented, so they still run.
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") e.preventDefault(); };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, []);
}
