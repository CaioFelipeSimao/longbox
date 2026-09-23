import { Plus, X } from "lucide-react";

import { STATUS, STATUS_ORDER, TIPOS } from "../lib/constantes";
import { Field, Modal } from "../ui/base";

export function FormVolume({
  personagens, showVolumeForm, setShowVolumeForm, volumeForm, setVolumeForm,
  volumeErrors, volumeDupWarning, salvarVolume, salvarVolumeEContinuar,
}) {
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
          <div className="grid-2">
            <Field label="Tipo">
              <select className="select" value={volumeForm.tipo} onChange={(e) => setVolumeForm((f) => ({ ...f, tipo: e.target.value }))}>
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Ano">
              <input className="input" value={volumeForm.ano} onChange={(e) => setVolumeForm((f) => ({ ...f, ano: e.target.value }))} />
            </Field>
          </div>
          <Field label="Editora">
            <input className="input" value={volumeForm.editora} onChange={(e) => setVolumeForm((f) => ({ ...f, editora: e.target.value }))} />
          </Field>
          <Field label="Status de leitura">
            <div className="seg3">
              {STATUS_ORDER.map((k) => (
                <button
                  key={k}
                  data-kind={k}
                  data-on={volumeForm.status === k ? "true" : "false"}
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
  personagens, showSerieForm, setShowSerieForm, serieForm, setSerieForm, serieErrors,
  serieDupWarning, salvarSerie,
}) {
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
              placeholder="Nightwing (Volume 2)"
              data-invalid={serieErrors.nome ? "true" : "false"}
              value={serieForm.nome}
              onChange={(e) => setSerieForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </Field>
          <Field
            label="Personagens"
            error={serieErrors.personagem}
            hint='Deixe "de" e "até" em branco para o personagem valer na série toda. Preencha só quando o protagonista muda no meio da numeração.'
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
            <input className="input" value={serieForm.editora} onChange={(e) => setSerieForm((f) => ({ ...f, editora: e.target.value }))} />
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
          <Field
            label="Ordem manual dentro do personagem"
            hint="Em branco ordena pelo ano de início. Preenchendo, número menor aparece primeiro."
          >
            <input className="input" type="number" step="0.1" value={serieForm.ordem} onChange={(e) => setSerieForm((f) => ({ ...f, ordem: e.target.value }))} />
          </Field>
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
