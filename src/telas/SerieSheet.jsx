import { useState, useEffect, useMemo, useRef } from "react";
import { Search, Plus, X, Pencil, Trash2, Upload, Check, Copy } from "lucide-react";

import { sortKey } from "../lib/util";
import { autoresDe, autoresQueCasam, digitosDoBloco, edicoesDoAutor, ehReimpressao, formaDoTile, serieTemReimpressao } from "../lib/edicoes";
import { anoRange, personagensDaSerie, textoFaltantes } from "../lib/biblioteca";
import { Sheet } from "../ui/base";
import { CampoBusca, daEditora } from "../ui/Filtros";
import { CoverArt } from "../ui/VolumeCard";
import { coverColors, useCores } from "../lib/cores";

export function SerieSheet({
  serie, contexto, verTudo, setVerTudo, edicoes, ownedIds, volumesQueColetam, filtroAutor = "", query = "",
  busca, setBusca, selectedId, setSelectedId, onClose, onEdit, onDelete,
  onImport, onNovaEdicao, onEditEdicao, onDeleteEdicao, avisar, volumes, onVincular, coberturaDaEdicao,
}) {
  const kept = useRef(null);
  if (serie) kept.current = serie;
  const s = serie || kept.current;

  // v147: this is a reading aid for the opened sheet, so dismissing it never
  // clears the tab's filter. A new opening or source starts a fresh highlight.
  const [semDestaque, setSemDestaque] = useState(false);
  useEffect(() => { setSemDestaque(false); }, [serie?.id, filtroAutor, query]);
  const nomeDestaque = filtroAutor || query.trim();
  const parcial = !filtroAutor;
  const doAutor = useMemo(() => new Set(edicoesDoAutor(edicoes, ownedIds, nomeDestaque, parcial).map((e) => e.id)), [edicoes, ownedIds, nomeDestaque, parcial]);
  const destacando = !semDestaque && !!nomeDestaque && (!!filtroAutor || doAutor.size > 0);

  // v139: only volumes of the série's publisher, its characters first, as a search
  // in the Longbox look (the native select opened the OS's white list).
  const cores = useCores();
  const opcoesVolume = useMemo(() => {
    const nomes = new Set(s ? personagensDaSerie(s).map((p) => p.nome) : []);
    const ord = (a, b) => a.titulo.localeCompare(b.titulo, "pt-BR", { numeric: true });
    const cabem = volumes.filter(daEditora(s ? [s.editora] : []));
    return [...cabem.filter((v) => nomes.has(v.personagem)).sort(ord), ...cabem.filter((v) => !nomes.has(v.personagem)).sort(ord)].map((v) => ({
      id: v.id,
      titulo: v.titulo,
      meta: [v.personagem, v.ano].filter(Boolean).join(" · "),
      busca: v.titulo + " " + (v.personagem || ""),
      inicio: <span className="cover sug-cover" style={{ "--edge": coverColors(v, cores).edge }}><CoverArt volume={v} /></span>,
    }));
  }, [volumes, s, cores]);

  const edsTotal = useMemo(() => (
    edicoes.slice().sort((a, b) => {
      const na = sortKey(a), nb = sortKey(b);
      if (na === null && nb === null) return a.numero.localeCompare(b.numero, "pt-BR", { numeric: true });
      if (na === null) return 1;
      if (nb === null) return -1;
      return na - nb;
    })
  ), [edicoes]);

  const faixaAtiva = contexto && (contexto.de !== null || contexto.ate !== null) && !verTudo;
  const eds = useMemo(() => {
    if (!faixaAtiva) return edsTotal;
    return edsTotal.filter((e) => {
      const n = sortKey(e);
      if (n === null) return false;
      if (contexto.de !== null && n < contexto.de) return false;
      if (contexto.ate !== null && n > contexto.ate) return false;
      return true;
    });
  }, [edsTotal, faixaAtiva, contexto]);

  // v145: "Esconder reimpressões" only takes their tiles off the map. The counts
  // below keep reading `eds`, so owned / missing never change with it.
  const [escondeReimp, setEscondeReimp] = useState(false);
  const porBusca = busca.trim()
    ? eds.filter((e) => e.numero.toLowerCase().includes(busca.trim().toLowerCase()))
    : eds;
  const temReimp = serieTemReimpressao(eds);
  const edsFiltradas = escondeReimp ? porBusca.filter((e) => !ehReimpressao(e)) : porBusca;
  const ownedCount = eds.filter((e) => ownedIds.has(e.id)).length;
  const selecionada = eds.find((e) => e.id === selectedId);
  const useGroups = !busca.trim() && eds.length > 60;

  // v88: "Copiar faltantes" copies what is on screen: the faixa when one is
  // applied (and says so), otherwise the whole série plus how far its meta goes
  // past what is catalogued. When the clipboard refuses, the text is shown in a
  // box to copy by hand instead.
  const naoCatalogadas = s && !faixaAtiva && s.totalEdicoes ? s.totalEdicoes - edsTotal.length : 0;
  const nomeCopia = s ? s.nome + (faixaAtiva ? " (nº " + (contexto.de ?? "?") + "-" + (contexto.ate ?? "?") + ")" : "") : "";
  const faltantes = s ? textoFaltantes(nomeCopia, eds, ownedIds, naoCatalogadas) : null;
  const [copiaManual, setCopiaManual] = useState(null);
  const serieId = s ? s.id : null;
  useEffect(() => { setCopiaManual(null); }, [serieId, faixaAtiva]);
  useEffect(() => { setEscondeReimp(false); }, [serieId]);

  async function copiarFaltantes() {
    try {
      await navigator.clipboard.writeText(faltantes);
      setCopiaManual(null);
      avisar("Faltantes copiadas.");
    } catch (e) {
      setCopiaManual(faltantes);
      avisar("Não consegui copiar. O texto está logo abaixo.");
    }
  }

  const grupos = useMemo(() => {
    if (!useGroups) return null;
    const g = {};
    edsFiltradas.forEach((e) => {
      const sk = sortKey(e);
      const start = sk === null ? "outras" : Math.floor(sk / 100) * 100;
      const key = sk === null ? "outras" : String(start);
      if (!g[key]) {
        g[key] = { label: sk === null ? "Especiais e sem número" : "Nº " + start + "-" + (start + 99), itens: [] };
      }
      g[key].itens.push(e);
    });
    // v108: a hundred-block with only a handful of issues (a lone #100 after
    // #1-99) joins the block before it, "Nº 0-100", instead of standing as its
    // own nearly empty row.
    const lista = [];
    Object.keys(g)
      .sort((a, b) => (a === "outras" ? 1 : b === "outras" ? -1 : parseFloat(a) - parseFloat(b)))
      .forEach((key) => {
        const b = g[key];
        const ant = lista[lista.length - 1];
        if (key !== "outras" && ant && ant.key !== "outras" && b.itens.length < 6) {
          ant.itens.push(...b.itens);
          ant.label = ant.label.replace(/-\d+$/, "-" + b.itens[b.itens.length - 1].numero);
          return;
        }
        lista.push({ key, label: b.label, itens: b.itens });
      });
    return lista;
  }, [useGroups, edsFiltradas]);

  // v143: ← → step the picked edição through the map as it is on screen (search
  // and faixa respected, posicao first), stopping at both ends. Same guards as the
  // volume sheet's arrows (v88): not while typing, not with a modifier, not under a
  // modal. The next tile's hundred-block opens if folded, and focus follows the pick.
  const mapaRef = useRef(null);
  const passo = useRef(null);
  passo.current = { lista: edsFiltradas, selectedId, setSelectedId };
  useEffect(() => {
    if (!serie) return undefined;
    const h = (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const alvo = e.target;
      if (alvo && alvo.closest && alvo.closest("input, textarea, select, [contenteditable], [role='scrollbar']")) return;
      if (document.querySelector(".modal")) return;
      const { lista, selectedId: atual, setSelectedId: escolher } = passo.current;
      const i = lista.findIndex((x) => x.id === atual);
      if (i < 0) return;
      const prox = lista[i + (e.key === "ArrowLeft" ? -1 : 1)];
      e.preventDefault();
      if (!prox) return;
      escolher(prox.id);
      requestAnimationFrame(() => {
        const t = mapaRef.current?.querySelector('[data-ed="' + prox.id + '"]');
        if (!t) return;
        const bloco = t.closest("details");
        if (bloco && !bloco.open) bloco.open = true;
        t.focus();
      });
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [!!serie]);

  // v143/v144 tile widths; the rule lives in lib/edicoes.js (digitosDoBloco,
  // formaDoTile) since v150, so the volume sheet draws its tiles the same way.
  const digitos = digitosDoBloco;
  const ndPlano = digitos(edsFiltradas);
  const renderTile = (e, lista, nd, f = formaDoTile(e, lista, nd)) => (
    <button
      key={e.id}
      data-ed={e.id}
      data-forma={f.forma || undefined}
      data-curto={f.curto ? "" : undefined}
      className="tile"
      data-owned={ownedIds.has(e.id) ? "true" : "false"}
      data-sel={e.id === selectedId ? "true" : "false"}
      data-reimp={ehReimpressao(e) ? "true" : undefined}
      data-autor={destacando && doAutor.has(e.id) ? "true" : undefined}
      data-esmaecido={destacando && !doAutor.has(e.id) ? "true" : undefined}
      aria-label={"Nº " + e.numero + (ownedIds.has(e.id) ? ", possuída" : ", falta") + (ehReimpressao(e) ? ", reimpressão" : "") + (destacando && doAutor.has(e.id) ? ", de " + (filtroAutor || autoresQueCasam(e, nomeDestaque, true).join(", ")) : "")}
      aria-pressed={e.id === selectedId}
      onClick={() => setSelectedId(e.id === selectedId ? null : e.id)}
    >
      {e.numero}
    </button>
  );

  return (
    <Sheet
      open={!!serie}
      onClose={onClose}
      title={s ? s.nome : ""}
      subtitle={s ? anoRange(s) + (s.editora ? " · " + s.editora : "") : null}
      actions={s && (
        <>
          <button className="btn-icon btn-remover" onClick={onDelete} aria-label="Remover">
            <Trash2 size={16} color="var(--danger-text)" />
          </button>
          <button className="btn-icon" onClick={onEdit} aria-label="Editar" data-dica="Editar · E"><Pencil size={16} /></button>
        </>
      )}
    >
      {s && (
        <>
          {contexto && (contexto.de !== null || contexto.ate !== null) && (
            <div className="banner" style={{ marginBottom: 0 }}>
              <div>
                Mostrando as edições {contexto.de ?? "?"} a {contexto.ate ?? "?"}, a faixa de{" "}
                {contexto.nome}.{" "}
                <button
                  className="btn btn-ghost"
                  style={{ padding: 0, fontSize: "0.8125rem", color: "var(--accent-text)" }}
                  onClick={() => setVerTudo(!verTudo)}
                >
                  {verTudo ? "Aplicar a faixa" : "Ver todas"}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div className="faltantes-cont">
              <span className="num t-small muted">
                {ownedCount} de {eds.length} possuídas
                {s.totalEdicoes && s.totalEdicoes !== eds.length ? " (meta " + s.totalEdicoes + ")" : ""}
              </span>
              {faltantes && (
                <button
                  className="btn btn-ghost"
                  style={{ padding: 0, fontSize: "0.8125rem", color: "var(--accent-text)" }}
                  onClick={copiarFaltantes}
                >
                  <Copy size={14} /> Copiar faltantes
                </button>
              )}
            </div>
            <div className="row">
              <button className="btn btn-quiet" onClick={onImport}><Upload size={13} /> Importar</button>
              <button className="btn btn-quiet" onClick={onNovaEdicao}><Plus size={13} /> Nova edição</button>
            </div>
          </div>

          {copiaManual && (
            <textarea
              className="textarea faltantes-manual"
              readOnly
              value={copiaManual}
              aria-label="Edições que faltam"
              onFocus={(e) => e.target.select()}
            />
          )}

          {eds.length === 0 ? (
            <p className="t-small muted" style={{ margin: 0 }}>
              Nenhuma edição catalogada ainda. Dá pra cadastrar nº 0, anuais e fracionárias como 12.1.
            </p>
          ) : (
            <div ref={mapaRef}>
              {destacando && (
                <div className="destaque-autor t-small muted">
                  <span>{filtroAutor ? "Destacando as edições de " + filtroAutor : 'Destacando as edições de autores com "' + nomeDestaque + '"'}</span>
                  <button className="btn btn-quiet" onClick={() => setSemDestaque(true)}>Tirar destaque</button>
                </div>
              )}
              {eds.length > 20 && (
                <div className="search" style={{ marginBottom: 12 }}>
                  <Search size={14} />
                  <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar número" aria-label="Buscar número na série" />
                </div>
              )}
              <div className="mapa-topo">
                {/* v132: a sentence, so sentence case; the uppercase micro style is for labels. */}
                <p className="t-small muted" style={{ margin: 0 }}>
                  Escolha um número para ver se você tem e em qual volume.
                </p>
                {/* v121: what the two tile looks mean, said once. */}
                <p className="mapa-legenda t-small muted" aria-hidden="true">
                  <i data-owned="true" /> tenho <i /> falta
                </p>
              </div>
              {temReimp && (
                <button
                  type="button"
                  className="btn btn-quiet reimp-toggle"
                  aria-pressed={escondeReimp}
                  onClick={() => setEscondeReimp((v) => !v)}
                >
                  {escondeReimp ? "Mostrar reimpressões" : "Esconder reimpressões"}
                </button>
              )}

              {useGroups ? (
                grupos.map((g) => {
                    const owned = g.itens.filter((e) => ownedIds.has(e.id)).length;
                    // v108: blocks where the hunt is (some owned, some missing) open by
                    // themselves, and so do all of them when there are only one or two.
                    // Complete and untouched blocks stay closed: their count says it all,
                    // and a long run (Batman Vol 1) would otherwise be a wall of tiles.
                    const aberto = grupos.length <= 2 || (owned > 0 && owned < g.itens.length);
                    return (
                      <details className="bucket" key={serieId + ":" + g.key} open={aberto}>
                        <summary>
                          {g.label} <span className="muted"><span aria-hidden="true">{owned}/{g.itens.length}</span><span className="sr-only">{owned} de {g.itens.length} possuídas</span></span>
                        </summary>
                        {((nd) => <div className="tiles" style={{ "--nd": nd }}>{g.itens.map((e) => renderTile(e, g.itens, nd))}</div>)(digitos(g.itens))}
                      </details>
                    );
                  })
              ) : (
                <div className="tiles" style={{ "--nd": ndPlano }}>
                  {edsFiltradas.length === 0
                    ? <p className="t-small muted" style={{ margin: 0 }}>{busca.trim() ? "Nada encontrado para \"" + busca + "\"." : "Só há reimpressões nesta faixa."}</p>
                    : edsFiltradas.map((e) => renderTile(e, edsFiltradas, ndPlano))}
                </div>
              )}

              {selecionada && (
                <div className="linked-serie edicao-pinned">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <span className="t-title num">Nº {selecionada.numero}</span>
                    <div className="row">
                      <button className="btn-icon btn-remover" onClick={() => onDeleteEdicao(selecionada)} aria-label="Remover edição">
                        <Trash2 size={14} color="var(--danger-text)" />
                      </button>
                      <button className="btn-icon" onClick={() => onEditEdicao(selecionada)} aria-label="Editar edição"><Pencil size={14} /></button>
                      <button className="btn-icon" onClick={() => setSelectedId(null)} aria-label="Fechar"><X size={14} /></button>
                    </div>
                  </div>
                  <p className="t-small muted" style={{ margin: "4px 0 0" }}>
                    {selecionada.mes || selecionada.ano
                      ? (selecionada.mes || "?") + "/" + (selecionada.ano || "?")
                      : "Sem data"}
                  </p>
                  {ehReimpressao(selecionada) && (
                    <p className="t-small num" style={{ margin: "4px 0 0", color: "var(--accent-text)" }}>
                      Reimpressão{selecionada.origem ? " de " + selecionada.origem : ""}
                    </p>
                  )}
                  {selecionada.posicao !== null && selecionada.posicao !== undefined && (
                    <p className="t-small num" style={{ margin: "4px 0 0", color: "var(--accent-text)" }}>
                      Posição manual no checklist: {selecionada.posicao}
                    </p>
                  )}
                  {/* v146: who made it, only the roles that have a name. */}
                  {(() => {
                    const a = autoresDe(selecionada);
                    const linhas = [["Writer", a.writer], ["Penciler", a.penciler], ["Inker", a.inker]].filter(([, l]) => l.length);
                    return linhas.length ? (
                      <dl className="autores">
                        {linhas.map(([rot, l]) => (
                          <div key={rot}><dt className="t-micro">{rot}</dt><dd className="t-small">{l.join(", ")}</dd></div>
                        ))}
                      </dl>
                    ) : null;
                  })()}
                  {/* v146: a reprint with sources says how many of its stories are on the
                      shelf; with all of them it counts as owned ("Coberta pelas originais"). */}
                  {(() => {
                    const cob = coberturaDaEdicao ? coberturaDaEdicao(selecionada) : null;
                    if (!cob) return null;
                    const mesma = (a) => (b) => a.serie === b.serie && a.numero === b.numero;
                    const nome = (f) => f.inedita ? "História inédita" : f.serie.replace(/\s*\(Volume \d+\)$/i, "") + " #" + f.numero;
                    if (cob.tenho.length === cob.total) {
                      const vols = [...new Map(cob.tenho.flatMap((f) => volumesQueColetam(f.edicao.id)).map((v) => [v.id, v])).values()];
                      return (
                        <div className="cobertura">
                          <p className="t-small" style={{ margin: "8px 0 6px", color: "var(--read)" }}>Coberta pelas originais, que estão em</p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {vols.map((v) => <span className="chip" key={v.id}><Check size={12} color="var(--read)" /> <strong>{v.titulo}</strong></span>)}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="cobertura">
                        <p className="t-small" style={{ margin: "8px 0 6px" }}>Você tem {cob.tenho.length} de {cob.total - cob.ineditas} {cob.total - cob.ineditas === 1 ? "edição original" : "edições originais"}</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {selecionada.fontes.map((f, i) => {
                            const tem = cob.tenho.some(mesma(f));
                            const fora = !tem && cob.fora.some(mesma(f));
                            return (
                              <span className="chip" key={i} data-tem={tem ? "true" : undefined}>
                                {tem && <Check size={12} color="var(--read)" />} {nome(f)}
                                {!tem && <span className="muted">{f.inedita ? " · só nesta edição" : fora ? " · fora do acervo" : " · falta"}</span>}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  {/* A covered reprint with no volume of its own already said where its
                      stories are; "Nenhum volume vinculado" under it would contradict that. */}
                  {!(volumesQueColetam(selecionada.id).length === 0 && ownedIds.has(selecionada.id)) && (
                    <>
                      <p className="t-micro" style={{ margin: "12px 0 6px" }}>Você tem em</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {volumesQueColetam(selecionada.id).length === 0
                          ? <span className="chip">Nenhum volume vinculado</span>
                          : volumesQueColetam(selecionada.id).map((v) => (
                              <span className="chip" key={v.id}><Check size={12} color="var(--read)" /> <strong>{v.titulo}</strong></span>
                            ))}
                      </div>
                    </>
                  )}
                  {/* v102: a missing number can be linked right here, instead of
                      leaving for the volume sheet to find it again. The série's own
                      characters come first; crossovers live under "Outros volumes". */}
                  {volumesQueColetam(selecionada.id).length === 0 && volumes.length > 0 && (
                    <div className="vincular-aqui">
                      <CampoBusca
                        key={selecionada.id}
                        id="vincular-aqui"
                        rotulo={"Vincular o nº " + selecionada.numero + " a um volume"}
                        placeholder={s.editora ? "Vincular a um volume da " + s.editora : "Vincular a um volume"}
                        opcoes={opcoesVolume}
                        onEscolher={(vid) => onVincular(vid, selecionada.id)}
                        vazio={"Nenhum volume" + (s.editora ? " da " + s.editora : "") + "."}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
