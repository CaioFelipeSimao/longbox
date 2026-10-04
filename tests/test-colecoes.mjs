import { JSDOM } from "jsdom";
import fs from "node:fs";

// v66: the collection manage sheet folds its reading order (kept per session) and
// offers a colour for the collection's spine bar, but only while that bar is on
// screen. JSDOM computes no layout, so every strip would measure 0 wide and no bar
// would ever show; scrollWidth and clientWidth are stubbed per strip instead, one
// collection overflowing and one fitting, which is exactly the fact the sheet
// depends on.
//
// v80: the sheet no longer asks the bar. A folded collection has no strip, and
// its colour option vanished with it, so the sheet works the answer out from the
// column's width instead. .content is stubbed 560 wide to match the strips.

const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0;
let passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function montar({ sessao = {}, docsIniciais } = {}) {
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
  for (const [k, v] of Object.entries(sessao)) window.sessionStorage.setItem(k, v);

  // A strip holding more than four covers overflows; four or fewer fit.
  const P = window.HTMLElement.prototype;
  Object.defineProperty(P, "scrollWidth", { configurable: true, get() {
    return this.classList && this.classList.contains("coll-strip") ? this.children.length * 138 : 0;
  } });
  Object.defineProperty(P, "clientWidth", { configurable: true, get() {
    return this.classList && (this.classList.contains("coll-strip") || this.classList.contains("content")) ? 560 : 0;
  } });

  const v = (id) => ({ id, titulo: "Batman " + id, personagem: "Batman", tipo: "Encadernado (TPB)", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: [] });
  const volumes = Array.from({ length: 10 }, (_, i) => v("b" + i));
  const docs = new Map(docsIniciais || [
    ["library/volumes", { items: volumes }],
    ["library/colecoes", { items: [
      { id: "longa", nome: "Longa", descricao: "", membros: volumes.slice(0, 8).map((x) => x.id) },
      { id: "curta", nome: "Curta", descricao: "", membros: volumes.slice(0, 3).map((x) => x.id) },
    ] }],
    ["library/series", { items: [] }],
    ["library/cores", { mapa: {} }],
  ]);
  const makeDoc = (path) => ({
    path,
    get: async () => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path), metadata: { fromCache: false, hasPendingWrites: false } }),
    set: async (body) => { docs.set(path, body); },
    delete: async () => { docs.delete(path); },
  });
  window.claude = {
    use: async (name) => name === "db" ? {
      doc: makeDoc,
      collection: (cpath) => ({ path: cpath, doc: (id) => makeDoc(cpath + "/" + id), get: async () => ({ docs: [], size: 0, empty: true, docChanges: () => [], metadata: {} }) }),
    } : null,
  };
  window.eval(bundle);
  await sleep(400);
  const root = window.document.getElementById("root");
  const secao = (nome) => [...root.querySelectorAll(".coll")].find((s) => s.querySelector("h2")?.textContent === nome);
  const gerenciar = async (nome) => {
    [...secao(nome).querySelectorAll("button")].find((b) => b.textContent === "Gerenciar").click();
    await sleep(120);
  };
  const fechar = async () => { root.querySelector('.sheet [aria-label="Fechar"]').click(); await sleep(400); };
  return { window, root, erros, docs, secao, gerenciar, fechar };
}

console.log("=== coleções: primeira montagem ===");
const m1 = await montar({ sessao: { "longbox:aba": "colecoes" } });
check("barra da coleção longa aparece", !m1.secao("Longa").querySelector(".shelf-bar").hidden);
check("barra da coleção curta fica escondida", m1.secao("Curta").querySelector(".shelf-bar").hidden);

