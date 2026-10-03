# Autores e reimpressões nas edições Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada edição possuída mostra writer/penciler/inker (com busca e filtro por autor), e edições que são reimpressões ganham selo e um interruptor para escondê-las.

**Architecture:** Três campos opcionais na edição (`autores`, `reimpressao`, `origem`) dentro do documento `edicoes/<serieId>` que já existe. Funções puras em `src/lib/edicoes.js` (testadas sem DOM); a UI as consome na ficha da série, no formulário da edição, na busca e na aba Séries. A skill `longbox-cadastrar` passa a ler os autores do infobox do Fandom e a gravá-los.

**Tech Stack:** React 18, esbuild (`node scripts/build.mjs`), JSDOM nos testes (`tests/*.mjs`, rodados por `scripts/test.mjs` com piso de PASS por suíte), skill em `C:\Users\ACER\.claude\skills\longbox-cadastrar` (módulos `.mjs` + testes próprios).

**Spec:** `docs/superpowers/specs/2026-10-03-autores-reimpressoes-design.md`

## Global Constraints

- Campos novos são opcionais: edição sem eles continua válida (sem autores, não é reimpressão). Exports antigos importam sem transformação.
- Reimpressão é só exibição: nunca muda "tenho/falta" nem os totais "N de M possuídas".
- Autores só das edições em `edicoesColetadasIds` de algum volume.
- `origem` é texto livre, não link entre edições.
- Todo texto de interface em pt-BR; sem travessão nem emoji na interface (regra de pontuação do projeto, ver `DESIGN.md`).
- Alvos de toque de 44px em ponteiro grosso; foco e `aria-*` como o restante do app.
- Cada passo visual: prévia (captura por `SendUserFile` ou artifact descartável) e "pode" do usuário antes de publicar; publicar apaga a prévia.
- Rotina por versão: `npm run check`, entrada no `HISTORICO.md`, `DESIGN.md` atualizado quando o spec mudar, ler o live antes de publicar, `cmp` depois, commit com as linhas de atribuição, `git tag vN`.
- Testes primeiro: escrever, ver falhar, implementar. Ao adicionar asserções, subir o `minimo` em `scripts/test.mjs` na mesma mudança.
- Heredocs com `${}` ou barra invertida são mutilados: scripts vão para arquivo com a ferramenta Write.

## Review Focus

- Edição antiga sem nenhum campo novo: ficha, selo, filtro e busca não podem quebrar (nem `undefined.writer`).
- Autor com acento ou caixa diferente ("Mark Waid" vs "mark waid", "Gaiman" vs "Gáiman"): busca e filtro dobram acento e caixa, como já fazem com personagens.
- Mesmo autor escrito de dois jeitos na mesma lista ("Jack Kirby", "Jack Kirby "): a lista de opções do filtro deduplica depois de aparar espaços.
- Interruptor "Esconder reimpressões" ligado numa série cuja faixa tem só reimpressões: mostra mensagem de vazio, não uma grade em branco, e os totais não mudam.
- Salvar uma edição pelo formulário não pode apagar `autores`, `reimpressao` nem `origem` que o formulário não mostrou (e a mescla de três vias em `mesclar.js` os preserva ao sincronizar entre aparelhos).

---

## File Structure

- Create `src/lib/edicoes.js`: funções puras `autoresDe`, `textoAutores`, `ehReimpressao`, `autoresPossuidos`, `serieTemAutor`, `serieTemReimpressao`, `parseAutores`.
- Create `tests/test-edicoes.mjs`: testes das funções puras (sem DOM).
- Create `tests/test-reimpressoes.mjs`: JSDOM, selo, ficha, formulário e interruptor.
- Create `tests/test-autores.mjs`: JSDOM, ficha, formulário, busca e filtro por autor.
- Modify `src/telas/SerieSheet.jsx`: selo no tile, ficha, interruptor.
- Modify `src/telas/Formularios.jsx` (`FormEdicao`): checkbox, origem, três campos de autor.
- Modify `src/telas/App.jsx`: estado inicial do formulário, `textoBusca`, `seriesFiltradas`, filtro por autor, sessão.
- Modify `src/telas/AbaSeries.jsx`: nada (recebe `seriesFiltradas` já filtrada).
- Modify `src/ui/Filtros.jsx` (`PersonagemFiltro`): props de rótulo para servir ao autor.
- Modify `src/lib/sessao.js`: `lerFiltroAutor` e `salvarFiltroAutor`.
- Modify `src/styles.css`: `.tile[data-reimp]` e `.reimp-selo`.
- Modify `scripts/test.mjs`: suítes novas com piso.
- Skill: modify `lib/montar.mjs`, create `lib/autores.mjs`, create `test-autores.mjs`, modify `SKILL.md`, create `reimpressoes.mjs` (Task 3).

---

### Task 1: Funções puras de edição (`src/lib/edicoes.js`)

**Files:**
- Create: `src/lib/edicoes.js`
- Test: `tests/test-edicoes.mjs`
- Modify: `scripts/test.mjs`

