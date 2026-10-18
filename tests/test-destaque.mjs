import { JSDOM } from "jsdom";
import fs from "node:fs";
import { importarLib } from "./helpers/importar-lib.mjs";

// Behavioral checks against the current build. Geometry is supplied explicitly:
// JSDOM has no layout. A real phone is still needed to judge motion and scrolling.
const { EMBLEMAS } = await importarLib("emblemas");
const batman = EMBLEMAS.find((e) => e.id === "batman");
const casas = (molde) => molde.flatMap((l, r) => [...l].flatMap((c, q) => c === "#" ? [r + ":" + q] : []));
const bundle = fs.readFileSync("dist/app.js", "utf8");
// ResizeObserver reports CSS pixels; inline lengths follow the app's rem scale.
const pixels = (m, el, propriedade) => {
  const valor = el?.style[propriedade] || "0";
  const rem = parseFloat(m.w.getComputedStyle(m.w.document.documentElement).fontSize) || 16;
  return parseFloat(valor) * (valor.endsWith("rem") ? rem : 1);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passes = 0, falhas = 0;
const check = (nome, ok) => {
  if (ok) passes++; else falhas++;
  console.log((ok ? "PASS " : "FAIL ") + nome);
};
async function montar({ quantidade = 2, personagem = "Batman", celular = false, reduz = false } = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.test/",
  });
  const w = dom.window, erros = [], observadores = new Set(), mqs = new Map();
  let largura = celular ? 352 : 800, telefone = celular, reduzir = reduz, escritas = 0;
  w.sessionStorage.setItem("longbox:aba", "hub");
  w.Math.random = () => 0.3;
  w.scrollTo = () => {};
  w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.ResizeObserver = class { constructor(fn) { this.fn = fn; } observe() { observadores.add(this.fn); } disconnect() { observadores.delete(this.fn); } };
  w.matchMedia = (q) => {
    if (!mqs.has(q)) {
      const listeners = new Set();
      mqs.set(q, { media: q, get matches() {
        if (q.includes("prefers-reduced-motion")) return reduzir;
        if (q.includes("max-width: 767px")) return telefone;
        if (q.includes("pointer: coarse") || q.includes("hover: none")) return telefone;
        return q.includes("pointer: fine") || q.includes("hover: hover") ? !telefone : false;
      }, addEventListener(_t, fn) { listeners.add(fn); }, removeEventListener(_t, fn) { listeners.delete(fn); },
      emitir() { listeners.forEach((fn) => fn()); } });
    }
    return mqs.get(q);
  };
  const rect = w.Element.prototype.getBoundingClientRect;
  w.Element.prototype.getBoundingClientRect = function () {
    return this.classList?.contains("destaque-mosaico")
      ? { x: 0, y: 0, left: 0, top: 0, right: largura, bottom: 400, width: largura, height: 400 }
      : rect.call(this);
  };
  const setProperty = w.CSSStyleDeclaration.prototype.setProperty;
  w.CSSStyleDeclaration.prototype.setProperty = function (nome, ...args) {
    if (nome === "--onda-s") escritas++;
    return setProperty.call(this, nome, ...args);
  };
  w.addEventListener("error", (e) => erros.push(e.error?.stack || e.message));
  w.console.error = (...a) => erros.push(a.join(" "));
  const volumes = Array.from({ length: quantidade }, (_, i) => ({
    id: "v" + i, titulo: "Volume " + i, personagem, tipo: "TPB", editora: "DC Comics",
    status: i === 0 ? "lida" : "nao_lida", ano: "2026", edicoesColetadasIds: ["e1"],
    ...(i === 0 ? { capaAssetId: "a".repeat(32), mini: { capa: "a".repeat(32), id: "b".repeat(32) } } : {}),
  }));
  const docs = new Map([
    ["library/volumes", { items: volumes }], ["library/series", { items: [] }],
    ["library/colecoes", { items: [] }], ["library/cores", { mapa: { batman: 300 } }],
  ]);
  const doc = (path) => ({ path, get: async () => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path), metadata: {} }),
    set: async (data) => { docs.set(path, data); }, delete: async () => { docs.delete(path); } });
  const eds = [{ id: "e1", serieId: "s1", ano: "1996", numero: "1" }];
  w.claude = { use: async (nome) => nome === "db" ? { doc, collection: (path) => ({ path, doc: (id) => doc(path + "/" + id),
    get: async () => ({ docs: path === "edicoes" ? [{ id: "s1", exists: true, data: () => ({ items: eds }), metadata: {} }] : [], docChanges: () => [] }) }) } : null };
  w.eval(bundle);
  await sleep(450);
  const root = w.document.getElementById("root");
  const area = () => root.querySelector(".destaque-mosaico");
  const pecas = () => [...root.querySelectorAll(".destaque-peca[data-casa]")];
  const galeria = () => [...root.querySelectorAll(".destaque-peca:not(:disabled)")];
  const botao = (nome) => [...root.querySelectorAll(".destaque-acoes button")].find((b) => b.textContent === nome);
  const ponteiro = (alvo, tipo, x = 100, y = 100, pointerType = "mouse") => {
    const e = new w.Event(tipo, { bubbles: true, cancelable: true });
    Object.assign(e, { clientX: x, clientY: y, pointerType, isPrimary: true });
    alvo.dispatchEvent(e); return e;
  };
  const resize = async (cel, W) => {
    telefone = cel; largura = W;
    mqs.forEach((mq) => mq.emitir()); observadores.forEach((fn) => fn());
    w.dispatchEvent(new w.Event("resize")); await sleep(100);
  };
  return { dom, w, root, erros, area, pecas, galeria, botao, ponteiro, resize, escritas: () => escritas };
}

