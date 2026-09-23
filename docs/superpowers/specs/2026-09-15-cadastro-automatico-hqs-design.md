# Cadastro automático de HQs no Longbox

Data: 2026-09-15
Estado: desenho aprovado em conversa, aguardando revisão deste documento

## 1. O problema

Cadastrar um encadernado no Longbox à mão custa: preencher os campos do volume,
subir a capa, descobrir de quais séries ele coleciona edições, conferir se cada
série já existe, criar as que faltam com nome, anos, personagem e total de
edições, checar se a série tem anuais, e por fim vincular cada edição coletada.
Para um Compendium que puxa de oito séries diferentes isso é uma tarde.

A skill recebe **só o nome do encadernado** e faz tudo isso, parando uma única
vez para você aprovar o que ela encontrou.

## 2. Escopo

**Dentro:**

- Cadastro de volume, coleção, séries e edições a partir do nome de um encadernado
- Capa baixada e subida automaticamente
- Criação dos slots de edição de toda a série, não só das colecionadas
- Preenchimento de mês e ano de edições que já existem no banco sem data
- Séries anuais como séries separadas
- Gravação direta no banco do artifact publicado

**Fora:**

- Editoras que não a DC. Toda a verificação foi feita no wiki da DC. A Marvel tem
  wiki de estrutura parecida mas não testada, e a tabela `library/editoras` só tem
  DC Comics hoje. Uma HQ da Marvel deve ser recusada com essa explicação, não
  tentada às cegas. **Marvel é extensão planejada**, não descartada: o usuário
  cadastra Marvel à mão por enquanto. Acrescentá-la exige uma sondagem própria do
  wiki da Marvel mais a criação da editora em `library/editoras`, e é um trabalho
  separado deste.
- Criar editora nova em `library/editoras`. Exige cor e logo, que são decisões suas.
- Qualquer mudança na interface do Longbox. O dossiê vive na conversa e some.
- Rodar do tablet. A skill precisa do Claude Code no PC.

## 3. Decisões tomadas

Todas decididas com o usuário em 2026-09-15, com o motivo, para não serem
rediscutidas depois:

| Decisão | Escolha | Por quê |
|---|---|---|
| Onde o dado entra | Gravação direta no `db` do artifact | Aparece no app na hora, inclusive no tablet. O caminho do JSON foi descartado porque `importBackup` (`src/app.jsx`) faz `persist(incoming)`, que **substitui a biblioteca inteira** |
| Controle | Dossiê na conversa, aprovação, depois grava | O dado é subjetivo demais para gravar às cegas |
| Onde o dossiê vive | Só na conversa | Nada de campo de fonte no banco, nada de mudança na interface |
| Capa | Baixa e sobe automático | Verificado: funciona |
| Convenção de data | **Data de capa**, como o Fandom | É o padrão de catálogo e é verificável, está impressa na capa |
| Edições avulsas de outras séries | Cadastra tudo, criando séries novas | Fiel ao conteúdo do livro; é o que o usuário já fez no Compendium One |
| Quantos slots por série | **Todos**, não só os colecionados | Pedido explícito do usuário |
| Skill ou agent | Skill, sem subagentes | Um subagent devolveria um relatório para eu repassar, em vez de eu ter visto a página. Incompatível com a regra de verificação |

**Pendência conhecida:** as quatro edições de `Nightwing (Volume 1)` já cadastradas
usam data de venda (Julho a Outubro de 1995); o Fandom dá data de capa (Setembro a
Dezembro). A skill oferece corrigir essas quatro **uma vez**. Se o usuário recusar,
não volta ao assunto.

## 4. Fontes, e o que foi verificado em cada uma

Tudo abaixo foi testado em 2026-09-15.

| Fonte | Como acessar | O que dá | Estado |
|---|---|---|---|
| DC Database (Fandom), API MediaWiki | `curl`. **WebFetch devolve HTTP 402** | Template da série, lista de edições com data, `IssueList` do encadernado, listagem por categoria | Verificado |
| Amazon | `curl`. **WebFetch devolve só lixo de JS** | Capa 968x1500, ISBN, texto "Collects" | Verificado |
| Penguin Random House | WebFetch ou `curl` | Data, páginas, ISBN, texto "Collects" | Verificado |
| `images.randomhouse.com/cover/<ISBN13>` | `curl` | Capa 290x450, endereçada por ISBN, sem raspagem | Verificado |
| bookdelivery.com | `curl`, responde 200 | Capa, em tese | **Não verificado com um livro real** |
| League of Comic Geeks, comics.org | `curl` dá 403; WebFetch não testado | Terceira fonte, se um dia precisar | Não verificado |

