// GridMotion, from React Bits (reactbits.dev/r/GridMotion-JS-CSS.json), adapted:
// classes carry a gm- prefix so they cannot collide with the app's own .row and
// .intro, the stylesheet lives in src/styles.css like every other rule here, and
// a tile is sized by its own picture rather than the other way round, and an
// item counts as an image when it is a URL or an app-relative path, because
// covers arrive as "/_blob/<assetId>" and the upstream http check would have
// printed that path as text. A data URI counts too, so the grid can be driven
// from inlined art without a store behind it. The motion is upstream's; only its
// per-frame work is skipped while the pointer is still (v126).
//
// v181, the conveyor (upstream's newer version drifts on its own; only that idea
// was taken): each row holds its covers twice, back to back, inside a track that
// slides forever. When it has travelled one copy it jumps back by exactly that
// distance, and since the copy is identical the frame before and after the jump
// are the same pixels. The distance is measured on screen (fractional, so no
// rounding tick at the jump) and re-measured whenever a track changes size, as a
// tile is as wide as its own cover and can grow when the art arrives.
import { useEffect, useRef } from "react";
import { gsap } from "gsap";

// px per second; each row runs a little faster or slower so they never move as one.
const ESTEIRA_VELOCIDADE = 24;
const ESTEIRA_RITMO = [1, 0.86, 1.12, 0.94, 1.06, 0.9];

// Where a track sits after travelling `andou` px along a loop of `periodo` px:
// always within half a copy of centre, so the copy covers either side.
export function posicaoEsteira(andou, periodo) {
  if (!(periodo > 0)) return 0;
  return ((andou % periodo) + periodo) % periodo - periodo / 2;
}

// blob: added in v86: the shelf thumbnails (v85) are blob URLs, and without it
// every tile printed its URL as text instead of the cover.
function isImage(content) {
  return typeof content === "string" &&
    (content.startsWith("http") || content.startsWith("/") || content.startsWith("data:") ||
     content.startsWith("blob:"));
}

