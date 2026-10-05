import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HOLD_EASE_LINEAR, HOLD_EASE_OUT, prefersReducedMotion } from "../lib/hooks";
import { criarGhost } from "../lib/arrastoGhost";
import { indiceDeInsercaoVertical, pontoNaCaixaExpandida, pontoNoConteudo,
  reordenarParaSlot, velocidadeAutoScroll } from "../lib/arrastoSeguir";

// A series order belongs to one volume. The other cards retain their relative
// order; only the picked card is inserted between their fixed-height midpoints.
export function useArrastarSeries(volumeId, grupos, enabled, onCommit, onArm) {
  const [visual, setVisual] = useState(null);
  const nodes = useRef(new Map()), blockRef = useRef(null);
  const drag = useRef(null), settling = useRef(null), raf = useRef(0);
  const hold = useRef({ raf: 0, p: 0, el: null });
  const flips = useRef(new Map()), before = useRef(null), listeners = useRef(null);
  const suppress = useRef(false);
  const signature = JSON.stringify(grupos.map((g) => [g.key, g.edicoes.map((e) => e.id)])
    .sort((a, b) => a[0].localeCompare(b[0])));
  const latest = useRef(null);
  latest.current = { volumeId, enabled, signature, keys: grupos.map((g) => g.key), onCommit, onArm };

  function registrar(key, el) {
    if (el) nodes.current.set(key, el); else nodes.current.delete(key);
  }

  // offsetTop/offsetHeight describe layout, even while FLIP transforms paint.
  function layoutTop(el) {
    let y = 0;
    for (let n = el; n; n = n.offsetParent) y += n.offsetTop;
    return y;
  }

  function snapshot() {
    return new Map([...nodes.current].map(([key, el]) => [key, el.getBoundingClientRect()]));
  }

  function clearFlips() {
    flips.current.forEach(({ el, timer, frame }) => {
      clearTimeout(timer); cancelAnimationFrame(frame);
      el.style.transform = ""; el.style.transition = "";
    });
    flips.current.clear();
  }

  function removeListeners() {
    listeners.current?.();
    listeners.current = null;
  }

  function driveHold(el, to, duration, ease) {
    const m = hold.current;
    cancelAnimationFrame(m.raf);
    if (!el || (m.el !== el && to !== 1)) return;
    if (m.el !== el) { m.el?.style.setProperty("--hold-p", "0"); m.p = 0; }
    m.el = el;
    const from = m.p, start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      m.p = from + (to - from) * ease(t);
      el.style.setProperty("--hold-p", m.p.toFixed(4));
      (drag.current?.ghost || settling.current?.ghost)?.node.style.setProperty("--hold-p", m.p.toFixed(4));
      m.raf = t < 1 ? requestAnimationFrame(step) : 0;
    };
    m.raf = requestAnimationFrame(step);
  }

  function updateOrder(info, order) {
    if (order.every((key, i) => key === info.order[i])) return;
    before.current = snapshot();
    info.order = order;
    setVisual({ volumeId: info.volumeId, order });
  }

  function updateSlot(info) {
    if (!pontoNaCaixaExpandida(info.pointer, info.block.getBoundingClientRect())) {
      updateOrder(info, info.original.slice());
      return;
    }
    const others = info.order.filter((key) => key !== info.key);
    const y = pontoNoConteudo(info.pointer, info.body.getBoundingClientRect(), 0, info.body.scrollTop).y;
    const index = indiceDeInsercaoVertical(y, others.map((key) => info.heights.get(key)),
      { topo: info.top, gap: info.gap });
    updateOrder(info, reordenarParaSlot(info.order, info.key, index));
  }

  function frame() {
    const info = drag.current;
    if (!info?.active) return;
    if (!info.el.isConnected || !latest.current.enabled || latest.current.volumeId !== info.volumeId ||
        document.querySelector(".modal")) { abort(); setVisual(null); return; }
    const box = info.body.getBoundingClientRect();
    const maxScroll = Math.max(0, info.body.scrollHeight - info.body.clientHeight);
    const dy = velocidadeAutoScroll(info.pointer.y, Math.max(0, box.top), Math.min(window.innerHeight, box.bottom),
      { scrollTop: info.body.scrollTop, maxScroll });
    if (dy) info.body.scrollTop = Math.max(0, Math.min(maxScroll, info.body.scrollTop + dy));
    updateSlot(info);
    info.ghost.follow(info.pointer);
    raf.current = requestAnimationFrame(frame);
  }

  function finishSettle() {
    settling.current?.ghost.remove();
    settling.current = null;
    clearFlips(); removeListeners();
    setVisual(null);
  }

  useLayoutEffect(() => {
    const previous = before.current;
    before.current = null;
    const info = drag.current || settling.current;
    if (previous && !prefersReducedMotion()) previous.forEach((prev, key) => {
      if (key === info?.key) return;
      const el = nodes.current.get(key);
      if (!el) return;
      const old = flips.current.get(key);
      clearTimeout(old?.timer); cancelAnimationFrame(old?.frame);
      el.style.transition = "none"; el.style.transform = "";
      const now = el.getBoundingClientRect();
      const dy = prev.top - now.top;
      if (!dy) { el.style.transition = ""; return; }
      el.style.transform = `translateY(${dy}px)`;
      el.getBoundingClientRect();
      const entry = { el };
      const release = () => {
        if (flips.current.get(key) !== entry) return;
        el.style.transition = "transform 220ms var(--ease-in-out, cubic-bezier(0.77, 0, 0.175, 1))";
        el.style.transform = "";
      };
      flips.current.set(key, entry);
      entry.frame = requestAnimationFrame(release);
      entry.timer = setTimeout(release, 370);
    });
    if (drag.current?.active) {
      try { info.el.setPointerCapture(info.pointerId); } catch {}
    }
    const s = settling.current;
    if (s && !s.started) {
      s.started = true;
      if (!s.el.isConnected) { finishSettle(); return; }
      s.ghost.settle(s.el.getBoundingClientRect(), finishSettle);
    }
  }, [visual]);

  function matches(e, info) {
    return e?.pointerId == null || info.pointerId == null || e.pointerId === info.pointerId;
  }

  function blockEvent(e) {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
  }

  function end(e) {
    const info = drag.current;
    if (!info || !matches(e, info)) return;
    clearTimeout(info.timer); cancelAnimationFrame(raf.current);
    try { info.el.releasePointerCapture(info.pointerId); } catch {}
    info.el.style.touchAction = info.touchAction;
    driveHold(info.el, 0, 150, HOLD_EASE_OUT);
    if (!info.active) { drag.current = null; removeListeners(); return; }
    if (e?.type === "pointerup") {
      info.pointer = { x: e.clientX, y: e.clientY };
      updateSlot(info);
    }
    if (e?.type !== "blur") blockEvent(e);
    const current = latest.current;
    const commit = e?.type === "pointerup" && current.enabled && current.volumeId === info.volumeId &&
      current.signature === info.signature && info.el.isConnected && !document.querySelector(".modal") &&
      pontoNaCaixaExpandida(info.pointer, info.block.getBoundingClientRect());
    if (!commit) { before.current = snapshot(); info.order = info.original.slice(); }
    drag.current = null;
    settling.current = { ...info, started: false };
    setVisual({ volumeId: info.volumeId, order: info.order });
    if (commit) current.onCommit(info.volumeId, info.order);
  }

  function move(e) {
    const info = drag.current;
    if (!info || !matches(e, info)) return;
    info.pointer = { x: e.clientX, y: e.clientY };
    if (info.active) blockEvent(e);
    else if (Math.hypot(e.clientX - info.start.x, e.clientY - info.start.y) > 10) end(e);
  }

  function addListeners() {
    // Capture blocks both native sheet dismissal and React's sideways swipe.
    // Keep the touch end blocked through settlement: browsers send pointerup
    // before touchend, when drag.current has already been cleared.
    const touch = (e) => {
      if (!drag.current?.active && !settling.current) return;
      blockEvent(e);
      if (e.type === "touchcancel" && drag.current) end(e);
    };
    const resize = () => { abort(); setVisual(null); };
    window.addEventListener("pointermove", move, { capture: true, passive: false });
    window.addEventListener("pointerup", end, true);
    window.addEventListener("pointercancel", end, true);
    window.addEventListener("blur", end);
    window.addEventListener("resize", resize);
    for (const type of ["touchmove", "touchend", "touchcancel"]) window.addEventListener(type, touch, { capture: true, passive: false });
    listeners.current = () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", end, true);
      window.removeEventListener("pointercancel", end, true);
      window.removeEventListener("blur", end);
      window.removeEventListener("resize", resize);
      for (const type of ["touchmove", "touchend", "touchcancel"]) window.removeEventListener(type, touch, true);
    };
  }

  function pointerDown(e, key) {
    if (e.target.closest("button, a, input, select, textarea, [role=button]")) {
      suppress.current = false;
      return;
    }
    if (!latest.current.enabled || e.isPrimary === false || (e.button != null && e.button !== 0) ||
        drag.current || settling.current) return;
    suppress.current = false;
    const el = e.currentTarget, block = blockRef.current, body = el.closest(".sheet-body");
    if (!block || !body) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--hold-w", rect.width + "px");
    el.style.setProperty("--hold-h", rect.height + "px");
    el.style.setProperty("--hold-cycles", "2.25");
    const info = { key, el, block, body, volumeId: latest.current.volumeId, signature: latest.current.signature,
      original: latest.current.keys.slice(), order: latest.current.keys.slice(), pointerId: e.pointerId,
      touchAction: el.style.touchAction,
      start: { x: e.clientX, y: e.clientY }, pointer: { x: e.clientX, y: e.clientY },
      grabOffset: { x: e.clientX - rect.left, y: e.clientY - rect.top } };
    drag.current = info;
    addListeners();
    driveHold(el, 1, 450, HOLD_EASE_LINEAR);
    info.timer = setTimeout(() => {
      if (!el.isConnected || !latest.current.enabled || latest.current.volumeId !== info.volumeId ||
          document.querySelector(".modal")) { abort(); return; }
      clearFlips();
      info.heights = new Map(info.order.map((id) => [id, nodes.current.get(id).offsetHeight]));
      const first = nodes.current.get(info.order[0]), second = nodes.current.get(info.order[1]);
      info.top = layoutTop(first) - layoutTop(body);
      info.gap = second ? Math.max(0, layoutTop(second) - layoutTop(first) - first.offsetHeight) : 0;
      info.active = true; suppress.current = true;
      el.style.touchAction = "none";
      latest.current.onArm();
      // Reset a sheet pull that may have started within the pre-arm 10px slack.
      el.closest(".sheet")?.dispatchEvent(new Event("longbox:reorder-start"));
      try { el.setPointerCapture(info.pointerId); } catch {}
      // Sheet chrome is 41+, while the collection ghost keeps its default 14.
      info.ghost = criarGhost(el, info.grabOffset, prefersReducedMotion(), { zIndex: 90 });
      info.ghost.follow(info.pointer);
      setVisual({ volumeId: info.volumeId, order: info.order });
      raf.current = requestAnimationFrame(frame);
    }, 450);
  }

  function abort() {
    const info = drag.current;
    clearTimeout(info?.timer); cancelAnimationFrame(raf.current);
    cancelAnimationFrame(hold.current.raf);
    hold.current.el?.style.setProperty("--hold-p", "0");
    hold.current = { raf: 0, p: 0, el: null };
    try { info?.el.releasePointerCapture(info.pointerId); } catch {}
    if (info) info.el.style.touchAction = info.touchAction;
    info?.ghost?.remove(); settling.current?.ghost.remove();
    drag.current = null; settling.current = null; before.current = null;
    clearFlips(); removeListeners();
  }

  // VolumeSheet stays mounted during close and arrow navigation. Abort before
  // paint, also when a stacked sheet makes this sheet inert or its links change.
  useLayoutEffect(() => { abort(); setVisual(null); }, [volumeId, enabled, signature]);
  useEffect(() => () => abort(), []);

  function clickCapture(e) {
    if (!suppress.current || e.detail === 0) return;
    suppress.current = false;
    e.preventDefault(); e.stopPropagation();
  }

  const order = visual && visual.volumeId === volumeId ? visual.order : latest.current.keys;
  const byKey = new Map(grupos.map((g) => [g.key, g]));
  return { grupos: order.map((key) => byKey.get(key)).filter(Boolean), blockRef, registrar, pointerDown, clickCapture };
}
