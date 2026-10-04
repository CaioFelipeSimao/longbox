import fs from "node:fs";

// package.json is CommonJS, but this layout-free source is ESM and has no
// imports. Load it as a data module, without compiling the app or needing DOM.
const source = fs.readFileSync(new URL("../src/lib/arrastoSeguir.js", import.meta.url), "utf8");
const { slotNoPonto, reordenarParaSlot, pontoNaCaixaExpandida, velocidadeAutoScroll, transformSeguir,
  velocidadeAutoScrollHorizontal, pontoNoConteudo, rectNoConteudo, limitesDeRolagemDaPagina, lerLimitesDeRolagemDaPagina } =
  await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
let passes = 0, falhas = 0;
const check = (nome, ok) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome);
};
const rect = (left, top, width = 90, height = 150) => ({
  left, top, right: left + width, bottom: top + height, width, height,
});
// Page coordinates deliberately start away from the viewport origin. Three
// columns wrap into a short second row; empty space is not a sixth slot.
const slots = [rect(300, 500), rect(410, 500), rect(520, 500), rect(300, 680), rect(410, 680)];
slots.forEach((r, i) => check("pointer contained in wrapped slot " + i,
  slotNoPonto({ x: r.left + 45, y: r.top + 75 }, slots) === i));
check("horizontal gap has no target without slack", slotNoPonto({ x: 400, y: 575 }, slots) === null);
check("vertical gap has no target without slack", slotNoPonto({ x: 345, y: 665 }, slots) === null);
let currentTarget = 4;
const gapTarget = slotNoPonto({ x: 400, y: 575 }, slots);
if (gapTarget !== null) currentTarget = gapTarget;
check("a gap keeps the current target", currentTarget === 4);
check("empty space after a short row keeps the target", slotNoPonto({ x: 565, y: 755 }, slots) === null);
check("a point outside all slots has no target", slotNoPonto({ x: 100, y: 100 }, slots) === null);
check("empty grids have no target", slotNoPonto({ x: 345, y: 575 }, []) === null);
check("missing slot rects retain their indices", slotNoPonto({ x: 455, y: 575 }, [null, slots[1]]) === 1);
check("slot left and top edges are included", slotNoPonto({ x: 300, y: 500 }, slots) === 0);
check("slot right and bottom edges are excluded", slotNoPonto({ x: 390, y: 650 }, slots) === null);

const slack = { folga: { x: 10, y: 15 } };
check("half the horizontal gap fills its left half", slotNoPonto({ x: 399, y: 575 }, slots, slack) === 0);
check("horizontal midpoint belongs only to the next slot", slotNoPonto({ x: 400, y: 575 }, slots, slack) === 1);
check("half the vertical gap fills its upper half", slotNoPonto({ x: 345, y: 664 }, slots, slack) === 0);
check("vertical midpoint belongs only to the next row", slotNoPonto({ x: 345, y: 665 }, slots, slack) === 3);
check("gap intersections resolve to one wrapped slot", slotNoPonto({ x: 400, y: 665 }, slots, slack) === 4);
check("short row still has no phantom slot with slack", slotNoPonto({ x: 565, y: 755 }, slots, slack) === null);
check("numeric slack expands both axes", slotNoPonto({ x: 295, y: 495 }, slots, { folga: 5 }) === 0);
check("excessive slack is clamped at horizontal midpoints", slotNoPonto({ x: 405, y: 575 }, slots, { folga: 100 }) === 1);
check("excessive slack is clamped at vertical midpoints", slotNoPonto({ x: 345, y: 670 }, slots, { folga: 100 }) === 3);
// Reverse traversal cannot change the geometric owner, even at shared edges:
// if expansions overlapped, choosing the first matching rect would disagree.
const reversedSlots = slots.slice().reverse();
let nonOverlapping = true;
for (let x = 290; x <= 620; x += 5) for (let y = 485; y <= 845; y += 5) {
  const a = slotNoPonto({ x, y }, slots, { folga: 100 });
  const b = slotNoPonto({ x, y }, reversedSlots, { folga: 100 });
  if ((a === null) !== (b === null) || (a !== null && slots[a] !== reversedSlots[b])) nonOverlapping = false;
}
check("expanded slot ownership never overlaps, including boundaries", nonOverlapping);
check("repeated decisions use unchanged fixed geometry", Array.from({ length: 30 }, () =>
  slotNoPonto({ x: 409, y: 575 }, slots, slack)).every((i) => i === 1));

const ids = Object.freeze(["a", "b", "c", "d", "e"]);
const order = (id, i) => reordenarParaSlot(ids, id, i).join();
check("last to first jumps directly to the target", order("e", 0) === "e,a,b,c,d");
check("first to last jumps directly to the target", order("a", 4) === "b,c,d,e,a");
check("last to middle preserves all other relative positions", order("e", 2) === "a,b,e,c,d");
check("middle to first preserves trailing neighbours", order("c", 0) === "c,a,b,d,e");
check("middle to last preserves preceding neighbours", order("c", 4) === "a,b,d,e,c");
check("same index preserves the original order", order("c", 2) === ids.join());
const lastToFirst = reordenarParaSlot(ids, "e", 0);
check("last to first moves every other id exactly one place", ids.slice(0, -1).every((id, i) => lastToFirst.indexOf(id) === i + 1));
check("same target is idempotent", reordenarParaSlot(lastToFirst, "e", 0).join() === lastToFirst.join());
check("each preview derives directly from the original order", order("e", 3) === "a,b,c,e,d" && order("e", 0) === lastToFirst.join());
check("input ids remain unchanged", ids.join() === "a,b,c,d,e");
check("returned arrays do not alias the input", reordenarParaSlot(ids, "c", 2) !== ids);
check("a missing id leaves the order unchanged", order("missing", 0) === ids.join());
check("invalid target indices leave the order unchanged", [-1, 5, 1.5, null].every((i) => order("c", i) === ids.join()));
check("single-card groups keep their only slot", reordenarParaSlot(["a"], "a", 0).join() === "a");

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

