import { useState, useMemo } from "react";
import { Plus, Download, BookOpen, ChevronDown, Shuffle } from "lucide-react";
import GridMotion from "../components/GridMotion/GridMotion";

import {
  BACKDROP_COLS, BACKDROP_ROWS, QUASE_FECHANDO, SESSION_SEED, SHELF_CAP, seededPick,
} from "../lib/constantes";
import { coverColors, useCores } from "../lib/cores";
import { formatBytes } from "../lib/biblioteca";
import { coverUrl, miniUrl, useMiniVersao } from "../lib/capas";
import { EmptyState } from "../ui/base";
import { HuntProgress } from "../ui/Series";
import { CoverArt, VolumeCard } from "../ui/VolumeCard";

// A representative sample, not the first N: capping a character-sorted list
// alphabetically would erase whoever sorts last, and the shelf is meant to read
// as a map of the whole collection. Characters stay in alphabetical order so the
// colour blocks hold their shape; within each one the window slides by the
// session seed, so successive visits eventually show everything.
export function buildShelf(volumes, cap, seed) {
  const byChar = {};
  volumes.forEach((v) => {
    const k = v.personagem || "";
    (byChar[k] = byChar[k] || []).push(v);
  });
  const chars = Object.keys(byChar).sort((a, b) => a.localeCompare(b, "pt-BR"));
  chars.forEach((k) => byChar[k].sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR")));
  if (volumes.length <= cap) return chars.flatMap((k) => byChar[k]);

  const windowOf = (list, n, offset) => {
    if (n >= list.length) return list;
    const start = ((offset % list.length) + list.length) % list.length;
    const out = [];
    for (let i = 0; i < n; i++) out.push(list[(start + i) % list.length]);
    return out;
  };

  const quotas = chars.map((k) => ({
    k,
    n: Math.max(1, Math.floor((byChar[k].length / volumes.length) * cap)),
  }));
  let total = quotas.reduce((s, q) => s + q.n, 0);
  // Hand any rounding slack to the biggest shelves first.
  const order = quotas.slice().sort((a, b) => byChar[b.k].length - byChar[a.k].length);
  let i = 0;
  while (total > cap && order.length) {
    const q = order[i % order.length];
    if (q.n > 1) { q.n--; total--; }
    i++;
    if (i > chars.length * 40) break;
  }
  i = 0;
  while (total < cap && order.length) {
    const q = order[i % order.length];
    if (q.n < byChar[q.k].length) { q.n++; total++; }
    i++;
    if (i > chars.length * 40) break;
  }
  return quotas.flatMap((q, idx) => windowOf(byChar[q.k], q.n, seed + idx * 7));
}

// No cover is ever laid twice. A repeat would put the same book on the wall in two
// places, which is exactly what a shelf cannot do, so a library smaller than the
// grid leaves the leftover tiles on their own empty grey and the wall fills in as
// the collection gets photographed.
//
// The covers are scattered across the grid rather than packed into the first
// tiles: a filled block above empty ones would read as a loading state. Both the
// order and the positions come from the session seed, like the shelf and unlike
// the suggestion, so the wall holds still while you use the page and is dealt
// again on every reload.
export function buildBackdrop(volumes, count, seed) {
  const urls = volumes.map((v) => miniUrl(v) || coverUrl(v)).filter(Boolean);
  if (urls.length === 0) return [];
  const slots = new Array(count).fill(null);
  const todas = Array.from({ length: count }, (_, i) => i);
  const posicoes = seededPick(todas, Math.min(urls.length, count), seed);
  const capas = seededPick(urls, urls.length, seed + 1);
  posicoes.forEach((p, i) => { slots[p] = capas[i]; });
  return slots;
}

export function Hub({
  lib, stats, docUsage, edicoesPorSerie, ownedIds,
  onOpenVolume, onOpenSerie, onNovo, onEnter, sentinelRef, rootRef, returning, backup, onBackup,
}) {
  const vazia = lib.volumes.length === 0 && lib.series.length === 0;
  const cores = useCores();

  // Picked once per visit to the hub, so it stays put while you use the page
  // but is different the next time you come back.
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 100000));
  const sugestao = lib.volumes.length ? lib.volumes[seed % lib.volumes.length] : null;
  const outraSugestao = () => setSeed((s) => s + 1 + Math.floor(Math.random() * 7));

  const shelf = useMemo(() => buildShelf(lib.volumes, SHELF_CAP, SESSION_SEED), [lib.volumes]);
  const miniVersao = useMiniVersao();
  const backdrop = useMemo(
    () => buildBackdrop(lib.volumes, BACKDROP_ROWS * BACKDROP_COLS, SESSION_SEED),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lib.volumes, miniVersao]
  );

  if (vazia) {
    return (
      <div className="hub" ref={rootRef} data-returning={returning ? "true" : "false"}>
        <EmptyState icon={BookOpen} title="Sua caixa está vazia">
          Comece catalogando um volume. Depois dá para cadastrar as séries e marcar quais
          edições cada volume coleta.
        </EmptyState>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button className="btn btn-primary" onClick={onNovo}>
            <Plus size={15} /> Catalogar o primeiro volume
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hub" ref={rootRef} data-returning={returning ? "true" : "false"}>
      {backdrop.length > 0 && (
        <GridMotion items={backdrop} rows={BACKDROP_ROWS} cols={BACKDROP_COLS} />
      )}
      {sugestao && (
        <section className="suggest">
          <div className="suggest-cover">
            <div className="cover" style={{ "--edge": coverColors(sugestao, cores).edge }}>
              <CoverArt volume={sugestao} grande />
            </div>
          </div>
          <div className="suggest-body">
            <p className="t-micro" style={{ margin: 0 }}>Do seu acervo</p>
            <h2 className="suggest-title">{sugestao.titulo}</h2>
            <p className="t-small muted" style={{ margin: "4px 0 0" }}>
              {sugestao.personagem}
              {sugestao.tipo ? " · " + sugestao.tipo : ""}
            </p>
            <div className="suggest-actions">
              <button className="btn btn-primary" onClick={() => onOpenVolume(sugestao.id)}>Abrir</button>
              <button className="btn btn-quiet" onClick={outraSugestao}>
                <Shuffle size={14} /> Outro
              </button>
            </div>
          </div>
        </section>
      )}

      {stats.faltaPouco.length > 0 && (
        <section>
          <div className="hub-section-head">
            <h2>Falta pouco</h2>
            {stats.quaseFechando > 3 && (
              <span className="group-count">
                {stats.quaseFechando} passaram de {Math.round(QUASE_FECHANDO * 100)}%
              </span>
            )}
          </div>
          <div className="prog">
            {stats.faltaPouco.map((p) => (
              <HuntRow
                key={p.serie.id}
                item={p}
                onClick={() => onOpenSerie(p.serie.id)}
              />
            ))}
          </div>
        </section>
      )}

      {stats.faltaPouco.length === 0 && lib.series.length > 0 && (
        <section>
          <div className="hub-section-head">
            <h2>Falta pouco</h2>
          </div>
          <p className="hub-note">
            {stats.temMetas
              ? "Nenhuma série passou de " + Math.round(QUASE_FECHANDO * 100) +
                "% ainda. Quando uma chegar lá, ela aparece aqui."
              : 'Preencha "total de edições" nas séries para acompanhar aqui o que falta fechar.'}
          </p>
        </section>
      )}

      <section>
        <div className="hub-section-head">
          <h2>Sua estante</h2>
          {lib.volumes.length > shelf.length && (
            <span className="group-count">{shelf.length} de {lib.volumes.length}</span>
          )}
        </div>
        <div className="wall">
          {shelf.map((v) => (
            <VolumeCard key={v.id} volume={v} index={0} open={false} bare onClick={() => onOpenVolume(v.id)} />
          ))}
        </div>
      </section>

      <div className="hub-foot">
        <div className="hub-figures">
          <div className="hub-figure">
            <span>{lib.volumes.length}</span>
            <small>volumes</small>
          </div>
          <div className="hub-figure">
            <span>{lib.series.length}</span>
            <small>séries</small>
          </div>
          <div className="hub-figure">
            <span>{stats.totalPossuidas}</span>
            <small>edições possuídas</small>
          </div>
        </div>

        <div className="hub-storage">
          <div className="hub-storage-top">
            <span className="t-micro" style={{ margin: 0 }}>Maior documento</span>
            <span className="num t-small muted">{formatBytes(docUsage.maior.bytes)} de 256 KB</span>
          </div>
          <div className="meter">
            <i style={{ width: Math.min(docUsage.pct, 100) + "%" }} data-over={docUsage.pct > 80 ? "true" : "false"} />
          </div>
          <p className="t-small muted">{docUsage.maior.nome}</p>
          {docUsage.pct > 80 && (
            <p className="t-small hub-storage-warn">
              Chegando no limite. Me avise para reestruturar o armazenamento.
            </p>
          )}
          {backup && <BackupLinha ultimo={backup.ultimo} onBackup={onBackup} />}
        </div>
      </div>

      <button className="hub-enter" onClick={onEnter}>
        Continue rolando para abrir sua coleção
        <ChevronDown size={15} />
      </button>

      <div ref={sentinelRef} style={{ height: 1, marginTop: -1 }} aria-hidden="true" />
    </div>
  );
}

