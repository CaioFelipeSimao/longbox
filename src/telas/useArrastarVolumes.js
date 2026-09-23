import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";

import { swatchColors } from "../lib/cores";
import { HOLD_EASE_LINEAR, HOLD_EASE_OUT, prefersReducedMotion } from "../lib/hooks";
import { ordenarGrupoVolumes } from "../ui/VolumeCard";

// Long-press to arm, then drag an HQ within its own personagem group (v30-v49).
// Everything the gesture needs lives here; App only wires the returned handlers
// into the cards and reads dragVisual to draw the live order.
export function useArrastarVolumes(lib, persist) {
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

  return {
    suppressClickRef, dragVisual, editoraCorPorNome, registrarCardNode, volDragPointerDown,
    volDragPointerMove, volDragPointerEnd,
  };
}
