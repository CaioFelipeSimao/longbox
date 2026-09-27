---
target: Longbox harness (v117)
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:C:\\Users\\ACER\\longbox\\harness\\index.html"
target_fingerprint: "sha256:3b0e734818dfd730938878716b24ebef3fce45eea50c73e643fcdacaae424bbc"
target_path: "C:\\Users\\ACER\\longbox\\harness\\index.html"
timestamp: 2026-09-27T20-26-23Z
slug: harness-index-html
---
# Crítica do Longbox (v117), 2026-09-27

Method: dual-agent (A design review, B detector + headless browser), harness with stand-in covers. Phone-width claims re-measured in the parent.

## Nota: 29/40, Bom (anterior 28/40)

| # | Heurística | Nota | Problema principal |
|---|---|---|---|
| 1 | Status do sistema | 3 | "Salvo" some abaixo de 520px; toast "Volume removido." não diz qual |
| 2 | Mundo real | 3 | Botão "Coleção" no celular acima da aba "Coleções"; "Ordem manual dentro do personagem" |
| 3 | Controle e liberdade | 3 | Desfazer, Ctrl+Z, Esc, setas na folha: bom |
| 4 | Consistência | 3 | Reordenar = arrastar na estante, ↑/↓ na coleção; ciano como cor de dado em Formatos |
| 5 | Prevenção de erros | 3 | Celular: Exportar/Zerar cortados fora da tela |
| 6 | Reconhecer | 3 | Séries dobrada sem progresso; mapa só diz o volume depois do toque |
| 7 | Flexibilidade | 3 | Sem tecla para status; setas das estantes fora do painel de atalhos |
| 8 | Estética | 3 | Folha da coleção: 4 controles por linha |
| 9 | Recuperação | 3 | Desfazer 8s com texto bom |
| 10 | Ajuda | 2 | Painel de atalhos incompleto; faixas do Falta pouco e cores do mapa sem explicação |

## Especificidade
Autoral (capas desenhadas, faixas por personagem, lombada de Coleções, barras de sequência, Falta pouco, folha tingida). Genérico só: Séries dobrada (três barras escuras) e o bloco Seu acervo. Detector CLI: harness 3 (side-tab .swatch::after styles.css:1287, dark-glow do toast styles.css:2188, stripes .skel-spines styles.css:2315), src 0. Navegador 8-30 por tela, todos decisões documentadas (listra da capa, ciano, Geist, 11px, faixa de Coleções). Medições: nada abaixo de 11px, contraste AA nos dois temas, alvos <44px no hub (linhas Seu acervo 32, chips de status 30, linhas de progresso 31, btn-ghost 38, brand 32). Sem overlay visível (headless).

## Problemas prioritários
- [P1] Largura de celular: busca com 0px em HQs a 390 (espaçador App.jsx:1513 divide com .search flex:1, styles.css:754; 120px a 768 ao lado de vazio); .footer-actions sem wrap (styles.css:2357): Exportar backup x=-43, Zerar tudo até x=433. /impeccable adapt
- [P2] Folha da coleção é tabela de admin: Lidas até aqui, ↑, ↓, × em cada linha (ColecaoSheet.jsx:80-86), vermelho 14x, rótulos sem nome do volume. /impeccable distill
- [P2] Séries dobrada não mostra nada: cabeçalho dobrado pode trazer possuídas/total e faltam N na cor da faixa. /impeccable layout
- [P2] Sem tecla para Não lida/Lendo/Lida na folha (useAtalhos.js:26-48); painel (PainelAtalhos.jsx:5-22) sem setas/Home/End/Enter. /impeccable harden
- [P3] Alvos do hub no tablet: linhas Seu acervo 32px, chips 30, progresso 31, btn-ghost 38. /impeccable adapt

## Personas
- Alex: sem tecla de status; painel incompleto; "Novo" não diz o que cria; reordenar coleção só com cliques.
- Sam: ↑/↓/× sem nome do volume; toast de remoção sem nome.
- Colecionador no tablet: busca 120-139px ao lado de espaço vazio; × colado no ↓; tela dividida herda os problemas do celular.

## Menores
Faltantes no mapa são o estado mais apagado; exemplo "Nightwing (Volume 2)" é série existente; Nova série com 8 campos (de/até e Ordem manual atrás de "Mais opções"); scrim claro esverdeado; faixa do grupo ocupa a largura toda com 5 capas; .swatch::after listra lateral (intencional).

## Perguntas
- Se Séries fica dobrada, por que o estado dobrado é a tela menos informativa?
- A folha da coleção deveria parecer a faixa de capas com um "você está aqui"?
- Marcar como lida deveria ser um gesto na estante?
