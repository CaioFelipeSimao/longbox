import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";

import { swatchColors } from "../lib/cores";
import { HOLD_EASE_LINEAR, HOLD_EASE_OUT, prefersReducedMotion } from "../lib/hooks";
import { ordenarGrupoVolumes } from "../ui/VolumeCard";
import { slotNoPonto, reordenarParaSlot, pontoNaCaixaExpandida, velocidadeAutoScroll, transformSeguir } from "../lib/arrastoSeguir";

// Below the chrome: .topbar/.tabbar 20, .ed-band 15, HQs filters 12.
// Above static sibling groups and the .aba (0)/content lattice (1) layers.
const DRAG_Z_INDEX = 8;

// Long-press to arm, then drag an HQ within its own personagem group (v30-v49).
// Everything the gesture needs lives here; App only wires the returned handlers
// into the cards and reads dragVisual to draw the live order.
export function useArrastarVolumes(lib, persist, volumesDaFaixa = lib.volumes) {
  // A long press tells a hold apart from a tap or the start of a scroll. Pointer
  // events cover mouse and touch alike, which native HTML5 drag and drop does not
  // on a tablet. 450ms, raised from 350: the user found 350 too easy to trigger
  // by accident while just scrolling or tapping a cover.
  const HOLD_MS = 450;
  // Neighbours glide for 220ms; target decisions never wait for their animation.
  const FLIP_MS = 220;
  const SETTLE_MS = 200;
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
  const flipVersionRef = useRef(new Map()); // invalidates superseded FLIP rAF callbacks
  const followRafRef = useRef(0);
  const settleRef = useRef(null);
  const layersRef = useRef([]);
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

  // getBoundingClientRect includes our translation and lift. Remove them only
  // during the read (no intervening paint), to measure the CURRENT grid slot.
  function rectDoSlot(el) {
    const transition = el.style.transition;
    const transform = el.style.transform;
    el.style.transition = "none";
    el.style.transform = "none";
    const rect = el.getBoundingClientRect();
    el.style.transform = transform;
    el.style.transition = transition;
    return rect;
  }

  function deslocamentoPagina(info) {
    const container = info.scrollContainer;
    const page = container === document.scrollingElement || container === document.documentElement;
    return {
      x: window.scrollX + (page ? 0 : container.scrollLeft),
      y: window.scrollY + (page ? 0 : container.scrollTop),
    };
  }

  function ponteiroNaPagina(info) {
    const offset = deslocamentoPagina(info);
    return { x: info.pointer.x + offset.x, y: info.pointer.y + offset.y };
  }

  // Slots stay fixed throughout reordering. On resize, the current DOM order
  // provides the new geometry by index, regardless of which id occupies it.
  function medirSlots(info) {
    const offset = deslocamentoPagina(info);
    info.slotRects = Array.from(info.grid?.children || []).map((el) => {
      const rect = rectDoSlot(el);
      return { left: rect.left + offset.x, right: rect.right + offset.x,
        top: rect.top + offset.y, bottom: rect.bottom + offset.y };
    });
    const style = info.grid && getComputedStyle(info.grid);
    info.folga = { x: (parseFloat(style?.columnGap) || 0) / 2, y: (parseFloat(style?.rowGap) || 0) / 2 };
  }

  function seguirPonteiro(info) {
    const el = cardNodesRef.current.get(info.id);
    if (!el) return;
    // A preview update can precede React's DOM move. Use the currently rendered
    // slot index until useLayoutEffect rebases it after the keyed node moves.
    const indice = Array.from(el.parentElement.children).indexOf(el);
    const slot = info.slotRects[indice];
    if (!slot) return;
    const { x, y } = transformSeguir(ponteiroNaPagina(info), info.grabOffset, slot);
    el.style.transform = `translate(${x}px, ${y}px) scale(${prefersReducedMotion() ? 1 : 1.06})`;
  }

  function atualizarOrdem(info, ids) {
    if (ids.every((id, i) => id === info.ids[i])) return;
    flipSnapshotRef.current = capturarRects(info.ids);
    info.ids = ids;
    setDragVisual({ id: info.id, ids, personagem: info.personagem });
  }

  function atualizarSlot(info) {
    const dentro = pontoNaCaixaExpandida(info.pointer, info.grid?.getBoundingClientRect());
    if (!dentro) {
      // Leaving the group reverses the preview immediately, even during FLIP.
      atualizarOrdem(info, info.originalIds.slice());
      return;
    }
    const target = slotNoPonto(ponteiroNaPagina(info), info.slotRects, { folga: info.folga });
    // Empty space inside the group keeps the current preview unchanged.
    if (target == null) return;
    atualizarOrdem(info, reordenarParaSlot(info.originalIds, info.id, target));
  }

  function containerDeScroll(el) {
    for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) return parent;
    }
    // HQs currently scrolls the document; sheets have their own scroll bodies.
    return document.scrollingElement || document.documentElement;
  }

  function autoScroll(info) {
    const container = info.scrollContainer;
    const page = container === document.scrollingElement || container === document.documentElement;
    const rect = page ? { top: 0, bottom: window.innerHeight } : container.getBoundingClientRect();
    const top = Math.max(0, rect.top);
    const bottom = Math.min(window.innerHeight, rect.bottom);
    const height = page ? window.innerHeight : container.clientHeight;
    // The floating transform can extend document overflow. Exclude it from the
    // scroll limit, otherwise a card below the page creates endless extra room.
    const el = cardNodesRef.current.get(info.id);
    const transform = el?.style.transform;
    if (el) el.style.transform = "none";
    const maxScroll = Math.max(0, container.scrollHeight - height);
    if (el) el.style.transform = transform;
    const velocidade = velocidadeAutoScroll(info.pointer.y, top, bottom, {
      scrollTop: container.scrollTop, maxScroll,
    });
    // Direct scrollTop is immediate even when the app enables smooth scrolling.
    if (velocidade) container.scrollTop = Math.max(0, Math.min(maxScroll, container.scrollTop + velocidade));
  }

  function frameArrasto() {
    const info = dragRef.current;
    if (!info.active) return;
    autoScroll(info);
    atualizarSlot(info);
    seguirPonteiro(info);
    followRafRef.current = requestAnimationFrame(frameArrasto);
  }

  function elevarCamadas(el, scrollContainer) {
    // Keep the keyed button in its grid: moving it into a portal loses capture.
    // Lift the ancestor stacking contexts too, including .aba and .content's
    // lattice layers. .app's overflow-x:clip otherwise cuts off a horizontal drag.
    for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      const clips = /(hidden|clip|auto|scroll)/.test(style.overflowX + style.overflowY);
      const props = ["position", "z-index"];
      if (clips && parent !== scrollContainer) props.push("overflow-x", "overflow-y");
      const saved = props.map((prop) => [prop, parent.style.getPropertyValue(prop), parent.style.getPropertyPriority(prop)]);
      layersRef.current.push({ el: parent, saved });
      if (style.position === "static") parent.style.setProperty("position", "relative");
      parent.style.setProperty("z-index", String(DRAG_Z_INDEX), "important");
      if (props.includes("overflow-x")) {
        parent.style.setProperty("overflow-x", "visible", "important");
        parent.style.setProperty("overflow-y", "visible", "important");
      }
    }
  }

  function restaurarCamadas() {
    layersRef.current.forEach(({ el, saved }) => saved.forEach(([prop, value, priority]) => {
      if (value) el.style.setProperty(prop, value, priority); else el.style.removeProperty(prop);
    }));
    layersRef.current = [];
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
    flipSnapshotRef.current = null;
    const info = dragRef.current;
    const settling = settleRef.current;
    const draggedId = info.active ? info.id : settling?.id;
    if (before && !prefersReducedMotion()) before.forEach((prevRect, id) => {
      if (id === draggedId) return; // the picked-up card is NEVER part of FLIP
      const el = cardNodesRef.current.get(id);
      if (!el) return;
      clearTimeout(flipCleanupRef.current.get(id));
      const version = {};
      flipVersionRef.current.set(id, version);
      el.style.transition = "none";
      el.style.transform = "";
      const now = el.getBoundingClientRect();
      const dx = prevRect.left - now.left;
      const dy = prevRect.top - now.top;
      if (!dx && !dy) { el.style.transition = ""; el.style.transform = ""; return; }
      el.style.transform = "translate(" + dx + "px," + dy + "px)";
      el.getBoundingClientRect(); // force reflow so the jump above isn't itself animated
      const liberar = () => {
        if (flipVersionRef.current.get(id) !== version) return;
        if (dragRef.current.active && dragRef.current.id === id) return;
        el.style.transition = "transform " + FLIP_MS + "ms var(--ease-in-out, cubic-bezier(0.77, 0, 0.175, 1))";
        el.style.transform = "";
      };
      requestAnimationFrame(liberar);
      flipCleanupRef.current.set(id, setTimeout(liberar, FLIP_MS + 150));
    });
    if (info.active) {
      // React moves the same keyed DOM node. Refresh capture after that move,
      // and rebase its translation before paint so a new slot cannot flash.
      const el = cardNodesRef.current.get(info.id);
      try { el?.setPointerCapture(info.pointerId); } catch {}
      seguirPonteiro(info);
    } else if (settling && !settling.started) {
      settling.started = true;
      const el = cardNodesRef.current.get(settling.id);
      if (!el) { terminarAcomodacao(); return; }
      el.dataset.dragSettling = "true";
      seguirPonteiro(settling);
      el.getBoundingClientRect(); // paint starts from the release point, in its final slot
      el.style.transition = prefersReducedMotion() ? "none" : `transform ${SETTLE_MS}ms var(--ease-out)`;
      el.style.transform = "translate(0px, 0px) scale(1)";
      if (prefersReducedMotion()) terminarAcomodacao();
      else settling.timer = setTimeout(terminarAcomodacao, SETTLE_MS);
    }
  }, [dragVisual]);

  function terminarAcomodacao() {
    const settling = settleRef.current;
    if (!settling) return;
    clearTimeout(settling.timer);
    const el = cardNodesRef.current.get(settling.id);
    if (el) {
      el.style.transition = "";
      el.style.transform = "";
      el.style.transformOrigin = "";
      delete el.dataset.dragSettling;
    }
    settleRef.current = null;
    restaurarCamadas();
    setDragVisual(null);
  }

  // The committed order is exactly the live preview's own ids, not a fresh
  // single move computed against the persisted order: the preview is what the
  // user watched build up over the whole gesture, so it is what should land.
  function persistirOrdemGrupo(ids) {
    // ordem is shared between bands; never persist a projected publisher/character.
    const ordens = new Map(ids.map((id, i) => [id, i]));
    persist({ ...lib, volumes: lib.volumes.map((v) =>
      ordens.has(v.id) ? { ...v, ordem: ordens.get(v.id) } : v) });
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
    if (e.isPrimary === false || (e.button != null && e.button !== 0) || dragRef.current.id) return;
    terminarAcomodacao();
    const info = dragRef.current;
    clearTimeout(info.timer);
    info.id = volume.id;
    info.personagem = personagem;
    info.ids = null;
    info.startX = e.clientX;
    info.startY = e.clientY;
    info.pointer = { x: e.clientX, y: e.clientY };
    info.pointerId = e.pointerId;
    info.active = false;
    const target = e.currentTarget;
    const initialRect = target.getBoundingClientRect();
    info.grabOffset = { x: e.clientX - initialRect.left, y: e.clientY - initialRect.top };
    try { target.setPointerCapture(e.pointerId); } catch {}
    comecarPreenchimento(target);
    info.timer = setTimeout(() => {
      info.timer = null;
      info.active = true;
      suppressClickRef.current = true;
      target.style.touchAction = "none";
      // The fill itself is not touched here on purpose: driveHold's own rAF
      // loop is already most of the way to --hold-p:1 by the time this fires,
      // and it keeps running past this point, through the whole drag, only
      // unwinding in finalizarDrag() when the pointer actually comes up.
      const grupo = volumesDaFaixa.filter((v) => v.personagem === personagem);
      info.ids = ordenarGrupoVolumes(grupo).map((v) => v.id);
      info.originalIds = info.ids.slice();
      info.grid = target.closest("[data-hq-grid]");
      info.scrollContainer = containerDeScroll(target);
      elevarCamadas(target, info.scrollContainer);
      // A forwards-filled entrance animation overrides inline transforms, even
      // after it has finished. Retire it on this group before any FLIP/follow.
      info.ids.forEach((id) => {
        const node = cardNodesRef.current.get(id);
        if (node) { node.style.animation = "none"; node.style.opacity = "1"; }
      });
      clearTimeout(flipCleanupRef.current.get(info.id));
      flipVersionRef.current.delete(info.id);
      target.style.transition = "none";
      target.style.transform = "none";
      target.style.transformOrigin = `${info.grabOffset.x}px ${info.grabOffset.y}px`;
      medirSlots(info);
      setDragVisual({ id: volume.id, ids: info.ids, personagem });
      followRafRef.current = requestAnimationFrame(frameArrasto);
    }, HOLD_MS);
  }

  function volDragPointerMove(e) {
    const info = dragRef.current;
    if (!info.id || (e.pointerId != null && info.pointerId != null && e.pointerId !== info.pointerId)) return;
    info.pointer = { x: e.clientX, y: e.clientY };
    if (!info.active) {
      const dist = Math.hypot(e.clientX - info.startX, e.clientY - info.startY);
      if (dist > 10) finalizarDrag(e);
      return;
    }
    e.preventDefault();
  }

  // Shared by the card's own onPointerUp/onPointerCancel and by the window-level
  // safety net below, so both paths end a drag the exact same way. Guarded by
  // info.id so a second call (both can legitimately fire for one release) is a
  // harmless no-op instead of double-committing.
  function finalizarDrag(e) {
    const info = dragRef.current;
    if (!info.id || (e?.pointerId != null && info.pointerId != null && e.pointerId !== info.pointerId)) return;
    if (e?.type === "pointerup") info.pointer = { x: e.clientX, y: e.clientY };
    clearTimeout(info.timer);
    cancelAnimationFrame(followRafRef.current);
    followRafRef.current = 0;
    const el = cardNodesRef.current.get(info.id);
    soltarPreenchimento(el);
    if (el && el.style) el.style.touchAction = "";
    if (info.active && info.ids) {
      if (e?.type === "pointerup") atualizarSlot(info);
      const commit = e?.type !== "pointercancel" && e?.type !== "blur" &&
        pontoNaCaixaExpandida(info.pointer, info.grid?.getBoundingClientRect());
      const ids = commit ? info.ids : info.originalIds;
      if (commit) persistirOrdemGrupo(ids);
      else flipSnapshotRef.current = capturarRects(info.ids);
      suppressClickRef.current = true;
      settleRef.current = { id: info.id, pointer: info.pointer, grabOffset: info.grabOffset,
        slotRects: info.slotRects, scrollContainer: info.scrollContainer, started: false };
      setDragVisual({ id: info.id, ids, personagem: info.personagem, settling: true });
    } else {
      setDragVisual(null);
    }
    try { el?.releasePointerCapture(info.pointerId); } catch {}
    info.id = null;
    info.active = false;
    info.ids = null;
  }

  function volDragPointerEnd(e) {
    finalizarDrag(e);
  }

  // Safety net: setPointerCapture should keep pointerup routed to the dragged
  // card no matter where the button comes up, but releasing over a spot with no
  // card under it (or the window losing focus mid-drag) has been seen to leave
  // the gesture stuck armed forever, with no further pointer event ever reaching
  // a .vol handler to end it. A window-level listener, live only while a drag is
  // actually armed, guarantees the drag always ends when the button comes up
  // (or focus leaves), regardless of what capture did or didn't do.
  useEffect(() => {
    if (!dragVisual || dragVisual.settling) return undefined;
    const finalizar = (e) => finalizarDrag(e);
    const mover = (e) => volDragPointerMove(e);
    const redimensionar = () => {
      const info = dragRef.current;
      if (!info.active) return;
      medirSlots(info);
      seguirPonteiro(info);
    };
    const bloquearToque = (e) => { if (dragRef.current.active) e.preventDefault(); };
    window.addEventListener("pointermove", mover, { capture: true, passive: false });
    window.addEventListener("touchmove", bloquearToque, { capture: true, passive: false });
    window.addEventListener("pointerup", finalizar, true);
    window.addEventListener("pointercancel", finalizar, true);
    window.addEventListener("blur", finalizar);
    window.addEventListener("resize", redimensionar);
    return () => {
      window.removeEventListener("pointerup", finalizar, true);
      window.removeEventListener("pointercancel", finalizar, true);
      window.removeEventListener("blur", finalizar);
      window.removeEventListener("resize", redimensionar);
      window.removeEventListener("pointermove", mover, true);
      window.removeEventListener("touchmove", bloquearToque, true);
    };
  }, [dragVisual]);

  useEffect(() => () => {
    clearTimeout(dragRef.current.timer);
    clearTimeout(settleRef.current?.timer);
    flipCleanupRef.current.forEach((timer) => clearTimeout(timer));
    flipVersionRef.current.clear();
    cancelAnimationFrame(followRafRef.current);
    cancelAnimationFrame(holdMotionRef.current.raf);
    restaurarCamadas();
  }, []);

  return {
    suppressClickRef, dragVisual, editoraCorPorNome, registrarCardNode, volDragPointerDown,
    volDragPointerMove, volDragPointerEnd,
  };
}