await m1.gerenciar("Longa");
const sheet = () => m1.root.querySelector(".sheet[data-in='true']") || m1.root.querySelector(".sheet");
const head = () => m1.root.querySelector(".ordem-head");
check("ordem de leitura tem cabeçalho dobrável", head() && head().getAttribute("aria-expanded") === "true");
check("lista aberta mostra os 8", m1.root.querySelectorAll('.sheet .ordem-linha').length === 8);
check("cor da barra oferecida quando a barra existe", !!m1.root.querySelector(".cor-barra"));
const headCor = () => m1.root.querySelector(".cor-barra .ordem-head");
check("cor da barra tem cabeçalho aberto", headCor()?.getAttribute("aria-expanded") === "true");
check("começa na cor da editora", /Usando a cor da editora/.test(m1.root.querySelector(".cor-barra").textContent));

head().click(); await sleep(80);
check("recolher esconde a lista", head().getAttribute("aria-expanded") === "false" && m1.root.querySelectorAll('.sheet .ordem-linha').length === 0);
check("recolhido mostra a contagem", head().textContent.includes("8"));
const guardado = m1.window.sessionStorage.getItem("longbox:ordem-recolhida");
check("recolhido gravado na sessão", guardado === JSON.stringify(["longa"]), guardado);

const sw = m1.root.querySelectorAll(".cor-barra .swatch");
// v67: the character palette (30 + 3 neutrals) plus the Longbox cyan among the neutrals.
check("paleta dos personagens mais o ciano Longbox", sw.length === 34, sw.length);
const nomes = [...m1.root.querySelectorAll(".cor-barra .dica-swatch")].map((d) => d.dataset.dica);
check("toda cor tem nome", nomes.length === 34 && nomes.every((n) => n && n !== "Cor"), nomes.filter((n) => !n || n === "Cor").length);
check("nomes não se repetem", new Set(nomes).size === 34);
check("o nome também é o rótulo acessível", [...sw].every((b) => b.getAttribute("aria-label") === b.parentElement.dataset.dica));
const ciano = [...sw].find((b) => b.getAttribute("aria-label") === "Ciano Longbox");
check("ciano Longbox está nos neutros", !!ciano && nomes.indexOf("Ciano Longbox") === 33);
ciano.click(); await sleep(700);
const docCiano = m1.docs.get("library/colecoes").items.find((c) => c.id === "longa");
check("ciano salvo como marcador, não como matiz", docCiano.corBarra && docCiano.corBarra.longbox === true && docCiano.corBarra.h === undefined, JSON.stringify(docCiano.corBarra));
check("barra lê o ciano ao vivo", m1.secao("Longa").querySelector(".shelf-wrap").style.getPropertyValue("--shelf-cor") === "var(--accent)");
check("só o ciano aparece marcado", m1.root.querySelectorAll(".cor-barra .swatch[data-on=\"true\"]").length === 1 && ciano.dataset.on === "true");
// Writes are debounced 500ms (scheduleSave), so wait past that before reading the db.
sw[4].click(); await sleep(700);
const doc = m1.docs.get("library/colecoes").items.find((c) => c.id === "longa");
check("cor salva na coleção", doc.corBarra && typeof doc.corBarra.h === "number", JSON.stringify(doc.corBarra));
const wrap = m1.secao("Longa").querySelector(".shelf-wrap");
check("barra pinta com a cor escolhida", wrap.style.getPropertyValue("--shelf-cor") !== "", wrap.getAttribute("style"));
check("botão oferece voltar à cor da editora", /Voltar para a cor da editora/.test(m1.root.querySelector(".cor-barra").textContent));
check("outra coleção não pega a cor", !m1.secao("Curta").querySelector(".shelf-wrap").style.getPropertyValue("--shelf-cor"));

