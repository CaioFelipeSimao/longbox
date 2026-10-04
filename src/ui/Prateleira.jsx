import { useState, useEffect, useLayoutEffect, useRef } from "react";

import { swatchColors } from "../lib/cores";
import { gradeTeclado } from "./VolumeCard";

// The scrollbar under a collection's strip. The native bar is hidden; this one
// is a row of short spines at the logo's rhythm, filling the whole width so a
// small collection does not get a short bar. The spines mean nothing on their
// own: only the lit window over them does, and that is what you drag. The count
// beside it pads to the total's own digit count, so the row does not change
// width when the range crosses from 9 to 10.
export const SHELF_SPINE_H = [20, 24, 18, 26, 22, 19, 25, 21, 23, 17, 26, 20, 24, 22];

export function ShelfBar({ stripRef, total }) {
  const rowRef = useRef(null);
  const trackRef = useRef(null);
  const winRef = useRef(null);
  const innerRef = useRef(null);
  const countRef = useRef(null);
  const grabRef = useRef(null);
  const spanRef = useRef([0, 0]);
  const [ticks, setTicks] = useState(0);
  const digits = String(total).length;
  const fmt = (k) => String(k).padStart(digits, "0");

  useLayoutEffect(() => {
    const strip = stripRef.current;
    const track = trackRef.current;
    if (!strip || !track) return;
    let raf = 0;
    const paint = () => {
      raf = 0;
      // Unrounded: clientWidth rounds, and the lit copy of the spines then spaces
      // itself a fraction of a pixel off the row it sits on.
      const tw = track.getBoundingClientRect().width;
      // 5px spine plus 6px gap, the same step as the mockup the user approved.
      setTicks(Math.max(2, Math.floor((tw + 6) / 11)));
      const max = strip.scrollWidth - strip.clientWidth;
      rowRef.current.hidden = max <= 1;
      if (max <= 1) return;
      const w = Math.max(28, (tw * strip.clientWidth) / strip.scrollWidth);
      const p = Math.min(1, Math.max(0, strip.scrollLeft / max));
      const l = p * (tw - w);
      spanRef.current = [l, l + w];
      winRef.current.style.width = w + "px";
      winRef.current.style.transform = "translateX(" + l + "px)";
      innerRef.current.style.width = tw + "px";
      innerRef.current.style.transform = "translateX(" + -l + "px)";
      track.setAttribute("aria-valuenow", String(Math.round(p * 100)));
      // A cover counts as on screen once at least half of it is.
      const r = strip.getBoundingClientRect();
      let first = -1, last = -1;
      Array.from(strip.children).forEach((el, i) => {
        const c = el.getBoundingClientRect();
        if (Math.min(c.right, r.right) - Math.max(c.left, r.left) >= c.width / 2) {
          if (first < 0) first = i;
          last = i;
        }
      });
      if (first >= 0) countRef.current.textContent = fmt(first + 1) + " a " + fmt(last + 1);
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(paint); };
    paint();
    strip.addEventListener("scroll", queue, { passive: true });
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(queue) : null;
    if (ro) { ro.observe(strip); ro.observe(track); }
    return () => {
      strip.removeEventListener("scroll", queue);
      if (ro) ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [stripRef, total]);

  useEffect(() => {
    // The drag must end even when released outside the track or the window.
    const end = () => {
      if (grabRef.current == null) return;
      grabRef.current = null;
      if (trackRef.current) delete trackRef.current.dataset.drag;
      if (stripRef.current) delete stripRef.current.dataset.dragging;
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", end);
    };
  }, [stripRef]);

  const scrollFor = (left) => {
    const strip = stripRef.current;
    const [a, b] = spanRef.current;
    const room = trackRef.current.getBoundingClientRect().width - (b - a);
    const p = room > 0 ? Math.min(1, Math.max(0, left / room)) : 0;
    return p * (strip.scrollWidth - strip.clientWidth);
  };
  const xOf = (e) => e.clientX - trackRef.current.getBoundingClientRect().left;
  const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const onPointerDown = (e) => {
    const strip = stripRef.current;
    const bx = xOf(e);
    const [a, b] = spanRef.current;
    if (bx >= a && bx <= b) {
      grabRef.current = bx - a;
    } else {
      grabRef.current = (b - a) / 2;
      strip.scrollTo({ left: scrollFor(bx - grabRef.current), behavior: reduced() ? "auto" : "smooth" });
    }
    trackRef.current.setPointerCapture?.(e.pointerId);
    trackRef.current.dataset.drag = "";
    strip.dataset.dragging = "";
  };
  const onPointerMove = (e) => {
    if (grabRef.current == null) return;
    stripRef.current.scrollTo({ left: scrollFor(xOf(e) - grabRef.current), behavior: "auto" });
  };
  const onKeyDown = (e) => {
    const strip = stripRef.current;
    const step = strip.clientWidth * 0.8;
    const behavior = reduced() ? "auto" : "smooth";
    if (e.key === "ArrowRight") { strip.scrollBy({ left: step, behavior }); e.preventDefault(); }
    if (e.key === "ArrowLeft") { strip.scrollBy({ left: -step, behavior }); e.preventDefault(); }
  };

  const spines = Array.from({ length: ticks }, (_, i) => (
    <i key={i} style={{ height: SHELF_SPINE_H[(i * 5 + (i >> 2)) % SHELF_SPINE_H.length] }} />
  ));

  return (
    <div className="shelf-bar" ref={rowRef}>
      <div
        className="shelf-track"
        ref={trackRef}
        role="scrollbar"
        aria-orientation="horizontal"
        aria-label="Posição na coleção"
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
      >
        <div className="shelf-spines">{spines}</div>
        <div className="shelf-window" ref={winRef}>
          <div className="shelf-spines" ref={innerRef}>{spines}</div>
        </div>
      </div>
      <span className="shelf-count"><b ref={countRef} /> de {total}</span>
    </div>
  );
}

// One collection's strip with its bar. Its own component so the strip's ref has
// a stable owner per collection.
export function ShelfStrip({ total, cor, children, onKeyDown }) {
  const stripRef = useRef(null);
  // A collection's own bar colour (v66), from the character palette; without
  // one the lit spines follow the publisher, as before.
  const estilo = cor
    ? { "--shelf-cor": cor.longbox ? "var(--accent)" : swatchColors(cor, 0).edge }
    : undefined;
  return (
    <div className="shelf-wrap" style={estilo}>
      <div className="coll-strip" ref={stripRef} {...gradeTeclado} onKeyDown={(e) => {
        onKeyDown?.(e);
        gradeTeclado.onKeyDown(e);
      }}>{children}</div>
      <ShelfBar stripRef={stripRef} total={total} />
    </div>
  );
}
