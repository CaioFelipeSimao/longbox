# Lista de desejos: plano de implementação

> **Execução:** cada tarefa vira um brief para o Codex (`codex-companion task --write --model gpt-6.1-sol --effort high`), rodado em segundo plano. O Codex não consegue rodar o build aqui (esbuild "Cannot read directory '..'"), então Claude roda `npm run check` depois de cada tarefa, corrige deslizes, faz os commits e confere os arrastos no Chrome real. Os passos usam checkbox (`- [ ]`).

**Objetivo:** uma lista de desejos separada do acervo (carrinho), agrupada por editora e personagem, com HQs soltas e coleções reordenáveis e um "Comprei" que leva o desejo para o acervo.

**Arquitetura:** os desejos moram em `lib.desejos` e `lib.desejosColecoes`, gravados em dois documentos novos que entram na tabela `DOCS` genérica (fusão, sincronia, eco). A posse continua calculada só a partir de `lib.volumes`, então nada do acervo muda. A lógica pura (agrupar, filtrar, numerar, comprar) fica em `src/lib/desejos.js`, testada sem DOM. A tela é um componente novo, no padrão de camada do hub.

**Tecnologia:** React 18, esbuild, testes `.mjs` com JSDOM rodados por `scripts/test.mjs` (`npm run check` = build + testes).

**Spec:** `docs/superpowers/specs/2026-10-06-lista-de-desejos-design.md`

## Restrições globais

- Textos da interface em pt-BR. Proibido usar travessão (—) e meia-risca (–) em qualquer texto do app.
- Comprimentos novos de CSS em `rem` (regra "Scale (v162)" do DESIGN.md).
- Toda comparação de documentos passa por `canon()` (`lib/armazenamento.js`).
- Um desejo nunca conta como possuído: `possuidasFisicas`, `statsGerais`, Hub e Séries leem só `lib.volumes`.
- Valor de status ao comprar: `"nao_lida"` (`STATUS` em `lib/constantes.js`).
- Tecla **4** abre e fecha a lista. Q dobra tudo e N cria um "Novo desejo" enquanto ela está aberta.
- Arrasto das coleções: sem inclinação, tremor nem "respiração". Só sombra leve.
- Lista de desejos agrupada por editora, ignorando a faixa de editora.
- O runner conta como falha qualquer linha com "FAIL". Resumos dizem "falharam".

## Foco de revisão

1. Desejo com `edicoesColetadasIds` de edições já possuídas: a série não pode mudar de progresso antes do Comprei. Teste na Tarefa 2.
2. Comprar o último membro de uma coleção da lista, que some, e depois Desfazer: a coleção da lista e a do acervo voltam exatamente como eram. Teste na Tarefa 2.
3. Coleção da lista cujo `colecaoId` aponta para uma coleção do acervo que foi apagada: tratar como sem `colecaoId` (numeração a partir de 1, e o Comprei cria uma nova). Teste na Tarefa 2.
4. Outro aparelho grava `library/desejos` enquanto esta aba tem uma edição pendente: fusão por id sem perder nenhum lado. Teste na Tarefa 1.
5. Backup antigo sem `desejos`: importa com a lista vazia e não quebra. Backup novo vai e volta igual. Teste na Tarefa 1.

---

### Tarefa 1: dados, gravação e sincronia

**Arquivos:**
- Modificar: `src/lib/biblioteca.js` (`normalizeLib`, `deleteSerie`, `deleteEdicao`; nova `deleteDesejo`)
- Modificar: `src/lib/armazenamento.js` (`DOCS`, `loadLibrary`, fixados parametrizados)
- Criar: `tests/test-desejos-dados.mjs`
- Modificar: `tests/test-sincronia.mjs` (casos dos documentos novos)

