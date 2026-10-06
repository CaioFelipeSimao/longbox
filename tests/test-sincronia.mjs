import { JSDOM } from "jsdom";
import fs from "node:fs";
import { importarLib } from "./helpers/importar-lib.mjs";

// v96: the app no longer overwrites what was written elsewhere. 2026-09-24, a tab
// opened before Claude catalogued 20 volumes reordered three and saved its whole
// old volumes list, erasing the 20. Now every save re-reads the document and
// merges (this tab's changes on top of the server copy), and the tab listens to
// the db and brings in changes made elsewhere as they happen.

let falhas = 0;
let passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- the merge itself ---------- */
console.log("=== mescla de três vias ===");
const M = await importarLib("mesclar");
const it = (id, x = {}) => ({ id, t: id, ...x });
const ids = (l) => l.map((x) => x.id).join(",");
{
  const base = [it("a"), it("b"), it("c")];
  const r = M.mesclarLista(base, [it("a"), it("b", { ordem: 2 }), it("c")], [...base, ...["n1", "n2", "n3"].map((i) => it(i))]);
  check("o caso de 2026-09-24: reordenar aqui não apaga o que chegou lá", ids(r) === "a,b,c,n1,n2,n3", ids(r));
  check("a reordenação daqui fica", r.find((x) => x.id === "b").ordem === 2);
}
{
  const base = [it("a"), it("b")];
  const r = M.mesclarLista(base, [it("a")], [it("a"), it("b"), it("n")]);
  check("removido aqui continua removido", ids(r) === "a,n", ids(r));
}
{
  const base = [it("a"), it("b")];
  const r = M.mesclarLista(base, [it("a"), it("b"), it("x")], [it("a")]);
  check("adicionado aqui entra; removido lá (sem mexer aqui) sai", ids(r) === "a,x", ids(r));
}
{
  const base = [it("a")];
  const r = M.mesclarLista(base, [it("a", { s: "aqui" })], [it("a", { s: "la" })]);
  check("mesmo item mudado nos dois lados: vence o daqui", r[0].s === "aqui");
  const r2 = M.mesclarLista(base, [it("a")], [it("a", { s: "la" })]);
  check("mudado só lá: vale o de lá", r2[0].s === "la");
  const r3 = M.mesclarLista([it("a"), it("b")], [it("a"), it("b", { s: "aqui" })], [it("a")]);
  check("editado aqui e removido lá: a edição daqui fica", ids(r3) === "a,b");
}
{
  // v158: the same item with its keys in another order is the same item. The base comes back from the
  // server sorted, the tab holds its own order; that must not read as "changed here" and beat what
  // another device changed.
  const base = [{ id: "a", s: 1, t: "x" }];
  const aqui = [{ t: "x", id: "a", s: 1 }];
  const la = [{ id: "a", s: 9, t: "x" }];
  const r = M.mesclarLista(base, aqui, la);
  check("chaves em outra ordem não contam como mudança daqui: vale a de lá", r[0].s === 9, JSON.stringify(r));
}
{
  const r = M.mesclarMapa({ x: 1, y: 2 }, { x: 1, y: 3, z: 4 }, { x: 5, y: 2, w: 6 });
  check("mapa de cores: cada lado mantém o que mudou", JSON.stringify(r) === '{"x":5,"y":3,"w":6,"z":4}', JSON.stringify(r));
  const r2 = M.mesclarMapa({ x: 1, y: 2 }, { x: 1 }, { x: 1, y: 2, q: 9 });
  check("mapa: removido aqui continua removido", JSON.stringify(r2) === '{"x":1,"q":9}', JSON.stringify(r2));
}
{
  const r = M.mesclarEditoras({ itens: [it("dc")], selecionada: "dc" }, { itens: [it("dc")], selecionada: "marvel" }, { itens: [it("dc"), it("marvel")], selecionada: "dc" });
  check("editoras: a faixa escolhida aqui fica e a editora nova de lá entra", r.selecionada === "marvel" && ids(r.itens) === "dc,marvel");
}

/* ---------- storage source, without a build or wishlist UI ---------- */
const A = await importarLib("armazenamento");
const copia = (x) => JSON.parse(JSON.stringify(x));
// Same sorted-key responses as the real server, including nested objects.
const ordenarDados = (x) => Array.isArray(x) ? x.map(ordenarDados) : x && typeof x === "object"
  ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, ordenarDados(x[k])])) : x;