const m = await montar({ quantidade: 500 });
// Batman draws one bat-symbol per visit from its library; the phone must keep the same one.
const formasBat = [batman, ...(batman.variantes || [])];
const formaPc = formasBat.findIndex((f) => JSON.stringify(m.pecas().map((p) => p.dataset.casa)) === JSON.stringify(casas(f.pc)));
check("PC usa exatamente as casas de um molde fixo da biblioteca", formaPc >= 0);
check("peça usa 1/40 da área com folga de 2px e proporção 2:3", Math.abs(pixels(m, m.pecas()[0], "width") - (800 - 39 * 2) / 40) < 0.01 && Math.abs(pixels(m, m.pecas()[0], "height") / pixels(m, m.pecas()[0], "width") - 1.5) < 0.001);
check("miniatura remota tem preferência sobre capa inteira", m.root.querySelector('.destaque-peca[data-volume="v0"] img')?.getAttribute("src") === "/_blob/" + "b".repeat(32));
check("cor escolhida do personagem chega ao painel", m.root.querySelector(".destaque-corpo")?.style.getPropertyValue("--edge").includes("hsl(300"));
check("anos exibidos vêm das edições, não de 2026 do volume", m.root.querySelector(".destaque-anos")?.textContent.includes("1996 e 1996") && !m.root.querySelector(".destaque-anos")?.textContent.includes("2026"));
check("volumes que não cabem começam ocultos e inacessíveis", m.root.querySelectorAll('.destaque-peca[data-extra="true"]').length > 0 && [...m.root.querySelectorAll('.destaque-peca[data-extra="true"]')].every((p) => p.disabled && p.style.opacity === "0"));
m.root.querySelector(".destaque-ativar")?.click(); await sleep(100);
check("grade inclui todos os 500 volumes, uma vez", m.galeria().length === 500 && new Set(m.galeria().map((p) => p.dataset.volume)).size === 500);
check("volumes sem casa aparecem com fade na grade", [...m.root.querySelectorAll('.destaque-peca[data-extra="true"]')].every((p) => !p.disabled && p.style.opacity === "1"));
m.botao("Remontar o emblema")?.click(); await sleep(100);
check("remontar devolve foco ao emblema e retira capas do Tab", m.w.document.activeElement === m.root.querySelector(".destaque-ativar") && m.galeria().length === 0);
const antes = m.pecas().map((p) => p.dataset.volume).join();
await sleep(650);
m.ponteiro(m.area(), "pointermove"); await sleep(80);
const pintado = m.escritas();
await sleep(100);
check("mouse produz onda sem continuar escrevendo parado", pintado > 0 && m.escritas() === pintado && m.pecas().some((p) => Number(p.querySelector(".destaque-onda").style.getPropertyValue("--onda-s")) > 1));
m.ponteiro(m.area(), "pointerleave"); await sleep(80);
check("sair do emblema desfaz a onda", m.pecas().every((p) => p.querySelector(".destaque-onda").style.getPropertyValue("--onda-s") === "1"));
check("interações preservam a distribuição desta visita", m.pecas().map((p) => p.dataset.volume).join() === antes);
await m.resize(true, 352);
check("celular troca para o cel do mesmo morcego, sem reamostrar", formaPc >= 0 && JSON.stringify(m.pecas().map((p) => p.dataset.casa)) === JSON.stringify(casas(formasBat[formaPc].cel)));
check("celular calcula peça em 16 colunas", Math.abs(pixels(m, m.pecas()[0], "width") - (352 - 15 * 2) / 16) < 0.01);
m.botao("Ver os 500 volumes")?.click(); await sleep(100);
check("grade do celular preserva todos os volumes e alvo de pelo menos 44px", m.galeria().length === 500 && m.galeria().every((p) => pixels(m, p, "width") * Number(p.style.getPropertyValue("--escala")) >= 44));
check("sem erros ao redimensionar e remontar", m.erros.length === 0);
m.dom.window.close();