**Interfaces produzidas:**
- `lib.desejos: Desejo[]` e `lib.desejosColecoes: ColecaoDesejo[]`, sempre arrays depois de `normalizeLib`.
- `Desejo` = volume sem `status` (`normalizeLib` descarta `status`) e com as mesmas defesas (`edicoesColetadasIds` array, `tambem`/`ordemSeries` validados, `TIPOS_RENOMEADOS`). Para não duplicar, extrair `normalizarVolume(v)` em `biblioteca.js` e usá-lo nos dois.
- `ColecaoDesejo` = `{id, nome, corBarra?, descricao, membros: string[], colecaoId?, ordem?}`, com `membros` sempre array.
- `deleteDesejo(lib, id)`: tira o desejo e o remove de `membros` de toda coleção da lista. Uma coleção da lista que fica vazia é removida.
- `deleteSerie` e `deleteEdicao` também limpam `edicoesColetadasIds` de `lib.desejos`.
- `DOCS.desejos = {path: "library/desejos", items, mesclarLista, last: "lastDesejos", daLib: lib => lib.desejos}` e `DOCS.desejosColecoes` igual, com `library/desejosColecoes` e `lastDesejosColecoes`. `loadLibrary` lê os dois junto, no mesmo `Promise.all`, e preenche os `last*` com `canon`.
- Fixados da lista: `lerFixados(db, path = "library/fixados")`, `gravarFixados(personagens, path = "library/fixados")` e `ouvirFixados(..., path)` ganham o caminho como parâmetro opcional, e a lista usa `"library/fixadosDesejos"`. As chamadas existentes não mudam. O eco próprio é guardado por caminho.

- [ ] **Passo 1: escrever os testes que falham.** `tests/test-desejos-dados.mjs` (copiar o estilo de imports e de PASS/FAIL de `tests/test-backup.mjs`):
  - `normalizeLib({volumes: []})` dá `desejos: []` e `desejosColecoes: []`.
  - `normalizeLib({desejos: [{id:"d1", status:"lida", edicoesColetadasIds: null}]})` dá `d1` sem `status` e com `edicoesColetadasIds: []`.
  - `deleteSerie` e `deleteEdicao` tiram as edições de um desejo.
  - `deleteDesejo` com o único membro de uma coleção da lista remove a coleção. Com dois membros, só tira o membro.
  - Ida e volta: `normalizeLib(JSON.parse(JSON.stringify(lib)))` preserva desejos e coleções da lista. Um backup sem as chaves importa com listas vazias.

  Em `tests/test-sincronia.mjs`, seguindo os casos de volumes:
  - O boot lê `library/desejos`.
  - Uma escrita externa em `library/desejos` (outro aparelho adiciona d2) e uma edição local (renomeia d1) se fundem: os dois aparecem.
  - O eco da própria escrita não gera toast.
- [ ] **Passo 2:** `npm run check` e confirmar que os testes novos falham.
- [ ] **Passo 3:** implementar o que está em "Interfaces produzidas".
- [ ] **Passo 4:** `npm run check` com tudo passando, contando as linhas PASS.
- [ ] **Passo 5:** commit `v165-1: dados da lista de desejos (documentos, fusao, limpeza)`.

### Tarefa 2: lógica pura (`src/lib/desejos.js`)

**Arquivos:**
- Criar: `src/lib/desejos.js`
- Criar: `tests/test-desejos.mjs`

**Interfaces consumidas:** a forma dos dados da Tarefa 1, `porFixados` (`lib/util.js`) e `uid` (`lib/util.js`).

**Interfaces produzidas:**
- `colecaoDoAcervo(lib, cd)`: a coleção do acervo apontada por `cd.colecaoId`, ou `null` se não existir mais.
- `numeroNaFaixa(lib, cd, i)`: `n + i + 1`, onde `n` = `colecaoDoAcervo(...)?.membros.length || 0`.
- `colecaoDoDesejo(lib, desejoId)`: a coleção da lista que contém o desejo, ou `null`.
- `filtrarDesejos(lib, {busca, tipo, personagem, editora})`: devolve `Set` de ids de desejos visíveis. A busca ignora acento e maiúsculas, olha `titulo` e o nome da coleção da lista (bater no nome traz todos os membros). `tipo`, `personagem` e `editora` vazios não filtram. O `tambem` conta para personagem e editora.
- `agruparDesejos(lib, visiveis, fixados)`: devolve `[{editora, personagens: [{nome, soltos: Desejo[], colecoes: [{colecao, membros: Desejo[]}]}]}]`.
  - Editoras em ordem alfabética pt-BR, "Sem editora" por último.
  - Personagens ordenados com `porFixados(fixados)` e depois alfabética.
  - `soltos` são os desejos fora de qualquer coleção da lista, ordenados por `ordem` e depois `titulo`.
  - `colecoes` vêm por `ordem` e depois `nome`. O personagem e a editora de uma coleção são os do primeiro membro.
  - Grupos e coleções sem nenhum desejo visível são omitidos.
