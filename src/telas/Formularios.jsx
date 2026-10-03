import { useEffect, useState } from "react";
import { Plus, X, ImagePlus, ChevronDown } from "lucide-react";

import { STATUS, STATUS_ORDER, tiposDaEditora } from "../lib/constantes";
import { usePasteImage } from "../lib/hooks";
import { Field, Modal } from "../ui/base";
import { OpcaoFiltro } from "../ui/Filtros";

// v95: the publisher is picked from the registered ones (Gerenciar editoras), so a
// typo cannot leave a volume under a publisher of its own with no formats. A value
// already stored that is not registered stays on offer, so opening and saving an
// old record never rewrites it behind the user's back.
function opcoesEditora(editoras, atual) {
  const nomes = (editoras || []).map((e) => e.nome).filter(Boolean);
  const extra = atual && !nomes.some((n) => n.toLowerCase() === atual.trim().toLowerCase()) ? [atual] : [];
  return [...nomes, ...extra];
}

// v139: the Longbox picker instead of a native select, whose open list the OS draws
// (white border, wider than the field) where no stylesheet reaches.
function SeletorEditora({ id, editoras, valor, onChange }) {
  return (
    <OpcaoFiltro
      id={id}
      rotulo="Editora"
      valor={valor || ""}
      todos="Sem editora"
      opcoes={opcoesEditora(editoras, valor).map((n) => ({ valor: n, rotulo: n }))}
      onChange={onChange}
    />
  );
}