export default function GridMotion({ items = [], gradientColor = "black", rows = 4, cols = 7 }) {
  const total = rows * cols;
  const rowRefs = useRef([]);
  const trilhoRefs = useRef([]);
  const raizRef = useRef(null);
  const mouseXRef = useRef(typeof window === "undefined" ? 0 : window.innerWidth / 2);

  const defaults = Array.from({ length: total }, (_, i) => "Item " + (i + 1));
  const combined = items.length > 0 ? items.slice(0, total) : defaults;

  useEffect(() => {
    gsap.ticker.lagSmoothing(0);

    const handleMouseMove = (e) => { mouseXRef.current = e.clientX; };

    // v126: upstream queued four new tweens on every frame, forever, even with the
    // pointer still, and on a phone it never moves. That steady churn is garbage
    // collected in bursts, which showed up as hitches in the hub's unlock on iOS.
    // Only a pointer that moved (and the first frame) queues new tweens now.
    let ultimoX = null;
    const updateMotion = () => {
      if (mouseXRef.current === ultimoX) return;
      ultimoX = mouseXRef.current;
      const maxMoveAmount = 300;
      const baseDuration = 0.8;
      const inertiaFactors = [0.6, 0.4, 0.3, 0.2];

      rowRefs.current.forEach((row, index) => {
        if (!row) return;
        const direction = index % 2 === 0 ? 1 : -1;
        const moveAmount =
          ((mouseXRef.current / window.innerWidth) * maxMoveAmount - maxMoveAmount / 2) * direction;

        gsap.to(row, {
          x: moveAmount,
          duration: baseDuration + inertiaFactors[index % inertiaFactors.length],
          ease: "power3.out",
          overwrite: "auto",
        });
      });
    };

    // ticker.add returns the callback itself, not a remover: calling it (as
    // upstream did) ran one more frame and left the loop on after unmount.
    gsap.ticker.add(updateMotion);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      gsap.ticker.remove(updateMotion);
    };
  }, []);

  // The conveyor. Its own loop, so the mouse handler above keeps its v126 idle
  // rule; both move different elements (row vs track) and simply add up.
  useEffect(() => {
    const raiz = raizRef.current;
    if (!raiz) return undefined;
    const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const trilhos = trilhoRefs.current.slice(0, rows);
    const periodos = trilhos.map(() => 0), larguras = trilhos.map(() => 0);
    const andou = trilhos.map((_, i) => i * 37);
    // The track's layout box is the first copy; the second copy is its own layer
    // placed one loop to the right by transform, never by layout. Laid out side by
    // side, each tile was snapped to the pixel on its own and a twin could land a
    // pixel off its original, which showed as a 1px edge tick at the jump.
    // Measured from computed styles, which keep the fractions offsetWidth rounds.
    const medir = () => trilhos.forEach((t, i) => {
      const a = t?.children[0], b = t?.children[1];
      if (!a || !b) return;
      const cs = getComputedStyle(a);
      larguras[i] = parseFloat(cs.width) || 0;
      periodos[i] = larguras[i] + (parseFloat(cs.columnGap) || 0);
      b.style.transform = "translate3d(" + periodos[i] + "px,0,0)";
    });
    // First copy spans [p - P, p), second [p, p + P), p within half a loop of the
    // row's centre; the track's own box starts centred, hence the + width / 2.
    const pintar = () => trilhos.forEach((t, i) => {
      if (!t) return;
      const x = posicaoEsteira(andou[i], periodos[i]) - periodos[i] + larguras[i] / 2;
      t.style.transform = "translate3d(" + x + "px,0,0)";
    });
    medir();
    pintar();
    const obs = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { medir(); pintar(); }) : null;
    trilhos.forEach((t) => t?.children[0] && obs?.observe(t.children[0]));
    if (reduzir) return () => obs?.disconnect();

    // Runs only while the hub is on screen and the page is visible.
    let visivel = true, ultimo = 0;
    const passo = (tempo) => {
      const dt = ultimo ? Math.min(0.05, tempo - ultimo) : 0;
      ultimo = tempo;
      if (!visivel || document.hidden) { ultimo = 0; return; }
      trilhos.forEach((_, i) => {
        andou[i] += ESTEIRA_VELOCIDADE * ESTEIRA_RITMO[i % ESTEIRA_RITMO.length] * (i % 2 ? 1 : -1) * dt;
      });
      pintar();
    };
    gsap.ticker.add(passo);
    const io = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver((e) => { visivel = e.some((x) => x.isIntersecting); }) : null;
    io?.observe(raiz);
    return () => { gsap.ticker.remove(passo); io?.disconnect(); obs?.disconnect(); };
  }, [rows, cols, combined.length]);

  return (
    <div className="gm" aria-hidden="true" ref={raizRef}>
      <div
        className="gm-stage"
        style={{ background: "radial-gradient(circle, " + gradientColor + " 0%, transparent 100%)" }}
      >
        <div className="gm-grid">
          {[...Array(rows)].map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="gm-row"
              ref={(el) => { rowRefs.current[rowIndex] = el; }}
            >
              <div className="gm-esteira" ref={(el) => { trilhoRefs.current[rowIndex] = el; }}>
                {[0, 1].map((copia) => (
                  <div key={copia} className="gm-copia">
                    {[...Array(cols)].map((_, colIndex) => {
                      const content = combined[rowIndex * cols + colIndex];
                      const art = isImage(content);
                      return (
                        <div key={colIndex} className="gm-item" data-empty={art ? "false" : "true"}
                          data-copia={copia ? "true" : undefined}>
                          <div className="gm-item-inner">
                            {art ? (
                              <img className="gm-item-img" src={content} alt="" />
                            ) : (
                              content ? <div className="gm-item-content">{content}</div> : null
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
