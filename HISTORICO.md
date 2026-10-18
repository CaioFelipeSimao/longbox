# Longbox - Histórico de versões

Tudo o que foi construído depois da v1, em ordem, com o porquê de cada decisão e
cada bug encontrado no caminho. A especificação atual (tokens, layout, dados, build,
testes) fica em `DESIGN.md`; este arquivo é o registro, e cresce a cada versão.
Versões são as do artifact publicado; a partir da v86 cada uma também é um commit
com tag no git.

**v3 The hub.** A landing view before the collection, reached back through the
wordmark. It carries a random suggestion from the collection (rerollable), the
hunt, the shelf, and the maintenance footer. The publisher filter never applies
here: the hub is deliberately the one place that shows everything.

**v3 The header earns presence.** The wordmark went from a label to a mark: four
bars reading as comic spines in a longbox, a two-tone wordmark, and a scroll edge
that only draws its hairline once content runs under it.

**v3 Export through the `downloads` capability.** A page-initiated download is
inert in the artifact sandbox, so `<a download>` silently did nothing (inherited
from v2). Copy-to-clipboard is the fallback where the capability is absent.

**v6 The unlock gesture.** Past the end of the hub the surface tracks the pointer
1:1 and is thrown clear on release, iOS-lock-screen style. Gated on a bottom
sentinel so a tall hub stays readable; 350ms arming, 120px or a flick to commit,
damped the wrong way. Returning reverses along the same path.

**v7 The issue panel is pinned.** Inspecting issue 700 of a 1000-issue run used to
open a panel far below the grid. It now sticks to the foot of the sheet and
updates in place, so checking five issues costs no scrolling.

**v10 The hunt is honest.** Ranking by percentage was degenerate: a complete
4-issue miniseries topped the chart forever. It now filters to series at or past
`QUASE_FECHANDO` (0.5) and picks three at random per page load.

**v11-12 Character colour.** Hue comes from the character, lightness from the
title, and the colour rides the left edge of every cover, uploaded art included,
so the shelf reads as a map of who you collect. 32 swatches: 29 chromatic in hue
order plus 3 neutrals. Set from the character's group heading, which exists in
both tabs. Values written before the palette carried saturation were bare hues and
are still read as such.

**v13 Publishers.** Discovered automatically from the `editora` field the user was
already filling, so there is no setup step. A sticky strip under the header holds
the logo, the tab control (desktop), and the selector. Collections inherit from
their members. "Todas" and "Sem editora" always exist so nothing can hide. The
publisher tint stays on the strip and the active tab: making it the global accent
would have collided with `--danger`, and Image's white fails as an accent in light
mode. **Reversed in v24**, which answers the second objection and accepts the first.

**v14 Cataloguing speed.** Ctrl+V pastes a cover onto the open volume. Duplicate
prefills a new volume from an existing one. New volumes inherit the browsed
publisher. Search reaches notes and the names of the series a volume collects, and
never obeys the publisher filter.

**v15-16 Alignment and hierarchy.** A visual pass over the hub and the collection
header, from a review of the live artifact.

The publisher strip is now a full-bleed `.ed-band` wrapping a capped `.ed-bar`,
mirroring `.topbar` and `.topbar-inner`. Before this the strip's background and
hairline painted to the edge of their own 1200px box while everything inside
`.content` sat 24px further in, so the strip and the shelf under it never shared a
left margin, and two hairlines of different widths stacked 40px apart.

The hunt's empty state keeps its "Falta pouco" heading and sits in `.hub-note`
instead of being one muted sentence floating between two sections.

The storage meter is capped at 420px and neutral: the accent belongs to the
actions you take, not to maintenance info. `--border-strong` was the first try and
was invisible against the meter's own `--surface-2` track, so the fill is
`--text-muted`.

The suggestion card centres its body against the cover rather than hanging from its
top edge, the cover grows to 160px past 900px, and the title is held to a 24ch
measure so a long one wraps beside the cover instead of running out into the empty
half of the card.

Selects are drawn rather than left to the OS: `appearance: none` plus an inlined
Lucide chevron as `--select-arrow`, defined once per theme because a data URI
cannot read `currentColor`.

`outline: none` came off the input, select, textarea and search focus rules, where
it had been overriding the global `:focus-visible` ring from further up the file.
The border still shifts to the accent; the ring is back on top of it.

The third action in the volume form is a ghost button at its own width, instead of
a full-width one sitting under and wider than the primary it competes with.

Hub spacing moved into `--hub-gap` and `--hub-rule-pad`, so a section break and a
rule-separated block are spaced by the same two numbers instead of each block
adding its own margin on top of the container gap.

Raised in the same review and deliberately not changed: the three-column figure
row, which the user reads as harmonious; `toFixed(1)`'s decimal point, which the
user prefers over a pt-BR comma; the centred footer; and the wall's small covers,
which are sized for a full collection rather than for a library holding two
volumes.

**v17 The column is 1560.** The user asked for the publisher strip 30% wider. The
strip alone would have undone v15: it would have sat 180px outside the content on
each side, misaligned with the wordmark above it and the group heading below. Shown
the three options drawn to scale, the user chose to move all three together, so the
top bar, the strip and the content now share `--col: 1560px` rather than three
copies of the same number. The shelf goes from 8 covers per row to 10.

Worth knowing before anyone proposes a width change again: `--col` only binds on a
wide desktop window. The user's Galaxy Tab is around 1280px, already under the old
1200px cap once padding is counted, so a change here is invisible on the device they
catalogue from.

**v18 The band is 20% taller, vertically only.** Height, not scale: the controls in
the publisher band gained vertical room and no width. `.ed-segmented button` and
`.ed-select` now carry explicit heights (38px and 43px) instead of being sized by
their padding, the band's padding went from 10px to 12px, and the segmented pill's
own padding from 3px to 4px. Font sizes and horizontal padding are untouched, which
is what keeps the growth off the horizontal axis.

The publisher logo is the exception, and necessarily so: it is an image, so height
and width move together or it distorts. It went from 26px to 31px here, and to 37px
in v19.

`--edbar-h` was wrong before this and is now right. It read 54px, but the band never
measured that: the segmented pill alone was about 39.5px inside 10px of padding, so
the band rendered near 59.5px and the declared height was a floor it never reached.
That token is also what the sticky group headers offset themselves by
(`top: calc(var(--topbar-h) + var(--edbar-h))`), so they were positioned against a
number roughly 5px short of reality. The controls are now sized so the band measures
exactly its token: 38 + 8 + 2 for the pill, plus 12 top and bottom, is 72px.

**v19 The publisher logo is 37px.** The user judged it too slight at 31px to identify
the publisher at a glance, so it took another 20%. Its `max-width` had to rise from
130px to 185px in the same step: a wide wordmark logo hits the width ceiling before
the height one, so without that the increase would have shown on square logos and not
on wide ones. The ceiling is 42px, since the band's inner height is 48px and the logo
box is its height plus 6px of plate padding. Past that the band has to grow again.

**v20 The search suggests volumes.** Typing in the top bar now drops a ranked list
of up to 8 volumes under the field, each with its cover, title, and personagem with
editora on a second line. The cover is there because it is what makes a volume
recognisable faster than its title reads, and it costs nothing, being loaded already.

Ranking is by where the match lands: a title that starts with what you typed, then a
title that contains it, then the personagem, then everything else. Without that, a
hit that exists only in a volume's notes would sit level with an exact title, which
is never what was meant.

The list reuses `textoBusca`, so it reaches the same four places the shelf filter
does, including the names of the series a volume collects. It deliberately ignores
the publisher filter and the status and type filters: looking for a volume you half
remember must not depend on what you happen to be browsing. The shelf behind it still
filters as before.

Under 768px the field takes over the screen when focused, with a Cancelar button.
This is the one place the two devices genuinely conflict: on a phone the on-screen
keyboard covers the lower half of the viewport, so a dropdown anchored under the
field would have about two rows to live in. Row height was never the conflict;
keyboard navigation costs a touch user nothing and comfortable rows cost a mouse user
nothing.

Keyboard: arrows move the highlight, Enter opens the highlighted volume, Escape
closes. Picking a volume leaves the query in place, so the shelf stays filtered and
you can come back and take a second one.

Left out of this first version on purpose: suggestions for séries and coleções
alongside volumes, and a recent-searches history.

**v21 The hub has a backdrop.** GridMotion from React Bits, a six by thirteen grid
rotated fifteen degrees that drifts against the pointer, sits behind the hub
filled with the covers from your own collection. It is bled to the window rather
than the column, runs nearly the full height of the hub, fades out through a mask
before the bottom, and carries a scrim because the tiles are other people's cover
art and type cannot negotiate with whatever colour drifts past.

**A tile is the shape of the cover in it.** Upstream painted each cell as a CSS
background, which can only crop the picture or leave a bar around it, so the tile
holds an `<img>` at the row's height and whatever width that picture needs. No
cover is ever cropped and none is padded. The cost is that columns do not line
up, because real covers are not all the same width, and a shelf of real books
does not line up either.

Rotating the wall means it has to overhang the box it fills in both directions
and stay covered once the rows drift: `W*cos15 + H*sin15` wide plus the 300px of
travel, and `W*sin15 + H*cos15` tall. The H in that pair is the hub's, not the
window's, and this is where the first sizing went wrong. Tiles were scaled to a
tall hub, but a hub holding a couple of volumes is around 900px, so the grid came
out several times its own box, centred and clipped, and only the middle row and a
sliver of the one above it ever showed. Tiles are sized for the short hub now and
the grid widens to match: six by thirteen, seventy-eight tiles. A smaller tile
needs more of them to cover the same rotated area, and that is the whole of the
trade; the wall was resized twice by eye after the first fix and the count rose
each time.

The two counts come from different worst cases, which is why neither is round.
The columns are what a 1024px window needs, where the tile sits at its narrowest
against its box. The rows are what a phone needs, where the tile hits its minimum
width and stops shrinking while the box does not.

An empty tile keeps a comic's two-to-three proportion, so the gap it leaves is
book-shaped.

It draws only from volumes that actually have uploaded art, and when there are
none it does not render at all: a grid of bare titles behind the hub would be
noise dressed as decoration.

**No cover is laid twice.** A repeat would put the same book on the wall in two
places, which is the one thing a shelf cannot do, so a library smaller than the
forty-two tiles leaves the leftovers on their own empty grey. The wall fills in
as the collection gets photographed, which makes it a quiet measure of how far
the cataloguing has got. The covers that exist scatter across the grid rather
than packing into the first tiles, because a filled block above empty ones reads
as a loading state. The seed is the session's, like the shelf and unlike the
suggestion: the wall holds still while you use the page and is dealt again on
every reload.

A coloured fallback card was tried in this slot for volumes with no photograph
and dropped. Among real covers it reads as a gap rather than as a book, and it
also cost the wall its one honest signal, that an empty tile is a volume still
waiting for its cover.

**The backdrop does not replace the shelf, and must not be read as trying to.**
They are both grids of covers and that is the whole of the resemblance. Every
tile in the shelf opens its volume; the backdrop is `pointer-events: none` and
`aria-hidden`, unreachable by pointer and absent to a screen reader. The shelf is
sorted by character so each one holds a colour block, which is the map the
character hues exist to draw; the backdrop is shuffled, rotated and cropped,
which destroys exactly that ordering. And the shelf shows volumes with no cover
art through the character-coloured fallback, while the backdrop can only show
volumes that have art: dropping the shelf would hide every volume not yet
photographed. The backdrop is the room the shelf is standing in.

Two things had to change to take it. Covers are served as `/_blob/<assetId>` and
the upstream component treats only strings starting with http as images, so it
would have printed the path as text; the check now accepts an app-relative path.
And its classes were `.row`, `.intro` and `.fullview`, which this stylesheet
already spends, so they carry a `gm-` prefix.

The animation is upstream's, deliberately: a GSAP ticker bound to mousemove that
runs whenever the hub is mounted, with no reduced-motion guard and no pause when
the grid is offscreen. That was a considered choice, not an oversight. It does
mean `test-render.mjs` can no longer exit on its own, because JSDOM's
requestAnimationFrame is a real timer and the ticker holds the event loop open,
so the run now ends with an explicit `process.exit` once every assertion has
printed.

**v22 The band's tabs answer to the pointer.** HQs, Coleções and Séries were the
one control in the publisher band with no hover and no press, while the filter
button and the select either side of them had both. Pointing at a control and
getting nothing back reads as a dead control, so the fix was a missing state
rather than an animation: the label goes from muted to full, a wash comes up
under it, and the tab takes the `press` class the rest of the app already uses.

Everything stays at the 120ms the rule already carried. Tabs are switched tens of
times in a session, which is the frequency band where motion should be reduced to
almost nothing rather than added to, so there is no lift, no scale on hover and
no travel. The hover sits behind `(hover: hover) and (pointer: fine)` because a
tap would otherwise leave the tab stuck in its hover state after the tab had
already changed.

The wash direction is set by which tab is the selected one, and that flips with
the band. Untinted, the selected tab is the recessed darker one, so hover darkens
toward it. Tinted by a publisher, the selected tab is that publisher's colour, so
hover takes a fraction of the same hue instead; a neutral wash there would have
sent hover away from selected rather than toward it. The first cut shipped only
the neutral rule and was wrong on every tinted band, which is every band with a
publisher chosen.

**v23 The tabs stand on a lattice.** CursorGrid from React Bits lies under the
HQs, Coleções and Séries content: a grid of cells that light around the pointer
and fade behind it, with a ring of them thrown out from a click. It burns in the
colour of the publisher being read, the one the band is tinted with, and falls
back to the cyan the interface owns when no publisher is chosen.

Three deviations from upstream, each forced by where it sits. Upstream listens on
its own container, which works when the grid is the thing you point at; here it
is behind the cards, so the layer is inert and a `pointerTarget` says what
listens instead. That target is the window, not the content column: the canvas
bleeds to `100vw` and listening on the column left the margins dead, which is
what zooming out exposes. And upstream parses hex only, while every colour here
is an `hsl()` string out of `swatchColors`, so the parser takes both.

Listening on the window means most moves happen nowhere near a cell, so a move
only starts a frame if it actually lit one, and a press only throws a ring if it
landed on the lattice rather than on the bars above it. The component already
parks itself when nothing is lit, so an idle tab costs nothing.

**It is not mounted on touch at all.** The effect follows a cursor and a finger
is not one: all a finger could do is drag a lit trail while the page scrolls,
repainting a canvas through the whole gesture on the device least able to spare
it, and fire a ring on every tap that opens a sheet. The gate is
`(hover: hover) and (pointer: fine)`, read live so a tablet with a mouse plugged
in still gets it, and it withholds the `data-lattice` attribute too, so the
floor height and the stacking come and go with the lattice.

That floor exists because the layer is `top: 0; bottom: 0` inside the content,
which means a tab holding four volumes would end above the fold and take the
lattice with it, leaving bare background under the last row. The content area
therefore stands at least a viewport tall, in `dvh` so a phone's shrinking
address bar does not overshoot it.

The accent is written in both the stylesheet and the source, because a canvas
cannot read a CSS variable; `test-render.mjs` compares the two so they cannot
drift. Like the hub backdrop, the lattice carries no reduced-motion guard, which
was a considered choice rather than an oversight.

**v24 The chrome takes the publisher's hue.** Outside the hub, the header and the
strip shift to the colour of the publisher being read: the wordmark's BOX, the lit
bar in the mark and the rest filling on hover, the primary button, the active
filter button, and the focus ring on both the search field and the selector. None
of those needed touching. All six already went through `--accent` and
`--accent-text`, so the whole change is those two variables redefined on an
attribute the header and the strip carry.

**Only the hue travels.** `--ed-hue` feeds the accent's own saturation and
lightness, which differ per theme, so a publisher can move the colour but never
the contrast. That answers half of why v13 refused this: a pale publisher colour
cannot wash the header out, because its lightness never arrives. It was also
forced rather than chosen, since the light theme is a `prefers-color-scheme`
block and an inline colour would have pinned the dark theme's value in both.

A publisher with no colour, or a greyscale one, lends nothing and the interface
keeps its own cyan; hue 0 would otherwise come out red. The hub never carries the
attribute, so it never shifts.

The other half of v13's objection stands and was accepted rather than solved: a
red publisher puts `--danger`'s colour on the primary button, where it reads as a
destructive action. Nothing designs around that without distorting the red that is
the point of that publisher, so it was the user's call, taken with Marvel on
screen.

**v24 and v25 The character band earns its line.** It landed in v24 and was tuned in v25. The sticky heading over each character
group was `background: var(--bg)`, the page's own colour, which made it invisible
until the tab lattice arrived behind it and it started showing as a blank stripe
cutting the pattern. It now carries eight percent of that character's colour
mixed into the background, so the same band that was an accident reads as the
character's own rule. Fifteen was tried first and was too much for something that
repeats down the whole tab.

It is also rounded and runs twelve pixels past the column on each side. The bleed
is a negative margin with a matching padding, so the box grows outward while the
row inside it does not move: the swatch gains a margin of band to its left
instead of sitting on the edge, and still lines up with the cards below it. The
rounded corners fall in that bleed, outside the card grid, so nothing scrolling
under a sticky band shows through them.

Mixed into the background rather than laid over it at an alpha, because the band
is sticky and has to stay opaque as cards pass under it. Mixing also makes the
fallback safe: with no character colour the expression resolves to `--bg` itself,
where an alpha would have left it see-through.

**v26 A brand blue, an ink that reads, and the scrollbar that was always there.**

The palette gained `hsl(211.3 96.7% 48.2%)`, which is exactly `#0476F2`, asked for
by hex. Its numbers are not round because it is a brand colour rather than a hue
picked off the wheel, and rounding lands a step off in the blue channel. It sits
with the other specials, which exist precisely for colours that bring their own
saturation and lightness. The collection's own DC Comics entry was then set to it by
the user, so that blue is what the strip, the chrome, the lattice and the active tab
all burn now.

**The ink on a fill is now measured, not named.** `--accent-ink` was fixed per
theme, which held while the accent was one colour and broke in v24 when it began
taking a publisher's hue. HSL lightness is not perceptual: across the wheel at the
accent's one lightness, contrast against the dark ink runs from 11.6 on yellow to
1.7 on blue, and the collection's own blue sat at 3.4, under AA. So the ink is
chosen per accent by whichever of the two actually reads on it, measured in JS and
handed to CSS per theme, since the two themes render the hue at different
lightnesses and do not always agree.

Weight and size were the first suggestion and would not have worked. Large text
lowers the bar from 4.5 to 3, and nothing saves 1.7.

**The horizontal scrollbar was mine, and had been there since v21.** `100vw`
counts the vertical scrollbar and the visible area does not, so both bled layers,
the hub backdrop and the tab lattice, overhung by exactly the scrollbar's width
and pushed a horizontal scrollbar under the whole page. CSS cannot measure that
gap, so `--sbw` is published from JS on load and resize and the bled layers
subtract it. `test-render.mjs` now refuses a bare `width: 100vw`.

**v27 The horizontal scrollbar, properly this time, and the strip under it.**

v26 claimed the scrollbar was fixed and it was not. `--sbw` was measured on mount
and on resize, and the scrollbar does not appear at either moment: it appears when
the library finishes loading and the page outgrows the window. Measured in a real
browser, that transition fires no resize event and no ResizeObserver either, on
the root or on the body, even though the body's own width moves from 1707 to
1692. What it does fire is a render, so the measurement now runs after every
render and writes only when the number moved.

Two things about that debugging are worth keeping. The first harness was serving
`dist/index.html` directly, which has no doctype because the Artifact host wraps
it at publish time, so the page was in quirks mode with the body as the scrolling
element and nothing measured there described the published page. The second, with
the host's wrapper and a seeded library, reproduced the bar immediately and named
`.gm` as the element overhanging by eight pixels.

`overflow-x: clip` on the body was tried and dropped. It does kill the bar and
sticky survives it, but it makes the body the scrolling element, and the hub
unlock gesture and its bottom sentinel are both built on the viewport being the
one that scrolls. Not worth it for a symptom whose cause can simply be measured
correctly.

**The strip at the bottom was a different bug.** `.app` keeps room under the
content for the mobile tab bar, 48px on desktop, and the lattice stopped at the
content's edge, so the last strip of the page had no lattice and cut it off. It
only showed at the very bottom of the scroll, which is why it read as something
attached to the end of the scrollbar. That padding is now the `--app-pad-b` token
and the lattice reaches down into it, instead of the number living in one rule
and being invisible to the other.

**v28 A reload stays where it was, and the skeleton describes the tab it stands in for.**

Two complaints, one screen. Reloading always dropped you back on the hub, because
`tab` started at a literal `"hub"` and nothing wrote it down; and whatever tab you
were headed for, the loading state drew `ShelfSkeleton`, the grid of covers that
only ever described HQs.

The tab is now kept in **`sessionStorage`**, under `longbox:aba`, and the choice of
gaveta is the feature rather than an implementation detail. `sessionStorage`
belongs to the browser tab: a reload is the same tab, so it keeps what it had,
and closing the tab throws it away, so the next visit lands on the hub. That is
exactly the rule the user asked for. `localStorage` would have survived closing
the browser and made the hub unreachable as a landing view; it is not used here.
Both the read and the write sit in `try/catch` and fall back to the hub, because
a private window can refuse storage outright, and the value is validated against
the four known tab keys so a stale or hand-edited note cannot render nothing. The
write hangs off a `useEffect` on `tab` rather than off `switchTab`, so the scroll
gesture that unlocks the hub is covered too.

Two cases where the browser, not the app, decides: Chrome's "continue where you
left off" restores the tab session along with its storage, and Android restoring a
backgrounded tab does the same. Both reopen on the last tab rather than the hub.
The user was told this before the work started.

**Four skeletons now, one per layout family**, because a skeleton that describes
the wrong screen is worse than none: it promises a layout that never arrives.
`ShelfSkeleton` keeps HQs; `ColecoesSkeleton` is a title over a strip of covers;
`SeriesSkeleton` is the character band over cards carrying a run bar, and it
borrows `.serie-row` and `.coll-strip` from the real thing so the padding and the
cover widths match rather than being guessed at; `HubSkeleton` is the suggestion
card, one hunt section and the three figures over their rule. The hub's backdrop
is deliberately left out: it is built from covers that have not arrived yet.

While that was open, two smaller jumps went away. The publisher band used to wait
for the library (`!isHub && !loading`), so the content shifted down the moment it
landed; it now draws from the first paint with the count held blank, since a
"0 HQs" that turns into 47 reads as a wrong answer rather than a wait. The tab
lattice lost its `!loading` gate for the same reason.

**`test-boot.mjs` is new**, and it exists because `test-render.mjs` cannot see
either half of this: it waits 400ms for the app to settle, by which point the
skeleton is gone and the tab has already been chosen. The boot harness holds the
mock database open on purpose and seeds `sessionStorage` before the bundle
evaluates, which is the only moment the saved tab is read. It covers the four
skeletons, the tab restored from the note, the invalid note, the write landing in
`sessionStorage` and never in `localStorage`, and a window that throws on storage
access.

Verified in a real browser, not only in JSDOM: reload keeps the tab, a second tab
opens on the hub and the two keep independent notes, and none of the four loading
states overflows horizontally at 400px wide.

Measured on the published artifact right after shipping v28: from a reload, the
page stays blank for roughly two seconds and is fully loaded by three. The header
is absent during that blank stretch, so it is the host and the bundle arriving,
not the app's loading state, and no skeleton can cover it: nothing is running yet.
The skeleton covers only the database wait, which against the real `db` is short.
That is worth knowing before anyone tries to make the loading state prettier: the
part the user actually waits on is not ours to paint.

**v29 The skeleton breathes.**

The blocks were static grey, which reads as a page that has finished loading badly
rather than one that is still working. They now pulse: opacity 1 to 0.5 and back
over 1800ms on `--ease-pulse`, the symmetric `cubic-bezier(0.4, 0, 0.6, 1)` added
as a third ease token, because the other two decelerate and would make a breath
limp on the way out.

**This is the one infinite animation in the app, and the Motion rule that bans
them still stands.** A wait has no known length, so the thing standing in for it
cannot have one either; it ends when the library lands. That is the only honest
end available to it, and it is what separates this from the decorative loop the
rule exists to keep out. Nothing else may claim the exception.

Two decisions inside it. It animates **the grey blocks, not their container**:
the card borders, the character band and the suggestion card's own chrome are the
frame the content will arrive into, and a frame that breathes reads as the page
itself being unstable. All fourteen share one duration and one curve, so they
move as one surface rather than as fourteen independent things, which was
confirmed in the browser by reading `currentTime` off every running animation and
finding them identical. And it is declared **inside** `prefers-reduced-motion:
no-preference` rather than merely switched off under `reduce`, because the global
reduce block clamps every animation to `150ms !important`, which would have turned
a breathing skeleton into a strobe for exactly the people who asked for less
motion. Under reduced motion the skeleton simply sits still.

