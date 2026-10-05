# Longbox v3 - Design Spec

Redesign + port of the personal HQ library app from a Claude Chat artifact
(`window.storage`, React/.tsx) to a Claude Code Artifact (`claude.use("db")`,
published HTML + compiled JS).

**Live:** https://claude.ai/code/artifact/75982434-39f4-426b-ab3a-da8b637a1b31
**Predecessor:** `reference-v2.tsx` in this folder.
**History:** every version since v1, with the reasoning and the bugs found on the way,
is in `HISTORICO.md`. This file is the current spec only.

Measured quotas on this artifact (2026-09-12): asset store 1 GiB across at most 5.000 files;
`db` 256 KiB per document across at most 5.000 documents.

## Design read

Personal collection-manager product UI for a single expert user (the collector),
editorial/premium reading-app language, dark-first, cover-forward. The covers are
the content; the interface recedes.

Mode: **Redesign - Overhaul**. New visual language, existing content and IA preserved.

Dials: `DESIGN_VARIANCE 5` / `MOTION_INTENSITY 4` / `VISUAL_DENSITY 6`.

Note: `design-taste-frontend` Section 13 lists "dense product UI" as out of scope.
Applied from it: palette calibration, typography discipline, AI-tell bans, shape/color
locks, pre-flight. Not applied: landing-page rules (hero, eyebrow budget, logo wall).

## Audit of the current version

| Aspect | Current | Verdict |
| --- | --- | --- |
| Palette | `#DAD6C4` / `#E9E5D6` paper, `#C4A374` / `#8B6A42` kraft, `#1A1712` ink | Retire. Matches the banned premium-consumer AI-default palette on all three axes. |
| Accents | cyan + magenta + signal + moss, 4 unrelated hues | Retire. Violates single-accent rule. |
| Type | Big Shoulders Display + Libre Franklin + IBM Plex Mono | Retire display. Condensed poster face fights the editorial read. |
| Layout | All 3 tabs are the same `max-w-2xl` stack of identical rows | Retire. This is the main cause of "generic". |
| Covers | First 2 letters of the title in a kraft square | Replace. Real uploads + designed fallback. |
| IA | 3 tabs: HQs / Coleções / Séries, grouped by personagem | **Preserve.** Labels and grouping stay. |
| Features | Range linking, batch import, checklist positions, stats, storage meter | **Preserve all.** |
| Copy voice | Informal pt-BR, second person, practical | **Preserve.** Only strip banned punctuation. |
| Punctuation | `—` and `–` and chained `·` throughout | Retire. Zero em-dash, zero en-dash separators, max 1 `·` per line. |
| Motion | None beyond a reduced-motion guard | Add, at intensity 4. |

## Tokens

### Scale (v162): lengths are rem, a desktop root font-size does the 90%

The user browses at 90% zoom, so on a PC the app renders at 90% by itself:
`@media (hover: hover) and (pointer: fine) and (min-width: 1280px) { html { font-size: 90%; } }`
(right after the first `:root`). Phones and touch tablets stay at 100%. Everything scales through ONE
ruler, so every length in `src/styles.css` is `rem`. **A new length is written in rem** (or run
`node scripts/px-para-rem.mjs`, idempotent, which converts any `px` left in the file). It leaves alone:
`1px` hairlines, `0px`, media/@supports conditions (breakpoints are window pixels), comments, urls and
strings. Do not use `zoom` (v58: it breaks the pointer/transform math of the drags) and never multiply px by
0.9 on top of this (it scales rem text twice). To change the scale or go back, edit or delete that one
rule. Not scaled on purpose: hairlines, unitless SVG icon sizes and some inline JSX spacing, the canvas
lattice (`CursorGrid`, 38px cells) and the hub backdrop drift (300px). Verified against REAL Chrome zoom 90%
(puppeteer `deviceScaleFactor: 0.9` at W/0.9 CSS px vs the app at W with the rule): mean position error
0.5-1.4px, max 3.5px on HQs, Séries, Coleções, an open volume sheet and the hub with the GridMotion
tiles (216.4x272.9 vs 216.3x272.8). With the browser itself at 90% the app would show at 81%.

### Color

Dark is the designed default; light is the inverted pair under `prefers-color-scheme: light`.

```
DARK                          LIGHT
--bg            #0E0F11       #FBFBFC
--surface       #17191C       #FFFFFF
--surface-2     #1F2226       #F4F5F7
--border        #24282D       #E4E6EA
--border-strong #333941       #D0D4DA
--text          #E8EAED       #14161A
--text-muted    #9AA1AA       #5B6370
--accent        #00B8D4       #007F94   (light was #0090A8 until v90: white on it read 3.78:1)
--accent-text   #22C8E0       #00707F   (accent used AS text, contrast-safe)
--accent-ink    #04191E       #FFFFFF   (text ON accent fill)
--danger        #F04438       #D92D20
--read          #5B9E6F       #3F7D52
--read-ink      #06170C       #FFFFFF   (numbers on owned tiles, v90)
--retrato-lendo #22C8E0       #00A5BF   ("lendo" in the hub's reading meter only, v89)
```

One accent, locked. `--danger` is semantic only (destructive actions), never decorative.
`--retrato-lendo` exists because the accent beside `--read` failed the dataviz validator's
normal-vision floor (OKLab dE 14.1 dark, 12.4 light, floor 15); this step gives 16.8 and 16.9.
`--read` itself fails the validator's chroma floor in both themes (a muted green); left
as is, since it is the app-wide status colour, and noted for D2's theme pass.
Status uses (since v76, words in the shelf caption, not a cover bar): unread = nothing (absence is the default), reading = `--accent-text`, read = `--read`.

