import fs from "fs";
const S = process.argv[2];
const src = fs.readFileSync("C:/Users/ACER/longbox/harness/index.html", "utf8");
const rd = (p) => JSON.parse(fs.readFileSync(S + "/db/" + p, "utf8"));
const lib = {
  volumes: rd("library/volumes.json").items,
  colecoes: rd("library/colecoes.json").items,
  series: rd("library/series.json").items,
  cores: rd("library/cores.json"),
  editoras: rd("library/editoras.json"),
  edicoes: fs.readdirSync(S + "/db/edicoes").map((f) => [f.replace(".json", ""), rd("edicoes/" + f)]),
};
const a = src.indexOf("  var lib = buildLib();");
const b = src.indexOf("  function makeDoc(path)");
const seed = `  var REAL = ${JSON.stringify(lib)};
  var docs = new Map();
  docs.set("library/volumes", { items: REAL.volumes });
  docs.set("library/colecoes", { items: REAL.colecoes });
  docs.set("library/series", { items: REAL.series });
  docs.set("library/cores", REAL.cores);
  docs.set("library/editoras", REAL.editoras);
  var edShards = new Map();
  REAL.edicoes.forEach(function (p) { edShards.set(p[0], p[1].items); });
`;
const start = src.indexOf("  function buildLib()");
fs.writeFileSync(S + "/h/index.html", src.slice(0, start) + seed + src.slice(b));
