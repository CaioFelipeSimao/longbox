import React, { useState, useEffect, useRef, useId } from "react";
import { X } from "lucide-react";

import { useEscape, useTransitionMount } from "../lib/hooks";

// v100: the label and the error/hint are tied to the control, so a screen reader
// reads "Título, obrigatório" on the field and clicking the label focuses it. A
// single native control gets the id; a composite (status buttons, publisher
// picker, a row of inputs) becomes a group named by the label instead.
const NATIVOS = new Set(["input", "select", "textarea"]);

export function Field({ label, error, hint, children }) {
  const id = useId();
  const nota = error || hint ? id + "-nota" : undefined;
  const unico = React.isValidElement(children) && NATIVOS.has(children.type);
  const controle = unico
    ? React.cloneElement(children, { id, "aria-describedby": nota, "aria-invalid": error ? true : undefined })
    : children;
  return (
    <div className="field" role={unico ? undefined : "group"} aria-labelledby={unico ? undefined : id + "-rotulo"} aria-describedby={unico ? undefined : nota}>
      <label id={id + "-rotulo"} htmlFor={unico ? id : undefined}>{label}</label>
      {controle}
      {error && <p className="field-error" id={nota}>{error}</p>}
      {hint && !error && <p className="field-hint" id={nota}>{hint}</p>}
    </div>
  );
}

// v100: a dialog takes focus when it opens (the first field of a form, otherwise
// the dialog's scrolling body, so ↑ ↓ scroll it), keeps Tab inside itself, and
// hands focus back to whatever opened it when it closes. Only while `ativo`: a
// sheet receding behind another keeps its place without fighting for focus.
const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useFocoDialogo(ref, aberto, alvoInicial) {
  useEffect(() => {
    if (!aberto || !ref.current) return undefined;
    const antes = document.activeElement;
    const alvo = alvoInicial(ref.current);
    if (alvo) alvo.focus({ preventScroll: true });
    return () => {
      if (antes && antes !== document.body && antes.isConnected && typeof antes.focus === "function") antes.focus({ preventScroll: true });
    };
  }, [aberto]);
}

function prenderTab(e) {
  if (e.key !== "Tab") return;
  const lista = [...e.currentTarget.querySelectorAll(FOCAVEIS)].filter((el) => !el.closest("[inert], [hidden]"));
  if (!lista.length) return;
  const primeiro = lista[0], ultimo = lista[lista.length - 1];
  const dentro = e.currentTarget.contains(document.activeElement) && lista.includes(document.activeElement);
  if (e.shiftKey && (document.activeElement === primeiro || !dentro)) { e.preventDefault(); ultimo.focus(); }
  else if (!e.shiftKey && (document.activeElement === ultimo || !dentro)) { e.preventDefault(); primeiro.focus(); }
}

// nav (v88) is an optional row under the subtitle, used by the volume sheet for
// its ‹ 3 de 22 › stepping; it lives there rather than among the actions so the
// title keeps the header's width.
// tinta (v106) washes the top of the sheet in a colour (the volume's cover);
// variante lets one kind of sheet take its own width (the volume sheet widens).
export function Sheet({ open, onClose, title, subtitle, actions, nav, children, recede, tinta, variante }) {
  const [mounted, shown] = useTransitionMount(open, 220);
  // While another sheet is stacked on top of this one, it recedes instead of
  // closing: no scrim of its own (the front sheet's scrim already dims the
  // page), no escape-to-close (that must reach the front sheet first), and no
  // pointer events (its controls sit under the front sheet visually, but
  // without this they would still be clickable through the gap).
  useEscape(mounted && !recede, onClose);
  const ref = useRef(null);
  const id = useId();
  useFocoDialogo(ref, mounted && open, (el) => el.querySelector(".sheet-body"));
  if (!mounted) return null;
  return (
    <>
      {!recede && <div className="scrim" data-in={shown ? "true" : "false"} onClick={onClose} />}
      <div
        ref={ref}
        className="sheet"
        data-in={shown ? "true" : "false"}
        data-out={shown ? "false" : "true"}
        data-behind={recede ? "true" : "false"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onKeyDown={recede ? undefined : prenderTab}
        data-variante={variante}
        style={tinta ? { "--sheet-tinta": tinta } : undefined}
        // pointer-events:none (in CSS) keeps the mouse out, but a receded
        // sheet's inputs and buttons would still be reachable by Tab and
        // still announced to screen readers without this: inert removes it
        // from both the focus order and the accessibility tree. React 18
        // does not treat `inert` as boolean (a bare `true` renders nothing,
        // silently, with only a dev warning) — it wants the empty string.
        inert={recede ? "" : undefined}
      >
        {tinta && <div className="sheet-tinta" aria-hidden="true" />}
        <div className="sheet-grab"><i /></div>
        <div className="sheet-head">
          <div style={{ minWidth: 0 }}>
            <h2 className="t-display dialog-titulo" id={id}>{title}</h2>
            {subtitle && <p className="t-small muted" style={{ margin: "3px 0 0" }}>{subtitle}</p>}
            {nav}
          </div>
          <div className="sheet-actions">
            {actions}
            <button className="btn-icon" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
          </div>
        </div>
        <div className="sheet-body" tabIndex={-1}>{children}</div>
      </div>
    </>
  );
}

export function Modal({ open, onClose, title, children, footer }) {
  const [mounted, shown] = useTransitionMount(open, 220);
  useEscape(mounted, onClose);
  const ref = useRef(null);
  const id = useId();
  // On touch the first field is not focused: it would pop the on-screen keyboard over
  // the form every time one opens, before the person has decided to type.
  useFocoDialogo(ref, mounted && open, (el) => (!window.matchMedia("(pointer: coarse)").matches && el.querySelector(".modal-body :is(input, select, textarea):not([disabled])")) || el);
  if (!mounted) return null;
  return (
    <>
      <div className="scrim" data-in={shown ? "true" : "false"} onClick={onClose} />
      <div className="modal-wrap">
        <div
          ref={ref}
          className="modal"
          data-in={shown ? "true" : "false"}
          data-out={shown ? "false" : "true"}
          role="dialog"
          aria-modal="true"
          aria-labelledby={id}
          tabIndex={-1}
          onKeyDown={prenderTab}
        >
          <div className="modal-head">
            <h2 className="t-display dialog-titulo" id={id}>{title}</h2>
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

// acao, when given, is { rotulo, onClick }: one button at the end of the line
// (v88 uses it for "Desfazer" after a removal).
export function Toast({ message, acao }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const r1 = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(r1);
  }, []);
  return (
    <div className="toast" data-in={shown ? "true" : "false"} data-acao={acao ? "true" : "false"} role="status">
      <span>{message}</span>
      {acao && <button type="button" className="toast-acao press" onClick={acao.onClick} data-dica={acao.dica}>{acao.rotulo}</button>}
    </div>
  );
}
