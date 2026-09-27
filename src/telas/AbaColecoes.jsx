import { Layers, ChevronDown } from "lucide-react";

import { EmptyState } from "../ui/base";
import { ShelfStrip } from "../ui/Prateleira";
import { VolumeCard } from "../ui/VolumeCard";

export function AbaColecoes({
  lib, abrirVolume, buscando, setOpenColecaoId, colecoesFiltradas, colecoesFechadas,
  colecaoAberta, alternarColecao, alternarTodasColecoes, switchTab,
}) {
  return (
    colecoesFiltradas.length === 0 ? (
      <EmptyState icon={Layers} title={lib.colecoes.length === 0 ? "Nenhuma coleção ainda" : "Nada encontrado"}>
        Uma coleção agrupa volumes em ordem de leitura, como uma saga espalhada por vários encadernados.
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
              <ShelfStrip total={membros.length} cor={c.corBarra}>
                {membros.map((v, i) => (
                  <div key={v.id + ":" + i}>
                    <div className="slot-order">{String(i + 1).padStart(2, "0")}</div>
                    <VolumeCard
                      volume={v}
                      index={0}
                      tabParada={i === 0 ? 0 : -1}
                      open={false}
                      onClick={() => abrirVolume(v.id, { tipo: "colecao", id: c.id })}
                    />
                  </div>
                ))}
              </ShelfStrip>
            )}
          </section>
        );
      })}
      </>
    )
  );
}
