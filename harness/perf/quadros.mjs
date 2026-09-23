import fs from "fs";
const ev = JSON.parse(fs.readFileSync("trace.json", "utf8")).traceEvents;
const mark = ev.find((e) => e.name === "troca" && e.ph !== "M");
const { pid, tid } = mark; const t0 = mark.ts;
const mains = ev.filter((e) => e.pid === pid && e.tid === tid && e.ph === "X");
const frames = mains.filter((e) => e.name === "ProxyMain::BeginMainFrame" && e.ts >= t0 && e.ts < t0 + 700000);
for (const f of frames.slice(0, 40)) {
  const filhos = {};
  for (const e of mains) if (e.ts >= f.ts && e.ts + e.dur <= f.ts + f.dur && e !== f && e.dur > 300) {
    if (["UpdateLayoutTree", "Layout", "Paint", "Layerize", "PrePaint", "FireAnimationFrame", "UpdateLayer", "ScrollbarUpdate", "Commit", "RecalcStyle", "Animation", "HitTest", "UpdateLayerTree", "IntersectionObserverController::computeIntersections", "LocalFrameView::NotifyResizeObservers"].includes(e.name))
      filhos[e.name] = (filhos[e.name] || 0) + e.dur / 1000;
  }
  console.log(((f.ts - t0) / 1000).toFixed(0).padStart(4) + "ms " + (f.dur / 1000).toFixed(1).padStart(5) + "  " + Object.entries(filhos).map(([k, v]) => k + " " + v.toFixed(1)).join(", "));
}