Measured on the rendered element, not inferred from the stylesheet: fourteen
animations named `skelPulse`, `1.8s`, `cubic-bezier(0.4, 0, 0.6, 1)`, `infinite`,
all `running` and all at the same `currentTime`; the card they sit in reports
`animation-name: none`; at `currentTime` 0 the line computes to opacity 1 and at
900ms to 0.5. Worth knowing for the next person who measures this: Chrome freezes
the animation clock in a background tab, so `getComputedStyle` returns whatever
value it stopped on and the pulse looks broken when it is not. Check
`document.visibilityState` before believing a frozen reading.

The loading state also gained a voice. The blocks stay `aria-hidden`, since a grey
rectangle has nothing to say, and a single visually hidden `role="status"` line
says "Carregando sua biblioteca" instead, clipped rather than hidden so it stays
in the accessibility tree. It disappears with the skeleton.

**v30 Four independent fixes: manual order, a quieter editoras panel, an honest
logo, and a hub bar that reads as a percentage.**

**HQs can be dragged into a manual order, held to one personagem.** Every volume
carries an optional `ordem`; absent until the first drag in that group, so nothing
about an untouched library changes. A drag itself is a long press, 350ms with under
10px of movement (the same arming window the hub's unlock gesture already uses),
tracked through Pointer Events rather than the HTML5 drag-and-drop API, because
native drag does not fire from touch and the tablet is where cataloguing happens.
`document.elementFromPoint` under the pointer finds the card being hovered, and a
drop is only honoured inside the same personagem's `data-personagem`, so nothing
can be dragged into another character's group. Releasing over a card reassigns
`ordem` (0, 1, 2...) to the whole group at once, in the new order; a volume added
later with no `ordem` sorts alphabetically after every ordered one, rather than
landing at a random point in someone's arranged shelf. Search or any filter turns
dragging off entirely: it narrows a group to a subset, and reordering only what is
visible would scramble the rest silently. The pointerup that ends a real drag also
suppresses the click event a browser fires afterward, so a completed drag never
also opens the volume it was dragged over.

**Editoras can hide their own customisation.** Each one carries `customOculta`; a
chevron by its name (`Ocultar personalização` / `Mostrar`) collapses the colour
swatches and the logo's background-plate control down to name, logo and remove,
for whichever publishers do not need attention every time the sheet is opened. The
colour and plate already chosen keep applying everywhere else in the app; only this
one panel gets quieter.

**The publisher logo was rendering short of its own spec.** `.ed-logo`'s height was
set on the span, and the span's own `padding: 3px 6px` ate 6px of it under
`box-sizing: border-box`, so a logo asked for at 37px rendered at 31px (34 at 28 in
the Editoras sheet). `object-fit: contain` cannot crop, only shrink or letterbox, so
nothing was ever cut, but the logo was consistently smaller than v19 documented.
Height now lives on the `img` itself; the span's padding sits outside it instead of
eating into it. Verified in a real browser against a wide placeholder logo: 34px
requested, 34px rendered, aspect ratio intact.

**The hub's own hunt bar is continuous, not bucketed.** `RunBar`'s blocks exist to
compress a run of hundreds of issues into something a phone width can show, which
the hub never needs: it holds three series at a time, so an exact percentage reads
fine. `.prog-bar`, styled but unused since some earlier version, turned out to
already be the right shape for this. `HuntProgress` fills it to `owned / total`,
green past 80 percent and the interface's own cyan below it, and the "faltam X"
count next to it is untouched. The séries tab keeps `RunBar` and its blocks exactly
as they were; only the hub's row changed.

**v31 A build bug: `dist/styles.css` was never wired to `src/styles.css`.** The
build recipe above only ever regenerated `dist/app.js`; nothing copied
`src/styles.css` over its `dist/` counterpart, which is the file that actually gets
published. It had gone stale after v29, so **v30 published its markup and behaviour
but not one line of its own CSS**: the drag cues, the editoras chevron, the corrected
publisher logo and the continuous hub bar were all live in `app.js` with none of the
styling they depend on. Caught while building v31, by diffing the two files and
finding the hub bar three colours short of what the code was setting. Fixed by
copying `src/styles.css` to `dist/styles.css` before every publish; add that copy
to the build steps mentally until it is worth scripting. Verified this time by
serving the harness from `dist/` itself rather than from `src/` plus a hand copy,
so the same gap cannot reopen unnoticed.

**The hunt bar gained a third colour.** Three tiers now, not two: `--warm` (a gold,
new) under 65 percent, the interface's own cyan from 65 to 80, `--read`'s green
above that. The user asked for the warm tier first rather than last, so the read is
"this one needs attention" fading to "this one is just moving along" fading to
"this one is basically done", not a cool-to-warm gradient. `--warm` sits with `--read`
in the token list precisely because it is the same kind of thing: a semantic status
colour, not a decorative accent, so it does not count against the one-accent rule
any more than `--read` already did. Its fill animates via `transform: scaleX()`
from a fixed `transform-origin: left`, not `width`, per the same transform/opacity-only
rule as everything else here; caught by the design hook right after the first
cut shipped with `transition: width`.

**Reordering HQs got the feedback it was missing.** Three additions, all under
`emil-design-eng`'s framework, none of them touching what already worked (the
350ms long-press, the personagem lock, the click suppression after a real drag):

- **The hold is visible while it's being timed.** `.vol-hold`, a tinted overlay clipped
  to nothing at rest, sweeps over exactly 350ms linear the moment a
  finger or cursor comes down (`data-holding`), the same asymmetric shape as the
  skill's hold-to-delete pattern: slow and deliberate on the way in. The instant the
  hold arms, `data-holding` comes off and the overlay recedes over its own default
  150ms ease-out, handing off to the lifted look below rather than sitting on top of
  it. Direction and duration changed in v33; see there.
- **An armed card looks picked up.** `data-dragging` already existed (v30); it now
  reads clearly as "this is the one moving" once the hold-fill above steps aside:
  `scale(1.05)`, the hover shadow, `opacity: 0.9`. Reduced motion drops the scale
  (`transform: none !important`) and keeps the rest.
- **The grid reflows live, not just on drop.** A local `dragVisual` (id, overId,
  personagem) drives a preview order, computed with the same splice-move used to
  commit, so hovering a different card actually slides the group into its
  would-be final shape as you drag — nothing is persisted until you let go, so
  cancelling costs nothing. The reflow itself is animated with a small hand-rolled
  FLIP: before each preview change, every card's `getBoundingClientRect()` in that
  group is captured; after React re-renders them into their new grid cells, each
  one is snapped back to its old screen position with `transform` and no transition,
  then released into a 220ms `ease-in-out` transition to `transform: none`. Only
  `transform` moves, per the performance rule, and reduced motion skips the whole
  effect, snapping straight to the new layout instead of sliding into it.

**v33 Three corrections to the drag, from actually using it.**

**The hold-fill now rises top to bottom, and takes the volume's own editora
colour.** The first cut swept left to right in a flat tint of `--accent`; the user
had meant the other axis (this was a miscommunication caught and fixed in the same
session, not a redesign) and asked for the colour to mean something rather than
being neutral. `clip-path: inset(0 0 100% 0)` holds the fill to zero height, anchored
to the top edge, and eases the bottom inset to 0 as the hold completes, so the tint
grows downward from the top rather than sideways. The colour comes from
`editoraCorPorNome`, a small map built once per render from `lib.editoras`, resolved
through `swatchColors(...).edge`, the same hue-bearing helper every other
publisher-coloured element already goes through, and written as `--hold-color` inline
per card; a volume whose editora has no colour, or isn't in the list, falls back to
`--accent` through the CSS `var(--hold-color, var(--accent))` default rather than
through any JS branch. Only the fill changed. The lifted `data-dragging` look stays
neutral, since it was never part of the complaint.

**The long press is 450ms, not 350.** Raised because 350 was catching taps and the
start of ordinary scrolling too often. The CSS transition on the fill was moved to
match, since the two are the only clock this gesture has: JS decides when it's armed,
the fill's own duration is what makes that decision visible.

**The live reflow was unstable, and the fix is a settle lock, not a redesign.**
Symptoms reported: the target felt like it could flicker or jump rather than move
predictably as the pointer crossed the grid. Cause: `elementFromPoint` was being
read on every `pointermove`, including while the previous move's FLIP transition
was still sliding cards into place, so a hit test could land on a card that was
mid-flight rather than the one actually under the pointer. `flipBusyRef` now locks
out new targets for exactly `FLIP_MS` (220ms) after each one commits, so a reorder
can only happen once the last one has visually finished. This is what the user
described wanting as "aim assist" or "snapping to blocks": the fix is temporal, not
spatial. Nothing was added to snap the pointer or the layout to a grid; slowing the
rate of retargeting to match the animation was enough on its own, verified with a
script that fires pointermoves across all five cards in a group 15ms apart, far
faster than a real drag, landing on a clean, single final order rather than a
scrambled one.

**v34 Three more corrections, from one more round of actually using it.**

**The hold-fill direction was backwards.** "Top to bottom" in v33 meant the fill's
own top edge stayed put while its bottom edge grew downward, which reads as
draining, not filling. What the user wanted, and what v34 ships, is the opposite:
`clip-path: inset(100% 0 0 0)` holds it to zero height anchored at the *bottom*,
easing the top inset down to 0 as the hold completes, so the tint rises from the
floor like a level filling. Worth remembering for the next person who reaches for
`inset()` on a vertical reveal: the edge you name first is the one that stays
fixed, not the one revealing.

**The drag had a dead zone, and the fix is a bigger effective hitbox, not a
different gesture.** Reported precisely: with three HQs, dragging the third over
the first and second worked, but hovering the *gap* between two cards snapped the
dragged item back to its original spot. Cause: targeting went through
`document.elementFromPoint`, and the grid's own `gap` between cards belongs to no
card, so a point over it resolved to nothing and the group fell back to its
unmoved order. Fixed by dropping point-hit-testing entirely: `alvoMaisProximo`
compares the pointer to every card's centre in the group and picks the nearest
one, which means literally every point over the group, gaps included, resolves to
some card. This is the "aim assist" the user asked for, and it turned out to need
no snapping, no blocks, and no separate hitbox size for drag versus click — a
click's own hit target is completely untouched, since this comparison only runs
inside the pointermove handler that's already gated to an active drag.

**A cover is an `<img>`, and browsers make images natively draggable.** Pressing
and holding on the picture rather than the card's edge let the browser's own
"drag this image out" gesture start, which fights the app's pointer-based reorder
for the same mousedown-and-move: the fill would run, but the actual drag never
followed the finger. `draggable={false}` on the `<img>` in `CoverArt`, plus
`-webkit-user-drag: none` on `.cover img` for engines that need the vendor
property too, and neither has any other effect since covers were never meant to
be dragged out of the page in the first place. `test-render.mjs` now asserts a
real cover renders `draggable="false"`, so this can't silently regress.

**v35 The v34 hitbox fix had its own bug: the dragged card was competing with
itself.** Reported precisely again: moving the mouse made the dragged HQ flicker
between its original spot and wherever the pointer was, but holding the mouse
still always settled cleanly on one or the other, never in between. That shape
of bug is a tell: something alternates between two branches on each event rather
than drifting, which pointed straight at `alvoMaisProximo`. It compared the
pointer to every card's centre in the group, and that included the dragged card
itself, which by then usually sits wherever it was last dropped, right under the
pointer. Once the dragged card was the nearest thing to the pointer, it "won" the
comparison, `overId` became the dragged id, and `ordemPreVisualizacao` treats
`overId === draggedId` as its explicit signal to fall back to the base order (that
branch exists on purpose, for the moment right after arming, before the first
real move). Every ordinary small movement could tip the nearest card back and
forth between the dragged one and a real neighbour, so the preview alternated
between "unmoved" and "moved" in lockstep with mouse noise, and went still the
instant the pointer stopped because whichever branch it landed on stayed put.
Fixed by excluding the dragged card from its own candidacy in
`alvoMaisProximo`: it is never a valid target for itself, and there is no case
where "drop it here" should mean "here" is where it already is. Verified with a
five-step scripted drag across a five-card group, real waits between steps past
`FLIP_MS`, logging the full order at each step: the dragged card's index moved
4 → 2 → 1 → 0 with no step back at 4 (its start) in between, where the old code
would show it.

**v36 The v35 exclusion fixed the flicker and broke something else: the drag
could no longer return to where it started.** Reported precisely: mid-gesture,
having moved a HQ toward the middle, dragging it back could not restore its
original spot. Root cause was the model underneath the whole feature, not the
exclusion itself. `ordemPreVisualizacao` always computed one move relative to the
*persisted* order (`lib.volumes`, untouched until drop), taking the dragged id and
an `overId` and splicing purely against that fixed base — so the only way to ever
see the true unmoved order was `overId === draggedId`, the exact case v35 had to
exclude to stop the flicker. Excluding it was correct; the model that made it the
only path back to "unmoved" was the actual bug. Replaced with what a sortable list
actually needs: `dragVisual` now carries the live order itself (`ids`), seeded
from the base order at arm time and updated by moving the dragged id to its new
target's *current* index in that same live array on every valid retarget, not
recomputed from the base each time. Dragging back through the same cards now
walks the array back the way it came, same as it would in Trello or Notion, and
returning to the start is just one more ordinary move rather than a special case
requiring the id excluded in v35. The commit on drop changed to match: it persists
`dragVisual.ids` directly, since that is already the exact order the user watched
build up, instead of recomputing a fresh single move against the stale persisted
order.

**The same report also asked for a bigger hitbox on the dragged card itself.**
Moving the pointer only slightly, while still plainly over the card being
dragged, was enough to retarget it — because the first cut judged purely by
distance to each card's centre, and a neighbour's centre can be fractionally
closer than the dragged card's own centre well before the pointer has actually
left it. `alvoParaMover` now checks containment first: while the pointer is
inside the dragged card's own current box, nothing retargets, matching what the
user described wanting ("mudar quando minha tendência de movimento está fora do
card que estou movendo"). Only once the pointer has actually left that box does
it fall through to nearest-centre-of-everything-else, which still covers the
grid's gaps the way v34 fixed.

**A latent bug in the FLIP release step, found while chasing the above, not
caused by it.** The transform that eases a card into its new slot was cleared
by a single `requestAnimationFrame` callback with nothing backing it up; a tab
that isn't actively painting (found while testing in an automated background
tab, not in normal use) can go a long time without a rAF turn, and a card whose
clear never ran would carry a stale `transform` into whatever the *next* drag
measured as its starting rect. `flipCleanupRef` now also arms a plain
`setTimeout` past `FLIP_MS` that force-clears the same transform; a healthy rAF
wins the race every time in normal use, so this is pure insurance, not a
behaviour change.

**v37 A drag could get stuck armed forever if the button came up somewhere with
no HQ under it.** Reported precisely: release outside any card and the HQ keeps
looking picked up, with no way out short of clicking again. The card's own
`onPointerUp`/`onPointerCancel` are the only place the drag ever ended, and
`setPointerCapture` is what is supposed to keep the button-up routed to that
card regardless of where the cursor actually is when it comes up. Measured
directly (with a script that checks `el.hasPointerCapture` right after calling
it): capture was not reliably held through the gesture, and once it wasn't, a
release over anything without a `.vol` handler — blank page, another section,
outside the window entirely — never reached code that could end the drag.
Rather than chase why capture didn't hold, added a second, independent way out:
a `window`-level `pointerup`/`pointercancel` listener (capture phase, so nothing
in between can swallow it first) plus a `blur` listener for the case of the
window itself losing focus mid-drag, live only while a drag is actually armed.
Both paths funnel into the same `finalizarDrag`, guarded so a second call (the
card's own handler and the window one can legitimately both fire for one
release) is a harmless no-op rather than a double commit. Verified by dragging,
releasing over a blank area of the page with nothing draggable under it, and
confirming the card lets go on its own — previously it needed a second, unrelated
click to shake loose.

**v38 The dragged card wiggles, the second animation in the app allowed to loop.**
Asked for explicitly, to make the one card that is actually being moved
unmistakable while the FLIP slide moves everything else around it: a small,
unhurried rotation, ±1.5deg over 320ms ease-in-out, on top of the lift that was
already there. Kept deliberately subtle rather than the snappier, wider iOS
"jiggle mode" it's modeled on, since the user asked for something that reads as
"picked up", not alarmed. Declared inside `prefers-reduced-motion: no-preference`
rather than merely shortened under `reduce`, the same pattern the skeleton pulse
and the stagger mount already use, so it is simply absent for anyone who asked
for less motion (the existing `transform: none !important` on this selector
under `reduce` already covered it, but the animation is now also gated at the
source rather than relying only on that override). See the loop count note
above the Motion table: this is the second and, by that reasoning, last of its
kind for now.

**v39-v42 The hold-fill grows a wave, over four passes.** Two requests, both
from the HoldButton component the user supplied: the fill should stay up until
the button is released rather than emptying the instant the hold completes, and
its rising edge should ripple instead of being a flat line. The release half
landed first time and was never touched again. The wave took four.

The fill is now driven by one number, `--hold-p`, written to the card's
`.cover` every frame by `driveHold`'s own rAF loop, exactly the way HoldButton
drives `--hb-p`. A CSS transition could not do it: the crest needs the same
progress value the fill's own `clip-path` is using *that frame*, both to sit on
the rising edge and to have scrolled out of view by the time the fill is full.
Two transitions on two elements drift by a frame or two against each other; one
shared number cannot. Releasing runs the same loop backwards, which is what
makes "stays until you let go" a property of the mechanism rather than a
special case.

What the four passes were actually about, since none of them was the mechanism:

- The first read as a static ornament, because a CSS transition on the
  `mask-position` shorthand cannot give scroll and vanish-at-full at once.
  Replaced by the `--hold-p` loop above.
- The second read as "a more opaque bar, not a wave". Cause: the crest was
  painted at 55% while the fill was at 32%, so the eye saw a translucent stripe
  lying ON the fill instead of a wavy colour boundary. HoldButton paints both
  layers the identical `--hb-fill`; the wave is meant to be visible only as the
  SHAPE of where one colour ends. Matched to 32% and the amplitude raised from
  9px to 20px.
- The third read as "ondas fixas, como uma função seno". Cause: two tight,
  sharp-cornered humps per tile. Replaced with one broad hump whose bezier
  handles are level with its apex, so the crest rounds over instead of coming
  to a point. The user then judged the first attempt at this too sparse and
  asked for half the original count rather than a quarter, which is where it
  sits: one hump per tile at the original 0.55-of-card tile width.
- The fourth was the one real bug, and the user diagnosed it before the code
  did: a band under the wave that was visibly more opaque. **The 0.75/0.25
  amplitude split in HoldButton's own fill formula puts the fill's edge at
  `tileBottom - 5px`**, and the crest paints from its wave line all the way down
  to that tile bottom, so five pixels always had both layers painting the same
  32% colour on the same pixel, compositing to about 54%. At HoldButton's small
  default amplitude that is invisible; at 20px it is a stripe. The fix is to
  make the two boundaries the same line: the fill's inset is now plainly
  `(1 - p) * (100% + 20px)`, which is the same expression as the crest's tile
  bottom. Verified at eight progress values in Chrome: overlap 0.000px at every
  one.

One more correction after that: the wave looked frozen. Halving the crests per
tile had also halved the apparent travel, leaving 0.74 of a single crest over a
450ms press while the fill climbed the cover's whole height. `--hold-cycles` is
now counted in crests per second rather than in card widths, and the tile width
is defined once as `--hold-tile` so the two properties that need it cannot
drift apart again.

**v39-v43 The band's tabs move elastically, and one stutter had three separate
causes.** The user asked for the rubber-band feel of the RubberSegment
component, click only, and chose gsap (already a dependency) over adding
motion. The band's three buttons stopped each carrying their own background;
one shared pill now slides under the active one. Each cause below was found
only after shipping a fix for the previous one, which is worth recording
because each looked like the whole answer at the time:

1. **Nothing moved at all.** `TABS` was a literal declared inside the App
   component, so every unrelated re-render produced a new array identity,
   re-fired SegmentedTabs' mount effect, and `gsap.set` stomped the tween in
   flight. Hoisted to module scope.
2. **The pill lagged, worse the longer the jump.** It was animating `width`,
   which forces a layout reflow on every frame. Replaced by a full-width pill
   that never moves or resizes, revealed by an animated `clip-path`.
3. **It still froze mid-flight, and only between HQs and Séries.** Not
   performance: `pintarClip` clamps with `Math.max(0, ...)`, and the elastic
   ease overshoots in proportion to the distance. Simulated against the band's
   real geometry, HQs to Séries overshot 26px past the right wall and sat
   pinned there for **8 of the tween's ~31 frames**. Adjacent jumps overshoot
   into a neighbouring button and never reach a wall, which is exactly why they
   looked fine. Fixed by splitting the tween in two: the edge leading the move
   runs a plain `power3.out`, and the elastic goes on the **trailing** edge,
   which can only ever overshoot into the pill's own span and so stays inside
   the track at any distance. Amplitude dropped to 0.6 because with the bounce
   living in the trailing edge it shows as the pill's width wobbling, and at
   full amplitude the far jumps squeezed it to little over half its settled
   width. Zero clamped frames on all six transitions afterwards.
4. **And it still froze.** The `ResizeObserver` on the track called
   `posicionarSemAnimar()`, which kills tweens and snaps the pill to its
   destination. Opening a tab changes the page height, so the scrollbar appears
   or goes, so the band is re-measured, mid-tween, a few frames after the
   click. Now a resize that did not change the track's width is ignored
   outright, and one that did re-aims the running tween instead of cutting it.

**v43-v44 The hover gets a pre-selection that travels.** A second, fainter pill
running the identical clip-path mechanism on its own pair of edges, sliding
between buttons as the pointer moves. It appears in place when the pointer
enters the band and only travels between buttons: sliding in from wherever it
was last left would read as an object flying in from a tab the pointer never
touched. It paints under the real pill, so hovering the open tab hides it
beneath the opaque one and the travel never needs a special case at the active
button. Plain `power3.out` at 0.26s, not elastic: it is chasing a pointer that
may already be elsewhere, and a second bouncing pill beside the real one is
noise. Not drawn at all under `hover: none`.

v44 then removed the older hover effect, which had become a second answer to
the same gesture in a different shape. Only its background went; the label
still brightens, and still from the button's own rule, because the pill is one
element sliding between buttons with no way to reach inside whichever one it is
over. The existing 120ms colour transition keeps the label from snapping ahead
of the pill arriving.

**v45 The séries run bar gets capsule ends.** Asked for after the user saw a
rectangular bar and wanted the first and last segments rounded. The radius goes
on the strip with `overflow: hidden`, not on the first and last segment: a
segment of a 60-issue run is about 5px wide, and a radius wider than the box it
sits on is scaled down to fit, so rounding the segments would give a full cap
on a one-issue series and a nub on a thousand-issue one. Clipping the whole
strip cuts the same semicircle at either end whatever the run length. `999px`
rather than `7px` so it stays a true semicircle if the bar's height changes.

This came out of a question about replacing the bar's 60 elements with a single
`linear-gradient`. Measured on the user's own machine at their real library
size (41 series, 3948 issues): 2501 DOM nodes and 3.40ms against 41 nodes and
1.50ms. **A 1.9ms saving, about a ninth of one frame at 60fps, for a bar that
loses its per-segment rounding.** Not worth it, and not done. The comparison was
published as a throwaway artifact that measures both in the reader's own
browser, which is the second time that format settled a trade-off in one reply.

**v46-v47 Every animation on the page stuttered, and it was the lattice.** The
report that cracked it was that the cursor lattice, the hover pill and the tab
pill all stalled *together*, and only around the séries tab. Animations
stalling in unison is one expensive thing per frame on the main thread, not
each animation's own code.

Ruled out first, all measured rather than argued: the tab switch itself
(8.7ms), the DOM size (1613 elements), the run bars (3.4ms), and a 9x
difference in full-page layout cost, which the user correctly rejected on the
grounds that 3.6ms is not perceptible. That rejection is what forced the
measurement that found it, because `void el.offsetHeight` times style and
layout only and stops exactly where the real cost begins.

**`.cursor-grid` was `position: absolute` from the top of `.content` to its
bottom, and its canvas is `width/height: 100%`.** Since the canvas is cleared
and redrawn whole on every frame the cursor moves, the page's height *was* the
per-frame cost. On the short tabs that is 789px and 3 megapixels; on séries it
is 6799px and 25.9 megapixels. Timed with a forced `getImageData` readback so
the queued canvas commands actually complete inside the measurement: **4.0ms
per frame against 122.2ms**, which is about 8fps, and on the same thread every
other animation in the app.

