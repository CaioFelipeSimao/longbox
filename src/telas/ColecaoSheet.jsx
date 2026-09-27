import { useEffect, useRef, useState } from "react";
import { X, Pencil, Trash2, ArrowUp, ArrowDown, ChevronDown } from "lucide-react";

import { STATUS, STATUS_ORDER } from "../lib/constantes";
import { PALETA_CROMATICA, PALETA_NEUTRA } from "../lib/cores";
import { Field, Sheet } from "../ui/base";
import { Swatch } from "../ui/CorPersonagem";

export function ColecaoSheet({
  lib, onRemover, setOpenColecaoId, addMemberSel, openColecao, colecaoRola,
  ordemRecolhida, alternarOrdem, definirCorBarra, openEditarColecao, adicionarMembro,
  removerMembro, moverMembro, personagensDaColecao, onLidasAte, onStatus,
}) {
  // v120: the reading order reads by default; reordering and taking volumes out
  // live in an "Editar ordem" mode, left whenever another collection opens.
  const [editando, setEditando] = useState(false);
  const listaRef = useRef(null);
  const colecaoId = openColecao ? openColecao.id : null;
  useEffect(() => { setEditando(false); }, [colecaoId]);
  const variosPersonagens = openColecao ? personagensDaColecao(openColecao).length > 1 : false;

  // Alt+↑ / Alt+↓ on a focused row moves that volume; focus follows to the same
  // button in the row it lands on.
  function moverPeloTeclado(e, idx) {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    const dir = e.key === "ArrowUp" ? -1 : 1;
    const destino = idx + dir;
    if (destino < 0 || destino >= openColecao.membros.length) return;
    e.preventDefault();
    const acao = e.target.dataset && e.target.dataset.acao;
    moverMembro(openColecao.id, idx, dir);
    requestAnimationFrame(() => {
      const linha = listaRef.current && listaRef.current.querySelectorAll(".ordem-linha")[destino];
      const alvo = linha && (linha.querySelector('[data-acao="' + acao + '"]:not(:disabled)') || linha.querySelector("button:not(:disabled)"));
      if (alvo) alvo.focus();
    });
  }

  return (
    <Sheet
      open={!!openColecao}
      onClose={() => setOpenColecaoId(null)}
      title={openColecao ? openColecao.nome : ""}
      subtitle={openColecao && openColecao.descricao ? openColecao.descricao : null}
      actions={openColecao && (
        <>
          <button className="btn-icon btn-remover" onClick={() => onRemover({ type: "colecao", id: openColecao.id })} aria-label="Remover">
            <Trash2 size={16} color="var(--danger-text)" />
          </button>
          <button className="btn-icon" onClick={() => openEditarColecao(openColecao)} aria-label="Editar" data-dica="Editar · E"><Pencil size={16} /></button>
        </>
      )}
    >
      {openColecao && (
        <>
          {personagensDaColecao(openColecao).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {personagensDaColecao(openColecao).map((p) => <span className="chip" key={p}>{p}</span>)}
            </div>
          )}
          <div ref={listaRef}>
            <div className="ordem-topo">
            <button
              type="button"
              className="ordem-head"
              onClick={() => alternarOrdem(openColecao.id)}
              aria-expanded={ordemRecolhida.has(openColecao.id) ? "false" : "true"}
            >
              <span className="t-micro">Ordem de leitura</span>
              <span className="t-small muted num">{openColecao.membros.length}</span>
              <ChevronDown size={16} data-rot={ordemRecolhida.has(openColecao.id) ? "true" : "false"} />
            </button>
            {!ordemRecolhida.has(openColecao.id) && openColecao.membros.length > 0 && (
              <button type="button" className="btn btn-ghost ordem-editar" data-on={editando ? "true" : "false"} onClick={() => setEditando((x) => !x)}>
                {editando ? "Pronto" : "Editar ordem"}
              </button>
            )}
            </div>
            {!ordemRecolhida.has(openColecao.id) && (<>
            {openColecao.membros.length === 0 && (
              <p className="t-small muted" style={{ margin: 0 }}>Nenhum volume nesta coleção ainda.</p>
            )}
            {openColecao.membros.map((vid, idx) => {
              const v = lib.volumes.find((x) => x.id === vid);
              if (!v) return null;
              return (
                <div key={vid + ":" + idx} className="ordem-linha" onKeyDown={editando ? (e) => moverPeloTeclado(e, idx) : undefined}>
                  <span className="num t-small muted ordem-num">{idx + 1}</span>
                  <div className="ordem-texto">
                    <p className="t-small truncate ordem-titulo">{v.titulo}</p>
                    {variosPersonagens && <p className="t-small muted truncate ordem-sub">{v.personagem}</p>}
                  </div>
                  {!editando && v.status === "lida" && (
                    /* v115: a volume already read can be set back (a "Lidas até aqui" pressed
                       by mistake, or one being reread) right here. */
                    <select
                      className="ordem-status"
                      value={v.status}
                      onChange={(e) => onStatus(v.id, e.target.value)}
                      aria-label={"Status de leitura de " + v.titulo}
                    >
                      {STATUS_ORDER.map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
                    </select>
                  )}
                  {/* v114: reading a saga in order, mark this one and every one before it. */}
                  {!editando && v.status !== "lida" && (
                    <button
                      type="button"
                      className="btn btn-ghost ordem-ate"
                      onClick={() => onLidasAte(openColecao.id, idx)}
                      aria-label={"Marcar como lidas até " + v.titulo}
                    >
                      Lidas até aqui
                    </button>
                  )}
                  {editando && (
                    <span className="ordem-acoes">
                      <button className="btn-icon" data-acao="subir" disabled={idx === 0} onClick={() => moverMembro(openColecao.id, idx, -1)} aria-label={"Mover " + v.titulo + " para cima"}><ArrowUp size={14} /></button>
                      <button className="btn-icon" data-acao="descer" disabled={idx === openColecao.membros.length - 1} onClick={() => moverMembro(openColecao.id, idx, 1)} aria-label={"Mover " + v.titulo + " para baixo"}><ArrowDown size={14} /></button>
                      <button className="btn-icon ordem-tirar" data-acao="tirar" onClick={() => removerMembro(openColecao.id, vid)} aria-label={"Tirar " + v.titulo + " da coleção"}>
                        <X size={14} color="var(--danger-text)" />
                      </button>
                    </span>
                  )}
                </div>
              );
            })}
            </>)}
          </div>
          {/* Only offered when this collection's strip is long enough to have
              a bar, folded or not: a colour for a bar that cannot exist would
              change nothing. */}
          {colecaoRola(openColecao) && (
            <div className="cor-barra">
              <p className="t-micro" style={{ margin: "0 0 8px" }}>Cor da barra</p>
              <div className="swatches">
                {PALETA_CROMATICA.map((spec, i) => (
                  <Swatch key={"c" + i} spec={spec} atual={openColecao.corBarra}
                    onPick={(_, s) => definirCorBarra(openColecao.id, s)} />
                ))}
              </div>
              <p className="t-micro" style={{ margin: "14px 0 8px" }}>Neutros</p>
              <div className="swatches">
                {PALETA_NEUTRA.map((spec, i) => (
                  <Swatch key={"n" + i} spec={spec} atual={openColecao.corBarra}
                    onPick={(_, s) => definirCorBarra(openColecao.id, s)} />
                ))}
              </div>
              <button
                className="btn btn-quiet"
                style={{ width: "100%", marginTop: 10 }}
                data-on={!openColecao.corBarra ? "true" : "false"}
                onClick={() => definirCorBarra(openColecao.id, null)}
              >
                {!openColecao.corBarra ? "Usando a cor da editora" : "Voltar para a cor da editora"}
              </button>
            </div>
          )}
          <Field label="Adicionar volume">
            <select
              className="select"
              value={addMemberSel}
              onChange={(e) => { if (e.target.value) adicionarMembro(openColecao.id, e.target.value); }}
            >
              <option value="">Escolha um volume</option>
              {lib.volumes.filter((v) => !openColecao.membros.includes(v.id)).map((v) => (
                <option key={v.id} value={v.id}>{v.titulo}</option>
              ))}
            </select>
          </Field>
        </>
      )}
    </Sheet>
  );
}