async function montarDados({ ausentes = false, ecoAtraso = 5 } = {}) {
  const docs = new Map(["volumes", "colecoes", "series", "desejos", "desejosColecoes"].map((k) => ["library/" + k, { items: [] }]));
  docs.set("library/cores", { mapa: {} });
  docs.set("library/editoras", { itens: [], selecionada: "__todas__" });
  if (ausentes) { docs.delete("library/desejos"); docs.delete("library/desejosColecoes"); }
  else {
    docs.set("library/desejos", { items: [{ titulo: "Flash", id: "d1", edicoesColetadasIds: [], tambem: [{ personagem: "Batman", editora: "DC Comics" }] }] });
    docs.set("library/desejosColecoes", { items: [{ nome: "Saga", id: "cd1", membros: ["d1"], colecaoId: "c1", ordem: 2 }] });
  }
  const leituras = [], escritas = [], ouvintes = new Map(), ecos = new Set();
  const snap = (path) => {
    const body = docs.has(path) ? ordenarDados(copia(docs.get(path))) : null;
    return { exists: body !== null, data: () => body, metadata: { hasPendingWrites: false } };
  };
  const emitir = (path, s = snap(path)) => (ouvintes.get(path) || []).forEach((fn) => fn(s));
  const db = {
    doc: (path) => ({
      get: async () => { leituras.push(path); return snap(path); },
      set: async (body) => {
        escritas.push(path); docs.set(path, copia(body));
        const s = snap(path);
        const timer = setTimeout(() => { ecos.delete(timer); emitir(path, s); }, ecoAtraso);
        ecos.add(timer);
      },
      onSnapshot: (fn) => {
        if (!ouvintes.has(path)) ouvintes.set(path, new Set());
        ouvintes.get(path).add(fn);
        queueMicrotask(() => fn(snap(path)));
        return () => ouvintes.get(path).delete(fn);
      },
    }),
    collection: () => ({ get: async () => ({ docs: [] }), onSnapshot: () => () => {} }),
  };
  let lib = await A.loadLibrary(db);
  Object.assign(A.store, { db, fila: Promise.resolve(), timer: null, pendente: null, inFlight: 0, estado: null });
  const avisos = [], erros = [];
  A.store.lerLib = () => lib;
  A.store.onError = (erro) => erros.push(erro);
  A.store.aoMesclar = (mudancas, origem) => {
    lib = A.aplicarMescladas(lib, mudancas);
    avisos.push({ mudancas, origem }); // App uses this callback to show the other-device toast.
    A.scheduleSave(lib);
  };
  const parar = A.ouvirMudancas(db);
  await sleep(180); // Let the initial snapshots settle, as montar() does for App.
  return {
    db, docs, leituras, escritas, avisos, erros, ouvintes,
    lib: () => lib,
    editar: (chave, items) => { lib = { ...lib, [chave]: items }; },
    externo: (path, body, aoVivo = true) => { docs.set(path, copia(body)); if (aoVivo) emitir(path); },
    salvar: async () => { A.salvarPendente(); await A.store.fila; },
    fechar: () => {
      parar(); ecos.forEach(clearTimeout);
      if (A.store.timer) clearTimeout(A.store.timer);
      Object.assign(A.store, { db: null, timer: null, pendente: null, lerLib: null, aoMesclar: null, onError: null });
    },
  };
}