**Interfaces:**
- Produces:
  - `autoresDe(e) -> { writer: string[], penciler: string[], inker: string[] }` (sempre as três listas, vazias se não houver).
  - `textoAutores(e) -> string` (todos os nomes juntos, para busca).
  - `ehReimpressao(e) -> boolean`.
  - `parseAutores(texto) -> string[]` (separa por vírgula ou ponto e vírgula, apara, tira vazios e repetidos).
  - `autoresPossuidos(edicoes, ownedIds) -> {nome: string, n: number}[]` (ordenado por nome, `n` = edições possuídas dele).
  - `serieTemAutor(eds, ownedIds, nome, parcial = false) -> boolean` (`parcial` casa um pedaço do nome, para a busca livre; sem ele, nome inteiro, para o filtro; ambos ignoram caixa e acento).
  - `serieTemReimpressao(eds) -> boolean`.

- [ ] **Step 1: Escrever o teste que falha**

```js
// tests/test-edicoes.mjs
import { autoresDe, textoAutores, ehReimpressao, parseAutores, autoresPossuidos, serieTemAutor, serieTemReimpressao } from "../src/lib/edicoes.js";

let falhas = 0, passes = 0;
const check = (nome, ok, info) => {
  if (ok) passes++; else falhas++;
  console.log("  " + (ok ? "PASS" : "FAIL") + " " + nome + (!ok && info !== undefined ? "  (" + info + ")" : ""));
};
const j = JSON.stringify;

const antiga = { id: "a", serieId: "s", numero: "1" };
const cheia = { id: "b", serieId: "s", numero: "2", autores: { writer: ["Mark Waid"], penciler: ["Mike Wieringo"], inker: ["Jose Marzan Jr."] }, reimpressao: true, origem: "Flash #105 (1959)" };
const so = { id: "c", serieId: "s", numero: "3", autores: { writer: ["Mark Waid", "Brian Augustyn"] } };

check("edicao antiga: tres listas vazias", j(autoresDe(antiga)) === j({ writer: [], penciler: [], inker: [] }), j(autoresDe(antiga)));
check("edicao cheia", autoresDe(cheia).penciler[0] === "Mike Wieringo");
check("autores parcial completa as listas", autoresDe(so).inker.length === 0 && autoresDe(so).writer.length === 2);
check("textoAutores da antiga e vazio", textoAutores(antiga) === "");
check("textoAutores junta tudo em minusculas", textoAutores(cheia) === "mark waid mike wieringo jose marzan jr.", textoAutores(cheia));
check("ehReimpressao so quando true", ehReimpressao(cheia) && !ehReimpressao(antiga) && !ehReimpressao({ reimpressao: "sim" }));
check("parseAutores separa e apara", j(parseAutores(" Mark Waid ; Brian Augustyn,Mark Waid ,")) === j(["Mark Waid", "Brian Augustyn"]), j(parseAutores(" Mark Waid ; Brian Augustyn,Mark Waid ,")));
check("parseAutores vazio", parseAutores("").length === 0 && parseAutores(undefined).length === 0);

const eds = [antiga, cheia, so, { id: "d", serieId: "s", numero: "4", autores: { writer: ["Mark Waid"] } }];
const donos = new Set(["b", "c"]);
const lista = autoresPossuidos(eds, donos);
// b e c sao possuidas, d (tambem do Waid) nao: Waid conta 2, nao 3.
check("autoresPossuidos so conta as possuidas", lista.find((x) => x.nome === "Mark Waid").n === 2, j(lista));
check("autoresPossuidos inclui quem so aparece numa possuida", lista.some((x) => x.nome === "Jose Marzan Jr.") && lista.some((x) => x.nome === "Brian Augustyn"));
check("autoresPossuidos ordenado", j(lista.map((x) => x.nome)) === j([...lista.map((x) => x.nome)].sort((a, b) => a.localeCompare(b, "pt-BR"))));
check("autoresPossuidos deduplica espacos", autoresPossuidos([{ id: "x", autores: { writer: ["Jack Kirby", "Jack Kirby "] } }], new Set(["x"])).length === 1);
const gaiman = [{ id: "z", autores: { writer: ["Neil Gaiman"] } }];
check("serieTemAutor ignora caixa", serieTemAutor(eds, donos, "mark WAID"));
check("serieTemAutor ignora acento", serieTemAutor(gaiman, new Set(["z"]), "Gáiman"));
check("serieTemAutor exato nao casa pedaco de nome", !serieTemAutor(gaiman, new Set(["z"]), "Gai"));
check("serieTemAutor parcial casa pedaco de nome", serieTemAutor(gaiman, new Set(["z"]), "gai", true));
check("serieTemAutor nao conta edicao nao possuida", !serieTemAutor(eds, new Set(["a"]), "Mark Waid"));
check("serieTemReimpressao", serieTemReimpressao(eds) && !serieTemReimpressao([antiga]));

console.log("\n" + passes + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd C:/Users/ACER/longbox && node tests/test-edicoes.mjs`
Expected: erro de import (`edicoes.js` não existe).

- [ ] **Step 3: Implementar**

