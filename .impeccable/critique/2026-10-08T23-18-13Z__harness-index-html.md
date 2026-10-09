---
target: Longbox v172 harness
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:C:\\Users\\ACER\\longbox\\harness\\index.html"
target_fingerprint: "sha256:347c3772ce141ea1be9b007147f58184c36e6066baf001e0f452ca4f08cffb58"
target_path: "C:\\Users\\ACER\\longbox\\harness\\index.html"
timestamp: 2026-10-08T23-18-13Z
slug: harness-index-html
---
Method: dual-agent (A: design review, general-purpose Sonnet; B: detector + browser evidence, general-purpose Sonnet). Parent re-measured the disputed phone-hub overflow (confirmed) and the phone wish-list header (fits).

# Longbox v172 critique (critique 6)

## Design Health Score (A, adjusted)
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Salvo, counts, sheet position; loading/sync not visible |
| 2 | Match System / Real World | 3 | Collector's own pt-BR; "Esconder todas" vs "Esconder personagens" mix levels |
| 3 | User Control and Freedom | 3 | Undo toast, Esc, back; wish-list back button shows a heavy cyan ring on open |
| 4 | Consistency and Standards | 3 | Filter button solid cyan on tabs, quieter elsewhere |
| 5 | Error Prevention | 3 | Delete icon packed next to edit/duplicate/close on the sheet |
| 6 | Recognition Rather Than Recall | 2 | Hold-to-drag, pin, drop-in-empty-space hidden; help only in the hub footer |
| 7 | Flexibility and Efficiency | 4 | Keys, drag, pins, session filters |
| 8 | Aesthetic and Minimalist Design | 3 | Calm hub; header dense on desktop |
| 9 | Error Recovery | 3 | Undo pattern; not exercised |
| 10 | Help and Documentation | 3 | Shortcuts panel accurate but 1.9 screens on phone, shows keys on touch |
| **Total** | | **30/40** | Good |

## Priority issues
- [P1] Phone hub header clips "Minha coleção": button spans x 267-409 on a 390 screen (label reads "Minha coleçã"), 49px past the edge at 360, fits at 430. Fix: shorter label or icon-only/ellipsis at <=420px. /impeccable adapt.
- [P2] Touch targets under 44: .group-toggle 64-100 x 26 (phone, tablet; ::after only covers its own box), scrubber 30 (known, intentional), tablet swatch 22 and pin 29. Fix: extend hit area to the whole group row. /impeccable harden.
- [P2] Shortcuts panel on touch: ~1.9 screens, keyboard half irrelevant. Fix: coarse pointer shows gestures only, short labelled rows. /impeccable clarify.
- [P2] Wish-list covers in LIGHT theme: title contrast 3.0-3.9:1 (fails 4.5) over the pastel art (measured by B on rendered pixels); dark passes at 10.6-14.1. /impeccable colorize.
- [P3] Cart badge small (18px) on wish covers; wished books read as ghosts, not targets (A question).
- [P3] Séries opens collapsed with no counts in rows (documented decision; rows could carry "N de M").

## Detector (B)
src/ clean. Page: 3 advisory hits, all non-defects: .swatch::after stripe (picker swatch, weak), cyan toast glow (v98 deliberate), repeating-stripes (the .skel-spines loading skeleton, styles.css:2920, intentional). Known false positives from DESIGN.md did not fire. 0 unnamed controls on any screen, 0 page overflow, reduced motion clean at rest, 1 unidentified 404 on first phone load.

## Persona red flags
Alex: fold button has no visible Q hint. Sam: .group-toggle 23px tall on desktop, 22px swatch, dim 11-12px metadata unverified at 4.5:1, back-button ring at rest. Casey: clipped primary button, floating tab bar covers the last card row title, delete beside edit on sheet.

## Questions
Should "wanted" be the louder state? Should the first drag teach the gesture once? Is Séries for browsing or checking progress?