**Hunt bar tiers, an approved exception (v104).** The hub's "Falta pouco" bar is the one place
colour encodes a level: `--warm` (amber, #E2A83B dark / #B4791A light) from 50% to 65%, the accent
to 80%, `--read` from 80% (`QUASE_MORNO`, `QUASE_PRONTO`). The user chose it over a single colour
(v103 tried `--read` only) because the tiers show at a glance which série is about to close.
`--warm` is used nowhere else. Elsewhere `--read` means done: a volume read or an issue owned.

No pure `#000` or `#fff` anywhere.

### Shape

One rule, applied everywhere: **containers and controls `8px`, overlays `16px`, micro-tiles `6px`.**
Nothing pill-shaped.

### Type

Google Fonts only (CSP allows `fonts.googleapis.com` + `fonts.gstatic.com`), each with a real fallback stack.

- Display: **Bricolage Grotesque** 700/800. Wordmark, group headers, detail titles.
- UI/body: **Geist** 400/500/600.
- Numerals: **Geist Mono** 400/500, `font-variant-numeric: tabular-nums`. Issue numbers, counts, meters.

Scale (rem, so it scales with the user's text-size setting):

| Token | Size | Leading | Tracking |
| --- | --- | --- | --- |
| display-lg | `clamp(1.75rem, 4vw, 2.5rem)` | 1.05 | -0.02em |
| display | 1.375rem | 1.1 | -0.015em |
| title | 1rem | 1.3 | -0.01em |
| body | 0.875rem | 1.5 | 0 |
| small | 0.8125rem | 1.45 | 0 |
| micro | 0.6875rem | 1.4 | +0.02em (uppercase labels, sparingly) |

Tracking is size-specific per `apple-design` Section 15. No single global `letter-spacing`.

The toast is `small` on phones and `title` size (1rem, padding 14px 22px) from 768px up
(v97): at 13px it read too small on a desktop screen. Since v98 it has no dark shadow:
a light in the accent behind it fades out (`box-shadow` 22px at 38% plus 64px at 16%),
cyan on the hub and on "Todas", the publisher's hue (`hsl(--ed-hue 100% 50%)`) when one is picked.

### Motion

```
--ease-out:    cubic-bezier(0.23, 1, 0.32, 1)
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)
--ease-pulse:  cubic-bezier(0.4, 0, 0.6, 1)     symmetric, for the skeleton only
```

| Element | Spec | Why it animates |
| --- | --- | --- |
| Any pressable | `scale(0.97)`, 120ms ease-out, on `:active` | Feedback: confirms the press landed |
| Cover grid mount | fade + `translateY(8px)`, 300ms ease-out, 30ms stagger, first 12 items only | Hierarchy: the shelf assembles instead of snapping in |
| Sheet / side panel | in `translateY(100%)`→0 320ms ease-drawer, out 200ms ease-out | Spatial: enters and exits along the same path |
| Scrim | opacity 200ms | State transition |
| Hub cover (v126) | lifts whole with the finger/wheel, then translateY(-100%) 280ms ease-drawer; returns from the top 300ms; opaque, no fade | Spatial: a cover lifted off the tab beneath |
| Tab switch | opacity 120ms only | Used dozens of times a day, so it stays near-instant |
| Volume sheet step (v88) | content in from the side stepped towards: opacity + translateX(16px), 160ms ease-out; none on first open | Spatial: says which way through the list you moved |
| Toast with Desfazer (v88) | same as Toast, stays 8s instead of 3s | Time to reach the button |
| Issue tile toggle | background 120ms + scale pop 100ms | Feedback |
| Toast | in 300ms ease, out 200ms | State transition |
| Skeleton blocks | opacity 1 to 0.5, 1800ms ease-pulse, looping | The only indeterminate wait in the app (v29) |
| Dragged HQ | the cover wiggles (volWiggle, 320ms) while armed; since v153 the card itself is glued to the pointer (scale 1.06, shadow); a séries card in the volume sheet breathes instead (scale 1 to 1.012, 1.4s, v158) | Marks which card is picked up (v38, v153, v158) |
| Hold-fill on a cover | `clip-path` inset driven by `--hold-p`, 450ms linear rising, 150ms ease-out releasing, with a masked wave on the edge | Shows a long-press filling toward the drag it arms, and holds until release (v39-v42) |
| Band tab pill | `clip-path` inset, leading edge `power3.out` 0.34s, trailing edge `elastic.out(0.6, 0.65)` 0.62s | The rubber-band the user asked for; the split is what keeps the bounce off the track's walls (v39-v42) |
| Band hover pill | `clip-path` inset, `power3.out` 0.26s, opacity 160ms | Pre-selection travels between buttons instead of switching per button (v43-v44) |
| Coleções spine window | `transform` only, written per scroll frame, no transition of its own | Follows the strip it scrolls; the lit spines are a second copy shifted back by the same amount, so nothing reflows (v60) |

`transform` and `opacity` are still the default, and the only two that ever animate
in the sheets and the shelf. Three places also animate `clip-path`, and the hold-fill
animates `mask-position` with it: a reveal whose two edges move independently cannot
be expressed as a transform, and the alternative that was tried first, animating
`width` and `left`, puts a layout reflow in every frame (see v39-v42). Note that a
`clip-path` written from JS every frame is not free the way a composited transform is;
it is chosen here because it avoids reflow, not because it is weightless. Never animate
a geometry property directly. Exit is always faster than enter. Everything collapses to
opacity-only at 150ms under `prefers-reduced-motion: reduce`.

Two loops are allowed, and they are a deliberate, closed set — the reasoning for
each is what licenses it, not a general permission to add more. The skeleton's
pulse ends when the library arrives, a wait with no length of its own. The
dragged HQ's wiggle (v38) ends when the user lets go, a gesture with no length
of its own either. Both loop only because the thing they stand for is genuinely
open-ended; neither is decorative, and neither is a precedent for a loop with a
known duration, which should always be a plain animation instead.

## Layout

Shell: translucent sticky top bar (`backdrop-filter`), 56px mobile / 64px desktop, holding
the wordmark, search, and the stats toggle. Content capped at 1200px.
Tabs sit in a bottom bar under 768px (thumb reach on the tablet) and as a top segmented
control above it.
Since v129 the phone's bottom bar is a floating glass capsule (58px, 16px side margins, 8px above
the home-indicator inset; `--tabbar-h` 78px is the room content keeps) with a sliding pill on the
active tab, and the search is a glass circle beside it that grows into the field while the capsule
folds into a circle holding the tab's icon; suggestions open above the bar, which rides above the
keyboard (visualViewport). The phone header has no search.
v133: on a phone the publisher band is one row (publisher, count, fold-all icon) and the tabs' own
"Esconder todas" row is hidden; "Novo ..." keeps its label down to 360px; sheet titles take the full width
with the actions on the stepper row; the série map's tiles share the row.
The search is the bar's flexible item (44px to 456px, pushed right); only the hub keeps a
spacer. Below 480px (tabs) and 560px (hub) "Novo" shows only its "+", and below 520px the save
signal is a dot that disappears while idle (v118). Below 480px the hub footer breaks after
Exportar, keeping Importar and Zerar together.

**The hub is a cover (v126).** It is a fixed layer (`.hub-capa`, z-index 35: over the header,
band and bottom tab bar, under the scrim, so sheets open over it) with its own scroll and its own
header. Under it the app is fully built on a real tab, inert while the cover is down. `tab` is
never "hub": `hubAberto` says whether the cover is down. The tab under the cover is the last one
used, kept on the device (`localStorage["longbox:aba-base"]`, HQs on a first visit); whether the
cover is down stays per browser tab (`sessionStorage["longbox:aba"]`, "hub" or the tab), so a new
visit opens on the hub and a reload keeps you where you were. The unlock lifts the whole cover,
opaque, no fade, and the tab is revealed where it was scrolled; the wordmark or 0 drops it back
from the top. The unlock only counts when the gesture **starts** at the hub's end (a touch that
begins there, or a wheel turn after a 250ms pause, or a spin that has kept pushing against the end
for 400ms, v137); a flick needs 40px of travel as well as speed. The wheel counts as released after
450ms idle (v137; 160ms sprang slow notches back between turns, so they never added up to 120px).
A flick is thrown at the finger's speed (v127: duration 2 x remaining / speed, 180-360ms,
cubic-bezier(0.25, 0.5, 0.3, 1)); a slow drag past 120px uses 280ms ease-drawer. The tab takes over
on transitionend. The cover has the thin inner scrollbar; the page's own bar is transparent while
the cover is down, so only one bar shows and the width does not change.
The hub never takes the publisher colour: its header carries no hue and the cover resets the
`--ed-*` accents.
Top safe area (v134-v136, for the Claude iOS app, whose translucent bar covers the page top): the
cover pads its content by `env(safe-area-inset-top)` and its sticky header keeps `top: 0` (inside a
padded scroller a sticky offset counts from the content edge; adding the inset again doubled it), and
a `::before` of the inset height in `--bg` rides above the header so the hub never shows through the
app bar. v137: the tabs do the same on the document: `--topo` (the inset, reset to 0 inside the
cover) is added to the sticky tops of `.topbar`, `.ed-band` and `.group-head`, and every `.topbar`
wears the `::before` strip. All zero in Safari and on the PC. Also v132-v134: `lang="pt-BR"` set at mount, one hidden h1
per surface, skip link for keyboards only (absent on touch screens), 15s undo when a removal takes a
série with edições or everything.

