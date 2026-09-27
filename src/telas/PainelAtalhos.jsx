import { Modal } from "../ui/base";

// Q4 (v91): the one place that lists every shortcut, opened with "?". The keys that
// already existed (Esc, the arrows, Ctrl+V) are listed too, so it is the whole set.
const GRUPOS = [
  ["Em qualquer tela", [
    [["/"], "Ir para a busca"],
    [["0"], "Voltar ao início"],
    [["1", "2", "3"], "Abrir HQs, Coleções ou Séries"],
    [["N"], "Novo na aba aberta (volume, coleção ou série)"],
    [["Q"], "Esconder ou mostrar todos os grupos (HQs e Séries)"],
    [["?"], "Esta lista"],
  ]],
  ["Numa estante de capas", [
    [["←", "→"], "Capa anterior e próxima"],
    [["↑", "↓"], "Capa de cima e de baixo"],
    [["Home", "End"], "Primeira e última capa"],
    [["Enter"], "Abrir o volume"],
    [["J", "K", "L"], "Marcar não lida, lendo ou lida"],
  ]],
  ["Com uma ficha aberta", [
    [["E"], "Editar o que ela mostra"],
    [["J", "K", "L"], "Não lida, lendo ou lida (ficha de volume)"],
    [["←", "→"], "Volume anterior e próximo"],
    [["Ctrl+V"], "Colar uma capa (ficha de volume)"],
    [["Esc"], "Fechar"],
  ]],
  ["Depois de remover algo", [
    [["Ctrl+Z"], "Desfazer, enquanto o aviso estiver na tela"],
  ]],
];

export function PainelAtalhos({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Atalhos do teclado">
      <div className="atalhos">
        {GRUPOS.map(([titulo, linhas]) => (
          <section key={titulo}>
            <p className="t-micro">{titulo}</p>
            <dl>
              {linhas.map(([teclas, texto]) => (
                <div className="atalho" key={texto}>
                  <dt>{teclas.map((t) => <kbd key={t}>{t}</kbd>)}</dt>
                  <dd>{texto}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <p className="t-small muted atalhos-nota">
          Nenhum atalho funciona enquanto você digita num campo. Se a primeira tecla não
          responder, clique em qualquer lugar do app antes: o Longbox roda dentro da página
          do claude.ai e só recebe as teclas depois de um clique nele.
        </p>
      </div>
    </Modal>
  );
}
