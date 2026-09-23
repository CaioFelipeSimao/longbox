import { useEffect, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

import { prefersReducedMotion } from "../lib/hooks";

// The HQs/Coleções/Séries pill: one shared thumb slid under whichever button
// is active, instead of each button painting its own background. A single
// element can carry an elastic gsap tween on tab switches; three independent
// buttons fading their own backgrounds in and out cannot read as one thing
// moving. Click-only, on purpose — the reference this was adapted from can
// also be grabbed and dragged between slots, but that meant reimplementing
// pointer capture, flick velocity and rubber-band clamping for a control that
// never needed anything but a tap.
export function SegmentedTabs({ tabs, tab, onTab }) {
  const trackRef = useRef(null);
  const thumbRef = useRef(null);
  const btnRefs = useRef(new Map());
  const mounted = useRef(false);
  // The two edges gsap actually animates. A plain object, not a DOM node: the
  // clip-path string is repainted from these in onUpdate, so the tween never
  // touches width or left directly, which would put a layout reflow in every
  // frame of every switch. The reflow was one of two separate causes of the
  // jank here; the other, which outlived this change and only showed on the
  // far jumps, is written up at the tween itself below.
  const edgesRef = useRef({ left: 0, right: 0, top: 0, bottom: 0 });
  // The hover pill runs the identical clip-path mechanism on its own element
  // and its own pair of edges, one layer below the active pill, so a hover
  // that lands on the open tab simply disappears under it.
  const ghostRef = useRef(null);
  const ghostEdgesRef = useRef({ left: 0, right: 0, top: 0, bottom: 0 });
  const ghostAtivoRef = useRef(false);
  // Which button the pointer is over, or null. The resize handler reads it
  // too, having no other way to know where to put the hover pill back.
  const hoverRef = useRef(null);
  const larguraRef = useRef(0);

  function registrarBtn(key, el) {
    if (el) btnRefs.current.set(key, el); else btnRefs.current.delete(key);
  }

  function edgesDoBotao(key) {
    const track = trackRef.current;
    const btn = btnRefs.current.get(key);
    if (!track || !btn) return null;
    const t = track.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    return { left: b.left - t.left, right: b.right - t.left, top: b.top - t.top, bottom: b.bottom - t.top };
  }

  function edgesDoAtivo() { return edgesDoBotao(tab); }

  // Top and bottom used to be hardcoded to 0 — "no vertical clip" — so the pill
  // always spanned the track's full height, padding included, rather than the
  // button's own. Horizontally it hugged the button exactly (edges.left/right
  // come straight from the button's own rect), so the two only ever disagreed
  // on the vertical axis: the pill taller than the button by the track's own
  // padding, on both top and bottom. A :focus-visible ring sized to the real
  // button then reads as smaller than the pill and sitting inside it — exactly
  // backwards from the horizontal case this was first mistaken for, where the
  // ring was outline-offset pushing it outside the pill (see the CSS fix
  // above). Reported live 2026-09-20, caught only by testing against the real
  // published artifact, not the local harness: a local shim without the
  // project's own fonts loaded didn't reproduce it.
  function pintarEm(el, edges) {
    const track = trackRef.current;
    if (!el || !track) return;
    // getBoundingClientRect, not clientWidth/clientHeight: edges.* above are
    // themselves measured against the track's getBoundingClientRect (it has a
    // 1px border, so clientWidth/clientHeight — content+padding only — run
    // ~1-2px short of it on every side). Mixing the two metrics is exactly
    // what put the pill a couple of pixels short of the button's real edges,
    // on every side, until this was measured precisely against the live page
    // and caught. Same ruler for both halves of the subtraction now.
    const r = track.getBoundingClientRect();
    el.style.clipPath =
      "inset(" + Math.max(0, edges.top) + "px " + Math.max(0, r.width - edges.right) + "px " +
      Math.max(0, r.height - edges.bottom) + "px " + Math.max(0, edges.left) + "px round var(--r-sm))";
  }

  // v82: the active pill moves by transform only. A clip-path written from
  // JS every frame is a repaint every frame, and on a touch tablet (no cursor
  // lattice, so the tab content is not its own layer) each repaint walked the
  // whole tab: worst on Séries, about 9,000 elements, which is where the
  // stutter showed.
  // v83: two layers that only slide, one clipping the other. The window is as
  // wide as the track, rounded on its right and clipping what it holds, and
  // its right edge sits on the pill's right edge. Inside it the body, rounded
  // on its left, has its left edge on the pill's left edge. What shows is where
  // they overlap: exactly the pill, both ends rounded, nothing scaled. v82 used
  // a 1px middle scaled up instead, and on the user's machine Chrome drew that
  // 1px and then stretched the drawing, smearing its edges into a gap before
  // the right cap (it never showed in headless Chrome).
  const pecasRef = useRef(null);
  const geoRef = useRef({ largura: 0, dx: 0, dy: 0, top: null, alt: null });
  function medirPilula() {
    const el = thumbRef.current, track = trackRef.current;
    if (!el || !track) return;
    const t = track.getBoundingClientRect();
    const p = el.getBoundingClientRect();
    const g = geoRef.current;
    // The track's border widths: the pill element sits inside them.
    g.dx = p.left - t.left;
    g.dy = p.top - t.top;
    const janela = el.firstElementChild;
    const corpo = janela && janela.firstElementChild;
    if (!corpo) return;
    // As wide as the space inside the track, so any pill fits in the overlap.
    g.largura = p.width;
    janela.style.width = p.width + "px";
    corpo.style.width = p.width + "px";
    pecasRef.current = [janela, corpo];
  }
  function pintarClip() {
    const el = thumbRef.current, track = trackRef.current;
    if (!el || !track) return;
    if (!pecasRef.current) medirPilula();
    const g = geoRef.current;
    const e = edgesRef.current;
    const t = track.getBoundingClientRect();
    // The same box the old clip-path cut, to the pixel: its inset was taken
    // from the track's border box but applied inside the border, which leaves
    // the pill 1px inside the button on every side. That is the look the user
    // approved, so it is kept on purpose. Held inside the track, as the old
    // Math.max did.
    const l = Math.max(0, e.left);
    const r = t.width - 2 * g.dx - Math.max(0, t.width - e.right);
    const top = Math.max(0, e.top);
    const alt = Math.max(0, t.height - 2 * g.dy - Math.max(0, t.height - e.bottom) - top);
    // Vertical extent only changes on a resize, so it is written only then.
    if (top !== g.top || alt !== g.alt) {
      g.top = top; g.alt = alt;
      el.style.top = top + "px";
      el.style.height = alt + "px";
    }
    if (!pecasRef.current) return;
    const [janela, corpo] = pecasRef.current;
    const x = r - g.largura;
    janela.style.transform = "translate3d(" + x + "px,0,0)";
    corpo.style.transform = "translate3d(" + (l - x) + "px,0,0)";
  }
  function pintarGhost() { pintarEm(ghostRef.current, ghostEdgesRef.current); }

  // Lays the thumb under the active button with no animation: first paint,
  // and any resize that could leave it sized for a layout that no longer
  // exists (the band going from wide desktop labels to a narrower window).
  function posicionarSemAnimar() {
    const e = edgesDoAtivo();
    if (!e) return;
    medirPilula();
    gsap.killTweensOf(edgesRef.current);
    edgesRef.current.left = e.left;
    edgesRef.current.right = e.right;
    edgesRef.current.top = e.top;
    edgesRef.current.bottom = e.bottom;
    pintarClip();
  }

  useLayoutEffect(() => {
    posicionarSemAnimar();
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === "undefined") return undefined;
    larguraRef.current = track.clientWidth;
    const ro = new ResizeObserver(() => {
      const w = track.clientWidth;
      // Two guards, and the switch this component exists to animate trips
      // both. Opening a tab changes how tall the page is, so the scrollbar
      // appears or goes away, so the band gets re-measured — mid-tween, a
      // few frames after the click. The old handler snapped the pill to its
      // destination right there, killing the tween in flight: the pill set
      // off, stopped dead partway, and turned up already arrived.
      //
      // Same width means nothing about this pill's geometry moved, whatever
      // else on the page did, so there is nothing to correct.
      if (w === larguraRef.current) return;
      larguraRef.current = w;
      // A real width change mid-switch makes the tween's destination stale
      // rather than wrong to be playing: re-aim it, never cut it.
      if (gsap.isTweening(edgesRef.current)) { animarParaAtivo(); return; }
      posicionarSemAnimar();
      if (ghostAtivoRef.current) {
        const g = edgesDoBotao(hoverRef.current);
        if (g) {
          ghostEdgesRef.current.left = g.left; ghostEdgesRef.current.right = g.right;
          ghostEdgesRef.current.top = g.top; ghostEdgesRef.current.bottom = g.bottom;
          pintarGhost();
        }
      }
    });
    ro.observe(track);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs]);

  function animarParaAtivo() {
    const e = edgesDoAtivo();
    if (!e) return;
    if (prefersReducedMotion()) {
      edgesRef.current.left = e.left;
      edgesRef.current.right = e.right;
      edgesRef.current.top = e.top;
      edgesRef.current.bottom = e.bottom;
      pintarClip();
      return;
    }
    // Vertical extent never animates — every button in the row shares the same
    // height, so there is nothing to tween — only left/right travel.
    edgesRef.current.top = e.top;
    edgesRef.current.bottom = e.bottom;
    // Two tweens, not one: the edge leading the move runs ahead on a plain
    // ease-out while the edge behind it lags on the elastic, so the pill
    // stretches toward the tab being opened and its tail snaps up after.
    //
    // Which edge carries the elastic is the whole point, not a detail. On
    // the leading edge its overshoot runs past the destination button and,
    // for the two outer tabs, past the end of the track: measured against
    // this band's real geometry, HQs -> Séries overshot 26px beyond the
    // right wall and pintarClip's Math.max held it pinned there for 8 of
    // the tween's ~31 frames. That pin is what read as the animation
    // freezing mid-flight, and why only the far jumps showed it — the
    // adjacent ones overshoot into a neighbouring button, never a wall.
    // A trailing edge can only ever overshoot into the pill's own span, so
    // it stays inside the track by construction, at any distance.
    const paraDireita = e.left > edgesRef.current.left;
    const lider = paraDireita ? "right" : "left";
    const cauda = paraDireita ? "left" : "right";
    // Killed up front, so both tweens below can run with overwrite off:
    // overwrite: true would have the second one kill the first, they share
    // a target. A click landing mid-bounce still cuts everything short.
    gsap.killTweensOf(edgesRef.current);
    gsap.to(edgesRef.current, {
      [lider]: e[lider], duration: 0.34, ease: "power3.out", overwrite: false,
    });
    // Only this one repaints: it is the longer of the two, and pintarClip
    // reads both edges every time, so one callback per frame covers both.
    gsap.to(edgesRef.current, {
      // Amplitude 0.6, not the 1 this used before it moved off the leading
      // edge: with the bounce living in the trailing edge it shows up as the
      // pill's width wobbling rather than its position, and at full amplitude
      // the far jumps squeezed it to little over half its settled width.
      [cauda]: e[cauda], duration: 0.62, ease: "elastic.out(0.6, 0.65)",
      overwrite: false, onUpdate: pintarClip,
    });
  }

  useEffect(() => {
    // The very first render already landed the thumb via the layout effect
    // above; animating that same placement would play the elastic settle on
    // load, for a "change" nothing actually made.
    if (!mounted.current) { mounted.current = true; return; }
    animarParaAtivo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function entrarNoBotao(key) {
    const g = edgesDoBotao(key);
    if (!g) return;
    hoverRef.current = key;
    const ghost = ghostRef.current;
    if (!ghost) return;
    // Coming from nowhere, the pill has no position worth travelling from:
    // sliding in from wherever it was last left would read as an object
    // flying in from another tab the pointer never touched. It appears in
    // place and fades up; only a move BETWEEN buttons travels.
    if (!ghostAtivoRef.current || prefersReducedMotion()) {
      gsap.killTweensOf(ghostEdgesRef.current);
      ghostEdgesRef.current.left = g.left;
      ghostEdgesRef.current.right = g.right;
      ghostEdgesRef.current.top = g.top;
      ghostEdgesRef.current.bottom = g.bottom;
      pintarGhost();
      ghostAtivoRef.current = true;
      ghost.style.opacity = "1";
      return;
    }
    ghost.style.opacity = "1";
    // Plainly eased and quicker than the active pill's 0.62s: this one is
    // chasing a pointer that can already be somewhere else, so it has to
    // keep up, and a second bouncing pill next to the real one just reads
    // as noise. The travel is the whole signal here, not the settle.
    // Vertical extent is set immediately, not tweened, same reasoning as the
    // active pill: it never actually changes between buttons in this row.
    ghostEdgesRef.current.top = g.top;
    ghostEdgesRef.current.bottom = g.bottom;
    gsap.to(ghostEdgesRef.current, {
      left: g.left, right: g.right, duration: 0.26, ease: "power3.out",
      overwrite: true, onUpdate: pintarGhost,
    });
  }

  function sairDaFaixa() {
    hoverRef.current = null;
    ghostAtivoRef.current = false;
    const ghost = ghostRef.current;
    if (ghost) ghost.style.opacity = "0";
  }

  return (
    <div
      className="segmented ed-segmented"
      ref={trackRef}
      onPointerLeave={sairDaFaixa}
    >
      <span ref={ghostRef} className="seg-ghost" aria-hidden="true" />
      <span ref={thumbRef} className="seg-thumb" aria-hidden="true"><i className="pil-janela"><i className="pil-corpo" /></i></span>
      {tabs.map((t, i) => {
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            ref={(el) => registrarBtn(t.key, el)}
            className="press"
            data-active={tab === t.key ? "true" : "false"}
            data-dica={t.label + " · " + (i + 1)}
            onClick={() => onTab(t.key)}
            // pointerenter, not mouseenter: a stylus hovering the tablet
            // reports as a pointer and should light the same preview.
            onPointerEnter={(ev) => { if (ev.pointerType !== "touch") entrarNoBotao(t.key); }}
          >
            <Icon size={14} /> {t.label}
          </button>
        );
      })}
    </div>
  );
}