Fixed by making the box `position: fixed` at window height. Nothing below the
fold was ever visible. No JavaScript changed: the pointer maths already works
off the canvas's own `getBoundingClientRect()` against viewport coordinates,
which a fixed box gives correctly. The lattice no longer scrolls with the page,
which for a uniform grid whose lit cells follow the cursor is close to
imperceptible.

v46 is the diagnostic step and is worth keeping as a method. The user was asked
to paste a snippet into the console and replied "como eu faço isso, colo no
cmd?". The console is friction, and inside an artifact's frame it is worse. What
replaced it was a small temporary panel published into the app itself, two
checkboxes each disabling one suspect, answered conclusively by feel on the
first try with nothing to copy back. It lived isolated at the end of
`src/index.html`, touched no React, and was deleted in the same version that
shipped the fix.

**v48 Falta pouco is ordered, not shuffled.** The hub still draws three series
at random from everything past 50%, because the point of that panel is to
surface something forgotten rather than to rank the collection. Among those
three it now reads most complete first, ties broken alphabetically.

The ratios are compared by cross-multiplication, `b.owned * a.total - a.owned *
b.total`, rather than by dividing each out. Two genuinely equal fractions with
different denominators are not reliably equal once they are floats, and an
undetected tie would hand the order back to the draw instead of to the
alphabet. Integers multiplied out are exact, so a tie is a real tie. Checked
against 1/3 against 2/6 against 3/9, and the alphabetical fallback uses
`localeCompare` with `pt-BR` so accented titles sort where a reader expects.

**v49 The séries tab folds by character, and opens folded.** Asked for after the
tab had grown past fifty rows: each character heading gets a chevron, and the
tab now opens as an index of characters with counts rather than a list several
thousand pixels long. On this library it is 6949px against 1782px.

Folded is the default on a fresh visit, and which characters are open is kept in
`sessionStorage` under `longbox:series-abertas`, deliberately the same mechanism
and the same reasoning as the tab note above it: a reload keeps what you had
open, closing the browser tab throws the note away. The set stores the names that
are OPEN, so a character catalogued later is closed like everything else without
having to be listed anywhere. A malformed value falls back to "all closed", the
same way the tab note falls back to the hub.

Three decisions worth keeping:

- **A search opens every group that matched, and writes nothing.** The séries tab
  is filtered by the global query, so with everything folded a search would have
  shown only headings and counts. The fold state is read through one helper that
  answers true while a query exists, so the user's own choices are overridden
  rather than overwritten, and clearing the field puts the list back exactly as
  they left it. The fold-all control is hidden while searching, since with
  everything already forced open it would either look broken or silently rewrite
  a state whose effect is invisible.
- **`GroupHead` is shared with the HQs shelf, so folding is opt-in.** The prop
  that supplies the toggle is what makes a heading collapsible; HQs does not pass
  it and is untouched. HQs is a wall of covers, which is that tab's whole point.
- **The fold-all button sits at the head of the chevrons' own column, not in the
  band.** The user suggested the band, opposite the publisher logo. The band is
  chrome shared by all three tabs: a control that appears only on this one would
  change the band's width on every tab switch, re-measuring the element whose
  pill animation depends on that width holding still (v43). Right-aligned above
  the list, it lines up with the controls it governs, which reads as authority
  over them in a way the band could not express.

**v49 also found that v44 and v47 had shipped with four red assertions.** Not
new breakage: they were assertions whose intent still held but whose mechanism
had moved. Three checked the band's old per-button hover background, removed in
v44 when the travelling pill replaced it; one checked that the lattice reached
the mobile tab bar through a negative `bottom` on `--app-pad-b`, changed in v47
when it was pinned to the window. All four were rewritten against the new
mechanism rather than deleted, and the hover one now also asserts that the old
background has not come back. The process failure that hid them is written up
under Testing.

**v50-v53, the segmented-tab focus ring: three rounds before it was right.**
Reported by the user from a screenshot of the real published page, not caught
by `test-render.mjs` (JSDOM has no layout) or by an earlier local check that
used a font-less harness page and never reproduced the mismatch.

- **v50** treated it as the global `:focus-visible { outline-offset: 2px }`
  rule floating the ring outside `.seg-thumb`'s edge, since both share the
  same accent colour and the offset read as an unfilled gap. Fix:
  `.segmented button:focus-visible { outline-offset: 0; }`, scoped to these
  buttons only. Verified locally (flush, no gap) and shipped — wrongly
  confident, on a harness that turned out not to reproduce the real bug at
  all (see below).
- **v51** was the user pushing back with a second screenshot: the gap was
  still there, but reshaped — smaller vertically, bigger horizontally. Real
  cause, found by reading `SegmentedTabs` in `app.jsx`: `.seg-thumb`'s
  clip-path had **always** used a hardcoded `inset(0 … 0 …)` for top/bottom —
  no vertical clip at all — so the pill spanned the track's full padding-box
  height, not the button's own, on every version back to whenever the pill
  was introduced. The outline, correctly sized to the real (shorter) button,
  read as undersized against it. Fixed by measuring each button's top/bottom
  edges the same way left/right already were (`edgesDoBotao`) and clipping to
  them. Measured this time with `javascript_tool` against the real DOM, not
  eyeballed — but only horizontally at first; a second, smaller bug survived:
  `pintarEm` computed the track's size via `clientWidth`/`clientHeight`
  (content+padding, excludes the 1px border) while the button edges came from
  `getBoundingClientRect()` (includes it) — two different rulers, ~1-2px off
  on every side. Caught in the same pass by comparing the derived pill box to
  `btn.getBoundingClientRect()` directly and finding the diff nonzero;
  switched both to `getBoundingClientRect()`.
- **v52** was the user, having watched the pill shrink to fit the button
  across v50-51, asking to invert it: keep the pill's original (taller) size
  and grow the button to fill it, rather than shrinking the pill to the
  button. Better fix — one box, not two kept in sync. `.ed-segmented`'s
  vertical padding moved onto the button's own `height` (was `padding: 4px`
  + `height: 38px` = 48px total; became `padding: 0 4px` + `height: 46px`,
  same 48px total, all of it now on the button). First attempt left the
  button's height unset, expecting flex's `align-items: stretch` to fill the
  track automatically — it does, but only once the track's own height is
  already decided, and with nothing forcing that height any more the track
  collapsed to the button's intrinsic content size, ~14px shorter overall.
  The explicit height stayed required; only where it lived moved from the
  track's padding to the button.
- **v53**: with the geometry finally exact (sub-thousandth-pixel, measured),
  the user decided the ring was redundant anyway — the pill already says
  which tab is open, and a second highlight on top of it read as noise even
  flush. `.segmented button:focus-visible { outline: none; }`. Trade-off
  accepted deliberately: a keyboard user tabbing to a *non-active* button now
  has no landing cue at all (the pill only marks the open tab, not focus),
  since the two coincide only when focus happens to land on the active one.
  The global `:focus-visible` ring elsewhere in the app is untouched.

The harness gap worth remembering from v50: a local shim page built without
the project's Google Fonts import did not reproduce a real geometry bug that
the published artifact showed immediately. Font metrics change button
intrinsic sizing; measure against a harness that loads the same fonts, or
against the live artifact itself, before trusting a "fixed, verified locally"
claim on anything layout-shaped.

**v54: an edição tile in a volume's "Edições coletadas" now jumps to that
edição's série card.** Each tile there was inert (`<span>`); it is now a
`<button>` (only when its série still exists — "Série removida" stays inert,
since there is nowhere to link to) that closes the volume sheet, switches to
the séries tab, opens that série, and selects that exact edição — reusing
the same state already wired for clicking a faixa row inside the séries tab
itself (`switchTab`, `setOpenSerieId`, `setOpenSerieContexto(null)`,
`setSelectedEdicaoId`), so no new state was added. Deliberately opens
**unfiltered** (`openSerieContexto` stays `null`) rather than scoped to the
faixa containing that number: the séries tab's own faixa filter exists for
grouping by personagem, not for this jump, and filtering here risked hiding
the very edição being pointed at if a série's faixas do not evenly tile its
run. The clicked edição lands selected regardless of which `<details>`
bucket it falls in, since the "selecionada" panel at the sheet's foot reads
off `selectedId` directly and does not depend on the bucket being open.

Verified in a from-scratch JSDOM harness (`test-render.mjs`'s own shape,
not the checked-in suite) rather than by hand: seeded one série, one volume
collecting two of its edições, clicked the tile for edição nº 1, and
asserted on the resulting DOM — landed on the séries tab, exactly one open
`.sheet` (`data-out="false"`), that sheet is the right série, and its
`.edicao-pinned` panel shows "Nº 1" and lists the volume that owns it. This
is state-wiring, not geometry, so the cross-origin/local-harness distinction
that matters for layout bugs did not apply; JSDOM was sufficient.

**Superseded within the same day by v55, below** — the tab switch and the
volume sheet closing were not what the user meant by "abrir o card da série
com a edição que eu cliquei". A clarifying question up front would have
caught this before building; asked one before v55 instead.

**v55: the série card opens stacked on top of the volume sheet instead of
replacing it.** `abrirEdicaoNaSerie` no longer calls `switchTab` or closes
the volume sheet — it only sets `openSerieId`/`setOpenSerieContexto(null)`/
`setSelectedEdicaoId`, so both sheets are mounted at once and the active tab
never changes. `Sheet` gained a `recede` prop for exactly this case (one
sheet stacked on another): the receded sheet skips its own `.scrim` (the
front sheet's scrim already dims the page; two scrims would double-dim it),
stops listening for Escape (`useEscape(mounted && !recede, onClose)` — two
sheets both closing on one Escape press was caught before shipping, not
after), and goes `pointer-events: none` so its now-covered controls cannot
be clicked through the gap. Visually it scales to 0.96 and shifts back
14px (`translateY` on the mobile bottom sheet, `translateX` on the desktop
side panel) with `filter: brightness(0.72) saturate(0.9)`, overriding the
plain open-state transform by selector specificity
(`.sheet[data-in="true"][data-behind="true"]` beats
`.sheet[data-in="true"]`), no `!important` needed. `VolumeSheet` is given
`recede={!!openSerieId}` from the app root — general by construction (any
sheet opened on top of the volume sheet recedes it), not special-cased to
this one entry point. `prefers-reduced-motion: reduce` already forces
`.sheet` transform to `none`; the recede state still dims via `filter`
there, just without the scale/shift, which is the same fallback shape the
rest of the app already uses. Closing the série sheet leaves the volume
sheet exactly as it was — same scroll position, same open "Edições
coletadas" state, nothing remounted.

Verified the same way as v54, extended: after the click, asserts two
`.sheet[data-out="false"]` exist, the série one has `data-behind="false"`
and the volume one has `data-behind="true"`, and only one live `.scrim`
(catches the double-dim bug before it ships). Then closes the série sheet
and asserts exactly one sheet remains, it is the volume sheet with
`data-behind` back to `"false"`, and the tab never left "volumes" at any
point in the sequence.

**v56: the receded sheet from v55 is now genuinely non-interactive, not
just visually so.** `pointer-events: none` blocks the mouse but does
nothing for Tab or a screen reader, so the volume sheet's fields and
buttons stayed reachable underneath the série sheet. Added `inert` to the
receded `.sheet` div, which removes it from both the focus order and the
accessibility tree in one attribute. **React 18.3.1 does not treat `inert`
as a boolean HTML attribute** — `inert={true}` renders nothing on the DOM
at all (only a dev-console warning explains why); it wants the empty
string, `inert={recede ? "" : undefined}`. Caught by asserting
`hasAttribute("inert")` in the same JSDOM harness as v55, not by reading
the warning — the harness discards `console.warn` into a separate bucket
from `console.error`, so this would have shipped silently without an
attribute-presence check written specifically for it.

**v57: the HQs tab's character groups fold, mirroring the séries tab's own
fold with the default deliberately reversed.** `GroupHead` already made a
group collapsible via its `onAlternar` prop; only the séries tab ever passed
it, so the HQs shelf stayed permanently expanded. Now both do, each with its
own `sessionStorage` key and its own single-button "Mostrar todas/Esconder
todas" toggle (renamed the shared `.series-fold-all` CSS class to `.fold-all`
since it is no longer séries-only).

The séries key (`longbox:series-abertas`) stores which groups are **open**,
so an empty first-visit set reads as "everything closed" — right for a
reference list you scan, not read top to bottom. The HQs key
(`longbox:hqs-fechadas`) stores the opposite — which groups are **closed** —
so an empty first-visit set reads as "everything open," right for a shelf of
covers, which is the whole point of that tab. Same storage shape, same
per-session lifetime (a reload keeps what you folded, closing the tab
forgets it), opposite polarity chosen specifically so neither tab needs a
first-visit flag: the empty set already means the tab's own default.

Verified past what the DOM assertions show: a JSDOM harness that folds a
character, reads the raw `sessionStorage` value, remounts a **second** JSDOM
instance with that same value seeded in before the app boots (a real reload
keeps `sessionStorage`; JSDOM instances don't share it, so this is the only
way to actually simulate one), and confirms the fold survived — then mounts
a **third**, storage-empty instance and confirms it opens fully. Asserting
against one mount's DOM after a click proves the click worked; it does not
prove persistence, which is the entire feature here.

**v58 (reverted at v59): `body { zoom: 90% }`, tried because the user said
the app looks better at the browser's own 90% zoom than at 100%.** Shipped as
a pure CSS change (no `app.jsx`/`dist/app.js` rebuild needed) after
`test-render.mjs` passed clean. The user tried it live in the real app and
some visual elements broke — not diagnosed further, since they preferred
reverting and zooming the browser out themselves over debugging each one.

**v59: reverted v58 outright**, removing the `zoom: 90%` line. `body {
zoom: N% }` is not a safe stand-in for the browser's own zoom on this app —
JSDOM's layout-blind test suite passed both times, which only confirms it
can't catch this class of bug (consistent with the "what it cannot see is
layout" limitation already documented above). If a "shrink everything"
request comes back, ask which elements looked wrong at 90% first rather than
retrying `zoom` blind.

**v60: the Coleções strip gets its own scrollbar, a row of spines.** The user
found the strip showing Chrome's default bar. The styled one was always in the
CSS and never rendered: the rule set `scrollbar-width: thin` next to the
`::-webkit-scrollbar` rules, and from Chrome 121 on, setting either standard
property makes Chrome skip every `::-webkit-scrollbar` rule. The native bar is
now hidden (`scrollbar-width: none`), and `ShelfBar` stands in for it.

Chosen through a throwaway comparison artifact in four rounds (a thin native
line, a run-bar capsule, one spine per volume, no bar with arrows; then counter
fonts; then spines sized by edições and a reading-status run). What won: short
spines at the logo's rhythm (5px, 6px gap, the logo's irregular heights)
repeated across the **whole width**, so a small collection does not get a short
bar, with a lit window in the accent over the stretch on screen. The spines mean
nothing individually; one spine per volume was dropped precisely because it made
the bar as short as the collection. Dragging the window is the point (precision
was the stated priority): snap is switched off on the strip while dragging and
restored on release, a click outside the window jumps there, arrow keys page by
80% of the strip. A strip that fits on screen shows no bar; `.shelf-bar[hidden]`
is spelled out because the row's own `display: flex` otherwise beats the
attribute (caught in the served harness, where the host's `[hidden]` reset is
absent).

The counter reads `04 a 09 de 14`. The user asked for zero-padding once a
collection reaches 10, so the bar does not narrow when the range crosses from one
digit to two; generalised to padding to the total's own digit count. Geist with
`tabular-nums`, since without it 11 and 18 differ in width too. It says "a", not
an en dash, because of the dash ban in the pre-flight; the mockup had used the
dash. A mono counter was rejected by the user as reading AI-generated.

The lit spines slide by `transform` alone: the window clips a second copy of the
row, translated back by the window's own offset. Widths are read unrounded
(`getBoundingClientRect`): `clientWidth` rounded a 1413.5px track and left the
lit copy 0.23px off the row under it and the window 0.49px past the end at full
scroll. Measured in the served harness: a 130px drag over 261px of room scrolled
202 of 406, it clamps at both ends, snap is off during and back after, releasing
on the window ends the drag, and clicks at each end request 406 and 0. The smooth
jump itself could not be watched there, since the automated tab was hidden and
Chrome does not advance smooth scrolling in a hidden tab.

Also fixed: `test-boot.mjs` had been failing since v57, still looking for
`.series-fold-all` after the rename to `.fold-all`; rewritten against the new
name with a check that the old one has not returned.

**v61: a character filter replaces the publisher one, and the HQs filters
survive a reload.** Two requests from the user in one pass.

The filter panel's third select filtered by editora, which the publisher band
already does from outside the panel. It is now `PersonagemFiltro`, a field you
type into: focusing it opens a list with "Todos os personagens" first and every
character under the band's current publisher after it, alphabetical, each with
its group swatch and how many HQs it has. Typing narrows the list, accent- and
case-blind (`dobrar`, so "atomo" finds "Capitão Átomo"). Arrows, Enter, Escape
and outside-click follow `SearchBox`, and the dropdown reuses its `.sug` styles.
Decisions, confirmed with the user where they were open:

- The list holds only characters under the band's current publisher (user's
  choice). When the band changes to a publisher the chosen character has nothing
  under, the filter lets go instead of leaving an empty shelf with no visible
  reason. That check waits for the library to load, or every restored choice
  would look missing against the empty pre-load library and be thrown away.
- Choosing a character forces its group open, the way a search already does.
- Drag-reorder stays available under the character filter, unlike status and
  tipo: this filter hides whole groups, never part of one, so the group being
  reordered is always complete.

**Persistence.** Status, tipo and personagem are kept under
`longbox:filtros-hqs` in `sessionStorage`, the same lifetime as the tab note and
the fold keys: a reload keeps them, a fresh visit starts with none. Switching
tabs or going to the hub never lost them (they live in the app root's state);
only a reload did. The key is removed rather than written when no filter is set,
and a stored value the app no longer offers falls back to "all". The publisher
band is deliberately left out: it is saved in the database, so it also survives
a fresh visit and follows the user between devices, which the user chose to keep.

**The dropdown opened under the shelf in the real browser**, which JSDOM could
not show. With the cursor lattice on, every child of `.content` is its own layer
at `z-index: 1`, so the groups after the filter row painted over its list; with
the lattice off, the sticky group headers sit at 10. The row (`.filtros-hqs`) now
sits at 12, above both and under the top bar's 20. Verified with
`elementFromPoint` at the centre of every option.

`test-filtros.mjs` (31 checks, exits non-zero on failure) mounts five times: one
walk through typing, Escape, Enter, a folded group opening, the status filter
still combining, storage written and `localStorage` untouched, and the filters
surviving a trip to another tab and the hub; a second mount given the first
one's `sessionStorage` (a reload); a third with none (a fresh visit); a fourth
where the band's publisher excludes the saved character; a fifth with corrupt
JSON in the key. The reload was also checked in real Chrome in the served
harness.

**v62: three follow-ups to v61 from the user.**

- **The character list is as wide as its field.** v61 anchored it right with a
  240px floor, which on a desktop made it visibly narrower than the field it
  drops from. It now spans the field exactly (measured: both 1104.7 to 1602 in the
  harness), and only under 640px, where a third of the row cannot hold a name and
  a count, does it grow past the field, leftwards.
- **The hub keeps the filter panel as it was.** `switchTab` used to close the
  panel on the way to the hub; that line is gone, so an open panel is open again
  on return and a closed one stays closed. Its state is still not kept across a
  reload, which was not asked for.
- **The filter button shows active filters.** With the panel closed and any of
  status, tipo or personagem set, the button takes an accent outline and icon, and
  a count badge sits on its corner in either state; its label reads "Filtros, 2
  ativos". Open, it fills as it always has. The user reported that the button
  "used to" carry colour with the panel closed and asked for that back, but the
  rule (`.btn-icon[data-active="true"]`, filled only while the panel is open) is
  identical in every copy on disk back to 2026-09-14, so there was no earlier
  state to restore; the indicator is what now gives it colour with the panel
  closed. Told to the user as such.

`test-filtros.mjs` finds the button by `.btn-filtros` now, since its label carries
the count, and adds six checks: no badge without filters, the count and label with
two, the panel open and closed across a hub trip, the count kept with the panel
closed, and the count present straight after a reload (37 checks).

**v63: inner scrollbars, one look for the three filters, and the filter button
always in the accent.**

- **Inner scrollbars.** The character list and the série sheet were showing the
  operating system's bar, arrows included (user's screenshots). `.sug`,
  `.sheet-body` and `.modal-body`, the only places that scroll inside the page,
  now draw a 4px rounded line with no arrows and no track, 10px to grab, in
  `--border-strong` at rest and the accent while the pointer is over the area.
  Written only as `::-webkit-scrollbar` rules, because setting `scrollbar-width` or
  `scrollbar-color` makes Chrome 121+ skip them all (the v60 cause); Firefox gets
  the standard thin bar through `@supports not selector(::-webkit-scrollbar)`. The
  page's own scrollbar is left alone. Measured: the sheet's gutter went to 10px.
- **Status and tipo match the character filter.** Their native selects opened a
  list the operating system draws (white, blue highlight), which no stylesheet
  can reach. Both are now `OpcaoFiltro`, a select-only combobox button with the
  character filter's field and dropdown classes, minus the typing (3 statuses, 7
  types). Arrows, Enter or Space, Escape and Tab follow the ARIA select-only
  pattern. Measured in the harness: all three fields are 40.33px tall with the
  same background, border, 8px radius, 14px type and padding, and each list is
  exactly as wide as its field.
- **The filter button is always in the accent**, open or closed, with or without
  filters: the user's explicit choice after v62. The active-filter count stays on
  its corner and switched to the text colour, since an accent badge would vanish
  on an accent button. `data-filtrando` is still set, for tests and styling.

`test-filtros.mjs` drives the new status and tipo controls by click and keyboard
instead of setting a select's value (45 checks).

**v64: the publisher's colour reaches the page, the band's list is the app's
own, and one button clears the filters.**

- **The publisher's hue now reaches three things inside the page.** Until now it
  lived only on the header and the band (`[data-ed-hue]`); the content and the
  sheets kept the interface cyan. With DC that passed unnoticed (cyan is near its
  blue), but with Marvel the Coleções spine window and the new scrollbars stayed
  cyan under a red header, which the user flagged. `.app` now carries `--ed-hue`
  and `data-ed-tint` outside the hub, for a publisher with a colour, and three
  tokens hang off it: `--ed-accent` (the Coleções lit spines, scrollbar thumbs on
  hover), `--ed-rolagem` (thumbs at rest, the hue at 55%) and `--ed-borda` (the
  outline of the side sheets and of every dropdown list, the hue mixed 45% into
  `--border-strong`, so a red publisher reads as its colour without every edge
  turning into a warning; the user chose "outline of sheets and lists" over all
  borders). `--accent` itself is not redefined on `.app`, so buttons, status and
  tiles keep the interface accent, as v24 intended. On the hub, or with "Todas as
  editoras", the tokens fall back to exactly what was there before. Measured with
  a red publisher: lit spines `rgb(214, 0, 7)`, the header's own accent.
- **The band's publisher selector is `OpcaoFiltro`.** Its native select opened the
  OS-drawn list the v63 filters had just left behind. `OpcaoFiltro` grew an
  optional `todos` row (the band passes its own "Todas", whose value is not
  empty), per-option swatches (each publisher's colour, as characters carry
  theirs), and a trailing command row after a rule for "Gerenciar editoras...". The
  list is anchored right and as wide as its longest name, never narrower than
  the field. `test-render.mjs`'s publisher section drives the list instead of
  `select.value`, with every original check kept and three added.
- **"Limpar filtros"** sits under the filter row only while a filter is on, and
  resets status, tipo and personagem. It leaves the band alone, which is its own
  choice saved in the database. `.filtros-hqs` became a wrapper around the grid
  and this row, keeping the v61 z-index rule on the element that is `.content`'s
  child.

`test-filtros.mjs`: 52 checks, adding the clear button (appears, resets all three,
disappears, empties the session key) and the tint (present outside the hub for a
publisher with a colour, absent on the hub and with no colour).

**v65: the rest of the accent that ignored the publisher, and three touches
from the user's screenshots.**

