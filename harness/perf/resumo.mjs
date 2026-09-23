import fs from "fs";
const ev = JSON.parse(fs.readFileSync("trace.json", "utf8")).traceEvents;
const mark = ev.find((e) => e.name === "troca" && e.ph !== "M");
const { pid, tid } = mark; const t0 = mark.ts, t1 = t0 + 1500000;
const mains = ev.filter((e) => e.pid === pid && e.tid === tid && e.ph === "X" && e.ts >= t0 && e.ts < t1);
const click = mains.find((e) => e.name === "EventDispatch" && e.args?.data?.type === "click");
const tc = click ? click.ts : t0;
const tasks = mains.filter((e) => e.name === "RunTask" && e.dur > 8000);
const nomes = ["UpdateLayoutTree", "Layout", "Paint", "PrePaint", "Layerize", "FireAnimationFrame", "FunctionCall", "EventDispatch", "Commit", "LocalFrameView::NotifyResizeObservers", "V8.GC_SCAVENGER", "MinorGC", "MajorGC", "HitTest", "IntersectionObserverController::computeIntersections", "TimerFire", "ParseHTML"];
console.log("  tarefas >8ms (relativo ao clique):");
for (const t of tasks) {
  const f = {};
  for (const e of mains) if (e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur && e !== t && nomes.includes(e.name)) f[e.name] = (f[e.name] || 0) + e.dur / 1000;
  console.log("   " + ((t.ts - tc) / 1000).toFixed(0).padStart(5) + "ms " + (t.dur / 1000).toFixed(1).padStart(6) + "  " + Object.entries(f).filter(([, v]) => v >= 0.5).map(([k, v]) => k + " " + v.toFixed(1)).join(", "));
}
// Frame intervals as presented (from the compositor's frame events if present).
const bmf = mains.filter((e) => e.name === "ProxyMain::BeginMainFrame").map((e) => e.ts);
let gaps = []; for (let i = 1; i < bmf.length; i++) gaps.push((bmf[i] - bmf[i - 1]) / 1000);
const pos = bmf.map((t, i) => [((t - tc) / 1000).toFixed(0), i ? gaps[i - 1].toFixed(0) : "-"]).filter(([, g]) => g !== "-" && Number(g) > 20);
console.log("  intervalos >20ms entre quadros (t:intervalo): " + pos.map(([t, g]) => t + ":" + g).join("  "));