[...m1.root.querySelectorAll(".cor-barra button")].find((b) => /Voltar para a cor da editora/.test(b.textContent)).click();
await sleep(700);
const doc2 = m1.docs.get("library/colecoes").items.find((c) => c.id === "longa");
check("voltar remove a cor da coleção", !("corBarra" in doc2), JSON.stringify(doc2));
check("barra volta a seguir a editora", !m1.secao("Longa").querySelector(".shelf-wrap").style.getPropertyValue("--shelf-cor"));
headCor()?.click(); await sleep(80);
check("recolher a cor esconde paleta e controles", headCor()?.getAttribute("aria-expanded") === "false" && m1.root.querySelectorAll(".cor-barra .swatch").length === 0 && !/Neutros|Usando a cor da editora/.test(m1.root.querySelector(".cor-barra").textContent));
const corGuardada = m1.window.sessionStorage.getItem("longbox:cor-recolhida");
check("cor recolhida gravada na sessão", corGuardada === JSON.stringify(["longa"]), corGuardada);
await m1.fechar();
await m1.gerenciar("Longa");
check("reabrir mantém a cor recolhida", headCor()?.getAttribute("aria-expanded") === "false" && m1.root.querySelectorAll(".cor-barra .swatch").length === 0);
headCor()?.click(); await sleep(80);
check("expandir a cor devolve a paleta", headCor()?.getAttribute("aria-expanded") === "true" && m1.root.querySelectorAll(".cor-barra .swatch").length === 34);
headCor()?.click(); await sleep(80);
await m1.fechar();

await m1.gerenciar("Curta");
check("sem barra, sem opção de cor", !m1.root.querySelector(".cor-barra"));
check("a curta não herda o recolhido da longa", m1.root.querySelector(".ordem-head").getAttribute("aria-expanded") === "true");
await m1.fechar();

// v80: folded to its title the strip is gone, but the colour option stays.
m1.secao("Longa").querySelector('[aria-label="Esconder os volumes de Longa"]').click();
await sleep(120);
check("longa escondida não tem faixa montada", !m1.secao("Longa").querySelector(".coll-strip"));
await m1.gerenciar("Longa");
check("escondida ainda oferece a cor da barra", !!m1.root.querySelector(".cor-barra"));
await m1.fechar();
m1.secao("Curta").querySelector('[aria-label="Esconder os volumes de Curta"]').click();
await sleep(120);
await m1.gerenciar("Curta");
check("curta escondida continua sem opção de cor", !m1.root.querySelector(".cor-barra"));
check("sem erros (1)", m1.erros.length === 0, m1.erros[0]);

console.log("=== segunda montagem: recarregar ===");
const m2 = await montar({ sessao: { "longbox:aba": "colecoes", "longbox:ordem-recolhida": guardado, "longbox:cor-recolhida": corGuardada } });
await m2.gerenciar("Longa");
check("recarregar mantém a ordem recolhida", m2.root.querySelector(".ordem-head").getAttribute("aria-expanded") === "false");
check("recarregar mantém a cor recolhida", m2.root.querySelector(".cor-barra .ordem-head")?.getAttribute("aria-expanded") === "false");

console.log("=== terceira montagem: visita nova ===");
const m3 = await montar({ sessao: { "longbox:aba": "colecoes" } });
await m3.gerenciar("Longa");
check("visita nova abre a ordem", m3.root.querySelector(".ordem-head").getAttribute("aria-expanded") === "true");
check("visita nova abre a cor", m3.root.querySelector(".cor-barra .ordem-head")?.getAttribute("aria-expanded") === "true");

