import { JSDOM } from "jsdom";
import fs from "node:fs";
import esbuild from "esbuild";

// One owned copy, several publisher presences. UI exercises the built app;
// pure model checks follow the same in-memory module pattern as test-edicoes.
const bundle = fs.readFileSync("dist/app.js", "utf8");
let falhas = 0, passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const j = JSON.stringify;
const vol = (id, titulo, personagem, editora, extra = {}) => ({
  id, titulo, personagem, editora, tipo: "Trade Paperback", ano: "2020",
  status: "nao_lida", notas: "", edicoesColetadasIds: [], ...extra,
});
const volumes = [
  vol("dc", "Batman: Ano Um", "Batman", "DC Comics"),
  vol("dupla", "Encontro dos heróis", "Batman", "DC Comics", {
    tambem: [{ editora: "Image Comics", personagem: "Spawn" }], ordem: 0, status: "lida",
  }),
  vol("image", "Spawn: Origens", "Spawn", "Image Comics", { ordem: 1 }),
];
const ed = (id, nome, h) => ({ id, nome, cor: { h }, logoAssetId: null, logoFundo: "nenhum" });

async function montar({ aba = "volumes", editoraSel = "__todas__", vols = volumes, colecoes = [], series = [], editoras } = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.test/",
  });
  const { window: W } = dom;
  const erros = [];
  W.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el }]); } unobserve() {} disconnect() {} };
  W.scrollTo = () => {};
  W.matchMedia = (q) => ({ matches: q.includes("pointer: fine"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  W.addEventListener("error", (e) => erros.push(e.error?.stack || e.message));
  W.console.error = (...a) => erros.push(a.join(" "));
  W.sessionStorage.setItem("longbox:aba", aba);
  const docs = new Map([
    ["library/volumes", { items: JSON.parse(j(vols)) }],
    ["library/colecoes", { items: colecoes }],
    ["library/series", { items: series }],
    ["library/cores", { mapa: {} }],
    ["library/editoras", { itens: editoras || [ed("dc", "DC Comics", 220), ed("image", "Image Comics", 25), ed("marvel", "Marvel Comics", 0)], selecionada: editoraSel }],
  ]);
  const makeDoc = (path) => ({
    path,
    get: async () => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path), metadata: {} }),
    set: async (body) => docs.set(path, JSON.parse(j(body))),
    delete: async () => docs.delete(path),
  });
  W.claude = { use: async (n) => n === "db" ? {
    doc: makeDoc,
    collection: (c) => ({ doc: (id) => makeDoc(c + "/" + id), get: async () => ({ docs: [], size: 0, empty: true, docChanges: () => [], metadata: {} }) }),
  } : null };
  W.eval(bundle);
  await sleep(450);
  const root = W.document.getElementById("root");
  const ativo = () => root.querySelector('.aba[data-ativa="true"]');
  const cards = () => [...(ativo()?.querySelectorAll(".vol") || [])];
  const titulos = () => cards().map((v) => v.querySelector(".vol-title")?.textContent);
  const grupo = (p) => [...(ativo()?.querySelectorAll(".group") || [])].find((g) => g.querySelector("h2")?.textContent === p);
  const modal = () => root.querySelector(".modal");
  const campo = (label) => [...(modal()?.querySelectorAll(".field") || [])].find((f) => f.querySelector("label")?.textContent === label)?.querySelector("input");
  const digitar = async (el, value) => {
    Object.getOwnPropertyDescriptor(W.HTMLInputElement.prototype, "value").set.call(el, value);
    el.dispatchEvent(new W.Event("input", { bubbles: true }));
    await sleep(100);
  };
  const escolher = async (el, nome) => {
    el.click(); await sleep(60);
    [...el.closest(".pfiltro").querySelectorAll('[role="option"]')].find((o) => o.textContent === nome)?.click();
    await sleep(120);
  };
  const tecla = async (key) => {
    W.document.body.dispatchEvent(new W.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    await sleep(200);
  };
  const abrir = async (titulo) => { cards().find((v) => v.querySelector(".vol-title")?.textContent === titulo)?.click(); await sleep(200); };
  const fechar = async () => { root.querySelector('.sheet [aria-label="Fechar"]')?.click(); await sleep(400); };
  const salvar = async () => { modal()?.querySelector(".btn-primary")?.click(); await sleep(750); };
  const salvo = (id) => docs.get("library/volumes").items.find((v) => v.id === id);
  const personagens = async () => {
    if (!root.querySelector("#filtro-personagem")) { root.querySelector(".btn-filtros")?.click(); await sleep(100); }
    const input = root.querySelector("#filtro-personagem");
    input.focus(); input.click(); await sleep(100);
    const nomes = [...root.querySelectorAll('#filtro-personagem-lista [role="option"] .sug-title')].map((o) => o.textContent);
    input.blur(); await sleep(60);
    return nomes;
  };
  return { W, root, erros, docs, cards, titulos, grupo, modal, campo, digitar, escolher, tecla, abrir, fechar, salvar, salvo, personagens };
}

