import { useState, useMemo, useRef } from "react";
import { Plus, Trash2, ImagePlus, ChevronDown } from "lucide-react";

import { ACCENT_HEX, ED_SEM, ED_TODAS } from "../lib/constantes";
import { COR_LONGBOX, PALETA_CROMATICA, PALETA_NEUTRA, swatchColors } from "../lib/cores";
import { Sheet } from "./base";
import { Swatch } from "./CorPersonagem";
import { OpcaoFiltro } from "./Filtros";
import { SegmentedTabs } from "./SegmentedTabs";

export function EditoraLogo({ editora, size }) {
  if (!editora || !editora.logoAssetId) return null;
  return (
    <span className="ed-logo" data-plate={editora.logoFundo || "nenhum"}>
      <img src={"/_blob/" + editora.logoAssetId} alt={editora.nome} style={{ height: size || 37 }} />
    </span>
  );
}

export function EditoraBar({
  editoras, selecionada, onSelect, onManage, buscando, tabs, tab, onTab, contagem, edCroma,
}) {
  const edHue = edCroma ? edCroma.h : null;
  const atual = editoras.find((e) => e.id === selecionada) || null;
  // "Todas as editoras" (and a stale id, which reads as Todas) wears the Longbox
  // cyan (v70), so the band is tinted on every view but "Sem editora".
  const todas = !atual && selecionada !== ED_SEM;
  const cor = atual && atual.cor ? swatchColors(atual.cor, 0)
    : todas ? swatchColors(COR_LONGBOX, 0) : null;
  // Each publisher carries its own colour in the list, as characters do theirs.
  const opcoesEditora = useMemo(() => [
    // The Longbox cyan, as a literal: inside the band --accent is the selected
    // publisher's hue, so the variable would paint "Todas" in someone else's colour.
    { valor: ED_TODAS, rotulo: "Todas as editoras", cor: ACCENT_HEX },
    ...editoras.map((e) => ({ valor: e.id, rotulo: e.nome, cor: e.cor ? swatchColors(e.cor, 0).edge : undefined })),
    { valor: ED_SEM, rotulo: "Sem editora" },
  ], [editoras]);
  const acaoGerenciar = useMemo(() => ({ rotulo: "Gerenciar editoras...", onClick: onManage }), [onManage]);
  const rotulo = selecionada === ED_TODAS ? "Todas as editoras"
    : selecionada === ED_SEM ? "Sem editora"
    : atual ? atual.nome : "Todas as editoras";

  return (
    <div
      className="ed-band"
      style={
        cor || edHue != null
          ? {
              ...(cor ? { "--ed-cor": cor.edge, "--ed-fundo": cor.b } : null),
              ...(edCroma == null
                ? null
                : {
                    "--ed-hue": edCroma.h,
                    "--ed-ink-escuro": edCroma.tintaEscuro,
                    "--ed-ink-claro": edCroma.tintaClaro,
                  }),
            }
          : undefined
      }
      data-tinted={cor ? "true" : "false"}
      data-ed-hue={edHue == null ? undefined : "true"}
    >
    <div className="ed-bar">
      <EditoraLogo editora={atual} />

      <SegmentedTabs tabs={tabs} tab={tab} onTab={onTab} />

      <div className="ed-right">
        {buscando ? (
          <span className="ed-note">Buscando em todo o acervo</span>
        ) : (
          <span className="num ed-note">{contagem}</span>
        )}
        <OpcaoFiltro
          id="filtro-editora"
          rotulo="Editora"
          className="ed-select"
          listaClassName="ed-lista"
          valor={selecionada}
          opcoes={opcoesEditora}
          onChange={onSelect}
          acao={acaoGerenciar}
        />
      </div>
    </div>
    </div>
  );
}

