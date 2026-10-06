import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../lib/hooks";
import { criarGhost } from "../lib/arrastoGhost";
import { pontoNaCaixaExpandida, pontoNoConteudo, rectNoConteudo, reordenarParaSlot,
  slotNoPonto, velocidadeAutoScroll, lerLimitesDeRolagemDaPagina } from "../lib/arrastoSeguir";

const HOLD_MS = 450;
const FLIP_MS = 260;
// The wish-list screen uses the hub's overlay layer (35), below sheets/modals.
const GHOST_Z_INDEX = 36;
const iguais = (a, b) => a.length === b.length && a.every((id, i) => id === b[i]);

// The caller collapses and renders visual.ids. Measure only after that render;
// the body ghost follows independently of the list's scrolling and keyed moves.
export function useArrastarColecoesDesejo(lib, persist, ids) {
  const [recolhido, setRecolhido] = useState(false);
  const [visual, setVisual] = useState(null); // { id, ids }
  const nodes = useRef(new Map()), drag = useRef(null), raf = useRef(0);
  const flips = useRef(new Map()), beforeFlip = useRef(null);
  const suppressClickRef = useRef(false);
  const latest = useRef({ lib, persist, ids });
  latest.current = { lib, persist, ids };

  // Installed on each row from mount, before iOS starts a touch. Before arming,
  // the same row remains a normal native scroll surface.
  const blockTouch = useRef((e) => { if (drag.current?.active) e.preventDefault(); });
  function registrar(id, el) {
    const previous = nodes.current.get(id);
    if (previous === el) return;
    previous?.removeEventListener("touchmove", blockTouch.current);
    if (el) {
      nodes.current.set(id, el);
      el.addEventListener("touchmove", blockTouch.current, { passive: false });
    } else nodes.current.delete(id);
  }

  function clearFlips() {
    flips.current.forEach(({ el, timer, frame, transform, transition }) => {
      clearTimeout(timer); cancelAnimationFrame(frame);
      el.style.transform = transform; el.style.transition = transition;
    });
    flips.current.clear(); beforeFlip.current = null;
  }

  function limpar() {
    const info = drag.current;
    drag.current = null;
    clearTimeout(info?.timer); cancelAnimationFrame(raf.current); raf.current = 0;
    info?.ghost?.remove();
    info?.el.classList.remove("desejo-colecao-hole");
    try { info?.target.releasePointerCapture(info.pointerId); } catch {}
    // Keyed rows may have moved since the press started.
    try { info?.el.releasePointerCapture(info.pointerId); } catch {}
    clearFlips();
  }

  function cancelar() {
    limpar(); setVisual(null); setRecolhido(false);
  }

  function containerDeScroll(el) {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(p).overflowY) && p.scrollHeight > p.clientHeight) return p;
    }
    return document.scrollingElement || document.documentElement;
  }

  function caixaContainer(info) {
    return info.page ? { left: 0, top: 0 } : info.container.getBoundingClientRect();
  }

  function pontoConteudo(info) {
    return pontoNoConteudo(info.pointer, caixaContainer(info), info.container.scrollLeft, info.container.scrollTop);
  }

  function medirSlots(info) {
    const box = caixaContainer(info);
    // Transforms are never geometry inputs. Slot rects remain fixed until a
    // resize explicitly refreshes them in the currently rendered slot order.
    const els = info.ids.map((id) => nodes.current.get(id));
    const saved = els.map((el) => ({ transform: el.style.transform, transition: el.style.transition }));
    els.forEach((el) => { el.style.transition = "none"; el.style.transform = "none"; });
    info.slots = els.map((el) => rectNoConteudo(el.getBoundingClientRect(), box, info.container.scrollLeft, info.container.scrollTop));
    els.forEach((el, i) => { el.style.transform = saved[i].transform; el.style.transition = saved[i].transition; });
    info.folga = (parseFloat(getComputedStyle(info.list).rowGap) || 0) / 2;
  }

  function atualizarSlot(info) {
    const dentro = pontoNaCaixaExpandida(info.pointer, info.list.getBoundingClientRect());
    const slot = dentro ? slotNoPonto(pontoConteudo(info), info.slots, { folga: { x: 0, y: info.folga } }) : null;
    const order = !dentro ? info.originalIds.slice() : slot == null ? info.ids : reordenarParaSlot(info.originalIds, info.id, slot);
    if (iguais(order, info.ids)) return;
    beforeFlip.current = new Map(info.ids.map((id) => [id, nodes.current.get(id)?.getBoundingClientRect()]));
    info.ids = order;
    setVisual({ id: info.id, ids: order });
  }

  function autoScroll(info) {
    const box = info.page ? lerLimitesDeRolagemDaPagina() : info.container.getBoundingClientRect();
    const maxScroll = Math.max(0, info.container.scrollHeight - (info.page ? window.innerHeight : info.container.clientHeight));
    const dy = velocidadeAutoScroll(info.pointer.y, Math.max(0, box.top), Math.min(window.innerHeight, box.bottom),
      { scrollTop: info.container.scrollTop, maxScroll });
    if (dy) info.container.scrollTop = Math.max(0, Math.min(maxScroll, info.container.scrollTop + dy));
  }

  function valido(info) {
    const current = latest.current;
    return info.el.isConnected && info.list.isConnected && iguais(current.ids, info.originalIds) &&
      info.originalIds.every((id) => nodes.current.get(id)?.isConnected && current.lib.desejosColecoes.some((c) => c.id === id));
  }

  function frame() {
    const info = drag.current;
    if (!info?.active || !info.ghost) return;
    if (!valido(info)) { cancelar(); return; }
    autoScroll(info); atualizarSlot(info); info.ghost.follow(info.pointer);
    raf.current = requestAnimationFrame(frame);
  }

  useLayoutEffect(() => {
    const info = drag.current;
    if (!info?.active) return;
    if (!valido(info)) { cancelar(); return; }
    if (!info.ghost) {
      info.container = containerDeScroll(info.el);
      info.page = info.container === document.scrollingElement || info.container === document.documentElement;
      medirSlots(info);
      // reduced=true fixes scale at 1 in the shared ghost, in both motion modes.
      info.ghost = criarGhost(info.el, info.grabOffset, true, { zIndex: GHOST_Z_INDEX });
      info.ghost.node.classList.add("desejo-colecao-ghost");
      info.el.classList.add("desejo-colecao-hole");
      info.ghost.follow(info.pointer);
      raf.current = requestAnimationFrame(frame);
    }
    const before = beforeFlip.current; beforeFlip.current = null;
    if (before && !prefersReducedMotion()) {
      const cards = [];
      before.forEach((prev, id) => {
        if (!prev || id === info.id) return;
        const el = nodes.current.get(id), old = flips.current.get(id);
        clearTimeout(old?.timer); cancelAnimationFrame(old?.frame);
        const entry = { el, transform: old?.transform ?? el.style.transform, transition: old?.transition ?? el.style.transition };
        el.style.transition = "none"; el.style.transform = entry.transform;
        cards.push({ id, prev, entry });
      });
      cards.forEach((card) => { card.now = card.entry.el.getBoundingClientRect(); });
      cards.forEach(({ id, prev, now, entry }) => {
        const dx = prev.left - now.left, dy = prev.top - now.top;
        const el = entry.el;
        if (!dx && !dy) {
          el.style.transition = entry.transition; flips.current.delete(id); return;
        }
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        flips.current.set(id, entry);
      });
      info.list.getBoundingClientRect(); // One batched reflow for all inversions.
      cards.forEach(({ id, entry }) => {
        if (flips.current.get(id) !== entry) return;
        const release = () => {
          if (flips.current.get(id) !== entry) return;
          entry.el.style.transition = `transform ${FLIP_MS}ms var(--ease-out)`;
          entry.el.style.transform = entry.transform;
        };
        entry.frame = requestAnimationFrame(release);
        entry.timer = setTimeout(() => {
          if (flips.current.get(id) !== entry) return;
          cancelAnimationFrame(entry.frame);
          entry.el.style.transform = entry.transform; entry.el.style.transition = entry.transition;
          flips.current.delete(id);
        }, FLIP_MS + 150);
      });
    }
    try { info.el.setPointerCapture(info.pointerId); } catch {}
  }, [recolhido, visual]);

  function matches(e, info) {
    return e?.pointerId == null || info.pointerId == null || e.pointerId === info.pointerId;
  }

  function finalizar(e) {
    const info = drag.current;
    if (!info || !matches(e, info)) return;
    let next = null;
    if (info.active && info.ghost && e?.type === "pointerup" && valido(info)) {
      info.pointer = { x: e.clientX, y: e.clientY };
      atualizarSlot(info);
      if (pontoNaCaixaExpandida(info.pointer, info.list.getBoundingClientRect())) {
        const ordens = new Map(info.ids.map((id, i) => [id, i]));
        const current = latest.current;
        next = { ...current.lib, desejosColecoes: current.lib.desejosColecoes.map((c) =>
          ordens.has(c.id) ? { ...c, ordem: ordens.get(c.id) } : c) };
      }
    }
    // Clean before invoking persistence, even if it throws or unmounts us.
    cancelar();
    if (next) latest.current.persist(next);
  }

  function mover(e) {
    const info = drag.current;
    if (!info || !matches(e, info)) return;
    info.pointer = { x: e.clientX, y: e.clientY };
    if (info.active) e.preventDefault();
    else if (Math.hypot(e.clientX - info.start.x, e.clientY - info.start.y) > 10) cancelar();
  }

  function pointerDown(e, id) {
    if (e.isPrimary === false || (e.button != null && e.button !== 0) || drag.current) return;
    const el = nodes.current.get(id);
    if (!el || !latest.current.ids.includes(id)) return;
    suppressClickRef.current = false;
    const rect = el.getBoundingClientRect();
    const originalIds = latest.current.ids.slice();
    const info = { id, el, target: e.currentTarget, list: el.parentElement, originalIds, ids: originalIds.slice(),
      pointerId: e.pointerId, pointer: { x: e.clientX, y: e.clientY }, start: { x: e.clientX, y: e.clientY },
      grabOffset: { x: e.clientX - rect.left, y: e.clientY - rect.top }, active: false };
    drag.current = info;
    try { info.target.setPointerCapture(info.pointerId); } catch {}
    info.timer = setTimeout(() => {
      if (drag.current !== info) return;
      if (!valido(info)) { cancelar(); return; }
      info.active = true; suppressClickRef.current = true;
      setRecolhido(true);
      setVisual({ id, ids: info.ids });
    }, HOLD_MS);
  }

  useEffect(() => {
    const move = (e) => mover(e), end = (e) => finalizar(e);
    const resize = () => {
      const info = drag.current;
      if (!info?.ghost) return;
      if (!valido(info)) { cancelar(); return; }
      medirSlots(info);
    };
    window.addEventListener("pointermove", move, { capture: true, passive: false });
    window.addEventListener("pointerup", end, true);
    window.addEventListener("pointercancel", end, true);
    window.addEventListener("blur", end);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", end, true);
      window.removeEventListener("pointercancel", end, true);
      window.removeEventListener("blur", end);
      window.removeEventListener("resize", resize);
      limpar();
      nodes.current.forEach((el) => el.removeEventListener("touchmove", blockTouch.current));
    };
  }, []);

  useLayoutEffect(() => {
    if (drag.current && !valido(drag.current)) cancelar();
  }, [ids, lib.desejosColecoes]);

  return { recolhido, visual, registrar, pointerDown, mover, finalizar, suppressClickRef };
}
