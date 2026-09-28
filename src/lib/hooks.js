import { useState, useEffect, useRef, useCallback } from "react";

export function useTransitionMount(open, exitMs) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let raf1, raf2, timer;
    if (open) {
      setMounted(true);
      raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setShown(true)); });
    } else {
      setShown(false);
      timer = setTimeout(() => setMounted(false), exitMs);
    }
    return () => {
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      if (timer) clearTimeout(timer);
    };
  }, [open, exitMs]);
  return [mounted, shown];
}

export const UNLOCK_COMMIT_PX = 120;
export const UNLOCK_FLICK_V = 0.35; // px per ms
export const UNLOCK_FLICK_MIN_PX = 40; // a flick has to travel at least this far

// The lattice follows a cursor, and a finger is not one. On touch the only thing
// it could do is drag a lit trail around while the page scrolls, repainting a
// canvas through the whole gesture on the device least able to spare it, and fire
// a ring on every tap that opens a sheet. So it is not mounted there at all.
// Read live rather than once: a tablet with a mouse plugged in should get it.
// 100vw includes the vertical scrollbar and the visible area does not, so a layer
// bled to 100vw overhangs by exactly the scrollbar's width and the page grows a
// horizontal scrollbar. CSS cannot measure that gap, so it is published here as
// --sbw for the bled layers to subtract.
//
// Measured in a browser rather than assumed: the scrollbar appears when the
// library finishes loading and the page outgrows the window, and that transition
// fires no resize event, and no ResizeObserver either, on the root or on the
// body. What it does do is render. So the measurement runs after every render,
// which costs two property reads and writes only when the number moved.
export function useLarguraDaBarra() {
  const ultimo = useRef(null);
  const medir = useCallback(() => {
    if (typeof window === "undefined") return;
    const raiz = document.documentElement;
    const vao = Math.max(0, window.innerWidth - raiz.clientWidth);
    if (ultimo.current === vao) return;
    ultimo.current = vao;
    raiz.style.setProperty("--sbw", vao + "px");
  }, []);

  useEffect(medir);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [medir]);
}

export function usePonteiroFino() {
  const [fino, setFino] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const ler = () => setFino(mq.matches);
    ler();
    mq.addEventListener("change", ler);
    return () => mq.removeEventListener("change", ler);
  }, []);
  return fino;
}

// v129: the phone layout (the search moves into the floating tab bar).
export function useCelular() {
  const q = "(max-width: 767px)";
  const [sim, setSim] = useState(() => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(q).matches);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia(q);
    const ler = () => setSim(mq.matches);
    ler();
    mq.addEventListener("change", ler);
    return () => mq.removeEventListener("change", ler);
  }, []);
  return sim;
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const HOLD_EASE_LINEAR = (t) => t;
export const HOLD_EASE_OUT = (t) => 1 - Math.pow(1 - t, 3);

