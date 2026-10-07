import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronDown, ChevronsDownUp, ChevronsUpDown, Plus, ShoppingCart, SlidersHorizontal } from "lucide-react";
import { agruparDesejos, filtrarDesejos, numeroNaFaixa } from "../lib/desejos";
import { presencas } from "../lib/constantes";
import { swatchColors } from "../lib/cores";
import { EmptyState } from "../ui/base";
import { GroupHead } from "../ui/CorPersonagem";
import { EditoraLogo } from "../ui/Editoras";
import { OpcaoFiltro, PersonagemFiltro } from "../ui/Filtros";
import { ShelfStrip } from "../ui/Prateleira";
import { VolumeCard, gradeTeclado } from "../ui/VolumeCard";
import { useArrastarVolumes } from "./useArrastarVolumes";
import { useArrastarColecao } from "./useArrastarColecao";
import { useArrastarColecoesDesejo } from "./useArrastarColecoesDesejo";

export const TelaDesejos = forwardRef(function TelaDesejos({ lib, persist, fixados, alternarFixado, setCorPersonagem, abrirDesejo, novoDesejo, onClose }, ref) {
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("");
  const [personagem, setPersonagem] = useState("");
  const [editora, setEditora] = useState("");
  const [filtros, setFiltros] = useState(false);
  const [fechados, setFechados] = useState(new Set());
  const [rolado, setRolado] = useState(false);
  const voltarRef = useRef(null);
  // v165: the character heads stick right under this header, whose height changes
  // (one row on a PC, two on a phone); there is no publisher strip here.
  const topoRef = useRef(null);
  useEffect(() => {
    const el = topoRef.current;
    if (!el || typeof ResizeObserver !== "function") return undefined;
    const ro = new ResizeObserver(() => el.parentElement?.style.setProperty("--desejos-topo-h", el.offsetHeight + "px"));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const antes = document.activeElement;
    voltarRef.current?.focus();
    return () => { requestAnimationFrame(() => { if (antes?.isConnected && !antes.closest("[inert]")) antes.focus(); }); };
  }, []);
  const visiveis = useMemo(() => filtrarDesejos(lib, { busca, tipo, personagem, editora }), [lib, busca, tipo, personagem, editora]);
  const grupos = useMemo(() => agruparDesejos(lib, visiveis, fixados), [lib, visiveis, fixados]);
  const chaves = grupos.flatMap((g) => g.personagens.map((p) => chaveGrupo(g.editora, p.nome)));
  const todosAbertos = chaves.every((k) => !fechados.has(k));
  const buscando = !!busca.trim();
  function alternarTudo() {
    if (buscando || !chaves.length) return false;
    setFechados(todosAbertos ? new Set(chaves) : new Set());
    return true;
  }
  useImperativeHandle(ref, () => ({ alternarTudo, focarBusca: () => document.querySelector('.desejos-capa [aria-label="Buscar na lista de desejos"]')?.focus() }));
  const ativos = [tipo, personagem, editora].filter(Boolean).length;
  const pares = lib.desejos.flatMap((d) => [{ personagem: d.personagem, editora: d.editora || "Sem editora" }, ...presencas(d)]);
  const nomesEditoras = [...new Set(pares.map((p) => p.editora).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const nomesPersonagens = [...new Set(pares.map((p) => p.personagem).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return (
    <div className="desejos-capa" onScroll={(e) => setRolado(e.currentTarget.scrollTop > 0)}>
      <header className="topbar" ref={topoRef} data-scrolled={rolado ? "true" : "false"}>
        <div className="topbar-inner desejos-topo">
          <button ref={voltarRef} className="btn-icon" aria-label="Voltar da lista de desejos" onClick={onClose}><ChevronLeft size={18} /></button>
          <h1 className="t-display">Lista de desejos · {lib.desejos.length}</h1>
          <input className="input desejos-busca" aria-label="Buscar na lista de desejos" placeholder="Buscar na lista" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <button className="btn-icon btn-filtros" aria-label={ativos ? "Filtros, " + ativos + " ativos" : "Filtros"} aria-expanded={filtros} onClick={() => setFiltros((s) => !s)}>
            <SlidersHorizontal size={16} />{ativos > 0 && <span className="btn-badge" aria-hidden="true">{ativos}</span>}
          </button>
          {!buscando && <button className="btn btn-quiet desejos-dobra" onClick={alternarTudo} data-dica={(todosAbertos ? "Esconder todas" : "Mostrar todas") + " · Q"} aria-label={todosAbertos ? "Esconder todas" : "Mostrar todas"}>
            <ChevronDown size={16} data-rot={todosAbertos ? "false" : "true"} /><span>{todosAbertos ? "Esconder todas" : "Mostrar todas"}</span>
          </button>}
          {/* Phone: the tabs' fold icon (v133 ed-dobra), on the title row. */}
          {!buscando && <button type="button" className="btn-icon desejos-dobra-cel" onClick={alternarTudo} aria-label={todosAbertos ? "Esconder todas" : "Mostrar todas"}>
            {todosAbertos ? <ChevronsDownUp size={18} /> : <ChevronsUpDown size={18} />}
          </button>}
          <button className="btn btn-primary" onClick={novoDesejo} data-dica="Novo desejo · N" aria-label="Novo desejo"><Plus size={15} /><span className="novo-rotulo">Novo desejo</span></button>
        </div>
      </header>
      <main className="content desejos-conteudo">
        {filtros && <div className="desejos-filtros">
          <OpcaoFiltro id="desejos-tipo" rotulo="Formato" todos="Todos os formatos" valor={tipo} opcoes={[...new Set(lib.desejos.map((d) => d.tipo).filter(Boolean))].sort().map((n) => ({ valor: n, rotulo: n }))} onChange={setTipo} />
          <PersonagemFiltro id="desejos-personagem" valor={personagem} opcoes={nomesPersonagens.map((nome) => ({ nome, n: lib.desejos.filter((d) => d.personagem === nome || d.tambem?.some((p) => p.personagem === nome)).length }))} onChange={setPersonagem} />
          <OpcaoFiltro id="desejos-editora" rotulo="Editora" todos="Todas as editoras" valor={editora} opcoes={nomesEditoras.map((n) => ({ valor: n, rotulo: n, cor: corEditora(lib, n) }))} onChange={setEditora} />
          {ativos > 0 && <button className="btn btn-quiet" onClick={() => { setTipo(""); setPersonagem(""); setEditora(""); }}>Limpar filtros</button>}
        </div>}
        {!grupos.length ? <EmptyState icon={ShoppingCart} title={!lib.desejos.length ? "Nada na lista ainda" : "Nada encontrado na lista"}>
          {!lib.desejos.length ? <button className="btn btn-primary" onClick={novoDesejo}><Plus size={15} />Novo desejo</button> : "Tente outro termo de busca ou limpe os filtros."}
        </EmptyState> : grupos.map((g) => {
          // v165: each publisher folds its own characters; the header button folds them all.
          const daEditora = g.personagens.map((p) => chaveGrupo(g.editora, p.nome));
          const editoraAberta = daEditora.some((k) => !fechados.has(k));
          return <section className="desejos-editora" key={g.editora}>
          <div className="desejos-editora-head" style={{ "--desejo-editora-cor": corEditora(lib, g.editora) }}>
            <EditoraLogo editora={lib.editoras.find((e) => e.nome.toLowerCase() === g.editora.toLowerCase())} size="2rem" /><h2 className="t-display">{g.editora}</h2>
            {!buscando && <button type="button" className="btn-icon desejos-dobra-editora" aria-label={(editoraAberta ? "Esconder" : "Mostrar") + " os personagens de " + g.editora}
              onClick={() => setFechados((s) => { const next = new Set(s); daEditora.forEach((k) => (editoraAberta ? next.add(k) : next.delete(k))); return next; })}>
              {editoraAberta ? <ChevronsDownUp size={18} /> : <ChevronsUpDown size={18} />}
            </button>}
          </div>
          {g.personagens.map((p) => {
            const chave = chaveGrupo(g.editora, p.nome);
            return <section className="group" key={p.nome}>
              <GroupHead personagem={p.nome} count={p.soltos.length + p.colecoes.reduce((n, c) => n + c.membros.length, 0)} itemLabel="HQs" onPickColor={setCorPersonagem} aberto={buscando || !fechados.has(chave)} onAlternar={() => setFechados((s) => { const next = new Set(s); next.has(chave) ? next.delete(chave) : next.add(chave); return next; })} fixado={fixados.includes(p.nome)} onFixar={alternarFixado} />
              {(buscando || !fechados.has(chave)) && <GrupoDesejos lib={lib} persist={persist} grupo={p} visiveis={visiveis} reordenavel={!buscando && !ativos} abrirDesejo={abrirDesejo} />}
            </section>;
          })}
        </section>;
        })}
      </main>
    </div>
  );
});

const chaveGrupo = (editora, personagem) => JSON.stringify([editora, personagem]);
function corEditora(lib, nome) {
  const ed = lib.editoras.find((e) => e.nome.toLowerCase() === nome.toLowerCase());
  return ed?.cor ? swatchColors(ed.cor, 0).edge : undefined;
}

function GrupoDesejos({ lib, persist, grupo, visiveis, reordenavel, abrirDesejo }) {
  // Each publisher presence owns its grid and nodes; writes still target the real ids.
  const soltos = grupo.soltos.map((v) => ({ ...v, personagem: grupo.nome }));
  const drag = useArrastarVolumes(lib, persist, soltos, "desejos");
  const cols = useArrastarColecoesDesejo(lib, persist, grupo.colecoes.map((c) => c.colecao.id));
  const itens = drag.dragVisual ? drag.dragVisual.ids.map((id) => grupo.soltos.find((v) => v.id === id)).filter(Boolean) : grupo.soltos;
  const colecoes = cols.visual ? cols.visual.ids.map((id) => grupo.colecoes.find((c) => c.colecao.id === id)).filter(Boolean) : grupo.colecoes;
  return <>
    {!!itens.length && <div className="shelf stagger" ref={drag.gradeRef} data-hq-grid={grupo.nome} role="group" aria-label={"Desejos de " + grupo.nome} {...gradeTeclado}>
      {itens.map((v, i) => <VolumeCard key={v.id} volume={v} index={i} tabParada={i === 0 ? 0 : -1} open={false} reordenavel={reordenavel} personagem={grupo.nome} dragging={drag.dragVisual?.id === v.id} holdColor={drag.editoraCorPorNome[(v.editora || "").toLowerCase()]} cardRef={(el) => drag.registrarCardNode(v.id, el)} onDragPointerDown={(e) => drag.volDragPointerDown(e, v, grupo.nome)} onDragPointerMove={drag.volDragPointerMove} onDragPointerEnd={drag.volDragPointerEnd} onClick={() => { if (drag.suppressClickRef.current) { drag.suppressClickRef.current = false; return; } abrirDesejo(v.id); }} />)}
    </div>}
    <div className="desejos-colecoes" data-recolhido={cols.recolhido ? "true" : "false"}>
      {colecoes.map(({ colecao, membros }) => <ColecaoDesejo
        key={colecao.id} colecao={colecao} membros={membros} drag={cols}
        lib={lib} persist={persist} visiveis={visiveis}
        reordenavel={reordenavel} abrirDesejo={abrirDesejo}
      />)}
    </div>
  </>;
}

function ColecaoDesejo({ colecao, membros, drag, lib, persist, visiveis, reordenavel, abrirDesejo }) {
  // Preserve the row's touchmove listener through live previews, as VolumeCard
  // preserves its node registration during grid/strip reorders.
  const registrarAtual = useRef(drag.registrar);
  registrarAtual.current = drag.registrar;
  const registrar = useCallback((el) => registrarAtual.current(colecao.id, el), [colecao.id]);
  const cor = colecao.corBarra;
  const barColor = cor ? (cor.longbox ? "var(--accent)" : swatchColors(cor, 0).edge) : undefined;
  return (
    <section className="coll desejo-colecao" ref={registrar}>
      <div
        className="coll-head desejo-colecao-head"
        style={{ "--desejo-colecao-cor": barColor }}
        onPointerDown={reordenavel ? (e) => drag.pointerDown(e, colecao.id) : undefined}
        onPointerMove={drag.mover}
        onPointerUp={drag.finalizar}
        onPointerCancel={drag.finalizar}
      >
        <h3 className="t-display">{colecao.nome}</h3>
        <span className="t-small muted">{membros.length} volumes</span>
      </div>
      {!drag.recolhido && <DesejoStrip
        colecao={colecao} lib={lib} persist={persist} visiveis={visiveis}
        reordenavel={reordenavel} abrirDesejo={abrirDesejo}
      />}
    </section>
  );
}

function DesejoStrip({ colecao, lib, persist, visiveis, reordenavel, abrirDesejo }) {
  const drag = useArrastarColecao(colecao, lib, persist, "desejosColecoes");
  const membros = drag.visual?.membros || colecao.membros;
  const order = drag.visual?.order || membros.map((_, i) => i);
  const itens = order.map((indice, slot) => ({ indice, slot, volume: lib.desejos.find((v) => v.id === membros[indice]) })).filter((x) => x.volume && visiveis.has(x.volume.id));
  const cor = colecao.corBarra;
  const holdColor = cor ? (cor.longbox ? "var(--accent)" : swatchColors(cor, 0).edge) : undefined;
  return <ShelfStrip total={itens.length} cor={cor} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") drag.suppressClickRef.current = false; }}>
    {itens.map(({ indice, slot, volume: v }, i) => <div key={v.id + ":" + indice} data-membro-indice={indice}>
      <div className="slot-order">{String(numeroNaFaixa(lib, colecao, slot)).padStart(2, "0")}</div>
      <VolumeCard volume={v} index={0} tabParada={i === 0 ? 0 : -1} open={false} reordenavel={reordenavel} holdColor={holdColor} cardRef={(el) => drag.registrar(indice, el)} onDragPointerDown={(e) => drag.pointerDown(e, indice)} onDragPointerMove={drag.mover} onDragPointerEnd={drag.finalizar} onClick={() => { if (drag.suppressClickRef.current) { drag.suppressClickRef.current = false; return; } abrirDesejo(v.id); }} />
    </div>)}
  </ShelfStrip>;
}
