import React, { useMemo } from "react";

import { QUASE_MORNO, QUASE_PRONTO } from "../lib/constantes";
import { sortKey } from "../lib/util";
import { anoRange } from "../lib/biblioteca";

// One row of the séries tab (v81). Memoised, so coming back to the tab redraws
// only the rows whose série, issues or ownership changed, not all of them with
// their run bars (about 4,000 segments across the real library).
export const SEM_EDICOES = [];
export const SerieLinha = React.memo(function SerieLinha({ serie: s, faixa, eds, ownedIds, aberta, onAbrir }) {
  const owned = useMemo(() => eds.filter((e) => ownedIds.has(e.id)).length, [eds, ownedIds]);
  const temFaixa = faixa.de !== null || faixa.ate !== null;
  return (
    <button
      className="serie-row"
      data-open={aberta ? "true" : "false"}
      onClick={() => onAbrir(s, faixa)}
    >
      <div className="serie-top">
        <span className="t-title truncate">{s.nome}</span>
        <span className="num t-small muted" style={{ flexShrink: 0 }}>
          {owned}/{s.totalEdicoes || eds.length}
        </span>
      </div>
      <div className="serie-meta truncate">
        {anoRange(s)}
        {s.editora ? " · " + s.editora : ""}
        {temFaixa ? " (edições " + (faixa.de ?? "?") + "-" + (faixa.ate ?? "?") + ")" : ""}
      </div>
      <RunBar edicoes={eds} ownedIds={ownedIds} />
    </button>
  );
});

export function RunBar({ edicoes, ownedIds }) {
  const segments = useMemo(() => {
    const sorted = edicoes.slice().sort((a, b) => (sortKey(a) ?? 1e9) - (sortKey(b) ?? 1e9));
    const max = 60;
    if (sorted.length <= max) {
      return sorted.map((e) => (ownedIds.has(e.id) ? 1 : 0));
    }
    const per = sorted.length / max;
    const out = [];
    for (let i = 0; i < max; i++) {
      const slice = sorted.slice(Math.floor(i * per), Math.floor((i + 1) * per));
      if (!slice.length) { out.push(0); continue; }
      const owned = slice.filter((e) => ownedIds.has(e.id)).length;
      out.push(owned / slice.length >= 0.5 ? 1 : 0);
    }
    return out;
  }, [edicoes, ownedIds]);

  if (!segments.length) return null;
  return (
    <div className="run" aria-hidden="true">
      {segments.map((s, i) => <i key={i} data-owned={s ? "true" : "false"} />)}
    </div>
  );
}

// The hub's own bar, continuous rather than bucketed: the hunt is three series
// at a time, so there is room to read an exact percentage instead of the
// coarse blocks the séries tab needs for runs of hundreds of issues.
export function tierDaCaca(owned, total) {
  const fracao = total > 0 ? Math.min(1, owned / total) : 0;
  return fracao < QUASE_MORNO ? "baixo" : fracao < QUASE_PRONTO ? "medio" : "alto";
}

export function HuntProgress({ owned, total }) {
  const pct = total > 0 ? Math.min(100, (owned / total) * 100) : 0;
  const fracao = pct / 100;
  const tier = tierDaCaca(owned, total);
  return (
    <div className="prog-bar" aria-hidden="true">
      {/* transform, not width: width is a layout property and would thrash on animate */}
      <i style={{ transform: "scaleX(" + fracao + ")" }} data-tier={tier} />
    </div>
  );
}
