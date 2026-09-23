import { useState, useEffect } from "react";

import { STATUS } from "../lib/constantes";
import { coverColors, useCores } from "../lib/cores";
import { coverUrl, useMiniCapa } from "../lib/capas";

export function CoverArt({ volume, grande }) {
  const mini = useMiniCapa(grande ? null : volume && volume.capaAssetId);
  const [miniFalhou, setMiniFalhou] = useState(false);
  const usandoMini = !!mini && !miniFalhou;
  const url = usandoMini ? mini : coverUrl(volume);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); setMiniFalhou(false); }, [volume && volume.capaAssetId]);
  const c = coverColors(volume, useCores());

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
  return (
    <div
      className="cover-fb"
      style={{ "--fb-a": c.a, "--fb-b": c.b, "--fb-ink": c.ink, "--fb-ink-soft": c.inkSoft, "--fb-rule": c.rule }}
    >
      <div>
        <div className="cover-rule" />
        <div className="cover-fb-title">{volume.titulo}</div>
      </div>
      <div className="cover-fb-foot">{volume.personagem || ""}</div>
    </div>
  );
}

// Volumes carry an optional `ordem`: absent until the user drags one for the
// first time in that personagem group, so nothing changes until they ask for
// manual order. Ordered items sort by it; anything without one (new arrivals
// in an already-ordered group included) falls in alphabetically after them,
// which is what keeps a freshly catalogued volume from jumping to a random spot.
export function ordenarGrupoVolumes(itens) {
  const temOrdem = itens.some((v) => typeof v.ordem === "number");
  if (!temOrdem) return itens.slice().sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
  return itens.slice().sort((a, b) => {
    const oa = typeof a.ordem === "number" ? a.ordem : Infinity;
    const ob = typeof b.ordem === "number" ? b.ordem : Infinity;
    return oa !== ob ? oa - ob : a.titulo.localeCompare(b.titulo, "pt-BR");
  });
}

export function VolumeCard({
  volume, open, onClick, index, bare,
  reordenavel, personagem, dragging, holdColor, cardRef,
  onDragPointerDown, onDragPointerMove, onDragPointerEnd,
}) {
  const c = coverColors(volume, useCores());
  return (
    <button
      ref={cardRef}
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
