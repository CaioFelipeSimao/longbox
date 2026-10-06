import fs from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

// Real hooks, React DOM and pointer scripts, without a stale app bundle. Only
// JSX is transformed (no esbuild filesystem resolver, blocked in the sandbox).
const urls = new Map();
function urlDoModulo(url) {
  if (urls.has(url.href)) return urls.get(url.href);
  let source = fs.readFileSync(url, "utf8");
  if (url.pathname.endsWith(".jsx")) source = esbuild.transformSync(source, { loader: "jsx", jsx: "automatic" }).code;
  source = source.replace(/(\bfrom\s+)(["'])([^"']+)\2/g, (_, prefix, quote, name) => {
    let target;
    if (name.startsWith(".")) {
      let next = new URL(name, url);
      if (!/\.(js|jsx)$/.test(next.pathname)) {
        next = new URL(name + (fs.existsSync(new URL(name + ".js", url)) ? ".js" : ".jsx"), url);
      }
      target = urlDoModulo(next);
    } else target = import.meta.resolve(name);
    return prefix + quote + target + quote;
  });
  const target = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
  urls.set(url.href, target);
  return target;
}
const hook = (name) => import(urlDoModulo(new URL("../src/telas/" + name + ".js", import.meta.url)));
let passes = 0, falhas = 0;
const check = (name, ok) => { if (ok) passes++; else falhas++; console.log("  " + (ok ? "PASS" : "FAIL") + " " + name); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });
const item = (id, ordem) => ({ id, titulo: id, personagem: "Flash", ordem });
const initial = () => ({ editoras: [], volumes: [item("owned", 8)],
  desejos: [item("a", 0), item("b", 1), item("c", 2), item("outside", 99)],
  colecoes: [{ id: "owned", membros: ["owned"], ordem: 7 }],
  desejosColecoes: ["a", "b", "c", "outside"].map((id, i) => ({ id, nome: id, membros: [id], ordem: i + 10,
    descricao: "Keep " + id, colecaoId: "owned", corBarra: { h: 25 } })) });

