import fs from "node:fs";

// package.json is CommonJS, but this layout-free source is ESM and has no
// imports. Load it as a data module, without compiling the app or needing DOM.
const source = fs.readFileSync(new URL("../src/lib/arrastoSeguir.js", import.meta.url), "utf8");
const { alvoSlotMaisProximo, pontoNaCaixaExpandida, velocidadeAutoScroll, transformSeguir } =
  await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
let passes = 0, falhas = 0;
const check = (nome, ok) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome);
};
const rect = (left, top, width = 90, height = 150) => ({
  left, top, right: left + width, bottom: top + height, width, height,
});
const cards = [{ id: "a", rect: rect(0, 0) }, { id: "b", rect: rect(110, 0) }, { id: "c", rect: rect(0, 180) }];
check("nearest centre selects the neighbouring card", alvoSlotMaisProximo({ x: 160, y: 70 }, cards) === "b");
check("grid gaps still have a nearest slot", alvoSlotMaisProximo({ x: 104, y: 70 }, cards) === "b");
check("tall cards use height for their vertical centre", alvoSlotMaisProximo({ x: 45, y: 155 }, cards) === "a");
check("wrapped rows use both axes", alvoSlotMaisProximo({ x: 10, y: 240 }, cards) === "c");
check("ties keep the first neighbour in slot order", alvoSlotMaisProximo({ x: 100, y: 75 }, cards.slice(0, 2)) === "a");
check("the current slot prevents repeated swaps", alvoSlotMaisProximo({ x: 30, y: 50 }, cards, rect(0, 0)) === null);
check("the current slot includes its boundary", alvoSlotMaisProximo({ x: 90, y: 150 }, cards, rect(0, 0)) === null);
check("empty groups have no target", alvoSlotMaisProximo({ x: 10, y: 10 }, []) === null);

const box = rect(100, 200, 300, 400);
check("a pointer inside the grid is allowed", pontoNaCaixaExpandida({ x: 150, y: 250 }, box));
check("the 16px expansion includes every boundary", [[84, 184], [416, 184], [84, 616], [416, 616]].every(([x, y]) => pontoNaCaixaExpandida({ x, y }, box)));
check("a pointer beyond horizontal expansion is outside", !pontoNaCaixaExpandida({ x: 417, y: 250 }, box));
check("a pointer beyond vertical expansion is outside", !pontoNaCaixaExpandida({ x: 150, y: 183 }, box));
check("a missing grid cannot accept a drop", !pontoNaCaixaExpandida({ x: 150, y: 250 }, null));
check("an explicit margin can disable expansion", !pontoNaCaixaExpandida({ x: 99, y: 250 }, box, 0));

const limits = { scrollTop: 200, maxScroll: 1000 };
check("auto-scroll is zero in the middle", velocidadeAutoScroll(400, 100, 700, limits) === 0);
check("top edge depth gives proportional upward speed", velocidadeAutoScroll(132, 100, 700, limits) === -7);
check("bottom edge depth gives proportional downward speed", velocidadeAutoScroll(668, 100, 700, limits) === 7);
check("speed caps above the viewport", velocidadeAutoScroll(-200, 100, 700, limits) === -14);
check("speed caps below the viewport", velocidadeAutoScroll(900, 100, 700, limits) === 14);
check("upward scroll stops at the top", velocidadeAutoScroll(100, 100, 700, { ...limits, scrollTop: 0 }) === 0);
check("downward scroll stops at the bottom", velocidadeAutoScroll(700, 100, 700, { ...limits, scrollTop: 1000 }) === 0);
check("a container without scroll room never scrolls", velocidadeAutoScroll(700, 100, 700, { maxScroll: 0 }) === 0);
check("an empty viewport never scrolls", velocidadeAutoScroll(100, 100, 100, limits) === 0);
check("edge zones shrink for short containers", velocidadeAutoScroll(115, 100, 160, limits) === -7);

const pointer = { x: 330, y: 470 }, grab = { x: 30, y: 70 };
const translate = transformSeguir(pointer, grab, rect(100, 200));
check("translation keeps the grab offset on both axes", translate.x === 200 && translate.y === 200);
const moved = transformSeguir(pointer, grab, rect(210, 380));
check("changing slots rebases translation without a jump", moved.x === 90 && moved.y === 20 && 210 + moved.x + grab.x === pointer.x && 380 + moved.y + grab.y === pointer.y);
const negative = transformSeguir({ x: -20, y: -50 }, grab, rect(100, 200));
check("translation follows the pointer outside the screen", negative.x === -150 && negative.y === -320);

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
