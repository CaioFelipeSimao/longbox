import esbuild from "esbuild";

// v145: campos opcionais da edição (autores, reimpressao, origem). Edições antigas
// não os têm, então toda leitura passa por src/lib/edicoes.js. Funções puras, sem DOM.

let falhas = 0, passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const j = JSON.stringify;

const out = esbuild.buildSync({ entryPoints: ["src/lib/edicoes.js"], bundle: true, format: "esm", write: false });
const { autoresDe, textoAutores, ehReimpressao, parseAutores, autoresPossuidos, serieTemAutor, serieTemReimpressao } =
  await import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));

const antiga = { id: "a", serieId: "s", numero: "1" };
const cheia = { id: "b", serieId: "s", numero: "2", autores: { writer: ["Mark Waid"], penciler: ["Mike Wieringo"], inker: ["Jose Marzan Jr."] }, reimpressao: true, origem: "Flash #105 (1959)" };
const so = { id: "c", serieId: "s", numero: "3", autores: { writer: ["Mark Waid", "Brian Augustyn"] } };

check("edicao antiga: tres listas vazias", j(autoresDe(antiga)) === j({ writer: [], penciler: [], inker: [] }), j(autoresDe(antiga)));
check("edicao cheia", autoresDe(cheia).penciler[0] === "Mike Wieringo");
check("autores parcial completa as listas", autoresDe(so).inker.length === 0 && autoresDe(so).writer.length === 2);
check("textoAutores da antiga e vazio", textoAutores(antiga) === "");
check("textoAutores junta tudo em minusculas", textoAutores(cheia) === "mark waid mike wieringo jose marzan jr.", textoAutores(cheia));
check("ehReimpressao so quando true", ehReimpressao(cheia) && !ehReimpressao(antiga) && !ehReimpressao({ reimpressao: "sim" }));
check("parseAutores separa e apara", j(parseAutores(" Mark Waid ; Brian Augustyn,Mark Waid ,")) === j(["Mark Waid", "Brian Augustyn"]), j(parseAutores(" Mark Waid ; Brian Augustyn,Mark Waid ,")));
check("parseAutores vazio", parseAutores("").length === 0 && parseAutores(undefined).length === 0);

const eds = [antiga, cheia, so, { id: "d", serieId: "s", numero: "4", autores: { writer: ["Mark Waid"] } }];
const donos = new Set(["b", "c"]);
const lista = autoresPossuidos(eds, donos);
// b e c sao possuidas, d (tambem do Waid) nao: Waid conta 2, nao 3.
check("autoresPossuidos so conta as possuidas", lista.find((x) => x.nome === "Mark Waid").n === 2, j(lista));
check("autoresPossuidos inclui quem so aparece numa possuida", lista.some((x) => x.nome === "Jose Marzan Jr.") && lista.some((x) => x.nome === "Brian Augustyn"));
check("autoresPossuidos ordenado", j(lista.map((x) => x.nome)) === j([...lista.map((x) => x.nome)].sort((a, b) => a.localeCompare(b, "pt-BR"))));
check("autoresPossuidos deduplica espacos", autoresPossuidos([{ id: "x", autores: { writer: ["Jack Kirby", "Jack Kirby "] } }], new Set(["x"])).length === 1);
const gaiman = [{ id: "z", autores: { writer: ["Neil Gaiman"] } }];
check("serieTemAutor ignora caixa", serieTemAutor(eds, donos, "mark WAID"));
check("serieTemAutor ignora acento", serieTemAutor(gaiman, new Set(["z"]), "Néil GAIMAN"));
check("serieTemAutor exato nao casa pedaco de nome", !serieTemAutor(gaiman, new Set(["z"]), "Gai"));
check("serieTemAutor parcial casa pedaco de nome", serieTemAutor(gaiman, new Set(["z"]), "gai", true));
check("serieTemAutor nao conta edicao nao possuida", !serieTemAutor(eds, new Set(["a"]), "Mark Waid"));
check("serieTemReimpressao", serieTemReimpressao(eds) && !serieTemReimpressao([antiga]));

