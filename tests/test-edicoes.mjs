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

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
