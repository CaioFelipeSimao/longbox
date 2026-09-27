import { BookOpen, ChevronDown } from "lucide-react";

import { EmptyState } from "../ui/base";
import { GroupHead } from "../ui/CorPersonagem";
import { VolumeCard, gradeTeclado } from "../ui/VolumeCard";

export function AbaHqs({
  lib, setCorPersonagem, openVolumeId, buscando, gruposFechados, grupoAbertoVolumes,
  alternarGrupoVolumes, alternarTodosVolumes, volumesFiltrados, podeReordenarVolumes,
  dragVisual, editoraCorPorNome, registrarCardNode, volDragPointerDown,
  volDragPointerMove, volDragPointerEnd, abrirVolumeCard,
}) {
  return (
    volumesFiltrados.length === 0 ? (
      <EmptyState icon={BookOpen} title={lib.volumes.length === 0 ? "Sua caixa está vazia" : "Nada encontrado"}>
        {lib.volumes.length === 0
          ? 'Toque em "Novo" para catalogar seu primeiro volume.'
          : "Tente outro termo de busca ou limpe os filtros."}
      </EmptyState>
    ) : (
      <>
        {/* Hidden while searching, same reason as the séries tab's own
            toggle: a search already forces every matching group open. */}
        {!buscando && (
          <div className="fold-all">
            <button
              className="btn btn-quiet press"
              data-dica={(volumesFiltrados.every((g) => !gruposFechados.has(g.personagem)) ? "Esconder todas" : "Mostrar todas") + " · Q"}
              onClick={() => alternarTodosVolumes(volumesFiltrados, !volumesFiltrados.every((g) => !gruposFechados.has(g.personagem)))}
            >
              <ChevronDown
                size={14}
                data-rot={volumesFiltrados.every((g) => !gruposFechados.has(g.personagem)) ? "false" : "true"}
              />
              {volumesFiltrados.every((g) => !gruposFechados.has(g.personagem)) ? "Esconder todas" : "Mostrar todas"}
            </button>
          </div>
        )}
      {volumesFiltrados.map((grupo) => {
        const arrastandoNesteGrupo = dragVisual != null && dragVisual.personagem === grupo.personagem;
        const itensExibidos = arrastandoNesteGrupo
          ? dragVisual.ids.map((id) => grupo.itens.find((v) => v.id === id)).filter(Boolean)
          : grupo.itens;
        const aberto = grupoAbertoVolumes(grupo.personagem) || arrastandoNesteGrupo;
        return (
        <section className="group" key={grupo.personagem}>
          <GroupHead
            personagem={grupo.personagem}
            count={grupo.itens.length}
            onPickColor={setCorPersonagem}
            aberto={aberto}
            onAlternar={alternarGrupoVolumes}
            itemLabel="HQs"
          />
          {aberto && (
          <div className="shelf stagger" role="group" aria-label={"HQs de " + grupo.personagem} {...gradeTeclado}>
            {itensExibidos.map((v, i) => (
              <VolumeCard
                key={v.id}
                volume={v}
                index={i}
                tabParada={i === 0 ? 0 : -1}
                open={v.id === openVolumeId}
                onClick={() => abrirVolumeCard(v.id)}
                reordenavel={podeReordenarVolumes}
                personagem={grupo.personagem}
                dragging={dragVisual != null && dragVisual.id === v.id}
                holdColor={editoraCorPorNome[(v.editora || "").trim().toLowerCase()]}
                cardRef={(el) => registrarCardNode(v.id, el)}
                onDragPointerDown={(e) => volDragPointerDown(e, v, grupo.personagem)}
                onDragPointerMove={volDragPointerMove}
                onDragPointerEnd={volDragPointerEnd}
              />
            ))}
          </div>
          )}
        </section>
        );
      })}
      </>
    )
  );
}
