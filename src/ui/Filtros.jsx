import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Check } from "lucide-react";

import { STATUS, STATUS_ORDER } from "../lib/constantes";
import { specForCharacter, swatchColors, useCores } from "../lib/cores";
import { dobrar } from "../lib/sessao";

export const OPCOES_STATUS = STATUS_ORDER.map((k) => ({ valor: k, rotulo: STATUS[k].label }));

/* Status and tipo on the HQs tab: the character filter's look without its typing,
   since three statuses and eight types need no search. A native select was used
   before, but its open list is drawn by the operating system (white, blue
   highlight) and no stylesheet reaches it, so it could not match. Keyboard follows
   the ARIA select-only combobox: arrows, Enter or Space to open and pick, Escape. */
export function OpcaoFiltro({ id, valor, todos, opcoes, onChange, rotulo, acao, className = "", listaClassName = "" }) {
  const [aberta, setAberta] = useState(false);
  const [idx, setIdx] = useState(0);
  const raiz = useRef(null);
  // `todos` adds the "no filter" row with the empty value; the publisher band
  // passes its own "Todas" in `opcoes` instead, since its value is not empty.
  // `acao` is a command row after a rule (Gerenciar editoras), not a value.
  const lista = useMemo(() => {
    const base = todos != null ? [{ valor: "", rotulo: todos }, ...opcoes] : opcoes;
    return acao ? [...base, { valor: "__acao__", rotulo: acao.rotulo, acao: true }] : base;
  }, [todos, opcoes, acao]);
  const atual = lista.find((o) => o.valor === valor) || lista[0];
  const comCor = opcoes.some((o) => o.cor);
  const listaRef = useRef(null);

  const fechar = useCallback(() => setAberta(false), []);
  // v139: in a form (Tipo, Editora) the list can open under the modal's footer;
  // scroll the form so it shows. Elsewhere the page is left where it is.
  useEffect(() => {
    const el = listaRef.current;
    if (aberta && el && el.closest(".modal-body") && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [aberta]);
  useEffect(() => {
    if (!aberta) return;
    const fora = (e) => { if (raiz.current && !raiz.current.contains(e.target)) fechar(); };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberta, fechar]);

  const abrir = () => {
    const i = lista.findIndex((o) => o.valor === valor);
    setIdx(i < 0 ? 0 : i);
    setAberta(true);
  };
  const escolher = (o) => {
    fechar();
    if (!o) return;
    if (o.acao) acao.onClick();
    else onChange(o.valor);
  };

  const tecla = (e) => {
    if (e.key === "Escape") { if (aberta) { e.preventDefault(); fechar(); } return; }
    if (!aberta) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, lista.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); escolher(lista[idx]); }
    else if (e.key === "Tab") fechar();
  };

  const optId = (i) => id + "-op-" + i;

  return (
    <div className="pfiltro" ref={raiz}>
      <button
        type="button"
        id={id}
        className={"select pfiltro-input pfiltro-botao " + className}
        data-on={valor ? "true" : "false"}
        onClick={() => (aberta ? fechar() : abrir())}
        onKeyDown={tecla}
        role="combobox"
        aria-label={rotulo}
        aria-haspopup="listbox"
        aria-expanded={aberta ? "true" : "false"}
        aria-controls={id + "-lista"}
        aria-activedescendant={aberta ? optId(idx) : undefined}
      >
        <span className="truncate">{atual.rotulo}</span>
      </button>
      {aberta && (
        <div
          className={"sug pfiltro-lista " + listaClassName}
          ref={listaRef}
          id={id + "-lista"}
          role="listbox"
          aria-label={rotulo}
          onMouseDown={(e) => e.preventDefault()}
        >
          {lista.map((o, i) => (
            <React.Fragment key={o.valor || "__todos"}>
              {o.acao && <div className="pfiltro-sep" role="separator" />}
              <button
                id={optId(i)}
                type="button"
                tabIndex={-1}
                className={"sug-row pfiltro-row" + (o.acao ? " pfiltro-acao" : "")}
                role="option"
                aria-selected={!o.acao && o.valor === valor ? "true" : "false"}
                data-on={i === idx ? "true" : "false"}
                onMouseEnter={() => setIdx(i)}
                onClick={() => escolher(o)}
              >
                {comCor && !o.acao && (o.cor
                  ? <span className="group-swatch" style={{ background: o.cor }} />
                  : <span className="pfiltro-todos" aria-hidden="true" />)}
                <span className="sug-title truncate">{o.rotulo}</span>
                {!o.acao && o.valor === valor && <Check size={14} className="pfiltro-check" />}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

/* The character filter on the HQs tab: a field you can type into that narrows a
   list, with "Todos os personagens" always first. Closed, it shows the choice;
   open, it is a search over the choices. Keys and outside-click follow SearchBox. */
export function PersonagemFiltro({ id = "filtro-personagem", valor, opcoes, onChange }) {
  const [aberta, setAberta] = useState(false);
  const [texto, setTexto] = useState("");
  const [idx, setIdx] = useState(0);
  const raiz = useRef(null);
  const campo = useRef(null);
  const cores = useCores();

  const lista = useMemo(() => {
    const q = dobrar(texto.trim());
    const achados = q ? opcoes.filter((o) => dobrar(o.nome).includes(q)) : opcoes;
    return q ? achados : [{ nome: "", n: null }, ...achados];
  }, [texto, opcoes]);

  const fechar = useCallback(() => { setAberta(false); setTexto(""); }, []);

  useEffect(() => {
    if (!aberta) return;
    const fora = (e) => { if (raiz.current && !raiz.current.contains(e.target)) fechar(); };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberta, fechar]);

  const abrir = () => {
    setAberta(true);
    // Land on the current choice, so Enter right away changes nothing.
    const i = [{ nome: "" }, ...opcoes].findIndex((o) => o.nome === valor);
    setIdx(i < 0 ? 0 : i);
  };

  const escolher = (o) => {
    if (!o) return;
    onChange(o.nome);
    fechar();
    if (campo.current) campo.current.blur();
  };

  const tecla = (e) => {
    if (e.key === "Escape") {
      fechar();
      if (campo.current) campo.current.blur();
      return;
    }
    if (!aberta) {
      if (e.key === "ArrowDown" || e.key === "Enter") { e.preventDefault(); abrir(); }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => Math.min(i + 1, lista.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      escolher(lista[idx]);
    }
  };

  const optId = (o) => "pf-" + (o.nome ? dobrar(o.nome).replace(/[^a-z0-9]+/g, "-") : "todos");

  return (
    <div className="pfiltro" ref={raiz}>
      <input
        ref={campo}
        id={id}
        className="select pfiltro-input"
        data-on={valor ? "true" : "false"}
        value={aberta ? texto : valor}
        onChange={(e) => { setTexto(e.target.value); setIdx(0); setAberta(true); }}
        onFocus={abrir}
        onClick={() => { if (!aberta) abrir(); }}
        onKeyDown={tecla}
        placeholder={aberta && valor ? valor : "Todos os personagens"}
        aria-label="Filtrar por personagem"
        role="combobox"
        aria-expanded={aberta ? "true" : "false"}
        aria-controls={id + "-lista"}
        aria-autocomplete="list"
        aria-activedescendant={aberta && lista[idx] ? optId(lista[idx]) : undefined}
        autoComplete="off"
        spellCheck={false}
      />
      {aberta && (
        <div
          className="sug pfiltro-lista"
          id={id + "-lista"}
          role="listbox"
          aria-label="Personagens"
          onMouseDown={(e) => e.preventDefault()}
        >
          {lista.length === 0 ? (
            <p className="sug-empty">Nenhum personagem com "{texto.trim()}".</p>
          ) : (
            lista.map((o, i) => (
              <button
                key={o.nome || "__todos"}
                id={optId(o)}
                type="button"
                className="sug-row pfiltro-row"
                role="option"
                aria-selected={o.nome === valor ? "true" : "false"}
                data-on={i === idx ? "true" : "false"}
                onMouseEnter={() => setIdx(i)}
                onClick={() => escolher(o)}
              >
                {o.nome ? (
                  <span className="group-swatch" style={{ background: swatchColors(specForCharacter(o.nome, cores), 0).edge }} />
                ) : (
                  <span className="pfiltro-todos" aria-hidden="true" />
                )}
                <span className="sug-title truncate">{o.nome || "Todos os personagens"}</span>
                {o.n != null && <span className="pfiltro-n">{o.n}</span>}
                {o.nome === valor && <Check size={14} className="pfiltro-check" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* v139: a search over a long list in the character filter's look, for pickers inside a
   sheet (volumes for a collection, a série for a volume). The list flows under the
   field instead of floating, since these fields sit at a sheet's end. With `escolhidos`
   a tap marks a row with the place it will take and the list stays open; without it,
   a tap picks and closes. Each option: { id, titulo, meta, busca, inicio }. */
export function CampoBusca({ id, rotulo, placeholder, opcoes, escolhidos, onEscolher, vazio }) {
  const [aberta, setAberta] = useState(false);
  const [texto, setTexto] = useState("");
  const [idx, setIdx] = useState(0);
  const raiz = useRef(null);
  const listaRef = useRef(null);
  const multi = Array.isArray(escolhidos);

  const lista = useMemo(() => {
    const q = dobrar(texto.trim());
    return q ? opcoes.filter((o) => dobrar(o.busca || o.titulo).includes(q)) : opcoes;
  }, [texto, opcoes]);

  useEffect(() => {
    if (!aberta) return undefined;
    const fora = (e) => { if (raiz.current && !raiz.current.contains(e.target)) setAberta(false); };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberta]);

  // These fields end a sheet, so the list opens below the fold; bring it into view.
  useEffect(() => {
    if (aberta && listaRef.current && listaRef.current.scrollIntoView) listaRef.current.scrollIntoView({ block: "nearest" });
  }, [aberta]);

  const escolher = (o) => {
    if (!o) return;
    if (!multi) { setAberta(false); setTexto(""); }
    onEscolher(o.id);
  };

  const tecla = (e) => {
    if (e.key === "Escape") { if (aberta) { e.preventDefault(); setAberta(false); } return; }
    if (!aberta) {
      if (e.key === "ArrowDown" || e.key === "Enter") { e.preventDefault(); setAberta(true); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, lista.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); escolher(lista[idx]); }
  };

  const optId = (o) => id + "-" + o.id;
  return (
    <div className="escolha" ref={raiz}>
      <input
        id={id}
        className="select pfiltro-input"
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setIdx(0); setAberta(true); }}
        onFocus={() => setAberta(true)}
        onClick={() => setAberta(true)}
        onKeyDown={tecla}
        placeholder={placeholder}
        aria-label={rotulo}
        role="combobox"
        aria-expanded={aberta ? "true" : "false"}
        aria-controls={id + "-lista"}
        aria-autocomplete="list"
        aria-activedescendant={aberta && lista[idx] ? optId(lista[idx]) : undefined}
        autoComplete="off"
        spellCheck={false}
      />
      {aberta && (
        <div className="sug escolha-lista" id={id + "-lista"} role="listbox" aria-multiselectable={multi ? "true" : undefined} aria-label={rotulo} ref={listaRef} onMouseDown={(e) => e.preventDefault()}>
          {lista.length === 0 ? (
            <p className="sug-empty">{opcoes.length ? "Nada com \"" + texto.trim() + "\"." : vazio}</p>
          ) : lista.map((o, i) => {
            const pos = multi ? escolhidos.indexOf(o.id) : -1;
            return (
              <button
                key={o.id}
                id={optId(o)}
                type="button"
                tabIndex={-1}
                className="sug-row"
                role="option"
                aria-selected={pos >= 0 ? "true" : "false"}
                data-on={i === idx ? "true" : "false"}
                onMouseEnter={() => setIdx(i)}
                onClick={() => escolher(o)}
              >
                {o.inicio}
                <span className="sug-text">
                  <span className="sug-title truncate">{o.titulo}</span>
                  {o.meta && <span className="sug-meta truncate">{o.meta}</span>}
                </span>
                {pos >= 0 && <span className="escolha-ordem num" aria-hidden="true">{pos + 1}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// v139: pickers are locked to a publisher. An item with no publisher stays on offer,
// since nothing says it belongs elsewhere; with no reference publisher, nothing is locked.
export function daEditora(editoras) {
  const chaves = new Set(editoras.map((e) => (e || "").trim().toLowerCase()).filter(Boolean));
  return (item) => !chaves.size || !(item.editora || "").trim() || chaves.has(item.editora.trim().toLowerCase());
}