HQs shelf on a phone (v128): four covers a row under 640px, caption title 11px and meta 10px,
status stacked under the format without the dot. After every tab switch the tab bar's glass turns solid for 0.7s and fades back (v131, replacing v128's one-frame nudge):
the Claude iOS app draws any backdrop filter over images in stale tiles for ~500ms after they change.

Each tab gets a **different layout family**, which is what actually fixes the sameness:

1. **HQs** - cover grid, `repeat(auto-fill, minmax(104px, 1fr))`, grouped by personagem
   with sticky group headers. Status is a 3px bar on the cover's bottom edge, not a chip
   on every card.
2. **Coleções** - horizontal shelves with scroll-snap. One collection is one row of covers
   in reading order, scrolled by a spine bar under it instead of the native scrollbar (v60).
3. **Séries** - run rows. Each series shows a compact owned-vs-missing bar across its
   numbering. Opening one expands the full issue grid (the existing tile concept, restyled),
   keeping the 100-issue bucketing for long runs.
   A série with several characters sits in each one's group. The search is matched
   per row: a row stays when the série's name or that group's character matches, so
   a character's name does not pull in the other groups its séries sit in (v93).
   A character filter (the same filter button and typeable field as HQs, one field
   only, its own `longbox:filtro-series` session key) leaves one group, open; under
   it the search reads série names only and the séries part of the suggestions is
   titled "Séries · Nome" and holds only that character's séries. HQs and Séries
   filters are separate on purpose.

Detail view: bottom sheet under 768px, right side panel above it. On a phone the bottom sheet
closes by pulling it down (v126): 1:1 with the finger, closes past 120px or on a flick
(0.5px/ms with 40px of travel), otherwise settles back in 220ms ease-drawer. The drag starts only
with nothing scrolled between the finger and the sheet and only on a clearly downward first move;
the side panel has no drag. Large cover with the
upload affordance, title in display, metadata as a label/value grid (no chained `·`),
3-way status segmented control, notes, linked issues grouped by series.

Empty, loading and error states are composed for each tab, not generic.

### Dialogs, fields and states (v100)