console.log("=== faixas, filtros e busca ===");
const dc = await montar({ editoraSel: "dc" });
check("DC agrupa o crossover em Batman", dc.grupo("Batman")?.querySelectorAll(".vol").length === 2 && dc.titulos().includes("Encontro dos heróis"));
check("DC mantém o volume antigo e exclui Image puro", dc.titulos().includes("Batman: Ano Um") && !dc.titulos().includes("Spawn: Origens"));
check("personagens da faixa DC", (await dc.personagens()).join() === "Todos os personagens,Batman");
const image = await montar({ editoraSel: "image" });
check("Image agrupa o crossover em Spawn", image.grupo("Spawn")?.querySelectorAll(".vol").length === 2 && !image.grupo("Batman"));
check("Image preserva a ordem manual", image.titulos().join() === "Encontro dos heróis,Spawn: Origens");
check("personagens da faixa Image", (await image.personagens()).join() === "Todos os personagens,Spawn");
check("holdColor segue Image", image.cards()[0]?.style.getPropertyValue("--hold-color") === image.cards()[1]?.style.getPropertyValue("--hold-color") && !!image.cards()[0]?.style.getPropertyValue("--hold-color"));
image.root.querySelector('[aria-label="Fixar Spawn no topo"]')?.click(); await sleep(120);
check("fixado usa personagem projetado", image.root.querySelector('[aria-label="Fixar Spawn no topo"]')?.getAttribute("aria-pressed") === "true");
const todas = await montar();
check("Todas mostra cada cópia uma vez", todas.cards().length === 3 && todas.titulos().filter((t) => t === "Encontro dos heróis").length === 1);
check("Todas usa o personagem primário", todas.grupo("Batman")?.querySelectorAll(".vol").length === 2 && todas.grupo("Spawn")?.querySelectorAll(".vol").length === 1);
check("contagem HQs não dobra", todas.root.querySelector(".ed-note")?.textContent === "3 HQs");
const busca = todas.root.querySelector("#busca-acervo"); busca.focus();
await todas.digitar(busca, "Spawn");
check("busca Spawn acha o crossover em Todas", todas.titulos().includes("Encontro dos heróis") && todas.cards().length === 2);
const sugestao = [...todas.root.querySelectorAll("#busca-sugestoes .sug-row")].find((r) => r.textContent.includes("Encontro dos heróis"));
check("sugestão informa segunda editora e personagem", /Spawn/.test(sugestao?.textContent || "") && /Image Comics/.test(sugestao?.textContent || ""));
await todas.digitar(busca, ""); busca.blur();
await todas.abrir("Encontro dos heróis");
const dd = (nome) => [...todas.root.querySelectorAll(".sheet dt")].find((d) => d.textContent === nome)?.nextElementSibling?.textContent;
check("ficha mostra duas editoras", dd("Editora") === "DC Comics · Image Comics");
check("ficha mostra um personagem por editora", dd("Personagem") === "Batman (DC Comics) · Spawn (Image Comics)");