```js
// src/lib/edicoes.js
// v145: campos opcionais da edição. Edições antigas não os têm, então toda leitura
// passa por aqui em vez de olhar e.autores direto.
const dobrar = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const FUNCOES = ["writer", "penciler", "inker"];

export function autoresDe(e) {
  const a = (e && e.autores) || {};
  const lista = (f) => (Array.isArray(a[f]) ? a[f].map((n) => String(n).trim()).filter(Boolean) : []);
  return { writer: lista("writer"), penciler: lista("penciler"), inker: lista("inker") };
}

export function textoAutores(e) {
  const a = autoresDe(e);
  return FUNCOES.flatMap((f) => a[f]).join(" ").toLowerCase();
}

export const ehReimpressao = (e) => !!e && e.reimpressao === true;

export function parseAutores(texto) {
  const vistos = new Set();
  return String(texto || "").split(/[;,]/).map((n) => n.trim()).filter((n) => {
    if (!n || vistos.has(dobrar(n))) return false;
    vistos.add(dobrar(n));
    return true;
  });
}

export function autoresPossuidos(edicoes, ownedIds) {
  const n = {};
  edicoes.forEach((e) => {
    if (!ownedIds.has(e.id)) return;
    const a = autoresDe(e);
    const deste = new Set(FUNCOES.flatMap((f) => a[f]).map(dobrar));
    FUNCOES.flatMap((f) => a[f]).forEach((nome) => {
      const k = dobrar(nome);
      if (!deste.has(k)) return;
      deste.delete(k);
      (n[k] = n[k] || { nome, n: 0 }).n++;
    });
  });
  return Object.values(n).sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
}

// parcial=false: o nome inteiro (filtro). parcial=true: um pedaco do nome (busca livre).
export function serieTemAutor(eds, ownedIds, nome, parcial = false) {
  const alvo = dobrar(nome);
  if (!alvo) return false;
  const casa = (x) => (parcial ? dobrar(x).includes(alvo) : dobrar(x) === alvo);
  return eds.some((e) => ownedIds.has(e.id) && FUNCOES.some((f) => autoresDe(e)[f].some(casa)));
}

export const serieTemReimpressao = (eds) => eds.some(ehReimpressao);
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node tests/test-edicoes.mjs`
Expected: todos PASS, 0 falharam.

- [ ] **Step 5: Registrar a suíte e commitar**

Adicionar em `scripts/test.mjs` (dentro de `SUITES`): `{ args: ["tests/test-edicoes.mjs"], minimo: 15 },`.

```bash
cd C:/Users/ACER/longbox && node scripts/test.mjs 2>&1 | tail -5
git add src/lib/edicoes.js tests/test-edicoes.mjs scripts/test.mjs
git commit -m "feat: funcoes puras de autores e reimpressao nas edicoes

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UnZU8HaCSjetyzW4CwoNLU"
```

---

### Task 2: Reimpressões na interface (selo, ficha, formulário, interruptor)

**Files:**
- Modify: `src/telas/SerieSheet.jsx` (tile em `renderTile`, ficha `selecionada`, interruptor perto de `mapa-topo`)
- Modify: `src/telas/Formularios.jsx` (`FormEdicao`)
- Modify: `src/telas/App.jsx:1489` (estado inicial de `setEdicaoForm`) e `salvarEdicao` (~946)
- Modify: `src/styles.css`
- Test: `tests/test-reimpressoes.mjs`; `scripts/test.mjs`

**Interfaces:**
- Consumes: `ehReimpressao`, `serieTemReimpressao` de `src/lib/edicoes.js` (Task 1).
- Produces: tile com `data-reimp="true"` e `aria-label` terminando em ", reimpressão"; interruptor `<button aria-pressed>` com `aria-label="Esconder reimpressões"`; campos do formulário `reimpressao` (boolean) e `origem` (string).

- [ ] **Step 1: Escrever o teste que falha**

Montar o app como em `tests/test-faltantes.mjs` (mesmo `montar`: JSDOM + `dist/app.js`, `docs` fake) com uma série `s1` de 8 edições: `s1-1..s1-6` normais (`s1-1` e `s1-2` possuídas) e `s1-7`, `s1-8` com `reimpressao: true`, `s1-8` com `origem: "Flash #105 (1959)"`, uma delas possuída (`s1-7`). Abrir a série (clicar na linha da série na aba Séries). Asserções (cada uma com `check(...)`):
1. o tile 7 tem `data-reimp="true"` e o tile 1 não;
2. o `aria-label` do tile 7 contém "reimpressão";
3. clicar no tile 8: a ficha mostra "Reimpressão" e o texto "Flash #105 (1959)";
4. o botão "Esconder reimpressões" existe nesta série;
5. clicar nele: os tiles 7 e 8 somem, os tiles 1-6 ficam, e o texto de contagem continua "2 de 8 possuídas"... (ownedCount conta `eds`, não os escondidos);
6. clicar de novo: tiles 7 e 8 voltam;
7. numa série sem nenhuma reimpressão o botão não existe;
8. abrir "Editar edição" no tile 8: o checkbox "Reimpressão" está marcado e o campo "Original" tem o valor; salvar sem mexer mantém `reimpressao` e `origem` no documento gravado (ler do `docs` fake);
9. edição antiga (tile 1) abre a ficha sem erro (`erros.length === 0`).

