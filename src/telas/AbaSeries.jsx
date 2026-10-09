import { Library, ChevronDown } from "lucide-react";

import { EmptyState } from "../ui/base";
import { GroupHead } from "../ui/CorPersonagem";
import { SEM_EDICOES, SerieLinha } from "../ui/Series";

// v174: owned/total editions of a group, one count per série (a série split into
// ranges appears twice in itens), with the same totals a row shows.
function progressoDoGrupo(itens, edicoesPorSerie, ownedIds) {
  let owned = 0, total = 0;
  const vistas = new Set();
  for (const { serie } of itens) {
    if (vistas.has(serie.id)) continue;
    vistas.add(serie.id);
    const eds = edicoesPorSerie[serie.id] || SEM_EDICOES;
    owned += eds.filter((e) => ownedIds.has(e.id)).length;
    total += serie.totalEdicoes || eds.length;
  }
  return { owned, total };
}

export function AbaSeries({
  lib, setCorPersonagem, fixados, alternarFixado, edicoesPorSerie, ownedEdicaoIds, buscando, filtrando, openSerieId,
  gruposAbertos, grupoAberto, alternarGrupo, alternarTodos, seriesFiltradas,
  abrirSerieNaFaixa, filtroAutor,
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
              data-dica={(seriesFiltradas.every((g) => gruposAbertos.has(g.personagem)) ? "Esconder todas" : "Mostrar todas") + " · Q"}
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
            progresso={progressoDoGrupo(grupo.itens, edicoesPorSerie, ownedEdicaoIds)}
            onPickColor={setCorPersonagem}
            aberto={grupoAberto(grupo.personagem)}
            onAlternar={alternarGrupo}
            fixado={fixados.includes(grupo.personagem)}
            onFixar={alternarFixado}
          />
          {grupoAberto(grupo.personagem) && grupo.itens.map((item) => (
            <SerieLinha
              key={item.serie.id + ":" + item.faixa.nome}
              serie={item.serie}
              faixa={item.faixa}
              eds={edicoesPorSerie[item.serie.id] || SEM_EDICOES}
              ownedIds={ownedEdicaoIds}
              filtroAutor={filtroAutor}
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
