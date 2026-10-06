# Lista de desejos (Longbox)

Data: 2026-10-06. Decisões tomadas com o usuário na conversa de brainstorm.

## Objetivo

Uma lista separada e discreta, tipo carrinho de compras, das HQs que o usuário quer comprar.
Cada desejo é uma HQ cadastrada por inteiro (nome, personagem, editora, formato, séries e
edições, capa), menos o status de leitura. "Comprei" leva o desejo para o acervo.

## Decisões do usuário

- Não é uma aba como HQs, Séries e Coleções. É um ícone de carrinho que abre uma tela própria.
- Os desejos ficam agrupados por editora (a lista ignora a faixa de editora e mostra tudo) e,
  dentro de cada editora, por personagem, como na aba HQs.
- Até 3 personagens fixados, independentes dos fixados de HQs/Séries.
- Dentro de cada personagem: primeiro as HQs soltas (grade de capas, reordenável por
  long-press e arrasto, igual à aba HQs), depois as coleções desse personagem.
- A coleção da lista mostra só os volumes que faltam, numerados pela posição na coleção real
  (a Saga do Flash tem 17 no acervo, então mostra 18, 19, 20 e 21). Os volumes dentro da faixa
  são reordenáveis como na aba Coleções.
- As coleções de um personagem também são reordenáveis: long-press no título recolhe todas as
  coleções do personagem em linhas finas, a segurada sobe com sombra leve, **sem tremer nem
  respirar**, as outras deslizam, e tudo reabre ao soltar.
- Esconder/mostrar tudo, busca e filtros (formato, personagem, editora), como na aba HQs.
- Entrada: formulário leve no app para anotar rápido, e Claude completa pela skill
  `longbox-cadastrar` quando pedido (opção C).
- O desejo é um volume normal sem status, com o campo livre `notas` para loja e preço (o preço
  flutua, então não há campo de preço nem total).
- Uma série criada para um desejo aparece na aba Séries com 0 edições possuídas. Isso é
  aceitável.
- "Comprei" fica na ficha do desejo, age na hora e oferece Desfazer (sem caixa de confirmação).
- Atalho: tecla **4** (seguindo 0 a 3 das abas).
- Ícone no computador à esquerda da busca. No celular, no topo. A posição final é decidida na
  prévia.

## Dados

Dois documentos novos na biblioteca, mais um fora dela:

```
library/desejos          {items: [...]}   os desejos
library/desejosColecoes  {items: [...]}   as coleções da lista
library/fixadosDesejos   {personagens: [...]}  até 3, fora do backup e do undo, como library/fixados
```

- **Desejo:** mesmo formato de um volume (`id, titulo, personagem, tambem?, editora, tipo, ano,
  capaAssetId, mini?, edicoesColetadasIds, ordemSeries?, notas, ordem`), **sem `status`**. O
  `ordem` é a posição na grade do personagem, como em volumes.
- **Coleção da lista:** `{id, nome, corBarra?, descricao, membros: [desejoId], colecaoId?,
  ordem}`. `colecaoId` aponta para a coleção do acervo quando ela existe. `ordem` é a posição
  da coleção entre as coleções do mesmo personagem. O personagem de uma coleção da lista é o do
  primeiro membro (o mesmo critério da aba Coleções).
- Um desejo dentro de uma coleção da lista não aparece também na grade solta do personagem.
- **Numeração na faixa:** a posição `i` (base 0) mostra `n + i + 1`, onde `n` é o número de
  membros da coleção do acervo apontada (0 sem `colecaoId`).
- Séries e edições continuam em `library/series` e `edicoes/<serieId>`. Um desejo só aponta
  para edições. A posse continua calculada só a partir de `library/volumes`, então nenhum
  desejo conta em "Seu acervo", nas barras, nos totais ou no progresso de série.
- `library/desejos` e `library/desejosColecoes` entram na tabela `DOCS` de
  `lib/armazenamento.js`: leitura no boot, gravação com fusão de três vias (`mesclarLista`,
  por id), `onSnapshot` ao vivo e eco das próprias gravações ignorado. Comparações de texto
  sempre via `canon()`.
- Apagar uma série ou edição (`lib/biblioteca.js`) também a tira de `edicoesColetadasIds` dos
  desejos.
- Exportar/importar levam `desejos` e `desejosColecoes`. Um backup antigo sem eles importa
  como lista vazia.
- O undo restaura a biblioteca inteira, então já cobre os desejos.
- Normalização (`biblioteca.js`): um desejo recebe as mesmas defesas de um volume (arrays
  vazios etc.) e tem qualquer `status` descartado.