`Sheet` and `Modal` (ui/base.jsx) are named by their title, an `h2` sized by `.t-display`. On
open they take focus: a modal its first field (mouse/pen with a fine pointer only; on touch the
modal itself, so the keyboard does not pop up), a sheet its scrolling body so ↑ ↓ scroll it. Tab
wraps inside the dialog; closing hands focus back to what opened it. `Field` ties its label and
its error/hint to the control with `useId` (one native input/select/textarea), or names a
composite child as a group. Section tabs are a `tablist` with `aria-selected`; issue tiles say
"Nº 46, possuída" / "falta"; `.seg3` options carry `aria-pressed`, and the picked one is a 2px
ring in its own text colour at weight 600.

On a coarse pointer (v101) icon buttons are 44px and issue tiles at least 44×44; plain issue numbers share one tile width per block (the longest, v143) and any longer number among them (#1000000, 1/2, 23.1) spans two, except three-character ones on touch (v144); the sheet
action row drops its gap there. Remover always leads the sheet action row, 14px apart from
Editar/Duplicar, with Fechar at the far end.

v145: an edição may carry creators and a reprint flag (read only through `src/lib/edicoes.js`).
The ficha lists Writer, Penciler and Inker (empty roles left out) and "Reimpressão de <origem>";
a reprint tile has a dot in its corner (currentColor, so it reads on owned and missing tiles);
"Esconder reimpressões" (only on séries that have one) hides those tiles and never changes
the counts. A reprint never counts as owning its original. The reverse holds since v146: a
reprint whose `fontes` are all on the shelf counts as owned (same green, counts, faltantes),
computed once in `ownedEdicaoIds` from physical ownership only; its ficha shows "Você tem X de Y
histórias" or "Coberta pelas originais". Search also matches the owned edições' creators, and the
Séries tab has "Filtrar por autor" (a second PersonagemFiltro, `semCor`).

v147: with an author set, a série row adds "N edições de <autor>" and the open série lights that
author's tiles (`data-autor`) and dims the rest (`data-esmaecido`, opacity 0.35, full on focus)
under "Destacando as edições de <autor>" + "Tirar destaque"; a Séries search matching an author
does the same, partially. A source `{inedita: true}` is never owned, so its reprint is never
covered. The edição form saves onto the current edição (`aplicarFormEdicao`). Phone (<640px): the
HQs filters stack one per row (`data-campos="3"`), and filter/publisher lists anchor left within
the 16px gutters.

v102: nothing outside the hub wall renders below 11px; the storage meter shows only past 80%;
a missing number can be linked to a volume from its panel; with a number picked, ← → step to the neighbouring edição in map order (v143); a keyboard button beside the search
(fine pointer only) opens the shortcuts panel.

v119: J / K / L set Não lida / Lendo / Lida in the open volume sheet (the control follows, no
toast) and on a focused cover anywhere (a toast "Título · status" with Desfazer / Ctrl+Z).

v120: a collection's reading order shows one action per row ("Lidas até aqui", muted); ↑ ↓ ×
live behind "Editar ordem" (Alt+↑/↓ moves), and taking a volume out can be undone.

v121: a missing issue tile is a dashed slot with its number in `--text` (owned stays filled
`--read`), with a "tenho / falta" legend; "Falta pouco" carries a one-line legend of its three
tiers under the bars (v122). "Novo" is labelled by
what it creates; Nova série keeps "de/até" and position behind "Mais opções".

## Data layer

`claude.use("db")`. Hard limits from the contract: **256 KiB per document**, 5.000 documents
per artifact, bodies must be objects (not arrays) at the top level.

```
library/volumes    {items: [...]}    all volumes
library/colecoes   {items: [...]}    all collections
library/fixados    {personagens: [...]}  up to 3 pinned characters, first on HQs and Séries (v141; live via onSnapshot since v142)
library/series     {items: [...]}    series metadata only, small
library/cores      {mapa: {...}}     character name -> colour spec
library/editoras   {itens, selecionada}  publishers, and the last one browsed
edicoes/<serieId>  {items: [...]}    one document per series
                                     edição: {id, serieId, numero, mes, ano, posicao,
                                     autores?: {writer?, penciler?, inker?: string[]},
                                     reimpressao?: true, origem?: string,  (v145)
                                     fontes?: [{serie, numero}]}  (v146)
library/meta       {ultimoBackup}    when an export last succeeded (v88)
```

`library/meta` sits outside the library on purpose: it is not part of `lib`, so it never
rides inside a backup file, an import cannot rewrite it and undo cannot touch it. It is read
in parallel with the library and never holds the page (reading it first cost a round trip on
every boot, caught by `test-boot.mjs`).

Edições are sharded per series because that is the only collection that grows without bound.
A single long run (Detective Comics, 1000+ issues) is roughly 100 KiB on its own, so one
shared document would break on a serious collection. Per series it stays far under the cap,
and a library with 100 series uses 100 of the 5.000 documents.

Volumes, coleções and séries each stay in one document. A storage meter reports each
document against 256 KiB and warns at 80%. `set()` rejecting `invalid_argument` on an
oversized body is caught and surfaced as a real message, never swallowed.

Entity shapes are unchanged from v2, so the exported JSON imports without transformation
(import fans `edicoes` out into the per-series shards).

**Formats belong to publishers (v95).** `constantes.js` holds `TIPOS_COMUNS` (Trade
Paperback, Omnibus, Hardcover, Outro, offered for any publisher) and
`TIPOS_POR_EDITORA` (DC: Compendium, Absolute Edition, DC Finest; Marvel: Epic
Collection, Marvel Masterworks), looked up by `tiposDaEditora(nome)`, which ignores a
trailing " Comics". A new publisher or format is added there and nowhere else; the
cataloguing skill reads the same two constants. The volume and série forms pick the
publisher from `library/editoras` (a select, publisher above format); the format list
follows it, and a format the new publisher lacks falls back to Trade Paperback with a
one-line note under the field. Values the lists do not know (an old format, a
publisher no longer registered) stay on offer, so saving never rewrites them. The HQs
format filter offers the band's publisher's formats, all of them under "Todas as
editoras", the common four under "Sem editora", and releases a saved format the band
no longer has.

Writes are optimistic locally, debounced, run one at a time, and always write the whole
document (`set`, not `update`, since `update` requires the document to exist). The db has no
conditional write, so since v96 a save never writes blind: each changed document is read
again first, and if the server copy moved since this tab last saw it (another device, or
Claude cataloguing books), the tab's own changes are merged on top of it instead of
replacing it (`lib/mesclar.js`, a three-way merge by item id: base = what the tab last
read or wrote, local = the screen, remote = the server; the tab wins only on items it
changed itself). The merged result goes back to the screen. `onSnapshot` on the five
library documents and the `edicoes` collection brings changes made elsewhere in live,
merged the same way (the tab's own writes echo back too and can arrive late, after a newer
write; since v116-v117 echoes matching a fingerprint of any own write from the last 20 s are
ignored, so they are never taken for another device), with a quiet "Biblioteca atualizada em
outro aparelho" toast at most every few seconds; a change that arrives while a save is pending waits for it (the save
merges it anyway). Snapshots equal to what the tab last saw cost one string comparison
(0.2 ms for volumes, 3 ms once at start for all edições, measured on the real 147-volume
library). Before v96 this paragraph promised `onSnapshot` although the code never had it.
The remaining gap is the few milliseconds between that read and the write.