**Armadilha registrada:** Amazon e Penguin Random House **não são fontes
independentes**. O texto "Collects…" é idêntico palavra por palavra nos dois,
porque ambos republicam o material de divulgação da DC. Contar os dois como
confirmação é enganoso. A segunda fonte independente de verdade é o `IssueList`
do Fandom, montado à mão pelos editores do wiki.

**Segunda armadilha:** o WebFetch erra por omissão. Na página da Amazon ele
respondeu "descrição não encontrada" e o `curl` na mesma URL trouxe o texto
inteiro. Quando uma fonte parecer vazia, tentar o outro método antes de concluir
que não serve.

### Endereços da API do Fandom

```
Template da série
  api.php?action=query&prop=revisions&rvprop=content&rvslots=main&rvsection=0
         &format=json&formatversion=2&titles=Nightwing%20Vol%202

Lote de edições (até 50 títulos por pedido, separados por |)
  ...&titles=Nightwing+Vol+2+26|Nightwing+Vol+2+27|...

Conjunto real de edições de uma série
  api.php?action=query&list=categorymembers&cmtitle=Category:Nightwing%20Vol%202
         &cmlimit=500&cmnamespace=0&format=json&formatversion=2
```

Medido: 50 edições em 635 ms, 266 KB, 100% com data completa.

## 5. Formato de destino

Lido do banco real, não inventado.

```
library/volumes    {items:[{id, titulo, personagem, tipo, editora, ano,
                            status, notas, capaAssetId, edicoesColetadasIds:[]}]}
library/colecoes   {items:[{id, nome, descricao, membros:[volumeId]}]}
library/series     {items:[{id, nome, personagens, editora, anoInicio, anoFim,
                            totalEdicoes, ordem}]}
edicoes/<serieId>  {items:[{id, serieId, numero, mes, ano}]}
```

Convenções do usuário, extraídas dos dados:

- `titulo` do volume: título da edição americana, acentos incluídos
  (`Nightwing: A Knight in Blüdhaven Compendium Two`)
- `tipo`: um dos sete de `TIPOS` em `src/app.jsx`
- `ano` do volume: ano do encadernado, não da edição original
- `nome` da série: a numeração do Fandom reescrita — `Nightwing Vol 2` vira
  `Nightwing (Volume 2)`
- Séries anuais: `<Série> (Volume N) Annual`, série separada
- `anoFim`: a string `"presente"` quando a série está em curso
- `personagens`: lista de strings, ou de objetos `{nome, de, ate}` quando o
  personagem muda no meio da série
- `mes` da edição: nome do mês **por extenso em português** (`"Dezembro"`)
- `numero` da edição: string, para caber `"1/2"` e `"1000000"`
- Coleção: a linha de encadernados
  (`Nightwing: A Knight in Bludhaven Compendium Collection`)

### Mapeamento do template do Fandom

| Campo do Fandom | Campo do Longbox | Observação |
|---|---|---|
| `TotalIssues` | `totalEdicoes` | **Só quando for número.** Ver caso de borda 9.1 |
| `StartYear` | `anoInicio` | |
| `EndYear` | `anoFim` | Vazio e `Type: Ongoing Series` viram `"presente"` |
| `Featured` | `personagens` | Lista separada por `;`. Ver caso de borda 9.4 |
| `Month` da edição | `mes` | Vem como `"December"` ou como `"3"`. Normalizar e traduzir |
| `Year` da edição | `ano` | |

## 6. A regra de verificação

Nenhum campo entra no dossiê com uma fonte só.

**Independência:** duas fontes são independentes quando uma não deriva da outra.
Amazon e Penguin Random House são uma só. Wikipédia citando o Fandom é uma só.
O `IssueList` do Fandom e o "Collects" da editora são duas.

**O dossiê sai em três blocos**, nesta ordem, para a atenção do usuário ir só
para o fim:

1. **Confirmado** — duas ou mais fontes concordam. Uma linha por item, sem detalhe.
2. **Fonte única** — só um lugar diz. O item, e qual lugar.
3. **Conflito** — as fontes discordam. As duas versões, e de onde vem cada uma.

Se os blocos 2 e 3 vierem vazios, o usuário aprova sem ler nada.

**Nenhum item do bloco 3 é gravado sem escolha explícita do usuário.** Itens do
bloco 2 são gravados, marcados no dossiê.

## 7. O pipeline

### Fase 1 — Identificar o livro

