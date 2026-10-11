import { Library, ChevronDown } from "lucide-react";

import { EmptyState } from "../ui/base";
import { edicoesNaFaixa } from "../lib/biblioteca";
import { GroupHead } from "../ui/CorPersonagem";
import { SEM_EDICOES, SerieLinha } from "../ui/Series";

// v177: count the union of this character's ranges, once per issue and série.
function progressoDoGrupo(itens, edicoesPorSerie, ownedIds) {
  let owned = 0, total = 0;
  const vistas = new Map();
  for (const { serie, faixa } of itens) {
    if (!vistas.has(serie.id)) vistas.set(serie.id, { serie, edicoes: new Map(), inteira: false });
    const vista = vistas.get(serie.id);
    if (faixa.de === null && faixa.ate === null) vista.inteira = true;
    for (const e of edicoesNaFaixa(edicoesPorSerie[serie.id] || SEM_EDICOES, faixa)) vista.edicoes.set(e.id, e);
  }
  for (const { serie, edicoes, inteira } of vistas.values()) {
    const eds = [...edicoes.values()];
    owned += eds.filter((e) => ownedIds.has(e.id)).length;
    total += inteira ? serie.totalEdicoes || eds.length : eds.length;
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
        {lib.series.length === 0
          ? "Cadastre uma série para acompanhar quais edições você já tem e quais faltam."
          : "Tente outro termo de busca ou limpe os filtros."}
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