// v146: a reprint lists its sources as {serie, numero}. It counts as owned when every
// source is owned (user's rule: DC reissues the originals, never the Giants). Only
// physically owned sources count, so a covered reprint never covers another one.
const { indiceEdicoes, coberturaDe, edicoesCobertas } =
  await import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
const series = [{ id: "f1", nome: "The Flash (Volume 1)" }, { id: "af", nome: "All-Flash" }];
const ed = (id, serieId, numero, extra = {}) => ({ id, serieId, numero, ...extra });
const catalogo = [
  ed("f107", "f1", "107"), ed("f113", "f1", "113"), ed("af32", "af", "32"),
  ed("g1", "f1", "160", { reimpressao: true, fontes: [{ serie: "The Flash (Volume 1)", numero: "107" }, { serie: "The Flash (Volume 1)", numero: "113" }] }),
  ed("g2", "f1", "169", { reimpressao: true, fontes: [{ serie: "The Flash (Volume 1)", numero: "107" }, { serie: "Adventure Comics (Volume 1)", numero: "123" }] }),
  ed("g3", "f1", "178", { reimpressao: true, fontes: [{ serie: "the flash (volume 1)", numero: "107" }, { serie: "All-Flash", numero: "32" }] }),
  ed("g4", "f1", "187", { reimpressao: true, origem: "texto antigo sem fontes" }),
  ed("g5", "f1", "196", { reimpressao: true, fontes: [{ serie: "The Flash (Volume 1)", numero: "160" }] }),
];
const ind = indiceEdicoes(series, catalogo);
const so107 = new Set(["f107"]);
const c1 = coberturaDe(catalogo[3], ind, so107);
check("cobertura parcial: 1 de 2", c1.total === 2 && c1.tenho.length === 1 && c1.falta.length === 1 && c1.fora.length === 0, j(c1));
check("cobertura guarda a edicao de origem", c1.tenho[0].edicao.id === "f107" && c1.falta[0].edicao.id === "f113");
const c2 = coberturaDe(catalogo[4], ind, so107);
check("origem de serie fora do acervo vai para fora", c2.fora.length === 1 && c2.fora[0].serie === "Adventure Comics (Volume 1)", j(c2));
check("nome da serie casa sem caixa", coberturaDe(catalogo[5], ind, new Set(["f107", "af32"])).tenho.length === 2);
check("(Volume 1) no nome da origem casa serie sem o sufixo", coberturaDe(ed("x", "f1", "1", { reimpressao: true, fontes: [{ serie: "All-Flash (Volume 1)", numero: "32" }] }), ind, new Set(["af32"])).tenho.length === 1);
check("(Volume 2) nao casa serie sem sufixo", coberturaDe(ed("y", "f1", "2", { reimpressao: true, fontes: [{ serie: "All-Flash (Volume 2)", numero: "32" }] }), ind, new Set(["af32"])).fora.length === 1);
check("reimpressao sem fontes nao tem cobertura", coberturaDe(catalogo[6], ind, so107) === null);
check("edicao comum nao tem cobertura", coberturaDe(catalogo[0], ind, so107) === null);
const todas = new Set(["f107", "f113", "af32"]);
const cob = edicoesCobertas(series, catalogo, todas);
check("coberta quando tem todas as origens", cob.has("g1") && cob.has("g3"), j([...cob]));
check("nao coberta com origem fora do acervo", !cob.has("g2"));
check("nao coberta com origem faltando", !edicoesCobertas(series, catalogo, so107).has("g1"));
check("reimpressao coberta nao cobre outra", !cob.has("g5"));
check("possuida fisicamente nao entra no conjunto de cobertas", !edicoesCobertas(series, catalogo, new Set([...todas, "g1"])).has("g1"));

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