console.log("=== documentos de desejos no boot ===");
check("store declara lastDesejos e lastDesejosColecoes", A.store.lastDesejos === "" && A.store.lastDesejosColecoes === "");
{
  const m = await montarDados();
  for (const [chave, last] of [["desejos", "lastDesejos"], ["desejosColecoes", "lastDesejosColecoes"]]) {
    check("boot lê library/" + chave, m.leituras.includes("library/" + chave) && m.lib()[chave]?.length === 1);
    check("boot guarda " + last + " com chaves canônicas", A.store[last] === JSON.stringify(ordenarDados(m.docs.get("library/" + chave).items)));
    check("snapshot assina library/" + chave, m.ouvintes.has("library/" + chave));
  }
  await A.flushLibrary(m.lib());
  check("boot normalizado não regrava documentos iguais", m.escritas.length === 0);
  m.fechar();
  check("cancelar desinscreve os documentos novos", m.ouvintes.get("library/desejos")?.size === 0 && m.ouvintes.get("library/desejosColecoes")?.size === 0);
}
{
  const m = await montarDados({ ausentes: true });
  check("boot sem documentos novos dá duas listas vazias", m.lib().desejos?.length === 0 && m.lib().desejosColecoes?.length === 0);
  await A.flushLibrary(m.lib());
  check("biblioteca antiga parada não cria documentos vazios", m.escritas.length === 0);
  m.fechar();
}

for (const [chave, campo, id1, id2] of [["desejos", "titulo", "d1", "d2"], ["desejosColecoes", "nome", "cd1", "cd2"]]) {
  const path = "library/" + chave;
  const novo = chave === "desejos" ? { id: id2, titulo: "Novo", edicoesColetadasIds: [] } : { id: id2, nome: "Nova", membros: ["d2"] };
  console.log("=== fusão e eco de " + chave + " ===");
  for (const aoVivo of [false, true]) {
    const m = await montarDados();
    const base = m.docs.get(path).items;
    m.editar(chave, base.map((x) => ({ ...x, [campo]: "Edição local " + aoVivo })));
    A.scheduleSave(m.lib());
    m.externo(path, { items: [...base, novo] }, aoVivo);
    await sleep(180);
    check(chave + ": snapshot aguarda a edição pendente (aoVivo=" + aoVivo + ")", m.avisos.length === 0);
    await m.salvar();
    const items = m.docs.get(path).items;
    check(chave + ": salvar mantém adição externa e edição local (aoVivo=" + aoVivo + ")", ids(items) === id1 + "," + id2 && items[0][campo] === "Edição local " + aoVivo);
    check(chave + ": fusão volta para a biblioteca (aoVivo=" + aoVivo + ")", ids(m.lib()[chave] || []) === id1 + "," + id2 && m.avisos.some((a) => a.mudancas.some((x) => x.chave === chave)));
    check(chave + ": grava apenas o documento alterado (aoVivo=" + aoVivo + ")", m.escritas.join() === path && m.erros.length === 0);
    m.fechar();
  }
  {
    const m = await montarDados();
    m.externo(path, { items: [...m.docs.get(path).items, novo] });
    await sleep(220);
    check(chave + ": adição externa chega ao vivo", ids(m.lib()[chave] || []) === id1 + "," + id2 && m.avisos.length === 1);
    await m.salvar();
    check(chave + ": chegada externa não provoca regravação", m.escritas.length === 0);
    m.externo(path, { items: [] });
    await sleep(220);
    check(chave + ": remoção externa esvazia a lista", m.lib()[chave]?.length === 0);
    m.fechar();
  }
  {
    const m = await montarDados({ ecoAtraso: 250 });
    for (const nome of ["Primeira gravação " + chave, "Segunda gravação " + chave]) {
      m.editar(chave, m.docs.get(path).items.map((x) => ({ ...x, [campo]: nome })));
      await A.flushLibrary(m.lib());
      if (nome.startsWith("Primeira")) await sleep(180);
    }
    check(chave + ": duas edições geram duas gravações", m.escritas.length === 2 && m.escritas.every((p) => p === path));
    await sleep(450);
    check(chave + ": eco atrasado com chaves ordenadas não anuncia outro aparelho", m.avisos.length === 0 && m.erros.length === 0);
    check(chave + ": eco anterior não desfaz a edição mais recente", m.lib()[chave]?.[0]?.[campo] === "Segunda gravação " + chave);
    const antes = m.escritas.length;
    await A.flushLibrary(m.lib());
    check(chave + ": comparação canônica evita outra gravação", m.escritas.length === antes);
    m.fechar();
  }
}