- `comprarDesejo(lib, desejoId, novoId = uid)`: devolve o `lib` novo:
  1. Tira o desejo de `desejos` e o põe em `volumes` com `status: "nao_lida"` e `ordem` = (maior `ordem` dos volumes do mesmo personagem) + 1, ou sem `ordem` se nenhum tiver. Mantém `id`, capa, `mini`, `notas` e edições.
  2. Se ele está numa coleção da lista: com coleção do acervo válida, insere em `membros` na posição `min(n + i, membros.length)`. Sem ela, cria `{id: novoId(), nome, corBarra, descricao, membros: [id]}` no acervo e grava `colecaoId` na coleção da lista.
  3. Tira o desejo de `membros` e remove a coleção da lista que ficar vazia.

- [ ] **Passo 1: escrever os testes que falham** em `tests/test-desejos.mjs`, com uma biblioteca de exemplo: coleção do acervo "A Saga do Flash Collection" com 17 membros, coleção da lista apontando para ela com d18 a d21, um desejo solto, um desejo da Marvel e um com `tambem`.
  - `numeroNaFaixa` dá 18 a 21. Com `colecaoId` órfão, dá 1 a 4.
  - `comprarDesejo(d18)` põe o volume em `volumes` com `nao_lida` e na posição 17 dos membros do acervo. A coleção da lista fica com 3.
  - Comprar d18 a d21 em sequência esvazia e remove a coleção da lista, e os membros do acervo ficam `...17, d18, d19, d20, d21`.
  - Coleção da lista sem `colecaoId`: o Comprei cria a coleção no acervo com o mesmo nome e cor, e a coleção da lista passa a apontar para ela. O segundo Comprei entra na mesma coleção, sem criar outra.
  - Desejo solto: só vira volume.
  - Antes da compra, um desejo com edições não muda o conjunto de possuídas, calculado como no `App.jsx`, a partir de `lib.volumes`. Depois da compra, muda.
  - Busca "saga" traz os 4 membros. "flash rebirth" acha pelo título. Filtro de editora "Marvel" deixa só o da Marvel. O `tambem` faz o desejo aparecer também na outra editora.
  - Agrupamento: um fixado vem primeiro, e as coleções vêm em `ordem`.
  - O lib anterior não é modificado (`Object.freeze` profundo na entrada).
- [ ] **Passo 2:** rodar e confirmar que falham.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `npm run check` com tudo passando.
- [ ] **Passo 5:** commit `v165-2: logica da lista de desejos (agrupar, filtrar, numerar, comprar)`.

### Tarefa 3: arrastos para a lista

**Arquivos:**
- Modificar: `src/telas/useArrastarVolumes.js` (parâmetro da lista alvo)
- Modificar: `src/telas/useArrastarColecao.js` (parâmetro da lista alvo)
- Criar: `src/telas/useArrastarColecoesDesejo.js`
- Criar: `tests/test-arrastar-colecoes-desejo.mjs`
- Modificar: os testes de arrasto existentes só se a assinatura exigir

