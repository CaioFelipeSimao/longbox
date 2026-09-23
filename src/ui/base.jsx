import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

import { useEscape, useTransitionMount } from "../lib/hooks";

export function Field({ label, error, hint, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {error && <p className="field-error">{error}</p>}
      {hint && !error && <p className="field-hint">{hint}</p>}
    </div>
  );
}

export function Sheet({ open, onClose, title, subtitle, actions, children, recede }) {
  const [mounted, shown] = useTransitionMount(open, 220);
  // While another sheet is stacked on top of this one, it recedes instead of
  // closing: no scrim of its own (the front sheet's scrim already dims the
  // page), no escape-to-close (that must reach the front sheet first), and no
  // pointer events (its controls sit under the front sheet visually, but
  // without this they would still be clickable through the gap).
  useEscape(mounted && !recede, onClose);
  if (!mounted) return null;
  return (
    <>
      {!recede && <div className="scrim" data-in={shown ? "true" : "false"} onClick={onClose} />}
      <div
        className="sheet"
        data-in={shown ? "true" : "false"}
        data-out={shown ? "false" : "true"}
        data-behind={recede ? "true" : "false"}
        role="dialog"
        aria-modal="true"
        // pointer-events:none (in CSS) keeps the mouse out, but a receded
        // sheet's inputs and buttons would still be reachable by Tab and
        // still announced to screen readers without this: inert removes it
        // from both the focus order and the accessibility tree. React 18
        // does not treat `inert` as boolean (a bare `true` renders nothing,
        // silently, with only a dev warning) — it wants the empty string.
        inert={recede ? "" : undefined}
      >
        <div className="sheet-grab"><i /></div>
        <div className="sheet-head">
          <div style={{ minWidth: 0 }}>
            <p className="t-display" style={{ margin: 0 }}>{title}</p>
            {subtitle && <p className="t-small muted" style={{ margin: "3px 0 0" }}>{subtitle}</p>}
          </div>
          <div className="sheet-actions">
            {actions}
            <button className="btn-icon" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>
  );
}

export function Modal({ open, onClose, title, children, footer }) {
  const [mounted, shown] = useTransitionMount(open, 220);
  useEscape(mounted, onClose);
  if (!mounted) return null;
  return (
    <>
      <div className="scrim" data-in={shown ? "true" : "false"} onClick={onClose} />
      <div className="modal-wrap">
        <div className="modal" data-in={shown ? "true" : "false"} data-out={shown ? "false" : "true"} role="dialog" aria-modal="true">
          <div className="modal-head">
            <p className="t-display" style={{ margin: 0 }}>{title}</p>
            <button className="btn-icon" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-foot">{footer}</div>}
        </div>
      </div>
    </>
  );
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="empty">
      <Icon size={26} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

// One tab's content, kept mounted while hidden (v80). A hidden tab skips its
// renders entirely: its content is a function that is only called when the tab
// renders, and the memo holds while it stays hidden. Showing it again renders it
// once with the current state, against the DOM it already has.
// v81: the render that hides it reuses the last drawing too. Handing React the
// very same elements makes it skip the whole subtree; before, leaving the séries
// tab redrew all of its rows just to hide them.
export const Aba = React.memo(
  function Aba({ ativa, render }) {
    const ultimo = useRef(null);
    if (ativa || ultimo.current === null) ultimo.current = render();
    return (
      <div className="aba" data-ativa={ativa ? "true" : "false"} inert={ativa ? undefined : ""} aria-hidden={ativa ? undefined : "true"}>
        {ultimo.current}
      </div>
    );
  },
  (antes, depois) => !antes.ativa && !depois.ativa
);

export function Toast({ message }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const r1 = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(r1);
  }, []);
  return <div className="toast" data-in={shown ? "true" : "false"} role="status">{message}</div>;
}