console.log("=== fixados independentes por caminho ===");
{
  const m = await montarDados({ ecoAtraso: 250 });
  const padrao = "library/fixados", desejos = "library/fixadosDesejos";
  m.docs.set(padrao, { personagens: ["Batman"] });
  m.docs.set(desejos, { personagens: ["Superman"] });
  check("lerFixados sem caminho mantém o documento antigo", (await A.lerFixados(m.db)).join() === "Batman");
  check("lerFixados aceita o caminho da lista", (await A.lerFixados(m.db, desejos)).join() === "Superman");
  const vistos = [], vistosDesejos = [];
  const parar = A.ouvirFixados(m.db, (x) => vistos.push(x));
  const pararDesejos = A.ouvirFixados(m.db, (x) => vistosDesejos.push(x), desejos);
  await sleep(10);
  vistos.length = vistosDesejos.length = 0;
  await A.gravarFixados(["Flash"]);
  check("gravarFixados sem caminho mantém o documento antigo", m.docs.get(padrao).personagens.join() === "Flash" && m.docs.get(desejos).personagens.join() === "Superman");
  m.externo(desejos, { personagens: ["Flash"] });
  check("eco próprio de HQs não oculta mudança externa igual na lista", vistosDesejos.length === 1 && vistosDesejos[0].join() === "Flash");
  await A.gravarFixados(["Thor"], desejos);
  check("gravarFixados no caminho da lista preserva HQs", m.docs.get(desejos).personagens.join() === "Thor" && m.docs.get(padrao).personagens.join() === "Flash");
  m.externo(padrao, { personagens: ["Thor"] });
  check("eco próprio da lista não oculta mudança externa igual em HQs", vistos.length === 1 && vistos[0].join() === "Thor");
  await A.gravarFixados(["Hulk"], desejos);
  await sleep(350);
  check("mudança externa em HQs não limpa memória de ecos da lista", vistosDesejos.length === 1);
  m.externo(desejos, { personagens: ["Mulher-Maravilha"] });
  check("ouvirFixados entrega mudança externa no caminho da lista", vistosDesejos.at(-1)?.join() === "Mulher-Maravilha");
  parar(); pararDesejos();
  check("cancelar remove ambas as assinaturas de fixados", m.ouvintes.get(padrao)?.size === 0 && m.ouvintes.get(desejos)?.size === 0);
  check("fixados da lista não entram na biblioteca", !Object.hasOwn(m.lib(), "fixadosDesejos"));
  m.fechar();
}

// Run the source-only suites here when the app build is unavailable. The normal
// invocation still runs all existing integration cases against a fresh dist.
if (process.argv.includes("--dados")) {
  console.log("\n" + passes + " passaram, " + falhas + " falharam");
  process.exit(falhas ? 1 : 0);
}