**Interfaces produzidas:**
- `useArrastarVolumes(lib, persist, volumesDaFaixa, chave = "volumes")`: lê e grava `lib[chave]`, e o resto não muda (DWELL_MS 110, deslize de 260 ms).
- `useArrastarColecao(colecao, lib, persist, chave = "colecoes")`: grava os `membros` em `lib[chave]`.
- `useArrastarColecoesDesejo(lib, persist, ids)`: `ids` são as coleções da lista de um personagem, na ordem da tela. Devolve `{recolhido, visual, registrar(id, el), pointerDown(e, id), mover, finalizar, suppressClickRef}`.
  - Um long-press (o mesmo tempo de armar dos outros arrastos) liga `recolhido` antes de medir. As linhas recolhidas são medidas como retângulos fixos e a ordem segue `lib/arrastoSeguir.js`.
  - Ao soltar, grava `ordem` 0..n-1 nessas coleções e desliga `recolhido`.
  - Toda saída (pointercancel, blur, desmontagem) limpa o estado.
  - Sem rotação, escala animada ou keyframes no fantasma, só `box-shadow`.

- [ ] **Passo 1: escrever os testes que falham**, seguindo o roteiro de eventos de `tests/test-arrastar-colecao.mjs`:
  - Long-press liga `recolhido`. Arrastar a 3ª linha para o topo e soltar grava `ordem` [3ª, 1ª, 2ª] e desliga `recolhido`.
  - pointercancel no meio não grava nada e desliga `recolhido`.
  - `useArrastarVolumes` com `chave = "desejos"` reordena `lib.desejos` e deixa `lib.volumes` intacto.
  - `useArrastarColecao` com `chave = "desejosColecoes"` reordena os membros lá.
- [ ] **Passo 2:** confirmar que falham.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `npm run check` com tudo passando, incluindo os testes antigos de arrasto.
- [ ] **Passo 5:** commit `v165-3: arrastos da lista de desejos`.

### Tarefa 4: tela, ícone, ficha, formulário e Comprei

**Arquivos:**
- Criar: `src/telas/TelaDesejos.jsx`
- Modificar: `src/telas/App.jsx` (ícone, estado, abrir e fechar, Comprei, formulário em modo desejo, atalhos)
- Modificar: `src/telas/VolumeSheet.jsx` (prop `desejo`: sem botões de status, notas em destaque, botão "Comprei")
- Modificar: `src/telas/Formularios.jsx` (`FormVolume` com prop `desejo`: sem status, campo Coleção com as coleções da lista, as do acervo e "Nova coleção")
- Modificar: `src/telas/useAtalhos.js` (tecla 4; com a lista aberta, Q e N agem nela)
- Modificar: `src/styles.css` (camada, cabeçalho, linhas recolhidas, selo, tudo em `rem`)
- Criar: `tests/test-desejos-tela.mjs`
- Modificar: `tests/test-atalhos.mjs`

**Interfaces consumidas:** Tarefas 1 a 3, mais `AbaHqs`/`GroupHead`/`VolumeCard`/`ShelfStrip`/`OpcaoFiltro`/`PersonagemFiltro`/`EmptyState` e o padrão de camada `.hub-capa` (rolagem própria, cabeçalho fixo, `--topo`, `::before` sob a barra do app Claude).

**Comportamento:**
- **Ícone:** `ShoppingCart` (lucide-react) com `aria-label="Lista de desejos, N itens"`, selo com N quando N > 0 (estilo `.btn-badge`) e `data-dica="Lista de desejos · 4"`. No computador fica antes do `SearchBox` e no celular antes do espaçador.
- **Abrir:** estado `desejosAberto`. A tela cobre a aba, como o hub, e fecha com Esc, a seta, o ícone ou a tecla 4. Com a lista aberta, uma ficha aberta por cima fecha primeiro no Esc.
- **Cabeçalho:** seta de voltar, "Lista de desejos · N", busca (estado próprio), botão de filtros com contagem, dobrar tudo e "Novo desejo".
- **Corpo:** `agruparDesejos(lib, filtrarDesejos(...), fixadosDesejos)`. Cada editora tem um título com a cor e o logo dela. Cada personagem tem um `GroupHead` com alfinete (até 3, recusa o 4º com o toast que já existe) e dobra. Os soltos aparecem em grade de `VolumeCard` com legenda de formato. As coleções têm título (nome, cor e "N volumes") e uma `ShelfStrip` com `slot-order` = `numeroNaFaixa`.
- **Vazio:** `EmptyState` "Nada na lista ainda" com o botão "Novo desejo". Uma busca sem resultado mostra "Nada encontrado na lista".
- **Ficha:** abre `VolumeSheet` com `desejo`. "Comprei" chama `comprarDesejo`, faz `persist`, fecha a ficha e mostra o toast "Movido para o acervo" com `desfazer {antes, depois}`. Editar abre `FormVolume desejo`. Apagar usa `deleteDesejo` com Desfazer.
- **Formulário em modo desejo:** grava em `lib.desejos`. Na coleção:
  - escolher uma da lista adiciona aos membros;
  - escolher uma do acervo cria (ou reaproveita) a coleção da lista com aquele `colecaoId`, nome e cor;
  - "Nova coleção" cria a coleção da lista sem `colecaoId`.
