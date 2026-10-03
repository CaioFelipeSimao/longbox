# Autores e reimpressões nas edições (Longbox)

Data: 2026-10-03. Decisões tomadas com o usuário na conversa de brainstorm.

## Objetivo

1. Cada edição que o usuário possui mostra writer, penciler e inker.
2. Edições que são reimpressões ficam marcadas, com um filtro para escondê-las.

A wanted (lista de desejos) fica para depois que tudo isto estiver no ar. Não faz parte deste spec.

## Decisões do usuário

- O Longbox só reflete o que o usuário tem. Reimpressão não cobre a original: cada edição vale por si, sem estado "coberto por". Duas versões da mesma obra são itens separados, com o ano no nome ("Batman: Ano Um (2020)").
- Reimpressão: selo mais filtro "esconder reimpressões" (só exibição; totais e "tenho" não mudam).
- Autores: ver na ficha, buscar pelo nome e filtrar na aba Séries (como o filtro de personagem).
- Autores só das edições possuídas. A skill `longbox-cadastrar` passa a sempre preenchê-los.
- Reimpressões: começar pelo Flash vol. 1 e pelas séries que o usuário apontar. Sem varredura geral (o wiki marca de forma irregular).

## Dados

Três campos opcionais na edição (documento `edicoes/<serieId>`), então nada existente quebra e os exports antigos importam sem transformação:

- `autores: { writer: string[], penciler: string[], inker: string[] }`
- `reimpressao: boolean`
- `origem: string` — texto livre, ex. "Flash #105 (1959)". Texto, não link, porque a original quase nunca está cadastrada.

Edições sem esses campos continuam válidas (sem autores, não reimpressão). O limite de 256 KiB por série segue folgado. `mesclar.js` e a normalização em `biblioteca.js` precisam preservar os campos novos.

## Interface

- Ficha da edição: Writer, Penciler, Inker; selo e `origem` quando for reimpressão.
- Grade da série: selo "reimpressão" no bloco da edição.
- Filtros da série: interruptor "Esconder reimpressões" (padrão desligado).
- Busca: também acha por nome de autor.
- Aba Séries: filtro por autor no molde do filtro de personagem (`CampoBusca`).
- Antes de publicar cada passo visual: prévia (captura ou artifact descartável) e "pode" do usuário.

## Preenchimento

- Autores: em lotes, a partir do wiki, só para edições em `edicoesColetadasIds`. O `SKILL.md` de `longbox-cadastrar` e seu parser passam a gravar os autores em todo cadastro novo, e uma passada de backfill cobre o que já existe.
- Reimpressões: Flash vol. 1 primeiro, o resultado é conferido pelo usuário; depois as séries que ele pedir.

## Entrega, em ordem

1. Reimpressões: campos, selo, filtro, Flash vol. 1.
2. Autores: campos, ficha, skill, backfill das edições possuídas.
3. Busca e filtro por autor.

Cada passo: testes antes (falhando), `npm run check`, entrada no `HISTORICO.md`, `DESIGN.md` atualizado, rotina de publicação habitual.

## Fora de escopo

Wanted, totais ou "série completa" que excluam reimpressões, ligação entre reimpressão e original, estado "coberto por".