/* ---------- the app with a db that can change under it ---------- */
const bundle = fs.readFileSync("dist/app.js", "utf8");
// ordenarChaves: the real server hands objects back with their keys sorted, whatever order they were written in.
const ordenar = (x) => Array.isArray(x) ? x.map(ordenar) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, ordenar(x[k])])) : x;
async function montar({ ecoAtraso = 5, ordenarChaves = false, docsExtra = null } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
    runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.test/",
  });
  const { window } = dom;
  const erros = [];
  window.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el }]); } unobserve() {} disconnect() {} };
  window.scrollTo = () => {};
  window.matchMedia = (q) => ({ matches: q.includes("pointer: fine"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  window.addEventListener("error", (e) => erros.push(e.error?.stack || e.message));
  window.console.error = (...a) => erros.push(a.join(" "));
  window.sessionStorage.setItem("longbox:aba", "volumes");

  const v = (id) => ({ id, titulo: "Batman " + id, personagem: "Batman", tipo: "Trade Paperback", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", ordem: 0, edicoesColetadasIds: [] });
  const docs = new Map([
    ["library/volumes", { items: ["b0", "b1", "b2", "b3"].map(v) }],
    ["library/colecoes", { items: [] }],
    ["library/desejos", { items: [] }],
    ["library/desejosColecoes", { items: [] }],
    ["library/series", { items: [{ id: "s1", nome: "Batman (Volume 1)", personagens: ["Batman"], editora: "DC Comics", anoInicio: "1940", anoFim: "2011", totalEdicoes: 1, ordem: null }] }],
    ["library/cores", { mapa: {} }],
    ["library/editoras", { itens: [{ id: "dc-comics", nome: "DC Comics", cor: null, logoAssetId: null, logoFundo: "nenhum" }], selecionada: "__todas__" }],
    ["edicoes/s1", { items: [{ id: "e1", serieId: "s1", numero: "1", mes: "", ano: "", posicao: null }] }],
  ]);
  if (docsExtra) docsExtra(docs);
  if (ordenarChaves) docs.forEach((corpo, path) => docs.set(path, ordenar(corpo)));
  const ouvintes = new Map(); // path -> Set(fn)
  const ouvintesEd = new Set();
  let gravacoes = 0;
  const snapDe = (path) => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path), metadata: { fromCache: false, hasPendingWrites: false } });
  // The server copy changes and every open listener hears about it.
  const avisar = (path) => {
    (ouvintes.get(path) || new Set()).forEach((fn) => fn(snapDe(path)));
    if (path.startsWith("edicoes/")) {
      const tipo = docs.has(path) ? "modified" : "removed";
      const ultimo = docs.get(path) || { items: [] };
      ouvintesEd.forEach((fn) => fn({ docs: [], size: 0, empty: true, metadata: { hasPendingWrites: false }, docChanges: () => [{ type: tipo, doc: { id: path.split("/").pop(), exists: tipo !== "removed", data: () => (tipo === "removed" ? ultimo : docs.get(path)) } }] }));
    }
  };
  const makeDoc = (path) => ({
    path,
    get: async () => snapDe(path),
    // The echo carries what was written at that moment, and can arrive late (ecoAtraso),
    // as the real server echo of an earlier write can land after a later write.
    set: async (body) => {
      gravacoes++;
      const copia = JSON.parse(JSON.stringify(ordenarChaves ? ordenar(body) : body));
      docs.set(path, copia);
      if (path.startsWith("library/")) {
        setTimeout(() => (ouvintes.get(path) || new Set()).forEach((fn) => fn({ ...snapDe(path), exists: true, data: () => copia })), ecoAtraso);
      } else setTimeout(() => avisar(path), 5);
    },
    delete: async () => { gravacoes++; docs.delete(path); setTimeout(() => avisar(path), 5); },
    onSnapshot: (fn) => { if (!ouvintes.has(path)) ouvintes.set(path, new Set()); ouvintes.get(path).add(fn); setTimeout(() => fn(snapDe(path)), 1); return () => ouvintes.get(path).delete(fn); },
  });
  const colecao = (cpath) => ({
    path: cpath,
    doc: (id) => makeDoc(cpath + "/" + id),
    get: async () => {
      const lista = [...docs.keys()].filter((k) => k.startsWith(cpath + "/")).map((k) => ({ id: k.split("/").pop(), data: () => docs.get(k) }));
      return { docs: lista, size: lista.length, empty: !lista.length, docChanges: () => [], metadata: {} };
    },
    onSnapshot: (fn) => {
      ouvintesEd.add(fn);
      setTimeout(() => {
        const lista = [...docs.keys()].filter((k) => k.startsWith(cpath + "/")).map((k) => ({ id: k.split("/").pop(), exists: true, data: () => docs.get(k) }));
        fn({ docs: lista, size: lista.length, empty: !lista.length, metadata: { hasPendingWrites: false }, docChanges: () => lista.map((d) => ({ type: "added", doc: d })) });
      }, 1);
      return () => ouvintesEd.delete(fn);
    },
  });
  window.claude = { use: async (name) => (name === "db" ? { doc: makeDoc, collection: colecao } : null) };
  window.eval(bundle);
  await sleep(400);
  const root = window.document.getElementById("root");
  const botao = (texto, dentro = root) => [...dentro.querySelectorAll("button")].find((b) => b.textContent.trim() === texto);
  const toast = () => root.querySelector(".toast");
  const titulos = () => [...root.querySelectorAll('.aba[data-ativa="true"] .vol .vol-title')].map((e) => e.textContent);
  const abrirHq = async (id) => {
    [...root.querySelectorAll('.aba[data-ativa="true"] .vol')].find((b) => b.textContent.includes("Batman " + id)).click();
    await sleep(150);
  };
  const sheet = () => root.querySelector('.sheet[data-in="true"]');
  const fecharSheet = async () => { sheet()?.querySelector('[aria-label="Fechar"]')?.click(); await sleep(400); };
  // Someone else writes. aoVivo: the tab hears it; otherwise the tab is stale
  // (it never got the snapshot), like the tab of 2026-09-24.
  const externo = (path, body, aoVivo) => { docs.set(path, JSON.parse(JSON.stringify(body))); if (aoVivo) avisar(path); };
  return { window, root, erros, docs, botao, toast, titulos, abrirHq, sheet, fecharSheet, externo, v, gravacoes: () => gravacoes };
}

// 2026-10-04: after the reorder features the user saw "Biblioteca atualizada em outro aparelho" over and
// over on one device. A save re-reads the document and compares it, as text, with what this tab last
// wrote; the server returns every object with its keys sorted, this tab writes them in the order it has
// (a field added later, like tambem or ordem, sits last), so the texts differed with the same data: the
// save took its own earlier write for someone else's, merged, and announced it.
console.log("=== ordem das chaves não é mudança de outro aparelho ===");
{
  const m = await montar({
    ordenarChaves: true,
    // a volume whose normalised form puts tambem last, as the server's sorted copy never does
    docsExtra: (docs) => { docs.get("library/volumes").items[1].tambem = [{ editora: "Image Comics", personagem: "Spawn" }]; },
  });
  await m.abrirHq("b0");
  m.botao("Lida", m.sheet())?.click();
  await sleep(700);
  m.botao("Lendo", m.sheet())?.click();
  await sleep(700);
  m.botao("Não lida", m.sheet())?.click();
  await sleep(1500);
  check("nenhum aviso de outro aparelho depois de três gravações seguidas", !/outro aparelho/.test(m.toast()?.textContent || ""), m.toast()?.textContent);
  check("o banco termina com a última mudança", m.docs.get("library/volumes").items.find((x) => x.id === "b0").status === "nao_lida");
  check("o volume com tambem continua inteiro", JSON.stringify(m.docs.get("library/volumes").items.find((x) => x.id === "b1").tambem) === JSON.stringify([{ editora: "Image Comics", personagem: "Spawn" }]));
  check("sem erros (ordem das chaves)", m.erros.length === 0, m.erros[0]);
}

// 2026-09-27, reported by the user with one PC open: several edits in a row, the
// app showed "Biblioteca atualizada em outro aparelho", undid the latest edits and
// then redid them. The server echo of the tab's own earlier write arrived after a
// later write, and was taken for a change made elsewhere.
console.log("=== eco atrasado da própria gravação ===");
{
  const m = await montar({ ecoAtraso: 900 });
  await m.abrirHq("b0");
  const status = () => m.sheet()?.querySelector('.seg3 [aria-pressed="true"]')?.textContent;
  m.botao("Lida", m.sheet())?.click();
  await sleep(650); // saved "lida"; its echo is still on the way
  m.botao("Lendo", m.sheet())?.click();
  const vistos = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 2600) { vistos.push(status()); await sleep(40); }
  const depoisDeLendo = vistos.slice(vistos.indexOf("Lendo"));
  check("a tela nunca volta para a mudança anterior", !depoisDeLendo.includes("Lida"), [...new Set(vistos)].join(" > "));
  check("sem aviso falso de outro aparelho", !/outro aparelho/.test(m.toast()?.textContent || ""), m.toast()?.textContent);
  check("o banco termina com a última mudança", m.docs.get("library/volumes").items.find((x) => x.id === "b0").status === "lendo");
  check("sem erros (eco atrasado)", m.erros.length === 0, m.erros[0]);
}