Copiar `montar`/`check`/`sleep` de `tests/test-faltantes.mjs` (não importar; cada teste é autônomo) e o piso final: imprimir `passes` e sair com 1 se `falhas`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd C:/Users/ACER/longbox && node scripts/build.mjs && node tests/test-reimpressoes.mjs`
Expected: FAIL nos itens 1 a 8 (nada implementado), item 9 PASS.

- [ ] **Step 3: Implementar**

`SerieSheet.jsx`: importar `ehReimpressao, serieTemReimpressao`; `const [escondeReimp, setEscondeReimp] = useState(false);` com `useEffect(() => setEscondeReimp(false), [serieId])`; depois de `edsFiltradas` definida, trocar por:

```jsx
const edsFiltradas0 = busca.trim()
  ? eds.filter((e) => e.numero.toLowerCase().includes(busca.trim().toLowerCase()))
  : eds;
const temReimp = serieTemReimpressao(eds);
const edsFiltradas = escondeReimp ? edsFiltradas0.filter((e) => !ehReimpressao(e)) : edsFiltradas0;
```

`useGroups` e `grupos` continuam usando `edsFiltradas`. No `renderTile`: `data-reimp={ehReimpressao(e) ? "true" : undefined}` e `aria-label={"Nº " + e.numero + (ownedIds.has(e.id) ? ", possuída" : ", falta") + (ehReimpressao(e) ? ", reimpressão" : "")}`. Em `mapa-topo`, depois da legenda, quando `temReimp`:

```jsx
<button type="button" className="btn btn-quiet reimp-toggle" aria-pressed={escondeReimp} onClick={() => setEscondeReimp((v) => !v)}>
  {escondeReimp ? "Mostrar reimpressões" : "Esconder reimpressões"}