// v120: the reading order reads, it does not administer. Reorder and removal live in an
// "Editar ordem" mode; labels name the volume; removal from the collection can be undone.
console.log("=== quarta montagem: editar ordem ===");
const m4 = await montar({ sessao: { "longbox:aba": "colecoes" } });
await m4.gerenciar("Longa");
const R = m4.root;
const linhas = () => [...R.querySelectorAll(".sheet .ordem-linha")];
const titulos = () => linhas().map((l) => l.querySelector(".ordem-titulo")?.textContent);
const botao = (txt) => [...R.querySelectorAll(".sheet button")].find((b) => b.textContent.trim() === txt);
check("leitura: nenhum mover nem tirar", R.querySelectorAll('.sheet [aria-label^="Mover"], .sheet [aria-label^="Tirar"]').length === 0);
check("leitura: Lidas até aqui em cada linha", R.querySelectorAll(".sheet .ordem-ate").length === 8);
check("um personagem só: sem o nome repetido na linha", R.querySelectorAll(".sheet .ordem-sub").length === 0);
botao("Editar ordem")?.click(); await sleep(120);
check("editar: mover e tirar com o nome do volume", !!(R.querySelector('.sheet [aria-label="Mover Batman b0 para baixo"]') && R.querySelector('.sheet [aria-label="Tirar Batman b0 da coleção"]')));
check("editar: sem Lidas até aqui", R.querySelectorAll(".sheet .ordem-ate").length === 0);
check("editar: botão Pronto", !!botao("Pronto"));
const desce = R.querySelector('.sheet [aria-label="Mover Batman b0 para baixo"]');
if (desce) {
  desce.focus();
  desce.dispatchEvent(new m4.window.KeyboardEvent("keydown", { key: "ArrowDown", altKey: true, bubbles: true, cancelable: true }));
  await sleep(150);
}
check("Alt+↓ desce o volume", titulos()[0] === "Batman b1" && titulos()[1] === "Batman b0", titulos().slice(0, 2).join(","));
check("o foco vai junto", m4.window.document.activeElement?.closest?.(".ordem-linha") === linhas()[1]);
m4.window.document.activeElement.dispatchEvent(new m4.window.KeyboardEvent("keydown", { key: "ArrowUp", altKey: true, bubbles: true, cancelable: true }));
await sleep(150);
check("Alt+↑ sobe de volta", titulos()[0] === "Batman b0", titulos()[0]);
R.querySelector('.sheet [aria-label="Tirar Batman b2 da coleção"]')?.click();
await sleep(150);
const t4 = R.querySelector(".toast")?.textContent || "";
check("tirar mostra o nome e Desfazer", /Batman b2/.test(t4) && !!R.querySelector(".toast button"), t4);
check("tirou", linhas().length === 7, linhas().length);
R.querySelector(".toast button")?.click(); await sleep(150);
check("Desfazer devolve na mesma posição", linhas().length === 8 && titulos()[2] === "Batman b2", titulos().join(","));
botao("Pronto")?.click(); await sleep(120);
check("Pronto volta à leitura", R.querySelectorAll('.sheet [aria-label^="Mover"]').length === 0 && R.querySelectorAll(".sheet .ordem-ate").length === 8);
check("sem erros (4)", m4.erros.length === 0, m4.erros[0]);