console.log("=== aba desatualizada: o caso de 2026-09-24 ===");
{
  const m = await montar();
  check("começa com 4 HQs", m.titulos().length === 4, m.titulos().join(", "));
  const vinte = Array.from({ length: 20 }, (_, i) => m.v("n" + i));
  m.externo("library/volumes", { items: [...m.docs.get("library/volumes").items, ...vinte] }, false);
  check("a aba não ficou sabendo (continua com 4)", m.titulos().length === 4);
  await m.abrirHq("b0");
  m.botao("Lida", m.sheet())?.click();
  await sleep(900);
  const itens = m.docs.get("library/volumes").items;
  check("o banco mantém os 20 volumes que chegaram de fora", itens.length === 24, itens.length);
  check("e a mudança feita na aba", itens.find((x) => x.id === "b0").status === "lida");
  await m.fecharSheet();
  check("os 20 aparecem na tela depois de salvar", m.titulos().length === 24, m.titulos().length);
  check("com um aviso discreto", /Biblioteca atualizada em outro aparelho/.test(m.toast()?.textContent || ""), m.toast()?.textContent);
  check("sem erros (aba desatualizada)", m.erros.length === 0, m.erros[0]);
}

console.log("=== mudança de fora chega ao vivo ===");
{
  const m = await montar();
  const antes = m.gravacoes();
  m.externo("library/volumes", { items: [...m.docs.get("library/volumes").items, m.v("n50")] }, true);
  await sleep(500);
  check("o volume novo aparece sem recarregar", m.titulos().includes("Batman n50"), m.titulos().join(", "));
  check("com o aviso", /Biblioteca atualizada em outro aparelho/.test(m.toast()?.textContent || ""));
  await sleep(800);
  check("e a aba não regrava nada por causa disso", m.gravacoes() === antes, m.gravacoes() - antes);
  // An edição shard written elsewhere lands too.
  m.externo("edicoes/s1", { items: [...m.docs.get("edicoes/s1").items, { id: "e2", serieId: "s1", numero: "2", mes: "", ano: "", posicao: null }] }, true);
  await sleep(500);
  await sleep(800);
  check("edições novas de fora não geram regravação", m.gravacoes() === antes, m.gravacoes() - antes);
  check("sem erros (ao vivo)", m.erros.length === 0, m.erros[0]);
}

