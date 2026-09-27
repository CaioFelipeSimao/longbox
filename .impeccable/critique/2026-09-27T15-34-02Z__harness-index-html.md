---
target: Longbox harness (v107)
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\ACER\\longbox\\harness\\index.html"
target_fingerprint: "sha256:3b0e734818dfd730938878716b24ebef3fce45eea50c73e643fcdacaae424bbc"
target_path: "C:\\Users\\ACER\\longbox\\harness\\index.html"
timestamp: 2026-09-27T15-34-02Z
slug: harness-index-html
---
# Crítica do Longbox (v107), 2026-09-27

Method: dual-agent (A design review, B detector + headless browser), harness with stand-in covers.

## Nota: 28/40, Bom (anterior 27/40)

| # | Heurística | Nota | Problema principal |
|---|---|---|---|
| 1 | Status do sistema | 3 | Sem sinal de "salvo"; só se sabe da falha |
| 2 | Mundo real | 3 | "Toque num número" no PC; "Continue rolando" descreve gesto |
| 3 | Controle e liberdade | 3 | Remover série de 100 edições = 1 toque + 8s de desfazer |
| 4 | Consistência | 2 | Nome do grupo abre cor; HQs aberto vs Séries dobrado; "faltam N" sempre ciano |
| 5 | Prevenção de erros | 3 | Zerar com botão "Confirmar" |
| 6 | Reconhecer | 2 | Mapa da série em blocos fechados; Séries abre dobrada |
| 7 | Flexibilidade | 3 | Sem mudança de status em lote |
| 8 | Estética | 3 | Hub com 7 blocos; folha da série vazia |
| 9 | Recuperação | 3 | Zerar depende do Desfazer |
| 10 | Ajuda | 3 | Painel de atalhos com botão |

## Especificidade
Conteúdo autoral (lombada de Coleções, barras de sequência, Falta pouco, folha tingida pela capa); moldura genérica (escuro + ciano + pílula + Geist + 8px). Detector: CLI 0 achados (side-tab suprimido); navegador 34/29/27/9/32 por tela, quase todos falsos positivos de decisões (faixa de personagem, ciano, Geist, mural 8px, faixas do Falta pouco). Real: `.btn-badge` 10px (styles.css:732). Fracos: sombra larga + borda na capa grande; primeira capa de Coleções colada na borda. Sem overlay visível (headless).

## Problemas prioritários
- [P1] Mapa da série fechado (SerieSheet.jsx:194 buckets sem open; Séries dobrada por padrão). Abrir blocos com faltantes ou todos se <=2; juntar bloco de 1 edição; reavaliar dobra padrão. /impeccable layout
- [P1] Tema claro: Falta pouco ilegível sobre o fundo animado (Hub.jsx:287, .gm styles.css:1391). Base sólida ou fim da máscara antes; "faltam N" na cor da faixa. Confirmar uso do tema claro. /impeccable colorize
- [P2] Nome do grupo = seletor de cor, h2 dentro de button (CorPersonagem.jsx:21-24). Linha inteira dobra; só a bolinha abre cor, aria-label "Cor de X". /impeccable harden
- [P2] Tablet: controles de texto 30-38px (nome do grupo 30, seg3 38, btn 38, busca 36, capa 34); .btn-badge 10px. min-height 44 sob pointer coarse; badge 11px. /impeccable adapt
- [P3] Textos: Zerar "Apagar tudo" com contagens (App.jsx:1906); "Escolha um número" (SerieSheet.jsx:184); "Abrir minha coleção" (Hub.jsx:241). /impeccable clarify

## Personas
- Alex: Tab passa por todas as capas; sem pular grupo nem setas na grade; primeira tecla perdida até clicar no frame.
- Sam: h2 em botão; CapaDesenhada repete título no nome acessível (VolumeCard.jsx); faltantes só nos blocos fechados.
- Colecionador no tablet deitado: alvos 30-38px; Novo sem campo de capa; lixeira no início da barra (conflita com decisão v101, mantida).

## Menores
Filtros e Novo dois primários; "0 lendo" ruído; "Esconder todas" ocupa linha; cabeçalho fixo cobre capa; "DO SEU ACERVO" versalete; "Copiar faltantes" em 12px.

## Perguntas
- Por que todo caminho até o mapa da série começa fechado?
- Quais 2 blocos do hub ficariam?
- Como seria a moldura com lombadas, saco e cartão e indícias em vez de SaaS?