// v88: how long ago the library was last backed up. Counted in calendar days, so
// last night reads "ontem" even when it was less than 24 hours ago. Past a month,
// or with no backup ever, the line stands out and offers to make one right there.
const BACKUP_VELHO_DIAS = 30;

function diasDesde(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const dia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((dia(new Date()) - dia(d)) / 86400000);
}

function BackupLinha({ ultimo, onBackup }) {
  const dias = ultimo ? diasDesde(ultimo) : null;
  const texto = dias === null ? "Nenhum backup feito ainda."
    : dias <= 0 ? "Último backup hoje."
    : dias === 1 ? "Último backup ontem."
    : "Último backup há " + dias + " dias.";
  const atencao = dias === null || dias >= BACKUP_VELHO_DIAS;
  return (
    <div className="hub-backup" data-atencao={atencao ? "true" : "false"}>
      <p className="t-small">{texto}</p>
      {atencao && (
        <button className="btn btn-quiet" onClick={onBackup}>
          <Download size={13} /> Fazer backup agora
        </button>
      )}
    </div>
  );
}

export function HuntRow({ item, onClick }) {
  const faltam = item.total - item.owned;
  return (
    <button className="prog-row press" onClick={onClick}>
      <div className="prog-top">
        <span className="t-small truncate" style={{ fontWeight: 500 }}>{item.serie.nome}</span>
        <span className="num t-small" style={{ flexShrink: 0, color: "var(--accent-text)" }}>
          {faltam === 1 ? "falta 1" : "faltam " + faltam}
        </span>
      </div>
      <HuntProgress owned={item.owned} total={item.total} />
    </button>
  );
}
