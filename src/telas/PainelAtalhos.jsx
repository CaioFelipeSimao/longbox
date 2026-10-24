import { Modal } from "../ui/base";

// Q4 (v91): the one place that lists every shortcut, opened with "?". The keys that
// already existed (Esc, the arrows, Ctrl+V) are listed too, so it is the whole set.
const GRUPOS = [
  ["Gestos (toque ou mouse)", [
    [[], "Segure uma capa por meio segundo e arraste: reordena as HQs dentro do personagem, os volumes de uma coleção e as séries dentro de um volume ou de um personagem"],
    [[], "Solte no espaço vazio depois da última capa: vai para o fim da lista"],
    [[], "Segure o título de uma coleção na lista de desejos e arraste: reordena as coleções"],
    [[], "Toque no alfinete ao lado do nome de um personagem: fixa até 3 personagens no topo (HQs e Séries)"],
    [[], "Toque na seta do nome do personagem ou da editora: recolhe e mostra"],
    [[], "Em Coleções, Gerenciar abre a coleção para adicionar volumes e mudar a ordem de leitura"],
  ]],
  ["Em qualquer tela", [
    [["/"], "Ir para a busca"],
    [["0"], "Voltar ao início"],
    [["1", "2", "3"], "Abrir HQs, Coleções ou Séries"],
    [["4"], "Abrir ou fechar a lista de desejos"],
    [["N"], "Novo na tela aberta (volume, coleção, série ou desejo)"],
    [["Q"], "Esconder ou mostrar todos os grupos (HQs, Séries e desejos)"],
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
    [["N"], "Nova edição (ficha de série)"],
    [["J", "K", "L"], "Não lida, lendo ou lida (ficha de volume)"],
    [["←", "→"], "Volume anterior e próximo (ficha de volume)"],
    [["←", "→"], "Edição anterior e próxima, com uma escolhida (ficha de série)"],
    [["Ctrl+V"], "Colar uma capa (ficha de volume)"],
    [["Esc"], "Fechar"],
  ]],
  ["Depois de remover algo", [
    [["Ctrl+Z"], "Desfazer, enquanto o aviso estiver na tela"],
  ]],
];

export function PainelAtalhos({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Atalhos e gestos">
      <div className="atalhos">
        {GRUPOS.map(([titulo, linhas], i) => (
          <section key={titulo} className={i > 0 ? "so-teclado" : undefined}>
            <p className="t-micro">{titulo}</p>
            <dl>
              {linhas.map(([teclas, texto]) => (
                <div className="atalho" key={texto}>
                  {teclas.length > 0 && <dt>{teclas.map((t) => <kbd key={t}>{t}</kbd>)}</dt>}
                  <dd>{texto}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <p className="t-small muted atalhos-nota so-teclado">
          Nenhum atalho funciona enquanto você digita num campo. Se a primeira tecla não
          responder, clique em qualquer lugar do app antes: o Longbox roda dentro da página
          do claude.ai e só recebe as teclas depois de um clique nele.
        </p>
      </div>
    </Modal>
  );
}
