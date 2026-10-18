import assert from "node:assert/strict";
import { importarLib } from "./helpers/importar-lib.mjs";

const { EMBLEMAS } = await importarLib("emblemas");
let falhas = 0, passes = 0;
const check = (nome, fn) => {
  try { fn(); passes++; console.log("PASS " + nome); }
  catch (e) { falhas++; console.log("FAIL " + nome + ": " + e.message); }
};
let api;
try {
  api = await importarLib("mosaico");
} catch (e) {
  check("lógica do mosaico disponível", () => { throw e; });
  process.exit(1);
}
const { volumesDoEmblema, distribuirCapas, numerosDoPersonagem, sortearEmblema } = api;
const seeds = [0, 1, 7, 42, 999, 0xffffffff];
const moldes = EMBLEMAS.flatMap((e) => [e, ...(e.variantes || [])].flatMap((f) => [f.pc, f.cel]));
for (const n of [1, 2, 3, 7, 67]) {
  const ids = Array.from({ length: n }, (_, i) => "v" + i);
  check(n + " ids: quantidade e pertencimento em todos os moldes pc/cel e seeds", () => {
    for (const linhas of moldes) for (const seed of seeds) {
      const out = distribuirCapas(linhas, ids, seed);
      assert.equal(out.length, linhas.join("").split("#").length - 1);
      assert.ok(out.every((id) => ids.includes(id)));
    }
  });
  check(n + " ids: sem vizinhos iguais à esquerda ou acima", () => {
    if (n === 1) return; // The sole cover necessarily repeats.
    for (const linhas of moldes) for (const seed of seeds) {
      const out = distribuirCapas(linhas, ids, seed), grade = new Map();
      let i = 0;
      linhas.forEach((linha, r) => [...linha].forEach((c, q) => {
        if (c !== "#") return;
        const id = out[i++];
        assert.notEqual(id, grade.get(r + "," + (q - 1)), "esquerda: " + n + "/" + seed);
        assert.notEqual(id, grade.get((r - 1) + "," + q), "acima: " + n + "/" + seed);
        grade.set(r + "," + q, id);
      }));
    }
  });
  check(n + " ids: distribuição determinística e sem mutar entradas", () => {
    for (const linhas of moldes) for (const seed of seeds) {
      const antes = JSON.stringify([linhas, ids]);
      assert.deepEqual(distribuirCapas(linhas, ids, seed), distribuirCapas(linhas, ids, seed));
      assert.equal(JSON.stringify([linhas, ids]), antes);
    }
  });
  if (n >= 3) check(n + " ids: todos antes de repetir, inclusive menos casas que ids", () => {
    for (const linhas of [...moldes, ["##", ".#"], ["#"]]) for (const seed of seeds) {
      const out = distribuirCapas(linhas, ids, seed);
      const inicio = out.slice(0, Math.min(out.length, ids.length));
      assert.equal(new Set(inicio).size, inicio.length);
    }
  });
}
check("2 ids: casas iniciais de mesma paridade num molde conectado", () => {
  const out = distribuirCapas(["#.#", "###"], ["a", "b"], 7);
  assert.equal(out[0], out[1]);
  assert.notEqual(out[0], out[2]);
  assert.equal(out[0], out[3]);
});
check("2 ids: Aquaman real explicita a exceção inevitável de estreia", () => {
  const aquaman = EMBLEMAS.find((e) => e.id === "aquaman");
  const out = distribuirCapas(aquaman.pc, ["a", "b"], 7);
  assert.equal(out[0], out[1]);
  assert.equal(new Set(out).size, 2);
});
check("seeds diferentes redistribuem as capas", () => {
  const linhas = ["####", "####"];
  assert.notDeepEqual(distribuirCapas(linhas, ["a", "b", "c", "d"], 1), distribuirCapas(linhas, ["a", "b", "c", "d"], 17));
});
check("sem ids ou sem casas: vazio", () => {
  assert.deepEqual(distribuirCapas(["##"], [], 0), []);
  assert.deepEqual(distribuirCapas(["..."], ["a"], 0), []);
});
const vols = [
  { id: "a", personagem: "Batman", status: "lida", ano: "2025", tipo: "TPB", edicoesColetadasIds: ["e1", "e2", "e2"] },
  { id: "b", personagem: "Outro", tambem: [{ editora: "DC", personagem: "Batman" }, { personagem: "Batman" }], status: "lendo", ano: "2026", tipo: "TPB", edicoesColetadasIds: ["e2", "e3", "apagada"] },
  { id: "c", personagem: "Flash", status: "nao_lida", tipo: "Hardcover", edicoesColetadasIds: [] },
];
check("pool aceita personagem principal e tambem, uma vez por volume", () => {
  assert.deepEqual(volumesDoEmblema({ pool: ["Batman"] }, [...vols, vols[0]]).map((v) => v.id), ["a", "b"]);
});
check("números contam volumes, só status lida e ids únicos inclusive órfãos", () => {
  const n = numerosDoPersonagem(vols, []);
  assert.deepEqual([n.volumes, n.lidos, n.edicoesColetadas], [3, 1, 4]);
});
check("anos vêm das edições coletadas, ignoram vazios e inválidos", () => {
  const n = numerosDoPersonagem(vols, [
    { id: "e1", ano: "1996" }, { id: "e2", ano: 2001 }, { id: "e3", ano: "" },
    { id: "fora", ano: "1800" }, { id: "apagada", ano: "presente" },
  ]);
  assert.deepEqual([n.anoDe, n.anoAte], [1996, 2001]);
  assert.deepEqual(numerosDoPersonagem(vols, [{ id: "e1", ano: " " }, { id: "e2", ano: null }]).anoDe, null);
});
check("formatos: top 3, contagem e desempate pelo nome", () => {
  const n = numerosDoPersonagem([...vols, { tipo: "Omnibus" }, { tipo: "Absolute" }, {}], []);
  assert.deepEqual(n.formatos, [{ tipo: "TPB", contagem: 2 }, { tipo: "Absolute", contagem: 1 }, { tipo: "Hardcover", contagem: 1 }]);
});
check("pool vazio não inventa anos nem formatos", () => {
  assert.deepEqual(numerosDoPersonagem([], []), { volumes: 0, lidos: 0, edicoesColetadas: 0, anoDe: null, anoAte: null, formatos: [] });
});
check("sorteio vazio retorna null", () => {
  assert.equal(sortearEmblema({ volumes: [{ personagem: "Sem emblema" }] }, 1), null);
});
check("sorteio aceita tambem, mantém único elegível mesmo excluído", () => {
  const lib = { volumes: [{ personagem: "Outro", tambem: [{ personagem: "Nightwing" }] }] };
  assert.equal(sortearEmblema(lib, 42, "nightwing")?.id, "nightwing");
});
check("sorteio só escolhe elegíveis, exclui atual e é determinístico", () => {
  const lib = { volumes: vols };
  for (const seed of seeds) {
    const e = sortearEmblema(lib, seed, "batman");
    assert.ok(e && e.id !== "batman" && volumesDoEmblema(e, vols).length);
    assert.equal(e.id, sortearEmblema(lib, seed, "batman").id);
  }
});
console.log(passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
