---
target: Longbox app (harness)
total_score: 31
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\ACER\\longbox\\harness\\index.html"
target_fingerprint: "sha256:3b0e734818dfd730938878716b24ebef3fce45eea50c73e643fcdacaae424bbc"
target_path: "C:\\Users\\ACER\\longbox\\harness\\index.html"
timestamp: 2026-09-28T14-24-42Z
slug: harness-index-html
---
Method: dual-agent (A: design review · B: detector + browser)

# Critique 4, Longbox v131 (2026-09-28): 31/40, Good

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Phone volume sheet: reading-status control starts at y=855 in an 844px viewport |
| 2 | Match with the real world | 3 | "+ Edição" ambiguous; "Gerenciar"; Q for fold-all |
| 3 | User control and freedom | 3 | Série removal rests on one 8s toast |
| 4 | Consistency | 3 | Header right cluster shifts per tab (no filter on Coleções); same chevron for Esconder/Mostrar todas; tab count hidden on phone |
| 5 | Error prevention | 3 | "Zerar tudo" red text link beside Importar |
| 6 | Recognition over recall | 3 | Icon-only sheet actions, tooltips need hover |
| 7 | Flexibility and efficiency | 4 | 1-3, N, /, J K L, arrows, Ctrl+V cover, Alt+arrows |
| 8 | Aesthetic and minimalist design | 3 | Phone HQs spends 283px on chrome before the first cover; hub backdrop labels cross hunt numbers |
| 9 | Error recovery | 3 | Named undo toasts; db-failure paths not exercised |
| 10 | Help and documentation | 3 | Good "?" panel; nothing hints the hub unlock gesture |
| Total | | 31/40 | Good |

## Design specificity
Authored for a comic collector: covers as interface, character hues on bands, cover-tinted sheet, reading-order strip with spine scrollbar, dashed missing-issue map with "Copiar faltantes", "Falta pouco". Generic parts are the phone/tablet control rows (publisher select row, "Esconder todas" row, twin cyan squares).
Detector: src JSX clean ([]); harness/index.html 3 findings (side-tab .swatch::after spine edge FP, dark-glow toast documented v98, repeating stripes on .skel-spines FP). Overlay: side-tab on .cover::after character edge (FP, 45 hub/22 HQs), cyan palette (documented accent), Geist overused (documented), 25 undersized 10px captions at 390 (v128 user choice, below 11px floor). No overflow at 390/820. Near-miss targets: Novo icon button 41x44, Editora filter 43px tall.

## Priority issues
1. [P1] Phone volume sheet hides reading status below the fold (Lendo at y=855/844). Fix: under 768px put the status control under the title/"1 de 22" row, or cap the cover (~min(180px,46%)). adapt.
2. [P1] No document language and no h1: html lang empty (host skeleton), no h1 on any screen, phone nav.tabbar unlabeled. Fix: lang="pt-BR" at mount, visually hidden h1 per surface, aria-label on the tab bar. harden.
3. [P2] Phone HQs/Séries stack controls at the top-right: first cover at 283px; publisher row half empty (count dropped); "Esconder todas" own row; filter and "+" identical cyan squares. Fix: one phone row with publisher select + count left and icon fold-all right; distinguish "+" from filter. adapt.
4. [P2] Glass tab bar at rest loses contrast over saturated covers (orange/red capsule, muted inactive labels). Fix: denser fill in the ::before (50% -> ~70%) or neutral wash; inactive labels ~85% text. harden/colorize.
5. [P3] Hub backdrop labels collide with Falta pouco numbers and Sua estante heading, worst in light theme. Fix: fade the backdrop behind the content column. quieter. (History: cutting it short was rejected in v109/v110; this is a mask, not a cut.)

## Persona red flags
Alex: 9 Tabs before the first cover, no skip link; "+ Edição" has no shortcut.
Sam: no lang/h1/tabbar label; série "55/100" read bare without "possuídas".
Casey: filter, "+", publisher and "Esconder todas" all top-right; sheet actions at the top; status below the fold.

## Minor
Twin cyan squares on phone header; same chevron for Esconder/Mostrar todas; phone sheet title wraps (actions take ~55% of the row); série grid leaves ~20px at the right on phone; uppercase full sentence "ESCOLHA UM NÚMERO..." wraps; "+ Edição" vs "Nova edição"; tab count in mono; header cluster jumps on Coleções; 10px captions under 11px floor; Novo icon button 41px, Editora 43px.

## Questions
1. Should the phone sheet open as "status + facts" with the cover one swipe away?
2. Should single-volume characters share an "outros personagens" band?
3. Should a Falta pouco row expose the missing numbers directly (hub as shopping list)?
