import { useMemo } from "react";

import { ED_SEM, editoraDe } from "../lib/constantes";
import { specForCharacter, swatchColors, useCores } from "../lib/cores";

// D1 (v89): a portrait of the collection on the hub, after the shelf. Every bar is
// that slice's share of the whole collection on a full-width track, so the columns
// share one scale (Flash 44 and Trade Paperback 43 read the same length). Labels
// and numbers are in text ink; colour only echoes identity (a character's shelf
// colour, the reading statuses' own colours), never carries it alone. Every bar
// except "Outros" opens the HQs tab filtered to that slice (onRecorte).

const MAIS_VISTOS = 4;

function contar(volumes, chave) {
  const n = new Map();
  volumes.forEach((v) => {
    const k = chave(v);
    n.set(k, (n.get(k) || 0) + 1);
  });
  return [...n.entries()]
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
}

// The biggest four, and the rest summed as "Outros"; five or fewer show whole,
// since folding a single one into "Outros 1" would hide it for nothing.
function dobrarCauda(itens) {
  if (itens.length <= MAIS_VISTOS + 1) return itens;
  const cauda = itens.slice(MAIS_VISTOS);
  return itens.slice(0, MAIS_VISTOS).concat({
    nome: "Outros",
    total: cauda.reduce((s, x) => s + x.total, 0),
    outros: cauda.length,
  });
}

const pct = (n, total) => (total ? (n / total) * 100 : 0);

function Linha({ nome, total, doTotal, cor, onClick, rotuloAcao }) {
  const p = pct(total, doTotal);
  const conteudo = (
    <>
      <span className="retrato-nome t-small truncate">{nome}</span>
      <span className="retrato-trilho" aria-hidden="true">
        <i style={{ width: p.toFixed(2) + "%", background: cor }} />
      </span>
      <span className="retrato-valor">{total}</span>
    </>
  );
  const dica = total + " de " + doTotal + ", " + Math.round(p) + "%";
  if (!onClick) {
    return <li><div className="retrato-linha" data-dica={dica}>{conteudo}</div></li>;
  }
  return (
    <li>
      <button
        type="button"
        className="retrato-linha"
        data-dica={dica}
        aria-label={nome + ": " + dica + ". " + rotuloAcao}
        onClick={onClick}
      >
        {conteudo}
      </button>
    </li>
  );
}

export function RetratoAcervo({ lib, onRecorte }) {
  const cores = useCores();
  const volumes = lib.volumes;
  const total = volumes.length;

  const dados = useMemo(() => {
    const leitura = { lida: 0, lendo: 0, nao_lida: 0 };
    volumes.forEach((v) => { leitura[v.status in leitura ? v.status : "nao_lida"]++; });
    return {
      leitura,
      formatos: contar(volumes, (v) => v.tipo || "Sem formato"),
      personagens: dobrarCauda(contar(volumes, (v) => v.personagem || "Sem personagem")),
      editoras: contar(volumes, (v) => editoraDe(v) || "Sem editora"),
    };
  }, [volumes]);

  const corEditora = (nome) => {
    const ed = (lib.editoras || []).find((e) => (e.nome || "").trim().toLowerCase() === nome.toLowerCase());
    return ed && ed.cor ? swatchColors(ed.cor, 0).edge : "var(--text-muted)";
  };
  // The band's id for a publisher, or ED_SEM for volumes with none; null when no
  // publisher record matches, and then the bar is not offered as a shortcut.
  const idEditora = (nome) => {
    if (nome === "Sem editora") return ED_SEM;
    const ed = (lib.editoras || []).find((e) => (e.nome || "").trim().toLowerCase() === nome.toLowerCase());
    return ed ? ed.id : null;
  };

  if (!total) return null;
  const { leitura } = dados;
  const mostrarEditoras = dados.editoras.length >= 2;

  return (
    <section>
      <div className="hub-section-head">
        <h2>Seu acervo</h2>
      </div>
      <div className="retrato" data-colunas={mostrarEditoras ? "4" : "3"}>
        <div className="retrato-col">
          <h3 className="t-micro">Leitura</h3>
          <p className="retrato-destaque">
            <span>{leitura.lida}</span> de {total} lidas
          </p>
          <div
            className="retrato-meter"
            role="img"
            aria-label={leitura.lida + " lidas, " + leitura.lendo + " lendo, " + leitura.nao_lida + " na fila"}
          >
            {leitura.lida > 0 && <i data-s="lida" style={{ flexGrow: leitura.lida }} />}
            {leitura.lendo > 0 && <i data-s="lendo" style={{ flexGrow: leitura.lendo }} />}
            {leitura.nao_lida > 0 && <i data-s="resto" style={{ flexGrow: leitura.nao_lida }} />}
          </div>
          <ul className="retrato-legenda">
            {[
              ["lida", leitura.lida, leitura.lida === 1 ? "lida" : "lidas"],
              ["lendo", leitura.lendo, "lendo"],
              ["nao_lida", leitura.nao_lida, "na fila"],
            ].map(([status, n, rotulo]) => (
              <li key={status}>
                <button
                  type="button"
                  className="retrato-status"
                  data-s={status}
                  disabled={n === 0}
                  onClick={() => onRecorte({ status })}
                  aria-label={n + " " + rotulo + ". Mostrar na aba HQs"}
                >
                  <i aria-hidden="true" />
                  {n} {rotulo}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="retrato-col">
          <h3 className="t-micro">Formatos</h3>
          <ul className="retrato-lista">
            {dados.formatos.map((f) => (
              <Linha
                key={f.nome}
                nome={f.nome}
                total={f.total}
                doTotal={total}
                cor="var(--accent)"
                rotuloAcao="Mostrar na aba HQs"
                onClick={f.nome === "Sem formato" ? null : () => onRecorte({ tipo: f.nome })}
              />
            ))}
          </ul>
        </div>

        <div className="retrato-col">
          <h3 className="t-micro">Personagens</h3>
          <ul className="retrato-lista">
            {dados.personagens.map((p) => (
              <Linha
                key={p.nome}
                nome={p.outros ? "Outros" : p.nome}
                total={p.total}
                doTotal={total}
                cor={p.outros ? "var(--text-muted)" : swatchColors(specForCharacter(p.nome, cores), 0).edge}
                rotuloAcao="Mostrar na aba HQs"
                onClick={p.outros || p.nome === "Sem personagem" ? null : () => onRecorte({ personagem: p.nome })}
              />
            ))}
          </ul>
        </div>

        {mostrarEditoras && (
          <div className="retrato-col">
            <h3 className="t-micro">Editoras</h3>
            <ul className="retrato-lista">
              {dobrarCauda(dados.editoras).map((ed) => (
                <Linha
                  key={ed.nome}
                  nome={ed.outros ? "Outros" : ed.nome}
                  total={ed.total}
                  doTotal={total}
                  cor={ed.outros ? "var(--text-muted)" : corEditora(ed.nome)}
                  rotuloAcao="Mostrar na aba HQs"
                  onClick={ed.outros || !idEditora(ed.nome) ? null : () => onRecorte({ editora: idEditora(ed.nome) })}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