console.log("=== coleções e séries ===");
const colecoes = [
  { id: "c-dc", nome: "Coleção DC", descricao: "", membros: ["dc"] },
  { id: "c-image", nome: "Coleção Image", descricao: "", membros: ["image"] },
  { id: "c-marvel", nome: "Coleção Marvel", descricao: "", membros: ["marvel"] },
];
const col = await montar({ aba: "colecoes", vols: [...volumes, vol("marvel", "Marvel solo", "Thor", "Marvel Comics")], colecoes });
async function oferecidos(nome) {
  const secao = [...col.root.querySelectorAll(".coll")].find((s) => s.querySelector("h2")?.textContent === nome);
  [...secao.querySelectorAll("button")].find((b) => b.textContent === "Gerenciar").click(); await sleep(150);
  const input = col.root.querySelector('.sheet input[aria-label="Adicionar volumes"]');
  input.focus(); input.click(); await sleep(100);
  const nomes = [...col.root.querySelectorAll('.sheet .escolha-lista [role="option"] .sug-title')].map((r) => r.textContent);
  await col.fechar();
  return nomes;
}
check("coleção DC oferece o crossover", (await oferecidos("Coleção DC")).includes("Encontro dos heróis"));
check("coleção Image oferece o crossover", (await oferecidos("Coleção Image")).includes("Encontro dos heróis"));
check("coleção Marvel recusa o crossover", !(await oferecidos("Coleção Marvel")).includes("Encontro dos heróis"));
const colImage = await montar({ aba: "colecoes", editoraSel: "image", colecoes: [{ id: "dupla", nome: "Só crossover", descricao: "", membros: ["dupla"] }] });
check("faixa Image mostra coleção com crossover primário DC", [...colImage.root.querySelectorAll(".coll h2")].some((h) => h.textContent === "Só crossover"));
const ser = await montar({ series: [
  { id: "sdc", nome: "Série DC", editora: "DC Comics", personagem: "Batman" },
  { id: "sim", nome: "Série Image", editora: "Image Comics", personagem: "Spawn" },
  { id: "sm", nome: "Série Marvel", editora: "Marvel Comics", personagem: "Thor" },
] });
await ser.abrir("Encontro dos heróis");
[...ser.root.querySelectorAll(".sheet button")].find((b) => /Vincular edições de uma série/.test(b.textContent))?.click(); await sleep(100);
const picker = ser.root.querySelector("#vincular-serie");
check("placeholder da série informa ambas", picker?.placeholder === "Buscar séries da DC Comics e Image Comics");
picker.focus(); picker.click(); await sleep(100);
const seriesOferecidas = [...ser.root.querySelectorAll('#vincular-serie-lista [role="option"] .sug-title')].map((r) => r.textContent);
check("lock da série aceita ambas e recusa Marvel", seriesOferecidas.includes("Série DC") && seriesOferecidas.includes("Série Image") && !seriesOferecidas.includes("Série Marvel"));