export function EditorasSheet({ open, editoras, onClose, onChange, onLogo, canUpload, enviando }) {
  const [novo, setNovo] = useState("");
  const fileRefs = useRef({});

  return (
    <Sheet open={open} onClose={onClose} title="Editoras" subtitle="Nome, cor e logo de cada uma">
      {editoras.length === 0 && (
        <p className="t-small muted" style={{ margin: 0 }}>
          Nenhuma editora ainda. Elas aparecem sozinhas conforme você preenche o campo
          Editora nos volumes e séries, ou adicione uma abaixo.
        </p>
      )}

      {editoras.map((ed) => (
        <div className="ed-card" key={ed.id}>
          <div className="ed-card-top">
            <input
              className="input"
              value={ed.nome}
              onChange={(e) => onChange(ed.id, { nome: e.target.value })}
              aria-label="Nome da editora"
            />
            <button
              className="btn-icon"
              onClick={() => onChange(ed.id, { customOculta: !ed.customOculta })}
              aria-expanded={ed.customOculta ? "false" : "true"}
              aria-label={(ed.customOculta ? "Mostrar" : "Ocultar") + " personalização de " + ed.nome}
            >
              <ChevronDown size={16} data-rot={ed.customOculta ? "true" : "false"} />
            </button>
            <button
              className="btn-icon"
              onClick={() => onChange(ed.id, null)}
              aria-label={"Remover " + ed.nome}
            >
              <Trash2 size={16} color="var(--danger-text)" />
            </button>
          </div>

          <div className="ed-card-logo">
            {ed.logoAssetId
              ? <EditoraLogo editora={ed} size={34} />
              : <span className="t-small muted">Sem logo</span>}
            {canUpload && (
              <>
                <button className="btn btn-quiet" disabled={enviando} onClick={() => fileRefs.current[ed.id] && fileRefs.current[ed.id].click()}>
                  <ImagePlus size={13} /> {ed.logoAssetId ? "Trocar" : "Enviar logo"}
                </button>
                <input
                  ref={(el) => { fileRefs.current[ed.id] = el; }}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                  hidden
                  onChange={(e) => { onLogo(ed.id, e.target.files[0]); e.target.value = ""; }}
                />
              </>
            )}
          </div>

          {!ed.customOculta && ed.logoAssetId && (
            <div className="seg3">
              {[["nenhum", "Sem fundo"], ["escuro", "Fundo escuro"], ["claro", "Fundo claro"]].map(([v, l]) => (
                <button key={v} data-on={(ed.logoFundo || "nenhum") === v ? "true" : "false"} onClick={() => onChange(ed.id, { logoFundo: v })}>
                  {l}
                </button>
              ))}
            </div>
          )}

          {!ed.customOculta && (
            <div>
              <p className="t-micro" style={{ margin: "0 0 8px" }}>Cor</p>
              <div className="swatches">
                {PALETA_CROMATICA.concat(PALETA_NEUTRA).map((spec, i) => (
                  <Swatch
                    key={i}
                    spec={spec}
                    atual={ed.cor}
                    personagem={ed.id}
                    onPick={(id, s) => onChange(id, { cor: s })}
                  />
                ))}
              </div>
              {ed.cor && (
                <button className="btn btn-quiet" style={{ width: "100%", marginTop: 8 }} onClick={() => onChange(ed.id, { cor: null })}>
                  Remover a cor
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      <div className="row">
        <input
          className="input"
          placeholder="Nova editora"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && novo.trim()) { onChange(null, { nome: novo.trim() }); setNovo(""); } }}
        />
        <button
          className="btn btn-primary"
          onClick={() => { if (novo.trim()) { onChange(null, { nome: novo.trim() }); setNovo(""); } }}
        >
          <Plus size={14} /> Adicionar
        </button>
      </div>

      <p className="t-small muted" style={{ margin: 0 }}>
        Remover uma editora daqui não apaga nenhum volume nem série. Só tira a entrada do
        seletor. O nome precisa bater com o que está escrito no campo Editora dos seus itens.
      </p>
    </Sheet>
  );
}