## Interface

- **Ícone:** carrinho (`ShoppingCart`) com um selo do número de desejos, no estilo do selo de
  filtros. Fica à esquerda da busca no computador e no topo no celular. Esc, a seta de voltar,
  o ícone ou a tecla 4 fecham.
- **Tela:** camada fixa por cima da aba atual, no mesmo padrão do `.hub-capa` (rolagem própria,
  cabeçalho fixo, inset do topo do app Claude no iOS). Cabeçalho: voltar, "Lista de desejos ·
  N", busca, filtros com contagem de ativos, Esconder/mostrar tudo (tecla Q) e "Novo desejo"
  (tecla N).
- **Corpo:** título por editora (cor e logo). Dentro dele, os blocos de personagem com
  `GroupHead` (alfinete e dobra), fixados primeiro via `porFixados`. Em cada bloco vem a grade
  de capas soltas (`VolumeCard` reordenável, mesmo arrasto da v164, `DWELL_MS` 110), com a
  legenda mostrando o formato no lugar do status. Depois vêm as coleções: título com nome, cor
  e "N volumes", e a `ShelfStrip` numerada com o arrasto da aba Coleções.
- **Arrastar coleções:** long-press no título de uma coleção recolhe as coleções do personagem
  em linhas (nome + contagem), e a linha segue o dedo com a geometria de
  `lib/arrastoSeguir.js` (retângulos fixos, fantasma se o ancestral rola, limpeza em toda
  saída). Sem inclinação, tremor nem respiração. Ao soltar grava `ordem` e reabre.
- **Busca:** título do desejo e nome da coleção (achar a coleção traz todos os membros).
- **Filtros:** formato, personagem e editora, com o mesmo componente da aba HQs
  (`OpcaoFiltro`/`CampoBusca`).
- **Ficha do desejo:** a `VolumeSheet` sem os botões de status, com as notas em destaque,
  séries e edições como num volume e o botão **Comprei**.
- **Formulário:** o de volume sem o campo de status. Coleção: uma da lista, uma do acervo
  (cria a coleção da lista apontando para ela) ou uma nova.
- **Vazio:** "Nada na lista ainda" e o botão "Novo desejo".

## Comprei

Uma única mutação da biblioteca, gravada junto:

1. Tira o desejo de `desejos` e o põe em `volumes` com `status: "nao_lida"` e um `ordem` no fim do personagem. Todo o resto (séries, edições, capa,
   mini, notas) vai junto.
2. Se ele está numa coleção da lista com `colecaoId`, entra nos membros dessa coleção do
   acervo na posição `n + i` (a mesma numeração que a faixa mostrava, limitada ao fim).
3. Sem `colecaoId`: cria a coleção do acervo com `nome`, `corBarra` e `descricao` da coleção
   da lista, põe o volume nela e grava o `colecaoId` novo na coleção da lista.
4. Uma coleção da lista que fica sem membros é removida.
5. Toast "Movido para o acervo" com Desfazer (o undo da biblioteca, que desfaz tudo, inclusive
   a coleção criada).

## Skill `longbox-cadastrar`

Ganha o destino "cadastrar como desejo": mesmo dossiê, mas o volume vai para
`library/desejos` (sem status) e a coleção vai para `library/desejosColecoes` (com `colecaoId`
quando a coleção já existe no acervo). Também completa um desejo anotado no app. É feito
depois do app, num passo próprio.

## Testes

No padrão do projeto (`npm run check`), cada teste escrito antes do código e começando
falhando:

- Comprei: item solto, coleção existente (posição `n + i`), coleção nova (criada e apontada),
  coleção da lista que esvazia.
- Desfazer o Comprei.
- Apagar série ou edição limpa os desejos.
- Fusão e sincronia dos dois documentos novos (no padrão de `test-sincronia.mjs`).
- Backup ida e volta, incluindo um backup antigo sem desejos.
- Nenhum desejo conta em acervo, totais ou progresso de série.
- Busca, filtros, fixados e numeração da faixa.
- Arrastos (grade, faixa, coleções) conferidos no Chrome real, com o roteiro de dedo contínuo.

## Prévia e publicação

Antes do link real: um artefato separado com contrato fixado, mais uma cópia da biblioteca
(os 7 documentos da biblioteca e alguns desejos de exemplo), para o usuário testar no iPhone e
decidir a posição do ícone. Só depois disso o link real é publicado.

## Fora do escopo

Preço numérico e total, data de lançamento, filtro "só coleções / só soltas", mover um volume
do acervo para a lista.