</button>
```

(o `aria-label` do teste vira o texto do botão: ajustar a asserção 4 para procurar por texto "reimpressões" no botão com a classe `reimp-toggle`). Quando `edsFiltradas` ficar vazia por causa do interruptor, a mensagem existente "Nada encontrado para ..." usa `busca`; trocar para `busca.trim() ? 'Nada encontrado para "' + busca + '".' : "Só há reimpressões nesta faixa."`.

Ficha: depois da linha da data, quando `ehReimpressao(selecionada)`: `<p className="t-small num" style={{ margin: "4px 0 0", color: "var(--accent-text)" }}>Reimpressão{selecionada.origem ? " de " + selecionada.origem : ""}</p>`.

`Formularios.jsx` `FormEdicao`, depois do campo de posição: checkbox "Reimpressão" (`edicaoForm.reimpressao`) e, só se marcado, `<input className="input" placeholder="Flash #105 (1959)">` com rótulo "Original" ligado a `edicaoForm.origem`, usando o componente `Field` existente como os outros campos do arquivo.

`App.jsx`: no estado inicial (linha 1489) acrescentar `reimpressao: false, origem: ""`; em `salvarEdicao` (≈946) garantir `reimpressao: !!edicaoForm.reimpressao, origem: edicaoForm.reimpressao ? edicaoForm.origem.trim() : ""` e que `...edicaoForm` já carrega `autores` (não tocar neles).

`styles.css`: `.tile[data-reimp="true"]::after` com um ponto discreto no canto superior direito (6px, cor `--text-muted`), e `.reimp-toggle { margin: 0 0 12px; }`. Usar variáveis que já existem (conferir no próprio arquivo antes de escolher o nome).

- [ ] **Step 4: Rodar e ver passar**

Run: `cd C:/Users/ACER/longbox && node scripts/build.mjs && node tests/test-reimpressoes.mjs`
Expected: todos PASS.

- [ ] **Step 5: Registrar a suíte, check completo, prévia, commitar**

Adicionar `{ args: ["tests/test-reimpressoes.mjs"], minimo: <contagem de PASS real> },` em `scripts/test.mjs`. Rodar `npm run check`: nada vermelho. Tirar capturas de uma série com reimpressões (puppeteer em `C:/Users/ACER/AppData/Local/Temp/claude/C--Users-ACER/0a61f1c2-0210-4189-b01f-87984f1c8f70/scratchpad/node_modules/puppeteer-core`, iPhone e PC) e enviar com `SendUserFile`. Esperar o "pode" antes da Task 3 publicar. Commit:

```bash
git add -A src tests scripts
git commit -m "feat: selo e filtro de reimpressoes na serie

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UnZU8HaCSjetyzW4CwoNLU"
```

---

### Task 3: Marcar as reimpressões do Flash vol. 1 (dados)

**Files:**
- Create: `C:\Users\ACER\.claude\skills\longbox-cadastrar\reimpressoes.mjs`
- Create: `C:\Users\ACER\.claude\skills\longbox-cadastrar\test-reimpressoes.mjs`

**Interfaces:**
- Consumes: `paginas(titulos, wiki)` de `lib/fandom.mjs`, `campo`, `campoLongo` de `lib/wikitext.mjs`.
- Produces: `relatorioReimpressoes(serieId) -> { candidatas: [{numero, pista, origem?}] }` (nada é gravado por este script).

Aqui o passo 1 é pesquisa, porque ainda não sabemos como o wiki marca reimpressões, e o spec diz que a marcação é irregular. Não inventar o padrão.

- [ ] **Step 1: Descobrir o padrão no wiki, sem gravar nada**

Buscar 10 edições do Flash vol. 1 que sabidamente reimprimem material (100 páginas, "Flash Facts", edições de 80 páginas) e 10 que não, com `umaPagina("The Flash Vol 1 <n>")`, e procurar no wikitext por indícios: campo de capa "Reprint", texto "reprints", `Appearing`/`Synopsis` com nota de reimpressão, ou a categoria "Reprints". Registrar em um comentário no topo de `reimpressoes.mjs` quais pistas existem e com que frequência. Reportar ao usuário o que foi achado antes de seguir.

- [ ] **Step 2: Escrever o teste com fixtures reais**

Salvar duas páginas reais como fixtures (`fixtures/flash-reimp-NNN.json` e `fixtures/flash-original-NNN.json`, via `capturar-fixtures.mjs`) e testar `detectarReimpressao(wikitext)` -> `{ reimpressao: true|false, origem: string|"" }`: verdadeiro e com origem na primeira, falso na segunda.

- [ ] **Step 3: Implementar `detectarReimpressao` pelo padrão achado no Step 1** e `relatorioReimpressoes(serieId)` que lê as edições do banco (ArtifactData `edicoes/<serieId>`), consulta cada número no wiki e devolve a lista de candidatas com a pista. Rodar `node test-reimpressoes.mjs`: PASS.

- [ ] **Step 4: Rodar no Flash vol. 1 e mostrar a lista ao usuário**

Gerar o relatório, enviar ao usuário (número, pista, origem sugerida) e esperar a confirmação, edição por edição se ele quiser. É a validação que o spec exige.

- [ ] **Step 5: Gravar** só o que o usuário confirmou, com `ArtifactData` `update` no documento `edicoes/<serieId>` (ler antes, mexer só em `reimpressao`/`origem`, escrever de volta com a versão lida). Conferir lendo de novo e abrir a série no app. Commit na skill (`git -C ~/.claude/skills/longbox-cadastrar ...`, repo próprio).

---

### Task 4: Autores na ficha e no formulário

**Files:**
- Modify: `src/telas/SerieSheet.jsx` (ficha `selecionada`)
- Modify: `src/telas/Formularios.jsx` (`FormEdicao`)
- Modify: `src/telas/App.jsx` (estado inicial do formulário, `onEditEdicao`, `salvarEdicao`)
- Test: `tests/test-autores.mjs`; `scripts/test.mjs`

**Interfaces:**
- Consumes: `autoresDe`, `parseAutores` (Task 1).
- Produces: no formulário, três campos de texto `autoresWriter`, `autoresPenciler`, `autoresInker` (strings separadas por vírgula); `salvarEdicao` grava `autores: { writer: string[], penciler: string[], inker: string[] }` (listas, via `parseAutores`).

- [ ] **Step 1: Escrever o teste que falha** (`tests/test-autores.mjs`, mesmo `montar` do Task 2; série `s1` com `s1-1` possuída tendo `autores: { writer: ["Mark Waid"], penciler: ["Mike Wieringo", "Paul Ryan"], inker: [] }` e `s1-2` sem autores):
1. a ficha do tile 1 mostra "Writer", "Mark Waid", "Penciler", "Mike Wieringo, Paul Ryan"; "Inker" não aparece (lista vazia);
2. a ficha do tile 2 (sem autores) não mostra nenhum dos três rótulos e `erros` fica vazio;
3. "Editar edição" no tile 1 mostra os três campos preenchidos ("Mike Wieringo, Paul Ryan");
4. trocar o campo Inker para "Jose Marzan Jr.; Jose Marzan Jr." e salvar grava `autores.inker` como `["Jose Marzan Jr."]` e mantém `writer` e `penciler`;
5. salvar a edição 2 sem preencher nada não cria `autores` com listas vazias (`autores` fica ausente ou todas vazias, escolher: ausente se as três listas vazias);
6. salvar mantém `reimpressao` e `origem` da edição 1 (campos da Task 2 não são apagados).

- [ ] **Step 2: Rodar e ver falhar:** `node scripts/build.mjs && node tests/test-autores.mjs`. Expected: FAIL 1, 3, 4.

- [ ] **Step 3: Implementar**

Ficha (`SerieSheet.jsx`), depois do bloco da data/reimpressão, só para os papéis não vazios:

```jsx
{(() => {
  const a = autoresDe(selecionada);
  const linhas = [["Writer", a.writer], ["Penciler", a.penciler], ["Inker", a.inker]].filter(([, l]) => l.length);
  return linhas.length ? (
    <dl className="autores">
      {linhas.map(([rot, l]) => (<div key={rot}><dt className="t-micro">{rot}</dt><dd className="t-small">{l.join(", ")}</dd></div>))}
    </dl>
  ) : null;
})()}
```

`App.jsx`: `onEditEdicao` passa `autoresWriter: autoresDe(ed).writer.join(", ")` (e as outras duas) no estado do formulário; estado inicial de "Nova edição" com as três strings vazias; `salvarEdicao` monta `const autores = { writer: parseAutores(f.autoresWriter), penciler: parseAutores(f.autoresPenciler), inker: parseAutores(f.autoresInker) };`, remove os três campos auxiliares do objeto gravado (`const { autoresWriter, autoresPenciler, autoresInker, ...resto } = edicaoForm;`) e grava `autores` só se alguma lista tiver nome (senão omite a chave).

`Formularios.jsx`: três `Field` de texto (Writer, Penciler, Inker) com dica "Separe vários nomes por vírgula".

`styles.css`: `.autores` em grade simples; rótulo `t-micro`, valor `t-small`; sem cor nova.

- [ ] **Step 4: Rodar e ver passar** (`node scripts/build.mjs && node tests/test-autores.mjs`), depois `npm run check`.

- [ ] **Step 5: Piso, prévia e commit.** Subir o piso em `scripts/test.mjs`, capturar a ficha com autores (PC e iPhone), enviar com `SendUserFile`, esperar o "pode". Commit `feat: autores na ficha e no formulario da edicao` com as linhas de atribuição.

---

### Task 5: Skill grava autores (e reimpressões) em todo cadastro

**Files** (em `C:\Users\ACER\.claude\skills\longbox-cadastrar`):
- Create: `lib/autores.mjs`
- Modify: `lib/montar.mjs` (`mesclarEdicoes`)
- Modify: `SKILL.md`
- Test: `test-autores.mjs`, e estender `test-montar.mjs`

**Interfaces:**
- Produces: `autoresDoInfobox(wikitext) -> { writer: string[], penciler: string[], inker: string[] }`, que lê `Writer<k>_<j>`, `Penciler<k>_<j>`, `Inker<k>_<j>` de qualquer história `k` e posição `j`, tira `[[Link|Texto]]` para `Texto`, tira "Uncredited", remove repetidos mantendo a ordem.
- `mesclarEdicoes` aceita em `desejadas` os campos `autores`, `reimpressao`, `origem` e aplica a regra de sempre: **só preenche o que está vazio, nunca sobrescreve**; divergência de autores não vira conflito (vai para o dossiê como nota).

- [ ] **Step 1: Escrever os testes que falham**

`test-autores.mjs`: usando a fixture `fixtures/edicoes-nightwing-26-59.json` (já tem `Writer1_1 = Chuck Dixon`, `Penciler1_1 = Scott McDaniel`, `Inker1_1 = Karl Story`), conferir `autoresDoInfobox` da edição 26 = `{ writer: ["Chuck Dixon"], penciler: ["Scott McDaniel"], inker: ["Karl Story"] }`; um wikitext sintético com `Writer1_1 = [[Mark Waid|Mark Waid]]`, `Writer2_1 = Brian Augustyn`, `Writer1_2 = Mark Waid` -> `["Mark Waid", "Brian Augustyn"]`; `Inker1_1 = Uncredited` -> `[]`; wikitext sem nenhum campo -> três listas vazias.

`test-montar.mjs` (acrescentar): edição existente sem autores + desejada com autores -> preenche e conta em `preenchidas`; existente com `writer: ["X"]` + desejada com `writer: ["Y"]` -> mantém `["X"]` e não gera conflito; edição nova leva `autores`, `reimpressao`, `origem` da desejada.

- [ ] **Step 2: Rodar e ver falhar:** `cd ~/.claude/skills/longbox-cadastrar && node test-autores.mjs && node test-montar.mjs`. Expected: FAIL (import e asserções).

- [ ] **Step 3: Implementar** `lib/autores.mjs` (regex `/\|\s*(Writer|Penciler|Inker)\d+_\d+[ \t]*=[ \t]*([^\n|]*)/g` sobre o wikitext, limpando links e "Uncredited") e, em `mesclarEdicoes`, depois do laço de `mes`/`ano`:

```js
const novo = { writer: [], penciler: [], inker: [] };
for (const f of ["writer", "penciler", "inker"]) {
  const tem = (ex.autores && ex.autores[f]) || [];
  const quer = (d.autores && d.autores[f]) || [];
  if (!tem.length && quer.length) { (ex.autores = ex.autores || {})[f] = quer; preencheu = true; }
}
if (ex.reimpressao === undefined && d.reimpressao === true) { ex.reimpressao = true; ex.origem = d.origem || ""; preencheu = true; }
```

e, na criação (`items.push`), `...(d.autores ? { autores: d.autores } : {})`, `...(d.reimpressao ? { reimpressao: true, origem: d.origem || "" } : {})`.

- [ ] **Step 4: Rodar e ver passar** (os dois arquivos, e a suíte antiga completa da skill: `for f in test-*.mjs; do node $f || echo FALHOU $f; done`).

- [ ] **Step 5: `SKILL.md`**: acrescentar ao passo que lê cada edição do Fandom a instrução "sempre ler os autores com `autoresDoInfobox` e gravá-los nas edições possuídas; autor ausente no wiki fica em branco e entra como pendência no dossiê" e à seção do dossiê uma linha "Autores: N de M edições com autor". Commit no repo da skill.

---

### Task 6: Preencher os autores das edições que você já tem (dados)

**Files:** nenhum arquivo de código novo. Roda a skill e grava no banco.

**Interfaces:**
- Consumes: `autoresDoInfobox` (Task 5); `edicoesColetadasIds` dos volumes; `paraFandom` de `lib/nomes.mjs`.

- [ ] **Step 1:** ler `library/volumes` e coletar o conjunto de ids possuídos; agrupar por série (`edicoes/<serieId>`).
- [ ] **Step 2:** para a primeira série (a pedida pelo usuário, ou a de mais edições possuídas), buscar cada edição possuída no wiki, montar `autores` e mostrar ao usuário um relatório: "N com autor, M sem, K a conferir".
- [ ] **Step 3:** gravar com `ArtifactData` (ler o doc, mesclar só `autores` das edições possuídas que estão vazias, escrever de volta, conferir lendo). Nunca tocar em `mes`, `ano`, `posicao`, `reimpressao`.
- [ ] **Step 4:** repetir em lotes de séries; cada lote reporta e espera o "pode". Séries sem fonte no wiki (Panini, encadernados sem página por edição) ficam como pendência listada, não inventadas.
- [ ] **Step 5:** conferência final: contar edições possuídas sem nenhum autor, listar por série e entregar ao usuário.

---

### Task 7: Busca por autor

**Files:**
- Modify: `src/telas/App.jsx` (`textoBusca` ≈284, `seriesFiltradas` ≈844, `sugestoes` ≈304)
- Test: `tests/test-autores.mjs` (acrescentar); `scripts/test.mjs`

**Interfaces:**
- Consumes: `textoAutores`, `serieTemAutor` (Task 1).

- [ ] **Step 1: Teste que falha** (acrescentar a `tests/test-autores.mjs`): com `s1-1` de Mark Waid possuída pelo volume `v1`, e um volume `v2` sem relação:
1. na aba HQs, buscar "waid" mostra o volume `v1` e não o `v2`;
2. na aba Séries, buscar "waid" mostra a série `s1`;
3. buscar "WAID" (caixa) e "wáid" (acento) dá o mesmo resultado;
4. uma edição **não** possuída com autor "Waid" não faz o volume nem a série aparecerem (só vale o que se tem);
5. buscar um autor que ninguém tem mostra "Nada encontrado".

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar**

`textoBusca`: acrescentar os autores das edições coletadas de cada volume ao texto do volume:

```js
const edicaoPorId = {};
lib.edicoes.forEach((e) => { edicaoPorId[e.id] = e; });
// dentro do forEach de volumes:
const autores = v.edicoesColetadasIds.map((eid) => textoAutores(edicaoPorId[eid] || {})).filter(Boolean);
mapa[v.id] = [v.titulo, v.personagem, v.editora, v.notas, ...series, ...autores].filter(Boolean).join(" ").toLowerCase();
```

(a busca por volume já usa `.includes` em minúsculas; para ignorar acento, passar `textoBusca` e `query` por `dobrar` onde se compara. Se o `dobrar` de `Filtros.jsx` já for exportável, importá-lo; senão mover para `src/lib/util.js` e reexportar.)

`seriesFiltradas`: a condição `nomeCasa` ganha `|| (!!q && serieTemAutor(edicoesPorSerie[s.id] || [], ownedEdicaoIds, q, true))` (`parcial = true`, definido na Task 1).

- [ ] **Step 4: Rodar e ver passar; `npm run check`.**
- [ ] **Step 5: Piso e commit.**

---

### Task 8: Filtro por autor na aba Séries

**Files:**
- Modify: `src/ui/Filtros.jsx` (`PersonagemFiltro` ganha props opcionais)
- Modify: `src/lib/sessao.js` (`lerFiltroAutor`, `salvarFiltroAutor`)
- Modify: `src/telas/App.jsx` (estado, opções, filtragem, UI ≈1784, contador ≈262)
- Test: `tests/test-filtro-autor.mjs`; `scripts/test.mjs`

**Interfaces:**
- Consumes: `autoresPossuidos`, `serieTemAutor` (Task 1).
- Produces: `PersonagemFiltro` aceita `rotulo` (padrão "Filtrar por personagem"), `todos` (padrão "Todos os personagens"), `lista` (padrão "Personagens"), `semCor` (padrão `false`, esconde o quadradinho de cor), `vazio` (padrão `Nenhum personagem com`); sem as props o comportamento é idêntico ao de hoje.

- [ ] **Step 1: Teste que falha** (`tests/test-filtro-autor.mjs`, três séries: `s1` com edição possuída de Mark Waid, `s2` com edição possuída de Grant Morrison, `s3` só com edição **não** possuída de Waid):
1. a aba Séries mostra o campo "Filtrar por autor" no painel de filtros;
2. as opções listam "Grant Morrison" e "Mark Waid" com contagem de edições possuídas (1 e 1) e não listam autores só de edição não possuída;
3. escolher "Mark Waid" mostra só `s1` (não `s3`, não `s2`);
4. combina com o filtro de personagem (E);
5. o contador do botão de filtros conta 1 com o autor ligado e 2 com os dois filtros;
6. "Limpar filtros" limpa os dois;
7. recarregar a página na mesma sessão mantém o filtro (sessionStorage, técnica de três montagens do projeto);
8. se o autor escolhido deixa de existir nas opções (edição removida), o filtro se solta sozinho (como o de personagem) e não deixa a lista vazia sem motivo;
9. o filtro de personagem das HQs continua dizendo "Todos os personagens" (props padrão preservadas).

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar**

`Filtros.jsx`: assinatura `PersonagemFiltro({ id = "filtro-personagem", valor, opcoes, onChange, rotulo = "Filtrar por personagem", todos = "Todos os personagens", lista: nomeLista = "Personagens", semCor = false, vazio = "Nenhum personagem com" })`; substituir os quatro textos fixos (`placeholder`, `aria-label`, `aria-label` da lista, mensagem vazia) por essas props, e renderizar o `group-swatch` só quando `!semCor`.

`sessao.js`: `lerFiltroAutor`/`salvarFiltroAutor` copiando `lerFiltroSeries`/`salvarFiltroSeries` com outra chave (`"longbox:filtro-autor"`).

`App.jsx`: `const [filtroAutor, setFiltroAutor] = useState(lerFiltroAutor);` com `useEffect(() => salvarFiltroAutor(filtroAutor), [filtroAutor])`; `autoresDasSeries = useMemo(() => autoresPossuidos(lib.edicoes, ownedEdicaoIds), [lib.edicoes, ownedEdicaoIds])`; efeito de soltar quando `!autoresDasSeries.some((o) => o.nome === filtroAutor)` (não durante `loading`); em `seriesFiltradas` acrescentar, no `forEach` de séries, `if (filtroAutor && !serieTemAutor(edicoesPorSerie[s.id] || [], ownedEdicaoIds, filtroAutor)) return;` e `filtroAutor` ao array de dependências; `filtrosAtivosAba` para séries vira `(filtroSerie ? 1 : 0) + (filtroAutor ? 1 : 0)`; no painel de filtros da aba Séries (≈1784) acrescentar um segundo `PersonagemFiltro` com `id="filtro-autor-series" rotulo="Filtrar por autor" todos="Todos os autores" lista="Autores" semCor vazio="Nenhum autor com"`, `data-campos="2"` na linha, e o botão "Limpar filtros" habilitado por `filtroSerie || filtroAutor`, limpando os dois. As sugestões da busca (`sugestoes`, ≈323) respeitam o filtro de autor ao filtrar `candidatas` do mesmo jeito.

- [ ] **Step 4: Rodar e ver passar; `npm run check`; conferir o CSS do painel com dois campos** (a linha `filtros-linha` hoje é `data-campos="1"`; ver como `data-campos` está definido em `styles.css` e ajustar só se duas colunas não couberem no celular).

- [ ] **Step 5: Prévia, piso, commit.** Capturas do painel de filtros (PC, iPhone 390 px) com o campo de autor aberto e com o filtro ligado, `SendUserFile`, esperar o "pode".

---

### Task 9: Documentação, versão e publicação

**Files:**
- Modify: `DESIGN.md` (modelo de dados `edicoes/<serieId>`; seções de ficha, formulário, filtros e busca)
- Modify: `HISTORICO.md` (uma entrada por versão entregue)
- Modify: memória do projeto (`longbox_project.md`, `longbox_cadastrar_skill.md`)

- [ ] **Step 1:** descrever em `DESIGN.md` os três campos novos (shape no bloco "Data layer"), o selo, o interruptor, a busca e o filtro por autor, e a regra "reimpressão não cobre original".
- [ ] **Step 2:** uma entrada de `HISTORICO.md` por entrega (v145 reimpressões, v146 autores na ficha, v147 busca por autor, v148 filtro por autor), no formato das anteriores.
- [ ] **Step 3: Publicar cada versão** pela rotina: `npm run check`, ler `app.js`/`styles.css`/`index.html` do live, `cmp` com a última tag, publicar `dist/index.html + app.js + styles.css` na URL `https://claude.ai/code/artifact/75982434-39f4-426b-ab3a-da8b637a1b31`, reler e `cmp`, `git tag vN`, apagar a prévia.
- [ ] **Step 4:** pedir ao usuário para abrir no iPhone (app do Claude) e confirmar, em especial a ficha com autores, o selo e o filtro com a lista real de 163 volumes.
- [ ] **Step 5:** atualizar a memória com o ponto de parada (versão, o que está pendente, wanted adiada para o fim).

---

## Self-review

- **Cobertura do spec:** dados (Tasks 1, 2, 4), selo e interruptor (2), busca (7), filtro (8), skill sempre preenche (5), backfill só das possuídas (6), reimpressões Flash vol. 1 conferidas pelo usuário (3), ordem reimpressões, autores, busca e filtro (2-3, 4-6, 7-8), docs e rotina (9). Wanted fica fora, como combinado.
- **Placeholders:** a Task 3 depende de uma pesquisa (Step 1) porque o padrão do wiki é desconhecido; está declarado como pesquisa, não escondido. Os pisos de PASS são preenchidos com a contagem real depois do primeiro verde.
- **Consistência de nomes:** `autoresDe`, `textoAutores`, `ehReimpressao`, `parseAutores`, `autoresPossuidos`, `serieTemAutor` (com `parcial`), `serieTemReimpressao` definidos na Task 1 e usados com esses nomes depois.
- **Risco principal:** o `PersonagemFiltro` é compartilhado; a Task 8 só adiciona props com padrões iguais ao texto atual, e o teste 9 trava isso.
