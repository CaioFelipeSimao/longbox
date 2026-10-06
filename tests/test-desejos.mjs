import assert from "node:assert/strict";
import { importarLib } from "./helpers/importar-lib.mjs";

let passes = 0, falhas = 0;
const teste = (nome, fn) => {
  try { fn(); passes++; console.log("  PASS " + nome); }
  catch (erro) { falhas++; console.log("  FAIL " + nome + ": " + erro.message); }
};
const congelar = (x) => {
  if (x && typeof x === "object") { Object.values(x).forEach(congelar); Object.freeze(x); }
  return x;
};
const ids = (itens) => itens.map((x) => x.id);
// Same physical ownership rule as App, with no UI import.
const possuidas = (lib) => {
  const s = new Set();
  lib.volumes.forEach((v) => v.edicoesColetadasIds.forEach((id) => s.add(id)));
  return s;
};
let D;
try { D = await importarLib("desejos"); }
catch (erro) {
  console.log("  FAIL importar src/lib/desejos.js: " + erro.message);
  console.log("\n0 passaram, 1 falharam");
  process.exit(1);
}

const sagaIds = ["d18", "d19", "d20", "d21"];
const lib = congelar({
  volumes: Array.from({ length: 17 }, (_, i) => ({ id: "v" + (i + 1), personagem: "Flash", ordem: i,
    status: "lida", edicoesColetadasIds: ["e" + (i + 1)] })),
  colecoes: [{ id: "c1", nome: "A Saga do Flash Collection", corBarra: "#dc0000", descricao: "Acervo", membros: Array.from({ length: 17 }, (_, i) => "v" + (i + 1)) }],
  desejos: [
    ...sagaIds.map((id, i) => ({ id, titulo: "A Saga do Flash " + (18 + i), personagem: "Flash", editora: "DC Comics",
      tipo: "Trade Paperback", edicoesColetadasIds: i === 0 ? ["e1", "e18"] : ["e" + (18 + i)],
      capaAssetId: "capa-" + id, mini: "mini-" + id, notas: "Loja R$ 100", ordem: 100 + i, ordemSeries: ["s1"] })),
    { id: "solto", titulo: "Flash Rébirth", personagem: "Flash", editora: "DC Comics", tipo: "Omnibus", ordem: 8, edicoesColetadasIds: ["e22"] },
    { id: "marvel", titulo: "Homem-Aranha", personagem: "Homem-Aranha", editora: "Marvel", tipo: "Hardcover", edicoesColetadasIds: [] },
    { id: "duplo", titulo: "Encontro", personagem: "Batman", editora: "DC Comics", tipo: "Omnibus", edicoesColetadasIds: [], tambem: [{ editora: "Marvel", personagem: "Thor" }] },
  ],
  desejosColecoes: [{ id: "cd1", nome: "A Saga do Flash Collection", corBarra: "#123456", descricao: "Faltantes", membros: sagaIds, colecaoId: "c1", ordem: 3 }],
  series: [{ id: "s1", nome: "Flash" }], edicoes: [{ id: "e1", serieId: "s1" }, { id: "e18", serieId: "s1" }],
  cores: { Flash: "#ff0000" }, editoras: [], editoraSel: "marvel",
});
const variante = (campos) => congelar({ ...lib, ...campos });
const cd = lib.desejosColecoes[0];
const todas = D.filtrarDesejos(lib, {});
const grupo = (grupos, editora, nome) => grupos.find((g) => g.editora === editora)?.personagens.find((p) => p.nome === nome);