async function montar(kind, useHook, { chave, reduced = false, projected = true } = {}) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { pretendToBeVisual: true });
  const W = dom.window;
  const doc = W.document;
  const style = doc.createElement("style");
  style.textContent = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8")
    .match(/\.desejo-colecao-(?:hole|ghost)\s*\{[^}]*\}/g)?.join("\n") || "";
  doc.head.appendChild(style);
  Object.assign(globalThis, { window: W, document: W.document, getComputedStyle: W.getComputedStyle.bind(W),
    requestAnimationFrame: (cb) => setTimeout(() => cb(performance.now()), 16), cancelAnimationFrame: clearTimeout });
  W.matchMedia = () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} });
  const errors = [];
  W.addEventListener("error", (e) => errors.push(e.error?.stack || e.message));
  const measured = [];
  W.HTMLElement.prototype.setPointerCapture = function (id) { this.capture = id; };
  W.HTMLElement.prototype.releasePointerCapture = function () { this.capture = null; };
  Object.defineProperty(W.HTMLElement.prototype, "clientHeight", { configurable: true, get() { return this.id === "scroll" ? 600 : 0; } });
  Object.defineProperty(W.HTMLElement.prototype, "scrollHeight", { configurable: true, get() { return this.id === "scroll" ? 1400 : 0; } });
  W.HTMLElement.prototype.getBoundingClientRect = function () {
    const scroll = W.document.getElementById("scroll")?.scrollTop || 0;
    if (this.id === "scroll") return rect(0, 100, 400, 600);
    const collapsed = W.document.querySelector("[data-recolhido]")?.dataset.recolhido === "true";
    if (this.hasAttribute("data-row") && !this.dataset.dragGhost) {
      measured.push(collapsed);
      const i = [...this.parentElement.children].indexOf(this);
      const dy = Number(this.style.transform.match(/translate\([^,]+,\s*([-.\d]+)px\)/)?.[1] || 0);
      return rect(20, 200 + i * (collapsed ? 50 : 170) - scroll + dy, 300, collapsed ? 40 : 160);
    }
    if (this.hasAttribute("data-list")) return rect(20, 200 - scroll, 300, collapsed ? 140 : 500);
    if (this.hasAttribute("data-hq-grid") || this.classList.contains("coll-strip")) return rect(20, 200, 300, 160);
    if (this.hasAttribute("data-slot")) return rect(20 + [...this.parentElement.children].indexOf(this) * 100, 200, 90, 160);
    if (this.classList.contains("vol") || this.classList.contains("cover")) {
      const slot = this.closest("[data-slot]")?.getBoundingClientRect();
      if (slot) return rect(slot.left, slot.top, slot.width, this.classList.contains("cover") ? 100 : 160);
    }
    return this.closest("[data-row]")?.getBoundingClientRect() || rect(0, 0, 400, 0);
  };
  let lib = initial(), api, setLib, setIds;
  const writes = [], root = createRoot(W.document.getElementById("root"));
  const persist = (next) => { writes.push(next); setLib(next); };
  function Harness() {
    [lib, setLib] = React.useState(lib);
    const [ids, changeIds] = React.useState(["a", "b", "c"]); setIds = changeIds;
    api = kind === "rows" ? useHook(lib, persist, ids) : kind === "volumes"
      ? useHook(lib, persist, chave === "desejos" && projected ? lib.desejos.filter((v) => ids.includes(v.id)) : undefined, chave)
      : useHook(lib[chave || "colecoes"][0], lib, persist, chave);
    if (kind === "rows") return React.createElement("div", { id: "scroll", style: { overflowY: "auto", position: "fixed", zIndex: 35 } },
      React.createElement("div", { "data-list": "", "data-recolhido": String(api.recolhido), style: { rowGap: "10px" } },
        (api.visual?.ids || ids).map((id) => React.createElement("div", { key: id, "data-row": id,
          ref: (el) => api.registrar(id, el), className: "desejo-colecao-linha" },
          React.createElement("button", { onPointerDown: (e) => api.pointerDown(e, id) }, id),
          !api.recolhido && React.createElement("div", null, "Expanded content")))));
    const memberIds = kind === "volumes" ? (api.dragVisual?.ids || (chave === "desejos" ? ids : ["owned"]))
      : (api.visual?.order || lib[chave || "colecoes"][0].membros.map((_, i) => i));
    return React.createElement("div", kind === "volumes" ? { "data-hq-grid": "", ref: api.gradeRef } : { className: "coll-strip" },
      memberIds.map((key) => React.createElement("div", { key, "data-slot": key }, React.createElement("button", {
        className: "vol", "data-key": key, ref: (el) => (api.registrarCardNode || api.registrar)(key, el),
        onPointerDown: (e) => kind === "volumes" ? api.volDragPointerDown(e, lib[chave || "volumes"].find((v) => v.id === key), "Flash") : api.pointerDown(e, key),
        onPointerMove: api.volDragPointerMove || api.mover, onPointerUp: api.volDragPointerEnd || api.finalizar,
        onPointerCancel: api.volDragPointerEnd || api.finalizar,
      }, React.createElement("div", { className: "cover" })))));
  }
  flushSync(() => root.render(React.createElement(Harness)));
  await sleep(30);
  const pointer = (el, type, x, y, pointerId = 1) => {
    const e = new W.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
    Object.defineProperty(e, "pointerId", { value: pointerId }); el.dispatchEvent(e); return e;
  };
  const rows = () => [...W.document.querySelectorAll("[data-row]:not([data-drag-ghost])")];
  return { W, errors, measured, writes, pointer, rows, api: () => api, lib: () => lib,
    ghost: () => doc.querySelector("[data-drag-ghost]"),
    keys: () => [...W.document.querySelectorAll("[data-key]:not([data-drag-ghost])")].map((el) => el.dataset.key).join(),
    change: (next) => flushSync(() => setLib(next)), ids: (next) => flushSync(() => setIds(next)),
    close: () => { flushSync(() => root.unmount()); dom.window.close(); } };
}

const { useArrastarVolumes } = await hook("useArrastarVolumes");
const { useArrastarColecao } = await hook("useArrastarColecao");
const grid = await montar("volumes", useArrastarVolumes, { chave: "desejos" });
const owned = grid.lib().volumes, outside = grid.lib().desejos[3];
const card = grid.W.document.querySelector('[data-key="a"]');
grid.pointer(card, "pointerdown", 40, 230); await sleep(500);
grid.pointer(card, "pointermove", 250, 230); await sleep(180);
check("desire grid retains the 110ms dwell preview", grid.api().dragVisual?.ids.join() === "b,c,a");
const touch = new grid.W.Event("touchmove", { bubbles: true, cancelable: true }); card.dispatchEvent(touch);
check("desire grid retains the mounted touchmove blocker", touch.defaultPrevented);
grid.pointer(grid.W, "pointerup", 250, 230); await sleep(250);
check("chave desejos writes the preview order to desires", grid.writes.length === 1 && ["b", "c", "a"].every((id, i) => grid.lib().desejos.find((v) => v.id === id).ordem === i));
check("desire grid preserves owned volumes and nonparticipating desires", grid.lib().volumes === owned && grid.lib().desejos[3] === outside);
check("desire grid cleans its visual on release", grid.api().dragVisual === null);
grid.close();

