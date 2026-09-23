// Three skeletons, because the three layout families do not look alike and a
// skeleton that describes the wrong one is worse than none: it promises a screen
// that never arrives. Each one is shaped like the tab it stands in for.
// HQs (v68): the fold-all control, then covers grouped under character bands,
// the shape the tab has had since v57, not the one flat grid it had before.
export function ShelfSkeleton() {
  return (
    <div className="skel-wrap skel-hqs" aria-hidden="true">
      <div className="fold-all"><div className="skel-line" data-w="fold" /></div>
      {[7, 4].map((n, g) => (
        <div className="group" key={g}>
          <div className="skel-head"><div className="skel-line" data-w="name" /></div>
          <div className="shelf">
            {Array.from({ length: n }).map((_, i) => (
              <div key={i}>
                <div className="skel" />
                <div className="skel-line" />
                <div className="skel-line" data-w="short" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Séries: a character band over cards, each card a name, a meta line and a run
// bar. It borrows the real row's own class so the padding and border match
// exactly rather than being guessed at.
// Séries (v68): the tab opens with every character folded, so its skeleton is
// the fold-all control over a column of closed bands, and no rows.
export function SeriesSkeleton() {
  return (
    <div className="skel-wrap skel-series" aria-hidden="true">
      <div className="fold-all"><div className="skel-line" data-w="fold" /></div>
      {[0.2, 0.14, 0.24, 0.12, 0.18].map((w, g) => (
        <div className="group" key={g}>
          <div className="skel-head"><div className="skel-line" data-w="name" style={{ width: w * 100 + "%" }} /></div>
        </div>
      ))}
    </div>
  );
}

// Coleções: a title over a horizontal strip of covers, one strip per collection.
export function ColecoesSkeleton() {
  return (
    <div className="skel-wrap skel-colecoes" aria-hidden="true">
      <div className="fold-all"><div className="skel-line" data-w="fold" /></div>
      {[3, 2].map((n, g) => (
        <div className="coll" key={g}>
          <div className="coll-head">
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="skel-line" data-w="name" />
              <div className="skel-line" data-w="micro" />
            </div>
            <div className="skel-line" data-w="acao" />
          </div>
          <div className="coll-strip">
            {Array.from({ length: n }).map((_, i) => (
              <div key={i}>
                <div className="skel" />
                <div className="skel-line" />
                <div className="skel-line" data-w="short" />
              </div>
            ))}
          </div>
          {/* Only a collection too long for the row gets the spine bar. */}
          {g === 0 && <div className="skel-spines" />}
        </div>
      ))}
    </div>
  );
}

// The hub: the suggestion card, the hunt rows under it, and the three figures at
// the foot. The backdrop is left out, since it is built from covers that have not
// loaded yet and would only flash in.
export function HubSkeleton() {
  return (
    <div className="hub skel-hub skel-wrap" aria-hidden="true">
      <section className="suggest">
        <div className="suggest-cover"><div className="skel" /></div>
        <div className="suggest-body">
          <div className="skel-line" data-w="micro" />
          <div className="skel-line" data-w="title" />
          <div className="skel-line" data-w="short" />
        </div>
      </section>
      <section>
        <div className="hub-section-head"><div className="skel-line" data-w="head" /></div>
        <div className="prog">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i}>
              <div className="skel-line" data-w="row" />
              <div className="skel-run" />
            </div>
          ))}
        </div>
      </section>
      <div className="hub-foot">
        <div className="hub-figures">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="skel-line" data-w="figure" />
              <div className="skel-line" data-w="short" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
