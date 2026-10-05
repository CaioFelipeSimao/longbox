import { useEffect, useMemo, useRef } from "react";
import { Pencil, Trash2, Link2, ImagePlus, ChevronLeft, ChevronRight, Copy, Library } from "lucide-react";

import { STATUS, STATUS_ORDER, editorasDe, presencas } from "../lib/constantes";
import { parseNum } from "../lib/util";
import { digitosDoBloco, formaDoTile } from "../lib/edicoes";
import { usePasteImage } from "../lib/hooks";
import { useCorDaCapa } from "../lib/capas";
import { specForCharacter, useCores } from "../lib/cores";
import { Field, Sheet } from "../ui/base";
import { CoverArt } from "../ui/VolumeCard";
import { CampoBusca, daEditora } from "../ui/Filtros";
import { personagensDaSerie } from "../lib/biblioteca";
import { useArrastarSeries } from "./useArrastarSeries";

export function VolumeSheet({
  volume, onClose, onEdit, onDuplicate, onDelete, onStatus, colecoes, grupos,
  canUpload, uploading, onCoverPick, series, edicoesPorSerie,
  linkSerieId, setLinkSerieId,
  rangeDe, setRangeDe, rangeAte, setRangeAte, avulsoNum, setAvulsoNum,
  onRange, onAvulsa, onToggle, onOpenEdicaoNaSerie, onReordenarSeries, recede,
  anterior, proximo, posicao, total, onNavegar, direcao,
}) {
  const inputRef = useRef(null);
  const kept = useRef(null);
  if (volume) kept.current = volume;
  const v = volume || kept.current;
  const editoras = editorasDe(v);
  const publicacoes = presencas(v);

  // v114: a form on top (the "Novo volume" cover field) takes the paste, not this sheet.
  usePasteImage(!!volume && canUpload, (f) => { if (!document.querySelector(".modal")) onCoverPick(f); });

  // v106: the top of the sheet takes the cover's own colour; without a cover, or
  // with one that is mostly black, white or grey, the character's colour instead.
  const corCapa = useCorDaCapa(v);
  const cores = useCores();
  const spec = v ? specForCharacter(v.personagem || v.titulo, cores) : null;
  const tinta = v ? corCapa || "hsl(" + (spec.longbox ? 188 : spec.h || 0) + " 50% 45%)" : null;
  const toque = useRef(null);
  const arrasto = useArrastarSeries(volume?.id, grupos, !!volume && !recede, onReordenarSeries,
    () => { toque.current = null; });

  // v139: séries on offer for "Vincular edições": the volume's publisher only, the
  // volume's character first.
  const opcoesSerie = useMemo(() => {
    if (!v) return [];
    const ord = (a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true });
    const cabem = series.filter(daEditora(editorasDe(v)));
    const dele = (x) => personagensDaSerie(x).some((p) => p.nome === v.personagem);
    return [...cabem.filter(dele).sort(ord), ...cabem.filter((x) => !dele(x)).sort(ord)].map((x) => {
      const nomes = personagensDaSerie(x).map((p) => p.nome).join(", ");
      return {
        id: x.id,
        titulo: x.nome,
        meta: [nomes, x.anoInicio].filter(Boolean).join(" · "),
        busca: x.nome + " " + nomes,
        inicio: <span className="sug-cover sug-icone"><Library size={15} /></span>,
      };
    });
  }, [series, v]);

  // v88: ← → step to the neighbouring volume. Not while typing, not with a
  // modifier held (those belong to the browser and the text field), not while a
  // modal is up, and not while the série sheet sits on top of this one.
  const navRef = useRef(null);
  const vizinhos = useRef({ anterior, proximo, onNavegar });
  vizinhos.current = { anterior, proximo, onNavegar };
  useEffect(() => {
    if (!volume || recede) return undefined;
    const h = (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const alvo = e.target;
      if (alvo && alvo.closest && alvo.closest("input, textarea, select, [contenteditable], [role='scrollbar']")) return;
      if (document.querySelector(".modal")) return;
      const n = vizinhos.current;
      const id = e.key === "ArrowLeft" ? n.anterior : n.proximo;
      if (!id) return;
      e.preventDefault();
      n.onNavegar(id, e.key === "ArrowLeft" ? "ant" : "prox");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [!!volume, recede]);

  // A swipe counts when it travels 60px sideways and clearly more sideways than
  // down, so scrolling the sheet never turns into a step.
  function toqueInicio(e) {
    const t = e.touches && e.touches[0];
    toque.current = t && e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
  }
  function toqueFim(e) {
    const ini = toque.current;
    toque.current = null;
    const t = e.changedTouches && e.changedTouches[0];
    if (!ini || !t) return;
    const dx = t.clientX - ini.x;
    const dy = t.clientY - ini.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && proximo) onNavegar(proximo, "prox");
    if (dx > 0 && anterior) onNavegar(anterior, "ant");
  }

  // Each step starts at the top of the new volume, not wherever the last one
  // was scrolled to.
  const idAtual = v ? v.id : null;
  useEffect(() => {
    const corpo = navRef.current && navRef.current.closest(".sheet-body");
    if (corpo) corpo.scrollTop = 0;
  }, [idAtual]);

  return (
    <Sheet
      open={!!volume}
      onClose={onClose}
      recede={recede}
      tinta={tinta}
      variante="volume"
      title={v ? v.titulo : ""}
      subtitle={v ? v.personagem : null}
      nav={v && total > 1 && (
        <div className="sheet-nav">
          <button className="btn-icon" onClick={() => onNavegar(anterior, "ant")} disabled={!anterior} aria-label="Volume anterior">
            <ChevronLeft size={16} />
          </button>
          <span className="t-small muted sheet-nav-pos">{posicao} de {total}</span>
          <button className="btn-icon" onClick={() => onNavegar(proximo, "prox")} disabled={!proximo} aria-label="Próximo volume">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
      actions={v && (
        <>
          <button className="btn-icon btn-remover" onClick={onDelete} aria-label="Remover">
            <Trash2 size={16} color="var(--danger-text)" />
          </button>
          <button className="btn-icon" onClick={onEdit} aria-label="Editar" data-dica="Editar · E"><Pencil size={16} /></button>
          <button className="btn-icon" onClick={onDuplicate} aria-label="Duplicar este volume"><Copy size={16} /></button>
        </>
      )}
    >
      {v && (
        <div
          className="vol-nav"
          key={v.id}
          ref={navRef}
          data-dir={direcao || undefined}
          onTouchStart={toqueInicio}
          onTouchEnd={toqueFim}
        >
          <div className="detail-cover">
              <div className="cover"><CoverArt volume={v} grande /></div>
              {canUpload && (
                <>
                  <button className="cover-upload" onClick={() => inputRef.current && inputRef.current.click()} disabled={uploading}>
                    <ImagePlus size={13} />
                    {uploading ? "Enviando" : v.capaAssetId ? "Trocar capa" : "Adicionar capa"}
                  </button>
                  <p className="cover-paste-hint">ou cole a imagem com Ctrl+V</p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    hidden
                    onChange={(e) => { onCoverPick(e.target.files[0]); e.target.value = ""; }}
                  />
                </>
              )}
          </div>
          <div className="vs-info">
            <dl className="deflist">
              <dt>Tipo</dt><dd>{v.tipo}</dd>
              {editoras.length > 0 && <><dt>Editora</dt><dd>{editoras.join(" · ")}</dd></>}
              {Array.isArray(v.tambem) && v.tambem.length > 0 && publicacoes.length > 0 && <><dt>Personagem</dt><dd>{publicacoes.map((p) => p.personagem + " (" + p.editora + ")").join(" · ")}</dd></>}
              {v.ano && <><dt>Ano</dt><dd className="num">{v.ano}</dd></>}
              {colecoes.length > 0 && (
                <><dt>Coleções</dt><dd>{colecoes.map((c) => c.nome).join(", ")}</dd></>
              )}
            </dl>

          <div>
            <p className="t-micro" style={{ margin: "0 0 8px" }}>Status de leitura</p>
            <div className="seg3">
              {STATUS_ORDER.map((k) => (
                <button key={k} data-kind={k} data-on={v.status === k ? "true" : "false"} aria-pressed={v.status === k} onClick={() => onStatus(k)}>
                  {STATUS[k].label}
                </button>
              ))}
            </div>
          </div>

          {v.notas && (
            <div>
              <p className="t-micro" style={{ margin: "0 0 6px" }}>Notas</p>
              <p className="t-small" style={{ margin: 0 }}>{v.notas}</p>
            </div>
          )}

          <div>
            <p className="t-micro" style={{ margin: "0 0 8px" }}>Edições coletadas</p>
            {grupos.length === 0 && (
              <p className="t-small muted" style={{ margin: "0 0 10px" }}>Nenhuma edição vinculada ainda.</p>
            )}
            <div className="linked-series" ref={arrasto.blockRef}>
            {arrasto.grupos.map((g) => (
              <div className="linked-serie linked-serie-card" key={g.key}
                data-serie-key={g.key}
                ref={(el) => arrasto.registrar(g.key, el)}
                style={{ "--hold-color": tinta }}
                onPointerDown={(e) => arrasto.pointerDown(e, g.key)}
                onClickCapture={arrasto.clickCapture}>
                <span className="vol-hold" aria-hidden="true" />
                <span className="vol-hold__crest" aria-hidden="true" />
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                  <span className="t-small truncate" style={{ fontWeight: 500 }}>
                    {g.serie ? g.serie.nome : "Série removida"}
                  </span>
                  {g.serie && (
                    <button
                      className="btn btn-ghost"
                      style={{ padding: 0, fontSize: "0.75rem", color: "var(--accent-text)" }}
                      onClick={() => setLinkSerieId(g.serie.id)}
                    >
                      Gerenciar
                    </button>
                  )}
                </div>
                {/* v150: same tile widths as the série map (#1000000 spans two tiles
                    instead of wrapping onto two lines). */}
                {((nd) => (
                <div className="tiles" style={{ marginTop: 8, "--nd": nd }}>
                  {g.edicoes.map((e) => {
                    const f = formaDoTile(e, g.edicoes, nd);
                    const forma = { "data-forma": f.forma || undefined, "data-curto": f.curto ? "" : undefined };
                    return g.serie ? (
                      <button
                        type="button"
                        className="tile"
                        data-owned="true"
                        {...forma}
                        key={e.id}
                        onClick={() => onOpenEdicaoNaSerie(g.serie.id, e.id)}
                      >
                        {e.numero}
                      </button>
                    ) : (
                      <span className="tile" data-owned="true" {...forma} key={e.id}>{e.numero}</span>
                    );
                  })}
                </div>
                ))(digitosDoBloco(g.edicoes))}
              </div>
            ))}
            </div>

            {linkSerieId === null ? (
              <button
                className="btn btn-quiet"
                style={{ width: "100%", marginTop: 4 }}
                onClick={() => setLinkSerieId("__pick__")}
              >
                <Link2 size={14} /> Vincular edições de uma série
              </button>
            ) : linkSerieId === "__pick__" ? (
              <div className="linked-serie">
                {/* v139: a search locked to the volume's publisher, its character's
                    séries first; a tap goes straight to linking. */}
                <Field label="Série">
                  <CampoBusca
                    id="vincular-serie"
                    rotulo="Buscar série"
                    placeholder={editoras.length ? "Buscar séries da " + editoras.join(" e ") : "Buscar série"}
                    opcoes={opcoesSerie}
                    onEscolher={setLinkSerieId}
                    vazio={"Nenhuma série" + (editoras.length ? " da " + editoras.join(" e ") : "") + " cadastrada."}
                  />
                </Field>
                <button className="btn btn-quiet" style={{ width: "100%", marginTop: 10 }} onClick={() => setLinkSerieId(null)}>Cancelar</button>
              </div>
            ) : (
              <LinkPanel
                volume={v}
                serie={series.find((s) => s.id === linkSerieId)}
                edicoesDaSerie={(edicoesPorSerie[linkSerieId] || []).slice().sort((a, b) => (parseNum(a.numero) ?? 1e9) - (parseNum(b.numero) ?? 1e9))}
                rangeDe={rangeDe} setRangeDe={setRangeDe}
                rangeAte={rangeAte} setRangeAte={setRangeAte}
                avulsoNum={avulsoNum} setAvulsoNum={setAvulsoNum}
                onRange={onRange} onAvulsa={onAvulsa} onToggle={onToggle}
                onClose={() => setLinkSerieId(null)}
              />
            )}
          </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}

export function LinkPanel({
  volume, serie, edicoesDaSerie, rangeDe, setRangeDe, rangeAte, setRangeAte,
  avulsoNum, setAvulsoNum, onRange, onAvulsa, onToggle, onClose,
}) {
  if (!serie) return null;
  return (
    <div className="linked-serie">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginBottom: 12 }}>
        <span className="t-small truncate" style={{ fontWeight: 500 }}>{serie.nome}</span>
        <button className="btn btn-ghost" style={{ padding: 0, fontSize: "0.75rem" }} onClick={onClose}>Fechar</button>
      </div>

      <Field label="Vincular um intervalo">
        <div className="row">
          <input className="input" type="number" placeholder="de" value={rangeDe} onChange={(e) => setRangeDe(e.target.value)} />
          <input className="input" type="number" placeholder="até" value={rangeAte} onChange={(e) => setRangeAte(e.target.value)} />
          <button className="btn btn-primary" onClick={onRange}>Vincular</button>
        </div>
      </Field>

      <div style={{ height: 12 }} />

      <Field label="Vincular uma avulsa">
        <div className="row">
          <input className="input" placeholder="Anual 1" value={avulsoNum} onChange={(e) => setAvulsoNum(e.target.value)} />
          <button className="btn btn-primary" onClick={onAvulsa}>Vincular</button>
        </div>
      </Field>

      <div style={{ height: 14 }} />

      <p className="t-micro" style={{ margin: "0 0 6px" }}>Edições catalogadas</p>
      <div style={{ maxHeight: 190, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {edicoesDaSerie.length === 0 && (
          <p className="t-small muted" style={{ margin: 0 }}>Nenhuma edição catalogada nesta série ainda.</p>
        )}
        {edicoesDaSerie.map((ed) => (
          <label className="checkline" key={ed.id}>
            <input
              type="checkbox"
              checked={volume.edicoesColetadasIds.includes(ed.id)}
              onChange={() => onToggle(ed.id)}
            />
            <span className="num">{ed.numero}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