`use("db")` returning `null` (reader view, capability unavailable): the app runs in memory
for the session and says so plainly in a banner. Export stays available. No localStorage
fallback, to avoid two conflicting sources of truth.

## Covers

`claude.use("assets")`. `assets.upload(blob)` returns `{id, url}`; the volume stores
`capaAssetId` and the grid renders `url`. External image URLs stay impossible (CSP), so
upload is the only path. `use("assets")` returning `null` hides every upload affordance.

Fallback when a volume has no cover: a composed cover, not an initial in a box. Title set
in display type over a background derived deterministically from a hash of the title, with
the personagem name small at the foot.

Shelves never draw the uploaded file itself (v85). Each device makes a 360px JPEG thumbnail
of every cover in the background and keeps it in its own IndexedDB (`longbox-miniaturas`),
served as a `blob:` URL. Since v123 the first device to make one also uploads it and records it
on the volume as `mini: { capa, id }` (batched, one library write per 3 s of uploads, sent at
once when the page hides; the upload reads the Blob kept in memory, since the artifact frame
refuses `fetch()` of a `blob:` URL); a device
without its own copy draws that small shared file (`loading="lazy"`) instead of downloading the
full covers, which average ~760 KB. The local copy stays first choice; a record whose `capa` is
not the volume's current `capaAssetId` is ignored, so a swapped cover gets a new one. Full size is only drawn
where a cover is large (`CoverArt grande`: the volume sheet and the hub's suggestion).
Decoding full-size covers on every tab switch was the 475ms stall of v80-v84. Code in
`src/lib/capas.js`.

A large cover loads progressively (v105, `CapaGrande` in `ui/VolumeCard.jsx`): the shelf
thumbnail shows at once, the full file is fetched eagerly (never `loading="lazy"`: the sheet
starts off screen) and decoded off screen with `img.decode()`, and replaces the thumbnail
only then. The ready state carries the volume id and the `<img>` is keyed by it, so a picture
is never painted under another volume's title. With neither thumbnail nor full cover yet, the
plain cover box waits; if the full file fails, the composed fallback shows.

**The volume sheet (v106).** The cover is its content. Below 1024px the 440px sheet shows it
centred on top, `min(240px, 62%)` wide, with the fields under it; from 1024px (PC, tablet on
its side) the sheet is `min(680px, 92vw)` (`Sheet variante="volume"`) in two columns, a 250px
cover column pinned to the top (`align-self: start`) that stays put (`sticky`) while the rest scrolls. The top of the sheet is washed in
the cover's most prominent colour (`corDosPixels` in `lib/util.js` on the 16x24 thumbnail,
`useCorDaCapa` in `lib/capas.js`), or in the character's hue when the cover is mostly black,
white or grey or has no thumbnail yet: one `linear-gradient` from `color-mix(tint 34%, surface)`
(18% in the light theme) to the surface over 420px (`Sheet tinta`, `.sheet-tinta`). No filter runs
while the sheet slides, steps or recedes. Slide-in, ← →, and the recede under a stacked série
sheet are unchanged.

## Migration

"Importar backup" accepts the v2 `longbox.json` export as-is. The user exports from the old
artifact and imports here. Import validates the four top-level arrays, shows current vs file
counts in a confirmation modal, and only replaces on "Substituir"; the toast offers Desfazer.

## Build

