// GridMotion, from React Bits (reactbits.dev/r/GridMotion-JS-CSS.json), adapted:
// classes carry a gm- prefix so they cannot collide with the app's own .row and
// .intro, the stylesheet lives in src/styles.css like every other rule here, and
// a tile is sized by its own picture rather than the other way round, and an
// item counts as an image when it is a URL or an app-relative path, because
// covers arrive as "/_blob/<assetId>" and the upstream http check would have
// printed that path as text. A data URI counts too, so the grid can be driven
// from inlined art without a store behind it. The motion is upstream's, untouched.
import { useEffect, useRef } from "react";
import { gsap } from "gsap";



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
  const mouseXRef = useRef(typeof window === "undefined" ? 0 : window.innerWidth / 2);

  const defaults = Array.from({ length: total }, (_, i) => "Item " + (i + 1));
  const combined = items.length > 0 ? items.slice(0, total) : defaults;

  useEffect(() => {
    gsap.ticker.lagSmoothing(0);

    const handleMouseMove = (e) => { mouseXRef.current = e.clientX; };

    const updateMotion = () => {
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

    const removeAnimationLoop = gsap.ticker.add(updateMotion);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      removeAnimationLoop();
    };
  }, []);

  return (
    <div className="gm" aria-hidden="true">
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
              {[...Array(cols)].map((_, colIndex) => {
                const content = combined[rowIndex * cols + colIndex];
                const art = isImage(content);
                return (
                  <div key={colIndex} className="gm-item" data-empty={art ? "false" : "true"}>
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
    </div>
  );
}