Busca a página `<Título> (Collected)` no Fandom e a página da Amazon. Sai: título
canônico, ano, mês, tipo, ISBN, `PreviousCollection`, `NextCollection`.

Se houver ambiguidade — `Book One` contra `Compendium One`, ou mais de uma edição
do mesmo livro — **para e pergunta**, não escolhe.

### Fase 2 — O que o livro coleciona

Duas listas:

- `IssueList` do Fandom: entradas `{{c|Nightwing Vol 2 26}}`, em ordem de leitura,
  já com o nome canônico da série de cada edição
- "Collects" da editora, via Amazon ou Penguin (conta como uma fonte)

Deduplicar: uma edição que contém várias histórias aparece uma vez por história.
`Nightwing Secret Files and Origins Vol 1 1` aparece cinco vezes no Compendium Two.

Cruzar as duas listas pela regra da seção 6.

### Fase 3 — Resolver as séries

Para cada série citada, converter `X Vol N` para `X (Volume N)` e casar contra
`library/series` com comparação tolerante a **caixa, acento, pontuação e espaço**.
A comparação literal nunca casaria, porque o Fandom escreve `Nightwing Vol 2` e o
Longbox guarda `Nightwing (Volume 2)`.

Série que já existe: usa o `id` dela, não cria nada.
Série nova: busca o template, monta o registro.

### Fase 4 — Anuais

Anuais **não têm página de série** no Fandom: `Nightwing Annual Vol 2` é um
redirecionamento para `Nightwing Vol 2`. Descobrir por enumeração — pedir
`<Série> Annual Vol N 1` até `40` num lote e contar quais existem. Se a 40 existir,
pedir o lote seguinte, porque a série é mais longa que o palpite. O total é a
contagem.

Verificado contra o trabalho manual do usuário: dá 7 para `Robin Annual Vol 2` e
2 para `Nightwing Annual Vol 2`, os mesmos números que ele digitou.

Anuais viram série separada, `<Série> (Volume N) Annual`, com `anoInicio` e
`anoFim` tirados da primeira e da última edição encontradas.

### Fase 5 — Edições, slots completos

O conjunto de edições de uma série vem da **listagem por categoria**, não de uma
contagem de 1 até N. Contar de 1 a N perde o `#0`, o `#1/2` e o `#1000000`.

Verificado em `Nightwing Vol 2`: 155 membros, sendo 153 inteiros mais `1/2` e
`1000000`. Os inteiros param em 153 justamente porque as duas especiais ocupam as
duas vagas restantes do total de 155.

A contagem da categoria serve também como **segunda confirmação independente** do
`totalEdicoes`, num caminho que não passa pelo template.

Depois, lote de 50 por pedido para pegar `Month` e `Year` de cada edição.

Para cada edição: se já existe no banco e está sem data, preenche; se já existe
com data diferente, é conflito e vai para o bloco 3; se não existe, cria.

### Fase 6 — Coleção

`PreviousCollection` e `NextCollection` dão a linha inteira sem adivinhação. Se um
volume irmão já está numa coleção do banco, o novo volume entra nessa mesma
coleção. Se não, cria a coleção com o nome da linha.

### Fase 7 — Dossiê, aprovação, gravação

## 8. Gravação

**Ordem:** capa primeiro, separada. Depois **um único `batch`** com todos os
documentos.

A capa vai antes porque upload de arquivo não entra em batch. Se o batch falhar
depois, sobra uma imagem órfã invisível no asset store, que a skill apaga.

**O batch é atômico e tem versão travada.** Cada documento é lido antes, e
escrito com `if_version` fixado na versão lida. Se qualquer documento tiver
mudado no meio, nada é escrito, e a skill refaz o cálculo em cima da versão nova.

Isso fecha um risco já registrado neste projeto: um `set` sem `if_version` apaga
trabalho em silêncio.

Documentos tocados num cadastro típico: `library/volumes`, `library/colecoes`,
`library/series`, e um `edicoes/<serieId>` por série envolvida. O Compendium Two
envolve 8 séries, logo até 11 documentos — 9 se os dois itens em disputa forem
recusados. O limite do batch é 50, então há folga larga.

**Custo medido do Compendium Two completo:** cerca de 1.450 slots de edição, uns
35 pedidos ao Fandom, 2 a 3 minutos. `Action Comics (Volume 1)` sozinha fica em
torno de 105 KB dos 256 KB do documento dela. Cabe, mas é o pior caso, e o medidor
de armazenamento do app avisa em 80%.

## 9. Casos de borda