- **Focus rings and focused fields follow the publisher.** v64 tinted the
  dropdown outlines, but an open filter still wore a cyan double ring: the global
  `:focus-visible` outline and the focused border of `.input`, `.select`,
  `.textarea`, `.search input` and an expanded `.pfiltro-botao` all read
  `--accent`, which inside the content is always the interface cyan. They now
  read `--ed-accent`; the list's check mark reads a new `--ed-accent-text`
  (mirroring the header's `--accent-text`), and so does the spine track's focus
  outline. With no publisher colour both tokens are the plain accent, so the hub
  is unchanged. Left on `--accent` on purpose, as state colours rather than
  outlines: the "Lendo" status button, the open volume's cover outline, an open
  série row, a selected issue tile, the hub's enter button and the cover upload
  hover.
- **The band's pill has a colour with no publisher.** With "Todas as editoras",
  "Sem editora" or a publisher saved without a colour, `.seg-thumb` fell back to
  `--surface`, a grey pill the user found colourless next to the tinted one. It
  now takes the interface accent with `--accent-ink` on the label (white does not
  read on the light cyan), and the hover wash follows at 22%.
- **"Limpar filtros" sits in the filter row** as a fourth cell, always present,
  disabled at 40% opacity when no filter is on, so the row never reflows. Under
  560px only its X shows (`label-wide`), with `aria-label` keeping the name.
  Measured: all four cells share one top and a 40px height.
- **"Todas as editoras" carries the Longbox cyan swatch** in the publisher list,
  written as `ACCENT_HEX` rather than `var(--accent)`, because inside the band
  `--accent` is the selected publisher's hue.

`test-filtros.mjs`: 53 checks; the clear-button checks now assert it is in the
row, enabled with a filter and disabled without one.

**v66: the side sheet's edge back to neutral, and two collection options in
Gerenciar.**

- **Sheet edge reverted.** v64 had put the publisher tint on the side sheet's
  left (bottom-sheet: top) border; the user preferred it as it was, so `.sheet`
  is back on `--border-strong`. The dropdown lists keep their tinted outline.
- **Reading order folds.** Its heading in the manage sheet is now a button with
  the count and a chevron. Folded ids live in `sessionStorage` under
  `longbox:ordem-recolhida` (stores the FOLDED ones, so a new collection opens),
  same lifetime as every other fold: a reload keeps it, a fresh visit opens all.
- **A collection can pick its spine bar's colour**, from the character palette
  (30 chromatic plus 3 neutrals) or "Automático", the default, which follows the
  publisher. Stored on the collection as `corBarra` (a palette spec; removed, not
  nulled, on reset); `normalizeLib` already spreads unknown collection fields, so
  no migration. `ShelfStrip` sets `--shelf-cor` on a `.shelf-wrap` around the
  strip and bar, and the lit spines read `var(--shelf-cor, var(--ed-accent))`.
- **The option shows only while that bar is on screen**, as asked. Only
  `ShelfBar` knows that, after layout, so it now reports changes through
  `onVisivel` (withdrawn on unmount) into an App-level set, `barrasVisiveis`,
  which the manage sheet reads.

`test-colecoes.mjs` (21 checks, exits non-zero on failure) stubs `scrollWidth`
and `clientWidth` per strip, since JSDOM measures every strip at 0 and no bar
would ever show: one collection overflows, one fits. It covers the fold and its
session memory across three mounts, the option appearing only for the
overflowing collection, the colour reaching the db and the bar, not leaking to
the other collection, and its removal. The db checks wait past `scheduleSave`'s
500ms debounce; read sooner, they see the previous document, which made one
check fail and would have let the removal check pass for the wrong reason.

**v67: named colours with a hover label of the app's own, and the Longbox cyan
for a collection's bar.**

- **Every swatch has a name** (Vermelho, Coral, Âmbar ... Framboesa, Vinho,
  Vermelho vivo; Preto, Cinza, Branco), in all three pickers: character,
  publisher and collection bar. Names live in `NOMES_COR`, keyed on each spec's
  own numbers (`chaveCor`), not inside the specs, because a picked spec is
  written to the database as is. The name is also the swatch's `aria-label`,
  replacing "Cor 1".
- **The hover label is the app's own, `[data-dica]`.** The user asked whether it
  could be styled; a native `title` cannot, so this is an `::after` reading
  `attr(data-dica)`, drawn below the element (above, the first row of a sheet
  clips it) on `--surface-2` with the publisher-tinted outline. It waits 250ms
  before showing so sweeping across a palette does not flicker, leaves at once,
  shows on keyboard focus too, and only exists for a fine pointer. Swatches wear
  it on a wrapper (`.dica-swatch`), since `.swatch` clips its own overflow and
  already spends `::after` on its edge stripe. The first and last column of the
  grid (6 across, 8 from 420px) align the label to their outer edge so it stays
  inside the sheet, and `.sheet-body` gained `overflow-x: hidden` so a label can
  never add a sideways scroll.
- **The filter button explains itself** the same way: "Mostrar filtros" /
  "Esconder filtros", with the active count in parentheses.
- **The Longbox cyan is a bar colour**, in the collection picker's neutral row,
  and only there: the character palette skips the band around the accent on
  purpose, so no cover edge competes with the interface. It is stored as the
  marker `{ longbox: true }` rather than a hue, so the bar reads the live
  `var(--accent)` and follows the theme.

Checked in real Chrome: hovering the first swatch showed "Vermelho" under it,
left-aligned; the filter button's label reads "Mostrar filtros" closed and
"Esconder filtros" open (its hover itself sat outside the automation's reach).
`test-colecoes.mjs`: 28 checks, adding names on all 34 bar swatches, uniqueness,
the name as accessible label, the cyan in the neutral row, stored as a marker,
read live by the bar, and marked alone.

**v68: the Longbox cyan everywhere, one gradient from the top, collections that
fold to their titles, and skeletons redrawn to the tabs as they are now.**

- **The cyan is in every picker** (character and publisher too, at the user's
  request), as the fourth entry of `PALETA_NEUTRA`. This relaxes, by choice, the
  v67 rule that characters never get it. `swatchColors` resolves the marker
  `{ longbox: true }` to `LONGBOX_HSL` (the accent's own numbers), so covers,
  group swatches and the band draw it with no special case; only a collection bar
  still reads the live `--accent`. A publisher set to cyan lends no hue to the
  chrome (`edCroma` already returns null without `h`), which is right: the
  chrome is cyan by default.
- **One gradient from the top of the page.** The publisher tint used to start at
  the band's own top edge, under a flat header, which read as a hard seam. When
  a publisher has a colour, `.app[data-ed-fundo]` hands `--ed-fundo` to both the
  header and the band, each painting its slice of one gradient sized to both
  (`--topbar-h + --edbar-h`); the band shifts its copy up by the header's
  height. Measured at 1707px: header 76.7px against `--topbar-h: 76px`, so the
  seam is under a pixel, invisible; it holds while scrolled, both being sticky.
- **Collections fold to their titles**, with a chevron beside "Gerenciar"
  (label and `data-dica` "Esconder volumes" / "Mostrar volumes") and the HQs
  tab's "Esconder todas / Mostrar todas". Same rule as HQs: sessionStorage
  `longbox:colecoes-fechadas` holds the closed ids, so a fresh visit opens
  everything and a reload keeps what was closed; a search forces all open.
  Checked in Chrome: fold, reload, still folded.
- **Skeletons match the tabs again.** HQs: fold button, then covers under
  character bands (since v57, not one flat grid). Séries: fold button over a
  column of closed bands (the tab opens folded). Coleções: head with its
  controls, strip, and a spine bar only on the long first collection. Every
  spacing was measured off the loaded tab with the db held forever (harness
  `?lento`), then matched: first cover, heads, second group within 1px. The
  group head is 52px since its chevron, which the old skeleton never followed.

`test-boot.mjs` now checks each tab's new skeleton shape and that none borrows
another's; `test-render.mjs` expects 4 neutral swatches.

**v69: the publisher gradient runs 120px past the band.** The user wanted the
fade longer. The gradient is now `--ed-grad-h` = header + band + 2px +
`--ed-cauda` (120px) tall, and `.app` paints it too: its box starts at the page
top, so header and band keep covering their slices exactly as in v68 and only
the tail below the band line shows, fading out in the page. The lattice canvas
is cleared transparent each frame, so the tail reads through it. On scroll the
tail leaves with the content while header and band keep their slices, which is
seamless because the band's coloured bottom line already separates the two.
Longer or shorter is one number: `--ed-cauda`.

**v70: "Todas as editoras" gets a band too, in the Longbox cyan.** Until now
the band and the top gradient only existed for a publisher with a colour, so
the default view was the one flat one. `EditoraBar` and `edFundo` now resolve
Todas (and a stale publisher id, which already reads as Todas) to
`swatchColors(COR_LONGBOX)`: cyan bottom line, cyan gradient from the page top
with the v69 tail. "Sem editora" stays untinted. `edCroma` is untouched, so the
chrome keeps the plain accent, which is the same cyan. Checked in Chrome (dark):
band tinted, line `rgb(0,186,214)`.

**v71: the band gradient no longer leaks into the grid.** v69 read "increase the
gradient's distance" as a tail running 120px past the band into the page; the
user saw it as the gradient leaking into the grid and did not want it. The tail
and `.app`'s own background are gone: the gradient is again exactly header +
band tall. The "distance" is now in the stops, in `--ed-grad`: 55% of the
publisher colour at the top, 38% at 55% of the way, and still 18% at the band
line, where v68 had already faded to plain `--bg`. The coloured band line is the
edge; below it the grid is flat. Lesson: on this app, "the band" ends at its
line, and anything past it is the grid.

**v72: the band gradient fades to almost nothing at the band line.** v71's 18%
at the line read as too much. Stops now 55% at the top, 30% halfway, 7% at 85%,
2% at the line: practically flat where band meets grid, with the extra stop
keeping the last stretch smooth rather than a straight run down.

**v73: search suggestions follow the tab you are on.** Before, the dropdown was
always the 8 best volumes. Now:

- **HQs** (and anywhere that is not Coleções or Séries): the 8 best volumes, as
  before, with no headings.
- **Coleções / Séries**: the 4 best of that tab under a "Coleções" or "Séries"
  label, then the 4 best volumes under "HQs".
- **Nothing in the tab matches**: only the 4 best volumes (not 8), still
  labelled "HQs" so it is clear they are not the tab's own.

Matching mirrors each tab's own filter: a collection by name, a série by name or
character. Ranking is the volumes' rule via `ordenarPorNome`: name starts with
the term, then contains it, then the secondary text (a série's characters).
Like the volumes, tab results ignore the publisher filter. Suggestions are now
objects `{ tipo, chave, id, titulo, meta, secao }` so one keyboard-navigable
list can hold mixed kinds; `chave` is prefixed by kind so ids never collide.
Picking a collection opens its sheet, a série opens its card (context cleared,
as a row click does), a volume behaves as before. Collections and séries have
no cover, so they get the tab's own icon on a cover-sized tile, keeping titles
aligned with the HQ rows. Série meta: characters, years, owned "x de y".

A bug the real browser caught and JSDOM could not: `.search svg` positioned
every svg inside the search box as the magnifier, so the new list icons were
drawn outside their tiles. Scoped to `.search-field > svg`.

`test-render.mjs` covers: HQs tab has no headings, Séries lists the série
first then HQs with headings "Séries|HQs" and at most 4 each, Enter on a série
opens it and stays on Séries, Coleções lists the collection, and no tab match
gives at most 4 HQs only.

**v74: thinner character stripe on search thumbnails.** The cover's 3px
`::after` stripe is fine on the shelf but a tenth of the 30px search thumbnail,
where the user saw it eating the art. `.sug-cover.cover::after` is 1.5px; the
shelf is unchanged.

**v75: the reading status in words, beside the format.** The user asked for
another way to show Lida / Lendo than the 3px bottom bar, which spoke by colour
alone (and whose Lendo cyan now also names a palette colour). Of four options
(a corner seal, faded read covers, text in the caption, a corner ribbon, the
last mocked up in a throwaway artifact), they chose text: the caption under
each shelf cover reads "Omnibus · Lida" / "Capa Dura · Lendo", the word in its
status colour (`--read`, `--accent-text`), the dot muted. Não lida adds nothing,
being the default. The meta line is a flex row where the format truncates and
the status never does: with a plain `truncate`, "Encadernado (TPB) · Lida"
lost the status first, found in Chrome. The bottom bar stays for now.

**v76: the bottom status bar is gone.** With v75's words in the caption the
3px bar only repeated them, and the user asked for it removed: status now shows
only as "· Lida" / "· Lendo" beside the format. `.status-bar` markup and CSS
deleted; the tokens section's status line updated to match.

**v77: "Encadernado (TPB)" is now "Trade Paperback".** The name is stored on
every volume, not just shown, so this is a rename with a migration:
`TIPOS_RENOMEADOS` maps old to new, `normalizeLib` rewrites `tipo` on load and
on import, and the saved HQs-tab filter maps through it too. The db keeps the
old string until a volume is next saved, which is harmless because every read
goes through `normalizeLib`. Test fixtures keep the old name on purpose, so
`test-render` proves the migration ("old TPB name migrated on load"). The
`longbox-cadastrar` skill's SKILL.md now names `Trade Paperback` as the default
format; anything still written with the old name is converted on load anyway.

**v78: "Capa Dura" is now "Hardcover" and "Edição Absoluta" is now "Absolute
Edition".** Same mechanism as v77: two more entries in `TIPOS_RENOMEADOS`,
so stored volumes convert on load and import. The fixture volume stored as
"Capa Dura" now proves that path too. The cadastrar skill names the new values;
its Panini fixtures keep "Capa dura", which is the publisher's own page text
that the skill reads as a hint, not a format name.

**v79: light theme and tablet pass.** First look at v68-v78 in the light theme
(forced in the harness by rewriting the light media blocks to `@media all`) and
at tablet viewports (768x1024, 820x1180, 800x1280, 1024x768, 1180x820, as real
iframe viewports in `harness/tablet.html`). Four fixes:

- **The top gradient read as grey smoke in light.** It mixes the publisher's
  deep cover shade (`swatchColors().b`), made for a dark page. `edFundo` now
  passes both ends (`--ed-fundo` deep, `--ed-vivo` edge), and in light the
  gradient uses the vivid edge at 16% / 9% / 2% / 0, the same fade-to-nil shape.
  Dark is untouched.
- **The série sheet's "Buscar número" magnifier sat above its field.** v73
  scoped the magnifier rule to `.search-field > svg`, but that search has no
  `.search-field`; the rule is now `.search-field > svg, .search > svg`, which
  still leaves the suggestion list's icons alone. A regression shipped in v73.
- **The Coleções tab slid 18px sideways at tablet width.** A collection's fold
  button (v68) is the last item on its row, and its hover label, centred under
  it and waiting at opacity 0, still counts as overflow. Its label now hangs
  from the button's right edge, and `.app` got `overflow-x: clip` as a guard for
  the next one; clip, not hidden, so no scroll container and sticky still works
  (checked: header, band and group head stay pinned after 900px of scroll).
- **"ou cole a imagem com Ctrl+V" showed on touch tablets.** Hidden under
  `hover: none`; pasting still works with a keyboard attached.

All four tablet sizes x three tabs: no sideways scroll, nothing in the header
or band past the edge, header 77px and band 72px everywhere. `test-render`
gained guards for the clip-not-hidden rule and the sheet magnifier, and its
old exact-string check on `.app` became a regex.

**v80: a folded collection keeps its bar colour, and the tabs stay built.**

- **The "Cor da barra" option vanished when a collection was folded.** Not
  intended: v66 offered it only while `ShelfBar` reported its bar on screen,
  and v68's fold unmounts the strip, whose bar then withdrew the report. The
  sheet now works the answer out from sizes (`colecaoRola`): the strip spans
  `.content`'s content box (measured with a `ResizeObserver`) and each cover is
  `.coll-strip`'s flex-basis, 108px or 124px from 640px, with 14px gaps. Those
  three numbers are duplicated from the CSS, so changing either side means
  changing both. Folded or not, the option shows exactly when the bar would.
  Checked against the real bars for all seven real collections at 600, 800 and
  1180px: no mismatch. `onVisivel`/`barrasVisiveis` are gone.
- **Every tab switch rebuilt the whole tab.** Each tab was
  `tab === k && (...)`, so leaving one unmounted every card and `<img>` and
  coming back built them again: 102 covers, each a 968x1500 file shown at about
  134px wide. Each tab is now an `Aba`, mounted once and hidden when not in
  use. The tab on screen mounts at once; the other two mount right after the
  library loads, on `requestIdleCallback`, usually while the hub is showing.
  A hidden tab is `content-visibility: hidden` (not `display: none`, which
  throws the layout away and made re-showing HQs cost 14-21ms instead of
  6-10ms), `inert` (empty string, see v56) and `aria-hidden`. `Aba` is a
  `React.memo` whose content is a render function, so while hidden it does not
  re-render with the rest of the app: opening a volume sheet costs what it did.
  Measured on the real library (102 volumes, seven collections, covers at real
  size) in the harness, React plus layout per switch: HQs 24-42ms in v79,
  6-10ms now; Séries 9-21 to 3-16; Coleções about the same, 4-13.
  Side effect: the entry stagger no longer replays when you come back to a tab,
  since the cards are the ones already there.
  `test-render` now reads only the visible tab (`visivel`, `visiveis`,
  `htmlVisivel`), and checks that a card survives leaving and returning, and
  that the hidden tab is inert.

Not done, and the likely next step if the tablet still feels slow: covers are
stored and drawn at full size (968x1500, about 5.8 MB each once decoded, about
590 MB for 102). A small copy for the shelves would cut that roughly 7 times.

**v81: the séries tab stops redrawing itself on every switch.** After v80 the
user still felt a stutter, only on switches into or out of Séries. Measured on
the real library with every character open (189 rows, 4,002 run-bar segments,
about 9,000 elements): any switch touching Séries cost 9-17ms of React against
5-8 for HQs and Coleções, in both directions. Two causes:

- **Leaving redrew it.** `Aba`'s memo only skips hidden-to-hidden renders; the
  render that hides a tab still called its render function. `Aba` now keeps
  its last drawing in a ref and hands React the same elements while hidden, so
  React skips the subtree.
- **Entering redrew every row.** The rows were inline JSX with a fresh
  `onClick` each, so nothing could be skipped. They are now `SerieLinha`, a
  `React.memo` taking the série, its range, its issues (`SEM_EDICOES` for none,
  so the empty case keeps one identity), the owned set, whether it is open, and
  `abrirSerieNaFaixa`, a `useCallback` of setters only. `statsSerie` went with
  them.

After: every pair of tabs 3-8ms, Séries included. `test-render` checks a
memoised row still marks the série opened from it.

**v82: the tab pill stops repainting the page, which was the real séries
stutter.** v80 and v81 were measured as React plus layout only, so both missed
it. Traced this time, in a headless Chrome driven by puppeteer-core (outside the
repo) with the CPU throttled 4x and a touch pointer emulated, since the
automation tab in the user's Chrome reports `hidden` and draws no frames.
For about 620ms after a switch, every frame repainted: the pill's clip-path
was written from JS on each GSAP update, which is a repaint, not a compositor
change (the old CSS comment claiming otherwise was wrong). On a touch tablet
there is no cursor lattice, so the tab content was not its own paint layer and
each repaint walked the whole tab; Séries, about 9,000 elements, cost the
most: 340ms of paint across one switch, against 205 for Coleções.

- `.seg-thumb` is now three pieces moved by `translate3d` only: a rounded cap
  at each edge and a 1px middle scaled between them, overlapping each cap by
  0.5px so no seam shows. Colour through `--pilula`. Top and height are
  written only when they change.
- Measured on the way: the old pill sat 1px inside the button on every side
  (its inset was taken from the track's border box but applied inside the
  border). Kept exactly, as the approved look; final positions match v81 to
  the hundredth of a pixel. Pixel diff of the band at rest, both themes, all
  three tabs: about 220 of 64,288 pixels differ, all on the two outer edge
  columns and the corner arcs (edge antialiasing), none in the middle.
- `.aba` is `position: relative; z-index: 0`, its own paint layer, so a
  repaint elsewhere reuses its drawing.

Per frame during the pill's flight, at 4x: 6-8ms before, about 2ms after; all
paint over a switch into Séries went from 340ms to under 10. What remains is
the first frame, which paints the tab being shown (about 26ms at 4x for
Séries, comparable to the other tabs). Tried and dropped:
`content-visibility: auto` on the run bars cut that frame to 19-23ms but added
a 13-15ms frame right after it, so no net gain.
Also seen, not changed: the GSAP ticker keeps a rAF loop running even when
idle (about 1ms per frame at 4x).

**v83: the pill's gap fixed, and a temporary diagnostic panel.**

- **v82's pill showed a dark gap before its right end on the user's PC**
  (screenshot 2026-09-23). The 1px middle scaled up by transform was drawn at
  1px and then stretched, and the stretch smeared its antialiased edges. It
  never showed in headless Chrome, which is where v82 was checked, so a GPU
  path the harness does not have. Now two layers that only slide, nothing
  scaled: `.pil-janela`, as wide as the track, rounded on its right, clipping
  (`overflow: hidden`) `.pil-corpo`, rounded on its left. The window's right
  edge sits on the pill's right edge and the body's left edge on its left
  edge, so their overlap is the pill. Final positions match v81 to the
  hundredth of a pixel again.
- **The stutter is still there on the user's PC**, and a trace of PC
  conditions in headless Chrome (fine pointer so the lattice is on, 1707 CSS
  px at 1.5x, real mouse moves over the band) shows no slow frame at all.
  Rather than a third guess, a panel at the end of `index.html`
  (TEMPORARY, no React, plus one `diag-sem-pilula` line in `SegmentedTabs`)
  times every tab switch on the user's machine (worst frame, normal frame,
  slow frames, and long-animation-frame script/render totals where Chrome
  reports them) and has four switches: pill animation off, cursor lattice
  off, all backdrop-filter off, séries run bars off. Remove both in the
  version that ships the fix.

**v84: two more switches in the temporary panel.** The user's first reading,
with all four v83 switches on: Séries → Coleções, worst frame 475ms against a
normal 4ms, and no long-animation-frame entry at all, so the main thread was
not busy: the frame was held back outside the page's code. Fits the covers:
Séries has none, Chrome drops decoded images it is not showing, and going back
to Coleções or HQs decodes every visible 968x1500 cover again before that
frame is shown (HQs and Coleções share covers, which is why switches between
them are smooth). Switches added: "Sem capas" (covers `visibility: hidden`, so
never decoded) to confirm, and "Capas sem travar a tela" (`decoding="async"`
on every image, kept on new ones by a MutationObserver) as the candidate fix.
The panel now says so when slow frames come with a free main thread.

**v85: shelf thumbnails, made and kept on each device.** The user's panel
readings settled it: Séries → Coleções at 475ms with every v83 switch on,
8ms with the covers hidden. `decoding="async"` did not help by eye.

- Every shelf (HQs grid, collection strips, search suggestions, hub wall and
  backdrop) draws a 360px-wide JPEG copy of the cover; the volume sheet and the
  hub's suggestion keep the full one (`CoverArt grande`). The copies are made
  in the browser from `/_blob/<id>` (fetch, falling back to an Image), resized
  by `createImageBitmap`, encoded on an OffscreenCanvas, one per idle callback,
  and stored in IndexedDB `longbox-miniaturas` keyed by asset id. Nothing is
  uploaded and the shared db is never written. The startup read of that store
  runs at module load and boot waits for it for at most 400ms, so on a second
  visit the shelves draw thumbnails from their first frame. A thumbnail that
  fails to load falls back to the full cover, not to the drawn one. Thumbnails
  of covers no volume uses are dropped, only when the library loaded non-empty.
- Checked first with a throwaway artifact that blob: and data: images,
  OffscreenCanvas, resizing createImageBitmap, IndexedDB and Cache Storage all
  work under the artifact host (claude.ai/artifact/Q6mnZctgm1A2uHcLHPvcbX).
- **JPEG, not WebP.** WebP thumbnails measured no faster to decode than the
  full JPEG covers: Chrome decodes a JPEG straight to a reduced size when it is
  drawn smaller, and cannot for WebP. This is also why headless Chrome never
  showed the 475ms: my stand-in covers were plain JPEGs it could decode
  reduced. The harness covers are now PNGs, which cannot be, to be faithful.
- A thumbnail loads `eager`. Left `lazy`, a cover in a hidden tab kept showing
  the full image it had before its thumbnail arrived, and decoded that on the
  switch.

Image decoding over a Séries → Coleções switch (harness, real library, PNG
covers): about 51ms before, 10-13ms after; at 4x CPU 63ms to 24ms; under 1ms
per image against 5-20. The v83/v84 panel stays for one more round, so the user
can read the same switch on their machine.

**v86: panel removed, hub backdrop fixed.** The user confirmed v85 fixed the
stutter, so the temporary panel is gone from `index.html` along with the
`diag-sem-pilula` line in `SegmentedTabs`. They also caught what v85 broke: the
hub backdrop printed URLs instead of covers. GridMotion's `isImage` accepts
`http`, `/` and `data:` only, and the thumbnails are `blob:` URLs; `blob:`
added (noted in its header comment's spirit and at the function). Checked on
two visits of one profile (thumbnails generated, then read from the device):
78 of 78 tiles are images, none text. `test-render` guards the `blob:` case.
v85 was never checked on the hub; the lesson is to walk every screen that
shows a cover after changing how covers are addressed.

**v87: the code gets structure, and nothing on screen changes.** Four pieces of
housekeeping, in one version so that any regression is unambiguously theirs:

- **Git.** The project had no version control; each version overwrote the last.
  The first commit is v86 exactly as published (its `app.js` compared byte for
  byte with the live one), tagged `v86`. Every version from here is a tag.
- **One command.** `npm run check` builds and runs every suite. The build goes
  through esbuild's JS API (no more PowerShell quoting), copies `styles.css` and
  `index.html` itself, refreshes the harness, and refuses a bundle over 450 KB.
  The runner fails a suite on a FAIL line, a non-zero exit, an error or dash
  count, or fewer passes than its floor; it was proven by planting a wrong
  accent colour, which `test-render.mjs` alone reported with exit code 0. Two
  latent test bugs surfaced: a regex that had lost its backslash
  (`/^Item d+$/`) and so never tested anything, and an encoding check that
  flagged itself. Tests moved to `tests/`.
- **Modules.** The 5.856-line `app.jsx` became 30 files under `lib/`, `ui/` and
  `telas/` (see Build in `DESIGN.md`). Code was moved by line ranges without
  edits; imports were generated and then checked by an independent script, which
  was itself checked by removing a real import and watching it get caught.
  `App` went from 2.362 to 1.665 lines: the three tabs, the collection sheet,
  the forms and the reorder gesture (`useArrastarVolumes`) are their own files,
  taking as props exactly the App values they read. Verified: all suites, then
  the real harness in Chrome (every tab, both sheets, the collection sheet, a
  form, the reorder gesture by synthetic pointer events, and the thumbnail path
  with 14 uploaded covers: 14 thumbnails in IndexedDB, 14 `blob:` images), each
  compared against the v86 bundle under the same conditions where behaviour
  looked off. It never was: the automation tab is hidden, so a sheet mounts but
  waits for a frame, and two screenshots in a row on the hub time out on v86 too.
- **Docs.** `DESIGN.md` is now the current spec only; this file took the
  per-version record, in order, with nothing dropped.


**v88: four quality-of-life features, each with its own JSDOM suite.** Designs were
agreed in chat first; every open question went to the user and took the recommended
option.

- **Q1, undo instead of asking.** Removing a volume, collection, série or edição
  happens at once; the toast says what went and offers "Desfazer" for 8s. Undo puts
  back the whole library as it was just before, which restores everything a removal
  touched (a volume's place in each collection, a série's edições and the volumes'
  links to them) with no restore rule per type, and reopens the sheet that closed.
  That is only safe while nothing else has changed, so the offer holds exactly while
  the library is still the object the removal produced (`persist` is the only thing
  that replaces it; there is no onSnapshot listener). "Zerar tudo" still asks, and can
  be undone too. `tests/test-desfazer.mjs`, 32 checks.
- **Q3, "Copiar faltantes"** under the count in the série sheet: `textoFaltantes` in
  `lib/biblioteca.js` collapses runs to "3-5" (hyphen, the en dash is banned), lists
  12.1 and "Anual 1" after them, and adds "e mais N não catalogadas" when the meta runs
  past the catalogue. With a faixa applied it copies the faixa and says so. A refused
  clipboard shows the text in a box. `tests/test-faltantes.mjs`, 12 checks.
- **Q5, last backup** in the hub footer, from `library/meta` (see Data layer):
  "Último backup há 12 dias"; with none or 30 days or more it stands out and offers
  "Fazer backup agora". Only a finished export counts. The first version read the date
  before letting the page show, one extra round trip on every boot; `test-boot.mjs`
  caught it through its deliberately slow db, and the read now runs in parallel.
  `tests/test-backup.mjs`, 18 checks.
- **Q2, stepping between volumes** in the open sheet: ‹ › (← → on a keyboard, a swipe
  on touch). The sequence is the list the volume was opened from (HQs tab as on
  screen, a collection's reading order, or the full order from the hub and search),
  worked out on each render from a stored context rather than stored as a list, so
  filters, folds and removals are always current. The keys stand down while typing,
  with a modifier, under a modal, and while the série sheet sits on top. First built
  with ‹ › among the header actions; the harness showed the title squeezed to three
  lines, so the pair moved under the subtitle as "‹ 3 de 22 ›" (tabular figures in the
  UI font, not mono, after v60's verdict on mono counters). `tests/test-navegar.mjs`,
  27 checks.

Verified in the harness in Chrome (dark theme): the backup line, the sheet header, the
toast and the série sheet. The light theme is D2's pass, next.

**v89: D1, "Seu acervo" on the hub.** After the shelf, before the footer figures, three
plain columns: Leitura (the number read, a meter of lidas / lendo / the rest with a 2px
gap between parts, and the three counts written out), Formatos and Personagens (bars of
each slice's share of the whole collection on a full-width track, so the columns share
one scale; characters in their own shelf colour, top four plus "Outros"). A publisher
column appears only with two or more publishers: the real library was read-only
inspected first and is 102 volumes, 100% DC, so a publisher chart would have been one
bar. Every bar but "Outros" is a shortcut: the HQs tab opens filtered to that slice with
the filter panel open, search cleared and the band on every publisher, so the shelf
shows the count the hub did. The dataviz validator failed the status pair in the meter
(accent vs --read too close for normal vision), so the meter's "lendo" got its own
validated step, `--retrato-lendo`. `tests/test-retrato.mjs`, 23 checks. One
test-render assertion counted the word "Outro" in the hub to prove the hunt has no
reroll button; "Outros" broke it, so it now counts buttons labelled exactly "Outro"
(same intent, rewritten, not deleted). Seen in the harness with the real volumes
(a temporary page, deleted afterwards), dark, light and 800px wide.

**v90: D2, the light theme and the tablet, reviewed and fixed.** Reviewed in headless
Chrome driven by puppeteer (installed in the scratchpad, not the repo): PC light at
1707x960, tablet 800x1280 dark and light and 1280x800 light with touch really emulated
(`isMobile` + `hasTouch`, so `pointer: coarse` and `hover: none` apply), 13 screens
each. Every screen was measured in-page for sideways overflow and for the WCAG contrast
of each visible text against the first opaque background behind it. 52 screens, no
overflow, no script errors; the report went to the user as a private page with crops
and before/after samples, and they picked all five fixes:

- **The open tab's label on the band pill** was white on the Longbox cyan, 2.3:1, in
  both themes. v70 routed "Todas as editoras" through the tinted path, whose CSS
  hard-coded `color: #fff`, silently dropping v65's dark ink. The ink is now chosen
  against the pill's own colour (`tintaSobreBorda` in `lib/cores.js`, passed as
  `--ed-cor-tinta`): dark on the cyan (7.7:1) and on a light publisher colour, white on
  a strong blue.
- **Light-theme accent** #0090A8 to #007F94: white on it went from 3.78 to 4.70.
- **Owned tiles in the dark theme**: the number takes `--read-ink` (#06170C), 3.2 to 5.8.
- "0 lendo" in the hub portrait greys its dot; a search thumbnail without a cover shows
  only its colour (at 30px the drawn title broke into single letters).
- `--read`'s low chroma (flagged in v89) stays, by the user's choice.

`tests/test-contraste.mjs` (8 checks) now computes those token pairs with the WCAG
formula and checks the pill ink on the rendered band, since JSDOM applies no media
queries and nothing had caught v70 for twenty versions. Re-running the whole review on
the fixed build left one reported failure, the pill label itself, which the scanner
measures against the grey track because the pill is a separate element behind the text;
the screenshots confirm the dark ink on the cyan.

**v91: Q4, keyboard shortcuts.** Agreed in chat before building: `/` search, `1 2 3`
the tabs, `N` new (whatever the tab's "Novo" does), `E` edit what the open sheet shows
(the série sheet first when it sits on the volume sheet), `Ctrl+Z` undo the last removal,
`?` a panel listing every key including the ones that already existed (Esc, ← →,
Ctrl+V). The user first picked "panel only", then changed to panel plus hints, so the
keys also ride the existing `[data-dica]` hover labels ("Novo · N", "Coleções · 2",
"Buscar · /", "Editar · E", "Desfazer · Ctrl+Z"). One window listener in
`telas/useAtalhos.js`; the rules: nothing while typing in a field or under a modal;
letters and digits never with Ctrl, Alt or Cmd (Ctrl+1 and Ctrl+N are the browser's);
Ctrl+Z only while a removal can be undone, and never inside a field, where it is the
field's own undo; with a sheet open only `E` and `?`, so a stray digit cannot switch
the tab under it. From the hub `/` enters the HQs tab first, since the search box only
exists off the hub. Two hint placements needed care: the search field's label hides
while the field has focus (it would cover the suggestions), and the toast's label opens
above the button, the toast being at the foot of the screen. The claude.ai frame only
passes keys to the app after a click inside it; the panel says so, since the app cannot
work around it. `tests/test-atalhos.mjs`, 28 checks; checked again with a real keyboard
and mouse in headless Chrome (the "/" is not typed into the field, the hints sit where
intended, the panel reads in both themes).

**v92: Esc no longer throws focus out of the app.** Reported on the PC: every Esc left
the whole Longbox and put a focus ring on the claude.ai bar, which also killed the v91
shortcuts until the next click. Cause, found with a throwaway probe artifact: the host
injects a runtime into every artifact page that includes an `installEscapeForward`,
handing any Esc to claude.ai, which pulls focus out of the frame. The probe showed it
skips an Esc whose default was prevented (no `window` blur with `preventDefault` in
the capture phase, a blur without it). Fix: `useAtalhos` claims every Esc with
`preventDefault` in a capture listener on `window`. The app's own Esc handlers
(`useEscape`, search, dropdowns) never read `defaultPrevented`, so they still close
sheets, modals and menus. Trade-off: Esc on a bare screen no longer leaves the frame;
a click outside or Tab still does. `tests/test-atalhos.mjs` 30 checks.

**v93: séries character filter, per-row séries search, and 0 for the hub.** The user
found looking for one character's séries confusing: searching "batman" also showed the
Batgirl group, because a série with Batman and Batgirl sat in both groups and the search
kept the whole série. Agreed in chat: (1) the search is matched per row, a série inside
one group stays when its name or that group's character matches; a name match still
shows the série in all its groups. (2) A character filter on Séries, reusing the HQs
filter button and `PersonagemFiltro` (now takes an `id`), counted in séries, with
"(sem personagem)" offered; it leaves one group, forced open, hides "Mostrar todas",
makes the search read série names only, and turns the séries suggestions into "Séries ·
Nome" with only that character's séries while the HQs part stays whole. Separate from
the HQs filters (recommended, not contested), saved in `longbox:filtro-series`,
released like the HQs one when the publisher band leaves it empty. Coleções filter
deferred by the user. Mid-turn addition: `0` opens the hub (panel row, "Início · 0"
hint on the wordmark). `tests/test-filtro-series.mjs` 26 checks, test-atalhos 32.
Looked at in the harness in Chrome: the one-field row is 320px wide, no sideways
overflow, the suggestions heading and the wordmark hint read right.

**v94: Q folds or unfolds every group.** Asked by the user, key their choice. `Q` runs
exactly what the tab's "Esconder todas / Mostrar todas" button does on HQs and Séries
(`alternarDobra` in App), and only while that button is on screen: not during a search,
not under the séries character filter, and nowhere on Coleções, so the key never changes
a state the user cannot see; when it does nothing it leaves the event alone. The panel
lists it, and the button's hint reads "Esconder todas · Q" / "Mostrar todas · Q",
following the button's own label. test-atalhos 41 checks, test-filtro-series 27. Looked
at in the harness: the hint sits over the first group header with no sideways overflow,
and a real Q keypress folds the HQs tab.

**v95: formats belong to publishers.** Groundwork for cataloguing Marvel: the user did
not want DC Finest offered for a Marvel book, and asked for the structure change before
the skill. Agreed in chat: lists in code, not editable in Gerenciar editoras (user's
pick); the publisher field becomes a select of registered publishers ("no cons" per the
user, with the old-value caveat stated). Common: Trade Paperback, Omnibus, Hardcover,
Outro. DC adds Compendium, Absolute Edition, DC Finest; Marvel adds Epic Collection and
Marvel Masterworks. `tiposDaEditora` ignores a trailing " Comics" after the harness,
whose publisher is spelled "Marvel", showed a Marvel entry named that way would get the
common four only. Publisher now sits above format in the volume form; the série form's
publisher is a select too. The fallback note lives in the form component's own state,
never in `volumeForm`, since that object is spread into the stored volume on save.
`OPCOES_TIPO` removed (the filter's options are computed per band). test-filtros'
"lista de tipos" count rewritten 8 -> 10 (9 formats plus "Todos os tipos"), not
deleted. New `tests/test-formatos.mjs`, 24 checks. Looked at in the harness: the
form reads in order, the note wraps under the format column, no sideways overflow.

**v96: a stale tab can no longer erase what was written elsewhere.** 2026-09-24, while
Claude catalogued books into the db, a Longbox tab opened earlier reordered three
volumes and saved: `flushLibrary` wrote its whole old `library/volumes` array with a
plain `set`, and the 20 volumes catalogued in the meantime vanished (restored the same
day from the last server read). The artifact db has no conditional write, so the fix
lives in the app, agreed in chat (the user picked a quiet toast over a silent update):
every save re-reads each changed document and, when the server copy moved, merges this
tab's changes on top of it (`lib/mesclar.js`: three-way merge by id; items the tab
added, edited or removed win, everything else comes from the server; on an item changed
on both sides the tab wins). Saves now run one at a time through a queue. The tab also
listens (`ouvirMudancas`: `onSnapshot` on the five library documents and the `edicoes`
collection) and brings in changes made elsewhere live, toast "Biblioteca atualizada em
outro aparelho" at most every 4 s; an undo on offer expires by itself because the
library is no longer the one it would restore over. Found on the way: DESIGN.md had
promised `onSnapshot` since the data layer was specified, but no version ever had it.
Cost measured on the real library: 0.2 ms to compare volumes, 3 ms once at start for all
242 edição shards. New `tests/test-sincronia.mjs`, 32 checks, including the exact
2026-09-24 scenario (20 volumes written behind a stale tab, then a status change).

**v97: bigger toast on desktop.** 2026-09-24, the user confirmed the v96 live-update
notice appears on phone and PC, and asked for it a little bigger on the desktop. From
768px up every toast grows from `small` (13px, padding 10px 16px) to `title` size (16px,
padding 14px 22px), about 36px to 52px tall; the "Desfazer" toast and its button grow with
it. Phones are unchanged. Checked in the harness at 1707px.

**v98: the toast glows in the publisher's colour.** With the bigger v97 toast the user
noticed a grey "aura" around it: the toast borrowed `--shadow-sheet`, an upward black
shadow (0 -12px 48px, 50%) meant for sheets docked at the bottom edge, which on a
floating box over the dark page reads as a lopsided halo. Replaced, at the user's
suggestion, by a light behind the toast that fades out: two colour `box-shadow`s (22px at
38%, 64px at 16%) of `--toast-luz`, which is the cyan accent on the hub and on "Todas" and
`hsl(var(--ed-hue) 100% 50%)` when a publisher is picked. A `::before` layer was rejected:
inside the toast's own stacking context (fixed + z-index) a negative z-index child paints
over the toast's background. Checked in the harness: cyan with no publisher, red on Marvel.

**v99 Import asks before replacing, and undoes (critique P0, lote 1).** Picking a backup file
used to `persist` it at once: an old or wrong file wiped the library with no question and no
way back. Now the file is parsed and held in `importPendente`; a modal "Substituir a
biblioteca?" shows Volumes, Coleções, Séries and Edições as "Agora" vs "No arquivo" (counts
that would drop in red), and only "Substituir" writes. The toast then offers "Desfazer" through
the v88 mechanism (`{ antes, depois }`, valid while the library is still the imported one). The
hub footer gets a hairline between "Exportar backup" and the two actions that replace the
library. The save path needed no change: with no concurrent writer it overwrites each document
from the local library and deletes emptied edição shards, the same as "Zerar tudo".

**v99 Numeric title order (critique P1).** Title, série-name, collection-name and issue-number
sorts use `localeCompare(…, "pt-BR", { numeric: true })`, so "vol. 2" precedes "vol. 10" in
unordered groups, search results and the sheet's ← → sequence. Character and publisher lists
keep plain order. `tests/test-desfazer.mjs` covers cancel, replace, undo, the invalid file and
the numeric order.

**v100 Keyboard and screen reader pass (critique P1/P2, lote 2).** Opening "Novo" left focus on
the page body, so the first Tab never reached the form, and no dialog had an accessible name.
Now `useFocoDialogo` in ui/base.jsx focuses the first field of a modal (not on touch, where it
would raise the on-screen keyboard every time), or the body of a sheet, traps Tab inside, and
returns focus on close (a removed volume's card is gone, so focus is simply dropped). Titles are
`h2` with `aria-labelledby`. `Field` links label and error/hint via `useId` and marks
`aria-invalid`; composites become a named group. Tabs get `role="tab"`/`aria-selected`, the
bottom tab bar `aria-current`, issue tiles an owned/missing label, "Buscar número" a label, and
the reading status `aria-pressed` plus a visible 2px ring at weight 600, since "Não lida" picked
looked almost like the others. `tests/test-foco.mjs` (20 checks) covers it. Shortcuts and ← →
are unaffected: they already ignored focus on non-field elements.

**v101 Touch targets and a safer delete (critique P2, lote 3).** On a coarse pointer `.btn-icon`
grows from 36px to 44px and issue tiles get a 44×44 minimum; mouse and pen keep the old sizes.
In the volume, série and collection sheets and the pinned edição row, Remover moved to the start
of the action row with 14px after it, so it no longer sits between Duplicar and Fechar. On touch
the row's own 6px gap goes to 0 (the 44px boxes space the icons) to give the title width back.
Cost measured in the harness at 800px: "Constantine (Hellblazer)" now wraps to two lines on
touch (one line on v100); shorter names are unaffected.

**v102 Small fixes (critique lote 4, the last).** `.slot-order` ("01/02/03" over collection
covers) goes from 10px to 11px and the fallback cover's character line from 9px to 11px, the
smallest step of the type scale; the hub wall's 8px fallback titles stay (52-64px thumbnails,
decorative). "(meta N)" only shows when the goal differs from the number of catalogued issues.
The hub's "Maior documento" meter only appears past 80% of the 256 KB limit, with its warning;
the backup line stays. A missing number's panel in the série sheet now has "Vincular a um
volume…" (the série's characters first, then "Outros volumes"), which adds the edição to that
volume through `toggleLigacaoEdicao`. A keyboard button beside the search opens the shortcuts
panel (hidden on touch). `tests/test-foco.mjs` grew to 29 checks.

**v103 One colour for the hunt bar; green means done.** "Falta pouco" bars changed colour by
share owned: amber (`--warm`, outside the locked palette) under 65%, cyan to 80%, green past
it. The length and "45/50" already say that, amber read as a warning on a list of series doing
well, and green there was a progress tier while everywhere else it is a state (read, owned).
Now the bar is always `--read`, since its filled part is owned issues, like the séries sequence
bars. Removed: `--warm` in both themes, `QUASE_MORNO`, `QUASE_PRONTO`, the `data-tier`
attribute. Read and owned keep sharing green, both "done"; DESIGN.md states the rule. Chosen
over a cyan hunt bar, which would have shown the same série in two colours on hub and Séries.

**v104 The three hunt tiers come back, by the user's choice.** After seeing v103 the user
preferred the tiers: across a list of séries the colour tells at a glance which one is about to
close, which a single colour loses; if it had to be one colour, cyan over green. Restored
exactly as v102 (amber 50-65%, cyan 65-80%, green 80%+). DESIGN.md now records the tiers as an
approved exception, so a future critique does not flag the amber as off-palette again.

**v105 Large covers load progressively; the hub suggestion never shows the wrong cover.**
The user reported the volume sheet's cover staying grey for ~800ms and the hub's random
suggestion being slow, sometimes stalling, and showing one book's cover under another's
title after "Outro". One cause for all of it: `CoverArt grande` was a plain `<img>` with the
full URL and `loading="lazy"`. Lazy held the download until the sliding sheet was on screen;
changing `src` keeps painting the old bitmap until the new file arrives, so fast rerolls
showed stale covers; the full decode landed on screen at paint time. Now `CapaGrande` shows
the device's 360px thumbnail at once, fetches and `decode()`s the full cover off screen,
swaps it in when ready, and keys both the ready state and the `<img>` by volume id. Measured
in headless Chrome with 800ms of simulated network: hub, five fast rerolls, v104 painted a
stale or grey cover for about 1.65s in total, v105 never; sheet, first picture at 840ms on
v104, 7ms (thumbnail) on v105, full cover at ~817ms. `tests/test-capa-grande.mjs` guards it.
This is step 1 of the big-cover sheet redesign (the critique's first open question).

**v106 The volume sheet puts the cover first (critique question 1, done).** Chosen from a
throwaway mockup of three layouts (https://claude.ai/artifact/4TDuwPEK8TXnxLbn9qhbHd): the user
took the two-column one with the blurred-cover atmosphere of another, then asked for a solid
colour taken from the cover instead of the blurred image. Two columns only from 1024px, since
the user's tablet is used on its side; below that the cover is centred on top of the 440px
sheet. The wash is the cover's most prominent colour, computed once per cover from the local
thumbnail (hue bins weighted by saturation, so a vivid accent beats a larger dull area; mostly
black/white/grey covers fall back to the character's hue), drawn as a plain gradient: the
blurred version would have run a GPU filter on every frame of the slide, the ← → step and the
recede. `tests/test-cor-capa.mjs` checks the colour picking; checked in headless Chrome at
1467, 1280 (touch), 800 and in the light theme, including the sticky cover column and the
recede under the série sheet.

**v107 The cover stays at the top of its column.** Reported by the user with screenshots: on
volumes with many linked séries (Justice League: Endless Winter) the cover sat halfway down,
while on short ones (Doomsday Clock) it was at the top. The narrow layout centres the cover
with `align-self: center`; in the two-column grid the same property centres it vertically in a
row as tall as the edições list. The wide rule now sets `align-self: start` (which sticky needs
anyway). Missed in v106 because the harness volumes had short lists; checked on a 72-issue
volume: cover and info column both start at 135px.

**v108 The série map opens where the hunt is (critique 2, lote 1).** The second critique
(2026-09-27, 28/40) found the número map, the payoff of all the cataloguing, closed on every
path. In the série sheet (more than 60 issues, grouped by hundreds) a hundred-block with fewer
than 6 issues now joins the block before it ("Nº 0-99 55/99" plus "Nº 100-199 0/1" became
"Nº 0-100 55/100"). Blocks with some owned and some missing issues open by themselves, and all
of them when there are one or two; complete and untouched blocks stay closed, so a long run like
Batman Vol 1 is not a wall of grey tiles. "Copiar faltantes" went from 12px to the sheet's 13px
buttons. The Séries tab keeps opening folded: that was the user's own v49 request (6949px open
against 1782px folded on the real library). `tests/test-mapa-serie.mjs` covers it.

**v109 Hub colour and the light-theme hunt (critique 2, lote 2).** In the light theme the
drifting cover backdrop's darkest stretch sat right behind "Falta pouco" and the cyan "faltam N"
was nearly unreadable. The backdrop now lives in `.hub-topo` with the suggestion: in the light
theme that block is its containing box, so it ends before the hunt; in the dark theme the block
is `position: static`, so the backdrop still measures the whole hub and drifts behind the hunt
as before. The first build cut it in both themes; the dark hub lost most of its atmosphere, and
the user chose, from before/after screenshots, to change the light theme only. "faltam N" takes
its bar's tier colour (`tierDaCaca` shared with `HuntProgress`), with `--warm-text` #8A5A0E for
amber text in the light theme (6:1 where #B4791A read 3.4:1). A reading status with 0 items is
left out of "Seu acervo". "Do seu acervo" is sentence case instead of an uppercase micro label.
The volume sheet's big cover drops its 1px border and its shadow goes from 18/40px to 8/22px.
Not changed: the first cover of a Coleções strip is flush with the strip's left edge on purpose,
aligned with the collection title above it (detector false positive).

**v110 Light-theme hub backdrop reverted.** The user reviewed v109 live and did not like the
light hub with the backdrop cut short before "Falta pouco"; it is back to measuring the whole
hub in both themes (`.hub-topo` stays, always `position: static`). The rest of v109 stays. The
light-theme legibility of the hunt is reopened: the cause is that `.gm::after`, the veil over
the backdrop covers, is a near-black gradient in both themes, so on the light page it paints a
dark smear under dark text.

**v111 The hub backdrop's veil follows the theme.** The other solution for the light-theme
hunt, chosen by the user from a prototype screenshot: `.gm::after` fades the covers toward the
page, so in the light theme it is now the light page colour (rgba 251,251,252 from 0.74 to
0.9) instead of the near-black used in both themes. The covers stay behind the whole hub, as a
pale watermark under "Falta pouco" and the shelf, and dark text reads on it. Dark theme unchanged.

**v112 Tablet targets and the group heading (critique 2, lote 3).** The group heading row now
folds the group: the character name is a button inside the `h2` (it used to be the reverse, an
`h2` inside a button, invisible to heading navigation), stretched over the row with `::after`,
and the chevron is a decorative mark. Only the colour square opens the colour picker, as its own
button "Cor de <personagem>" (it was the name, which is where a hand reaches to fold). The focus
ring wraps the whole row (`:has(:focus-visible)`). On a coarse pointer the boxed text buttons,
the status buttons, the search field, the cover upload button, the colour square and the heading
row are at least 44px (measured at 1280x800 touch: all 44; the PC keeps 36-38). The filter count
badge goes from 10px to 11px. Drawn fallback covers read as one picture, "Capa de <título>",
instead of their typeset title and character running into the card's title. Not done, with
reasons: "Esconder todas" stays in its own row (moving it into the band would change the band's
width on tab switches while the tab pill measures it, the reason recorded where `.fold-all` is
styled); the sticky group heading passing over covers while scrolling is normal sticky behaviour.

**v113 Copy at the decisive moments, and a save signal (critique 2, lote 4).** "Zerar tudo"
confirms with "Apagar tudo" and says what goes ("Apaga 22 volumes, 3 coleções, 3 séries e 172
edições"). The série sheet says "Escolha um número…" instead of "Toque", which was wrong on the
PC. The hub's last button says what it does, "Abrir minha coleção"; the scroll-past gesture still
works. Removal toasts say how much went and what stayed: "Série removida, com 100 edições. Os
volumes continuam na biblioteca." and "Coleção removida. Os 14 volumes continuam na biblioteca."
The app used to save in silence and speak only on failure: `store.onEstado` now reports real
writes, and a small "Salvando…" / "Salvo" beside the wordmark fades in and out two seconds
after (fixed width, `aria-live="polite"`, hidden under 520px). Not `role="status"`: test-boot
holds that no status region stays on screen after loading.

**v114 Three features from critique 2 (lote 5), chosen from a throwaway preview.**
A) Keyboard on the shelves: each HQs shelf and each Coleções strip is one Tab stop (roving
tabindex, `gradeTeclado` in ui/VolumeCard.jsx); the arrows move between covers, up and down by
the row's measured width, Home/End go to the ends, Enter opens, and the next Tab leaves for the
next character's heading. Tab used to walk every cover, 163+ on the real library.
B) "Lidas até aqui" in a collection's reading order (ColecaoSheet): marks that volume and every
one before it as read in one save, toast with the count and Desfazer. Read volumes show "· Lida"
and lose the button.
C) The "Novo volume" form takes a cover (file or Ctrl+V, with a preview); it is uploaded through
the usual `handleCoverPick` right after the volume is saved, from both "Salvar e fechar" and
"Salvar e cadastrar outro". While a form is open, the volume sheet underneath ignores pastes.
I recommended against C (the user catalogues through the skill); the user asked for it.
`tests/test-lote5.mjs` covers all three (17 checks).

**v115 Sheets open where you are; two follow-ups to v114.** From the user's own use:
- Opening a volume or a série used to move you to another tab first: a cover on the hub's wall
  or in a collection, or a volume picked in the search, went to HQs; a série in "Falta pouco"
  went to Séries. The sheets were always app-level overlays, so the `switchTab` calls are gone:
  the sheet opens over the tab you are on and closing it leaves you there, scrolled where you
  were (focus returns to the cover, v100). The hub's scroll-past-the-end unlock is off while any
  sheet is open (`folhaAberta`), so scrolling inside a sheet over the hub cannot enter the
  collection; checked in headless Chrome with wheel events at the bottom of the hub.
- In a collection's reading order a read volume shows a small status select (Lida / Lendo /
  Não lida) instead of nothing, to set back a "Lidas até aqui" pressed by mistake.
- The "Novo volume" cover field is a full-width strip like its neighbours (thumbnail slot,
  "Escolher imagem", the Ctrl+V hint inside, ✕ to remove), replacing v114's lone square with
  the hint underneath, which the user found unbalanced.

**v116 A tab no longer mistakes its own late echo for another device.** Reported by the user
with only the PC open: after several edits in a row the app said "Biblioteca atualizada em
outro aparelho", undid the latest edits and redid them a moment later. Cause: the server echoes
every write back to the tab's live listener, and the echo of an earlier write (edits 1-5) can
arrive after a later one (1-8) has been saved; the listener compared it only with the last
write, took it for a remote change, three-way merged it (which reverts 6-8), showed the toast,
and scheduled a save of that reverted state; the next echo put 6-8 back. That scheduled save
was a real, if narrow, risk of losing 6-8 if it went out before the later echo arrived. Now
each write is recorded (before it goes out, since its echo can beat `set()` resolving) in a
per-document list of the tab's own recent writes, and echoes equal to any of them are ignored;
entries expire after 60 s. `tests/test-sincronia.mjs` reproduces the case with a mock server
whose echo carries the written state and arrives 900 ms late: it failed before the fix (screen
back to the older value, false toast) and passes now; changes from elsewhere still arrive.

**v117 The own-echo window: 20 s and fingerprints.** Discussed with the user after v116: the
only failure mode of ignoring echoes by content is the reverse one, a real change made on
another device that recreates, byte for byte, a whole document this tab wrote within the
window, which would be skipped (the screen stays stale until the tab's next save re-reads and
merges it, or a reload; nothing is lost). The window went from 60 s to 20 s, still far above a
normal echo delay but a third of the exposure, and each recent write is kept as a fingerprint
(length plus a 32-bit FNV-1a hash) instead of the document text (up to 12 copies of the ~116 KB
volumes document before). Considered and not done: stamping each write with a tab id and a
sequence number, which removes the window entirely but adds a field to every stored document;
worth it only if the stale-screen case is ever actually seen.

**v118 Phone width and hub touch targets (third critique, 29/40).** The third `/impeccable
critique` (2026-09-27, snapshot in `.impeccable/critique/`) found the top bar and the hub footer
broken at phone width, re-measured with touch emulated in headless Chrome:
- The search was 14px wide at 390 (0px with a fine pointer) and 139px beside 139px of nothing at
  768: a `flex: 1` spacer shared the free width with the `flex: 1` search. The spacer now renders
  only on the hub; the search has `min-width: 44px` (tapping it opens the full-screen phone
  search), `max-width: 456px` and `margin-left: auto`, which is exactly the width it had at 1440,
  so the PC header is pixel-identical. Result: 80px at 390, 287px at 768.
- To make room, "Novo" folds to its "+" below 480px on the tabs and below 560px on the hub (where
  it frees "Minha coleção", which had shrunk to "Coleção" right above the Coleções tab); the
  narrow search pads its text 30px/4px so "Buscar" is not clipped.
- "Salvando…/Salvo" was hidden below 520px. There it is now an 8px dot (accent while saving,
  green once saved, words kept for screen readers) and takes no room at all while idle.
- The hub footer ran off both edges at 390 (Exportar from x=-43, Zerar to x=433; a document
  `scrollWidth` check misses it, since overflow to the left does not scroll). Below 480px the
  separator becomes the line break: Exportar alone, Importar and Zerar together under it.
- Touch (`pointer: coarse`): the hub's Seu acervo rows (32px), status rows (30), Falta pouco rows
  (31), ghost buttons (38) and the wordmark (32-36) now reach 44px.
`test-render` looked for "Coleção"; it now looks for "Minha coleção".

**v119 Reading status from the keyboard: J / K / L.** From the third critique (the most frequent
edit had no key). The user saw both options in a throwaway preview and chose both, with J K L
(Não lida, Lendo, Lida, the segmented control's order) instead of the U L R I proposed, and the
control's labels left without underlined letters:
- In the volume sheet the keys set the status and the control follows; the sheet stays open, so
  with ← → a run of volumes can be marked without closing it.
- On a focused cover (HQs shelves, Coleções strips, the hub wall) the key sets that volume's
  status without opening anything; every `VolumeCard` now carries `data-vid`. The caption
  follows and a toast names the volume ("Batman: Ano Um · lida", a `·` because titles have
  colons) with Desfazer and Ctrl+Z, the removal-undo path (v88). Same status again: a plain toast.
- Nothing under a série, colour or publisher sheet, or a collection sheet alone; never while
  typing, under a modal, or with Ctrl/Alt/Cmd (`useAtalhos`).
- The shortcuts panel gained "Numa estante de capas" (← →, ↑ ↓, Home/End, Enter, J K L), missing
  since v114, and J K L under the sheet keys.
`tests/test-atalhos.mjs` failed on 9 new checks before the code and passes 55 now.

**v120 The collection sheet reads instead of administering.** From the third critique: each row
of a collection's reading order carried "Lidas até aqui", ↑, ↓ and a red × (56 controls and 14
red marks for a 14-volume saga), the character repeated under every title, move buttons that
never named the volume, and a × that took the volume out at once with no undo. Seen by the user
in a before/after preview first:
- Reading mode, the default: number, title, and "Lidas até aqui" in the muted text colour (the
  accent on hover or focus). Read volumes keep their status select (v115). The character line
  shows only when the collection mixes characters (the chips above already say it otherwise).
- "Editar ordem" beside the heading (it becomes "Pronto") shows ↑ ↓ and ×, the × set 12px apart;
  end arrows are disabled. Alt+↑ / Alt+↓ on a focused row moves the volume and focus follows to
  the same button in its new row. The mode resets when another collection opens.
- Labels name the volume ("Mover X para cima", "Tirar X da coleção"), and taking one out shows
  "X saiu da coleção." with Desfazer (the removal-undo path), restoring its position.
`tests/test-colecoes.mjs`: 12 new checks failed before and pass now (45).

**v121 Copy and the critique's minor points.** The last batch of the third critique, seen by the
user in a before/after preview:
- Removal toasts name what went: "X saiu da biblioteca." for a volume ("saiu" because a title can
  be either gender), "Série X removida, com N edições…", "Coleção X removida…".
- "Novo" says what it makes: "Novo volume" / "Nova coleção" / "Nova série" by tab (the hub's makes
  a volume), with the matching hint; still only "+" below 480px (560px on the hub).
- Nova série: the name's example is "Título (Volume N)" (it was "Nightwing (Volume 2)", a série
  the user owns, so it read as a filled value); "de/até" and the position field wait behind "Mais
  opções" (open by themselves when the série already uses them), 8 visible fields down to 5; the
  position field is "Posição entre as séries do personagem".
- The série map's missing numbers were the faintest thing on the sheet although they are what is
  hunted: now dashed empty slots with the number in the body colour, and a "tenho / falta" legend.
- "Falta pouco" explains its three colours in one line (from 50%, 65%, 80% quase fechando).
- The Seu acervo "Formatos" bars are muted grey; cyan keeps meaning interactive.
- Not changed: the light theme's sheet scrim was already a neutral grey (rgba(20,22,26,.38)); the
  teal the critique saw is the page's cyan top gradient showing through it.

**v122 Three follow-ups from the user after v121.**
- The "Falta pouco" legend moved under the bars, like a chart key: under the heading it floated
  between title and first bar. Chosen from four placements rendered at 1280 and 390 (right, under
  the count, broke the title in two on a phone; left, beside the title, pushed the count under it).
- The Seu acervo "Formatos" bars are cyan again. The user found the v121 grey without identity
  (grey bar, grey numbers, white names); amber was offered too but it means "needs attention" in
  the hunt bars and is used nowhere else, and the rows are clickable, so cyan fits.
- Character group headings (HQs and Séries) aligned on the text baseline on a fine pointer, so the
  name sat 5px above the colour square and the fold arrow, which centre on the 36px row. They are
  centred now, as they already were on touch; name, count, square and arrow share one centre.

**v123 Shared shelf thumbnails, for the iPhone.** The user reported covers taking long to load on
the phone (iPhone, Safari), only on the first open. Cause: the v85 thumbnails are made per device
from the full covers, and those weigh 143 MB across the store (~760 KB average; the Panini ones are
PNGs of 1 to 2.6 MB), so a device without its own copies downloaded over 100 MB, one cover at a
time. Safari also clears a site's storage after about 7 days unused, so the "first open" comes back.
Now the first device to make a thumbnail uploads it (360px JPEG, tens of KB) and records it on the
volume as `mini: { capa, id }`; other devices draw that file, lazily. The PC keeps drawing its
local copies, so its tab switches are unchanged; its one-off cost is uploading the 163 thumbnails in
idle time on the first open after the update. Uploads stop for the session on the first error.
Volumes doc was 116 KB of 256 KB before; the records add about 14 KB. `tests/test-miniaturas.mjs`
(11 checks) failed first: a recorded thumbnail still downloaded the full cover and nothing uploaded.

**v124 The shared thumbnails actually upload.** After v123 the PC, left open for minutes, uploaded
nothing and recorded nothing; one 25 KB thumbnail reached the store with no record. A throwaway
probe page (contract 0.2.46 like Longbox) settled it: `assets.upload` answers in ~0.6 s with or
without a click, but `fetch()` of a `blob:` URL is refused inside the artifact frame ("Failed to
fetch"). v123 read the PC's existing thumbnails that way, so every one failed silently; the JSDOM
test's fetch stub allowed it. Now the Blobs are kept in memory beside their URLs and uploaded
directly. The lost record: a phone suspends a hidden page, timers included, so a batch waiting its
3 s (and any library save inside its 500 ms debounce) died with it. Both now go out on
`visibilitychange` to hidden. `test-miniaturas.mjs` gained a minimal IndexedDB stub, a fetch that
refuses `blob:` like the real frame, and a hide check (13 checks; each new one seen failing
first). It also stopped reading the hub suggestion's cover by mistake, which made it flaky.

**v125 "Salvando…" no longer sticks.** Right after v124 uploaded and recorded all 163 thumbnails
(34 library writes, every record valid), the indicator stayed on "Salvando…" for minutes. Since v113
a save that had to merge with a change made elsewhere hands the merged library back to the screen,
which schedules a follow-up save before the "Salvo" check runs; the follow-up finds nothing to write
and returned without a word. Now the module remembers the last state it reported, and an empty
follow-up closes a "Salvando…" left open. Only the indicator was wrong; the data was saved.
`test-miniaturas.mjs` has another device edit a volume mid-upload (the edit survives the merge) and
checks the indicator (15 checks; the indicator one failed first).

**v126 The hub is a cover over the tab.** Two reports from the user's first long session on the
iPhone (opened from a home-screen shortcut). First, an ordinary swipe often unlocked the hub before
it had been read to the end: the gesture switched to tracking mid-swipe, the moment the scroll
reached the end, and that swipe's scrolling speed then counted as a flick. Now a gesture only
unlocks when it starts at the end (a touch that begins there, or a wheel turn after a 250ms pause),
and a flick also needs 40px of travel. Second, the user asked for the hub to behave like a cover:
lifting it showed an empty page and only then the HQs tab. The hub is now a fixed layer with its own
scroll and header, and the app is fully built underneath on the last tab used (kept on the device;
HQs on a first visit), inert while covered. The cover lifts whole, opaque, and the tab shows through
as it goes; the wordmark or 0 drops it back from the top. The phone's bottom tab bar is under the
cover too. `tests/test-capa-hub.mjs` (26 checks); with the old gesture rules put back, its two
gesture checks fail. Old tests that assumed the hub was a page were updated (the app under the
cover counts as hidden).

**v126 Pull a sheet down to close it (phone).** Also from the iPhone session: the volume sheet
stepped sideways with a swipe but did not close with the downward pull iOS teaches. Every sheet
(volume, série, coleção) now follows the finger down on a phone and closes past 120px or on a flick
with 40px of travel, otherwise settles back; closing hands over to the sheet's own exit transition
from where the finger left it. The drag only starts when nothing between the finger and the sheet
is scrolled, and only once the finger clearly moves down, so scrolling a list back up and the
sideways navigation are untouched. Tablet and PC keep the side panel with no drag (sideways there
already means the next volume). `tests/test-arrastar-folha.mjs` (14 checks, 4 failed first); also
driven with real touch events in an emulated iPhone.

**v127 One scrollbar on the hub, and a steadier throw on iOS.** v126's cover scrolls itself, so the
hub showed two bars side by side: its own (the browser's default) and the page's, which belonged to
the tab underneath and stood still while the hub scrolled. The cover's bar now takes the app's thin
inner style (resting colour only, the accent while grabbed: the pointer is always over the hub), and
the page's bar is transparent while the cover is down (`html[data-capa]`); a transparent bar keeps
its width, so the tab does not shift (1425px either way, measured). The user found the iOS throw
uneven on a strong swipe. Three causes addressed: the throw now starts at the finger's speed (speed
over the last 100ms; duration 2 x distance / speed, 180-360ms, on a curve whose start is twice its
average), the layer keeps its will-change through the throw, and the tab takes over only once the
cover has left (transitionend) instead of 20ms before the end, which put React's unmount of the hub
inside the animation. And GridMotion, the hub backdrop, queued four new GSAP tweens on every frame
forever, even with the pointer still (always, on a phone); it now does nothing until the pointer
moves. `test-capa-hub.mjs` 35 checks.

**v128 Four covers a row on the phone; the tab bar's glass redraws after a switch.** The user asked
for four HQs per row on the iPhone instead of three, keeping the format. From a throwaway preview of
real captures (3 today; 4 with smaller type, where "Trade Paperback · Lida" still cut the format; 4
with the status stacked) they chose the stacked one: under 640px the shelf is four columns (~82px at
390px), the title 11px and the meta 10px, and the status sits on its own line without the dot (the
dot is now its own `.vol-ponto` span). Drawn covers shrink their type like the hub wall's. Tablet and
PC unchanged. The tab-bar glitch: only in the Claude iOS app, not Safari (screenshots from both), the
bar's glass could keep a blurred copy of the previous screen after a tab switch until the next
touch, and a screenshot forced a redraw so it never showed in one. The glass stays (the user likes
it); after every switch the bar gets a throwaway `translateZ(0)` for one frame once the new tab has
painted, and again at 300ms, so WebKit samples its backdrop afresh. Unverifiable here: the user checks
on the iPhone; next step if it persists is a denser glass (50% to ~75% background).
`test-capa-hub.mjs` 39 checks.

**v129 The phone's tab bar floats, and the search lives in it.** The v128 redraw nudge made the
Claude-app glass glitch clear quickly but not vanish, and the user proposed a redesign after Apple's
tab-bar guidance (iOS 26: a tab bar floats over content on Liquid Glass; search can be its own tab
at the trailing end) and a Sketch "Prominent Tab" component. Under 768px the tabs are a floating
glass capsule 16px from the sides and 8px above the home-indicator inset, with a pill behind the
active tab that slides by transform, and the search is a glass circle beside it. The user chose the
morphing search over a full-screen one: tapping the circle grows it into the field (focused inside
the tap so iOS raises the keyboard) while the capsule folds into a circle with the tab's icon; the
suggestions open above the bar, the tab filters behind; a tap outside only hides the suggestions;
the X, the folded circle or a pick close and clear it; the bar rides above the keyboard via
visualViewport. The search left the phone header (`useCelular`), and the old full-screen phone search
and its narrow-header padding rule were deleted. The glass nudge now targets the capsule and circle.
Tablet and PC unchanged. Honest note given to the user: smaller glass, not a guaranteed cure for the
WebKit glitch. `tests/test-barra-busca.mjs` (19 checks); preview from real captures approved first.

**v130 The glass is its own empty layer.** v129 kept the Claude-app glitch. The user's photo (taken
with another phone, since screenshots never catch it) showed the capsule's glass in three
rectangles with straight seams exactly on the three tab buttons, each a different shade, for about
500ms after every tab switch, on every tab. During a switch the pill slides (320ms) and the tabs fade
colour (160ms), so they become compositing layers; the embedded WebKit then drew the backdrop filter
of the box that holds them tile by tile, each tile sampled at a different moment. Known workaround:
the blur and fill moved to an empty `::before` behind the content (z-index -1 inside a z-index 0
box), the box keeps only the rim and shadow, and the capsule lost its `overflow: hidden` (the tabs
clip their own labels instead). Same for the search circle. Looks identical (captures compared).
The v128 nudge stays as a second line. `test-barra-busca.mjs` 21 checks (the CSS keeps the blur off
the box that holds the buttons).

**v131 The Claude-app glass glitch, found and worked around.** v130 did not fix it, so a throwaway
probe page took it apart on the user's iPhone. Round 1 (four glass bars built four ways over loud
CSS-gradient blocks) was clean in the Claude app, which ruled out the glass structure and the sliding
pill. Round 2 added real `<img>` covers and three ways of switching (rebuild, kept tabs with
content-visibility, kept tabs with display: none): every glass bar glitched in every mode. So the
trigger is any backdrop filter over images that just changed, in the Claude app's web view only
(Safari is clean); the photo's seams were the covers' edges, not the buttons'. Round 3's bar that
goes solid for 0.7s after a switch and fades back to glass never showed it, and the user asked for
it in the Longbox: `data-trocando` on the tab bar for 700ms after any tab or hub change turns both
glass layers to a 96% solid, then a 250ms fade restores the glass. Applies everywhere (the user
agent was not compared; in Safari it is only a brief solid moment). v128's nudge removed.
`test-capa-hub.mjs` 40 checks.

**v132 Critique 4, batch 1: accessibility and copy.** Critique 4 scored v131 31/40 (27 -> 28 -> 29 ->
31; snapshot committed). Its phone-sheet P1 (status below the fold) was an artefact of the 390x844
emulation; on the user's iPhone the status shows without scrolling, so it was dropped. This batch:
`lang="pt-BR"` set at mount (the host skeleton's <html> has none, so VoiceOver used an English
voice); one hidden h1 per surface ("Longbox, início" in the hub cover, "Longbox, <tab>" under it);
the phone tab bar is named "Seções"; a skip link ("Pular para as capas/coleções/séries"), visible
only when Tab reaches it, focuses the tab's first item; série counts read "55 de 100 possuídas"
(rows and the sheet's blocks; the eye still sees 55/100); "+ Edição" says "Nova edição" and N makes
one while the série card is in front (listed in the ? panel); the map's instruction is a sentence in
normal case; the band count uses the UI face; "Esconder todas" points up, "Mostrar todas" down.
`tests/test-acessibilidade.mjs` (17 checks, 15 failed first).

**v133 Critique 4, batch 2: the phone.** From a preview of real captures the user approved: under
768px the publisher band is one row (publisher left, the count beside it, which had vanished under
520px, and the tab's fold-all as a ChevronsDownUp/UpDown icon at the right, passed by the page only
on a phone and hidden while searching or under the séries character filter); the tabs' own
"Esconder todas" row is hidden there, so covers start ~110px higher. Sheet headers become a grid:
the title takes the whole width and the actions sit end-aligned on the subtitle/stepper rows, so
"Batman: Ano Um" and "Nightwing (Volume 2)" no longer break around the icons. The série map's tiles
share the row (grid, minmax 44px) instead of stopping ~20px short. Touch floor: the icon-only New
buttons get min-width 44px, the publisher select 44px tall on coarse pointers. The twin cyan squares
(filter and "+"): of two options (A filter outlined, B "+" named) the user chose B, so "Novo
volume / Nova coleção / Nova série" keeps its word on a phone (the search left the header in v129)
and only folds to "+" under 360px. `test-barra-busca.mjs` 30 checks.

**v134 Critique 4, last batch, plus two Claude-app reports.** The user declined the denser tab-bar
glass and the stronger hub veil after a side-by-side preview (both stay as they were), and agreed to
drop "Zerar tudo" farther from Importar (it already confirms with counts and offers undo) and the
header "jump" on Coleções (the Novo button changes width per tab anyway; the alternative was a dead
filter button). Kept: the undo toast stays 15s instead of 8s when a removal took more than one thing
with it (a série with edições, or Zerar tudo). Two reports from the Claude iOS app: the hub cover's
header (wordmark, "Minha coleção") sat under the app's own top bar. The host pads :root by the top
safe-area inset, which the tabs' normal flow respects, but the fixed cover started at the very top;
it now pads its content and its sticky header by env(safe-area-inset-top). And the v132 skip link
showed over the tab band on the phone and could not be used: that web view counted a tap or an
automatic focus move as keyboard focus, and with :focus-visible only the link hid itself on the press.
It now shows on any focus (a click works) and does not exist on touch-only screens (no Tab there;
VoiceOver uses the v132 headings). The safe-area fix is unverifiable here: the user checks on device.
`test-acessibilidade.mjs` 22 checks.

**v135 The hub header, counted once.** v134 made the Claude-app hub worse: the user's photo showed
the hub header in the middle of the screen, over the suggestion. The cover got `padding-top:
env(safe-area-inset-top)` AND its sticky header `top: env(...)`; inside a padded scroller a sticky
offset is measured from the content edge, so the inset counted twice. Measured in Chrome with a
110px pad: top 0 rests and sticks at 110, top 110 at 220 (both at rest and scrolled). The sticky top
went back to 0; the padding stays.

**v136 No hole above the hub header in the Claude app.** After v135 the header sat right, but the
strip above it (the top inset, under the Claude app's translucent bar) was see-through, so the hub
scrolled past behind the app's bar like a hole over the header. Safari and the PC have a zero inset
and were fine. A `::before` on the cover's sticky header, `env(safe-area-inset-top)` tall, in the page
colour, now rides with it. Checked with a simulated 110px inset in Chrome: scrolled, the strip is
solid and the hub passes under it.

**v137 Hub unlock by wheel on the PC, and the tabs' header below the Claude app's bar.** The user
reported that on the PC, mostly on a first visit or reload and not always, wheeling with the hub's
scrollbar already at the bottom did not unlock it, while "Minha coleção" did. Reproduced in Chrome
(1707x960, several device scale factors), two causes, both in the wheel path of `useHubUnlock`:
(1) a notch lifts the cover ~100px but the unlock needs 120, and after 160ms idle the wheel counted as
released and the cover sprang back, so notches 200ms or more apart never added up (100px every 200 or
300ms: still locked after 15 notches); (2) since v126 a turn that scrolls into the end cannot lift the
cover, and only a 250ms pause re-read "at the end", so one unbroken spin from above never unlocked.
Fix: the idle release waits 450ms, and a spin that keeps pushing against the end for 400ms counts as a
new pull (arriving at the end still lifts nothing). After: every pace tried unlocks in 2 to 6 notches.
The first-visit pattern was not proven; the likeliest reading is that a first visit is when the hub is
scrolled down in one go. Three checks in test-render (slow notches, arrival mid-spin does not lift,
pushing on enters), shown failing before the fix.
The offered follow-up to v136: in the Claude iOS app the tabs' sticky header pinned at the window
top, under the app's translucent bar (the host pads :root, but a sticky offset on the document counts
from the window edge). `--topo` = env(safe-area-inset-top) now joins the sticky tops of the header,
band and group headings, reset to 0 inside the hub cover (whose padding already clears the bar), and
the v136 `::before` strip moved from the hub's header to every header. Simulated 110px inset in
Chrome (phone 390x844): scrolled, header at 110, band at 172, solid strip above; hub header still 110,
not doubled; with 0 inset everything measures as before. Not verifiable here on the real app: the user
checks on the iPhone.

**v138 "Adicionar volumes" in the collection sheet: a search that picks several.** The user found the
field out of tone and slow: it was the last native select in the app, so its open list was drawn by
the OS (white border, system font, about half again wider than the field), and ten volumes meant ten
trips through an alphabetical list. Now a typeable field in the character filter's look, its list
flowing under it inside the sheet (the field is the sheet's last control), as wide as the field
(measured 407/407 on PC, 358/358 on a phone). Title and character are searched accent-free; the
collection's own characters come first. A tap marks a volume with the place it will take (1, 2, 3...)
and keeps the list open, a second tap unmarks; "Adicionar N volumes" adds them all in the order
tapped (the user's pick over year order), in one save with Desfazer. `adicionarMembros` replaced
`adicionarMembro` and the `addMemberSel` state. test-colecoes gained 15 checks, shown failing first.

**v139 No native select left; pickers locked to a publisher.** The user asked that a collection
not mix publishers and that "Vincular edições" offer only the volume's publisher, then found the
white-bordered OS list in four more places (volume Tipo and Editora, série Editora, the reading
order's status). The v138 picker became the shared `CampoBusca` in ui/Filtros.jsx (inline list,
multi-pick with numbers or single-pick) with `daEditora`: a collection adds only volumes of the
publisher(s) its volumes carry (none locked while empty); the volume sheet's série search shows the
volume's publisher only, its character's séries first, and a tap goes straight to linking (the
"Continuar" step and `linkPickSerie` are gone); the série sheet's "Vincular a um volume" (also a
native select, found while looking) shows the série's publisher only. An item with no publisher is
never hidden. Tipo, Editora and the status use OpcaoFiltro; inside a form its list scrolls into view
(it opened under the footer on PC) and keeps the field's width (the phone rule grew Tipo's list
off the modal's left edge). test-colecoes +14 checks shown failing first; test-formatos, test-lote5
and test-foco now drive the comboboxes.

**v140 The hub shelf holds 84.** `SHELF_CAP` 60 left the third row three short on the user's PC,
where the wall fits 21 a row; on their iPhone it fits 7. 84 fills four rows of 21 and twelve of 7
(and rows of 4, 6, 12, 14). The proportional sampling is unchanged. test-render's seeded library
grew to 100 volumes (Batman 64) so the cap is still exercised.

**v141 Pin up to three characters.** A pin on each character heading of the HQs and Séries tabs
(one shared list) puts that group first, pinned ones in the order they were pinned, the rest
alphabetical as before; the volume sheet's ← → follow the same order (`porFixados` in lib/util.js
replaces the three alphabetical sorts). A fourth pin is refused with a toast. The pin is muted until
pinned, then the publisher band's accent (`--ed-accent-text`, cyan under Todas). Stored in its own
document `library/fixados`, like library/meta: both devices, outside undo and backups, read once at
load (a pin made on the other device shows on the next open). tests/test-fixados.mjs, 13 checks,
shown failing first.

**v142 Pins live across devices.** `ouvirFixados` (lib/armazenamento.js) subscribes `onSnapshot` to
`library/fixados`, next to `ouvirMudancas`, so a pin made on the other device reorders the groups in
seconds without a reload. Own writes are remembered (`fixadosProprios`) so their echo never rolls the
list back when two pins are made quickly; a foreign change clears that memory. No toast (the group
just moves). Last write wins, no merge. tests/test-fixados.mjs grew to 20 checks (fake db with
onSnapshot and an external write), shown failing first.

**v143 ← → walk the série map; a #1000000 takes two tiles.** With an edição picked in the série
sheet, ← → pick the previous and next one in the map's own order (posicao first, so a #1000000 or a
Zero Hour #0 sits where its cover date puts it), over what is on screen (search, faixa), stopping at
both ends; the hundred-block the next edição sits in opens if folded, and focus follows the pick.
Same guards as the volume sheet's arrows (v88): not while typing, not with a modifier, not under a
modal. Listed in the shortcuts panel. Keyboard only, by the user's choice (no swipe on the phone).
The same session, the user saw a #1000000 break the map's columns (its seven digits stretched the
tile). Plain numbers now take one width per block, the block's longest (`--nd` digits, set by the
sheet; `--tw` resolves on the tile so `1ch` is its own mono digit), and a #1000000 among other tiles
takes two widths plus the gap (a phone grid cell span of 2); alone in its block it is a normal tile.
Same type size everywhere. A short label ("1M", "½") was tried and dropped: at #726 the neighbours
are three digits and the user wanted the full number. Other odd numbers (1/2, 23.1) keep their own
width for now. tests/test-setas-serie.mjs, 26 checks, shown failing first.

**v144 Every long number takes two tiles.** v143's rule for the #1000000 now covers any number
longer than its block's plain numbers (`--nd`): 1/2, 23.1, 1.5, 605.1 span two tile widths plus the
gap, so a block stays a rectangle whatever mix of odd numbers it holds. The user found Aquaman Vol 7
(#23.1-23.2) broken while séries with four decimals looked whole only by luck of the sum. On touch
(44px tiles) a three-character number (1/2, 1.5) fits one tile and stays single (`data-curto`). -1 and
0 fit a plain tile. Data, same session: Batman Vol 2's "23.1: The Joker" ... "23.4: Bane" became
"23.1"-"23.4" like the other five séries (the subtitle came from an old cadastro before the skill
stripped it), and X-Men Vol 2 / Fantastic Four Vol 3 "½" became "1/2". test-setas-serie 35 checks.

**v145 Reprints and creators on the edição.** Three optional fields on an edição in
`edicoes/<serieId>`: `autores` ({writer, penciler, inker}, each a list), `reimpressao` and
`origem` (free text). Old edições without them stay valid; every read goes through
`src/lib/edicoes.js`. A reprint carries a small dot on its tile and "Reimpressão de ..." in the
ficha; "Esconder reimpressões" takes their tiles off the map without touching owned/missing or
the totals (user's choice: owning a reprint is owning that book only, never "covers the
original"). The ficha lists Writer/Penciler/Inker, roles without a name are left out; the form
edits them as comma-separated text and drops `autores` when all three are empty, and unticking
"reimpressão" removes both fields. Data, same day: the reprint rule (the issue's FIRST story is a
`{{StoryGrab}}` on DC Fandom; the wiki's Category:Reprints also catches new issues with a
reprinted backup, like Flash #212) marked 8 Flash Vol 1 issues (#160 169 178 187 196 205 213 214,
the Giants and the three gaps in the user's #197-229 run), `origem` as the full source list (user
picked it over a short count from a throwaway preview). Creators for 2085 of the 2086 owned
edições from the wiki, 22 of them through a year-checked title map (23.x subtitles, Nightwing
Annuals as Vol 4, World's Best Comics #1); Spawn/Batman #1 has no credits there. The cadastro
skill now always fills creators. Tests: test-edicoes 18, test-reimpressoes 19, test-autores 13.

**v146 Search and filter by creator; a covered reprint counts as owned.** The search finds a
volume or a série through the creators of the edições the user owns ("waid", accent and case
blind on both sides, Busca.jsx folds too), and the Séries tab gets "Filtrar por autor" beside the
character filter: the owned edições' creators with a count each, combined with the character
(AND), counted on the filter button, released when its creator leaves the list.
PersonagemFiltro gained label props whose defaults keep the HQs tab word for word. Implemented by
Codex (gpt-6.1-sol, medium) from the plan's tasks 7-8 on the user's suggestion, reviewed and
re-run here. Same version, user's rule: DC reissues the originals, never the Giants, so a reprint
whose every source is on the shelf counts as owned everywhere (same green, counts, faltantes),
computed once in ownedEdicaoIds from the shelf only (no chains). A reprint now stores
`fontes: [{serie, numero}]` (Longbox série names, "(Volume 1)" ignored when matching); its ficha
says "Você tem X de Y histórias" with each source as tenho / falta / fora do acervo, or "Coberta
pelas originais" with the volumes holding them (and no "Nenhum volume vinculado" under it). The 8
Flash Vol 1 Giants got their fontes (none covered yet: the user owns from #197). Tests:
test-edicoes 31, test-reimpressoes 29, test-autores 26, test-filtro-autor 21.

**v147 Phone fixes, an author's edições lit on the map, and the final review.** From the user's
iPhone screenshots: the publisher list and the HQs filter lists opened from the trigger's right
edge and ran off the left of the screen; below 640px they now anchor left and never exceed the
viewport minus the 16px gutters (measured 16..320 and 16..200 of 390). The HQs filters were three
squeezed fields ("Todos os..."); on a phone they stack one per row with "Limpar" beside them, like
the Séries pair. With "Filtrar por autor" set, a série row says "N edições de <autor>", and the
open série lights that author's tiles and dims the rest (0.35, full on focus) under "Destacando as
edições de <autor>" with "Tirar destaque"; a Séries search that matches an author's name does the
same, partially. Built by Codex from a written brief, reviewed and re-run here. The final
whole-branch review (fresh reviewer) found no critical issue; fixed: the edição form now saves onto
the edição as it is now (a stale copy could erase creators or fontes that arrived while it was
open); a story printed only in the reprint, or a source the skill cannot read, is stored as
`{inedita: true}` and is never owned, so Flash #205 and #214 can never turn green on their reprinted
stories alone; the catalogue index is built once instead of on every shelf change (~18 ms each on
the PC); "José Marzan, Jr." and the other 74 ", Jr." credits no longer split in two on save. The
counter says "1 série", "1 coleção", "1 HQ". Eight minor review notes are left for later
(ledger). Tests: test-edicoes 48, test-reimpressoes 32, test-filtro-autor 22, test-destaque-autor 27.

**v148 The chevron closes the list.** The character and author filters (PersonagemFiltro) drew their
chevron as the field's background, so a tap on it was a tap on the field: it opened the list and
nothing closed it there (the user asked for it). A clear button now sits over the chevron's padding
(32px, 44px on touch) and toggles; the text area still only opens, since that is where you type.
Same day, data: "Image Comics" created (white, a greyscale colour, so the app keeps the Longbox
accent under it) and Spawn/Batman moved to it; the Batman/Spawn Deluxe Edition volume stays DC.
test-filtro-autor 32.

**v149 The search follows the publisher band.** The user reversed the old rule ("search ignores
the band"): the tabs, the suggestions and the "Filtrar por autor" options now follow lib.editoraSel
(Todas still shows everything). When the band hides every match, a notice says "Nada em <editora>.
N resultado(s) em outras editoras." with "Ver em todas as editoras"; the band's "Buscando em todo o
acervo" note is gone. The author options count séries, like the character filter, and a saved
author survives a casing/accent variant. Review details done in the same version: unticking an
edição that was a reprint stores `reimpressao: false`, the user's "no", which the cadastro skill
never overwrites (its report lists such edições as "recusadas"); the ficha says "Você tem X de Y
edições originais" (inédita stories listed apart); two séries folding to one name no longer
resolve silently: the reprint's own publisher wins, otherwise the source counts as not found.
Codex could not build in its sandbox this time (no read access above the repo); done here. Tests:
test-edicoes 55, test-editora-busca 10, test-render's search lines rewritten to the new rule.

**v150 The volume sheet gets the tile widths too.** The user spotted #1000000 wrapping onto two
lines in a volume's séries block ("Detective Comics (Volume 1)" with "Gerenciar"): the v143/v144
rule (plain numbers share one width per block, a longer number spans two) only lived in the série
map; the volume sheet had its own tile code. The rule moved to lib/edicoes.js (digitosDoBloco,
formaDoTile) and both sheets use it. tests/test-tiles-volume.mjs 6 checks, shown failing first.

**v151 Two collection-sheet fixes.** (1) "Adicionar volumes": the first tap on "Adicionar N volumes"
only closed the list. Cause: CampoBusca closes on any pointerdown outside its root, and the action
buttons lived outside it, so the list collapsed under the finger and the click missed. The buttons are
now CampoBusca's `rodape`, inside the root. Test written failing first (74 passes, 8 failures). (2) "Cor
da barra" in Gerenciar coleção folds behind a dropdown header like "Ordem de leitura" (same classes),
per collection, kept for the session (`longbox:cor-recolhida`), expanded by default. Codex wrote both;
its sandbox could not build (esbuild "Cannot read directory ..."), so the build and `npm run check`
ran here. test-colecoes 82. Next, asked by the user the same day: B two publishers per HQ (one
personagem per publisher), C drag-follow reordering on the HQs tab, D the same on the Coleções tab.

**v152 Two publishers per HQ, and no more iOS zoom.** (1) On the iPhone, focusing "Adicionar volumes"
zoomed the page and kept the zoom: iOS does that for any field under 16px, and the pickers inside sheets
were 14px. On `pointer: coarse` the fields (.input, .select, .textarea, .pfiltro-input, .search input)
are now 16px; test-acessibilidade 25. (2) One owned volume can belong to two publishers (Batman/Spawn is
DC and Image): optional `tambem: [{editora, personagem}]` on the volume, the primary pair untouched, no
migration. `casaEditora`, `daEditora` and the discovered publishers go through `editorasDe()`; under a
publisher band the HQs tab uses the volume projected onto that publisher (`naFaixa`), so it groups under
that band's personagem; "Todas" shows it once under the primary pair. Writes (drag order, status) always
go to the real volume by id, and `ordem` is shared between the bands. A collection's lock stays the union
of its members' primary publishers, and an item passes when any of its publishers is in the lock. The
form has "Tambem publicado por" + "Personagem nessa editora". The hub's Editoras column counts the
volume in both, the totals once. Codex wrote it (it cannot build in its sandbox, so build and
`npm run check` ran here); tests/test-duas-editoras.mjs 50 checks. Queued: C drag-follow on the HQs tab,
D the same on the Coleções tab, E the same for the séries cards inside a volume (`ordemSeries` on the
volume, ring in the sheet-top colour).

**v153 Drag-follow reordering on the HQs tab, and Image Comics' chrome.** (1) Reordering HQs now feels
like the iOS home screen: after the 450ms hold the card is glued to the pointer (grab offset kept, scale
1.06 and a shadow), the others slide by FLIP, it can go anywhere on screen but only counts inside its own
personagem group (the grid's box plus 16px): outside, the preview returns to the starting order and
releasing cancels, the card gliding back. Releasing inside settles it into the slot (200ms). Near the
top/bottom edge the page auto-scrolls (max 14px/frame, proportional to depth). The wiggle, the fill ring,
click suppression and the rule that writes go to the real volume by id stay. The geometry lives in
src/lib/arrastoSeguir.js (pure: nearest slot, expanded box, auto-scroll speed, follow transform) so the
Coleções tab and the séries cards in a volume sheet reuse it; tests/test-arrasto-seguir.mjs 27 checks.
Checked in Chrome with synthetic pointer events: it follows, moves slot by slot, cancels outside, scrolls
(the harness tab was hidden, so timers ran at ~3 Hz; run with a requestAnimationFrame shim). Codex wrote
it; the build and tests ran here. (2) Image Comics (white) left two defects: the open tab's label was
white on the white pill on hover (the hover rule beat the measured ink; the open tab's hover now keeps
--ed-cor-tinta) and the header/band buttons wore the Longbox cyan because a greyscale colour lends no hue.
A white or very light grey publisher now sets `data-ed-neutro` on the header and the band: light buttons
with dark ink in the dark theme, graphite with white ink in the light theme (both >= 16:1).
test-contraste 12, test-arrasto-seguir 27, test-duas-editoras 63.

**v154 The drag behaves like iOS (three defects from the user's real use of v153).** (1) The lifted
group painted over the header, the band and the logo: elevarCamadas() put z-index 1000 on every ancestor
of the dragged card while the chrome is 20 (.topbar, .tabbar) and 15 (.ed-band). Lifted ancestors and the
dragged card now sit at 8, above the other groups and under the chrome. (2) Moving the last HQ to the
first place made the hole travel one slot per 220ms. The order is now rebuilt at once for the slot under
the pointer: the original order without the dragged id, re-inserted at that slot, so the ones in between
shift by exactly one; the FLIP of the others starts from their current visual positions when it is
interrupted. (3) Neighbours "danced" near a boundary: the target came from the neighbours'
getBoundingClientRect(), which includes their in-flight FLIP transforms, so the measurement moved with the
animation. The target is now decided from the rect of every slot measured once when the drag arms (page
coordinates, re-measured on resize), expanded by half the gap so there are no dead zones; in no slot,
nothing changes. Checked in Chrome (synthetic pointer events, a hidden tab so timers ran slow): last to
first in one jump put it at index 0 with the rest shifted once; a pointer parked 2px either side of a
boundary switched once and stayed; the lifted ancestors computed z-index 8 and elementFromPoint on the
header and band returned the chrome. test-arrasto-seguir 58, test-duas-editoras 70.

**v155 Drag-reorder on the Coleções tab, auto-scroll from under the chrome, a tighter header.** (1)
Long-press a volume in a collection's row, the ring fills, then drag: the order of `colecao.membros`
changes (the Gerenciar sheet's "Ordem de leitura" is the same list, so both methods edit one thing) and
the 01, 02... badges renumber live. The row is a scroll container that would clip a lifted card, so the
dragged card is a fixed ghost on <body> (src/lib/arrastoGhost.js, reusable) while the original keeps its
box as the hole; on release the ghost glides to the slot. The strip scrolls sideways near its edges
(slots are measured in content coordinates), the page scrolls vertically, a release outside the strip
cancels. The ring colour is the collection's own bar colour, else the accent the bar itself draws with
(`--ed-accent`, resolved at press time because the ghost lives outside .app). The reusable parts are the
pure helpers in src/lib/arrastoSeguir.js and the ghost; the HQs hook stays as it was
(src/telas/useArrastarColecao.js beside useArrastarVolumes.js). (2) The page auto-scroll's zone is now
measured from the bottom of the sticky chrome (the publisher band, the floating tab bar at the bottom on
a phone), not from the window top, and a pointer over the chrome scrolls at full speed:
limitesDeRolagemDaPagina; the user had to drag up into the header to scroll up. (3) The dragged HQ now
sits above the sticky group headers (z 10) and the filter panel (12) at z 14, still under the band (15)
and the header (20); DRAG_Z_INDEX is 14 in the hook, the CSS and the ghost. (4) The desktop header is
60px instead of 76 (--topbar-h): the user saw dead space between the Claude artifact bar and the Longbox
strip; every offset derives from the variable. Checked in Chrome (synthetic pointer events, hidden tab):
the collection drag reorders and renumbers, the strip scrolls sideways, a release below the strip cancels
and leaves no ghost; on the HQs tab a pointer 12px under the band scrolls the page up.
test-arrastar-colecao 52, test-arrasto-seguir 82+.

**v156 Header back to 76px.** v155 shrank the desktop header from 76px to 60px to "remove the gap above
the Longbox strip" the user pointed at. It was a guess and not what they asked for; the user asked to put
it back. The real gap (a ~7px strip between the Claude artifact bar and the header where the top of a
scrolled cover shows, visible in the user's screenshots) could not be reproduced in the harness nor in the
live app in the PC Chrome tried here (the header sits flush under the 30px host bar), so it is open:
needs the user's environment (Claude desktop app or browser, zoom).

**v157 Reorder the séries inside a volume, and the top strip on a PC.** (1) In a volume's sheet the
séries cards ("Edições coletadas") reorder with the same hold-and-drag: the hold arms on the card's
background, its title and empty space, never on the edição tiles or "Gerenciar" (they keep opening what
they opened); the fill rises in the sheet's top colour with a ±0.4° wiggle; a ghost of the card (z-index
90, above the sheets at 41 and the toasts at 60, under nothing the user needs) follows the pointer, the
others glide to their places; releasing outside the block cancels; the sheet body auto-scrolls near its
edges. The order lives in the new optional `ordemSeries: string[]` of THAT volume only ("?" is the key of
the "Série removida" group); `edicoesDoVolumeAgrupadas` sorts by it and puts séries linked later after the
listed ones; normalizeLib keeps it when it is an array of non-empty strings. The cards have variable
heights, so the insertion index is computed from the cards' stacked midpoints as if the dragged card were
not there (`indiceDeInsercaoVertical`): it depends only on the pointer, never on where the hole is, so it
cannot oscillate. A modal opening mid-drag cancels it. Codex wrote it; it crashed every suite with a null
`visual.order` (volumeId undefined === undefined when the sheet is closed), fixed here, and one test went
looking for the backup button on the wrong screen (it lives in the hub footer). Checked in Chrome on a
scratch harness page with three séries of different heights: a hold on the third card's title and a drag
to the top put it first at once; a release persisted it and removed the ghost; a window blur reverted it;
a hold on a tile or on "Gerenciar" never armed. (2) The ~7px strip between the Claude artifact bar and the
header, with a cover showing through while scrolling (reported on the user's PC in the browser and in the
desktop app, at 100% and 90% zoom; not reproducible here): the safe-area top inset reaches the page in
two places, the sticky offset `--topo` and the padding the host adds to :root (the hub cover has its own).
Both are dropped for `(hover: hover) and (pointer: fine)`; touch devices keep them. A guess from the
evidence; the user checks. test-arrastar-series 60, test-arrasto-seguir 94.

**v158 "Atualizada em outro aparelho" was the tab's own writes (key order), and a calmer card.** After
the reorder features the user got "Biblioteca atualizada em outro aparelho" again and again on one
device. Cause: a save re-reads the document and compares it, as TEXT, with what the tab last wrote
(`store.last*`, JSON.stringify); the server hands objects back with their keys sorted, the tab writes
them in the order it holds, and a field added later (`tambem` on the Spawn/Batman volume, `ordem` the first
time a volume is reordered, `ordemSeries`) sits last in the tab's order. Same data, different text: the
save took its own earlier write for another device's, merged and announced it, once per save after the
first. normalizeLib also moved `tambem` to the end of its volume since v152. Reproduced first in
tests/test-sincronia.mjs with a mock server that sorts keys (3 saves in a row, a volume with tambem): the
toast appeared. Fix: `canon()` (JSON of the value with every object's keys sorted, arrays keep order) in
src/lib/armazenamento.js for the `last*` fingerprints, the change test, the "did the server move" test, the
echo check (`ehPropria`) and `aplicarMescladas`; and the item equality inside src/lib/mesclar.js, which had
the same flaw (a base item with sorted keys against the tab's own order read as "changed here" and would
have beaten another device's edit; a unit check covers it). Not touched: the pins document, whose values
are lists of strings. The séries card ghost no longer tilts at 320ms (a wide card's corners move too much);
it breathes (scale 1 to 1.012 over 1.4s). A real second device still gets the toast, as before.
test-sincronia 41.

**v159 Two hairlines.** (1) The wave of the hold fill (`.vol-hold__crest`) positions its band with
`--hold-h`, which only exists after a press; before it the band sits at a default 210px, INSIDE any card
taller than that. A série card in the volume sheet with 5+ rows of edições (taller than 210px) drew a
wave stripe at rest. Reproduced on a scratch harness page (cards of 255 and 325px, `mask-position-y`
210px at rest). The crest now has `opacity: min(1, calc(var(--hold-p, 0) * 1000))`: it is not drawn while
nothing is filling. (2) The strip above the header on the user's PC, which three guesses (v155's 60px
header, v157's inset) did not touch: a temporary read-only measuring panel (Ctrl+Alt+D, removed again)
showed `.topbar top: 1.0` with the page at the top: the 1px scroll sentinel (`<div style="height:1">`
before the header, for the IntersectionObserver that sets `data-scrolled`) was in the flow and pushed the
sticky header 1px down, leaving a hairline through which what lies behind showed; it vanished once the page
scrolled, which is what the user described ("only when I have not scrolled"). The sentinel is now
absolutely positioned; `.topbar top` is 0 and the pixel at y=0 belongs to the header. The v157 inset
override stays (harmless on a PC). test-acessibilidade 28.

**v160 Scroll on the HQs tab on the phone.** Every cover had `touch-action: none` in the CSS all the time
(since the v30 drag), so a finger that landed on a cover could never scroll the page; with four covers a
row that was almost everywhere. Removed. The drag now blocks the page's scroll with a non-passive
`touchmove` listener on each HQs grid that exists from mount (`gradeRef` in `useArrastarVolumes`) and only
prevents default while a drag is armed; iOS ignores a blocker added after the touch began (the old window
listener was added when the drag armed) and ignores a `touch-action` changed mid-touch. Chosen on the
user's iPhone (Claude app) with a throwaway probe artifact with four variants (A as before, B window
listener, C grid listener, D C plus `overflow:hidden` on the page): all scrolled and dragged, B had a
`pointercancel` once, D had an 89 ms frame, C had zero cancels and the best worst frame (26 ms); the probe's
edge auto-scroll (same formula as `velocidadeAutoScroll`) worked with C too (2374 px). Not touched: the
Coleções and Séries drags (they set `touch-action` only when armed). `-webkit-touch-callout: none` on the
covers. test-duas-editoras: armed drag blocks touchmove on the grid, idle one does not (71).

**v161 HQs drag: group head over the covers, calmer glide.** (1) When a drag armed, `elevarCamadas` raised
the z-index of every ancestor of the cover, including the grid (`.shelf`) itself: measured grid z 14 against
the sticky `.group-head` at z 10, so ALL covers of the group painted over the personagem's name/bar, not only the
dragged one (user's screenshot). The grid is no longer lifted (measured now: z auto, section.group 14, head 10); the
dragged cover keeps its own z 14 from `.vol[data-dragging]`, the others sit under the head like they do under the
publisher band. (2) The neighbours' FLIP glide: measured in headless Chrome (390px phone viewport, CPU 4x, 14
covers, the dragged cover flipped between slots 1 and 9 with 560/500/250/120ms holds): wrap-around covers moved up to
42.9 px a frame, 14 frames over 20 ms, worst frame 238 ms. The layout effect did a forced layout per card
(`transform=""`, read rect, write, read again); it now resets all cards, reads all rects once, writes all inverted
transforms and forces ONE reflow. The curve is `--ease-out` for 260 ms instead of `--ease-in-out` for 220 ms: a
reversal mid-flight restarts a card with zero velocity, and an ease-in made each restart a stop-and-go.
After: frames over 20 ms 3-6, worst 29-35 ms, the trajectory leaves fast and settles (frame dump checked).
Method note: `elementsFromPoint` cannot be used to prove the stacking during a drag (the covers drop out of
hit-testing); the proof is the measured computed z-index of grid, section and head. test-duas-editoras 73.

**v162 (branch v162-escala, NOT the live Longbox: published only as a separate preview artifact) - desktop 90%.**
The user always browses at 90% browser zoom and wants that as the default on a PC. `zoom: 90%` (v58) broke
the drag math and an earlier ~v80 multiplier (never in git, git starts at v86) shrank things too much, most
likely because rem text and px values were scaled twice. This time ONE ruler: `scripts/px-para-rem.mjs`
(written by Codex) converts every px length of `src/styles.css` to rem (639 converted; kept: 65 `1px`
hairlines, 16 `0px`, 40 media/@supports conditions, 69 in comments; idempotent, run twice = 0 more), and
`@media (hover: hover) and (pointer: fine) and (min-width: 1280px) { html { font-size: 90% } }` does the
scaling on a PC only. Real browser zoom 90% also widens the CSS viewport by 1/0.9, so the grid fits more
columns; a root font-size reproduces that, `zoom` would not. Checked against REAL Chrome zoom (puppeteer
deviceScaleFactor 0.9 at 1707x960 CSS px vs mine at 1536x864, the app's own rule neutralised in the real
run), same DOM, 107 elements on HQs: root 14.4px vs 14.4px, covers 111.6x206.9 in both, mean position error
1.2 px, max 2.8 px (Colecoes 1.4/2.7, Series 1.0/2.7, volume sheet open 1.1/3.5): the residual is the 1px
hairlines (not scaled, like zoom floors them) and unscaled px in JSX inline styles / SVG icon sizes (audited
by Codex, deliberately left). Tests that asserted px now assert rem (16px -> 1rem in test-acessibilidade,
44px, -12px, 48px). Preview artifact: separate, db copied from the real library (the preview's db came up
EMPTY, unlike what DESIGN.md says for a second artifact; 270 docs copied with ArtifactData batches), contract
pinned to 0.2.46. Covers: asset ids belong to the real artifact's store, expect drawn/missing covers there.

**v163 HQs drag: spring glide that keeps velocity.** The user (phone) found v161's glide still abrupt,
mostly when a card changes row (it crosses the row diagonally) and when the dragged cover is flipped between
two slots: a CSS transition restarts a mid-flight neighbour with ZERO velocity. The neighbours now ride a
critically damped spring (`src/lib/mola.js`, `OMEGA = 20` rad/s, exact analytic step so any dt is stable,
rest at < 0.3 px and < 8 px/s). `useArrastarVolumes` keeps `molasRef` (id -> visual offset + velocity); on every
reorder it rebases the offset to the new natural slot (position continuity from the rect captured before the
render) and KEEPS the velocity (velocity continuity); one shared rAF loop writes `translate3d` and lets the
springs settle even after pointerup. Codex wrote it from a brief; its first version had a real bug found in a
temporary log: it used the rAF timestamp (frame START) against `performance.now()` taken in the layout effect,
so the first dt was NEGATIVE (-25 ms), the spring stepped backwards and invented -4600 px/s (the card jumped
50 px forward and back). Fixed with `performance.now()` in the frame, dt clamped to [0, 1/30], and
`passoMola` itself ignores dt < 0 (test). Measured in headless Chrome (390px phone viewport, CPU 4x, 14 covers,
dragged cover flipped slot 1 <-> 9): max frame-to-frame acceleration 33-36 px -> 8.5-16 px, max step 33-36 ->
17-25 px, direction reversals 80 -> 48-66. Feel on the iPhone is the user's to confirm; knob = OMEGA.
tests: test-mola (17), test-duas-editoras now asserts the neighbour has `transition: none` + `translate3d`.

**v164 HQs drag: dwell before the order changes; the spring (v163) is gone.** The user's remaining complaint on the
iPhone: moving the dragged cover between spaces at the LIMITS of the group made the block shake violently, worse
when a card changes row. Cause (read in the code, then measured): `atualizarSlot` decided on every frame, and
leaving the group's box reverted the preview at once, so crossing the edge or sliding over intermediate slots
reordered the whole block back and forth, each time sweeping the neighbours. The order (or the revert) is now
applied only after the pointer has asked for the SAME order for `DWELL_MS = 110` ms (iOS rearranges when the
finger dwells); a different wish restarts the timer; on pointerup the order under the pointer applies at once.
Chosen by the user on their iPhone in a throwaway comparison page (dummy panel with Deslize Transição/Mola x
Espera 0/110/200 ms, on a db copy of the library, branch v164-teste): 110 ms fixed it and beat 200 ms; they
preferred the plain CSS transition (ease-out 260 ms, the v161/v162 glide) over the v163 spring, which did not
change their problem (measured too: spring alone -6% travel). So v163's `src/lib/mola.js` and its test were
removed (tag v163 keeps them). Finger-path measurement (390px viewport, CPU 4x, continuous 10px steps every
16 ms through intermediate slots and out of the group's box and back): order changes 22 -> 12, neighbours' total
travel ~13700 -> ~6800 px. tests: test-duas-editoras 75 (quick pass changes nothing, release applies at once).

**v165 Lista de desejos (wish list).** Designed with the user on 2026-10-06 (spec
docs/superpowers/specs/2026-10-06-lista-de-desejos-design.md, plan docs/superpowers/plans/2026-10-06-lista-de-desejos.md).
A cart, not a tab: phone = a third glass circle in the floating tab bar (no room in the top bar: measured 46px
over at 393px; user chose it over folding "Novo volume"); PC = just left of the search; hub = left of "Novo
volume"; key 4. The list is a fixed layer (z 35) over the current tab, grouped by publisher (ignores the band),
then by character (GroupHead, own 3 pins in library/fixadosDesejos), loose covers first (HQs drag, `chave`
"desejos"), then the character's wish collections (strip numbered n+i+1 after the linked acervo collection, so
A Saga do Flash shows 18-21). Long-press on a collection title collapses that character's collections into
rows and drags one (useArrastarColecoesDesejo, shadow only, no tilt/breath). Search (title + collection name),
filters formato/personagem/editora, fold all (PC button; phone icon right after the count) plus one fold per
publisher heading (user asked for both). A wish is a volume without status, `notas` for shop/price. "Comprei"
(sheet, undo, no confirm) moves it to library/volumes as nao_lida and into the linked collection at n+i, or
creates the acervo collection from the wish one and links it; an emptied wish collection disappears. Data:
library/desejos + library/desejosColecoes in DOCS (merge, live sync, echo), deleteSerie/deleteEdicao clean
wishes, EMPTY_LIB has both (its absence broke "Zerar tudo" + undo, caught by test-desfazer). Ownership still
reads library/volumes only. Known corner: buying a collection's volumes out of order appends (fix by dragging
in Coleções). Fixes after the user's iPhone preview: character heads stuck under the list's own header
(measured height, no publisher strip), the strip-drag ghost was drawn under the z-35 layer (criarGhost lifts it
to 40 inside .desejos-capa), ghost of a collapsed row styled as a row, phone header two rows (back, title, fold /
search, filters, +). Codex (gpt-6.1-sol high) wrote tasks 1-4 from briefs; Claude built, fixed, verified in
headless Chrome and the user checked a preview artifact (KLSkJe9wExoWs7xRhGEFq8, theirs to delete). Bundle
ceiling raised 450 -> 500 KB (production is ~464 KB now). tests: test-desejos-dados 24, test-desejos 26,
test-arrastar-colecoes-desejo 48, test-desejos-tela, test-sincronia 92.

**v166 Coleções character filter; empty-state button icon.** The filter button now shows on Coleções too,
with one "Filtrar por personagem" field (same PersonagemFiltro as Séries, collection counts per name). A
collection belongs to every character any of its volumes has (user's choice A: a crossover saga shows under
each), counted only within the publisher band (presencas of each member, editora matched to the band); the
choice is released when the band leaves the character with nothing, and lasts the session
(`longbox:filtro-colecoes`, through lerFiltroSeries/salvarFiltroSeries with a key). `.empty svg` greyed every
icon in an empty state, the "+" of "Novo desejo" included; now `.empty > svg`. tests: test-filtro-colecoes 9.

**v167 HQs drag: drop in the empty space after the last card.** The user could only move a cover to the
end by dragging it onto the last occupied position. Decision: `slotNoPonto` now returns the LAST slot's
index (previously `null`) when the pointer is in the empty space to the right of the last card, within
that card's vertical band; releasing there puts the dragged cover at the end and shifts the others.
Applies to HQs, Coleções and the wish list, which share `slotNoPonto`; the Séries tab does not use it and
is unchanged. A full row has no empty drop zone; empty space in rows above or below still has no target.
tests: test-arrasto-seguir updated.
Also in v167: dragging a loose wish opened the hub. `elevarCamadas` forced `z-index: 14` on every
ancestor, which sank the wish-list cover (`.desejos-capa`, z 35) under the hub (z 35, earlier in the DOM).
It now skips any ancestor already at or above the drag layer.

**v168 Critique 5 (29/40, v167): wish-list header and 390px gutter.** Critique 5 (snapshot
`.impeccable/critique/2026-10-07T16-18-24Z__harness-index-html.md`) scored 29/40, down from 31 because of the
wish list. Done: the cart button inside the wish-list screen is gone (desktop only; the back button closes it,
key `4` and the tab-bar cart still toggle), which also drops the duplicate count. On a 390px phone the HQs/Coleções
top row (wordmark, filter, "Novo ...") overflowed the 16px gutter by 11px because the zero-width status items
each still take a flex gap; the gap is 6px at <=420px (button now ends at 374 of 390). Checked and NOT changed:
`.group-toggle` measures 26px but its `::after` stretches the hit area over the whole group row (false positive);
`.shelf-track` (30px) is a scroll scrubber and stays. Left for later, not asked: three fold-icon scopes, wanted
items looking like owned ones, no touch hint for drag/pin/Gerenciar.

**v169 Critique 5 P2: the publisher fold button says what it folds.** On the wish list, each publisher's header
button was the same ChevronsDownUp icon as the phone's global fold, with a different scope. It is now a quiet
button with text, "Esconder personagens" / "Mostrar personagens" (icon 16px, right-aligned on the publisher row);
the h2 truncates with an ellipsis before the button wraps. The global header button, the group chevron and the
HQs/Coleções/Séries tabs are unchanged.

**v170/v171 Wish covers as reserved places.** Only `.desejos-capa .vol .cover::before` gets a `0.25rem` dashed border in
`color-mix(in srgb, var(--text) 55%, transparent)`, adapting to dark and light themes. The absolute pseudo-element uses
`inset: 0` (the cover's existing 1px border supplies the former outline's outer inset), `border-radius: calc(var(--r) - 0.0625rem)`
and `pointer-events: none`; at z-index 2 it crosses above `.cover::after`'s character stripe (z-index 1), below the cart badge (z-index 3);
the cover art uses `saturate(0.45) brightness(1.08) opacity(0.62)` over `var(--surface)` for a stronger pastel,
disabled-cover effect in both themes. Only the image or fallback art is filtered; the stripe and cart stay crisp.
A decorative wish-only span draws a `1.125rem` surface-backed
cart badge with a Lucide ShoppingCart SVG mask on its `::before`, preserving `.cover::after`'s character stripe.
Loose and collection wishes share the look, including drags inside the list; body clones keep existing styles.
All new sizes are rem. Data, acervo, hub, tabs, volume sheets and acervo ghosts are unchanged. No build or tests run.

**v172 Quiet gesture help.** "Atalhos e gestos" starts with six touch/mouse instructions, in full-width rows
without key caps. A Keyboard ghost button beside Exportar backup opens the same panel from the hub footer;
the existing separator still divides safe actions from library replacement, wrapping below 42rem. The keyboard note stays; no
automatic reminder, toast or tip. Shortcut and focus tests expect the new modal title. No build run.

**v173 Phone hub and light wish-list ink (critique 6).** At <=420px the hub's primary label
is "Coleção", with tighter inline padding to keep the 360px header inside its right gutter;
its accessible name stays "Minha coleção". Light wish fallbacks use opaque theme ink on a
separately filtered, 50% pastel background (>=4.55:1 even over black art). Real covers and
dark fallbacks keep their look. No build run.

**v174 Shortcuts panel, gestures only on touch (critique 6 P2).** On a coarse pointer the
"Atalhos e gestos" panel shows only the Gestos group; the keyboard groups and the note carry
the existing `.so-teclado` class (hidden at `pointer: coarse`). PC unchanged.

**v175 Séries group heads show owned/total editions (critique 6, user turned a declined idea
into a build).** `GroupHead` takes an optional `progresso`; AbaSeries passes the sum over the
group's séries (one count per série, a série split into ranges counts once, totals as a row
shows them: `totalEdicoes || eds.length`), rendered `N · owned/total` with a screen-reader
phrase. Open or collapsed. Séries tab only. Measured at 390 and 360: no overflow.

**Critique 6 closed (2026-10-09).** User decisions: wish cart badge stays at 18px (they might
even remove it, the dashed border and faded art already say "reserved": not asked to remove);
`.group-toggle` 26px is a false positive (the sticky `.group-head` makes its `::after` cover
the 44px row); the wish-list back-button focus ring is not a bug (real touch tap: no
`:focus-visible`; ring only after the `4` key or a scripted click); the first-load 404 was not
reproduced in the harness at 390 or 1280 (no failed request, no console error), probably the
host. Custom 404 page: not applicable (single artifact, no routes); offered instead a review of
the app's own empty/error texts, undecided.

**v176 Empty texts on Coleções and Séries (end of the empty/error text review).** When a
search or filter finds nothing, both tabs now say "Tente outro termo de busca ou limpe os
filtros." instead of repeating the "create your first one" text; the first-time text stays
for a truly empty library. Same pattern HQs and the wish list already had. The rest of the
app's empty/error texts were reviewed and left as they are (failed covers draw a fallback
cover; save/upload errors already name their cause).

**v177 Character counters count only the character's own range (user report, 2026-10-11).**
The v175 group-head counter summed the whole série for every character, so a série shared by
two characters (Green Arrow Vol. 2: Oliver Queen 0-101, Connor Hawke 102-138) overstated both
owned and total. New `edicoesNaFaixa(edicoes, faixa)` in `lib/biblioteca.js` (selects by
`sortKey`, i.e. position first, number as fallback) is now the single filter for the group
heads, the série rows and the detail sheet. A group counts the union of its ranges once per
issue and série; a ranged row's total is the number of catalogued issues in the range, an
unranged one keeps `totalEdicoes || eds.length`. Coleções has no such counter. Test:
`tests/test-faixas-series.mjs`. Real library after the fix: Green Arrow 4/196, Oliver Queen
1/159, Connor Hawke 3/44.

Data fix, not code: Green Arrow Vol. 2's faixa ended at 137, but "#1000000" (Nov 1998) sits at
position 138, so it fell outside. Set `ate` to 138 for Green Arrow and Connor Hawke in
`library/series` (doc version 81 -> 82). The faixa end is still a typed number: a final issue
positioned past it is dropped from the count. The user will handle such cases one by one.
The Annual of that série is registered for all three characters without a faixa, so it adds 7
to each total; left as is, the user can narrow it in the cadastro.

**v178 Faixa labels read the number of the first and last issue inside the range.** The
range still selects by position, but the ends shown ("Mostrando as edições X a Y", the
"(edições X-Y)" in a série row, the name of "Copiar faltantes") come from `rotuloFaixa`:
the `numero` of the first and last issue in the range (119.5 if that is the last), falling
back to the stored bound only when the range holds no issue. Connor Hawke therefore reads
"102 a 1000000".

**v179 Reloading on the wishlist keeps the wishlist open (user report, 2026-10-16).** The
wishlist is a layer over the app, like the hub, but only the hub's state survived a reload:
`desejosAberto` started `false`, so a reload dropped you onto the tab underneath. It now lives
in `sessionStorage` (`longbox:desejos-aberto`, `lerDesejosAberto`/`salvarDesejosAberto` in
`src/lib/sessao.js`), the same storage as the tab note: a reload keeps it, closing the browser
tab drops it. `tests/test-desejos-recarga.mjs` (5 checks) mounts twice, carrying the note over.

Library, same day: 11 DC Finest books were registered on the wishlist (`library/desejos`, 3
`desejosColecoes`), with 34 new séries and their issues. None counts as owned. The 8 books not
yet released carry a warning in `notas`: their contents came from the publisher's solicitation
and must be re-checked and re-mapped when bought. No covers were uploaded (the user adds them).

Library, 2026-10-16 (later): Nightwing: A Knight in Blüdhaven Compendium Four went on the
wishlist (47 issues, 4 new séries: Bloodborne, Outsiders: Five of a Kind - Nightwing/Boomerang,
Teen Titans Vol 3 and its Annual), with the not-yet-released warning in `notas`. Penguin and
League texts agree except "Titans #33" vs "Teen Titans #33" (Teen Titans Vol 3 #33 used).
Detective Comics #607 was moved to October 1989 (Fandom cover date). Nightwing Vol 2 runs to
#153; Compendium Four ends at #117, so a Compendium Five (maybe a Six) is expected: re-map
when it is solicited.

**v180 The hub's shelf becomes a featured character drawn in covers (2026-10-18).** The user
found "Sua estante" redundant with the cover backdrop and turned down a list of stats and a 3D
flip-through box (preview). They chose the emblem mosaic: each visit draws one character and
its emblem is laid out with that character's own covers, beside numbers from the collection.
- Emblems are fixed molds, never resampled (the first preview rescaled vector shapes per screen
  and looked different on every size): `src/lib/emblemas.js`, "#" takes a cover. Two sets, PC
  (up to 40 x 18) and phone (up to 16 x 16, the phone shelf shows a third of the PC's covers a
  row). 19 emblems, each drawn and checked with the user, several from references they sent
  (Batman, Nightwing, Flash, Superman, Aquaman, Wonder Woman, Justice League, Batgirl,
  Daredevil, Catwoman, Spider-Man, Absolute Flash). Rules they set: no holes, no loose pieces,
  exact symmetry where the logo is symmetric. Molds were made by one reviewer agent per emblem,
  up to three rounds, against a checker (`.superpowers/emblemas/moldes/ferramentas.mjs`,
  git-ignored with the references and the catalog pages).
- Pools: all Batman variants (Batman/Flash, Batman/Spawn, Earth 1, White Knight, Frank Miller)
  fill one bat; Batman/Flash also fills the Flash. Batman carries a library of six bat-symbols
  (`variantes`; the user's picks from LEGO Batman: Legends of the Dark Knight); the visit's seed
  picks one.
- Cover placement (`distribuirCapas`, `src/lib/mosaico.js`), rules the user approved: every
  volume appears once before any repeats, and the same cover never touches itself (left/above).
  With exactly two covers the second rule wins (checkerboard). The draw is uniform over every
  character with at least one volume (user's choice over weighting by volume count).
- Numbers: volumes, issues collected, read, and "edições publicadas entre X e Y" from the
  ISSUES' cover years, not the volumes' (user correction on the preview); no en-dash.
- Interaction: pieces fall into place from the centre; on a mouse a wave follows the pointer
  (rAF + CSS variables, idle when still); on touch one wave sweeps after assembly; a tap spreads
  the pieces into a grid of every volume in the pool (tap opens the volume), "Remontar o
  emblema" and "Outro personagem". Touch never blocks the hub's scroll or unlock gesture.
- Built by Codex from a brief; Claude added the bat library, the issue-year wording, a guard in
  the wave cleanup (it touched unmounted pieces and broke navigation in 8 suites), and raised the
  bundle ceiling from 500 to 540 KB (molds add ~30 KB; the ceiling only catches a dev React).
  Removed: `buildShelf`, `SHELF_CAP`, `.wall`; the shelf tests were rewritten for the highlight.

**v181 The hub backdrop drifts on its own (2026-10-18).** React Bits updated GridMotion so its rows
drift while the pointer is still; the user wanted only that, on top of our own grid (sizes, random
covers and mouse reaction unchanged), on phone too. Rejected for now: the spotlight, the faded
edges, and a conveyor that swaps in new covers (the user expects a continuous stream to show
repeats). Each row is a track holding its 13 covers twice; it slides ~24 px/s (rows alternate
direction, each at a slightly different pace) and jumps back by exactly one copy, which is
invisible because the copy is identical. The user's hard rule was that the jump must never flash.
First version laid both copies out side by side and a twin could land 1px off its original
(each tile pixel-snapped on its own): a 1px edge tick at the jump. Now each copy is its own layer
and the second is placed by transform at the copy's computed width plus the gap (fractions kept).
Proof (headless Chrome, motion frozen, tracks set just before and just after the jump): 0
differing pixels on a phone viewport and on PC (7 pixels differed, all on the "Falta pouco" bar
caps drawn over the backdrop). The conveyor pauses off screen, in a hidden tab and under reduced
motion. Also fixed an upstream bug: `gsap.ticker.add` returns the callback, not a remover, so
the mouse loop was never removed on unmount; cleanups now call `gsap.ticker.remove`.
Preview workflow, same day: a permanent preview artifact, "Longbox irmã", holds a copy of the
library and every cover, so a preview is now one publish (`.superpowers/irma/LEIA.md`).
