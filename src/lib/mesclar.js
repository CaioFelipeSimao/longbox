// v96: three-way merge for the library documents.
//
// Every document the app writes (volumes, colecoes, series, cores, editoras and
// one edicoes/<serieId> per série) is written WHOLE, and the artifact's db has no
// conditional write. So a tab that loaded before someone else wrote (another
// device, or Claude cataloguing books) used to put its old copy back and erase
// the newer items: 2026-09-24, a reorder in a stale tab wiped 20 new volumes.
//
// The fix merges instead of overwriting. `base` is what this tab last read or
// wrote, `local` is the tab's current state, `remoto` is what the server has now.
// Whatever the tab changed since `base` (added, edited, removed) is applied on
// top of `remoto`; everything else comes from `remoto`, so changes made
// elsewhere survive. When both sides changed the same item, the tab's version
// wins: it is the edit the person just made.

// v158: equality of two items ignores the order of their keys (the server returns them sorted).
const ordenarChaves = (x) => Array.isArray(x) ? x.map(ordenarChaves)
  : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, ordenarChaves(x[k])])) : x;
const json = (x) => JSON.stringify(ordenarChaves(x));

// Lists of objects with an `id` (volumes, colecoes, series, editoras.itens, the
// edições of one série). Order follows `remoto`; items the tab added go at the end.
export function mesclarLista(base, local, remoto) {
  const b = new Map((base || []).map((x) => [x.id, x]));
  const l = new Map((local || []).map((x) => [x.id, x]));
  const mudouAqui = (id) => !b.has(id) || json(b.get(id)) !== json(l.get(id));
  const fora = [];
  const vistos = new Set();
  for (const r of remoto || []) {
    vistos.add(r.id);
    if (l.has(r.id)) fora.push(mudouAqui(r.id) ? l.get(r.id) : r);
    else if (!b.has(r.id)) fora.push(r); // added elsewhere
    // else: removed here -> stays removed
  }
  for (const x of local || []) {
    if (vistos.has(x.id)) continue;
    if (!b.has(x.id)) fora.push(x); // added here
    else if (json(b.get(x.id)) !== json(x)) fora.push(x); // removed elsewhere, edited here: keep the edit
    // else: removed elsewhere, untouched here -> stays removed
  }
  return fora;
}

// Plain objects keyed by name (library/cores `mapa`).
export function mesclarMapa(base, local, remoto) {
  const b = base || {}, l = local || {}, r = remoto || {};
  const fora = {};
  for (const k of new Set([...Object.keys(r), ...Object.keys(l)])) {
    const emB = k in b, emL = k in l, emR = k in r;
    const mudouAqui = !emB || json(b[k]) !== json(l[k]);
    if (emL && emR) fora[k] = mudouAqui ? l[k] : r[k];
    else if (emL) { if (mudouAqui) fora[k] = l[k]; } // added here, or edited here and removed elsewhere
    else if (!emB) fora[k] = r[k]; // added elsewhere (in r, never here)
    // else: removed here -> stays removed
  }
  return fora;
}

// library/editoras: a list plus the selected band.
export function mesclarEditoras(base, local, remoto) {
  const b = base || {}, l = local || {}, r = remoto || {};
  return {
    itens: mesclarLista(b.itens, l.itens, r.itens),
    selecionada: l.selecionada !== b.selecionada ? l.selecionada : (r.selecionada ?? l.selecionada),
  };
}
