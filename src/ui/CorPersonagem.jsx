import { Check, ChevronDown } from "lucide-react";

import {
  PALETA_CROMATICA, PALETA_NEUTRA, nomeDaCor, sameSpec, specForCharacter, swatchColors,
  useCores,
} from "../lib/cores";
import { Sheet } from "./base";

// The character is a real thing in this app, not just a field: it groups both
// tabs. So its heading is where its colour is set. onAlternar is what makes
// the group collapsible; both tabs pass it now, each with its own fold state
// (see lerGruposAbertos/lerGruposFechados below) and its own default.
export function GroupHead({ personagem, count, onPickColor, aberto, onAlternar, itemLabel = "séries" }) {
  const cores = useCores();
  const spec = specForCharacter(personagem, cores);
  const guardado = cores && cores[(personagem || "").trim().toLowerCase()];
  const custom = guardado !== undefined && guardado !== null;
  const cor = swatchColors(spec, 0).edge;
  // v112: the whole row folds the group (the name is a button inside the heading,
  // stretched over the row by CSS), and only the colour square opens the colour
  // picker. The name used to open the picker while only the chevron folded, and the
  // heading sat inside a button, which hid it from heading navigation.
  return (
    <div className="group-head" data-dobra={onAlternar ? "true" : "false"} style={{ "--grp-cor": cor }}>
      <button
        type="button"
        className="group-cor press"
        onClick={() => onPickColor(personagem)}
        aria-label={"Cor de " + personagem}
        data-dica="Cor do personagem"
      >
        <span className="group-swatch" style={{ background: cor }} data-custom={custom ? "true" : "false"} />
      </button>
      <h2>
        {onAlternar ? (
          <button
            type="button"
            className="group-toggle"
            onClick={() => onAlternar(personagem)}
            aria-expanded={aberto ? "true" : "false"}
            aria-description={(aberto ? "Esconder" : "Mostrar") + " as " + itemLabel}
          >
            {personagem}
          </button>
        ) : personagem}
      </h2>
      <span className="group-count">{count}</span>
      {onAlternar && (
        <span className="group-fold" aria-hidden="true">
          <ChevronDown size={16} data-rot={aberto ? "false" : "true"} />
        </span>
      )}
    </div>
  );
}

export function Swatch({ spec, atual, onPick, personagem }) {
  const nome = nomeDaCor(spec);
  const longbox = !!spec.longbox;
  const c = swatchColors(spec, 0);
  const on = longbox ? !!(atual && atual.longbox) : !(atual && atual.longbox) && sameSpec(atual, spec);
  // The label lives on a wrapper: the swatch clips its own overflow (the cover
  // miniature) and already uses ::after for its edge stripe.
  return (
    <span className="dica dica-swatch" data-dica={nome}>
      <button
        className="swatch press"
        style={{ background: "linear-gradient(160deg," + c.a + "," + c.b + ")", "--edge": c.edge, color: c.ink }}
        data-on={on ? "true" : "false"}
        onClick={() => onPick(personagem, spec)}
        aria-label={nome}
      >
        {on && <Check size={14} />}
      </button>
    </span>
  );
}

export function CorSheet({ personagem, cores, onPick, onClose }) {
  const bruto = personagem ? cores[personagem.trim().toLowerCase()] : undefined;
  const definido = bruto !== undefined && bruto !== null;
  const atual = typeof bruto === "number" ? { h: bruto } : bruto;

  return (
    <Sheet
      open={!!personagem}
      onClose={onClose}
      title={personagem || ""}
      subtitle="Cor deste personagem na estante"
    >
      <div className="swatches">
        {PALETA_CROMATICA.map((spec, i) => (
          <Swatch key={"c" + i} spec={spec} atual={atual} onPick={onPick} personagem={personagem} />
        ))}
      </div>

      <div>
        <p className="t-micro" style={{ margin: "0 0 8px" }}>Neutros</p>
        <div className="swatches">
          {PALETA_NEUTRA.map((spec, i) => (
            <Swatch key={"n" + i} spec={spec} atual={atual} onPick={onPick} personagem={personagem} />
          ))}
        </div>
      </div>

      <button
        className="btn btn-quiet"
        style={{ width: "100%" }}
        data-on={!definido ? "true" : "false"}
        onClick={() => onPick(personagem, null)}
      >
        {!definido ? "Usando cor automática" : "Voltar para a cor automática"}
      </button>
      <p className="t-small muted" style={{ margin: 0 }}>
        A cor vale para todos os volumes e séries deste personagem, e aparece na borda de
        cada capa, inclusive nas que você subir.
      </p>
    </Sheet>
  );
}
