import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HOLD_EASE_LINEAR, HOLD_EASE_OUT, prefersReducedMotion } from "../lib/hooks";
import { criarGhost } from "../lib/arrastoGhost";
import { pontoNaCaixaExpandida, pontoNoConteudo, rectNoConteudo, reordenarParaSlot,
  slotNoPonto, velocidadeAutoScroll, velocidadeAutoScrollHorizontal, lerLimitesDeRolagemDaPagina } from "../lib/arrastoSeguir";

// Each occurrence has its original member index as its identity, including
// duplicate volume ids. Only this collection's membros is ever committed.
export function useArrastarColecao(colecao, lib, persist) {
  const [visual, setVisual] = useState(null);
  const dragRef = useRef(null), settlingRef = useRef(null);
  const nodes = useRef(new Map()), flipRef = useRef(null), flips = useRef(new Map());
  const raf = useRef(0), hold = useRef({ raf: 0, p: 0, el: null });
  const suppressClickRef = useRef(false);
  const latest = useRef({ colecao, lib, persist });
  latest.current = { colecao, lib, persist };

  function registrar(indice, el) {
    if (el) nodes.current.set(indice, el); else nodes.current.delete(indice);
  }

  function driveHold(el, to, duration, ease) {
    if (!el) return;
    const m = hold.current;
    cancelAnimationFrame(m.raf);
    if (m.el !== el && to !== 1) return;
    if (m.el !== el) m.p = 0;
    m.el = el;
    const from = m.p, start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      m.p = from + (to - from) * ease(t);
      el.style.setProperty("--hold-p", m.p.toFixed(4));
      const ghost = dragRef.current?.ghost || settlingRef.current?.ghost;
      ghost?.node.querySelector(".cover")?.style.setProperty("--hold-p", m.p.toFixed(4));
      m.raf = t < 1 ? requestAnimationFrame(step) : 0;
    };
    m.raf = requestAnimationFrame(step);
  }

  function snapshot() {
    return new Map([...nodes.current].map(([i, el]) => [i, el.parentElement.getBoundingClientRect()]));
  }

  function medirSlots(info) {
    const box = info.strip.getBoundingClientRect();
    info.slots = info.order.map((i) => {
      const el = nodes.current.get(i)?.parentElement;
      if (!el) return null; // Missing volume ids still keep their member indices.
      const transform = el.style.transform, transition = el.style.transition;
      el.style.transition = "none"; el.style.transform = "none";
      const rect = rectNoConteudo(el.getBoundingClientRect(), box, info.strip.scrollLeft, info.strip.scrollTop);
      el.style.transform = transform; el.style.transition = transition;
      return rect;
    });
    info.folga = (parseFloat(getComputedStyle(info.strip).columnGap) || 0) / 2;
  }

  function atualizarOrdem(info, order) {
    if (order.every((i, k) => i === info.order[k])) return;
    flipRef.current = snapshot();
    info.order = order;
    setVisual({ ...info, settling: false });
  }

  function atualizarSlot(info) {
    const rect = info.strip.getBoundingClientRect();
    if (!pontoNaCaixaExpandida(info.pointer, rect)) {
      atualizarOrdem(info, info.originalOrder.slice());
      return;
    }
    const slot = slotNoPonto(pontoNoConteudo(info.pointer, rect, info.strip.scrollLeft, info.strip.scrollTop),
      info.slots, { folga: { x: info.folga, y: 0 } });
    if (slot != null) atualizarOrdem(info, reordenarParaSlot(info.originalOrder, info.indice, slot));
  }

  function scrollContainer(el) {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(p).overflowY) && p.scrollHeight > p.clientHeight) return p;
    }
    return document.scrollingElement || document.documentElement;
  }

  function autoScroll(info) {
    const strip = info.strip, box = strip.getBoundingClientRect();
    const maxX = Math.max(0, strip.scrollWidth - strip.clientWidth);
    const dx = velocidadeAutoScrollHorizontal(info.pointer.x, Math.max(0, box.left), Math.min(window.innerWidth, box.right),
      { scrollLeft: strip.scrollLeft, maxScroll: maxX });
    if (dx) strip.scrollLeft = Math.max(0, Math.min(maxX, strip.scrollLeft + dx));
    const container = info.scrollContainer;
    const page = container === document.scrollingElement || container === document.documentElement;
    const rect = page ? lerLimitesDeRolagemDaPagina() : container.getBoundingClientRect();
    const maxY = Math.max(0, container.scrollHeight - (page ? window.innerHeight : container.clientHeight));
    const dy = velocidadeAutoScroll(info.pointer.y, Math.max(0, rect.top), Math.min(window.innerHeight, rect.bottom),
      { scrollTop: container.scrollTop, maxScroll: maxY });
    if (dy) container.scrollTop = Math.max(0, Math.min(maxY, container.scrollTop + dy));
  }

  function frame() {
    const info = dragRef.current;
    if (!info?.active) return;
    if (!info.strip.isConnected || !nodes.current.get(info.indice)?.isConnected ||
        info.strip.closest(".aba")?.dataset.ativa === "false") { abort(); setVisual(null); return; }
    autoScroll(info);
    atualizarSlot(info);
    info.ghost.follow(info.pointer);
    raf.current = requestAnimationFrame(frame);
  }

  function clearFlips() {
    flips.current.forEach(({ el, timer, frame }) => {
      clearTimeout(timer); cancelAnimationFrame(frame);
      el.style.transform = ""; el.style.transition = "";
    });
    flips.current.clear();
  }

  function finishSettle() {
    settlingRef.current?.ghost.remove();
    settlingRef.current = null;
    clearFlips();
    setVisual(null);
  }

  useLayoutEffect(() => {
    const before = flipRef.current;
    flipRef.current = null;
    const info = dragRef.current || settlingRef.current;
    if (before && !prefersReducedMotion()) before.forEach((prev, i) => {
      if (i === info?.indice) return;
      const el = nodes.current.get(i)?.parentElement;
      if (!el) return;
      const old = flips.current.get(i);
      clearTimeout(old?.timer); cancelAnimationFrame(old?.frame);
      el.style.transition = "none"; el.style.transform = "";
      const now = el.getBoundingClientRect();
      const dx = prev.left - now.left, dy = prev.top - now.top;
      if (!dx && !dy) { el.style.transition = ""; return; }
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.getBoundingClientRect();
      const entry = { el };
      const release = () => {
        if (flips.current.get(i) !== entry) return;
        el.style.transition = "transform 220ms var(--ease-in-out, cubic-bezier(0.77, 0, 0.175, 1))";
        el.style.transform = "";
      };
      flips.current.set(i, entry);
      entry.frame = requestAnimationFrame(release);
      entry.timer = setTimeout(release, 370);
    });
    if (dragRef.current?.active) {
      try { nodes.current.get(info.indice)?.setPointerCapture(info.pointerId); } catch {}
    }
    const settling = settlingRef.current;
    if (settling && !settling.started) {
      settling.started = true;
      const el = nodes.current.get(settling.indice);
      if (!el?.isConnected) { finishSettle(); return; }
      settling.ghost.settle(el.getBoundingClientRect(), finishSettle);
    }
  }, [visual]);

  function matches(e, info) {
    return e?.pointerId == null || info.pointerId == null || e.pointerId === info.pointerId;
  }

  function finalizar(e) {
    const info = dragRef.current;
    if (!info || !matches(e, info)) return;
    if (e?.type === "pointerup") info.pointer = { x: e.clientX, y: e.clientY };
    clearTimeout(info.timer); cancelAnimationFrame(raf.current);
    const el = nodes.current.get(info.indice);
    driveHold(el?.querySelector(".cover"), 0, 150, HOLD_EASE_OUT);
    try { el?.releasePointerCapture(info.pointerId); } catch {}
    if (info.active) {
      if (e?.type === "pointerup") atualizarSlot(info);
      const current = latest.current;
      const unchanged = current.colecao.membros.length === info.membros.length &&
        current.colecao.membros.every((id, i) => id === info.membros[i]);
      const commit = e?.type === "pointerup" && unchanged && info.strip.isConnected &&
        pontoNaCaixaExpandida(info.pointer, info.strip.getBoundingClientRect());
      if (!commit) { flipRef.current = snapshot(); info.order = info.originalOrder.slice(); }
      if (commit) current.persist({ ...current.lib, colecoes: current.lib.colecoes.map((c) =>
        c.id === current.colecao.id ? { ...c, membros: info.order.map((i) => info.membros[i]) } : c) });
      suppressClickRef.current = true;
      settlingRef.current = { ...info, started: false };
      setVisual({ ...info, settling: true });
    } else setVisual(null);
    delete info.strip.dataset.dragging;
    dragRef.current = null;
  }

  function mover(e) {
    const info = dragRef.current;
    if (!info || !matches(e, info)) return;
    info.pointer = { x: e.clientX, y: e.clientY };
    if (!info.active) {
      if (Math.hypot(e.clientX - info.start.x, e.clientY - info.start.y) > 10) finalizar(e);
    } else e.preventDefault();
  }

  function pointerDown(e, indice) {
    if (e.isPrimary === false || (e.button != null && e.button !== 0) || dragRef.current || settlingRef.current) return;
    finishSettle();
    // A new press is a new tap candidate; only the click from the drag is eaten.
    suppressClickRef.current = false;
    const el = e.currentTarget, strip = el.closest(".coll-strip");
    if (!strip) return;
    const rect = el.getBoundingClientRect(), cover = el.querySelector(".cover");
    // The ring matches the bar under the strip: the collection's own colour (set by the card), else
    // what the bar falls back to, the band's accent. Resolved now because the ghost lives on <body>.
    if (!el.style.getPropertyValue("--hold-color")) {
      const acento = getComputedStyle(strip).getPropertyValue("--ed-accent").trim();
      if (acento) el.style.setProperty("--hold-color", acento);
    }
    const membros = latest.current.colecao.membros.slice();
    const originalOrder = membros.map((_, i) => i);
    const info = { indice, membros, originalOrder, order: originalOrder.slice(), strip,
      pointerId: e.pointerId, pointer: { x: e.clientX, y: e.clientY },
      start: { x: e.clientX, y: e.clientY }, grabOffset: { x: e.clientX - rect.left, y: e.clientY - rect.top } };
    dragRef.current = info;
    try { el.setPointerCapture(e.pointerId); } catch {}
    if (cover) {
      const r = cover.getBoundingClientRect();
      cover.style.setProperty("--hold-w", r.width + "px");
      cover.style.setProperty("--hold-h", r.height + "px");
      cover.style.setProperty("--hold-cycles", "2.25");
      driveHold(cover, 1, 450, HOLD_EASE_LINEAR);
    }
    info.timer = setTimeout(() => {
      if (!el.isConnected) { abort(); return; }
      info.active = true; suppressClickRef.current = true;
      clearFlips();
      nodes.current.forEach((node) => { node.style.animation = "none"; node.style.opacity = "1"; });
      info.strip.dataset.dragging = "";
      info.scrollContainer = scrollContainer(strip);
      medirSlots(info);
      info.ghost = criarGhost(el, info.grabOffset, prefersReducedMotion());
      info.ghost.follow(info.pointer);
      setVisual({ ...info, settling: false });
      raf.current = requestAnimationFrame(frame);
    }, 450);
  }

  function abort() {
    const info = dragRef.current;
    clearTimeout(info?.timer); cancelAnimationFrame(raf.current);
    cancelAnimationFrame(hold.current.raf);
    hold.current.el?.style.setProperty("--hold-p", "0");
    hold.current = { raf: 0, p: 0, el: null };
    info?.ghost?.remove();
    if (info) {
      delete info.strip.dataset.dragging;
      try { nodes.current.get(info.indice)?.releasePointerCapture(info.pointerId); } catch {}
    }
    settlingRef.current?.ghost.remove();
    settlingRef.current = null; dragRef.current = null;
    flipRef.current = null;
    clearFlips();
  }

  // Live while holding too: a release outside the card must disarm its timer.
  useEffect(() => {
    const end = (e) => finalizar(e), move = (e) => mover(e);
    const touch = (e) => { if (dragRef.current?.active) e.preventDefault(); };
    const resize = () => { if (dragRef.current?.active) medirSlots(dragRef.current); };
    window.addEventListener("pointermove", move, { capture: true, passive: false });
    window.addEventListener("pointerup", end, true);
    window.addEventListener("pointercancel", end, true);
    window.addEventListener("blur", end);
    window.addEventListener("touchmove", touch, { capture: true, passive: false });
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", end, true);
      window.removeEventListener("pointercancel", end, true);
      window.removeEventListener("blur", end);
      window.removeEventListener("touchmove", touch, true);
      window.removeEventListener("resize", resize);
      abort();
    };
  }, []);

  useEffect(() => {
    const info = dragRef.current;
    if (info && (colecao.membros.length !== info.membros.length || colecao.membros.some((id, i) => id !== info.membros[i]))) {
      abort(); setVisual(null);
    }
  }, [colecao.membros]);

  return { visual, registrar, suppressClickRef, pointerDown, mover, finalizar };
}
