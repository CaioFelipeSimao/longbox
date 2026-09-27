---
target: critique the longobox artifact
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:C:\\Users\\ACER\\longbox\\harness\\index.html"
target_fingerprint: "sha256:3b0e734818dfd730938878716b24ebef3fce45eea50c73e643fcdacaae424bbc"
target_path: "C:\\Users\\ACER\\longbox\\harness\\index.html"
timestamp: 2026-09-26T23-54-07Z
slug: harness-index-html
---
# Crítica Longbox v98 (harness, escuro, 1467x812 + tablet 800x1280)
Método: dual-agent (A: revisão de design, B: detector + navegador)

Nota: 27/40 (Aceitável, na fronteira de Bom)
H1 3 · H2 3 · H3 2 · H4 3 · H5 2 · H6 3 · H7 4 · H8 3 · H9 2 · H10 2

Especificidade: alta nas abas (lombadas em Coleções, barras de sequência nas Séries, grade de números, Falta pouco, Copiar faltantes); genérica nas folhas/modais/formulário (kit SaaS escuro). Folha do volume: capa ~100px contra a tese "as capas são o conteúdo".
Detector: CLI 0 achados (side-tab suprimido em .impeccable/config.json). Overlay: side-tab, undersized-ui-text (9px .cover-fb-*, 10px .slot-order), ai-color-palette (ciano), overused-font (Geist), clipped-overflow .shelf-window, edge-flush .coll-strip. Falsos positivos: side-tab, Geist, ciano, shelf-window. Reais: .slot-order 10px, .cover-fb 9px abaixo do micro de 11px.

## Problemas prioritários
- [P0] Importar backup substitui a biblioteca inteira sem confirmação nem Desfazer (App.jsx:1081-1101, input em 1727).
- [P1] Ordenação lexical: "vol. 1, 10, 11 ... 2" (VolumeCard.jsx:53, Hub.jsx:28, Busca.jsx:26); afeta ← → na folha. Correção: {numeric: true}.
- [P1] Formulários e diálogos sem acessibilidade: Field sem htmlFor, Sheet/Modal sem aria-labelledby, sem foco inicial/trap/retorno, erros sem aria-describedby (base.jsx).
- [P2] Estado só visual: abas sem role=tab/aria-selected (SegmentedTabs.jsx:305), números sem aria-pressed, "Buscar número" só com placeholder, status selecionado quase sem contraste.
- [P2] Alvos de toque 36px (.btn-icon, styles.css:685), Remover a 36px de Duplicar; números 34px.

## Personas
- Alex: sem entrada visível para "?", sem ações em lote, cadastro em 3 idas (formulário, capa, vincular edições).
- Sam: campos sem rótulo, diálogos não tomam foco, abas/números sem estado ARIA, barras aria-hidden.
- Colecionador no tablet: ícones 36px, Excluir ao lado de Duplicar, snapshot de outro aparelho cancela o Desfazer em silêncio.

## Menores
"(meta 50)" redundante e quebrando linha; "Maior documento 7.5 KB de 256 KB" é telemetria no hub; âmbar nas barras de caça fora da paleta, verde com 3 sentidos; aba Séries abre como 3 barras vazias; número faltante sem ação "vincular".

## Perguntas
1. Se a capa é o conteúdo, por que a folha do volume dá 100px a ela?
2. Cadastrar deveria ser um modo em lote (capa, coleção, edições numa passada)?
3. "Seu acervo" serve todo dia ou uma vez por mês?