export function FormVolume({
  personagens, editoras, showVolumeForm, setShowVolumeForm, volumeForm, setVolumeForm,
  volumeErrors, volumeDupWarning, salvarVolume, salvarVolumeEContinuar,
  canUpload, capaNova, setCapaNova,
}) {
  // v114: a new volume can take its cover in the same pass (file or Ctrl+V). The
  // file waits here and is uploaded right after the volume is saved.
  const aceitaCapa = !!(canUpload && volumeForm && !volumeForm.id);
  usePasteImage(!!showVolumeForm && aceitaCapa, setCapaNova);
  const [previa, setPrevia] = useState(null);
  useEffect(() => {
    if (!capaNova) { setPrevia(null); return undefined; }
    const url = URL.createObjectURL(capaNova);
    setPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [capaNova]);
  // Kept out of volumeForm on purpose: the form object is spread into the stored
  // volume on save, and this line is not part of it.
  const [avisoTipo, setAvisoTipo] = useState(null);
  useEffect(() => { setAvisoTipo(null); }, [showVolumeForm, volumeForm && volumeForm.id]);

  // Formats follow the publisher. One the new publisher does not have falls back
  // to Trade Paperback, and the form says so instead of changing it silently.
  const trocarEditora = (editora) => {
    const tipo = volumeForm.tipo;
    if (!tipo || tiposDaEditora(editora).includes(tipo)) {
      setVolumeForm((f) => ({ ...f, editora }));
      setAvisoTipo(null);
      return;
    }
    setVolumeForm((f) => ({ ...f, editora, tipo: "Trade Paperback" }));
    setAvisoTipo(tipo + " não existe " + (editora ? "na " + editora : "sem editora") + ", o tipo voltou para Trade Paperback.");
  };
  const tipos = volumeForm ? tiposDaEditora(volumeForm.editora) : [];
  const tiposComAtual = volumeForm && volumeForm.tipo && !tipos.includes(volumeForm.tipo) ? [...tipos, volumeForm.tipo] : tipos;

  return (
    <>
      {volumeForm && (
        <Modal
          open={showVolumeForm}
          onClose={() => setShowVolumeForm(false)}
          title={volumeForm.id ? "Editar volume" : "Novo volume"}
          footer={
            volumeForm.id ? (
              <div className="row">
                <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setShowVolumeForm(false)}>Cancelar</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={salvarVolume}>Salvar</button>
              </div>
            ) : (
              <>
                <div className="row">
                  <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setShowVolumeForm(false)}>Cancelar</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={salvarVolume}>Salvar e fechar</button>
                </div>
                <div className="row row-center">
                  <button className="btn btn-ghost" onClick={salvarVolumeEContinuar}>Salvar e cadastrar outro</button>
                </div>
              </>
            )
          }
        >
          <Field label="Título" error={volumeErrors.titulo}>
            <input
              className="input"
              data-invalid={volumeErrors.titulo ? "true" : "false"}
              value={volumeForm.titulo}
              onChange={(e) => setVolumeForm((f) => ({ ...f, titulo: e.target.value }))}
            />
          </Field>
          <Field label="Personagem principal" error={volumeErrors.personagem}>
            <input
              className="input"
              list="personagens-list"
              data-invalid={volumeErrors.personagem ? "true" : "false"}
              value={volumeForm.personagem}
              onChange={(e) => setVolumeForm((f) => ({ ...f, personagem: e.target.value }))}
            />
          </Field>
          <Field label="Editora">
            <SeletorEditora id="form-volume-editora" editoras={editoras} valor={volumeForm.editora} onChange={trocarEditora} />
          </Field>
          <div className="grid-2">
            <Field label="Tipo" hint={avisoTipo || undefined}>
              <OpcaoFiltro
                id="form-volume-tipo"
                rotulo="Tipo"
                valor={volumeForm.tipo}
                opcoes={tiposComAtual.map((t) => ({ valor: t, rotulo: t }))}
                onChange={(tipo) => { setAvisoTipo(null); setVolumeForm((f) => ({ ...f, tipo })); }}
              />
            </Field>
            <Field label="Ano">
              <input className="input" value={volumeForm.ano} onChange={(e) => setVolumeForm((f) => ({ ...f, ano: e.target.value }))} />
            </Field>
          </div>
          <Field label="Status de leitura">
            <div className="seg3">
              {STATUS_ORDER.map((k) => (
                <button
                  key={k}
                  data-kind={k}
                  data-on={volumeForm.status === k ? "true" : "false"}
                  aria-pressed={volumeForm.status === k}
                  onClick={() => setVolumeForm((f) => ({ ...f, status: k }))}
                >
                  {STATUS[k].label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Notas">
            <textarea className="textarea" value={volumeForm.notas} onChange={(e) => setVolumeForm((f) => ({ ...f, notas: e.target.value }))} />
          </Field>
          {/* v115: a full-width strip like the fields around it (v114's lone square
              with the hint below read as an empty hole in the form). */}
          {aceitaCapa && (
            <Field label="Capa">
              <div className="capa-nova">
                <label className="capa-nova-faixa">
                  <span className="capa-nova-mini">
                    {previa ? <img src={previa} alt="" /> : <ImagePlus size={18} aria-hidden="true" />}
                  </span>
                  <span className="capa-nova-texto">
                    <strong className="truncate">{capaNova ? capaNova.name : "Escolher imagem"}</strong>
                    <small>{capaNova ? "Toque para trocar" : "ou cole com Ctrl+V. Pode ficar para depois."}</small>
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    className="sr-only"
                    aria-label={capaNova ? "Trocar a capa escolhida" : "Escolher a capa"}
                    onChange={(e) => { if (e.target.files[0]) setCapaNova(e.target.files[0]); e.target.value = ""; }}
                  />
                </label>
                {capaNova && (
                  <button type="button" className="btn-icon" onClick={() => setCapaNova(null)} aria-label="Tirar a capa escolhida">
                    <X size={16} />
                  </button>
                )}
              </div>
            </Field>
          )}
          {volumeDupWarning && <p className="field-error">{volumeDupWarning}</p>}
        </Modal>
      )}
    </>
  );
}

export function FormColecao({
  showColecaoForm, setShowColecaoForm, colecaoForm, setColecaoForm, colecaoErrors,
  salvarColecao,
}) {
  return (
    <>
      {colecaoForm && (
        <Modal
          open={showColecaoForm}
          onClose={() => setShowColecaoForm(false)}
          title={colecaoForm.id ? "Editar coleção" : "Nova coleção"}
          footer={
            <div className="row">
              <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setShowColecaoForm(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={salvarColecao}>Salvar</button>
            </div>
          }
        >
          <Field label="Nome" error={colecaoErrors.nome}>
            <input
              className="input"
              data-invalid={colecaoErrors.nome ? "true" : "false"}
              value={colecaoForm.nome}
              onChange={(e) => setColecaoForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </Field>
          <Field label="Descrição">
            <textarea className="textarea" value={colecaoForm.descricao} onChange={(e) => setColecaoForm((f) => ({ ...f, descricao: e.target.value }))} />
          </Field>
        </Modal>
      )}
    </>
  );
}

export function FormSerie({
  personagens, editoras, showSerieForm, setShowSerieForm, serieForm, setSerieForm, serieErrors,
  serieDupWarning, salvarSerie,
}) {
  // v121: "de/até" and the position are rarely needed, so they wait behind "Mais opções";
  // a série that already uses them opens with them shown.
  const [serieMaisAberto, setSerieMaisAberto] = useState(false);
  useEffect(() => { if (showSerieForm) setSerieMaisAberto(false); }, [showSerieForm]);
  const serieMais = serieMaisAberto || !!(serieForm && (String(serieForm.ordem ?? "").trim() ||
    serieForm.personagensList.some((p) => String(p.de ?? "").trim() || String(p.ate ?? "").trim())));
  return (
    <>
      {serieForm && (
        <Modal
          open={showSerieForm}
          onClose={() => setShowSerieForm(false)}
          title={serieForm.id ? "Editar série" : "Nova série"}
          footer={
            <div className="row">
              <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setShowSerieForm(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={salvarSerie}>Salvar</button>
            </div>
          }
        >
          <Field label="Nome" error={serieErrors.nome}>
            <input
              className="input"
              placeholder="Título (Volume N)"
              data-invalid={serieErrors.nome ? "true" : "false"}
              value={serieForm.nome}
              onChange={(e) => setSerieForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </Field>
          <Field
            label="Personagens"
            error={serieErrors.personagem}
            hint={serieMais ? 'Deixe "de" e "até" em branco para o personagem valer na série toda. Preencha só quando o protagonista muda no meio da numeração.' : undefined}
          >
            {serieForm.personagensList.map((p, idx) => (
              <div className="row" key={idx} style={{ marginBottom: 6, alignItems: "center" }}>
                <input
                  className="input"
                  list="personagens-list"
                  placeholder="Personagem"
                  style={{ flex: 1 }}
                  value={p.nome}
                  onChange={(e) => setSerieForm((f) => ({ ...f, personagensList: f.personagensList.map((x, i) => (i === idx ? { ...x, nome: e.target.value } : x)) }))}
                />
                {serieMais && (<>
                <input
                  className="input" type="number" placeholder="de" style={{ width: 68 }}
                  value={p.de}
                  onChange={(e) => setSerieForm((f) => ({ ...f, personagensList: f.personagensList.map((x, i) => (i === idx ? { ...x, de: e.target.value } : x)) }))}
                />
                <input
                  className="input" type="number" placeholder="até" style={{ width: 68 }}
                  value={p.ate}
                  onChange={(e) => setSerieForm((f) => ({ ...f, personagensList: f.personagensList.map((x, i) => (i === idx ? { ...x, ate: e.target.value } : x)) }))}
                />
                </>)}
                {serieForm.personagensList.length > 1 && (
                  <button
                    className="btn-icon"
                    onClick={() => setSerieForm((f) => ({ ...f, personagensList: f.personagensList.filter((_, i) => i !== idx) }))}
                    aria-label="Remover personagem"
                  >
                    <X size={15} color="var(--danger-text)" />
                  </button>
                )}
              </div>
            ))}
            <button
              className="btn btn-quiet"
              onClick={() => setSerieForm((f) => ({ ...f, personagensList: [...f.personagensList, { nome: "", de: "", ate: "" }] }))}
            >
              <Plus size={14} /> Adicionar personagem
            </button>
          </Field>
          <Field label="Editora">
            <SeletorEditora id="form-serie-editora" editoras={editoras} valor={serieForm.editora} onChange={(editora) => setSerieForm((f) => ({ ...f, editora }))} />
          </Field>
          <div className="grid-3">
            <Field label="Ano início">
              <input className="input" value={serieForm.anoInicio} onChange={(e) => setSerieForm((f) => ({ ...f, anoInicio: e.target.value }))} />
            </Field>
            <Field label="Ano fim">
              <input className="input" placeholder="presente" value={serieForm.anoFim} onChange={(e) => setSerieForm((f) => ({ ...f, anoFim: e.target.value }))} />
            </Field>
            <Field label="Total edições">
              <input className="input" type="number" min="0" value={serieForm.totalEdicoes} onChange={(e) => setSerieForm((f) => ({ ...f, totalEdicoes: e.target.value }))} />
            </Field>
          </div>
          {serieMais ? (
            <Field
              label="Posição entre as séries do personagem"
              hint="Em branco, segue o ano de início. Número menor vem antes."
            >
              <input className="input" type="number" step="0.1" value={serieForm.ordem} onChange={(e) => setSerieForm((f) => ({ ...f, ordem: e.target.value }))} />
            </Field>
          ) : (
            <button type="button" className="btn btn-ghost mais-opcoes" onClick={() => setSerieMaisAberto(true)}>
              <ChevronDown size={14} /> Mais opções
            </button>
          )}
          {serieDupWarning && <p className="field-error">{serieDupWarning}</p>}
        </Modal>
      )}
    </>
  );
}

export function FormEdicao({
  showEdicaoForm, setShowEdicaoForm, edicaoForm, setEdicaoForm, salvarEdicao,
}) {
  return (
    <>
      {edicaoForm && (
        <Modal
          open={showEdicaoForm}
          onClose={() => setShowEdicaoForm(false)}
          title={edicaoForm.id ? "Editar edição" : "Catalogar edição"}
          footer={
            <div className="row">
              <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setShowEdicaoForm(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={salvarEdicao}>Salvar</button>
            </div>
          }
        >
          <Field label="Número">
            <input className="input" value={edicaoForm.numero} onChange={(e) => setEdicaoForm((f) => ({ ...f, numero: e.target.value }))} />
          </Field>
          <div className="grid-2">
            <Field label="Mês">
              <input className="input" placeholder="Outubro" value={edicaoForm.mes} onChange={(e) => setEdicaoForm((f) => ({ ...f, mes: e.target.value }))} />
            </Field>
            <Field label="Ano">
              <input className="input" value={edicaoForm.ano} onChange={(e) => setEdicaoForm((f) => ({ ...f, ano: e.target.value }))} />
            </Field>
          </div>
          <Field
            label="Posição no checklist"
            hint="Em branco ordena pelo número normal. Use 25.5 para ficar entre a 25 e a 26."
          >
            <input className="input" value={edicaoForm.posicao} onChange={(e) => setEdicaoForm((f) => ({ ...f, posicao: e.target.value }))} />
          </Field>
          <label className="check-linha">
            <input
              type="checkbox"
              checked={!!edicaoForm.reimpressao}
              onChange={(e) => setEdicaoForm((f) => ({ ...f, reimpressao: e.target.checked }))}
            />
            <span>Esta edição é uma reimpressão</span>
          </label>
          {edicaoForm.reimpressao && (
            <Field label="Original" hint="De onde vem o material, em texto livre. Em branco é aceito.">
              <input className="input" placeholder="Flash #105 (1959)" value={edicaoForm.origem || ""} onChange={(e) => setEdicaoForm((f) => ({ ...f, origem: e.target.value }))} />
            </Field>
          )}
        </Modal>
      )}
    </>
  );
}

export function ImportarEdicoes({
  showImportModal, setShowImportModal, importText, setImportText, importarEdicoes,
}) {
  return (
    <Modal
      open={showImportModal}
      onClose={() => setShowImportModal(false)}
      title="Importar edições"
      footer={
        <div className="row">
          <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setShowImportModal(false)}>Cancelar</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={importarEdicoes}>Importar</button>
        </div>
      }
    >
      <p className="t-small muted" style={{ margin: 0 }}>
        Uma edição por linha, no formato <span className="num">número, mês, ano</span>. Só o número
        é obrigatório. Uma linha como <span className="num">21-30</span> cria o intervalo inteiro de
        uma vez. Número que já existe na série é atualizado, não duplicado. Colar de planilha funciona.
      </p>
      <textarea
        className="textarea num"
        rows={9}
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
        placeholder={"1, Outubro, 1996\n2, Novembro, 1996\n0\n12.1, Janeiro, 2012\n21-30"}
      />
    </Modal>
  );
}