console.log("=== formulário, edição e duplicação ===");
const form = await montar({ editoraSel: "dc" });
await form.tecla("n");
const segundo = () => form.root.querySelector("#form-volume-editora2");
check("segunda editora começa Nenhuma", segundo()?.textContent === "Nenhuma" && !form.campo("Personagem nessa editora"));
await form.digitar(form.campo("Título"), "Novo crossover");
await form.digitar(form.campo("Personagem principal"), "Batman");
await form.escolher(segundo(), "Image Comics");
check("personagem secundário tem placeholder do primário", form.campo("Personagem nessa editora")?.placeholder === "Batman");
await form.digitar(form.campo("Personagem nessa editora"), "Spawn");
await form.salvar();
const novoId = form.docs.get("library/volumes").items.find((v) => v.titulo === "Novo crossover")?.id;
check("criar salva tambem", j(form.salvo(novoId)?.tambem) === j([{ editora: "Image Comics", personagem: "Spawn" }]));
check("estado temporário não vai ao volume", !!form.salvo(novoId) && !("editora2" in form.salvo(novoId)) && !("personagem2" in form.salvo(novoId)));
await form.tecla("e");
check("edição preenche ambos os campos", segundo()?.textContent === "Image Comics" && form.campo("Personagem nessa editora")?.value === "Spawn");
await form.salvar();
check("salvar sem mexer preserva tambem", j(form.salvo(novoId)?.tambem) === j([{ editora: "Image Comics", personagem: "Spawn" }]));
await form.tecla("e");
await form.escolher(segundo(), "DC Comics");
await form.salvar();
check("mesma editora duas vezes mostra erro", /Escolha uma editora diferente da editora principal/.test(form.modal()?.textContent || ""));
check("validação não altera o registro", form.salvo(novoId)?.tambem?.[0]?.editora === "Image Comics");
await form.escolher(segundo(), "Nenhuma");
await form.salvar();
check("limpar segunda editora remove a chave", !!form.salvo(novoId) && !("tambem" in form.salvo(novoId)));
await form.tecla("e");
await form.escolher(segundo(), "Image Comics");
await form.salvar();
check("personagem vazio herda o primário", form.salvo(novoId)?.tambem?.[0]?.personagem === "Batman");
await form.fechar();
await form.abrir("Encontro dos heróis");
form.root.querySelector('[aria-label="Duplicar este volume"]')?.click(); await sleep(200);
check("duplicar preenche a segunda editora", segundo()?.textContent === "Image Comics" && form.campo("Personagem nessa editora")?.value === "Spawn");
await form.digitar(form.campo("Título"), "Crossover duplicado");
await form.salvar();
check("duplicar salva as duas presenças", form.docs.get("library/volumes").items.find((v) => v.titulo === "Crossover duplicado")?.tambem?.[0]?.personagem === "Spawn");
await form.fechar();
await form.tecla("n");
await form.digitar(form.campo("Título"), "Crossover contínuo");
await form.digitar(form.campo("Personagem principal"), "Batman");
await form.escolher(segundo(), "Image Comics");
await form.digitar(form.campo("Personagem nessa editora"), "Spawn");
[...form.modal().querySelectorAll("button")].find((b) => b.textContent === "Salvar e cadastrar outro")?.click(); await sleep(750);
check("salvar e continuar também salva tambem", form.docs.get("library/volumes").items.find((v) => v.titulo === "Crossover contínuo")?.tambem?.[0]?.personagem === "Spawn");
check("continuar mantém campos para o próximo volume", !!form.modal() && form.campo("Título")?.value === "" && segundo()?.textContent === "Image Comics" && form.campo("Personagem nessa editora")?.value === "Spawn");

console.log("=== reordenar projeções ===");
// JSDOM has no layout: measure slots from the live DOM order, plus the group's
// drop area. The keyed nodes themselves must survive React's reorder.
const drag = await montar({ editoraSel: "image" });
const [primeiro, outro] = drag.cards();
const outsideBandBefore = j(drag.salvo("dc"));
const rect = (left) => ({ left, right: left + 90, top: 0, bottom: 130, width: 90, height: 130 });
const grid = primeiro.closest("[data-hq-grid]");
const group = grid.closest("section.group");
grid.getBoundingClientRect = () => ({ left: 0, right: 190, top: 0, bottom: 130, width: 190, height: 130 });
primeiro.getBoundingClientRect = () => rect([...grid.children].indexOf(primeiro) * 100);
outro.getBoundingClientRect = () => rect([...grid.children].indexOf(outro) * 100);
let captures = 0;
primeiro.setPointerCapture = () => { captures++; };
primeiro.releasePointerCapture = () => {};
const pointer = (type, x) => primeiro.dispatchEvent(new drag.W.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: 40 }));
pointer("pointerdown", 40); await sleep(500);
const liftedAncestors = [];
for (let el = grid.parentElement; el && el !== drag.W.document.body; el = el.parentElement) liftedAncestors.push(el);
check("drag eleva ancestrais abaixo do chrome", liftedAncestors.every((el) =>
  el.style.getPropertyValue("z-index") === "14" && el.style.getPropertyPriority("z-index") === "important"));
const beforeQuickPass = drag.cards();
pointer("pointermove", 160); await sleep(40);
const duringQuickPass = drag.cards();
pointer("pointermove", 40); await sleep(260);
const afterQuickPass = drag.cards();
check("drag ignora passagem rápida por outro slot", [duringQuickPass, afterQuickPass].every((cards) =>
  cards.length === beforeQuickPass.length && cards.every((card, i) => card === beforeQuickPass[i])));
