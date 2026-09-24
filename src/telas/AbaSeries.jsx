import { Library, ChevronDown } from "lucide-react";

import { EmptyState } from "../ui/base";
import { GroupHead } from "../ui/CorPersonagem";
import { SEM_EDICOES, SerieLinha } from "../ui/Series";

export function AbaSeries({
  lib, setCorPersonagem, edicoesPorSerie, ownedEdicaoIds, buscando, filtrando, openSerieId,
  gruposAbertos, grupoAberto, alternarGrupo, alternarTodos, seriesFiltradas,
  abrirSerieNaFaixa,
}) {
  return (
    seriesFiltradas.length === 0 ? (
      <EmptyState icon={Library} title={lib.series.length === 0 ? "Nenhuma série ainda" : "Nada encontrado"}>
        Cadastre uma série para acompanhar quais edições você já tem e quais faltam.
      </EmptyState>
    ) : (
      <>
        {/* Hidden while searching on purpose: a search already forces every
            matching group open, so this would either read as broken or
            quietly rewrite a state the user cannot see the effect of. Hidden
            under the character filter too: one group left, already open. */}
        {!buscando && !filtrando && (
          <div className="fold-all">
            <button
              className="btn btn-quiet press"
              onClick={() => alternarTodos(seriesFiltradas, !seriesFiltradas.every((g) => gruposAbertos.has(g.personagem)))}
            >
              <ChevronDown
                size={14}
                data-rot={seriesFiltradas.every((g) => gruposAbertos.has(g.personagem)) ? "false" : "true"}
              />
              {seriesFiltradas.every((g) => gruposAbertos.has(g.personagem)) ? "Esconder todas" : "Mostrar todas"}
            </button>
          </div>
        )}
        {seriesFiltradas.map((grupo) => (
        <section className="group" key={grupo.personagem}>
          <GroupHead
            personagem={grupo.personagem}
            count={grupo.itens.length}
            onPickColor={setCorPersonagem}
            aberto={grupoAberto(grupo.personagem)}
            onAlternar={alternarGrupo}
          />
          {grupoAberto(grupo.personagem) && grupo.itens.map((item) => (
            <SerieLinha
              key={item.serie.id + ":" + item.faixa.nome}
              serie={item.serie}
              faixa={item.faixa}
              eds={edicoesPorSerie[item.serie.id] || SEM_EDICOES}
              ownedIds={ownedEdicaoIds}
              aberta={item.serie.id === openSerieId}
              onAbrir={abrirSerieNaFaixa}
            />
          ))}
        </section>
        ))}
      </>
    )
  );
}
