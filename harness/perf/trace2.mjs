import puppeteer from "puppeteer-core";
import os from "os";
import path from "path";
import fs from "fs";

const [pagina = "index.html", cpu = "4", de = "HQs", para = "Séries"] = process.argv.slice(2);
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  userDataDir: path.join(os.tmpdir(), "lb-trace-" + Date.now()),
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2, hasTouch: true });
const cdp = await page.createCDPSession();
await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "pointer", value: "coarse" }, { name: "hover", value: "none" }, { name: "any-pointer", value: "coarse" }, { name: "any-hover", value: "none" }] });
await page.goto("http://localhost:8769/" + pagina, { waitUntil: "networkidle0" });
await page.evaluate(async (de) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const b = (t) => [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === t);
  [...document.querySelectorAll("button")].find((x) => /Minha Cole/.test(x.textContent)).click();
  await sleep(2500);
  b("Séries").click(); await sleep(600);
  if (b("Mostrar todas")) { b("Mostrar todas").click(); await sleep(800); }
  b(de).click(); await sleep(1500);
}, de);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(cpu) });
const arq = path.join(process.cwd(), "trace.json");
await page.tracing.start({ path: arq, categories: ["blink.user_timing", "devtools.timeline", "disabled-by-default-devtools.timeline", "blink", "cc", "disabled-by-default-devtools.timeline.frame"] });
await page.evaluate(async (para) => {
  const b = (t) => [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === t);
  performance.mark("troca");
  if (para !== "nenhuma") b(para).click();
  await new Promise((r) => setTimeout(r, 700));
}, para);
await page.tracing.stop();
await browser.close();

const ev = JSON.parse(fs.readFileSync(arq, "utf8")).traceEvents;
const mark = ev.find((e) => e.name === "troca" && e.ph !== "M");
const main = mark.tid, pid = mark.pid;
const t0 = mark.ts;
// Total self-ish time per event name on the renderer main thread in the 700ms window.
const somas = {};
for (const e of ev) {
  if (e.pid !== pid || e.tid !== main || e.ph !== "X" || e.ts < t0 || e.ts > t0 + 700000) continue;
  somas[e.name] = (somas[e.name] || 0) + (e.dur || 0) / 1000;
}
const top = Object.entries(somas).sort((a, b) => b[1] - a[1]).slice(0, 18);
console.log(pagina, de, "→", para, "cpu x" + cpu);
top.forEach(([k, v]) => console.log("  " + v.toFixed(1).padStart(7) + " ms  " + k));
// Longest single tasks.
const tarefas = ev.filter((e) => e.pid === pid && e.tid === main && e.name === "RunTask" && e.ts >= t0 - 2000 && e.ts < t0 + 700000).sort((a, b) => b.dur - a.dur).slice(0, 5);
console.log("  tarefas mais longas: " + tarefas.map((t) => (t.dur / 1000).toFixed(1) + "ms@" + ((t.ts - t0) / 1000).toFixed(0)).join(", "));
// Who asks for animation frames: FunctionCall events inside FireAnimationFrame, by source.
const fns = {};
for (const e of ev) {
  if (e.pid !== pid || e.tid !== main || e.name !== "FunctionCall" || e.ts < t0 || e.ts > t0 + 700000) continue;
  const d = e.args && e.args.data || {};
  const k = (d.functionName || "?") + " @" + (d.url || "").split("/").pop() + ":" + d.lineNumber + ":" + d.columnNumber;
  fns[k] = (fns[k] || 0) + e.dur / 1000;
}
console.log("  funcoes:"); Object.entries(fns).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([k, v]) => console.log("    " + v.toFixed(1) + "ms " + k));
const frames = ev.filter((e) => e.pid === pid && e.tid === main && e.name === "Paint" && e.ts >= t0 && e.ts < t0 + 700000).length;
console.log("  eventos Paint: " + frames);