const moveAllowed = pointer("pointermove", 160); await sleep(260);
check("drag mantém o mesmo nó DOM ao trocar de slot", drag.cards()[1] === primeiro && grid.contains(primeiro));
check("drag segue o ponto de pega no slot atual", primeiro.style.transform === "translate(20px, 0px) scale(1.06)", primeiro.style.transform);
check("drag renova captura após a mudança de slot", captures >= 3, captures);
check("drag impede o movimento nativo do ponteiro", moveAllowed === false);
check("drag não aplica FLIP ao card levantado", primeiro.style.transition === "none" && outro.style.transition === "transform 260ms var(--ease-out)");
pointer("pointermove", 40); await sleep(260);
check("drag aceita novo alvo durante os 260ms de FLIP", drag.cards()[0] === primeiro);
pointer("pointermove", 160); await sleep(260);
check("drag interrompe FLIP novamente sem avançar por etapas", drag.cards()[1] === primeiro);
// Once slots are recorded, an animated neighbour rect cannot affect targeting.
const neighbourRect = outro.getBoundingClientRect;
outro.getBoundingClientRect = () => rect(150);
await sleep(250);
check("drag parado ignora a geometria animada do vizinho", drag.cards()[1] === primeiro);
outro.getBoundingClientRect = neighbourRect;
pointer("pointermove", 95); await sleep(260);
check("drag no espaço entre slots mantém a prévia", drag.cards()[1] === primeiro);
pointer("pointermove", 160); await sleep(100);
const touch = new drag.W.Event("touchmove", { bubbles: true, cancelable: true });
primeiro.closest("[data-hq-grid]").dispatchEvent(touch);
check("drag armado bloqueia touchmove na grade (v160)", touch.defaultPrevented);
check("drag armado eleva o grupo sem elevar a grade", grid.style.zIndex === "" && group.style.zIndex === "14");
pointer("pointerup", 160); await sleep(750);
check("drag acomodado restaura grade e grupo", grid.style.zIndex === "" && group.style.zIndex === "");
const touchOcioso = new drag.W.Event("touchmove", { bubbles: true, cancelable: true });
primeiro.closest("[data-hq-grid]").dispatchEvent(touchOcioso);
check("sem drag armado o touchmove rola a página (v160)", !touchOcioso.defaultPrevented);
check("drag na Image muda a ordem exibida", drag.titulos().join() === "Spawn: Origens,Encontro dos heróis");
check("drag grava ordem no volume real", drag.salvo("dupla")?.ordem === 1 && drag.salvo("image")?.ordem === 0);
check("drag preserva par primário e tambem", drag.salvo("dupla")?.editora === "DC Comics" && drag.salvo("dupla")?.personagem === "Batman" && drag.salvo("dupla")?.tambem?.[0]?.personagem === "Spawn");
check("drag não remove volumes fora da faixa", !!drag.salvo("dc") && drag.docs.get("library/volumes").items.length === 3);
check("drag deixa todos os campos fora da faixa intocados", j(drag.salvo("dc")) === outsideBandBefore);
check("drag restaura as camadas depois de acomodar", liftedAncestors.every((el) => !el.style.getPropertyValue("z-index")));
primeiro.click(); await sleep(100);
check("drag suprime o clique do gesto", !drag.root.querySelector('.sheet[data-in="true"]'));

const savedOrder = j(drag.docs.get("library/volumes"));
pointer("pointerdown", 140); await sleep(500);
pointer("pointermove", 40); await sleep(260);
pointer("pointermove", 400); await sleep(260);
check("drag fora da grade restaura a ordem inicial", drag.titulos().join() === "Spawn: Origens,Encontro dos heróis");
check("drag continua seguindo fora da grade", primeiro.style.transform === "translate(260px, 0px) scale(1.06)", primeiro.style.transform);
pointer("pointerup", 400); await sleep(750);
check("soltar fora da grade não persiste a prévia", j(drag.docs.get("library/volumes")) === savedOrder);
check("cancelamento remove lift e transform depois de acomodar", !primeiro.dataset.dragging && !primeiro.dataset.dragSettling && primeiro.style.transform === "");

pointer("pointerdown", 140); await sleep(500);
pointer("pointermove", 40); await sleep(260);
pointer("pointercancel", 40); await sleep(750);
check("pointercancel dentro da grade também cancela", j(drag.docs.get("library/volumes")) === savedOrder && drag.cards()[1] === primeiro);

pointer("pointerdown", 140); await sleep(500);
pointer("pointermove", 40); await sleep(260);
drag.W.dispatchEvent(new drag.W.Event("blur")); await sleep(750);
check("blur encerra o gesto sem persistir", j(drag.docs.get("library/volumes")) === savedOrder && !primeiro.dataset.dragging);

