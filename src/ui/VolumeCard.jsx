import { useState, useEffect } from "react";

import { STATUS } from "../lib/constantes";
import { coverColors, useCores } from "../lib/cores";
import { coverUrl, useMiniCapa } from "../lib/capas";

// v105: the full-size cover (volume sheet, hub suggestion). It used to be a plain
// lazy <img> with the full URL: the sheet slides in from off screen, so "lazy"
// held the download until the animation ended (a grey box for most of a second),
// and swapping volumes kept painting the previous picture until the new one had
// downloaded, so the hub's "Outro" could show one book's name over another's
// cover. Now the shelf thumbnail, already on this device, shows at once; the full
// cover downloads and decodes off screen and replaces it only when ready. The
// ready state is keyed by volume, so a stale picture is never shown for another.
function CapaGrande({ volume, c }) {
  const id = volume.capaAssetId;
  const mini = useMiniCapa(id);
  const [pronta, setPronta] = useState(null); // { id, url } once decoded, or { id, falhou }
  useEffect(() => {
    const url = coverUrl(volume);
    if (!url) return undefined;
    let vivo = true;
    const img = new Image();
    // decode() where there is one; plain load events otherwise (older engines, JSDOM).
    const pronto = new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
    img.src = url;
    (img.decode ? img.decode() : pronto)
      .then(() => { if (vivo) setPronta({ id, url }); })
      .catch(() => { if (vivo) setPronta({ id, falhou: true }); });
    return () => { vivo = false; };
  }, [id]);
  const desta = pronta && pronta.id === id ? pronta : null;
  const src = desta && desta.url ? desta.url : mini;
  if (src) return <img key={id} data-capa={id} src={src} alt={"Capa de " + volume.titulo} draggable={false} />;
  // Nothing on this device yet: the plain cover box waits (as before) unless the
  // full cover failed, in which case the drawn fallback takes over.
  if (!desta || !desta.falhou) return null;
  return <CapaDesenhada volume={volume} c={c} />;
}

function CapaDesenhada({ volume, c }) {
  return (
    // v112: read as one picture, like a photo cover's alt, instead of its typeset
    // title and character running into the card's own title ("…NinguemBatmanBatman").
    <div
      className="cover-fb"
      role="img"
      aria-label={"Capa de " + volume.titulo}
      style={{ "--fb-a": c.a, "--fb-b": c.b, "--fb-ink": c.ink, "--fb-ink-soft": c.inkSoft, "--fb-rule": c.rule }}
    >
      <div aria-hidden="true">
        <div className="cover-rule" />
        <div className="cover-fb-title">{volume.titulo}</div>
      </div>
      <div className="cover-fb-foot" aria-hidden="true">{volume.personagem || ""}</div>
    </div>
  );
}

export function CoverArt({ volume, grande }) {
  const cores = useCores();
  if (grande && volume && volume.capaAssetId) return <CapaGrande volume={volume} c={coverColors(volume, cores)} />;
  return <CoverArtEstante volume={volume} cores={cores} />;
}

function CoverArtEstante({ volume, cores }) {
  const mini = useMiniCapa(volume && volume.capaAssetId);
  const [miniFalhou, setMiniFalhou] = useState(false);
  const usandoMini = !!mini && !miniFalhou;
  const url = usandoMini ? mini : coverUrl(volume);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); setMiniFalhou(false); }, [volume && volume.capaAssetId]);
  if (url && !failed) {
    return (
      <img
        src={url}
        alt={"Capa de " + volume.titulo}
        // A thumbnail is already on this device and small, so it loads at
        // once. Left lazy, a cover in a hidden tab kept showing the full image
        // it had before its thumbnail arrived, and decoded that on the switch.
        loading={usandoMini ? "eager" : "lazy"}
        draggable={false}
        // A thumbnail that will not load falls back to the full cover, not
        // to the drawn one.
        onError={() => (usandoMini ? setMiniFalhou(true) : setFailed(true))}
      />
    );
  }
  return <CapaDesenhada volume={volume} c={coverColors(volume, cores)} />;
}