// Phone-unlock gesture: past the end of the hub, the cover tracks the finger 1:1
// and is thrown clear on release. The hub is a layer over the app with its own
// scroll (v126), so "at the end" is read from that layer, and lifting it reveals
// the tab underneath. Transforms are written straight to the node, so nothing
// re-renders per frame.
//
// v126: a gesture only unlocks when it STARTS at the end, like a lock screen:
// scroll to the end, let go, swipe again. Before, a swipe that scrolled into the
// end switched to tracking mid-way and its scrolling speed counted as a flick, so
// an ordinary swipe on the iPhone threw the hub away before you had read it. A
// flick also needs some real travel now, not just speed.
export function useHubUnlock(active, elRef, onEnter) {
  useEffect(() => {
    if (!active) return;
    const el = elRef.current;
    if (!el) return;

    const reduce = prefersReducedMotion();
    const noFim = () => el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    let offset = 0;
    let tracking = false;
    let comecouNoFim = false;
    let startY = 0;
    let amostras = []; // the finger's last ~100ms, for its speed at release
    let velocity = 0;
    let committed = false;
    let armed = false;
    let wheelIdle = null;
    let ultimaRoda = 0;
    let rodaNoFim = false;
    let fimDesde = 0; // when this spin first found the scroller at its end
    const armTimer = setTimeout(() => { armed = true; }, 350);

    const paint = (v) => {
      offset = v;
      el.style.transform = v <= 0 ? "" : "translateY(" + -v + "px)";
    };

    // v126: a throw carries on at the finger's speed. The curve starts at twice its
    // average speed, so a duration of 2 x distance / speed begins exactly as fast as
    // the finger was going, then settles; before, a strong swipe met a fixed 280ms
    // curve and visibly changed speed at the hand-off. The layer keeps its
    // will-change through the throw, and the tab only takes over once the cover is
    // gone: swapping mid-throw put React's unmount of the hub inside the animation.
    const commit = (vel = 0) => {
      if (committed) return;
      committed = true;
      if (reduce) {
        el.style.transition = "opacity 150ms var(--ease-out)";
        el.style.opacity = "0";
        setTimeout(onEnter, 130);
        return;
      }
      let dur = 280;
      let curva = "var(--ease-drawer)";
      if (vel > UNLOCK_FLICK_V) {
        dur = Math.round(Math.min(360, Math.max(180, (2 * (el.clientHeight - offset)) / vel)));
        curva = "cubic-bezier(0.25, 0.5, 0.3, 1)";
      }
      el.style.willChange = "transform";
      el.style.transition = "transform " + dur + "ms " + curva;
      el.style.transform = "translateY(-100%)";
      let feito = false;
      const fim = () => {
        if (feito) return;
        feito = true;
        onEnter();
      };
      el.addEventListener("transitionend", fim, { once: true });
      setTimeout(fim, dur + 40);
    };

    const velocidadeAgora = () => {
      const agora = Date.now();
      const ult = amostras[amostras.length - 1];
      if (!ult || agora - ult.t > 100) return 0; // the finger stopped before letting go
      const pri = amostras.find((a) => ult.t - a.t <= 100) || ult;
      return ult.t > pri.t ? (pri.y - ult.y) / (ult.t - pri.t) : 0;
    };

    const release = () => {
      if (tracking) velocity = velocidadeAgora();
      tracking = false;
      comecouNoFim = false;
      if (committed) return;
      if (offset >= UNLOCK_COMMIT_PX || (velocity > UNLOCK_FLICK_V && offset >= UNLOCK_FLICK_MIN_PX)) { commit(velocity); return; }
      if (offset === 0) return;
      el.style.transition = "transform 220ms var(--ease-drawer)";
      paint(0);
      setTimeout(() => {
        if (committed) return;
        el.style.transition = "";
        el.style.willChange = "";
      }, 240);
    };

    const onTouchStart = (e) => {
      if (!armed || committed || e.touches.length > 1) return;
      amostras = [{ y: e.touches[0].clientY, t: Date.now() }];
      velocity = 0;
      tracking = false;
      comecouNoFim = noFim();
    };

    const onTouchMove = (e) => {
      if (!armed || committed || !comecouNoFim || e.touches.length > 1) return;
      const y = e.touches[0].clientY;
      const now = Date.now();
      amostras.push({ y, t: now });
      while (amostras.length > 2 && now - amostras[0].t > 150) amostras.shift();
      if (!tracking) {
        tracking = true;
        startY = y;
        el.style.transition = "";
        el.style.willChange = "transform";
      }
      // Pulling back down scrolls the hub as usual; the cover never moves down.
      const v = startY - y;
      if (reduce) {
        if (v > UNLOCK_COMMIT_PX) commit();
        return;
      }
      paint(Math.max(0, v));
    };

    const onWheel = (e) => {
      if (!armed || committed) return;
      // A wheel has no finger-down, so a pause between turns stands in for one:
      // the turn that scrolls into the end cannot also lift the cover. v137: but a
      // spin that keeps pushing against the end for 400ms means it, pause or not.
      const now = Date.now();
      const fim = noFim();
      if (now - ultimaRoda > 250) rodaNoFim = fim;
      fimDesde = fim ? fimDesde || now : 0;
      if (fimDesde && now - fimDesde > 400) rodaNoFim = true;
      ultimaRoda = now;
      if (!rodaNoFim) return;
      if (e.deltaY <= 0 && offset <= 0) return;
      if (reduce) {
        if (e.deltaY > 0) { offset += e.deltaY; if (offset > UNLOCK_COMMIT_PX) commit(); }
        return;
      }
      el.style.transition = "";
      el.style.willChange = "transform";
      paint(Math.max(0, offset + e.deltaY));
      if (offset >= UNLOCK_COMMIT_PX) { commit(); return; }
      // A wheel has no finger-up, so idleness stands in for release. v137: 450ms,
      // not 160: notches turned slowly sprang back between turns and never added up.
      if (wheelIdle) clearTimeout(wheelIdle);
      wheelIdle = setTimeout(() => { velocity = 0; release(); }, 450);
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", release, { passive: true });
    window.addEventListener("touchcancel", release, { passive: true });
    return () => {
      clearTimeout(armTimer);
      if (wheelIdle) clearTimeout(wheelIdle);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", release);
      window.removeEventListener("touchcancel", release);
    };
  }, [active, elRef, onEnter]);
}

// Pasting an image beats the save-to-disk-then-pick dance: copy the cover on a
// store page, press Ctrl+V here. Only fires on an image in the clipboard, so
// pasting text into the form's fields is untouched.
export function usePasteImage(active, onImage) {
  useEffect(() => {
    if (!active) return;
    const onPaste = (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === "file" && it.type && it.type.indexOf("image/") === 0) {
          const file = it.getAsFile();
          if (file) { e.preventDefault(); onImage(file); return; }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [active, onImage]);
}

export function useEscape(active, onClose) {
  useEffect(() => {
    if (!active) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [active, onClose]);
}