pointer("pointerdown", 140); await sleep(500);
pointer("pointermove", 40);
pointer("pointerup", 40); await sleep(750);
check("soltar aplica o alvo imediatamente sem dwell", drag.salvo("dupla")?.ordem === 0 && drag.salvo("image")?.ordem === 1);

console.log("=== hub e descoberta ===");
const hub = await montar({ aba: "hub" });
const coluna = (nome) => [...hub.root.querySelectorAll(".retrato-col")].find((c) => c.querySelector("h3")?.textContent === nome);
const nEditora = (nome) => [...(coluna("Editoras")?.querySelectorAll(".retrato-linha") || [])].find((l) => l.querySelector(".retrato-nome")?.textContent === nome)?.querySelector(".retrato-valor")?.textContent;
check("hub conta crossover em DC e Image", nEditora("DC Comics") === "2" && nEditora("Image Comics") === "2");
check("leitura no hub conta só três volumes", /1\s*de 3/.test(coluna("Leitura")?.querySelector(".retrato-destaque")?.textContent || ""));
const descoberta = await montar({ vols: [volumes[1]], editoras: [ed("dc", "DC Comics", 220)] });
await descoberta.escolher(descoberta.root.querySelector("#filtro-editora"), "Image Comics");
check("descobre editora presente apenas em tambem", descoberta.root.querySelector("#filtro-editora")?.textContent === "Image Comics" && descoberta.grupo("Spawn")?.querySelectorAll(".vol").length === 1);

console.log("=== modelo e normalização ===");
const out = esbuild.buildSync({ stdin: { contents: 'export { presencas, editorasDe, naFaixa } from "./src/lib/constantes"; export { normalizeLib } from "./src/lib/biblioteca";', resolveDir: process.cwd() }, bundle: true, format: "esm", write: false });
const { presencas, editorasDe, naFaixa, normalizeLib } = await import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
const estranho = { editora: " DC Comics ", personagem: " Batman ", tambem: [null, {}, { editora: 7 }, { editora: "dc comics", personagem: "Outro" }, { editora: " Image Comics ", personagem: " Spawn " }, { editora: "Dark Horse", personagem: "Hellboy" }] };
check("presencas limpa, deduplica e tolera N", j(presencas(estranho)) === j([{ editora: "DC Comics", personagem: "Batman" }, { editora: "Image Comics", personagem: "Spawn" }, { editora: "Dark Horse", personagem: "Hellboy" }]));
check("editorasDe série e vazio mantêm contrato", j(editorasDe({ editora: " DC Comics " })) === '["DC Comics"]' && j(editorasDe({ editora: " " })) === "[]");
check("projeção ignora caixa sem alterar original", naFaixa(estranho, "image comics")?.personagem === "Spawn" && estranho.personagem === " Batman " && naFaixa(estranho, "Marvel") === null);
check("campo tambem malformado não quebra helpers", presencas({ ...volumes[0], tambem: {} }).length === 1 && presencas(null).length === 0);
const normal = normalizeLib({ volumes: [
  { ...volumes[0], tambem: [null, {}, { editora: " " , personagem: "X" }, { editora: 1, personagem: "X" }, { editora: "Image", personagem: 1 }, { editora: " Image Comics ", personagem: " Spawn " }] },
  { ...volumes[0], id: "vazio", tambem: [] },
  { ...volumes[0], id: "objeto", tambem: {} },
  volumes[0],
  { ...volumes[0], id: "invalidas", tambem: [null, { editora: "Image" }, { editora: "", personagem: "Spawn" }] },
] }).volumes;
check("normalizeLib descarta entradas inválidas", j(normal[0].tambem) === j([{ editora: "Image Comics", personagem: "Spawn" }]));
check("normalizeLib omite chave vazia e malformada", !("tambem" in normal[1]) && !("tambem" in normal[2]) && !("tambem" in normal[4]));
check("volume existente sem tambem fica igual", j(normal[3]) === j(volumes[0]));
check("nenhum erro nas montagens", [dc, image, todas, col, colImage, ser, form, drag, hub, descoberta].every((m) => !m.erros.length), [dc, image, todas, col, colImage, ser, form, drag, hub, descoberta].flatMap((m) => m.erros)[0]);

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
