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
export const UNLOCK_FADE_OVER = 420; // px of travel over which the hub fades out

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

export function prefersReducedMotion() {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const HOLD_EASE_LINEAR = (t) => t;
export const HOLD_EASE_OUT = (t) => 1 - Math.pow(1 - t, 3);

// Phone-unlock gesture: past the end of the hub, the surface tracks the finger
// 1:1 and is thrown clear on release. Gated on a bottom sentinel so a hub taller
// than the viewport stays readable. Transforms are written straight to the node,
// so nothing re-renders per frame.
export function useHubUnlock(active, atBottomRef, elRef, onEnter) {
  useEffect(() => {
    if (!active) return;
    const el = elRef.current;
    if (!el) return;

    const reduce = prefersReducedMotion();
    let offset = 0;
    let tracking = false;
    let startY = 0;
    let startOffset = 0;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0;
    let committed = false;
    let armed = false;
    let wheelIdle = null;
    const armTimer = setTimeout(() => { armed = true; }, 350);

    const paint = (v) => {
      offset = v;
      if (v <= 0) {
        el.style.transform = "";
        el.style.opacity = "";
      } else {
        el.style.transform = "translateY(" + -v + "px)";
        el.style.opacity = String(Math.max(0, 1 - v / UNLOCK_FADE_OVER));
      }
    };

    const commit = () => {
      if (committed) return;
      committed = true;
      el.style.willChange = "";
      if (reduce) {
        el.style.transition = "opacity 150ms var(--ease-out)";
        el.style.opacity = "0";
        setTimeout(onEnter, 130);
        return;
      }
      el.style.transition = "transform 260ms var(--ease-drawer), opacity 200ms var(--ease-out)";
      el.style.transform = "translateY(-100%)";
      el.style.opacity = "0";
      setTimeout(onEnter, 230);
    };

    // Friction rather than a wall: pulling the wrong way resists instead of refusing.
    const damp = (v) => (v < 0 ? v * 0.25 : v);

    const release = () => {
      tracking = false;
      if (committed) return;
      if (offset >= UNLOCK_COMMIT_PX || velocity > UNLOCK_FLICK_V) { commit(); return; }
      if (offset === 0) return;
      el.style.transition = "transform 220ms var(--ease-drawer), opacity 180ms var(--ease-out)";
      paint(0);
      setTimeout(() => {
        if (committed) return;
        el.style.transition = "";
        el.style.willChange = "";
      }, 240);
    };

    const onTouchStart = (e) => {
      if (!armed || committed || e.touches.length > 1) return;
      lastY = e.touches[0].clientY;
      lastT = Date.now();
      velocity = 0;
      tracking = false;
    };

    const onTouchMove = (e) => {
      if (!armed || committed || e.touches.length > 1) return;
      const y = e.touches[0].clientY;
      const now = Date.now();
      const dt = Math.max(1, now - lastT);
      velocity = (lastY - y) / dt;
      lastY = y;
      lastT = now;

      if (!atBottomRef.current) {
        if (offset > 0) release();
        tracking = false;
        return;
      }
      if (!tracking) {
        // Start from wherever the finger is now, so reaching the bottom mid-swipe
        // does not make the surface jump.
        tracking = true;
        startY = y;
        startOffset = offset;
        el.style.transition = "";
        el.style.willChange = "transform, opacity";
      }
      if (reduce) {
        if (startY - y > UNLOCK_COMMIT_PX) commit();
        return;
      }
      paint(damp(startOffset + (startY - y)));
    };

    const onWheel = (e) => {
      if (!armed || committed) return;
      if (!atBottomRef.current) { if (offset > 0) release(); return; }
      if (e.deltaY <= 0 && offset <= 0) return;
      if (reduce) {
        if (e.deltaY > 0) { startOffset += e.deltaY; if (startOffset > UNLOCK_COMMIT_PX) commit(); }
        return;
      }
      el.style.transition = "";
      el.style.willChange = "transform, opacity";
      paint(Math.max(0, offset + e.deltaY));
      if (offset >= UNLOCK_COMMIT_PX) { commit(); return; }
      // A wheel has no finger-up, so idleness stands in for release.
      if (wheelIdle) clearTimeout(wheelIdle);
      wheelIdle = setTimeout(() => { velocity = 0; release(); }, 160);
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
  }, [active, atBottomRef, elRef, onEnter]);
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
