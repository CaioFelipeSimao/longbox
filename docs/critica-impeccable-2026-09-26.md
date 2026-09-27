Method: dual-agent. A fez a revisão de design e B rodou o detector + navegador, isolados um do outro. Rodou no harness local (tema escuro, 1467×812 e tablet 800×1280).

# Crítica do Longbox (v98)

## Nota de design: **27/40, Aceitável** (a 1 ponto de "Bom")

| # | Heurística | Nota | Problema principal |
|---|---|---|---|
| 1 | Status do sistema visível | 3 | Aviso, lembrete de backup e contagens "8 de 22" são bons. A aba Séries abre recolhida e não mostra progresso nenhum. |
| 2 | Linguagem do mundo real | 3 | O vocabulário de colecionador está certo. Mas os títulos ficam em "vol. 1, 10, 11… 2". |
| 3 | Controle e liberdade | 2 | Excluir um item tem Desfazer. **Importar backup apaga a biblioteca sem pedir confirmação e sem Desfazer.** |
| 4 | Consistência | 3 | O verde tem três sentidos: lido, edição possuída e "falta pouco". |
| 5 | Prevenção de erros | 2 | Remover fica a 36px de Duplicar. A importação não mostra prévia. |
| 6 | Reconhecer em vez de lembrar | 3 | Os atalhos existem, mas nada na tela leva ao painel "?". |
| 7 | Flexibilidade e eficiência | 4 | Busca com sugestões, atalhos, "Salvar e cadastrar outro", ← →, Ctrl+V para capa, Q. |
| 8 | Estética e minimalismo | 3 | Contido e editorial. O bloco "Seu acervo" do hub é denso e traz telemetria ("Maior documento 7.5 KB de 256 KB"). |
| 9 | Recuperação de erros | 2 | Os erros de campo aparecem, mas não ficam ligados ao campo. Erro de importação só aparece no aviso. |
| 10 | Ajuda | 2 | O painel de atalhos é bom. Nada explica o conceito central: vincular volumes a edições. |

## Especificidade do design

**Avaliação:** as abas são claramente feitas para um colecionador, acima do padrão da categoria. Exemplos: as lombadas com "01 a 11 de 14" em Coleções, as barras de sequência nas Séries, a grade que responde "tenho o nº 46, e em qual volume?", "Falta pouco", "Copiar faltantes" e as capas de reserva compostas. A camada de detalhe é genérica: folhas, modais e formulário parecem um kit escuro de SaaS. A folha do volume contradiz a própria tese do DESIGN.md ("as capas são o conteúdo"): a capa ocupa ~100px e a ficha técnica tem o mesmo peso.

**Detector:**
- **Varredura por código: 0 achados.** Isso só acontece porque o `.impeccable/config.json` já suprime a faixa lateral de cor (`side-tab`), que você aprovou em 13/09.
- **Sobreposição no navegador:** 51 elementos marcados no hub, 28 em HQs, 8 em Séries e 60 em Coleções. As causas são poucas:
  - **Falsos positivos (decisões do DESIGN.md):** a faixa de cor do personagem, a fonte Geist, o ciano como acento único e a janela recortada das lombadas.
  - **Reais:** `.slot-order` a 10px (o "01/02/03" das coleções, `styles.css:1779`) e o texto das capas de reserva a 9px. Os dois ficam abaixo do menor tamanho da sua própria escala (11px). O harness não tem capas reais, o que infla a contagem das capas de reserva.
- A aba **[Human]** continua aberta no Chrome, em Coleções, com as marcações desenhadas. O servidor por trás já foi parado.

## Impressão geral

Nas abas, o app tem personalidade própria e um teclado muito bem resolvido. O ponto fraco está nas bordas: o que acontece quando algo dá errado (importar), e quem não usa mouse e olho (acessibilidade, toque no tablet). A maior oportunidade é a folha do volume: é onde uma capa poderia ocupar a tela, e hoje ela vira uma planilha.

## O que funciona

1. **Um layout por aba** (grade, estante de lombadas, linhas de sequência). A arquitetura é a certa para um colecionador, não uma lista genérica repetida três vezes.
2. **A camada de teclado e busca:** a busca é acessível de verdade (combobox com ARIA completo), tem painel de atalhos real e Desfazer em exclusões de um item.
3. **Disciplina de tokens:** um só acento, numerais mono tabulares e movimento contido. A cor do personagem aparece só como faixa.

## Problemas prioritários

