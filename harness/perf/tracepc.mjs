import puppeteer from "puppeteer-core";
import os from "os";
import path from "path";
import fs from "fs";

// PC conditions: mouse (fine pointer, so the cursor lattice is on), the user's
// window (1707 CSS px wide at 1.5x), real mouse moves over the band before the
// click, so the hover pill and the lattice both run as they would by hand.
const [pagina = "index.html", cpu = "1", de = "HQs", para = "Séries", perfilFixo = ""] = process.argv.slice(2);
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  userDataDir: perfilFixo || path.join(os.tmpdir(), "lb-pc-" + Date.now()),
});
const page = await browser.newPage();
await page.setViewport({ width: 1707, height: 900, deviceScaleFactor: 1.5 });
const cdp = await page.createCDPSession();
await page.evaluateOnNewDocument((m) => { window.__esperarMini = m; }, pagina.includes("85"));
await page.goto("http://localhost:8769/" + pagina, { waitUntil: "networkidle0" });
const pos = await page.evaluate(async (de, para) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const b = (t) => [...document.querySelectorAll(".segmented button")].find((x) => x.textContent.trim() === t);
  [...document.querySelectorAll("button")].find((x) => /Minha Cole/.test(x.textContent)).click();
  await sleep(2500);
  b("Séries").click(); await sleep(600);
  const todas = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Mostrar todas");
  if (todas) { todas.click(); await sleep(800); }
  // Thumbnails (v85+): wait until every cover in every tab is one.
  for (let i = 0; i < 240; i++) { const im = [...document.querySelectorAll(".cover img")]; if (!document.querySelector(".cover img") || im.every((x) => !x.src.includes("/_blob/")) || !window.__esperarMini) break; await sleep(500); }
  b(de).click(); await sleep(1500);
  const c = (t) => { const r = b(t).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  return { de: c(de), para: c(para), malha: !!document.querySelector(".cursor-grid") };
}, de, para);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(cpu) });
await page.mouse.move(pos.de[0], pos.de[1] + 200);
await page.mouse.move(pos.de[0], pos.de[1], { steps: 8 });
const arq = path.join(process.cwd(), "trace.json");
await page.tracing.start({ path: arq, categories: ["blink.user_timing", "disabled-by-default-devtools.timeline.picture", "cc.debug", "disabled-by-default-cc.debug", "blink.image_decoding", "ImageDecode", "devtools.timeline", "disabled-by-default-devtools.timeline", "blink", "cc", "disabled-by-default-devtools.timeline.frame"] });
await page.evaluate(() => performance.mark("troca"));
// Glide to the target tab, click, then drift away, as a hand would.
await page.mouse.move(pos.para[0], pos.para[1], { steps: 12 });
await page.mouse.down(); await page.mouse.up();
await page.mouse.move(pos.para[0] + 40, pos.para[1] + 250, { steps: 20 });
await new Promise((r) => setTimeout(r, 700));
await page.tracing.stop();
await browser.close();
console.log(pagina, de, "→", para, "cpu x" + cpu, "malha", pos.malha);