// Volumes carry an optional `ordem`: absent until the user drags one for the
// first time in that personagem group, so nothing changes until they ask for
// manual order. Ordered items sort by it; anything without one (new arrivals
// in an already-ordered group included) falls in alphabetically after them,
// which is what keeps a freshly catalogued volume from jumping to a random spot.
export function ordenarGrupoVolumes(itens) {
  const temOrdem = itens.some((v) => typeof v.ordem === "number");
  if (!temOrdem) return itens.slice().sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR", { numeric: true }));
  return itens.slice().sort((a, b) => {
    const oa = typeof a.ordem === "number" ? a.ordem : Infinity;
    const ob = typeof b.ordem === "number" ? b.ordem : Infinity;
    return oa !== ob ? oa - ob : a.titulo.localeCompare(b.titulo, "pt-BR", { numeric: true });
  });
}

// v114: a shelf is one Tab stop. Inside it the arrows move between covers (up and
// down by the row's width), Home and End jump to the ends, Enter opens; the next Tab
// leaves for the next character. Roving tabindex: the cover last focused keeps
// tabindex 0, every other one -1, set on the DOM so a re-render does not undo it.
export const gradeTeclado = {
  onFocus(e) {
    const card = e.target.closest(".vol");
    if (!card || !e.currentTarget.contains(card)) return;
    for (const c of e.currentTarget.querySelectorAll(".vol")) c.tabIndex = c === card ? 0 : -1;
  },
  onKeyDown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const itens = [...e.currentTarget.querySelectorAll(".vol")];
    const i = itens.indexOf(document.activeElement);
    if (i < 0) return;
    const topo = Math.round(itens[0].getBoundingClientRect().top);
    const cols = Math.max(1, itens.filter((c) => Math.round(c.getBoundingClientRect().top) === topo).length);
    const alvo = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + cols, ArrowUp: i - cols, Home: 0, End: itens.length - 1 }[e.key];
    if (alvo === undefined) return;
    e.preventDefault();
    itens[Math.max(0, Math.min(itens.length - 1, alvo))].focus();
  },
};

export function VolumeCard({
  volume, open, onClick, index, bare,
  reordenavel, personagem, dragging, holdColor, cardRef,
  onDragPointerDown, onDragPointerMove, onDragPointerEnd, tabParada,
}) {
  const c = coverColors(volume, useCores());
  return (
    <button
      ref={cardRef}
      tabIndex={tabParada}
      className="vol press"
      data-open={open ? "true" : "false"}
      data-vol-id={reordenavel ? volume.id : undefined}
      data-personagem={reordenavel ? personagem : undefined}
      data-dragging={dragging ? "true" : undefined}
      style={{ "--i": Math.min(index, 11), "--hold-color": holdColor || undefined }}
      onClick={onClick}
      onPointerDown={reordenavel ? onDragPointerDown : undefined}
      onPointerMove={reordenavel ? onDragPointerMove : undefined}
      onPointerUp={reordenavel ? onDragPointerEnd : undefined}
      onPointerCancel={reordenavel ? onDragPointerEnd : undefined}
      title={bare ? volume.titulo : undefined}
    >
      <div className="cover" style={{ "--edge": c.edge }}>
        <CoverArt volume={volume} />
        {reordenavel && (
          <>
            <div className="vol-hold" aria-hidden="true" />
            <div className="vol-hold__crest" aria-hidden="true" />
          </>
        )}
      </div>
      {!bare && <div className="vol-title clamp-2">{volume.titulo}</div>}
      {/* v75: the status in words beside the format, so it no longer rests on
          the bottom bar's colour alone. Unread says nothing: it is the default. */}
      {!bare && (
        <div className="vol-meta vol-meta-linha">
          {/* The format gives way when the row is tight; the status never does. */}
          {volume.tipo && <span className="truncate">{volume.tipo}</span>}
          {volume.status !== "nao_lida" && STATUS[volume.status] && (
            <span className="vol-status-wrap">
              {volume.tipo ? "· " : ""}
              <span className="vol-status" data-s={volume.status}>{STATUS[volume.status].label}</span>
            </span>
          )}
        </div>
      )}
    </button>
  );
}