const stripLib = initial(); stripLib.desejosColecoes[0].membros = ["a", "b", "c"];
const strip = await montar("strip", useArrastarColecao, { chave: "desejosColecoes" }); strip.change(stripLib);
const ownedCols = strip.lib().colecoes, otherCol = strip.lib().desejosColecoes[1];
const cover = strip.W.document.querySelector('[data-key="0"]');
strip.pointer(cover, "pointerdown", 40, 230); await sleep(500);
strip.pointer(cover, "pointermove", 250, 230); await sleep(60);
check("desire strip previews the member reorder", strip.api().visual?.order.join() === "1,2,0");
strip.pointer(strip.W, "pointerup", 250, 230); await sleep(250);
check("chave desejosColecoes writes only its member order", strip.writes.length === 1 && strip.lib().desejosColecoes[0].membros.join() === "b,c,a");
check("desire strip preserves owned and other collections", strip.lib().colecoes === ownedCols && strip.lib().desejosColecoes[1] === otherCol);
strip.close();

const fallback = await montar("volumes", useArrastarVolumes, { chave: "desejos", projected: false });
fallback.pointer(fallback.W.document.querySelector('[data-key="a"]'), "pointerdown", 40, 230); await sleep(500);
check("omitted projected list reads lib[chave]", fallback.api().dragVisual?.ids.join() === "a,b,c,outside");
fallback.pointer(fallback.W, "pointercancel", 40, 230); await sleep(250); fallback.close();
const defaultGrid = await montar("volumes", useArrastarVolumes);
defaultGrid.change({ ...defaultGrid.lib(), volumes: [item("a", 0), item("b", 1), item("owned", 2)] });
defaultGrid.pointer(defaultGrid.W.document.querySelector('[data-key="owned"]'), "pointerdown", 40, 230); await sleep(500);
defaultGrid.pointer(defaultGrid.W, "pointerup", 40, 230); await sleep(250);
check("existing volume signature still reads and writes volumes", defaultGrid.writes.length === 1 && defaultGrid.lib().volumes.find((v) => v.id === "owned").ordem === 0 && defaultGrid.lib().desejos[0].ordem === 0);
defaultGrid.close();
const defaultStrip = await montar("strip", useArrastarColecao);
defaultStrip.change({ ...defaultStrip.lib(), colecoes: [{ id: "owned", membros: ["a", "b", "c"] }] });
defaultStrip.pointer(defaultStrip.W.document.querySelector('[data-key="0"]'), "pointerdown", 40, 230); await sleep(500);
defaultStrip.pointer(defaultStrip.W, "pointerup", 250, 230); await sleep(250);
check("existing collection signature still writes colecoes", defaultStrip.writes.length === 1 && defaultStrip.lib().colecoes[0].membros.join() === "b,c,a" && defaultStrip.lib().desejosColecoes[0].membros.join() === "a");
defaultStrip.close();

