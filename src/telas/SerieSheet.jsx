import { useState, useEffect, useMemo, useRef } from "react";
import { Search, Plus, X, Pencil, Trash2, Upload, Check, Copy } from "lucide-react";

import { sortKey } from "../lib/util";
import { anoRange, personagensDaSerie, textoFaltantes } from "../lib/biblioteca";
import { Sheet } from "../ui/base";

export function SerieSheet({
  serie, contexto, verTudo, setVerTudo, edicoes, ownedIds, volumesQueColetam,
  busca, setBusca, selectedId, setSelectedId, onClose, onEdit, onDelete,
  onImport, onNovaEdicao, onEditEdicao, onDeleteEdicao, avisar, volumes, onVincular,
}) {
  const kept = useRef(null);
  if (serie) kept.current = serie;
  const s = serie || kept.current;

  const [doPersonagem, outros] = useMemo(() => {
    const nomes = new Set(s ? personagensDaSerie(s).map((p) => p.nome) : []);
    const ord = (a, b) => a.titulo.localeCompare(b.titulo, "pt-BR", { numeric: true });
    return [
      volumes.filter((v) => nomes.has(v.personagem)).sort(ord),
      volumes.filter((v) => !nomes.has(v.personagem)).sort(ord),
    ];
  }, [volumes, s]);

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

  const edsFiltradas = busca.trim()
    ? eds.filter((e) => e.numero.toLowerCase().includes(busca.trim().toLowerCase()))
    : eds;
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

  const renderTile = (e) => (
    <button
      key={e.id}
      className="tile"
      data-owned={ownedIds.has(e.id) ? "true" : "false"}
      data-sel={e.id === selectedId ? "true" : "false"}
      aria-label={"Nº " + e.numero + (ownedIds.has(e.id) ? ", possuída" : ", falta")}
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
              <button className="btn btn-quiet" onClick={onNovaEdicao}><Plus size={13} /> Edição</button>
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
            <div>
              {eds.length > 20 && (
                <div className="search" style={{ marginBottom: 12 }}>
                  <Search size={14} />
                  <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar número" aria-label="Buscar número na série" />
                </div>
              )}
              <div className="mapa-topo">
                <p className="t-micro" style={{ margin: 0 }}>
                  Escolha um número para ver se você tem e em qual volume
                </p>
                {/* v121: what the two tile looks mean, said once. */}
                <p className="mapa-legenda t-small muted" aria-hidden="true">
                  <i data-owned="true" /> tenho <i /> falta
                </p>
              </div>

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
                          {g.label} <span className="muted">{owned}/{g.itens.length}</span>
                        </summary>
                        <div className="tiles">{g.itens.map(renderTile)}</div>
                      </details>
                    );
                  })
              ) : (
                <div className="tiles">
                  {edsFiltradas.length === 0
                    ? <p className="t-small muted" style={{ margin: 0 }}>Nada encontrado para "{busca}".</p>
                    : edsFiltradas.map(renderTile)}
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
                  {selecionada.posicao !== null && selecionada.posicao !== undefined && (
                    <p className="t-small num" style={{ margin: "4px 0 0", color: "var(--accent-text)" }}>
                      Posição manual no checklist: {selecionada.posicao}
                    </p>
                  )}
                  <p className="t-micro" style={{ margin: "12px 0 6px" }}>Você tem em</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {volumesQueColetam(selecionada.id).length === 0
                      ? <span className="chip">Nenhum volume vinculado</span>
                      : volumesQueColetam(selecionada.id).map((v) => (
                          <span className="chip" key={v.id}><Check size={12} color="var(--read)" /> <strong>{v.titulo}</strong></span>
                        ))}
                  </div>
                  {/* v102: a missing number can be linked right here, instead of
                      leaving for the volume sheet to find it again. The série's own
                      characters come first; crossovers live under "Outros volumes". */}
                  {volumesQueColetam(selecionada.id).length === 0 && volumes.length > 0 && (
                    <select
                      className="select vincular-aqui"
                      aria-label={"Vincular o nº " + selecionada.numero + " a um volume"}
                      value=""
                      onChange={(e) => { if (e.target.value) onVincular(e.target.value, selecionada.id); }}
                    >
                      <option value="">Vincular a um volume…</option>
                      {doPersonagem.length > 0 && (
                        <optgroup label="Do personagem">
                          {doPersonagem.map((v) => <option key={v.id} value={v.id}>{v.titulo}</option>)}
                        </optgroup>
                      )}
                      {outros.length > 0 && (
                        <optgroup label={doPersonagem.length > 0 ? "Outros volumes" : "Volumes"}>
                          {outros.map((v) => <option key={v.id} value={v.id}>{v.titulo}</option>)}
                        </optgroup>
                      )}
                    </select>
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