// v138: "Adicionar volumes" is a search field in the Longbox look (the native select
// opened an OS list, white and wider than the field) and picks several at once, in
// the order tapped, the collection's own characters suggested first.
console.log("=== quinta montagem: adicionar vários ===");
{
  const bat = (id) => ({ id, titulo: "Batman " + id, personagem: "Batman", tipo: "Trade Paperback", editora: "DC Comics", ano: "2020", status: "nao_lida", notas: "", edicoesColetadasIds: [] });
  const outro = (id, titulo, personagem) => ({ ...bat(id), titulo, personagem });
  const vols = [outro("fl", "Flash: Renascimento", "Flash"), outro("su", "Superman: Ação", "Superman"), ...Array.from({ length: 6 }, (_, i) => bat("b" + i)),
    { ...outro("dd", "Demolidor por Bendis", "Daredevil"), editora: "Marvel" }];
  const m5 = await montar({ sessao: { "longbox:aba": "colecoes" }, docsIniciais: [
    ["library/volumes", { items: vols }],
    ["library/colecoes", { items: [{ id: "c", nome: "Saga", descricao: "", membros: ["b0", "b1"] }] }],
    ["library/series", { items: [] }],
    ["library/cores", { mapa: {} }],
  ] });
  const R = m5.root;
  await m5.gerenciar("Saga");
  const W = m5.window;
  check("sem select nativo para adicionar", ![...R.querySelectorAll(".sheet select")].some((s) => /Escolha um volume/.test(s.textContent)));
  const campo = R.querySelector('.sheet input[aria-label="Adicionar volumes"]');
  check("campo de busca existe", !!campo);
  const digitar = async (t) => {
    const set = Object.getOwnPropertyDescriptor(W.HTMLInputElement.prototype, "value").set;
    set.call(campo, t);
    campo.dispatchEvent(new W.Event("input", { bubbles: true }));
    await sleep(80);
  };
  const linhas = () => [...R.querySelectorAll(".sheet .escolha-lista [role=option]")];
  const nomes = () => linhas().map((l) => l.querySelector(".sug-title").textContent);
  const tocar = async (nome) => { linhas().find((l) => l.querySelector(".sug-title").textContent === nome)?.click(); await sleep(80); };
  campo?.focus(); campo?.click(); await sleep(80);
  check("lista abre com os que faltam, só da editora", linhas().length === 6, linhas().length);
  // v139: a collection is locked to its volumes' publisher.
  check("campo diz a editora", /DC Comics/.test(campo?.placeholder), campo?.placeholder);
  await digitar("demol");
  check("Marvel fica fora de coleção DC", linhas().length === 0, nomes().join());
  await digitar("");
  check("personagem da coleção primeiro", nomes().length > 0 && nomes().slice(0, 4).every((n) => n.startsWith("Batman")), nomes().join(","));
  await digitar("acao");
  check("busca sem acento", nomes().join() === "Superman: Ação", nomes().join());
  await tocar("Superman: Ação");
  await digitar("flash");
  await tocar("Flash: Renascimento");
  await digitar("");
  await tocar("Batman b4");
  check("lista continua aberta", linhas().length > 0);
  const ordem = (nome) => linhas().find((l) => l.querySelector(".sug-title").textContent === nome)?.querySelector(".escolha-ordem")?.textContent;
  check("número na ordem do toque", ordem("Superman: Ação") === "1" && ordem("Flash: Renascimento") === "2" && ordem("Batman b4") === "3");
  const botaoAdd = () => [...R.querySelectorAll(".sheet button")].find((b) => /^Adicionar \d/.test(b.textContent));
  check("botão conta 3", botaoAdd()?.textContent === "Adicionar 3 volumes", botaoAdd()?.textContent);
  await tocar("Batman b4");
  check("tocar de novo desmarca", botaoAdd()?.textContent === "Adicionar 2 volumes" && !ordem("Batman b4"), botaoAdd()?.textContent);
  // Dispatch through the document listener before clicking: the action must not
  // collapse the list and move away from the pointer between down and click.
  const adicionarDois = botaoAdd();
  adicionarDois?.dispatchEvent(new W.Event("pointerdown", { bubbles: true }));
  await sleep(80);
  check("pointerdown em Adicionar mantém a lista aberta", campo.getAttribute("aria-expanded") === "true" && linhas().length > 0);
  adicionarDois?.click(); await sleep(150);
  const titulosOrdem = () => [...R.querySelectorAll(".sheet .ordem-titulo")].map((p) => p.textContent);
  check("entram na ordem do toque", titulosOrdem().join() === "Batman b0,Batman b1,Superman: Ação,Flash: Renascimento", titulosOrdem().join());
  check("seleção zera", !botaoAdd());
  const t5 = R.querySelector(".toast")?.textContent || "";
  check("aviso com Desfazer", /2 volumes/.test(t5) && !!R.querySelector(".toast button"), t5);
  await sleep(700);
  check("salvo no db", m5.docs.get("library/colecoes").items[0].membros.join() === "b0,b1,su,fl", m5.docs.get("library/colecoes").items[0].membros.join());
  R.querySelector(".toast button")?.click(); await sleep(150);
  check("Desfazer tira os dois", titulosOrdem().length === 2, titulosOrdem().join());
  check("sem erros (5)", m5.erros.length === 0, m5.erros[0]);
}

