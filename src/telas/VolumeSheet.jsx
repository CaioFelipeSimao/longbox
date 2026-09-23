import { useEffect, useRef } from "react";
import { Pencil, Trash2, Link2, ImagePlus, ChevronLeft, ChevronRight, Copy } from "lucide-react";

import { STATUS, STATUS_ORDER } from "../lib/constantes";
import { parseNum } from "../lib/util";
import { usePasteImage } from "../lib/hooks";
import { Field, Sheet } from "../ui/base";
import { CoverArt } from "../ui/VolumeCard";

export function VolumeSheet({
  volume, onClose, onEdit, onDuplicate, onDelete, onStatus, colecoes, grupos,
  canUpload, uploading, onCoverPick, series, edicoesPorSerie,
  linkSerieId, setLinkSerieId, linkPickSerie, setLinkPickSerie,
  rangeDe, setRangeDe, rangeAte, setRangeAte, avulsoNum, setAvulsoNum,
  onRange, onAvulsa, onToggle, onOpenEdicaoNaSerie, recede,
  anterior, proximo, onNavegar, direcao,
}) {
  const inputRef = useRef(null);
  const kept = useRef(null);
  if (volume) kept.current = volume;
  const v = volume || kept.current;

  usePasteImage(!!volume && canUpload, onCoverPick);

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
  const toque = useRef(null);
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
      title={v ? v.titulo : ""}
      subtitle={v ? v.personagem : null}
      actions={v && (
        <>
          <button className="btn-icon" onClick={() => onNavegar(anterior, "ant")} disabled={!anterior} aria-label="Volume anterior">
            <ChevronLeft size={16} />
          </button>
          <button className="btn-icon sheet-nav-fim" onClick={() => onNavegar(proximo, "prox")} disabled={!proximo} aria-label="Próximo volume">
            <ChevronRight size={16} />
          </button>
          <button className="btn-icon" onClick={onEdit} aria-label="Editar"><Pencil size={16} /></button>
          <button className="btn-icon" onClick={onDuplicate} aria-label="Duplicar este volume"><Copy size={16} /></button>
          <button className="btn-icon" onClick={onDelete} aria-label="Remover">
            <Trash2 size={16} color="var(--danger-text)" />
          </button>
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
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
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
            <dl className="deflist" style={{ flex: 1, minWidth: 0 }}>
              <dt>Tipo</dt><dd>{v.tipo}</dd>
              {v.editora && <><dt>Editora</dt><dd>{v.editora}</dd></>}
              {v.ano && <><dt>Ano</dt><dd className="num">{v.ano}</dd></>}
              {colecoes.length > 0 && (
                <><dt>Coleções</dt><dd>{colecoes.map((c) => c.nome).join(", ")}</dd></>
              )}
            </dl>
          </div>

          <div>
            <p className="t-micro" style={{ margin: "0 0 8px" }}>Status de leitura</p>
            <div className="seg3">
              {STATUS_ORDER.map((k) => (
                <button key={k} data-kind={k} data-on={v.status === k ? "true" : "false"} onClick={() => onStatus(k)}>
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
            {grupos.map((g) => (
              <div className="linked-serie" key={g.serie ? g.serie.id : "removida"}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                  <span className="t-small truncate" style={{ fontWeight: 500 }}>
                    {g.serie ? g.serie.nome : "Série removida"}
                  </span>
                  {g.serie && (
                    <button
                      className="btn btn-ghost"
                      style={{ padding: 0, fontSize: "0.75rem", color: "var(--accent-text)" }}
                      onClick={() => { setLinkSerieId(g.serie.id); setLinkPickSerie(g.serie.id); }}
                    >
                      Gerenciar
                    </button>
                  )}
                </div>
                <div className="tiles" style={{ marginTop: 8 }}>
                  {g.edicoes.map((e) => (
                    g.serie ? (
                      <button
                        type="button"
                        className="tile"
                        data-owned="true"
                        key={e.id}
                        onClick={() => onOpenEdicaoNaSerie(g.serie.id, e.id)}
                      >
                        {e.numero}
                      </button>
                    ) : (
                      <span className="tile" data-owned="true" key={e.id}>{e.numero}</span>
                    )
                  ))}
                </div>
              </div>
            ))}

            {linkSerieId === null ? (
              <button
                className="btn btn-quiet"
                style={{ width: "100%", marginTop: 4 }}
                onClick={() => { setLinkSerieId("__pick__"); setLinkPickSerie(""); }}
              >
                <Link2 size={14} /> Vincular edições de uma série
              </button>
            ) : linkSerieId === "__pick__" ? (
              <div className="linked-serie">
                <Field label="Série">
                  <select className="select" value={linkPickSerie} onChange={(e) => setLinkPickSerie(e.target.value)}>
                    <option value="">Escolha a série</option>
                    {series.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </Field>
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setLinkSerieId(null)}>Cancelar</button>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => { if (linkPickSerie) setLinkSerieId(linkPickSerie); }}
                  >
                    Continuar
                  </button>
                </div>
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
