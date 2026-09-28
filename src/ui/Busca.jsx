import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, Layers, Library, X } from "lucide-react";

import { coverColors, useCores } from "../lib/cores";
import { CoverArt } from "./VolumeCard";

export const MAX_SUGESTOES = 8;

/* Ranked by where the match lands. A title that starts with what you typed is
   almost always the one you meant, and a hit that only exists in the notes is
   almost never it, so the two cannot sit side by side unordered. */
export function ordenarSugestoes(volumes, textoBusca, q) {
  const termo = q.trim().toLowerCase();
  if (!termo) return [];
  const achados = [];
  volumes.forEach((v) => {
    if (!(textoBusca[v.id] || "").includes(termo)) return;
    const titulo = (v.titulo || "").toLowerCase();
    const personagem = (v.personagem || "").toLowerCase();
    const peso = titulo.startsWith(termo) ? 0
      : titulo.includes(termo) ? 1
      : personagem.includes(termo) ? 2
      : 3;
    achados.push({ v, peso });
  });
  achados.sort((a, b) => a.peso - b.peso || a.v.titulo.localeCompare(b.v.titulo, "pt-BR", { numeric: true }));
  return achados.slice(0, MAX_SUGESTOES).map((a) => a.v);
}

// Collections and séries rank the way volumes do: name starts with the term,
// then name contains it, then a secondary text (a série's characters) does.
// What counts as a match mirrors each tab's own search filter (v73).
export const SUGESTOES_DA_ABA = 4;
export function ordenarPorNome(itens, termoBruto, secundario) {
  const termo = termoBruto.trim().toLowerCase();
  if (!termo) return [];
  const achados = [];
  itens.forEach((it) => {
    const nome = (it.nome || "").toLowerCase();
    const extra = secundario ? secundario(it).toLowerCase() : "";
    const peso = nome.startsWith(termo) ? 0 : nome.includes(termo) ? 1 : extra.includes(termo) ? 2 : -1;
    if (peso >= 0) achados.push({ it, peso });
  });
  achados.sort((x, y) => x.peso - y.peso || x.it.nome.localeCompare(y.it.nome, "pt-BR", { numeric: true }));
  return achados.map((x) => x.it);
}

/* The suggestions never obey the publisher filter or the status and type filters:
   looking for a volume you half remember should not depend on what you happen to be
   browsing. (Under 768px the field used to take the whole screen when focused; since
   v129 the phone uses the tab-bar search below instead.) */