- **Celular:** o ícone fica no topo e a tela tem a mesma camada. O arrasto usa o bloqueador de `touchmove` por grade, como na v160.

- [ ] **Passo 1: escrever os testes que falham.** `tests/test-desejos-tela.mjs`, no estilo de `tests/test-render.mjs` e `tests/test-fixados.mjs`, montando o App com o db falso:
  - Sem desejos, o ícone não tem selo e a tela vazia mostra "Nada na lista ainda".
  - Com 5 desejos, o selo mostra 5. Clicar no ícone abre a tela, que tem os títulos "DC Comics" e "Marvel Comics" e as faixas numeradas 18 a 21.
  - Abrir d18 mostra "Comprei" e nenhum botão de status. Clicar em Comprei faz o toast "Movido para o acervo" aparecer, e o volume aparece na aba HQs. Desfazer volta d18 para a lista.
  - Buscar "saga" na lista deixa só a coleção.
  - Fixar um personagem na lista não muda `library/fixados`.
  - Em `tests/test-atalhos.mjs`: 4 abre e fecha. Com a lista aberta, N abre o formulário em modo desejo, e Esc fecha a lista.
- [ ] **Passo 2:** confirmar que falham.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `npm run check` com tudo passando.
- [ ] **Passo 5:** commit `v165-4: tela da lista de desejos, Comprei e atalho 4`.

### Tarefa 5 (Claude): conferência real, prévia e publicação

- [ ] Ler os diffs das Tarefas 1 a 4 e corrigir deslizes (acesso a nulo com a ficha fechada, teste olhando a tela errada).
- [ ] No Chrome real (harness), com o roteiro de dedo contínuo (`medir-limite.mjs`), conferir os três arrastos da lista: grade, faixa e coleções recolhidas, sem tremor. Conferir também a camada no tamanho de iPhone.
- [ ] Prévia: artefato separado com o contrato fixado. Semear o db com os 7 documentos da biblioteca real via ArtifactData e mais alguns desejos de exemplo (Saga do Flash 18 a 21, um omnibus solto). Mandar o link para o usuário testar no iPhone e decidir a posição do ícone.
- [ ] Com o "pode" do usuário: build final, publicar no link real e conferir live == dist por `cmp`.
- [ ] Registrar em DESIGN.md (dados, layout, atalho 4) e HISTORICO.md (v165), criar a tag `v165` e atualizar a memória.

### Tarefa 6: skill `longbox-cadastrar`, destino "desejo"

Num passo próprio, depois da v165 no ar. O Codex roda com raiz no repositório da skill (`~/.claude/skills/longbox-cadastrar`), porque não escreve fora dela.

- [ ] Em SKILL.md e no script de gravação: a opção "cadastrar como desejo" grava o volume em `library/desejos`, sem status. A coleção vai para `library/desejosColecoes`, com `colecaoId` quando já existe no acervo. Séries e edições vão para os lugares de sempre. Também ganha a opção de completar um desejo existente, pelo id.
- [ ] Teste com um desejo de exemplo num db de cópia. Commit no repositório da skill.