**9.1 Série renumerada.** `Detective Comics Vol 1` traz
`TotalIssues = "883 (first phase); Ongoing (second phase)"` — texto livre, não
número. Quando `TotalIssues` não for um inteiro, usar a contagem da categoria e
dizer no dossiê que o total foi contado, não lido.

**9.2 Edições não inteiras.** `#0`, `#1/2`, `#1000000`. Guardar como string, na
ordem em que a categoria devolve.

**9.3 Série em curso.** `EndYear` vazio com `Type: Ongoing Series` vira
`anoFim: "presente"`. Os slots vão até a última edição que existe hoje; edições
futuras exigem rodar a skill de novo na série.

**9.4 Personagem que muda no meio da série.** `Featured` é uma lista chapada e não
diz faixa, mas **o campo `History` diz, em texto corrido, logo na abertura**.
Verificado em `Green Arrow Vol 2`:

> "The series featured Oliver Queen, the Green Arrow until his death in issue
> #101. From issues #102-137 Oliver Queen's son, Connor Hawke, assumed the
> identity of the Green Arrow."

Que é exatamente o `de: 102, ate: 137` já cadastrado no banco. Então a skill **lê
o `History`** e propõe a faixa.

Como é prosa de uma fonte só, a faixa entra no **bloco 2 do dossiê** (fonte
única), nunca no bloco 1, por mais clara que a frase pareça. E quando a série já
tem `personagens` com `de`/`ate` no banco, **não sobrescrever** — o que está lá
foi decidido à mão.

Se o `History` não disser nada sobre troca, cadastrar sem faixa e seguir. O
usuário registrou que isso é raro e que ajusta à mão quando acontecer, então não
vale parar o cadastro por causa disso.

**9.5 Volume já cadastrado.** Título igual (comparação tolerante) não duplica.
A skill oferece **completar** o que falta — foi o caso do Compendium Two, que
tinha só as 34 de Nightwing e nenhum dos avulsos.

**9.6 Editora fora da DC.** Recusa com explicação, conforme a seção 2.

**9.7 Capa não encontrada em nenhum degrau.** Grava o volume sem `capaAssetId`.
A capa composta do app assume. Diz no dossiê.

**9.8 Capa de degrau inferior.** Dizer de qual fonte a capa veio. 290x450 é uma
queda visível num app construído em volta de capas.

## 10. Quando algo falha

| Falha | O que a skill faz |
|---|---|
| Página do encadernado não existe no Fandom | Segue só com a editora, e o dossiê inteiro vira bloco 2. Diz isso em voz alta |
| Fandom fora do ar ou mudou de formato | Para. Não cadastra com meia fonte |
| `if_version` rejeitado | Relê, recalcula, refaz. Não força |
| Batch rejeitado por tamanho | Diz qual documento estourou e quanto |
| Capa baixa mas o batch falha | Apaga a imagem órfã |

Em toda falha, dizer o que **não** foi feito, não só o que foi.

## 11. Como saber que funcionou

Dois testes com resposta conhecida de antemão:

1. **Reproduzir o trabalho manual.** Rodar contra
   `Nightwing: A Knight in Blüdhaven Compendium One`, que já está cadastrado, sem
   gravar, e comparar o dossiê com o que está no banco. Séries, totais e anos
   devem bater. Os **meses vão divergir de propósito**, pela decisão de data de
   capa da seção 3.
2. **Completar o Compendium Two.** Ele tem 34 edições vinculadas, todas de
   Nightwing (Volume 2). As duas fontes concordam em **41**: as 34 mais
   `Action Comics #771`, `Batman Annual #23`, `Birds of Prey #8, #20, #21`,
   `Nightwing Secret Files and Origins #1` e `Nightwing 80-Page Giant #1`.
   A skill deve encontrar esses sete avulsos, e apresentar `DCU Holiday Bash #2`,
   `Batman Chronicles #20` e `Nightwing: The Target #1` como **conflito entre as
   fontes**, não como fato — os dois primeiros só o Fandom lista, o terceiro só a
   editora.

## 12. Onde a skill mora

`C:\Users\ACER\.claude\skills\longbox-cadastrar\SKILL.md`, invocável por nome.

Não usa subagentes. Usa `Bash` com `curl` para o Fandom e a Amazon, `WebFetch`
para a Penguin, e as ações `read_db`, `write_db` e `upload_asset` do Artifact.

Um segundo ponto de entrada, mais simples: **atualizar uma série** já cadastrada,
para preencher datas em branco e acrescentar edições novas de uma série em curso,
sem passar por encadernado nenhum.
