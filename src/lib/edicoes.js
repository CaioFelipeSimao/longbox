// v145: campos opcionais da edição. Edições antigas não os têm, então toda leitura
// passa por aqui em vez de olhar e.autores direto.
const dobrar = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const FUNCOES = ["writer", "penciler", "inker"];

export function autoresDe(e) {
  const a = (e && e.autores) || {};
  const lista = (f) => (Array.isArray(a[f]) ? a[f].map((n) => String(n).trim()).filter(Boolean) : []);
  return { writer: lista("writer"), penciler: lista("penciler"), inker: lista("inker") };
}

export function textoAutores(e) {
  const a = autoresDe(e);
  return FUNCOES.flatMap((f) => a[f]).join(" ").toLowerCase();
}

export const ehReimpressao = (e) => !!e && e.reimpressao === true;

export function parseAutores(texto) {
  const vistos = new Set();
  return String(texto || "").split(/[;,]/).map((n) => n.trim()).filter((n) => {
    if (!n || vistos.has(dobrar(n))) return false;
    vistos.add(dobrar(n));
    return true;
  });
}

export function autoresPossuidos(edicoes, ownedIds) {
  const n = {};
  edicoes.forEach((e) => {
    if (!ownedIds.has(e.id)) return;
    const a = autoresDe(e);
    const deste = new Set(FUNCOES.flatMap((f) => a[f]).map(dobrar));
    FUNCOES.flatMap((f) => a[f]).forEach((nome) => {
      const k = dobrar(nome);
      if (!deste.has(k)) return;
      deste.delete(k);
      (n[k] = n[k] || { nome, n: 0 }).n++;
    });
  });
  return Object.values(n).sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
}

// parcial=false: o nome inteiro (filtro). parcial=true: um pedaco do nome (busca livre).
export function serieTemAutor(eds, ownedIds, nome, parcial = false) {
  const alvo = dobrar(nome);
  if (!alvo) return false;
  const casa = (x) => (parcial ? dobrar(x).includes(alvo) : dobrar(x) === alvo);
  return eds.some((e) => ownedIds.has(e.id) && FUNCOES.some((f) => autoresDe(e)[f].some(casa)));
}

export const serieTemReimpressao = (eds) => eds.some(ehReimpressao);