const toque = await montar({ celular: true });
await sleep(2300);
const finalOnda = toque.escritas(); await sleep(100);
check("toque faz uma onda única e termina", finalOnda > 0 && toque.escritas() === finalOnda);
const alvo = toque.root.querySelector(".destaque-ativar");
toque.ponteiro(alvo, "pointerdown", 50, 50, "touch");
const move = toque.ponteiro(alvo, "pointermove", 50, 100, "touch");
alvo?.dispatchEvent(new toque.w.MouseEvent("click", { bubbles: true, detail: 1 })); await sleep(80);
check("arraste não cancela rolagem nem ativa o emblema", !move.defaultPrevented && toque.area()?.dataset.modo === "emblema");
toque.ponteiro(alvo, "pointerdown", 50, 50, "touch"); alvo?.click(); await sleep(80);
check("toque simples espalha e duplicatas ficam inacessíveis", toque.galeria().length === 2 && [...toque.root.querySelectorAll('.destaque-peca[data-unica="false"]')].every((p) => p.disabled && p.getAttribute("aria-hidden") === "true"));
check("sem erros no toque", toque.erros.length === 0);
toque.dom.window.close();

const r = await montar({ celular: true, reduz: true });
const escritaInicial = r.escritas();
r.ponteiro(r.area(), "pointermove"); await sleep(1200);
check("movimento reduzido desliga entrada e ondas", r.area()?.dataset.entrada === "false" && r.escritas() === escritaInicial);
r.botao("Ver os 2 volumes")?.click(); await sleep(80);
check("movimento reduzido mantém a grade funcional", r.galeria().length === 2);
// v183: the "Outro personagem" button was removed at the user's request.
check("sem botão Outro personagem; o único elegível continua no destaque", !r.botao("Outro personagem") && r.area()?.dataset.emblema === "batman");
check("sem erros com movimento reduzido", r.erros.length === 0);
r.dom.window.close();

const vazio = await montar({ personagem: "Personagem sem molde" });
check("sem pool elegível mantém título e explica ausência", !vazio.area() && vazio.root.querySelector(".destaque")?.textContent.includes("ainda não têm um emblema"));
check("sem erros quando nenhum emblema é elegível", vazio.erros.length === 0);
vazio.dom.window.close();
console.log(passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