```
src/index.html        page shell, fonts, mounts #root
src/styles.css        tokens + all component CSS (no Tailwind, no play CDN)
src/main.jsx          entry: mounts <App />
src/lib/              everything that is not interface
  constantes.js         status, formats, tabs, tuning numbers, seeded random
  util.js               uid, issue-number parsing, string hash
  cores.js              character palette, contrast-picked ink, colour context
  biblioteca.js         pure edits on the library (delete, link ranges, import, normalise)
  armazenamento.js      db documents: load, shard, debounced save, errors, live updates (v96)
  mesclar.js            three-way merge of a document: this tab's changes over the server's (v96)
  capas.js              cover upload and the device-local shelf thumbnails (v85)
  hooks.js              shared hooks (sheet mount, Escape, paste, hub unlock gesture)
  sessao.js             everything kept in sessionStorage (tab, folds, filters)
src/ui/               reusable components (cards, sheets, bars, filters, skeletons)
src/telas/            the screens
  App.jsx               state and handlers, and the page frame
  AbaHqs / AbaColecoes / AbaSeries.jsx   one tab's content each
  Hub, VolumeSheet, SerieSheet, ColecaoSheet.jsx
  Formularios.jsx       the create/edit modals and the issue import
  useArrastarVolumes.js the long-press reorder gesture on the HQs tab (v30-v49, v153-v154)
  useArrastarColecao.js the same on a collection's row (v155); useArrastarSeries.js on the séries cards of a volume sheet (v157)
src/components/       third-party components (see below)
dist/                 what gets published; built, never edited by hand
scripts/              build, test runner, encoding check
tests/                the JSDOM suites
harness/              the real-Chrome harness (see harness/LEIA.md)
```

Until v86 all of `src/` was one 5.856-line `app.jsx`. It was split without changing any
logic: each piece moved whole with its comments, and a checker confirmed every name a
module uses is imported. A module that uses a name it forgot to import still builds (esbuild
reads it as a global) and only fails when that line runs, which the JSDOM suites do not
reach everywhere. So when moving code between files, check imports mechanically, not by
reading.

React 18, `lucide-react` and `gsap` are bundled into `dist/app.js` by esbuild rather than
loaded from a CDN: one same-origin file, no CSP surface, no in-browser Babel, and tree-shaking
drops every icon the app does not use. Lucide is kept because the project already depends on it,
which is the documented exception to the discouraged-icon rule. GSAP arrived with the hub
backdrop in v21 and costs 74 KB. Bundle is about 350 KB minified.

`src/components/` holds third-party components kept close to their upstream shape, so an
upstream fix can be read against them: `GridMotion` behind the hub and `CursorGrid` under the
tabs, both from React Bits, each with its deviations listed in its own header comment. Their CSS
still lives in `src/styles.css` like everything else, because the build writes a single
`dist/app.js` and has nowhere to put a second stylesheet.

Build and verify, the same in Git Bash and PowerShell:

```
npm run check          build, then every suite; prints "Tudo passou." or what failed
npm run build          build only (dist/ and the harness copies)
npm run build:claro    build with the harness forced into the light theme
npm test               suites only
npm run harness        serve harness/ on http://localhost:8768
```

In PowerShell, `npm` may be refused by the execution policy (`npm.ps1 não pode ser
carregado`); `npm.cmd run check` does the same thing without the policy.

`scripts/build.mjs` exists to close three traps that each shipped a broken version:

- It calls esbuild through its JS API. On the command line PowerShell stripped the quotes
  from the `NODE_ENV` define and silently shipped React's development build (~549 KB);
  the script also refuses any bundle over 450 KB.
- It copies `src/styles.css` and `src/index.html` into `dist/`. They have no build step,
  and forgetting the copy errors nowhere: v30 shipped its markup with none of its CSS.
- It refreshes `harness/app.js` and `harness/styles.css`, which used to go stale and get
  measured by mistake.

`scripts/test.mjs` runs every suite and judges each one on its exit code, on any `FAIL`
line, on the error and rendered-dash counts, and on a minimum number of `PASS` lines per
suite. The floor is there because `test-render.mjs` exits zero with failed assertions (it
only counts thrown exceptions, which is how v44 and v47 shipped red) and a suite that dies
halfway also prints no `FAIL`. When a suite gains assertions, raise its floor in
`scripts/test.mjs`; when one is deliberately rewritten away, lower it in the same change.

`test-render.mjs` mounts the bundle in JSDOM against a mock `db`/`assets`, walks all three tabs
and both detail sheets, and asserts the punctuation bans against source, CSS and rendered DOM.
It reports a fine pointer through a `matchMedia` stub, because otherwise JSDOM answers every
media query false and the tab lattice stays behind its own gate untested. It exits
deliberately: the GSAP ticker holds the event loop open otherwise.

**What it cannot see is layout.** JSDOM computes none, so nothing in it can catch an element
overhanging the viewport or a layer stopping short of the page. Two such bugs shipped and had to
be found in a real browser. When a change touches geometry, `npm run build` and then
`npm run harness`, and measure it in Chrome; `harness/LEIA.md` has the details (the doctype
the host adds, `-c-1`, the seeded `window.claude` shim, covers under `_blob/`).

## Publishing

Three files go up: `dist/index.html` as the page, with `dist/app.js` and `dist/styles.css` as
supporting files. Publish against the live artifact's URL and **omit `capabilities`**, which
carries `assets`, `db` and `downloads` forward; passing `{}` would revoke them and take the
library with them. A second artifact of this app is not a clean slate: one published with `db`
came up holding a copy of the real library, so pin `if_version` on every write.

## Testing

`npm test` (`scripts/test.mjs`) runs everything below and is the only verdict to trust;
see Build for how it judges a suite. Each suite can still be run alone from the project
root, e.g. `node tests/test-render.mjs seeded`, to read its full output.

`tests/test-render.mjs seeded` mounts the bundle in JSDOM against a mock `db` and
`assets`, walks every tab, sheet and gesture, and asserts the punctuation bans. It also
runs as `no-claude` and `with-claude`. Its source assertions read every module under
`src/`, not one file. `scripts/check-encoding.mjs` verifies every text source still
round-trips as UTF-8 (it walks `src/`, `tests/`, `scripts/` and `harness/`), after a
PowerShell rewrite silently corrupted the test file's accents and made the em-dash
check compare mojibake for two rounds.

