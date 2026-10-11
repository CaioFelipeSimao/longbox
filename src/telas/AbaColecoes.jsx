import { Layers, ChevronDown } from "lucide-react";

import { EmptyState } from "../ui/base";
import { ShelfStrip } from "../ui/Prateleira";
import { VolumeCard } from "../ui/VolumeCard";
import { swatchColors } from "../lib/cores";
import { useArrastarColecao } from "./useArrastarColecao";

export function AbaColecoes({
  lib, persist, abrirVolume, buscando, setOpenColecaoId, colecoesFiltradas, colecoesFechadas,
  colecaoAberta, alternarColecao, alternarTodasColecoes, switchTab,
}) {
  return (
    colecoesFiltradas.length === 0 ? (
      <EmptyState icon={Layers} title={lib.colecoes.length === 0 ? "Nenhuma coleção ainda" : "Nada encontrado"}>
        {lib.colecoes.length === 0
          ? "Uma coleção agrupa volumes em ordem de leitura, como uma saga espalhada por vários encadernados."
          : "Tente outro termo de busca ou limpe os filtros."}
      </EmptyState>
    ) : (
      <>
      {/* Same control and same wording as the HQs tab; hidden while
          searching, which forces every collection open anyway. */}
      {!buscando && (
        <div className="fold-all">
          <button
            className="btn btn-quiet press"
            onClick={() => alternarTodasColecoes(colecoesFiltradas, !colecoesFiltradas.every((col) => !colecoesFechadas.has(col.id)))}
          >
            <ChevronDown
              size={14}
              data-rot={colecoesFiltradas.every((col) => !colecoesFechadas.has(col.id)) ? "false" : "true"}
            />
            {colecoesFiltradas.every((col) => !colecoesFechadas.has(col.id)) ? "Esconder todas" : "Mostrar todas"}
          </button>
        </div>
      )}
      {colecoesFiltradas.map((c) => {
        const membros = c.membros.map((vid) => lib.volumes.find((v) => v.id === vid)).filter(Boolean);
        const aberta = colecaoAberta(c.id);
        return (
          <section className="coll" key={c.id} data-aberta={aberta ? "true" : "false"}>
            <div className="coll-head">
              <div style={{ minWidth: 0 }}>
                <h2 className="t-display" style={{ margin: 0 }}>{c.nome}</h2>
                <p className="t-small muted truncate" style={{ margin: "3px 0 0" }}>
                  {membros.length === 0 ? "Sem volumes ainda" : membros.length + " volumes"}
                </p>
              </div>
              <div className="coll-acoes">
                <button className="btn btn-quiet" onClick={() => setOpenColecaoId(c.id)}>Gerenciar</button>
                <button
                  className="btn-icon"
                  onClick={() => alternarColecao(c.id)}
                  aria-expanded={aberta ? "true" : "false"}
                  aria-label={(aberta ? "Esconder" : "Mostrar") + " os volumes de " + c.nome}
                  data-dica={aberta ? "Esconder volumes" : "Mostrar volumes"}
                >
                  <ChevronDown size={16} data-rot={aberta ? "false" : "true"} />
                </button>
              </div>
            </div>
            {!aberta ? null : membros.length === 0 ? (
              <p className="t-small muted">Abra em Gerenciar para adicionar volumes.</p>
            ) : (
              <ColecaoStrip colecao={c} lib={lib} persist={persist} abrirVolume={abrirVolume} />
            )}
          </section>
        );
      })}
      </>
    )
  );
}

// The gesture's owner unmounts with the folded/removed strip, cleaning its ghost
// immediately. Occurrence keys stay stable through each preview and settlement.
function ColecaoStrip({ colecao, lib, persist, abrirVolume }) {
  const drag = useArrastarColecao(colecao, lib, persist);
  const membros = drag.visual?.membros || colecao.membros;
  const order = drag.visual?.order || membros.map((_, i) => i);
  const itens = order.map((indice) => ({ indice, volume: lib.volumes.find((v) => v.id === membros[indice]) })).filter((x) => x.volume);
  const cor = colecao.corBarra;
  const barColor = cor ? (cor.longbox ? "var(--accent)" : swatchColors(cor, 0).edge) : null;
  return (
    <ShelfStrip total={itens.length} cor={cor} onKeyDown={(e) => {
      // A keyboard activation is separate from the synthetic click of a drag.
      if (e.key === "Enter" || e.key === " ") drag.suppressClickRef.current = false;
    }}>
      {itens.map(({ indice, volume: v }, i) => {
        // No bar colour of its own: the hook reads the accent the bar itself draws with.
        const holdColor = barColor || undefined;
        return (
          <div key={v.id + ":" + indice} data-membro-indice={indice}>
            <div className="slot-order">{String(i + 1).padStart(2, "0")}</div>
            <VolumeCard volume={v} index={0} tabParada={i === 0 ? 0 : -1} open={false}
              reordenavel holdColor={holdColor} cardRef={(el) => drag.registrar(indice, el)}
              onDragPointerDown={(e) => drag.pointerDown(e, indice)}
              onDragPointerMove={drag.mover} onDragPointerEnd={drag.finalizar}
              onClick={() => {
                if (drag.suppressClickRef.current) { drag.suppressClickRef.current = false; return; }
                abrirVolume(v.id, { tipo: "colecao", id: colecao.id });
              }} />
          </div>
        );
      })}
    </ShelfStrip>
  );
}
