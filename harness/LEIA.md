# Browser harness

Mock of the artifact runtime (`window.claude` db + assets, seeded library) for
checking layout in real Chrome, which JSDOM cannot do.

    npm run build        # also refreshes harness/app.js and harness/styles.css
    npm run harness      # serves harness/ on 8768 with caching off (-c-1)
    # open http://localhost:8768/index.html

- `?lento` holds the db promise forever, so each tab's loading skeleton stays
  on screen to be measured (used for v68's skeleton alignment).
- Tab on load: set `sessionStorage["longbox:aba"]` to `volumes` / `colecoes` /
  `series` and reload.
- Typing into the search: click the field with the real mouse first; a
  script `focus()` does not route keyboard input from the automation.
- A background Chrome tab freezes CSS transitions; a screenshot forces frames.
  A sheet opened by a script is mounted at once but reads `data-in="false"`
  until a frame runs: take a screenshot before deciding it did not open. Two
  screenshots in a row on the hub can time out (the backdrop); v86 does the same.
- Automated mouse clicks on a cover are unreliable (the card listens for pointer
  events to arm the drag). `el.click()` from a script is deterministic.
- The reorder gesture can be driven with synthetic `PointerEvent`s: pointerdown
  on a card, wait past 450ms, pointermove to another card's centre, pointerup.

app.js / styles.css here are copies (git ignores them); `npm run build` rewrites
them every time, so they cannot go stale unless you skip the build. To compare
against a published version, `git show v86:dist/app.js > harness/app.js`.

## Light theme and tablet (v79)

- Light theme: the app only switches by `prefers-color-scheme`, so
  `npm run build:claro` writes the harness CSS with the light blocks forced on;
  a plain `npm run build` puts it back to dark.
- Tablet: `resize_window` does nothing on a maximized Chrome, so open
  `tablet.html?w=768&h=1024&varios=1024x768,1180x820,800x1280`: each iframe is a
  real viewport, so the app's media queries answer as on the device. Pointer
  type cannot be emulated this way (still a fine pointer), so touch-only rules
  (`hover: none`) are reviewed in code, not seen.
- Sideways-overflow check: compare `documentElement.scrollWidth` with
  `clientWidth` and try `scrollTo(300, y)`; a hidden hover label counts too.

## Real library (v80)

For performance, the fake library is too small. Read the live db read-only
(`ArtifactData` list of `library` and `edicoes` with `out_dir`), then swap the
`buildLib()` block in a copy of index.html for those JSON files. Covers cannot be
downloaded from the asset store; make stand-ins at the real size, 968x1500,
one per `capaAssetId`, into `_blob/` (`perf/gen.ps1`), then save them as **PNG**:
Chrome decodes a plain JPEG straight to a reduced size, so JPEG stand-ins hid the
real 475ms decode stall for three versions. `perf/mk.mjs <scratch>` builds the
page from the JSON files. The automation tab is often `hidden`, which freezes rAF:
time React + layout synchronously (click, two awaited microtasks,
`document.body.offsetHeight`) instead of counting frames.

## Frame-level tracing (v82-v86)

The automation tab in the user's Chrome reports `hidden` and draws no frames, so
for paint, compositing and image decoding drive a separate headless Chrome with
puppeteer-core. Install it OUTSIDE the repo (a scratch folder:
`npm i puppeteer-core@23`), copy `perf/*.mjs` there, serve the harness on 8769.

- `tracepc.mjs <page> <cpu> <from> <to> [profileDir]`: PC conditions (mouse,
  lattice on, 1707px at 1.5x, real mouse moves); `cpu` 4 is roughly a tablet. A
  fixed profileDir keeps IndexedDB between runs (thumbnails warm).
  `trace2.mjs` is the touch/tablet variant.
- Then `resumo.mjs` (long tasks), `quadros.mjs` (per-frame breakdown) and
  `quadro1.mjs` (image decode total, presented-frame gaps) read `trace.json`.
- `geo.mjs`: where the tab pill lands, old page vs new, to the hundredth of a px.

Headless is not the user's GPU: v82's scaled pill looked right here and showed a
gap on the real machine, and the decode stall never reproduced here at all. For
anything GPU-side, ship a temporary measuring panel into the app (v83-v85 did,
removed in v86) and let the user read it.
