import puppeteer from "puppeteer-core";
import os from "os";
import path from "path";

// Where the pill ends up, and what it looks like mid-flight, for old and new.
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  userDataDir: path.join(os.tmpdir(), "lb-geo-" + Date.now()),
});
for (const pagina of ["index.html", "index83.html"]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  await page.goto("http://localhost:8769/" + pagina, { waitUntil: "networkidle0" });
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const b = (t) => [...document.querySelectorAll(".segmented button")].find((x) => x.textContent.trim() === t)
      || [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === t);
    [...document.querySelectorAll("button")].find((x) => /Minha Cole/.test(x.textContent)).click();
    await sleep(2500);
    const thumb = document.querySelector(".seg-thumb");
    // Visible box of the pill, in page px.
    const caixa = () => {
      const tr = thumb.getBoundingClientRect();
      const jan = thumb.querySelector(".pil-janela");
      if (jan) {
        const j = jan.getBoundingClientRect(), c = jan.firstElementChild.getBoundingClientRect();
        return { l: Math.max(j.left, c.left), r: Math.min(j.right, c.right), t: tr.top, b: tr.bottom };
      }
      if (thumb.children.length) {
        const rs = [...thumb.children].map((c) => c.getBoundingClientRect());
        return { l: Math.min(...rs.map((x) => x.left)), r: Math.max(...rs.map((x) => x.right)), t: tr.top, b: tr.bottom };
      }
      const m = getComputedStyle(thumb).clipPath.match(/inset\(([\d.]+)px ([\d.]+)px ([\d.]+)px ([\d.]+)px/);
      const [t, rr, bb, l] = m.slice(1).map(Number);
      return { l: tr.left + l, r: tr.right - rr, t: tr.top + t, b: tr.bottom - bb };
    };
    const f = (x) => [x.l, x.r, x.t, x.b].map((v) => v.toFixed(2)).join(" ");
    const out = [];
    for (const t of ["HQs", "Coleções", "Séries", "HQs"]) {
      b(t).click();
      await sleep(120);
      const meio = f(caixa());
      await sleep(900);
      const btn = document.querySelector('.segmented button[data-active="true"]').getBoundingClientRect();
      out.push(t + " | botao " + f({ l: btn.left, r: btn.right, t: btn.top, b: btn.bottom }) + " | pilula " + f(caixa()) + " | aos 120ms " + meio);
    }
    return out;
  });
  console.log(pagina); r.forEach((x) => console.log("  " + x));
  await page.close();
}
await browser.close();