let useArrastarColecoesDesejo;
try { ({ useArrastarColecoesDesejo } = await hook("useArrastarColecoesDesejo")); }
catch (e) { check("new row drag hook exists: " + e.message, false); }
if (useArrastarColecoesDesejo) {
  const m = await montar("rows", useArrastarColecoesDesejo);
  const arm = async (id = "c") => {
    const el = m.rows().find((n) => n.dataset.row === id), r = el.getBoundingClientRect();
    m.pointer(el.querySelector("button"), "pointerdown", 40, r.top + 10); await sleep(500); return el;
  };
  const before = m.lib(), untouched = before.desejosColecoes[3];
  const held = m.rows()[2];
  m.pointer(held.querySelector("button"), "pointerdown", 40, 550); await sleep(200);
  check("short press keeps collections expanded without a ghost", !m.api().recolhido && !m.ghost());
  const nativeTouch = new m.W.Event("touchmove", { bubbles: true, cancelable: true }); held.dispatchEvent(nativeTouch);
  check("touch scrolling remains native before arming", !nativeTouch.defaultPrevented);
  m.measured.length = 0; await sleep(300);
  check("450ms long press collapses the rows", m.api().recolhido === true);
  check("slots and ghost are measured after collapsed DOM layout", m.measured.length > 0 && m.measured.every(Boolean) && m.ghost()?.style.height === "40px");
  check("row ghost is fixed on body and preserves a layout hole", m.ghost()?.parentElement === m.W.document.body && m.ghost()?.style.position === "fixed" && held.dataset.dragHole === "true");
  check("body ghost clears the wish-list overlay layer", Number(m.ghost()?.style.zIndex) > 35);
  check("ghost uses only the row lift shadow and hides the real row", !!m.W.getComputedStyle(m.ghost()).boxShadow && m.W.getComputedStyle(held).visibility === "hidden");
  check("row ghost has no rotation, animated scale or keyframes", m.ghost()?.style.animation === "none" && !/rotate|scale\((?!1\))/.test(m.ghost()?.style.transform || "") && m.ghost()?.style.transition === "none");
  const move = m.pointer(m.W, "pointermove", 40, 215); await sleep(80);
  check("third row moves directly to the first fixed slot", m.api().visual?.ids.join() === "c,a,b" && m.rows()[0] === held);
  check("other rows glide with the existing 260ms ease-out token", m.rows().filter((el) => el !== held).every((el) => el.style.transition === "transform 260ms var(--ease-out)"));
  check("held row follows pointer with its grab offset", m.ghost()?.style.transform === "translate(20px, 205px) scale(1)");
  check("active row move prevents native movement and does not persist", move.defaultPrevented && m.writes.length === 0);
  const rowTouch = new m.W.Event("touchmove", { bubbles: true, cancelable: true }); held.dispatchEvent(rowTouch);
  check("row touchmove listener blocks scroll only after arming", rowTouch.defaultPrevented);
  m.pointer(m.W, "pointercancel", 40, 215, 2); await sleep(30);
  check("another pointer cannot end the row gesture", m.api().recolhido && !!m.ghost());
  const neighbour = m.rows()[1]; neighbour.getBoundingClientRect = () => rect(20, 900, 300, 40);
  await sleep(60);
  check("animated neighbour rectangles cannot alter the target", m.api().visual?.ids.join() === "c,a,b");
  delete neighbour.getBoundingClientRect;
  m.pointer(m.W, "pointerup", 40, 215); await sleep(40);
  check("release writes ordem zero through two in preview order", m.writes.length === 1 && ["c", "a", "b"].every((id, i) => m.lib().desejosColecoes.find((c) => c.id === id).ordem === i));
  check("release changes only participating collections and preserves their fields", m.lib().desejosColecoes[3] === untouched && m.lib().volumes === before.volumes && m.lib().colecoes === before.colecoes && m.lib().desejos === before.desejos && m.lib().desejosColecoes.every((c) => c.descricao === "Keep " + c.id && c.colecaoId === "owned" && c.corBarra.h === 25));
  check("release reopens rows and removes all drag state", !m.api().recolhido && !m.api().visual && !m.ghost() && !held.dataset.dragHole && !held.classList.contains("desejo-colecao-hole") && held.capture === null);
  check("row drag suppresses the subsequent click", m.api().suppressClickRef.current);
  for (const type of ["pointercancel", "blur"]) {
    await arm(); m.pointer(m.W, "pointermove", 40, 215); await sleep(40);
    const n = m.writes.length;
    if (type === "blur") m.W.dispatchEvent(new m.W.Event("blur")); else m.pointer(m.W, type, 40, 215);
    await sleep(40);
    check(type + " reopens without persisting and removes ghost, hole, transforms and capture", m.writes.length === n && !m.api().recolhido && !m.api().visual && !m.ghost() && m.rows().every((el) => !el.dataset.dragHole && !el.classList.contains("desejo-colecao-hole") && !el.style.transform && !el.style.transition && el.capture == null));
  }
  await arm(); m.pointer(m.W, "pointermove", 40, 215); await sleep(40);
  m.pointer(m.W, "pointermove", 800, 215); await sleep(40);
  check("leaving the row group restores the original preview", m.api().visual?.ids.join() === "a,b,c");
  const n = m.writes.length; m.pointer(m.W, "pointerup", 800, 215); await sleep(40);
  check("release outside the group reopens without persisting", m.writes.length === n && !m.api().recolhido && !m.ghost());
  const tap = m.rows()[0]; m.pointer(tap.querySelector("button"), "pointerdown", 40, 210); m.pointer(m.W, "pointerup", 40, 210);
  await sleep(500);
  check("tap disarms the hold timer and resets click suppression", !m.api().recolhido && !m.ghost() && !m.api().suppressClickRef.current);
  m.pointer(tap.querySelector("button"), "pointerdown", 40, 210); m.pointer(m.W, "pointermove", 40, 240); await sleep(500);
  check("movement before long press remains native scroll and never arms", !m.api().recolhido && !m.ghost());
  m.pointer(tap.querySelector("button"), "pointerdown", 40, 210); m.W.dispatchEvent(new m.W.Event("blur")); await sleep(500);
  check("blur during the hold cancels its pending timer", !m.api().recolhido && !m.ghost());
  await arm();
  const ghostTransform = m.ghost()?.style.transform;
  m.W.document.getElementById("scroll").scrollTop = 50; await sleep(50);
  check("ancestor scroll keeps the body ghost under the stationary pointer", m.ghost()?.style.transform === ghostTransform);
  m.pointer(m.W, "pointermove", 40, 165); await sleep(50);
  check("fixed content slots account for ancestor scroll", m.api().visual?.ids.join() === "c,a,b");
  m.pointer(m.W, "pointercancel", 40, 165); await sleep(30);
  m.W.document.getElementById("scroll").scrollTop = 0;
  await arm(); m.change({ ...m.lib(), desejosColecoes: m.lib().desejosColecoes.filter((c) => c.id !== "b") }); await sleep(30);
  check("removing a collection during drag cancels without persistence", !m.api().recolhido && !m.ghost() && m.writes.length === n);
  m.change({ ...m.lib(), desejosColecoes: initial().desejosColecoes });
  await arm(); m.ids(["a", "b"]); await sleep(30);
  check("changing participating ids cancels without a stale write", !m.api().recolhido && !m.ghost() && m.writes.length === n);
  m.ids(["a", "b", "c"]); await arm();
  const heldAtUnmount = m.rows()[2]; m.close(); await sleep(50);
  check("unmount removes ghost, hole, capture and pending animation work", !m.ghost() && !heldAtUnmount.dataset.dragHole && heldAtUnmount.capture == null && !heldAtUnmount.style.transform);
  check("pointer scripts report no runtime errors", m.errors.length === 0 && grid.errors.length === 0 && strip.errors.length === 0);
  const reduced = await montar("rows", useArrastarColecoesDesejo, { reduced: true });
  reduced.pointer(reduced.rows()[2].querySelector("button"), "pointerdown", 40, 550); await sleep(500);
  reduced.pointer(reduced.W, "pointermove", 40, 215); await sleep(60);
  check("reduced motion skips neighbour transitions", reduced.rows().every((el) => !el.style.transition));
  reduced.pointer(reduced.W, "pointerup", 40, 215); await sleep(30);
  check("reduced motion still persists and reopens immediately", reduced.writes.length === 1 && !reduced.api().recolhido && !reduced.ghost()); reduced.close();
  const release = await montar("rows", useArrastarColecoesDesejo);
  release.pointer(release.rows()[2].querySelector("button"), "pointerdown", 40, 550); await sleep(500);
  release.change({ ...release.lib(), desejosColecoes: release.lib().desejosColecoes.map((c) => c.id === "a" ? { ...c, descricao: "Remote edit" } : c) });
  release.pointer(release.W, "pointerup", 40, 215); await sleep(30);
  check("release targets the final pointer even without a preceding move", release.writes.length === 1 && release.lib().desejosColecoes.find((c) => c.id === "c").ordem === 0);
  check("release uses the latest library and preserves concurrent field edits", release.lib().desejosColecoes.find((c) => c.id === "a").descricao === "Remote edit"); release.close();
  const pending = await montar("rows", useArrastarColecoesDesejo);
  pending.pointer(pending.rows()[0].querySelector("button"), "pointerdown", 40, 210); pending.close(); await sleep(500);
  check("unmount before arming cancels the pending long press", !pending.ghost() && pending.writes.length === 0);
}
console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