**`test-render.mjs` prints failures and exits zero, so never judge it by its tail
when running it alone.** It ends with `ERRORS AFTER INTERACTION: 0`, which counts
thrown exceptions and says nothing about assertions. Two versions shipped that way:
v44 and v47 each left four assertions red and neither was noticed for several
versions. The runner exists because of this; alone, `grep -c FAIL` must print `0`
and the passes must be counted too.

Not covered by any suite: how the reorder gestures FEEL (the geometry and the persistence are, see
tests/test-arrasto-seguir.mjs, test-arrastar-colecao.mjs, test-arrastar-series.mjs; the feel is checked in the
harness with synthetic pointer events, with a requestAnimationFrame shim because a hidden Chrome tab runs
timers at ~3 Hz), the thumbnails' IndexedDB path, and
anything visual. Source-reading assertions that eval a slice of code strip `export`
first, since the split put it in front of every top-level declaration.

An assertion that goes red because the feature deliberately changed is not noise
to delete. Each of those eight encoded an intent that still held, and each was
rewritten to check the new mechanism instead, in one case adding a check that the
old mechanism has not come back. Deleting them would have thrown away the only
written record of why the rule existed.

`tests/test-filtros.mjs` covers the HQs filters (v61): the character filter's
typing and keys, and whether the filters survive a reload but not a fresh visit,
by mounting several times with and without the previous mount's `sessionStorage`.
It exits non-zero on a failure.

`tests/test-filtro-series.mjs` covers the séries character filter and the per-row
search (v93), including the suggestions under the filter and a reload.

`tests/test-formatos.mjs` covers formats per publisher (v95): the form's publisher
select and format list, the fallback and its note, old values kept, the filter per band.

`tests/test-colecoes.mjs` covers the collection manage sheet (v66): the reading
order fold and its session memory, and the bar colour option that only appears
while a collection's spine bar is on screen, and (v138) the "Adicionar volumes" search:
several picked at once, added in the order tapped, the collection's characters first,
one save with undo, and (v139) the publisher lock and the pickers that replaced every
native select. It stubs strip widths, since JSDOM
has no layout. Exits non-zero on a failure.

`tests/test-boot.mjs` covers what the walk cannot reach: which tab the app opens on
and which skeleton it draws while the library is still in flight. It mounts the
bundle several times over a mock database that answers only after a delay, so the
loading state can be read, and it seeds `sessionStorage` before each eval, since
the saved tab is read exactly once, when the state is created. It exits non-zero
on a failure, which `test-render.mjs` does not.

Harness traps worth remembering:

- React tracks a controlled input's value through its own setter, so a test must go
  through the native setter or it measures nothing.
- A volume with an uploaded cover has no fallback cover, so assertions must not read
  titles from `.cover-fb-title`.
- JSDOM does not apply media queries, and answers every one of them false. Anything
  whose behaviour lives only in one (the search's full-screen phone mode, the
  segmented control hiding under 768px) cannot be covered here. One query is stubbed
  deliberately: the harness reports a fine pointer, or the tab lattice would sit
  behind its own gate and never be exercised at all.
- JSDOM computes no layout, so nothing here can see an element overhanging the
  viewport or a layer stopping short of the page. Both shipped once. Geometry gets
  checked in a real browser instead, with the served harness described under Build.
- A canvas in JSDOM has no 2d context, so a component that paints must survive
  `getContext` returning null rather than throwing through its effect.
- The GSAP ticker keeps requestAnimationFrame alive, so the run ends with an
  explicit `process.exit` once every assertion has printed. Without it the process
  hangs after a clean pass, which reads as a failure.
- Counting assertions pin real numbers (thirty chromatic swatches, three neutral).
  Adding a palette entry is supposed to fail them; update the count, do not delete
  the check.
- The seeded publisher is named `Marvel`, not `Marvel Comics`. The suggestion tests
  reuse the `marvelOpt` the publisher block already declares rather than redeclaring
  it in the same scope.
- **An automated Chrome tab is usually not visible, and that disables most of what
  you would measure performance with.** It reports `visibilityState: "hidden"` while
  `hasFocus()` is still true. Chrome then suspends `requestAnimationFrame`, and with
  it `ResizeObserver` callbacks and `longtask` PerformanceObserver entries, since all
  three are delivered by the rendering lifecycle. In v46 this made a real 122ms-per-
  frame bug impossible to reproduce locally: the canvas that ballooned on the user's
  screen never rebuilt here, because the observer that resizes it never fired. Check
  `visibilityState` first; when it is hidden, measure only synchronously (a timed
  loop, a forced layout read), and read an empty rAF, ResizeObserver or longtask
  result as "not measured", never as "nothing happened".
- Timing canvas work needs a forced readback. Canvas 2D commands are queued, so
  `performance.now()` around a draw measures submission and reports ~0ms. Put a
  `ctx.getImageData(0, 0, 1, 1)` after the draw. And `void el.offsetHeight` times
  style and layout only: it never includes paint or compositing, which is where a
  large canvas and `backdrop-filter` actually cost. Do not conclude a thing is cheap
  from a layout-only number.
- `.click()` on a React control does not measure a render. React 18 hands the work to
  its scheduler, so timing the call measures event dispatch and nothing else. Time
  from the click to the DOM actually changing, with a `MutationObserver`.

What the walk covers, beyond the tabs and sheets: the unlock gesture, the colour
picker, cataloguing shortcuts, publisher filtering, and the search suggestions
(ranking, the cap at 8, the publisher-filter bypass, arrow and Enter and Escape, and
the nothing-found state).

## Reordering, two publishers and document equality (v152-v159)