// v139: the last native selects go (their open list is the OS's, white-bordered):
// a read volume's status in the reading order, the série picker in a volume's
// "Vincular edições", and Tipo and Editora in the volume form. The série picker is
// a search locked to the volume's publisher, its character's séries first.
console.log("=== sexta montagem: sem selects nativos ===");
{
  const vol = (id, titulo, personagem, editora, status) => ({ id, titulo, personagem, tipo: "Trade Paperback", editora, ano: "2020", status, notas: "", edicoesColetadasIds: [] });
  const serie = (id, nome, personagem, editora) => ({ id, nome, personagens: [{ nome: personagem, de: null, ate: null }], editora, anoInicio: "2016", anoFim: "", totalEdicoes: 10, ordem: null });
  const m6 = await montar({ sessao: { "longbox:aba": "colecoes" }, docsIniciais: [
    ["library/volumes", { items: [vol("b0", "Batman: Ano Um", "Batman", "DC Comics", "lida"), vol("dd", "Demolidor", "Daredevil", "Marvel", "nao_lida")] }],
    ["library/colecoes", { items: [{ id: "c", nome: "Saga", descricao: "", membros: ["b0"] }] }],
    ["library/series", { items: [serie("s1", "Superman (2018)", "Superman", "DC Comics"), serie("s2", "Batman (2016)", "Batman", "DC Comics"), serie("s3", "Daredevil (1998)", "Daredevil", "Marvel")] }],
    ["library/cores", { mapa: {} }],
  ] });
  const R = m6.root;
  const W = m6.window;
  const opcoes = (el) => [...(el?.closest(".pfiltro, .escolha") || R).querySelectorAll("[role=option]")];

  await m6.gerenciar("Saga");
  check("status na ordem sem select nativo", R.querySelectorAll(".sheet select").length === 0, R.querySelectorAll(".sheet select").length);
  const st = R.querySelector('.sheet [role=combobox][aria-label="Status de leitura de Batman: Ano Um"]');
  check("status é o seletor do Longbox", st?.textContent === "Lida", st?.textContent);
  st?.click(); await sleep(80);
  opcoes(st).find((o) => o.textContent.startsWith("Lendo"))?.click(); await sleep(150);
  check("trocar o status funciona", !!R.querySelector(".sheet .ordem-ate"), R.querySelector(".sheet .ordem-linha")?.textContent);
  await m6.fechar();

  [...R.querySelectorAll(".coll .vol")].find((b) => /Batman: Ano Um/.test(b.textContent))?.click(); await sleep(200);
  [...R.querySelectorAll(".sheet button")].find((b) => /Vincular edições/.test(b.textContent))?.click(); await sleep(120);
  check("série sem select nativo", R.querySelectorAll(".sheet select").length === 0);
  const busca = R.querySelector('.sheet input[aria-label="Buscar série"]');
  check("busca de série existe", !!busca);
  busca?.focus(); busca?.click(); await sleep(80);
  const nomesS = () => opcoes(busca).map((o) => o.querySelector(".sug-title").textContent);
  check("só séries da editora do volume, personagem primeiro", nomesS().join() === "Batman (2016),Superman (2018)", nomesS().join());
  check("campo diz a editora", /DC Comics/.test(busca?.placeholder), busca?.placeholder);
  opcoes(busca).find((o) => /Batman/.test(o.textContent))?.click(); await sleep(120);
  check("tocar na série abre o vínculo", /Batman \(2016\)/.test(R.querySelector(".sheet .linked-serie")?.textContent || ""), R.querySelector(".sheet .linked-serie")?.textContent);

  R.querySelector('.sheet [aria-label="Editar"]')?.click(); await sleep(200);
  check("formulário sem select nativo", R.querySelectorAll(".modal select").length === 0, R.querySelectorAll(".modal select").length);
  const tipo = R.querySelector('.modal [role=combobox][aria-label="Tipo"]');
  const editora = R.querySelector('.modal [role=combobox][aria-label="Editora"]');
  check("tipo e editora são o seletor do Longbox", tipo?.textContent === "Trade Paperback" && editora?.textContent === "DC Comics", (tipo?.textContent) + " / " + (editora?.textContent));
  tipo?.click(); await sleep(80);
  opcoes(tipo).find((o) => o.textContent === "Hardcover")?.click(); await sleep(80);
  check("trocar o tipo funciona", tipo?.textContent === "Hardcover", tipo?.textContent);
  check("sem erros (6)", m6.erros.length === 0, m6.erros[0]);
}

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