teste("01 referências de coleção válidas, ausentes e órfãs", () => {
  assert.equal(D.colecaoDoAcervo(lib, cd), lib.colecoes[0]);
  assert.equal(D.colecaoDoAcervo(lib, { colecaoId: "apagada" }), null);
  assert.equal(D.colecaoDoAcervo(lib, {}), null);
  assert.equal(D.colecaoDoDesejo(lib, "d19"), cd);
  assert.equal(D.colecaoDoDesejo(lib, "solto"), null);
  assert.equal(D.colecaoDoDesejo(lib, "inexistente"), null);
});
teste("02 numeração 18 a 21, ou 1 a 4 sem acervo válido", () => {
  assert.deepEqual(sagaIds.map((_, i) => D.numeroNaFaixa(lib, cd, i)), [18, 19, 20, 21]);
  for (const c of [{ membros: sagaIds }, { ...cd, colecaoId: "apagada" }])
    assert.deepEqual(sagaIds.map((_, i) => D.numeroNaFaixa(lib, c, i)), [1, 2, 3, 4]);
});
teste("03 compra preserva dados, define status e ordem no fim do personagem", () => {
  const depois = D.comprarDesejo(lib, "d18", () => { throw Error("não deve criar coleção"); });
  assert.deepEqual(depois.volumes.at(-1), { ...lib.desejos[0], status: "nao_lida", ordem: 17 });
  assert(!depois.desejos.some((d) => d.id === "d18"));
  assert.deepEqual(depois.colecoes[0].membros, [...lib.colecoes[0].membros, "d18"]);
  assert.deepEqual(depois.desejosColecoes[0].membros, ["d19", "d20", "d21"]);
  assert.equal(depois.series, lib.series);
  assert.equal(depois.edicoes, lib.edicoes);
});
teste("04 compras sequenciais removem a coleção da lista e mantêm a sequência", () => {
  let atual = lib;
  sagaIds.forEach((id) => { atual = congelar(D.comprarDesejo(atual, id)); });
  assert.deepEqual(atual.desejosColecoes, []);
  assert.deepEqual(atual.colecoes[0].membros, [...lib.colecoes[0].membros, ...sagaIds]);
  assert.deepEqual(atual.volumes.slice(-4).map((v) => v.ordem), [17, 18, 19, 20]);
  assert.deepEqual(ids(atual.desejos), ["solto", "marvel", "duplo"]);
});
teste("05 compra fora de sequência limita a inserção ao fim", () => {
  const depois = D.comprarDesejo(lib, "d20");
  assert.deepEqual(depois.colecoes[0].membros, [...lib.colecoes[0].membros, "d20"]);
  assert.deepEqual(depois.desejosColecoes[0].membros, ["d18", "d19", "d21"]);
});
teste("06 coleção nova copia metadados e a segunda compra reutiliza seu id", () => {
  const { colecaoId, ...nova } = cd;
  const antes = variante({ desejosColecoes: [nova] });
  let chamadas = 0;
  const primeiro = congelar(D.comprarDesejo(antes, "d18", () => { chamadas++; return "nova"; }));
  assert.deepEqual(primeiro.colecoes.at(-1), { id: "nova", nome: cd.nome, corBarra: cd.corBarra, descricao: cd.descricao, membros: ["d18"] });
  assert.equal(primeiro.desejosColecoes[0].colecaoId, "nova");
  const segundo = D.comprarDesejo(primeiro, "d19", () => { chamadas++; return "outra"; });
  assert.equal(chamadas, 1);
  assert.equal(segundo.colecoes.length, 2);
  assert.deepEqual(segundo.colecoes.at(-1).membros, ["d18", "d19"]);
  const automatico = D.comprarDesejo(antes, "d18");
  assert.equal(typeof automatico.colecoes.at(-1).id, "string");
  assert(automatico.colecoes.at(-1).id.length > 0);
  assert.equal(automatico.desejosColecoes[0].colecaoId, automatico.colecoes.at(-1).id);
});
teste("07 coleção órfã cria uma nova e substitui o vínculo apagado", () => {
  const antes = variante({ desejosColecoes: [{ ...cd, colecaoId: "apagada" }] });
  const depois = D.comprarDesejo(antes, "d18", () => "substituta");
  assert.equal(depois.desejosColecoes[0].colecaoId, "substituta");
  assert.deepEqual(depois.colecoes.at(-1).membros, ["d18"]);
  assert.deepEqual(depois.colecoes[0], lib.colecoes[0]);
});
teste("08 desejo solto só vira volume e recebe a ordem do acervo", () => {
  const antes = variante({ desejosColecoes: [...lib.desejosColecoes, { id: "vazia", nome: "Rascunho", membros: [] }] });
  const depois = D.comprarDesejo(antes, "solto");
  assert.equal(depois.volumes.at(-1).ordem, 17);
  assert.equal(depois.volumes.at(-1).status, "nao_lida");
  assert.deepEqual(depois.colecoes, lib.colecoes);
  assert.deepEqual(depois.desejosColecoes, antes.desejosColecoes);
});
teste("09 sem ordem numérica no personagem, compra descarta a ordem do desejo", () => {
  for (const volumes of [lib.volumes, [...lib.volumes, { id: "m1", personagem: "Homem-Aranha", ordem: null, edicoesColetadasIds: [] }]]) {
    const antes = variante({ volumes, desejos: [{ ...lib.desejos[5], ordem: 99 }] });
    assert(!Object.hasOwn(D.comprarDesejo(antes, "marvel").volumes.at(-1), "ordem"));
  }
});
teste("10 ordem considera só números do mesmo personagem, inclusive negativos e zero", () => {
  for (const [ordem, esperado] of [[-3, -2], [0, 1]]) {
    const antes = variante({ volumes: [{ id: "f", personagem: "Flash", ordem, edicoesColetadasIds: [] },
      { id: "b", personagem: "Batman", ordem: 1000, edicoesColetadasIds: [] },
      { id: "f2", personagem: "Flash", ordem: null, edicoesColetadasIds: [] }] });
    assert.equal(D.comprarDesejo(antes, "solto").volumes.at(-1).ordem, esperado);
  }
});
teste("11 desejo inexistente não altera a biblioteca nem gera id", () => {
  assert.equal(D.comprarDesejo(lib, "inexistente", () => { throw Error("id inesperado"); }), lib);
});
teste("12 desejo não muda posse ou progresso antes da compra", () => {
  const semLista = variante({ desejos: [], desejosColecoes: [] });
  assert.deepEqual(possuidas(lib), possuidas(semLista));
  assert.equal(lib.edicoes.filter((e) => possuidas(lib).has(e.id)).length, 1);
  const depois = D.comprarDesejo(lib, "d18");
  assert.deepEqual(possuidas(depois), new Set([...possuidas(lib), "e18"]));
  assert.equal(depois.edicoes.filter((e) => possuidas(depois).has(e.id)).length, 2);
});
teste("13 último membro e Desfazer preservam exatamente as duas coleções", () => {
  for (const colecaoId of ["c1", undefined]) {
    const antes = variante({ desejosColecoes: [{ ...cd, membros: ["d18"], colecaoId }] });
    const snapshot = structuredClone(antes);
    const depois = D.comprarDesejo(antes, "d18", () => "nova");
    assert.deepEqual(depois.desejosColecoes, []);
    assert.notDeepEqual(depois.colecoes, antes.colecoes);
    // App's undo restores `antes` wholesale; no undo API belongs in this module.
    const desfazer = { antes, depois };
    const restaurada = desfazer.antes;
    assert.deepEqual(restaurada, snapshot);
    assert.deepEqual(restaurada.desejosColecoes, snapshot.desejosColecoes);
    assert.deepEqual(restaurada.colecoes, snapshot.colecoes);
  }
});
teste("14 filtros vazios retornam Set com todos os ids", () => {
  assert(todas instanceof Set);
  assert.deepEqual(todas, new Set(ids(lib.desejos)));
  assert.deepEqual(D.filtrarDesejos(lib, { busca: "  ", tipo: "", personagem: "", editora: "" }), todas);
});
teste("15 busca no nome da coleção traz todos os seus membros", () => {
  const antes = variante({ desejosColecoes: [{ ...cd, nome: "Coleção Especial" }] });
  assert.deepEqual(D.filtrarDesejos(antes, { busca: " COLECAO ESPECIAL " }), new Set(sagaIds));
  assert.deepEqual(D.filtrarDesejos(lib, { busca: "saga" }), new Set(sagaIds));
});
teste("16 busca no título ignora acento e caixa e não busca notas", () => {
  assert.deepEqual(D.filtrarDesejos(lib, { busca: "FLASH REBIRTH" }), new Set(["solto"]));
  assert.deepEqual(D.filtrarDesejos(lib, { busca: "Loja" }), new Set());
});
teste("17 filtro de formato combina com busca e personagem", () => {
  assert.deepEqual(D.filtrarDesejos(lib, { tipo: "Omnibus", personagem: "Flash", busca: "rebirth" }), new Set(["solto"]));
  assert.deepEqual(D.filtrarDesejos(lib, { tipo: "Hardcover", busca: "saga" }), new Set());
});
teste("18 editora inclui tambem e exclui os demais desejos", () => {
  assert.deepEqual(D.filtrarDesejos(lib, { editora: "Marvel" }), new Set(["marvel", "duplo"]));
  assert.deepEqual(D.filtrarDesejos(variante({ desejos: lib.desejos.filter((d) => d.id !== "duplo") }), { editora: "Marvel" }), new Set(["marvel"]));
});
teste("19 personagem e editora de tambem participam dos filtros", () => {
  assert.deepEqual(D.filtrarDesejos(lib, { personagem: "Thor", editora: "Marvel" }), new Set(["duplo"]));
  assert.deepEqual(D.filtrarDesejos(lib, { personagem: "Batman" }), new Set(["duplo"]));
  const antes = variante({ desejos: [{ id: "acentos", titulo: "HQ", personagem: "Fênix", editora: "Árvore", tipo: "Edição Especial" }] });
  assert.deepEqual(D.filtrarDesejos(antes, { personagem: "FENIX", editora: "arvore", tipo: "EDICAO ESPECIAL" }), new Set(["acentos"]));
});
teste("20 agrupamento respeita editoras, fixados, tambem e separação dos soltos", () => {
  const grupos = D.agruparDesejos(lib, todas, congelar(["Flash", "Thor"]));
  assert.deepEqual(grupos.map((g) => g.editora), ["DC Comics", "Marvel"]);
  assert.deepEqual(grupos[0].personagens.map((p) => p.nome), ["Flash", "Batman"]);
  assert.deepEqual(grupos[1].personagens.map((p) => p.nome), ["Thor", "Homem-Aranha"]);
  assert.deepEqual(ids(grupo(grupos, "DC Comics", "Flash").soltos), ["solto"]);
  assert.deepEqual(grupo(grupos, "DC Comics", "Flash").colecoes, [{ colecao: cd, membros: lib.desejos.slice(0, 4) }]);
  assert.deepEqual(ids(grupo(grupos, "Marvel", "Thor").soltos), ["duplo"]);
  assert.deepEqual(ids(grupo(grupos, "DC Comics", "Batman").soltos), ["duplo"]);
  const antes = variante({ desejos: ["Zulu", "Batman", "Aquaman", "Flash"].map((personagem) => ({ id: personagem, personagem, editora: "DC Comics", titulo: personagem })), desejosColecoes: [] });
  const ordenados = D.agruparDesejos(antes, D.filtrarDesejos(antes, {}), congelar(["Zulu", "Flash"]));
  assert.deepEqual(ordenados[0].personagens.map((p) => p.nome), ["Zulu", "Flash", "Aquaman", "Batman"]);
});
teste("21 editoras em pt-BR e Sem editora por último, sem perder tambem", () => {
  const antes = variante({ desejos: [{ id: "z", editora: "Zulu", personagem: "Z" },
    { id: "a", editora: "Árvore", personagem: "A" }, { id: "s", editora: "  ", personagem: "S", tambem: [{ editora: "Marvel", personagem: "Thor" }] }], desejosColecoes: [] });
  const grupos = D.agruparDesejos(antes, D.filtrarDesejos(antes, {}), []);
  assert.deepEqual(grupos.map((g) => g.editora), ["Árvore", "Marvel", "Zulu", "Sem editora"]);
  assert.deepEqual(ids(grupo(grupos, "Sem editora", "S").soltos), ["s"]);
  assert.deepEqual(ids(grupo(grupos, "Marvel", "Thor").soltos), ["s"]);
  assert.deepEqual(D.filtrarDesejos(antes, { editora: "Sem editora" }), new Set(["s"]));
});
teste("22 soltos por ordem e título, sem ordem por último", () => {
  const antes = variante({ desejos: [{ id: "z", titulo: "Z", ordem: 1 }, { id: "b", titulo: "B", ordem: 0 },
    { id: "a", titulo: "A", ordem: 0 }, { id: "n", titulo: "A", ordem: null }, { id: "u", titulo: "Z" }].map((d) => ({ ...d, editora: "DC Comics", personagem: "Flash" })), desejosColecoes: [] });
  const g = D.agruparDesejos(antes, D.filtrarDesejos(antes, {}), []);
  assert.deepEqual(ids(grupo(g, "DC Comics", "Flash").soltos), ["a", "b", "z", "n", "u"]);
});
teste("23 coleções por ordem e nome, membros na ordem da faixa", () => {
  const antes = variante({ desejosColecoes: [{ ...cd, membros: ["d21", "d18"], ordem: 1 },
    { id: "b", nome: "B", membros: ["d19"], ordem: 0 }, { id: "a", nome: "A", membros: ["d20"], ordem: 0 },
    { id: "n", nome: "Sem ordem", membros: ["solto"] }] });
  const colecoes = grupo(D.agruparDesejos(antes, todas, []), "DC Comics", "Flash").colecoes;
  assert.deepEqual(colecoes.map((c) => c.colecao.id), ["a", "b", "cd1", "n"]);
  assert.deepEqual(ids(colecoes[2].membros), ["d21", "d18"]);
});
teste("24 filtro omite grupos vazios e preserva o primeiro membro como dono da coleção", () => {
  const antes = variante({ desejos: lib.desejos.map((d) => d.id === "d19" ? { ...d, editora: "Marvel", personagem: "Thor" } : d) });
  const grupos = D.agruparDesejos(antes, new Set(["d19"]), []);
  assert.deepEqual(grupos.map((g) => g.editora), ["DC Comics"]);
  assert.deepEqual(grupos[0].personagens.map((p) => p.nome), ["Flash"]);
  assert.deepEqual(ids(grupos[0].personagens[0].colecoes[0].membros), ["d19"]);
  assert.deepEqual(grupos[0].personagens[0].soltos, []);
  assert.deepEqual(D.agruparDesejos(lib, new Set(["inexistente"]), []), []);
});
teste("25 coleção também aparece nas presenças do primeiro membro", () => {
  const antes = variante({ desejosColecoes: [{ id: "dupla", nome: "Encontro", membros: ["duplo", "marvel"] }] });
  const grupos = D.agruparDesejos(antes, new Set(["marvel"]), []);
  for (const [editora, personagem] of [["DC Comics", "Batman"], ["Marvel", "Thor"]])
    assert.deepEqual(ids(grupo(grupos, editora, personagem).colecoes[0].membros), ["marvel"]);
});
teste("26 todas as funções preservam a biblioteca profundamente congelada", () => {
  const snapshot = structuredClone(lib);
  D.colecaoDoAcervo(lib, cd); D.colecaoDoDesejo(lib, "d18"); D.numeroNaFaixa(lib, cd, 0);
  D.filtrarDesejos(lib, congelar({ busca: "saga", editora: "DC Comics" }));
  D.agruparDesejos(lib, todas, congelar(["Flash"])); D.comprarDesejo(lib, "d18");
  assert.deepEqual(lib, snapshot);
  assert(Object.isFrozen(lib.desejos[0].edicoesColetadasIds));
  assert(Object.isFrozen(lib.colecoes[0].membros));
  assert(Object.isFrozen(lib.desejosColecoes[0].membros));
});

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