**v160-v164 (HQs drag, on the phone).** No `touch-action: none` on the covers: a finger on a cover scrolls
the page, and a non-passive `touchmove` listener on each HQs grid (`gradeRef`, registered at mount because
iOS ignores one added after the touch began) blocks the scroll only while a drag is armed. The grid is NOT
z-lifted while dragging (only its ancestors), so just the dragged cover clears the sticky group head. The
neighbours glide with one batched FLIP pass and `transition: transform 260ms var(--ease-out)` (a spring that
kept velocity, v163, was tried and rejected by the user). The wished order, or the revert when the pointer
leaves the group's box, is applied only after the pointer has asked for the SAME order for `DWELL_MS = 110`
ms (iOS rearranges when the finger dwells; this stopped the block from shaking when crossing the group's
edge); on release the order under the pointer applies at once. Details: HISTORICO.md v160-v164.

**One gesture, three places.** Long-press 450ms (the fill ring runs, then the cover wiggles), then drag:
HQs inside their personagem group (v153-v154), a collection's volumes inside its row (v155, writes
`colecao.membros`, the same list as the sheet's "Ordem de leitura"), the séries cards inside a volume
sheet (v157, writes the volume's own `ordemSeries`, ids with "?" for a removed série). The dragged card
follows the pointer with its grab offset; the target is decided from slot rects measured ONCE when the
drag arms (never from the neighbours' animated rects, which made them dance), and the order is rebuilt
at once for the slot under the pointer (`reordenarParaSlot`); the others glide by FLIP. Outside the
allowed area the preview returns to the start and releasing cancels. Auto-scroll near the edges, measured
from under the sticky chrome (`limitesDeRolagemDaPagina`). Rows that scroll (collections) and the sheet
use a fixed ghost on <body> (src/lib/arrastoGhost.js; z-index 14 for the HQs layers, 90 for the sheet
ghost); the chrome is .topbar 20, .ed-band 15, so lifted layers stay under it. Série cards have variable
heights, so the insertion index comes from stacked midpoints as if the dragged card were absent
(`indiceDeInsercaoVertical`). Geometry lives in src/lib/arrastoSeguir.js (pure, tested).

**Two publishers per HQ (v152).** `tambem: [{editora, personagem}]` on a volume (optional, omitted when
empty; the volume's own pair stays the primary). One copy owned, shown in both publishers' bands under that
band's personagem, counted once in "Todas" and in totals, accepted by collections of either publisher.
Helpers `presencas`, `editorasDe`, `naFaixa` in lib/constantes.js; display-only projection, writes always
go to the real volume by id; `ordem` is shared between the bands.

**Document equality ignores key order (v158).** The server returns objects with sorted keys; the tab writes
the order it has. Every "is this the same document" test (armazenamento.js `canon`, the item equality in
mesclar.js) sorts keys first. Comparing JSON text had made the tab take its own earlier write for another
device's and show "atualizada em outro aparelho" after save after save.

**The hold fill's wave** is only drawn while `--hold-p` > 0 (v159); before a press `--hold-h` does not
exist and the default band would sit inside a tall card. **Image Comics** (white) sets `data-ed-neutro` on
the header and band: light buttons with dark ink in dark mode, graphite with white ink in light mode.

## Decided not to build

**A batch cataloguing mode in the app** (critique 2026-09-26, question 2: "three trips per
book: form, cover, link edições"). Answered 2026-09-27: the user catalogues almost every book
through the `longbox-cadastrar` Claude Code skill, which writes volume, collection, séries,
edições and cover in one pass after a per-book dossier the user checks against the shelf and
reviews; the app form is used for adjustments. A batch mode here would duplicate that path.
Improvements go to the skill instead (2026-09-27: parser gaps fixed, the "reload every tab
after a write" step retired since v96 merges and syncs live).

**Hiding "Seu acervo" behind the wordmark** (critique question 3: "daily or monthly? could it
sit behind the mark so the shelf starts sooner?"). Answered 2026-09-27: the user looks at it
most visits, so it stays visible where it is. Hiding it would cost a click on most visits to
save some scrolling; the wordmark already means "back to the hub"; and nobody has to scroll
through it to reach the collection ("Minha Coleção" at the top, keys 1-3). Its engineering
line went in v102. If it ever starts to weigh, the agreed fallback is a remembered collapse
toggle on the block, not a hidden entry point.

## Pre-flight, scoped to this project

Run before publishing:

- [ ] `npm run check` ends with `Tudo passou.` (it rebuilds `dist/` first, so what
      gets published is exactly what was tested)
- [ ] Committed in git, and tagged with the version number once published
      (`git tag v87`), so any published version can be restored
- [ ] Zero `—` and zero `–` in any user-visible string
- [ ] Max one `·` per metadata line
- [ ] One accent, used identically everywhere; `--danger` only on destructive actions
- [ ] One radius system (8 / 16 / 6) with no exceptions
- [ ] Both themes rendered and checked, WCAG AA on body text in each
- [ ] Every animation justifiable in one sentence; reduced-motion path verified
- [ ] Only `transform` / `opacity` animated, apart from the four documented
      `clip-path` / `mask-position` cases in the Motion table
- [ ] **No full-frame canvas is sized to the content.** `.cursor-grid` and any
      backdrop like it stay pinned to the window. A canvas redrawn every frame
      costs its own area, so one stretched over the page is a bug that only
      appears on the app's tallest tab, and it stalls every other animation with
      it because they share the thread. Measured on séries: 25.9 megapixels and
      122ms per frame, against 3 megapixels and 4ms at window height (v47)
- [ ] Tab switched in both directions between every pair of tabs, not just
      adjacent ones, watching the band's pill settle. Three separate stutters in
      v39-v43 were visible only on the widest jump
- [ ] Empty, loading and error states present per tab
- [ ] Form labels above inputs, errors below, focus rings visible and contrast-safe
- [ ] No decorative status dots; status color only where it carries real state
- [ ] Copy self-audit: every visible string re-read in pt-BR
- [ ] `use()` returning `null` handled for both `db` and `assets`