console.log("=== remover aqui enquanto chega volume lá ===");
{
  const m = await montar();
  m.externo("library/volumes", { items: [...m.docs.get("library/volumes").items, m.v("n60")] }, false);
  await m.abrirHq("b3");
  m.sheet()?.querySelector('[aria-label="Remover"]')?.click();
  await sleep(900);
  const itens = m.docs.get("library/volumes").items.map((x) => x.id);
  check("a remoção daqui vale", !itens.includes("b3"), itens.join(","));
  check("o volume que chegou de fora fica", itens.includes("n60"), itens.join(","));
}

console.log("=== o mesmo volume mudado nos dois lados ===");
{
  const m = await montar();
  const lista = m.docs.get("library/volumes").items.map((x) => (x.id === "b1" ? { ...x, notas: "de fora" } : x.id === "b2" ? { ...x, titulo: "Batman b2 revisto" } : x));
  m.externo("library/volumes", { items: lista }, false);
  await m.abrirHq("b1");
  m.botao("Lida", m.sheet())?.click();
  await sleep(900);
  const itens = m.docs.get("library/volumes").items;
  check("no volume mexido aqui, vence a mudança daqui", itens.find((x) => x.id === "b1").status === "lida");
  check("no volume mexido só lá, vale o de lá", itens.find((x) => x.id === "b2").titulo === "Batman b2 revisto");
}

console.log("=== chegada de fora cancela o desfazer ===");
{
  const m = await montar();
  await m.abrirHq("b2");
  m.sheet()?.querySelector('[aria-label="Remover"]')?.click();
  await sleep(900);
  check("desfazer oferecido depois de remover", !!(m.toast() && m.botao("Desfazer", m.toast())));
  m.externo("library/volumes", { items: [...m.docs.get("library/volumes").items, m.v("n70")] }, true);
  await sleep(500);
  check("depois da mudança de fora o desfazer some", !(m.toast() && m.botao("Desfazer", m.toast())));
  check("e o volume novo está na tela", m.titulos().includes("Batman n70"));
}

console.log("=== biblioteca parada não custa nada ===");
{
  const m = await montar();
  const antes = m.gravacoes();
  // The periodic refresh hands over the same objects again.
  for (let i = 0; i < 5; i++) { m.externo("library/volumes", m.docs.get("library/volumes"), true); await sleep(50); }
  await sleep(900);
  check("snapshots repetidos não geram gravação", m.gravacoes() === antes, m.gravacoes() - antes);
  check("nem aviso", !/Biblioteca atualizada/.test(m.toast()?.textContent || ""));
  check("sem erros (parada)", m.erros.length === 0, m.erros[0]);
}

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
