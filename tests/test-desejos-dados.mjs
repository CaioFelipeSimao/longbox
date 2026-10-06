import { isDeepStrictEqual } from "node:util";
import { importarLib } from "./helpers/importar-lib.mjs";

const B = await importarLib("biblioteca");
let passes = 0, falhas = 0;
const check = (nome, ok) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome);
};
const igual = isDeepStrictEqual;
const congelar = (x) => {
  if (x && typeof x === "object") { Object.values(x).forEach(congelar); Object.freeze(x); }
  return x;
};

console.log("=== normalização dos desejos ===");
const antiga = B.normalizeLib({ volumes: [] });
check("backup antigo importa desejos vazios", igual(antiga.desejos, []));
check("backup antigo importa coleções da lista vazias", igual(antiga.desejosColecoes, []));
const invalidas = B.normalizeLib({ desejos: {}, desejosColecoes: null });
check("listas inválidas viram arrays vazios", igual(invalidas.desejos, []) && igual(invalidas.desejosColecoes, []));
const raw = congelar({
  volumes: [{ id: "v1", status: "lida", tipo: "Encadernado (TPB)", edicoesColetadasIds: null }],
  desejos: [{ id: "d1", status: "lida", tipo: "Encadernado (TPB)", edicoesColetadasIds: null,
    tambem: [null, { editora: " DC Comics ", personagem: " Flash " }, { editora: "", personagem: "Batman" }],
    ordemSeries: ["s1", "s2"] },
    { id: "d2", tambem: {}, ordemSeries: ["s1", ""], edicoesColetadasIds: "e1" }],
  desejosColecoes: [{ id: "cd1", nome: "Saga", descricao: "Loja", membros: null, colecaoId: "c1", ordem: 2, corBarra: "#123456" }],
});
const normal = B.normalizeLib(raw);
check("desejo descarta status", normal.desejos?.[0]?.id === "d1" && !Object.hasOwn(normal.desejos[0], "status"));
check("edições inválidas do desejo viram array vazio", igual(normal.desejos?.[0]?.edicoesColetadasIds, []) && igual(normal.desejos?.[1]?.edicoesColetadasIds, []));
check("desejo valida e limpa tambem", igual(normal.desejos?.[0]?.tambem, [{ editora: "DC Comics", personagem: "Flash" }]) && !Object.hasOwn(normal.desejos?.[1] || {}, "tambem"));
check("desejo mantém ordemSeries válida e descarta a inválida", igual(normal.desejos?.[0]?.ordemSeries, ["s1", "s2"]) && !Object.hasOwn(normal.desejos?.[1] || {}, "ordemSeries"));
check("desejo recebe a mesma migração de tipo que o volume", normal.desejos?.[0]?.tipo === "Trade Paperback" && normal.volumes[0].tipo === "Trade Paperback");
check("volume mantém seu status e suas defesas", normal.volumes[0].status === "lida" && igual(normal.volumes[0].edicoesColetadasIds, []));
check("coleção da lista normaliza membros e preserva os demais campos", igual(normal.desejosColecoes?.[0], { ...raw.desejosColecoes[0], membros: [] }));

console.log("=== limpeza de referências ===");
const lib = congelar(B.normalizeLib({
  series: [{ id: "s1" }, { id: "s2" }],
  edicoes: [{ id: "e1", serieId: "s1" }, { id: "e2", serieId: "s1" }, { id: "e3", serieId: "s2" }],
  volumes: [{ id: "v1", edicoesColetadasIds: ["e1", "e2", "e3"] }],
  desejos: [{ id: "d1", edicoesColetadasIds: ["e1", "e2", "e3"] }, { id: "d2", edicoesColetadasIds: [] }],
  colecoes: [{ id: "c1", membros: ["v1"] }],
  desejosColecoes: [{ id: "cd1", membros: ["d1"] }, { id: "cd2", membros: ["d1", "d2"] }],
}));
const semSerie = B.deleteSerie(lib, "s1");
check("apagar série limpa todas as suas edições no desejo", igual(semSerie.desejos?.[0]?.edicoesColetadasIds, ["e3"]));
check("apagar série mantém a limpeza do acervo", igual(semSerie.volumes[0].edicoesColetadasIds, ["e3"]) && igual(semSerie.series.map((s) => s.id), ["s2"]) && igual(semSerie.edicoes.map((e) => e.id), ["e3"]));
const semEdicao = B.deleteEdicao(lib, "e1");
check("apagar edição limpa só ela no desejo", igual(semEdicao.desejos?.[0]?.edicoesColetadasIds, ["e2", "e3"]));
check("apagar edição mantém a limpeza do acervo", igual(semEdicao.volumes[0].edicoesColetadasIds, ["e2", "e3"]) && igual(semEdicao.edicoes.map((e) => e.id), ["e2", "e3"]));
check("deleteDesejo existe", typeof B.deleteDesejo === "function");
if (typeof B.deleteDesejo === "function") {
  const semDesejo = B.deleteDesejo(lib, "d1");
  check("apagar desejo tira o item da lista", igual(semDesejo.desejos.map((d) => d.id), ["d2"]));
  check("apagar o único membro remove a coleção da lista", !semDesejo.desejosColecoes.some((c) => c.id === "cd1"));
  check("coleção com dois membros mantém só o outro", igual(semDesejo.desejosColecoes, [{ id: "cd2", membros: ["d2"] }]));
  check("apagar desejo preserva volumes e coleções do acervo", igual(semDesejo.volumes, lib.volumes) && igual(semDesejo.colecoes, lib.colecoes));
}
check("mutações preservam a biblioteca anterior congelada", igual(lib.desejos?.[0]?.edicoesColetadasIds, ["e1", "e2", "e3"]) && igual(lib.desejosColecoes?.[0]?.membros, ["d1"]));

console.log("=== backup ida e volta ===");
const completo = B.normalizeLib({ ...lib,
  desejos: [{ ...lib.desejos?.[0], id: "d1", titulo: "Flash", personagem: "Flash", editora: "DC Comics", tipo: "Omnibus", ano: "2026", capaAssetId: "capa", mini: "mini", notas: "Loja R$ 100", ordem: 3, tambem: [{ editora: "Marvel", personagem: "Thor" }], ordemSeries: ["s1", "s2"] }],
  desejosColecoes: [{ id: "cd1", nome: "Saga", descricao: "Faltantes", membros: ["d1"], colecaoId: "c1", ordem: 1, corBarra: "#abcdef" }],
});
const volta = B.normalizeLib(JSON.parse(JSON.stringify(completo)));
check("backup novo preserva todos os campos do desejo", !!volta.desejos?.length && igual(volta.desejos, completo.desejos));
check("backup novo preserva todos os campos da coleção da lista", !!volta.desejosColecoes?.length && igual(volta.desejosColecoes, completo.desejosColecoes));
check("backup novo preserva a biblioteca inteira", igual(volta, completo));
check("fixados da lista ficam fora do backup", !Object.hasOwn(B.normalizeLib({ ...completo, fixadosDesejos: ["Flash"] }), "fixadosDesejos"));

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
