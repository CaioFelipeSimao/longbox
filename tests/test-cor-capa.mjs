import fs from "node:fs";
import esbuild from "esbuild";

// v106: the volume sheet's wash takes the cover's most prominent colour. The pure
// part, picking a colour from 16x24 pixels, runs here on made-up covers.

const { code } = esbuild.transformSync(fs.readFileSync("src/lib/util.js", "utf8"), { format: "esm" });
const { corDosPixels } = await import("data:text/javascript," + encodeURIComponent(code));
let falhas = 0, passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
// n pixels of each [r,g,b] in the list, as an RGBA array
const capa = (...partes) => {
  const px = [];
  for (const [n, rgb] of partes) for (let i = 0; i < n; i++) px.push(...rgb, 255);
  return new Uint8ClampedArray(px);
};
const matiz = (c) => (c ? Number(c.match(/hsl\((\d+)/)[1]) : null);

const vermelha = corDosPixels(capa([300, [200, 30, 30]], [84, [20, 20, 20]]));
check("capa vermelha dá vermelho", matiz(vermelha) !== null && (matiz(vermelha) < 20 || matiz(vermelha) > 340), vermelha);
const azulMaisViva = corDosPixels(capa([150, [40, 60, 200]], [150, [150, 120, 110]], [84, [0, 0, 0]]));
check("a cor viva vence a apagada, mesmo com a mesma área", matiz(azulMaisViva) >= 220 && matiz(azulMaisViva) <= 240, azulMaisViva);
check("capa quase preta e branca não dá cor", corDosPixels(capa([200, [10, 10, 10]], [150, [245, 245, 245]], [34, [200, 40, 40]])) === null);
check("capa cinza não dá cor", corDosPixels(capa([384, [128, 128, 130]])) === null);
check("luminosidade fixa em 45%", /45%\)$/.test(vermelha || ""), vermelha);

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