**[P0] Importar backup substitui a biblioteca inteira sem perguntar**
- **Onde:** `importBackup` (`App.jsx:1081`) chama `persist(incoming)` direto, sem confirmação, sem prévia e sem Desfazer. Conferi no código: não existe nenhum `confirm` nesse caminho.
- **Por que importa:** um arquivo antigo escolhido por engano apaga meses de cadastro, na mesma tela onde você já perdeu 20 volumes uma vez.
- **Correção:** antes de gravar, mostrar "Substituir 163 volumes por 140 do arquivo?" com as contagens. Depois, oferecer Desfazer como nas exclusões (o `desfazerAtual` guarda a biblioteca de antes). Separar visualmente Importar e Zerar tudo de Exportar.
- **Comando:** `/impeccable harden`

**[P1] Os títulos são ordenados como texto, não como número**
- **Onde:** `VolumeCard.jsx:53`, `Hub.jsx:28` e `Busca.jsx:26` usam `localeCompare(…, "pt-BR")` sem `{numeric: true}`.
- **Por que importa:** no harness, Nightwing aparece como "vol. 1, 10, 11, 12, 13, 14, 2", e o ← → da folha anda nessa ordem. No app real isso só aparece em grupos sem ordem manual.
- **Correção:** acrescentar `{numeric: true}` nessas chamadas (é uma linha em cada).
- **Comando:** `/impeccable harden`

**[P1] Formulários e diálogos não funcionam para leitor de tela nem só teclado**
- **Onde:** `base.jsx`. O `Field` não liga o `<label>` ao campo. Sheet e Modal não têm título acessível, não recebem foco ao abrir (o foco fica no BODY), não prendem o foco e não o devolvem ao fechar. Erros sem `aria-describedby`.
- **Por que importa:** você usa muito o teclado. Hoje, ao abrir "Novo", o primeiro Tab não cai no formulário.
- **Correção:** `useId` para ligar rótulo e erro ao campo, foco no primeiro campo ao abrir, devolver o foco ao fechar, título como heading com `aria-labelledby`.
- **Comando:** `/impeccable audit`, depois `/impeccable harden`

**[P2] Estados que só existem visualmente**
- **Onde e o quê:**
  - As abas não têm `role="tab"`/`aria-selected` (`SegmentedTabs.jsx:305`).
  - Os números da grade não dizem se estão possuídos.
  - "Buscar número" só tem placeholder.
  - O status selecionado ("Não lida") quase não se distingue dos outros.
- **Comando:** `/impeccable audit`

**[P2] Alvos de toque pequenos no tablet**
- **Onde:** `.btn-icon` tem 36×36 (`styles.css:685`) e os números da grade têm 34px. A referência para tablet é 44–48px. Remover fica ao lado de Duplicar.
- **Correção:** 44px sob `(pointer: coarse)` e afastar Remover.
- **Comando:** `/impeccable adapt`

## Alertas por persona

- **Alex (usuário avançado):**
  - Nada na tela leva ao "?".
  - Não há ações em lote.
  - Cadastrar um livro são 3 idas: formulário, depois capa, depois vincular edições. O formulário não aceita capa nem coleção.
  - A ordem lexical quebra o ← →.
- **Sam (acessibilidade):**
  - Campos sem rótulo acessível.
  - Diálogos não tomam o foco.
  - Abas e números sem estado ARIA.
  - As barras das séries são `aria-hidden`, então tudo depende do texto "45/50" ao lado.
- **Você, cadastrando um lote no tablet:**
  - Ícones de 36px, com Excluir colado em Duplicar.
  - Três telas por livro.
  - Uma atualização vinda de outro aparelho cancela em silêncio o Desfazer que você ia apertar.

## Observações menores

- "45 de 50 possuídas (meta 50)" quebra a linha, e "(meta 50)" é redundante quando o total é igual à meta.
- "Maior documento 7.5 KB de 256 KB" é dado de engenharia na tela inicial.
- As barras de caça usam âmbar, uma cor fora da paleta travada.
- A aba Séries abre como 3 barras escuras vazias.
- Um número faltante diz "Nenhum volume vinculado", mas não oferece a ação de vincular ali.

## Perguntas para pensar

- Se a capa é o conteúdo, por que o único lugar onde uma capa poderia ter a tela inteira lhe dá 100px?
- Já que você cadastra em lotes de 10 ou mais, "cadastrar" deveria ser um modo em lote (capa, coleção e edições numa passada só)?
- "Seu acervo" serve todo dia ou uma vez por mês? Poderia ficar atrás da marca, para a estante começar mais cedo?

**Tendência de `harness-index-html`:** primeira rodada, 27/40, ainda sem histórico.
Salvo em `.impeccable/critique/2026-09-26T23-54-07Z__harness-index-html.md`.

Não alterei nada no código do app. A crítica gravou esse arquivo de histórico dentro da pasta `.impeccable/` do repositório. O tema claro não foi revisto, porque o harness só roda no escuro.