//
// v129: on a phone the search lives in the floating tab bar instead (`barra`): a
// glass circle beside the tabs that grows into a field while the tabs fold into a
// circle, as in iOS. The page owns whether it is open (`expandida`), because the
// tab capsule folds with it. Tapping outside only hides the suggestions: the typed
// search stays and keeps filtering the tab, so you can scroll the results. The X,
// the folded tab circle or picking a suggestion close it and clear the text. The
// bar rides above the on-screen keyboard, measured with visualViewport.
export function SearchBox({ query, setQuery, sugestoes, onPick, barra = false, expandida = false, setExpandida }) {
  const [aberta, setAberta] = useState(false);
  const [idx, setIdx] = useState(0);
  const [fullLocal, setFullLocal] = useState(false);
  const full = barra ? expandida : fullLocal;
  const setFull = barra ? setExpandida : setFullLocal;
  const raiz = useRef(null);
  const campo = useRef(null);
  const cores = useCores();

  useEffect(() => { setIdx(0); }, [query]);

  const fechar = useCallback(() => {
    setAberta(false);
    setFull(false);
    if (barra) {
      setQuery("");
      if (campo.current) campo.current.blur();
    }
  }, [barra, setFull, setQuery]);

  // Closed from outside (the folded tab circle, a tab switch): let go of the keyboard.
  useEffect(() => {
    if (barra && !expandida && campo.current && document.activeElement === campo.current) campo.current.blur();
  }, [barra, expandida]);

  useEffect(() => {
    if (!aberta) return;
    const fora = (e) => {
      if (!raiz.current || raiz.current.contains(e.target)) return;
      if (barra) setAberta(false);
      else fechar();
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberta, fechar, barra]);

  useEffect(() => {
    if (!barra || !expandida || typeof window === "undefined" || !window.visualViewport) return undefined;
    const vv = window.visualViewport;
    const nav = raiz.current && raiz.current.closest(".tabbar");
    if (!nav) return undefined;
    const medir = () => {
      nav.style.setProperty("--teclado", Math.max(0, window.innerHeight - vv.height - vv.offsetTop) + "px");
      nav.style.setProperty("--vv-altura", vv.height + "px");
    };
    medir();
    vv.addEventListener("resize", medir);
    vv.addEventListener("scroll", medir);
    return () => {
      vv.removeEventListener("resize", medir);
      vv.removeEventListener("scroll", medir);
      nav.style.removeProperty("--teclado");
      nav.style.removeProperty("--vv-altura");
    };
  }, [barra, expandida]);

  const mostrando = aberta && query.trim().length > 0;

  const escolher = (v) => {
    if (!v) return;
    fechar();
    onPick(v);
  };

  // Focus inside the tap itself: iOS only raises the keyboard for a focus that
  // happens during the user's gesture.
  const abrirNaBarra = () => {
    setFull(true);
    setAberta(true);
    if (campo.current) campo.current.focus();
  };

  const tecla = (e) => {
    if (e.key === "Escape") {
      fechar();
      if (campo.current) campo.current.blur();
      return;
    }
    if (!mostrando || sugestoes.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => Math.min(i + 1, sugestoes.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      escolher(sugestoes[idx]);
    }
  };

  return (
    <div className={barra ? "search search-barra" : "search"} data-full={full ? "true" : "false"} ref={raiz}>
      <div className="search-field" data-dica={barra ? undefined : "Buscar · /"}>
        <Search size={barra ? 20 : 15} />
        {barra && !full && (
          <button type="button" className="search-abrir" onClick={abrirNaBarra} aria-label="Buscar na biblioteca" />
        )}
        <input
          ref={campo}
          id="busca-acervo"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setAberta(true); }}
          onFocus={() => { setAberta(true); setFull(true); }}
          onKeyDown={tecla}
          placeholder={barra ? "Buscar no acervo" : "Buscar"}
          aria-label="Buscar na biblioteca"
          tabIndex={barra && !full ? -1 : undefined}
          enterKeyHint={barra ? "search" : undefined}
          role="combobox"
          aria-expanded={mostrando ? "true" : "false"}
          aria-controls="busca-sugestoes"
          aria-autocomplete="list"
          aria-activedescendant={
            mostrando && sugestoes[idx] ? "sug-" + sugestoes[idx].chave : undefined
          }
        />
        {barra && full && (
          <button type="button" className="search-fechar" onClick={fechar} aria-label="Fechar a busca">
            <X size={18} />
          </button>
        )}
      </div>

      {mostrando && (
        <div
          className="sug"
          id="busca-sugestoes"
          role="listbox"
          aria-label="Sugestões da busca"
          onMouseDown={(e) => e.preventDefault()}
        >
          {sugestoes.length === 0 ? (
            <p className="sug-empty">Nada encontrado para "{query.trim()}".</p>
          ) : (
            sugestoes.map((s, i) => (
              <React.Fragment key={s.chave}>
              {/* A heading wherever the kind changes, so a tab's results and
                  the HQs under them read as two lists (v73). */}
              {s.secao && (i === 0 || sugestoes[i - 1].secao !== s.secao) && (
                <p className="sug-secao" aria-hidden="true">{s.secao}</p>
              )}
              <button
                id={"sug-" + s.chave}
                className="sug-row"
                role="option"
                aria-selected={i === idx ? "true" : "false"}
                data-on={i === idx ? "true" : "false"}
                onMouseEnter={() => setIdx(i)}
                onClick={() => escolher(s)}
              >
                {s.tipo === "volume" ? (
                  <span className="cover sug-cover" style={{ "--edge": coverColors(s.volume, cores).edge }}>
                    <CoverArt volume={s.volume} />
                  </span>
                ) : (
                  <span className="sug-cover sug-icone">
                    {s.tipo === "colecao" ? <Layers size={15} /> : <Library size={15} />}
                  </span>
                )}
                <span className="sug-text">
                  <span className="sug-title truncate">{s.titulo}</span>
                  <span className="sug-meta truncate">{s.meta}</span>
                </span>
              </button>
              </React.Fragment>
            ))
          )}
        </div>
      )}
    </div>
  );
}