const horizontal = { scrollLeft: 200, maxScroll: 1000 };
check("horizontal scroll is zero away from the edges", velocidadeAutoScrollHorizontal(400, 100, 700, horizontal) === 0);
check("horizontal left depth is proportional", velocidadeAutoScrollHorizontal(132, 100, 700, horizontal) === -7);
check("horizontal right depth is proportional", velocidadeAutoScrollHorizontal(668, 100, 700, horizontal) === 7);
check("horizontal speed is full beyond the left edge", velocidadeAutoScrollHorizontal(0, 100, 700, horizontal) === -14);
check("horizontal speed is full beyond the right edge", velocidadeAutoScrollHorizontal(800, 100, 700, horizontal) === 14);
check("horizontal left end stops scrolling", velocidadeAutoScrollHorizontal(100, 100, 700, { ...horizontal, scrollLeft: 0 }) === 0);
check("horizontal right end stops scrolling", velocidadeAutoScrollHorizontal(700, 100, 700, { ...horizontal, scrollLeft: 1000 }) === 0);
check("a fitting horizontal strip cannot scroll", velocidadeAutoScrollHorizontal(700, 100, 700, { maxScroll: 0 }) === 0);
const contentBox = rect(100, 200, 300, 180);
const contentPointer = pontoNoConteudo({ x: 150, y: 250 }, contentBox, 230);
check("pointer conversion includes scrollLeft", contentPointer.x === 280 && contentPointer.y === 50);
const contentSlot = rectNoConteudo(rect(120, 220), contentBox, 230);
check("slot conversion includes content origin and scrollLeft", contentSlot.left === 250 && contentSlot.right === 340 && contentSlot.top === 20 && contentSlot.bottom === 170);
check("scrolling changes targeting without measuring slots again", slotNoPonto(pontoNoConteudo({ x: 150, y: 250 }, contentBox, 230), [contentSlot]) === 0 &&
  slotNoPonto(pontoNoConteudo({ x: 150, y: 250 }, contentBox, 0), [contentSlot]) === null);
check("content conversion supports sheet scrollTop too", pontoNoConteudo({ x: 150, y: 250 }, contentBox, 0, 300).y === 350);
const topbar = rect(0, 0, 800, 76), banda = rect(0, 76, 800, 54);
const pageLimits = limitesDeRolagemDaPagina({ altura: 800, topbar, banda });
check("stuck publisher band defines the page top", pageLimits.top === 130 && pageLimits.bottom === 800);
check("without a band the topbar defines the page top", limitesDeRolagemDaPagina({ altura: 800, topbar }).top === 76);
check("without top chrome the page begins at zero", limitesDeRolagemDaPagina({ altura: 800 }).top === 0);
check("chrome that has left the viewport cannot give a negative top", limitesDeRolagemDaPagina({ altura: 800, banda: rect(0, -80, 800, 54) }).top === 0);
check("fixed bottom tabbar defines the page bottom", limitesDeRolagemDaPagina({ altura: 800, topbar, banda, tabbar: rect(16, 734, 768, 58) }).bottom === 734);
check("a tabbar away from the bottom does not shorten the viewport", limitesDeRolagemDaPagina({ altura: 800, tabbar: rect(0, 300, 800, 58) }).bottom === 800);
check("hidden bottom tabbar does not shorten the viewport", limitesDeRolagemDaPagina({ altura: 800, tabbar: rect(0, 0, 0, 0) }).bottom === 800);
check("pointer over the chrome scrolls up at full speed", velocidadeAutoScroll(100, pageLimits.top, pageLimits.bottom, limits) === -14);
check("the top zone starts below the chrome", velocidadeAutoScroll(162, pageLimits.top, pageLimits.bottom, limits) === -7);
// The DOM reader filters chrome that is present but has not stuck yet, and a
// fixed bottom bar translated up by the on-screen keyboard.
const chrome = (r, position, top = "auto", bottom = "auto") => ({ getBoundingClientRect: () => r, style: { position, top, bottom, display: "block" } });
const elements = { ".topbar": chrome(topbar, "sticky", "0px"), ".ed-band": chrome(rect(0, 300, 800, 54), "sticky", "76px"),
  ".tabbar": chrome(rect(0, 500, 800, 58), "fixed", "auto", "8px") };
const fakeDoc = { querySelector: (s) => elements[s] || null }, fakeWin = { innerHeight: 800, getComputedStyle: (el) => el.style };
check("DOM reader ignores a band that is not stuck", lerLimitesDeRolagemDaPagina(fakeDoc, fakeWin).top === 76);
check("DOM reader ignores a keyboard-raised tabbar", lerLimitesDeRolagemDaPagina(fakeDoc, fakeWin).bottom === 800);
elements[".ed-band"] = chrome(banda, "sticky", "76px");
elements[".tabbar"] = chrome(rect(0, 734, 800, 58), "fixed", "auto", "8px");
check("DOM reader uses stuck band and fixed bottom bar", JSON.stringify(lerLimitesDeRolagemDaPagina(fakeDoc, fakeWin)) === '{"top":130,"bottom":734}');

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
