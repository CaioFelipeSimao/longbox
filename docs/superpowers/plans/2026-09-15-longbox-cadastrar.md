# Skill longbox-cadastrar — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma skill que, recebendo o nome de um encadernado da DC, pesquisa Fandom e editora, apresenta um dossiê conferido em três blocos de confiança e, após aprovação, grava volume, coleção, séries e edições no banco do artifact Longbox.

**Architecture:** A skill separa o que é mecânico do que é julgamento. Os módulos em `lib/` fazem o mecânico e são testados offline contra respostas reais capturadas da API: extrair campos de wikitext, converter nomes de série, paginar a API do Fandom, montar os documentos do banco. O `SKILL.md` carrega o julgamento: desambiguar o livro, ler a prosa do `History`, cruzar as duas listas de conteúdo, montar o dossiê, conduzir a aprovação. Sem subagentes — a pesquisa acontece na sessão para que as fontes sejam vistas, não repassadas.

**Tech Stack:** Node 20+ com módulos `.mjs` e ESM, sem dependências externas. `curl` via Bash para Fandom e Amazon. WebFetch para Penguin Random House. Ações `read_db`, `write_db` e `upload_asset` da ferramenta Artifact.

**Spec:** `docs/superpowers/specs/2026-09-15-cadastro-automatico-hqs-design.md`

## Global Constraints

- **Node**: sem dependências novas. Nada de `npm install`. `fetch` global e `node:fs` bastam.
- **Estilo de teste**: o padrão deste projeto, visto em `test-boot.mjs` e `test-render.mjs` — script `.mjs` executado por `node test-x.mjs`, helper `check(nome, ok, detalhe)` imprimindo `PASS`/`FAIL`, contador `falhas`, `process.exit(falhas ? 1 : 0)`. **Sem framework de teste.**
- **Idioma do código**: comentários em inglês, nomes de variáveis em português, como em `src/app.jsx`.
- **User-Agent obrigatório** em todo `curl`: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36`. Sem ele o Fandom responde 403.
- **WebFetch não serve para Fandom (HTTP 402) nem para Amazon (devolve só JS).** Usar `curl`.
- **Datas são data de capa**, o que o Fandom traz, sem conversão.
- **Mês da edição** é o nome do mês por extenso em português: `"Dezembro"`.
- **`numero` da edição é string**, para caber `"1/2"` e `"1000000"`.
- **Casamento de edição existente é por string exata de `numero`**, nunca por `parseNum`, porque `parseNum("1/2")` devolve `1` e confundiria as duas edições.
- **Todo `write_db` leva `if_version`** travado na versão lida. Nunca forçar.
- **Nenhum campo com uma fonte só entra no bloco 1** do dossiê.
- **Só DC.** Editora fora da DC é recusada com explicação.
- Todo commit deste plano termina com a linha:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

### Estrutura de arquivos

Tudo mora no diretório da skill, autocontido:

```
C:\Users\ACER\.claude\skills\longbox-cadastrar\
  SKILL.md                      instruções: o julgamento
  lib/wikitext.mjs              extrair campos do wikitext, traduzir mês
  lib/nomes.mjs                 converter e casar nomes de série
  lib/fandom.mjs                cliente da API: lotes e paginação
  lib/serie.mjs                 montar o registro de uma série
  lib/anuais.mjs                descobrir série anual por enumeração
  lib/encadernado.mjs           IssueList + Collects, cruzamento em 3 blocos
  lib/capa.mjs                  cascata de capa
  lib/montar.mjs                documentos do banco, ids sem colisão
  fixtures/*.json               respostas reais capturadas da API
  capturar-fixtures.mjs         regenera as fixtures
  test-wikitext.mjs
  test-nomes.mjs
  test-encadernado.mjs
  test-montar.mjs
  test-fandom-live.mjs          bate na rede, rodado à mão
```

---

### Task 1: Esqueleto da skill e fixtures reais

Sem fixtures não há como testar parser nenhum offline, então isto vem primeiro. As sete fixtures cobrem todos os casos difíceis do spec.

**Files:**
- Create: `C:\Users\ACER\.claude\skills\longbox-cadastrar\capturar-fixtures.mjs`
- Create: `C:\Users\ACER\.claude\skills\longbox-cadastrar\fixtures\` (7 arquivos JSON)

**Interfaces:**
- Consumes: nada
- Produces: sete arquivos em `fixtures/`, consumidos por todas as tarefas de teste:
  `serie-nightwing-vol2.json`, `serie-detective-vol1.json`, `serie-greenarrow-vol2.json`,
  `edicoes-nightwing-26-59.json`, `categoria-nightwing-vol2.json`,
  `trade-compendium-two.json`, `anuais-robin-nightwing.json`

- [ ] **Step 1: Criar o diretório e iniciar repositório próprio**

O diretório da skill fica fora de qualquer repositório existente, e `~/.claude/skills/` contém symlinks de outras skills, então o repositório é só da pasta desta skill.

```bash
mkdir -p "/c/Users/ACER/.claude/skills/longbox-cadastrar/lib"
mkdir -p "/c/Users/ACER/.claude/skills/longbox-cadastrar/fixtures"
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar"
git init
```

- [ ] **Step 2: Escrever o script de captura**

`capturar-fixtures.mjs`:

```javascript
// Real API responses, saved so every parser test runs offline and deterministic.
// Re-run this only when the Fandom API changes shape.
// Run: node capturar-fixtures.mjs
import fs from "node:fs";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const BASE = "https://dc.fandom.com/api.php";

async function pegar(params) {
  const url = BASE + "?" + new URLSearchParams({ format: "json", formatversion: "2", ...params });
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(url + " -> HTTP " + r.status);
  return r.json();
}

function conteudo(params) {
  return pegar({ action: "query", prop: "revisions", rvprop: "content", rvslots: "main", rvsection: "0", ...params });
}

function salvar(nome, dado) {
  fs.writeFileSync("fixtures/" + nome, JSON.stringify(dado, null, 2), "utf8");
  console.log("  " + nome + "  " + fs.statSync("fixtures/" + nome).size + " bytes");
}

const numeros = (de, ate, prefixo) => {
  const a = [];
  for (let i = de; i <= ate; i++) a.push(prefixo + " " + i);
  return a.join("|");
};

// Nightwing Vol 2: the clean case. TotalIssues is a number.
salvar("serie-nightwing-vol2.json", await conteudo({ titles: "Nightwing Vol 2" }));

// Detective Comics Vol 1: TotalIssues is free text, not a number.
salvar("serie-detective-vol1.json", await conteudo({ titles: "Detective Comics Vol 1" }));

// Green Arrow Vol 2: History prose states the protagonist handover range.
salvar("serie-greenarrow-vol2.json", await conteudo({ titles: "Green Arrow Vol 2" }));

// 34 issues in one request. Month arrives as a name for some, a number for others.
salvar("edicoes-nightwing-26-59.json", await conteudo({ titles: numeros(26, 59, "Nightwing Vol 2") }));

// The real issue set: 153 integers plus 1/2 and 1000000.
salvar("categoria-nightwing-vol2.json", await pegar({
  action: "query", list: "categorymembers",
  cmtitle: "Category:Nightwing Vol 2", cmlimit: "500", cmnamespace: "0",
}));

// The collected edition, with its IssueList.
salvar("trade-compendium-two.json", await conteudo({
  titles: "Nightwing: A Knight in Blüdhaven Compendium Two (Collected)",
}));

// Annuals have no series page, only issue pages. Robin has 7, Nightwing has 2.
salvar("anuais-robin-nightwing.json", await conteudo({
  titles: numeros(1, 9, "Robin Annual Vol 2") + "|" + numeros(1, 6, "Nightwing Annual Vol 2"),
}));

console.log("ok");
```

- [ ] **Step 3: Rodar a captura**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar" && node capturar-fixtures.mjs
```

Esperado: sete linhas com nome e tamanho, depois `ok`. `serie-nightwing-vol2.json` fica em torno de 15 KB, `edicoes-nightwing-26-59.json` em torno de 145 KB, `categoria-nightwing-vol2.json` em torno de 15 KB.

- [ ] **Step 4: Verificar que as fixtures contêm os casos difíceis**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar" && node -e '
import("node:fs").then(({default:fs})=>{
const ler=n=>JSON.parse(fs.readFileSync("fixtures/"+n,"utf8"));
const w=n=>ler(n).query.pages[0].revisions[0].slots.main.content;
console.log("nightwing TotalIssues numerico :", /TotalIssues\s*=\s*155/.test(w("serie-nightwing-vol2.json")));
console.log("detective TotalIssues texto    :", /TotalIssues\s*=\s*883 \(first phase\)/.test(w("serie-detective-vol1.json")));
console.log("greenarrow History tem #102-137:", /#102-137/.test(w("serie-greenarrow-vol2.json")));
const cat=ler("categoria-nightwing-vol2.json").query.categorymembers.map(m=>m.title);
console.log("categoria tem 1/2 e 1000000    :", cat.some(t=>t.endsWith(" 1/2")) && cat.some(t=>t.endsWith(" 1000000")));
console.log("trade tem IssueList            :", /IssueList/.test(w("trade-compendium-two.json")));
});'
```

Esperado: cinco linhas `true`. Se alguma vier `false`, o Fandom mudou de formato e o plano precisa ser revisto antes de seguir.

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar"
git add capturar-fixtures.mjs fixtures
git commit -m "$(printf 'chore: captura fixtures reais da API do Fandom\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

---

### Task 2: lib/wikitext.mjs — extrair campos e traduzir mês

**Files:**
- Create: `C:\Users\ACER\.claude\skills\longbox-cadastrar\lib\wikitext.mjs`
- Test: `C:\Users\ACER\.claude\skills\longbox-cadastrar\test-wikitext.mjs`

**Interfaces:**
- Consumes: fixtures da Task 1
- Produces:
  - `campo(wikitext, nome) -> string` — valor de uma linha `| Nome = valor`, aparado; `""` se ausente
  - `campoLongo(wikitext, nome) -> string` — valor que se estende por várias linhas, até a próxima linha `| Outro =`
  - `mesPtBr(valor) -> string` — `"December"` e `"12"` viram `"Dezembro"`; valor irreconhecível vira `""`
  - `MESES -> string[]` — os doze nomes, índice 0 = Janeiro
  - `emCurso(wikitext) -> boolean` — `EndYear` vazio e `Type` contendo `Ongoing`

- [ ] **Step 1: Escrever o teste que falha**

`test-wikitext.mjs`:

```javascript
// Field extraction and month translation, tested against real captured wikitext.
// Run: node test-wikitext.mjs
import fs from "node:fs";
import { campo, campoLongo, mesPtBr, MESES, emCurso } from "./lib/wikitext.mjs";

let falhas = 0;
function check(nome, ok, detalhe) {
  if (!ok) falhas++;
  console.log((ok ? "  PASS " : "  FAIL ") + nome + (ok || !detalhe ? "" : " (" + detalhe + ")"));
}

const ler = (n) => JSON.parse(fs.readFileSync("fixtures/" + n, "utf8"));
const wiki = (n, i = 0) => ler(n).query.pages[i].revisions[0].slots.main.content;

const nw = wiki("serie-nightwing-vol2.json");
check("TotalIssues de Nightwing Vol 2", campo(nw, "TotalIssues") === "155", campo(nw, "TotalIssues"));
check("StartYear", campo(nw, "StartYear") === "1996", campo(nw, "StartYear"));
check("EndYear", campo(nw, "EndYear") === "2009", campo(nw, "EndYear"));
check("Featured", campo(nw, "Featured") === "Nightwing; Dick Grayson", campo(nw, "Featured"));
check("campo ausente devolve string vazia", campo(nw, "NaoExiste") === "");
check("Nightwing Vol 2 nao esta em curso", emCurso(nw) === false);

const dc = wiki("serie-detective-vol1.json");
check("TotalIssues de Detective e texto livre", campo(dc, "TotalIssues").startsWith("883 (first phase)"), campo(dc, "TotalIssues"));
check("Detective Comics esta em curso", emCurso(dc) === true);

const ga = wiki("serie-greenarrow-vol2.json");
const hist = campoLongo(ga, "History");
check("campoLongo pega varias linhas do History", hist.length > 200, "len=" + hist.length);
check("History menciona a faixa #102-137", hist.includes("#102-137"));

check("mes por nome", mesPtBr("December") === "Dezembro", mesPtBr("December"));
check("mes por nome minusculo", mesPtBr("july") === "Julho", mesPtBr("july"));
check("mes por numero", mesPtBr("3") === "Março", mesPtBr("3"));
check("mes por numero com espaco", mesPtBr(" 9 ") === "Setembro", mesPtBr(" 9 "));
check("mes vazio", mesPtBr("") === "");
check("mes invalido", mesPtBr("13") === "");
check("mes lixo", mesPtBr("Brumaire") === "");
check("MESES tem doze", MESES.length === 12 && MESES[0] === "Janeiro" && MESES[11] === "Dezembro");

// The batch fixture mixes both month formats on purpose.
const lote = ler("edicoes-nightwing-26-59.json").query.pages;
const porTitulo = {};
for (const p of lote) porTitulo[p.title] = p.revisions[0].slots.main.content;
check("edicao 26, mes veio como nome", mesPtBr(campo(porTitulo["Nightwing Vol 2 26"], "Month")) === "Dezembro");
check("edicao 26, ano", campo(porTitulo["Nightwing Vol 2 26"], "Year") === "1998");
check("edicao 53, mes veio como numero", mesPtBr(campo(porTitulo["Nightwing Vol 2 53"], "Month")) === "Março");

console.log(falhas ? falhas + " falha(s)" : "tudo passou");
process.exit(falhas ? 1 : 0);
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar" && node test-wikitext.mjs
```

Esperado: FALHA com `Cannot find module './lib/wikitext.mjs'`.

- [ ] **Step 3: Implementar**

`lib/wikitext.mjs`:

```javascript
// Fandom volume and issue pages are MediaWiki templates: one "| Name = value" per
// line. These read that shape. Nothing here touches the network — every caller
// passes wikitext already fetched, which is what makes the tests deterministic.

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const EN = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

// A single-line field. Stops at the newline or at the next pipe on the same line.
export function campo(wikitext, nome) {
  const re = new RegExp("\\|\\s*" + nome + "\\s*=\\s*([^\\n|]*)");
  const m = String(wikitext || "").match(re);
  return m ? m[1].trim() : "";
}

// A field whose value runs over several lines, such as History or IssueList.
// Ends at the next line that opens a new field.
export function campoLongo(wikitext, nome) {
  const re = new RegExp("\\|\\s*" + nome + "\\s*=([\\s\\S]*?)(?:\\n\\s*\\|\\s*[A-Za-z][A-Za-z0-9]*\\s*=|$)");
  const m = String(wikitext || "").match(re);
  return m ? m[1].trim() : "";
}

// Month arrives either as an English name or as a number, depending on who last
// edited the page. Both map to the Portuguese name the app stores.
export function mesPtBr(valor) {
  const t = String(valor == null ? "" : valor).trim();
  if (!t) return "";
  const n = EN[t.toLowerCase()] ?? (/^\d{1,2}$/.test(t) ? parseInt(t, 10) : NaN);
  return n >= 1 && n <= 12 ? MESES[n - 1] : "";
}

// An ongoing series has no EndYear and says so in Type.
export function emCurso(wikitext) {
  return campo(wikitext, "EndYear") === "" && /ongoing/i.test(campo(wikitext, "Type"));
}
```

- [ ] **Step 4: Rodar para ver passar**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar" && node test-wikitext.mjs
```

Esperado: 20 linhas `PASS` e `tudo passou`.

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar"
git add lib/wikitext.mjs test-wikitext.mjs
git commit -m "$(printf 'feat: extracao de campos de wikitext e traducao de mes\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

---

### Task 3: lib/nomes.mjs — converter e casar nomes de série

O Fandom escreve `Nightwing Vol 2`, o Longbox guarda `Nightwing (Volume 2)`. Comparação literal nunca casa. E a comparação precisa tolerar caixa, acento e pontuação, porque um dia vai existir um typo no banco.

**Files:**
- Create: `C:\Users\ACER\.claude\skills\longbox-cadastrar\lib\nomes.mjs`
- Test: `C:\Users\ACER\.claude\skills\longbox-cadastrar\test-nomes.mjs`

**Interfaces:**
- Consumes: nada
- Produces:
  - `paraLongbox(fandom) -> string` — `"Nightwing Vol 2"` vira `"Nightwing (Volume 2)"`; `"Nightwing Annual Vol 2"` vira `"Nightwing (Volume 2) Annual"`
  - `paraFandom(longbox) -> string` — o inverso
  - `chave(nome) -> string` — forma canônica para comparação
  - `casar(nome, series) -> objeto | null` — acha a série no array `library/series`

- [ ] **Step 1: Escrever o teste que falha**

`test-nomes.mjs`:

```javascript
// Series names cross a border here: Fandom's "X Vol N" and Longbox's
// "X (Volume N)". Getting this wrong creates duplicate series silently.
// Run: node test-nomes.mjs
import { paraLongbox, paraFandom, chave, casar } from "./lib/nomes.mjs";

let falhas = 0;
function check(nome, ok, detalhe) {
  if (!ok) falhas++;
  console.log((ok ? "  PASS " : "  FAIL ") + nome + (ok || !detalhe ? "" : " (" + detalhe + ")"));
}

check("serie simples", paraLongbox("Nightwing Vol 2") === "Nightwing (Volume 2)", paraLongbox("Nightwing Vol 2"));
check("titulo com duas palavras", paraLongbox("Detective Comics Vol 1") === "Detective Comics (Volume 1)", paraLongbox("Detective Comics Vol 1"));
check("anual vira sufixo", paraLongbox("Nightwing Annual Vol 2") === "Nightwing (Volume 2) Annual", paraLongbox("Nightwing Annual Vol 2"));
check("anual de titulo longo", paraLongbox("Detective Comics Annual Vol 1") === "Detective Comics (Volume 1) Annual", paraLongbox("Detective Comics Annual Vol 1"));
check("barra no nome sobrevive", paraLongbox("Nightwing/Huntress Vol 1") === "Nightwing/Huntress (Volume 1)", paraLongbox("Nightwing/Huntress Vol 1"));
check("sem Vol fica igual", paraLongbox("Nightwing: The Target") === "Nightwing: The Target", paraLongbox("Nightwing: The Target"));

check("volta para o Fandom", paraFandom("Nightwing (Volume 2)") === "Nightwing Vol 2", paraFandom("Nightwing (Volume 2)"));
check("volta anual para o Fandom", paraFandom("Robin (Volume 2) Annual") === "Robin Annual Vol 2", paraFandom("Robin (Volume 2) Annual"));

check("chave ignora caixa", chave("NIghtwing (Volume 2)") === chave("Nightwing (Volume 2)"));
check("chave ignora acento", chave("Blüdhaven (Volume 1)") === chave("Bludhaven (Volume 1)"));
check("chave ignora pontuacao e espaco", chave("Nightwing  (Volume 2)") === chave("Nightwing(Volume2)"));
check("chave iguala os dois formatos", chave("Nightwing Vol 2") === chave("Nightwing (Volume 2)"));
check("chave distingue volumes", chave("Nightwing (Volume 1)") !== chave("Nightwing (Volume 2)"));
check("chave distingue anual da principal", chave("Robin (Volume 2)") !== chave("Robin (Volume 2) Annual"));

// Shaped like the real library/series document.
const series = [
  { id: "s1", nome: "NIghtwing (Volume 2)" },
  { id: "s2", nome: "Nightwing (Volume 1)" },
  { id: "s3", nome: "Nightwing (Volume 2) Annual" },
  { id: "s4", nome: "Green Arrow (Volume 2)" },
];
check("casa apesar do typo no banco", casar("Nightwing Vol 2", series)?.id === "s1", JSON.stringify(casar("Nightwing Vol 2", series)));
check("casa no formato do Longbox", casar("Nightwing (Volume 2)", series)?.id === "s1");
check("casa o anual no anual", casar("Nightwing Annual Vol 2", series)?.id === "s3");
check("casa o volume 1 no volume 1", casar("Nightwing Vol 1", series)?.id === "s2");
check("serie ausente devolve null", casar("Birds of Prey Vol 1", series) === null);

console.log(falhas ? falhas + " falha(s)" : "tudo passou");
process.exit(falhas ? 1 : 0);
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar" && node test-nomes.mjs
```

Esperado: FALHA com `Cannot find module './lib/nomes.mjs'`.

- [ ] **Step 3: Implementar**

`lib/nomes.mjs`:

```javascript
// Two naming worlds meet here. Fandom writes "Nightwing Vol 2" and puts annuals
// in the middle: "Nightwing Annual Vol 2". Longbox writes "Nightwing (Volume 2)"
// and puts annuals at the end: "Nightwing (Volume 2) Annual". A literal string
// compare between the two never matches, so every lookup goes through chave().

export function paraLongbox(fandom) {
  const t = String(fandom || "").trim();
  const anual = t.match(/^(.*?)\s+Annual\s+Vol\s+(\d+)$/i);
  if (anual) return anual[1].trim() + " (Volume " + anual[2] + ") Annual";
  const normal = t.match(/^(.*?)\s+Vol\s+(\d+)$/i);
  if (normal) return normal[1].trim() + " (Volume " + normal[2] + ")";
  return t;
}

export function paraFandom(longbox) {
  const t = String(longbox || "").trim();
  const anual = t.match(/^(.*?)\s*\(Volume\s+(\d+)\)\s+Annual$/i);
  if (anual) return anual[1].trim() + " Annual Vol " + anual[2];
  const normal = t.match(/^(.*?)\s*\(Volume\s+(\d+)\)$/i);
  if (normal) return normal[1].trim() + " Vol " + normal[2];
  return t;
}

// Canonical form for comparison. Both naming worlds collapse onto the same key,
// and case, accents, punctuation and spacing stop mattering — which is what makes
// a typo in the database still match.
export function chave(nome) {
  return paraLongbox(String(nome || ""))
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/volume\s*(\d+)/g, "v$1")
    .replace(/[^a-z0-9]/g, "");
}

export function casar(nome, series) {
  const k = chave(nome);
  return (series || []).find((s) => chave(s.nome) === k) || null;
}
```

- [ ] **Step 4: Rodar para ver passar**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar" && node test-nomes.mjs
```

Esperado: 20 linhas `PASS` e `tudo passou`.

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar"
git add lib/nomes.mjs test-nomes.mjs
git commit -m "$(printf 'feat: conversao e casamento tolerante de nomes de serie\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

---

### Task 4: lib/fandom.mjs — cliente da API com lotes e paginação

Uma série de 1062 edições precisa de 22 pedidos de 50, e uma categoria de mais de 500 membros precisa de `cmcontinue`. Sem isso, séries longas silenciosamente perdem edições — que é o pior tipo de erro para este projeto.

**Files:**
- Create: `C:\Users\ACER\.claude\skills\longbox-cadastrar\lib\fandom.mjs`
- Test: `C:\Users\ACER\.claude\skills\longbox-cadastrar\test-fandom-live.mjs`

**Interfaces:**
- Consumes: nada
- Produces:
  - `async paginas(titulos) -> Map<string, string|null>` — wikitext por título, `null` quando a página não existe. Fatia em lotes de 50 automaticamente
  - `async categoria(tituloSerie) -> string[]` — títulos das páginas de edição, seguindo `cmcontinue` até o fim
  - `async umaPagina(titulo) -> string|null`

- [ ] **Step 1: Escrever o teste que falha**

Este é o único teste que bate na rede, então fica separado e é rodado à mão.

`test-fandom-live.mjs`:

```javascript
// Hits the real Fandom API. Kept apart from the offline tests because it is slow
// and needs the network. Run it by hand after changing lib/fandom.mjs.
// Run: node test-fandom-live.mjs
import { paginas, categoria, umaPagina } from "./lib/fandom.mjs";

let falhas = 0;
function check(nome, ok, detalhe) {
  if (!ok) falhas++;
  console.log((ok ? "  PASS " : "  FAIL ") + nome + (ok || !detalhe ? "" : " (" + detalhe + ")"));
}

const um = await umaPagina("Nightwing Vol 2");
check("umaPagina traz wikitext", typeof um === "string" && um.includes("TotalIssues"));
check("pagina inexistente devolve null", (await umaPagina("Nightwing Vol 999")) === null);

// 60 titles forces two batches, which is the whole point of this test.
const titulos = [];
for (let i = 1; i <= 60; i++) titulos.push("Nightwing Vol 2 " + i);
const mapa = await paginas(titulos);
check("lote de 60 volta com 60 entradas", mapa.size === 60, "size=" + mapa.size);
check("todas as 60 existem", [...mapa.values()].every((v) => typeof v === "string"));
check("a chave e o titulo pedido", mapa.has("Nightwing Vol 2 26"));

const cat = await categoria("Nightwing Vol 2");
check("categoria traz 155 membros", cat.length === 155, "len=" + cat.length);
check("categoria inclui a 1/2", cat.includes("Nightwing Vol 2 1/2"));
check("categoria inclui a 1000000", cat.includes("Nightwing Vol 2 1000000"));

// Detective Comics is past the 500-member page size, so this proves the paging.
const dc = await categoria("Detective Comics Vol 1");
check("categoria longa passa de 500", dc.length > 500, "len=" + dc.length);

console.log(falhas ? falhas + " falha(s)" : "tudo passou");
process.exit(falhas ? 1 : 0);
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar" && node test-fandom-live.mjs
```

Esperado: FALHA com `Cannot find module './lib/fandom.mjs'`.

- [ ] **Step 3: Implementar**

`lib/fandom.mjs`:

```javascript
// The DC Database API. Two limits shape this file: 50 titles per revisions
// request, and 500 members per category page. Ignoring either loses issues
// without any error, which is the failure this project can least afford.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const BASE = "https://dc.fandom.com/api.php";
const LOTE = 50;

async function pegar(params) {
  const url = BASE + "?" + new URLSearchParams({ format: "json", formatversion: "2", ...params });
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error("Fandom respondeu HTTP " + r.status + " para " + url);
  const j = await r.json();
  if (j.error) throw new Error("Fandom recusou: " + j.error.code + " " + j.error.info);
  return j;
}

// Wikitext for many pages. The returned Map is keyed by the title as asked for,
// so a caller never has to guess how the API normalised it.
export async function paginas(titulos) {
  const fora = new Map();
  for (let i = 0; i < titulos.length; i += LOTE) {
    const fatia = titulos.slice(i, i + LOTE);
    const j = await pegar({
      action: "query", prop: "revisions", rvprop: "content",
      rvslots: "main", rvsection: "0", titles: fatia.join("|"),
    });
    const porTitulo = new Map();
    for (const p of j.query.pages || []) {
      porTitulo.set(p.title, p.missing ? null : (p.revisions?.[0]?.slots?.main?.content ?? null));
    }
    // Normalisation can rename a title on the way in; map it back to what was asked.
    const renomeado = new Map((j.query.normalized || []).map((n) => [n.from, n.to]));
    for (const t of fatia) fora.set(t, porTitulo.get(renomeado.get(t) ?? t) ?? null);
  }
  return fora;
}

export async function umaPagina(titulo) {
  return (await paginas([titulo])).get(titulo) ?? null;
}

// Every issue page filed under a series. This is the authoritative issue set:
// counting 1..TotalIssues misses #0, #1/2 and #1000000.
export async function categoria(tituloSerie) {
  const fora = [];
  let cursor = null;
  do {
    const j = await pegar({
      action: "query", list: "categorymembers",
      cmtitle: "Category:" + tituloSerie, cmlimit: "500", cmnamespace: "0",
      ...(cursor ? { cmcontinue: cursor } : {}),
    });
    for (const m of j.query.categorymembers || []) fora.push(m.title);
    cursor = j.continue?.cmcontinue || null;
  } while (cursor);
  return fora;
}
```

- [ ] **Step 4: Rodar para ver passar**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar" && node test-fandom-live.mjs
```

Esperado: 9 linhas `PASS` e `tudo passou`. Leva uns 15 segundos por causa da paginação de Detective Comics.

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar"
git add lib/fandom.mjs test-fandom-live.mjs
git commit -m "$(printf 'feat: cliente da API do Fandom com lotes e paginacao\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

---

### Task 5: lib/serie.mjs — montar o registro de uma série

**Files:**
- Create: `C:\Users\ACER\.claude\skills\longbox-cadastrar\lib\serie.mjs`
- Test: `C:\Users\ACER\.claude\skills\longbox-cadastrar\test-serie.mjs`

**Interfaces:**
- Consumes: `campo`, `campoLongo`, `emCurso` de `lib/wikitext.mjs`; `paraLongbox` de `lib/nomes.mjs`
- Produces:
  - `montarSerie({ fandomNome, wikitext, numeros }) -> { registro, avisos }` onde
    `registro` é `{ nome, personagens, editora, anoInicio, anoFim, totalEdicoes, ordem }`
    sem `id`, e `avisos` é um array de strings para o bloco 2 do dossiê
  - `numerosDaCategoria(tituloSerie, membros) -> string[]` — tira o prefixo do título e devolve os números na ordem natural de edição
  - `faixasDoHistory(texto) -> [{ nome, de, ate }]` — lê a prosa; array vazio quando não diz nada

- [ ] **Step 1: Escrever o teste que falha**

`test-serie.mjs`:

```javascript
// Turning a Fandom volume page into a Longbox series record, including the two
// cases that broke the first design: TotalIssues as free text, and the
// protagonist handover that only the History prose states.
// Run: node test-serie.mjs
import fs from "node:fs";
import { montarSerie, numerosDaCategoria, faixasDoHistory } from "./lib/serie.mjs";

let falhas = 0;
function check(nome, ok, detalhe) {
  if (!ok) falhas++;
  console.log((ok ? "  PASS " : "  FAIL ") + nome + (ok || !detalhe ? "" : " (" + detalhe + ")"));
}

const ler = (n) => JSON.parse(fs.readFileSync("fixtures/" + n, "utf8"));
const wiki = (n) => ler(n).query.pages[0].revisions[0].slots.main.content;

const membros = ler("categoria-nightwing-vol2.json").query.categorymembers.map((m) => m.title);
const numeros = numerosDaCategoria("Nightwing Vol 2", membros);
check("numeros da categoria: 155", numeros.length === 155, "len=" + numeros.length);
check("inclui a 1/2", numeros.includes("1/2"));
check("inclui a 1000000", numeros.includes("1000000"));
check("primeiro e 1", numeros[0] === "1", numeros[0]);
check("ordem natural coloca 2 antes de 10", numeros.indexOf("2") < numeros.indexOf("10"));
check("nao sobrou prefixo", numeros.every((n) => !n.startsWith("Nightwing")));

const nw = montarSerie({ fandomNome: "Nightwing Vol 2", wikitext: wiki("serie-nightwing-vol2.json"), numeros });
check("nome convertido", nw.registro.nome === "Nightwing (Volume 2)", nw.registro.nome);
check("totalEdicoes lido do template", nw.registro.totalEdicoes === 155, String(nw.registro.totalEdicoes));
check("anoInicio", nw.registro.anoInicio === "1996", nw.registro.anoInicio);
check("anoFim", nw.registro.anoFim === "2009", nw.registro.anoFim);
check("editora fixa", nw.registro.editora === "DC Comics", nw.registro.editora);
check("ordem nasce nula", nw.registro.ordem === null);
check("personagens do Featured", Array.isArray(nw.registro.personagens) && nw.registro.personagens.includes("Nightwing"), JSON.stringify(nw.registro.personagens));
check("template numerico nao gera aviso de contagem", !nw.avisos.some((a) => a.includes("contado")));

// Detective Comics: TotalIssues is "883 (first phase); Ongoing (second phase)".
const dcNums = [];
for (let i = 1; i <= 1062; i++) dcNums.push(String(i));
const dc = montarSerie({ fandomNome: "Detective Comics Vol 1", wikitext: wiki("serie-detective-vol1.json"), numeros: dcNums });
check("totalEdicoes cai na contagem", dc.registro.totalEdicoes === 1062, String(dc.registro.totalEdicoes));
check("avisa que o total foi contado", dc.avisos.some((a) => a.includes("contado")), JSON.stringify(dc.avisos));
check("serie em curso vira presente", dc.registro.anoFim === "presente", dc.registro.anoFim);

// Green Arrow: the handover is in the prose, and only there.
const faixas = faixasDoHistory(wiki("serie-greenarrow-vol2.json"));
check("achou duas faixas", faixas.length === 2, JSON.stringify(faixas));
check("Connor Hawke de 102 a 137", faixas.some((f) => /Connor Hawke/i.test(f.nome) && f.de === 102 && f.ate === 137), JSON.stringify(faixas));
check("Oliver Queen termina na 101", faixas.some((f) => /Oliver Queen/i.test(f.nome) && f.ate === 101), JSON.stringify(faixas));

const ga = montarSerie({ fandomNome: "Green Arrow Vol 2", wikitext: wiki("serie-greenarrow-vol2.json"), numeros: dcNums.slice(0, 139) });
check("faixa entra como aviso, nunca como confirmado", ga.avisos.some((a) => a.includes("faixa")), JSON.stringify(ga.avisos));

// History that says nothing about a handover must not invent one.
check("prosa muda devolve vazio", faixasDoHistory("The series ran for a while and was nice.").length === 0);

console.log(falhas ? falhas + " falha(s)" : "tudo passou");
process.exit(falhas ? 1 : 0);
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar" && node test-serie.mjs
```

Esperado: FALHA com `Cannot find module './lib/serie.mjs'`.

- [ ] **Step 3: Implementar**

`lib/serie.mjs`:

```javascript
// A Fandom volume page becomes a Longbox series record here. Two traps live in
// this file. TotalIssues is free text on renumbered series, so it can only be
// trusted when it parses as an integer. And the protagonist handover range is
// stated nowhere structured — only in the History prose — so it is read as prose
// and always reported as a single-source claim, never as confirmed.

import { campo, campoLongo, emCurso } from "./wikitext.mjs";
import { paraLongbox } from "./nomes.mjs";

// Category members carry the full page title. Strip the series prefix and sort
// the way a reader would: numerically where possible, specials last.
export function numerosDaCategoria(tituloSerie, membros) {
  const prefixo = tituloSerie + " ";
  const nums = membros
    .filter((t) => t.startsWith(prefixo))
    .map((t) => t.slice(prefixo.length).trim())
    .filter(Boolean);
  const peso = (n) => (/^\d+$/.test(n) ? parseInt(n, 10) : Number.MAX_SAFE_INTEGER);
  return nums.sort((a, b) => peso(a) - peso(b) || a.localeCompare(b));
}

// "until his death in issue #101. From issues #102-137 ... Connor Hawke assumed"
// is the shape that actually appears. Anything less explicit returns nothing,
// because a wrong range is worse than no range.
export function faixasDoHistory(texto) {
  const t = String(texto || "");
  const faixas = [];

  for (const m of t.matchAll(/from issues?\s*#?(\d+)\s*[-–]\s*#?(\d+)[^.]*?\b([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*)*)\s+assumed/gi)) {
    faixas.push({ nome: m[3].trim(), de: parseInt(m[1], 10), ate: parseInt(m[2], 10) });
  }
  for (const m of t.matchAll(/\b([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*)*),?\s+the\s+[^,.]{2,40},?\s+until\s+(?:his|her|their)\s+death\s+in\s+issue\s*#?(\d+)/gi)) {
    faixas.push({ nome: m[1].trim(), de: 1, ate: parseInt(m[2], 10) });
  }
  return faixas;
}

export function montarSerie({ fandomNome, wikitext, numeros }) {
  const avisos = [];

  const bruto = campo(wikitext, "TotalIssues");
  let total = /^\d+$/.test(bruto) ? parseInt(bruto, 10) : null;
  if (total === null) {
    total = numeros.length;
    avisos.push(
      'totalEdicoes foi contado, nao lido: o Fandom traz "' + bruto +
      '" em TotalIssues, que nao e numero. Contagem pela categoria: ' + total + "."
    );
  }

  const personagens = campo(wikitext, "Featured")
    .split(";").map((p) => p.trim()).filter(Boolean);

  const faixas = faixasDoHistory(campoLongo(wikitext, "History"));
  if (faixas.length) {
    avisos.push(
      "faixa de personagem sugerida pela prosa do History (fonte unica, confirme): " +
      faixas.map((f) => f.nome + " #" + f.de + "-" + f.ate).join("; ")
    );
  } else if (personagens.length > 1) {
    avisos.push(
      "a serie tem " + personagens.length + " personagens em Featured e o History nao " +
      "diz faixa. Cadastrada sem faixa; ajuste a mao se algum assume no meio."
    );
  }

  return {
    registro: {
      nome: paraLongbox(fandomNome),
      personagens,
      editora: "DC Comics",
      anoInicio: campo(wikitext, "StartYear"),
      anoFim: emCurso(wikitext) ? "presente" : campo(wikitext, "EndYear"),
      totalEdicoes: total,
      ordem: null,
    },
    avisos,
    faixas,
  };
}
```

- [ ] **Step 4: Rodar para ver passar**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar" && node test-serie.mjs
```

Esperado: 22 linhas `PASS` e `tudo passou`. Se `faixasDoHistory` falhar, imprima o `History` do Green Arrow e ajuste o padrão ao texto real — não afrouxe o teste.

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar"
git add lib/serie.mjs test-serie.mjs
git commit -m "$(printf 'feat: montagem do registro de serie, com total contado e faixas do History\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

---

### Task 6: lib/anuais.mjs — descobrir série anual por enumeração

Anuais não têm página de série no Fandom: `Nightwing Annual Vol 2` redireciona para `Nightwing Vol 2`. A única forma de saber quantas existem é pedir as páginas de edição e contar.

**Files:**
- Create: `C:\Users\ACER\.claude\skills\longbox-cadastrar\lib\anuais.mjs`
- Test: `C:\Users\ACER\.claude\skills\longbox-cadastrar\test-anuais.mjs`

**Interfaces:**
- Consumes: `campo`, `mesPtBr` de `lib/wikitext.mjs`; `paraLongbox` de `lib/nomes.mjs`
- Produces:
  - `contarAnuais(baseFandom, mapa) -> { numeros, edicoes }` onde `mapa` é o `Map` devolvido por `paginas()`, `numeros` são as edições que existem em ordem, e `edicoes` é `[{ numero, mes, ano }]`
  - `registroAnual(baseFandom, edicoes) -> { nome, personagens, editora, anoInicio, anoFim, totalEdicoes, ordem }`
  - `titulosParaSondar(baseFandom, ate) -> string[]`

- [ ] **Step 1: Escrever o teste que falha**

`test-anuais.mjs`:

```javascript
// Annual series are discovered, not read: the wiki has no series page for them.
// The expected counts here are the numbers the user entered by hand, so this
// test is a comparison against ground truth.
// Run: node test-anuais.mjs
import fs from "node:fs";
import { contarAnuais, registroAnual, titulosParaSondar } from "./lib/anuais.mjs";

let falhas = 0;
function check(nome, ok, detalhe) {
  if (!ok) falhas++;
  console.log((ok ? "  PASS " : "  FAIL ") + nome + (ok || !detalhe ? "" : " (" + detalhe + ")"));
}

const dados = JSON.parse(fs.readFileSync("fixtures/anuais-robin-nightwing.json", "utf8"));
const mapa = new Map();
for (const p of dados.query.pages) {
  mapa.set(p.title, p.missing ? null : p.revisions[0].slots.main.content);
}

check("sondagem monta 40 titulos", titulosParaSondar("Robin Annual Vol 2", 40).length === 40);
check("primeiro titulo da sondagem", titulosParaSondar("Robin Annual Vol 2", 40)[0] === "Robin Annual Vol 2 1");

const robin = contarAnuais("Robin Annual Vol 2", mapa);
check("Robin tem 7 anuais, como o usuario digitou", robin.numeros.length === 7, JSON.stringify(robin.numeros));
check("Robin em ordem crescente", robin.numeros.join(",") === "1,2,3,4,5,6,7", robin.numeros.join(","));
check("Robin anual 1 e Setembro de 1992", robin.edicoes[0].mes === "Setembro" && robin.edicoes[0].ano === "1992", JSON.stringify(robin.edicoes[0]));
check("Robin anual 7 e Dezembro de 2007", robin.edicoes[6].mes === "Dezembro" && robin.edicoes[6].ano === "2007", JSON.stringify(robin.edicoes[6]));

const nw = contarAnuais("Nightwing Annual Vol 2", mapa);
check("Nightwing tem 2 anuais, como o usuario digitou", nw.numeros.length === 2, JSON.stringify(nw.numeros));

const reg = registroAnual("Nightwing Annual Vol 2", nw.edicoes);
check("nome no formato do Longbox", reg.nome === "Nightwing (Volume 2) Annual", reg.nome);
check("totalEdicoes e a contagem", reg.totalEdicoes === 2, String(reg.totalEdicoes));
check("anoInicio da primeira edicao", reg.anoInicio === "1997", reg.anoInicio);
check("anoFim da ultima edicao", reg.anoFim === "2007", reg.anoFim);
check("anual nunca nasce em curso", reg.anoFim !== "presente");

const regRobin = registroAnual("Robin Annual Vol 2", robin.edicoes);
check("Robin anual 1992 a 2007", regRobin.anoInicio === "1992" && regRobin.anoFim === "2007", regRobin.anoInicio + "-" + regRobin.anoFim);

check("serie sem anual devolve vazio", contarAnuais("Birds of Prey Annual Vol 1", mapa).numeros.length === 0);

console.log(falhas ? falhas + " falha(s)" : "tudo passou");
process.exit(falhas ? 1 : 0);
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar" && node test-anuais.mjs
```

Esperado: FALHA com `Cannot find module './lib/anuais.mjs'`.

- [ ] **Step 3: Implementar**

`lib/anuais.mjs`:

```javascript
// "Nightwing Annual Vol 2" is a redirect to "Nightwing Vol 2" — the wiki has no
// series page for annuals, only issue pages. So the series is discovered by
// asking for issues 1..40 and counting what exists. Verified against the user's
// own hand-entered data: 7 for Robin, 2 for Nightwing.

import { campo, mesPtBr } from "./wikitext.mjs";
import { paraLongbox } from "./nomes.mjs";

export function titulosParaSondar(baseFandom, ate = 40) {
  const fora = [];
  for (let i = 1; i <= ate; i++) fora.push(baseFandom + " " + i);
  return fora;
}

export function contarAnuais(baseFandom, mapa) {
  const prefixo = baseFandom + " ";
  const achadas = [];
  for (const [titulo, wikitext] of mapa) {
    if (!titulo.startsWith(prefixo) || !wikitext) continue;
    const numero = titulo.slice(prefixo.length).trim();
    if (!/^\d+$/.test(numero)) continue;
    achadas.push({ numero, mes: mesPtBr(campo(wikitext, "Month")), ano: campo(wikitext, "Year") });
  }
  achadas.sort((a, b) => parseInt(a.numero, 10) - parseInt(b.numero, 10));
  return { numeros: achadas.map((e) => e.numero), edicoes: achadas };
}

// Years come from the first and last issue found, because there is no template
// to read them from. An annual run is always finished by definition of how it is
// discovered, so anoFim is never "presente".
export function registroAnual(baseFandom, edicoes) {
  const anos = edicoes.map((e) => e.ano).filter(Boolean);
  return {
    nome: paraLongbox(baseFandom),
    personagens: [],
    editora: "DC Comics",
    anoInicio: anos.length ? anos[0] : "",
    anoFim: anos.length ? anos[anos.length - 1] : "",
    totalEdicoes: edicoes.length,
    ordem: null,
  };
}
```

- [ ] **Step 4: Rodar para ver passar**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar" && node test-anuais.mjs
```

Esperado: 14 linhas `PASS` e `tudo passou`.

Atenção a um detalhe que o teste cobre: se a sondagem de 40 voltar com a 40 existindo, a série é mais longa que o palpite e o chamador precisa pedir o lote seguinte. Isso é responsabilidade do `SKILL.md` (Task 10), não deste módulo.

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar"
git add lib/anuais.mjs test-anuais.mjs
git commit -m "$(printf 'feat: descoberta de serie anual por enumeracao\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

---

### Task 7: lib/encadernado.mjs — IssueList, Collects e o cruzamento em três blocos

O coração da regra de verificação. Duas listas independentes entram, três blocos de confiança saem.

**Files:**
- Create: `C:\Users\ACER\.claude\skills\longbox-cadastrar\lib\encadernado.mjs`
- Test: `C:\Users\ACER\.claude\skills\longbox-cadastrar\test-encadernado.mjs`

**Interfaces:**
- Consumes: `campo`, `campoLongo` de `lib/wikitext.mjs`; `chave` de `lib/nomes.mjs`
- Produces:
  - `parseIssueList(wikitext) -> [{ serieFandom, numero }]` — deduplicado, em ordem de leitura
  - `parseCollects(texto) -> [{ serieTexto, numero }]` — expande `#26-59` e `#20-21`
  - `cruzar(doFandom, daEditora) -> { confirmado, fonteUnica, conflito }` — cada item `{ serieFandom, numero, fontes }`
  - `dadosDoTrade(wikitext) -> { ano, mes, isbn, anterior, proximo }`

- [ ] **Step 1: Escrever o teste que falha**

`test-encadernado.mjs`:

```javascript
// The verification rule, tested on the real Compendium Two — the case that
// exposed it. The two sources agree on 41 issues and disagree on three, and this
// test pins that split so a future change cannot quietly turn a disputed issue
// into a confirmed one.
// Run: node test-encadernado.mjs
import fs from "node:fs";
import { parseIssueList, parseCollects, cruzar, dadosDoTrade } from "./lib/encadernado.mjs";

let falhas = 0;
function check(nome, ok, detalhe) {
  if (!ok) falhas++;
  console.log((ok ? "  PASS " : "  FAIL ") + nome + (ok || !detalhe ? "" : " (" + detalhe + ")"));
}

const wiki = JSON.parse(fs.readFileSync("fixtures/trade-compendium-two.json", "utf8"))
  .query.pages[0].revisions[0].slots.main.content;

const meta = dadosDoTrade(wiki);
check("ano do encadernado", meta.ano === "2025", meta.ano);
check("isbn", meta.isbn.replace(/-/g, "") === "9781799501480", meta.isbn);
check("coleção anterior existe", /Compendium One/.test(meta.anterior), meta.anterior);

const doFandom = parseIssueList(wiki);
check("IssueList deduplicado", doFandom.length === 43, "len=" + doFandom.length);
check("Secret Files aparece uma vez, nao cinco",
  doFandom.filter((e) => /Secret Files/.test(e.serieFandom)).length === 1,
  JSON.stringify(doFandom.filter((e) => /Secret Files/.test(e.serieFandom))));
check("34 edicoes de Nightwing Vol 2",
  doFandom.filter((e) => e.serieFandom === "Nightwing Vol 2").length === 34);
check("separa serie de numero", doFandom.some((e) => e.serieFandom === "Action Comics Vol 1" && e.numero === "771"));
check("preserva a ordem de leitura", doFandom[0].serieFandom === "DCU Holiday Bash Vol 1");

// Exactly the publisher's sentence, from Amazon and Penguin alike.
const texto = "Collects Action Comics #771; Batman Annual #23; Nightwing #26-59; " +
  "Birds of Prey #8, #20-21; Nightwing Secret Files #1; Nightwing 80-Page Giant #1; " +
  "Nightwing: The Target #1.";
const daEditora = parseCollects(texto);
check("expande o intervalo 26-59", daEditora.filter((e) => /^Nightwing$/.test(e.serieTexto)).length === 34, String(daEditora.filter((e) => /^Nightwing$/.test(e.serieTexto)).length));
check("expande 20-21 depois de um avulso", daEditora.filter((e) => /Birds of Prey/.test(e.serieTexto)).map((e) => e.numero).join(",") === "8,20,21", daEditora.filter((e) => /Birds of Prey/.test(e.serieTexto)).map((e) => e.numero).join(","));
// 1 + 1 + 34 + 3 + 1 + 1 + 1. Not 41 — 41 is how many the two sources CONFIRM,
// which is a different number and arrived at further down.
check("total da editora", daEditora.length === 42, "len=" + daEditora.length);

const { confirmado, fonteUnica, conflito } = cruzar(doFandom, daEditora);
check("41 confirmados pelas duas fontes", confirmado.length === 41, "len=" + confirmado.length);
check("tres em conflito", conflito.length === 3, JSON.stringify(conflito.map((c) => c.serieFandom + " " + c.numero)));
check("DCU Holiday Bash e conflito, so o Fandom lista",
  conflito.some((c) => /Holiday Bash/.test(c.serieFandom) && c.fontes.join() === "fandom"));
check("Batman Chronicles e conflito, so o Fandom lista",
  conflito.some((c) => /Batman Chronicles/.test(c.serieFandom) && c.fontes.join() === "fandom"));
check("The Target e conflito, so a editora lista",
  conflito.some((c) => /Target/i.test(c.serieFandom) && c.fontes.join() === "editora"));
check("nada em conflito vazou para confirmado",
  !confirmado.some((c) => /Holiday Bash|Batman Chronicles|Target/i.test(c.serieFandom)));
// The two pairings that a squashed-key comparison gets wrong, pinned explicitly.
check("Batman Annual Vol 1 #23 pareou com 'Batman Annual #23'",
  confirmado.some((c) => c.serieFandom === "Batman Annual Vol 1" && c.numero === "23"),
  JSON.stringify(confirmado.filter((c) => /Batman Annual/.test(c.serieFandom))));
check("The Target nao foi pareado com Nightwing Vol 2",
  !confirmado.some((c) => c.serieFandom === "Nightwing Vol 2" && c.numero === "1"));
check("confirmado carrega as duas fontes", confirmado.every((c) => c.fontes.length === 2));

// With only one source there is nothing to confirm: everything is single-source.
const so = cruzar(doFandom, []);
check("sem a editora, tudo vira fonte unica", so.fonteUnica.length === 43 && so.confirmado.length === 0, "unica=" + so.fonteUnica.length + " conf=" + so.confirmado.length);

console.log(falhas ? falhas + " falha(s)" : "tudo passou");
process.exit(falhas ? 1 : 0);
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar" && node test-encadernado.mjs
```

Esperado: FALHA com `Cannot find module './lib/encadernado.mjs'`.

- [ ] **Step 3: Implementar**

`lib/encadernado.mjs`:

```javascript
// Two independent lists of what a collected edition contains, and the cross
// reference between them. The Fandom IssueList is built by hand by wiki editors
// and names the canonical series of every issue. The publisher's "Collects"
// sentence is prose. Amazon and Penguin Random House print that sentence
// identically because both republish DC's solicitation text, so they count as
// ONE source, never two.

import { campo, campoLongo } from "./wikitext.mjs";
import { chave as chaveNome } from "./nomes.mjs";

// The IssueList lists one entry per story, so an issue holding five stories
// appears five times. Dedup by series plus number.
export function parseIssueList(wikitext) {
  const bruto = campoLongo(wikitext, "IssueList");
  const vistos = new Set();
  const fora = [];
  for (const m of bruto.matchAll(/\{\{c\|([^}|]+)(?:\|[^}]*)?\}\}/gi)) {
    const alvo = m[1].trim();
    const partes = alvo.match(/^(.*\bVol\s+\d+)\s+(\S+)$/i);
    if (!partes) continue;
    const item = { serieFandom: partes[1].trim(), numero: partes[2].trim() };
    const k = chaveNome(item.serieFandom) + "#" + item.numero.toLowerCase();
    if (vistos.has(k)) continue;
    vistos.add(k);
    fora.push(item);
  }
  return fora;
}

// "Collects Action Comics #771; Nightwing #26-59; Birds of Prey #8, #20-21; ..."
// Series name, then one or more issue numbers or ranges, segments split on ";".
export function parseCollects(texto) {
  const t = String(texto || "").replace(/^\s*collects\s+/i, "");
  const fora = [];
  for (const seg of t.split(";")) {
    const limpo = seg.replace(/\.\s*$/, "").trim();
    if (!limpo) continue;
    const corte = limpo.search(/#/);
    if (corte < 0) continue;
    const serieTexto = limpo.slice(0, corte).replace(/[,\s]+$/, "").trim();
    for (const pedaco of limpo.slice(corte).split(",")) {
      const p = pedaco.replace(/#/g, "").trim();
      const faixa = p.match(/^(\d+)\s*[-–]\s*(\d+)$/);
      if (faixa) {
        for (let i = parseInt(faixa[1], 10); i <= parseInt(faixa[2], 10); i++) {
          fora.push({ serieTexto, numero: String(i) });
        }
      } else if (p) {
        fora.push({ serieTexto, numero: p });
      }
    }
  }
  return fora;
}

// The publisher drops "Vol N" and shortens names ("Nightwing Secret Files" for
// "Nightwing Secret Files and Origins Vol 1"), so the publisher's words must be a
// prefix of the wiki's words. One direction only, and on whole words.
//
// Comparing squashed keys instead fails twice, both verified against the real
// Compendium Two data: "Batman Annual Vol 1" squashes to "batmanv1annual" and
// never equals "batmanannual", so a genuinely confirmed issue looks disputed;
// and "nightwingthetarget" starts with "nightwing", so "Nightwing: The Target"
// falsely pairs with "Nightwing Vol 2".
function palavras(nome) {
  return String(nome || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\bvol\s*\d+\b/g, " ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function mesmaSerie(serieFandom, serieTexto) {
  const wiki = palavras(serieFandom);
  const editora = palavras(serieTexto);
  if (!editora.length || editora.length > wiki.length) return false;
  return editora.every((p, i) => p === wiki[i]);
}

export function cruzar(doFandom, daEditora) {
  const confirmado = [], fonteUnica = [], conflito = [];
  const usadosDaEditora = new Set();

  for (const item of doFandom) {
    const i = daEditora.findIndex((e, idx) =>
      !usadosDaEditora.has(idx) && e.numero === item.numero && mesmaSerie(item.serieFandom, e.serieTexto));
    if (i >= 0) {
      usadosDaEditora.add(i);
      confirmado.push({ ...item, fontes: ["fandom", "editora"] });
    } else {
      conflito.push({ ...item, fontes: ["fandom"] });
    }
  }
  for (let i = 0; i < daEditora.length; i++) {
    if (usadosDaEditora.has(i)) continue;
    conflito.push({ serieFandom: daEditora[i].serieTexto, numero: daEditora[i].numero, fontes: ["editora"] });
  }

  // With a single source there is nothing to cross-check, so everything the one
  // source says is single-source rather than disputed.
  if (!daEditora.length) return { confirmado: [], fonteUnica: conflito.map((c) => ({ ...c })), conflito: [] };
  if (!doFandom.length) return { confirmado: [], fonteUnica: conflito.map((c) => ({ ...c })), conflito: [] };

  return { confirmado, fonteUnica, conflito };
}

export function dadosDoTrade(wikitext) {
  return {
    ano: campo(wikitext, "Year"),
    mes: campo(wikitext, "Month"),
    isbn: campo(wikitext, "ISBN"),
    anterior: campo(wikitext, "PreviousCollection"),
    proximo: campo(wikitext, "NextCollection"),
  };
}
```

- [ ] **Step 4: Rodar para ver passar**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar" && node test-encadernado.mjs
```

Esperado: 19 linhas `PASS` e `tudo passou`. O teste de `parseCollects` com 41 itens é o mais frágil: se falhar, imprima `daEditora` e veja qual segmento não foi entendido antes de mexer no teste.

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar"
git add lib/encadernado.mjs test-encadernado.mjs
git commit -m "$(printf 'feat: cruzamento de IssueList e Collects em tres blocos de confianca\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

---

### Task 8: lib/capa.mjs — cascata de capa

**Files:**
- Create: `C:\Users\ACER\.claude\skills\longbox-cadastrar\lib\capa.mjs`
- Test: `C:\Users\ACER\.claude\skills\longbox-cadastrar\test-capa-live.mjs`

**Interfaces:**
- Consumes: nada
- Produces:
  - `async buscarCapa({ isbn13, urlAmazon, destino }) -> { arquivo, fonte, largura, altura } | null`
  - `dimensoesJpeg(buffer) -> { largura, altura } | null`
  - `extrairUrlDaAmazon(html) -> string | null`

- [ ] **Step 1: Escrever o teste que falha**

`test-capa-live.mjs`:

```javascript
// The cover chain, against the real Compendium Two. Live because the whole point
// is whether these hosts still serve us.
// Run: node test-capa-live.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buscarCapa, dimensoesJpeg, extrairUrlDaAmazon } from "./lib/capa.mjs";

let falhas = 0;
function check(nome, ok, detalhe) {
  if (!ok) falhas++;
  console.log((ok ? "  PASS " : "  FAIL ") + nome + (ok || !detalhe ? "" : " (" + detalhe + ")"));
}

const destino = fs.mkdtempSync(path.join(os.tmpdir(), "capa-"));

const boa = await buscarCapa({
  isbn13: "9781799501480",
  urlAmazon: "https://www.amazon.com/Nightwing-Knight-Bludhaven-Compendium-Two/dp/1799501485",
  destino,
});
check("achou capa", boa !== null);
check("veio da Amazon", boa?.fonte === "amazon", boa?.fonte);
check("arquivo existe e tem tamanho", boa && fs.statSync(boa.arquivo).size > 20000, String(boa && fs.statSync(boa.arquivo).size));
check("alta resolucao", boa?.altura >= 1000, boa?.largura + "x" + boa?.altura);

// Amazon out of the picture: the ISBN endpoint must carry it.
const reserva = await buscarCapa({ isbn13: "9781799501480", urlAmazon: null, destino });
check("cai para randomhouse", reserva?.fonte === "randomhouse", reserva?.fonte);
check("reserva tem dimensoes", reserva?.largura > 100 && reserva?.altura > 100, reserva?.largura + "x" + reserva?.altura);

const nada = await buscarCapa({ isbn13: "9780000000000", urlAmazon: null, destino });
check("isbn inexistente devolve null", nada === null, JSON.stringify(nada));

check("dimensoes de buffer invalido", dimensoesJpeg(Buffer.from([1, 2, 3])) === null);
check("url da amazon sai do html", extrairUrlDaAmazon('x"hiRes":"https://m.media-amazon.com/images/I/81a._SL1500_.jpg"y') === "https://m.media-amazon.com/images/I/81a._SL1500_.jpg");
check("html sem imagem devolve null", extrairUrlDaAmazon("<html></html>") === null);

fs.rmSync(destino, { recursive: true, force: true });
console.log(falhas ? falhas + " falha(s)" : "tudo passou");
process.exit(falhas ? 1 : 0);
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar" && node test-capa-live.mjs
```

Esperado: FALHA com `Cannot find module './lib/capa.mjs'`.

- [ ] **Step 3: Implementar**

`lib/capa.mjs`:

```javascript
// Three rungs, best first. Amazon gives 968x1500 but needs the product HTML
// scraped and can start refusing at any time. images.randomhouse.com answers by
// ISBN alone with no scraping, but only 290x450 — a visible drop in an app built
// around covers, which is why the caller reports which rung was used.

import fs from "node:fs";
import path from "node:path";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

export function dimensoesJpeg(buffer) {
  if (!buffer || buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buffer.length) {
    if (buffer[i] !== 0xff) { i++; continue; }
    const marca = buffer[i + 1];
    if (marca >= 0xc0 && marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8 && marca !== 0xcc) {
      return { altura: buffer.readUInt16BE(i + 5), largura: buffer.readUInt16BE(i + 7) };
    }
    const tam = buffer.readUInt16BE(i + 2);
    if (tam < 2) return null;
    i += 2 + tam;
  }
  return null;
}

export function extrairUrlDaAmazon(html) {
  const h = String(html || "");
  for (const re of [/"hiRes":"(https:[^"]+\.jpg)"/, /"large":"(https:[^"]+\.jpg)"/]) {
    const m = h.match(re);
    if (m) return m[1];
  }
  return null;
}

async function baixar(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  const dim = dimensoesJpeg(buf);
  return dim ? { buf, ...dim } : null;
}

export async function buscarCapa({ isbn13, urlAmazon, destino }) {
  const tentativas = [];

  if (urlAmazon) {
    tentativas.push(async () => {
      const r = await fetch(urlAmazon, { headers: { "User-Agent": UA } });
      if (!r.ok) return null;
      const url = extrairUrlDaAmazon(await r.text());
      if (!url) return null;
      const img = await baixar(url);
      return img && { ...img, fonte: "amazon" };
    });
  }
  if (isbn13) {
    const limpo = String(isbn13).replace(/[^0-9Xx]/g, "");
    tentativas.push(async () => {
      const img = await baixar("https://images.randomhouse.com/cover/" + limpo);
      // The endpoint answers 200 with a placeholder for an unknown ISBN, so a
      // suspiciously small image is treated as absent.
      return img && img.largura >= 100 && img.buf.length > 5000 ? { ...img, fonte: "randomhouse" } : null;
    });
  }

  for (const tentar of tentativas) {
    let r = null;
    try { r = await tentar(); } catch { r = null; }
    if (!r) continue;
    const arquivo = path.join(destino, "capa-" + r.fonte + ".jpg");
    fs.writeFileSync(arquivo, r.buf);
    return { arquivo, fonte: r.fonte, largura: r.largura, altura: r.altura };
  }
  return null;
}
```

- [ ] **Step 4: Rodar para ver passar**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar" && node test-capa-live.mjs
```

Esperado: 11 linhas `PASS` e `tudo passou`. Se `cai para randomhouse` falhar com `null`, ajuste o limite de tamanho — o endpoint devolve uma imagem de reserva para ISBN desconhecido e o corte precisa separar as duas.

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar"
git add lib/capa.mjs test-capa-live.mjs
git commit -m "$(printf 'feat: cascata de capa com Amazon e endpoint por ISBN\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

---

### Task 9: lib/montar.mjs — documentos do banco e ids sem colisão

Aqui mora o risco de perder dado. Dois pontos: `uid()` do app pode colidir quando se geram mil ids no mesmo milissegundo, e o casamento de edição existente precisa ser por string exata, porque `parseNum("1/2")` devolve `1`.

**Files:**
- Create: `C:\Users\ACER\.claude\skills\longbox-cadastrar\lib\montar.mjs`
- Test: `C:\Users\ACER\.claude\skills\longbox-cadastrar\test-montar.mjs`

**Interfaces:**
- Consumes: nada. Este módulo é puro e não importa nada de `lib/`.
- Produces:
  - `criarId(usados) -> string` — mesmo formato do `uid()` do app, garantidamente não presente em `usados`, e registrado nele
  - `mesclarEdicoes({ existentes, desejadas, serieId, usados }) -> { items, criadas, preenchidas, conflitos }`
  - `montarEscritas({ docs, volumes, colecoes, series, edicoesPorSerie }) -> [{ collection, doc_id, data, if_version }]`

- [ ] **Step 1: Escrever o teste que falha**

`test-montar.mjs`:

```javascript
// Building the batch that gets written. The two assertions that matter most here
// are about silent data loss: ids that collide, and "1/2" being mistaken for "1".
// Run: node test-montar.mjs
import { criarId, mesclarEdicoes, montarEscritas } from "./lib/montar.mjs";

let falhas = 0;
function check(nome, ok, detalhe) {
  if (!ok) falhas++;
  console.log((ok ? "  PASS " : "  FAIL ") + nome + (ok || !detalhe ? "" : " (" + detalhe + ")"));
}

// The app's uid() is Date.now() base36 plus six random chars. Generating 2000 in
// one tight loop is exactly the case where it can repeat.
const usados = new Set();
const ids = [];
for (let i = 0; i < 2000; i++) ids.push(criarId(usados));
check("2000 ids sem repetir", new Set(ids).size === 2000, "unicos=" + new Set(ids).size);
check("ids ficaram registrados", usados.size === 2000);
check("formato do app", /^[a-z0-9]{8,}$/.test(ids[0]), ids[0]);
const preExistente = new Set([ids[0]]);
check("nao devolve id ja usado", criarId(preExistente) !== ids[0]);

// "1/2" and "1" must stay separate. parseNum("1/2") is 1 in the app, so matching
// by number is not an option here.
const existentes = [
  { id: "e1", serieId: "s1", numero: "1", mes: "", ano: "", posicao: null },
  { id: "e2", serieId: "s1", numero: "1/2", mes: "Dezembro", ano: "1997", posicao: null },
  { id: "e3", serieId: "s1", numero: "2", mes: "Fevereiro", ano: "1997", posicao: null },
];
const desejadas = [
  { numero: "1", mes: "Janeiro", ano: "1997" },
  { numero: "1/2", mes: "Dezembro", ano: "1997" },
  { numero: "2", mes: "Março", ano: "1997" },
  { numero: "3", mes: "Abril", ano: "1997" },
  { numero: "1000000", mes: "Novembro", ano: "1998" },
];
const r = mesclarEdicoes({ existentes, desejadas, serieId: "s1", usados: new Set(["e1", "e2", "e3"]) });

check("nao duplicou a 1", r.items.filter((e) => e.numero === "1").length === 1);
check("nao confundiu 1 com 1/2", r.items.filter((e) => e.numero === "1/2").length === 1);
check("preencheu a data vazia da 1", r.items.find((e) => e.numero === "1").mes === "Janeiro");
check("contou uma preenchida", r.preenchidas === 1, String(r.preenchidas));
check("criou a 3 e a 1000000", r.criadas === 2, String(r.criadas));
check("a 1000000 sobreviveu como string", r.items.some((e) => e.numero === "1000000"));
check("data divergente da 2 nao foi sobrescrita", r.items.find((e) => e.numero === "2").mes === "Fevereiro");
check("divergencia virou conflito", r.conflitos.length === 1 && r.conflitos[0].numero === "2", JSON.stringify(r.conflitos));
check("data igual da 1/2 nao gera conflito", !r.conflitos.some((c) => c.numero === "1/2"));
check("edicao nova leva posicao null", r.items.find((e) => e.numero === "3").posicao === null);
check("edicao nova leva serieId", r.items.find((e) => e.numero === "3").serieId === "s1");
check("total de items", r.items.length === 5, "len=" + r.items.length);

const escritas = montarEscritas({
  docs: { volumes: 7, colecoes: 1, series: 1, edicoes: { s1: 4 } },
  volumes: [{ id: "v1", titulo: "X" }],
  colecoes: [{ id: "c1", nome: "Y", membros: ["v1"] }],
  series: [{ id: "s1", nome: "Z" }],
  edicoesPorSerie: { s1: r.items },
});
check("quatro escritas", escritas.length === 4, "len=" + escritas.length);
check("volumes com if_version travado", escritas.find((e) => e.doc_id === "volumes").if_version === 7);
check("edicoes vao para a colecao edicoes", escritas.find((e) => e.collection === "edicoes").doc_id === "s1");
check("edicoes com if_version travado", escritas.find((e) => e.collection === "edicoes").if_version === 4);
check("corpo e objeto com items", Array.isArray(escritas.find((e) => e.doc_id === "series").data.items));
check("series na colecao library", escritas.find((e) => e.doc_id === "series").collection === "library");

// A document that does not exist yet has no version to pin.
const novas = montarEscritas({
  docs: { volumes: 7, colecoes: 1, series: 1, edicoes: {} },
  volumes: [], colecoes: [], series: [], edicoesPorSerie: { s9: [] },
});
check("documento novo sai sem if_version", !("if_version" in novas.find((e) => e.doc_id === "s9")));

console.log(falhas ? falhas + " falha(s)" : "tudo passou");
process.exit(falhas ? 1 : 0);
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar" && node test-montar.mjs
```

Esperado: FALHA com `Cannot find module './lib/montar.mjs'`.

- [ ] **Step 3: Implementar**

`lib/montar.mjs`:

```javascript
// The last stop before anything is written. Two hazards live here.
//
// First, ids. The app's uid() is Date.now().toString(36) plus six random base36
// chars. Minting 1450 of them inside one millisecond gives a real, if small,
// chance of a repeat, and a repeated id silently merges two issues. So every id
// is checked against the ones already in play.
//
// Second, matching an existing issue. The app's parseNum("1/2") returns 1, so
// matching by parsed number would treat #1/2 as #1 and lose one of them. Matching
// here is by exact trimmed string, always.

export function criarId(usados) {
  for (let tentativa = 0; tentativa < 100; tentativa++) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    if (!usados.has(id)) { usados.add(id); return id; }
  }
  throw new Error("nao consegui gerar um id livre em 100 tentativas");
}

const mesmoNumero = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

// Existing issues are never overwritten. An empty date gets filled; a date that
// disagrees becomes a conflict for the dossier and stays as it was.
export function mesclarEdicoes({ existentes, desejadas, serieId, usados }) {
  const items = existentes.map((e) => ({ ...e }));
  const conflitos = [];
  let criadas = 0, preenchidas = 0;

  for (const d of desejadas) {
    const ex = items.find((e) => e.serieId === serieId && mesmoNumero(e.numero, d.numero));
    if (!ex) {
      items.push({
        id: criarId(usados), serieId,
        numero: String(d.numero).trim(),
        mes: d.mes || "", ano: d.ano || "", posicao: null,
      });
      criadas++;
      continue;
    }
    const vazio = !ex.mes && !ex.ano;
    if (vazio) {
      ex.mes = d.mes || ""; ex.ano = d.ano || "";
      preenchidas++;
    } else if ((d.mes && ex.mes !== d.mes) || (d.ano && ex.ano !== d.ano)) {
      conflitos.push({ numero: ex.numero, banco: { mes: ex.mes, ano: ex.ano }, fandom: { mes: d.mes, ano: d.ano } });
    }
  }
  return { items, criadas, preenchidas, conflitos };
}

// One batch, every document pinned to the version it was read at. A document
// that does not exist yet carries no if_version, because there is no version to
// pin and the write must be allowed to create it.
export function montarEscritas({ docs, volumes, colecoes, series, edicoesPorSerie }) {
  const escritas = [];
  const por = (collection, doc_id, data, versao) => {
    const e = { collection, doc_id, data };
    if (typeof versao === "number") e.if_version = versao;
    escritas.push(e);
  };

  por("library", "volumes", { items: volumes }, docs.volumes);
  por("library", "colecoes", { items: colecoes }, docs.colecoes);
  por("library", "series", { items: series }, docs.series);
  for (const serieId of Object.keys(edicoesPorSerie)) {
    por("edicoes", serieId, { items: edicoesPorSerie[serieId] }, docs.edicoes?.[serieId]);
  }
  return escritas;
}
```

- [ ] **Step 4: Rodar para ver passar**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar" && node test-montar.mjs
```

Esperado: 24 linhas `PASS` e `tudo passou`.

- [ ] **Step 5: Rodar a bateria offline inteira**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar"
for t in test-wikitext.mjs test-nomes.mjs test-serie.mjs test-anuais.mjs test-encadernado.mjs test-montar.mjs; do echo "== $t"; node "$t" || exit 1; done
```

Esperado: seis blocos, todos terminando em `tudo passou`.

- [ ] **Step 6: Commit**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar"
git add lib/montar.mjs test-montar.mjs
git commit -m "$(printf 'feat: montagem do batch com ids sem colisao e merge de edicoes\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

---

### Task 10: SKILL.md — as instruções

Os módulos fazem o mecânico. Este arquivo carrega o julgamento: desambiguar, ler prosa, montar o dossiê, conduzir a aprovação, gravar.

**Files:**
- Create: `C:\Users\ACER\.claude\skills\longbox-cadastrar\SKILL.md`

**Interfaces:**
- Consumes: todos os módulos de `lib/`
- Produces: a skill invocável por nome

- [ ] **Step 1: Escrever o SKILL.md**

```markdown
---
name: longbox-cadastrar
description: Cadastra um encadernado da DC no Longbox a partir do nome — volume, coleção, séries e edições, com capa. Pesquisa Fandom e editora, apresenta um dossiê em três blocos de confiança, e só grava depois de aprovado. Use quando o usuário mandar o nome de uma HQ para cadastrar, ou pedir para completar ou atualizar uma série já cadastrada.
---

# Cadastrar HQ no Longbox

Spec: `C:\Users\ACER\longbox\docs\superpowers\specs\2026-09-15-cadastro-automatico-hqs-design.md`
Artifact: `https://claude.ai/code/artifact/75982434-39f4-426b-ab3a-da8b637a1b31`

Anuncie: "Usando longbox-cadastrar para cadastrar <nome>."

## Regras que não se negociam

1. **Nada é gravado antes da aprovação.** O dossiê vem primeiro, sempre.
2. **Nenhum campo com uma fonte só entra no bloco 1.** Amazon e Penguin Random
   House são UMA fonte: republicam o mesmo texto da DC, palavra por palavra.
3. **Todo `write_db` leva `if_version`** travado na versão lida. Se for rejeitado,
   releia e refaça. Nunca use `force`.
4. **Só DC.** Outra editora: recuse explicando que o wiki dela não foi verificado
   e que a tabela `library/editoras` só tem DC Comics.
5. **Datas são data de capa**, como o Fandom traz. Sem converter.
6. **WebFetch não serve** para Fandom (402) nem Amazon (só JS). Use `curl` com o
   User-Agent de navegador, ou os módulos de `lib/`, que já fazem isso.
7. Diga sempre o que **não** foi feito, não só o que foi.

## Passos

### 1. Ler a biblioteca atual

```
Artifact read_db, collection "library", db_op "list"
```

Guarde a `version` de cada documento — ela vai em `if_version` na gravação.

### 2. Identificar o livro

Ache a página `<Título> (Collected)` no Fandom e a da Amazon. Use
`dadosDoTrade()` de `lib/encadernado.mjs` para ano, ISBN e coleção vizinha.

Se houver mais de um candidato — `Book One` contra `Compendium One`, duas
edições do mesmo livro — **pare e pergunte**. Não escolha.

Se o título já existir em `library/volumes` (compare com `chave()` de
`lib/nomes.mjs`), não duplique: ofereça completar o que falta.

### 3. O que o livro coleciona

- `parseIssueList()` sobre o wikitext do encadernado
- `parseCollects()` sobre a frase "Collects" da Amazon ou da Penguin
- `cruzar()` para os três blocos

### 4. Resolver as séries

Para cada série distinta: `casar()` contra `library/series`. Existe, usa o `id`.
Não existe, `montarSerie()` com `numerosDaCategoria()` sobre `categoria()`.

Leia os `avisos` que `montarSerie()` devolve — total contado, faixa de
personagem — e leve cada um para o bloco 2 do dossiê.

### 5. Anuais

Para cada série nova, sonde `titulosParaSondar(<Série> Annual Vol N, 40)` com
`paginas()`, e conte com `contarAnuais()`. **Se a edição 40 existir, peça o lote
seguinte** — a série é mais longa que o palpite.

### 6. Edições

Para cada série: `categoria()` para o conjunto real, depois `paginas()` em lotes
para `Month` e `Year`. Monte as desejadas e chame `mesclarEdicoes()`.

Slots de **toda** a série, não só as colecionadas. Os `conflitos` que
`mesclarEdicoes()` devolve vão para o bloco 3.

### 7. Capa

`buscarCapa()` de `lib/capa.mjs`. Diga de qual degrau veio. 290x450 é uma queda
visível, então o usuário precisa saber.

### 8. O dossiê

Na conversa, nunca no app. Nesta ordem:

- **Confirmado** — duas ou mais fontes. Uma linha por item, sem detalhe.
- **Fonte única** — o item e qual fonte.
- **Conflito** — as duas versões e de onde vem cada uma.

Depois: o que vai ser gravado, em números (quantas séries novas, quantos slots,
quantos documentos), e quanto de cada documento vai ser usado dos 256 KB.

Pergunte o que fazer com cada item do bloco 3. Nada do bloco 3 é gravado sem
escolha explícita.

### 9. Gravar

1. `upload_asset` da capa, pegue o `id`
2. `montarEscritas()` com as versões lidas no passo 1
3. **Um** `write_db` com `db_op: "batch"`, todas as escritas juntas

Se o batch for rejeitado por versão, releia, recalcule, refaça. Se for rejeitado
por tamanho, diga qual documento estourou e quanto. Se o batch falhar depois da
capa ter subido, apague o asset órfão com `delete_asset`.

### 10. Relatar

O que entrou, com números. E o que não entrou, e por quê.

## Segundo ponto de entrada: atualizar uma série

Sem encadernado nenhum. O usuário dá o nome de uma série já cadastrada; a skill
preenche datas em branco e acrescenta edições novas de série em curso. Mesmos
passos 1, 4, 6, 8, 9.

## Fora de escopo

Marvel e qualquer editora que não a DC. Criar editora em `library/editoras`.
Qualquer mudança na interface do Longbox.
```

- [ ] **Step 2: Verificar que a skill registra**

O frontmatter precisa de `name` e `description` e nada mais. Confirme que o arquivo é lido:

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar" && head -5 SKILL.md && ls lib/
```

Esperado: o frontmatter com `name: longbox-cadastrar`, e sete arquivos em `lib/`.

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar"
git add SKILL.md
git commit -m "$(printf 'feat: instrucoes da skill longbox-cadastrar\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

---

### Task 11: Teste de aceitação contra a biblioteca real

O spec define dois testes com resposta conhecida. Este é o que fecha o plano: sem gravar nada, reproduzir o trabalho manual do usuário e comparar.

**Files:**
- Create: `C:\Users\ACER\.claude\skills\longbox-cadastrar\test-aceitacao.mjs`

**Interfaces:**
- Consumes: todos os módulos de `lib/`
- Produces: um relatório comparando o que a skill derivaria com o que está no banco

- [ ] **Step 1: Escrever o teste**

`test-aceitacao.mjs`:

```javascript
// The acceptance test from the spec. It derives what the skill WOULD register for
// Compendium One and compares against what the user registered by hand. Nothing
// is written. The library snapshot is passed in as a file so this stays offline
// and repeatable.
//
// Prepare the snapshot first, with the Artifact tool:
//   read_db, collection "library", db_op "list", out_dir <this folder>/snapshot
//
// Run: node test-aceitacao.mjs
import fs from "node:fs";
import { paginas, categoria } from "./lib/fandom.mjs";
import { parseIssueList, dadosDoTrade } from "./lib/encadernado.mjs";
import { montarSerie, numerosDaCategoria } from "./lib/serie.mjs";
import { casar, paraLongbox } from "./lib/nomes.mjs";

let falhas = 0;
function check(nome, ok, detalhe) {
  if (!ok) falhas++;
  console.log((ok ? "  PASS " : "  FAIL ") + nome + (ok || !detalhe ? "" : " (" + detalhe + ")"));
}

const snap = (n) => JSON.parse(fs.readFileSync("snapshot/library/" + n + ".json", "utf8"));
const seriesBanco = (snap("series").data || snap("series")).items;
const volumesBanco = (snap("volumes").data || snap("volumes")).items;

const titulo = "Nightwing: A Knight in Blüdhaven Compendium One (Collected)";
const wikiTrade = (await paginas([titulo])).get(titulo);
check("achou a pagina do Compendium One", typeof wikiTrade === "string");

const meta = dadosDoTrade(wikiTrade);
const volBanco = volumesBanco.find((v) => /Compendium One/i.test(v.titulo));
check("ano do encadernado bate com o banco", meta.ano === volBanco.ano, "fandom=" + meta.ano + " banco=" + volBanco.ano);

const conteudo = parseIssueList(wikiTrade);
const seriesCitadas = [...new Set(conteudo.map((e) => e.serieFandom))];
console.log("\n  series citadas pelo Compendium One: " + seriesCitadas.length);

let batem = 0;
for (const f of seriesCitadas) {
  const noBanco = casar(f, seriesBanco);
  console.log("   " + paraLongbox(f).padEnd(40) + (noBanco ? "ja cadastrada" : "NOVA"));
  if (noBanco) batem++;
}
check("toda serie citada ja esta no banco", batem === seriesCitadas.length, batem + "/" + seriesCitadas.length);

// Series metadata, derived versus hand-entered.
console.log("\n  conferindo metadados de serie");
for (const f of seriesCitadas) {
  const noBanco = casar(f, seriesBanco);
  if (!noBanco) continue;
  const wikitext = (await paginas([f])).get(f);
  if (!wikitext) { check(f + ": pagina existe", false); continue; }
  const numeros = numerosDaCategoria(f, await categoria(f));
  const { registro, avisos } = montarSerie({ fandomNome: f, wikitext, numeros });
  check(registro.nome + " totalEdicoes", registro.totalEdicoes === noBanco.totalEdicoes,
    "derivado=" + registro.totalEdicoes + " banco=" + noBanco.totalEdicoes);
  check(registro.nome + " anoInicio", registro.anoInicio === noBanco.anoInicio,
    "derivado=" + registro.anoInicio + " banco=" + noBanco.anoInicio);
  check(registro.nome + " anoFim", registro.anoFim === noBanco.anoFim,
    "derivado=" + registro.anoFim + " banco=" + noBanco.anoFim);
  for (const a of avisos) console.log("      aviso: " + a);
}

console.log("\n  LEMBRETE: os meses das edicoes DEVEM divergir do banco em series");
console.log("  cadastradas antes da decisao de data de capa. Isso e esperado, nao falha.");
console.log(falhas ? "\n" + falhas + " falha(s)" : "\ntudo passou");
process.exit(falhas ? 1 : 0);
```

- [ ] **Step 2: Preparar o retrato da biblioteca**

Com a ferramenta Artifact, não com `curl`:

```
Artifact read_db
  url: https://claude.ai/code/artifact/75982434-39f4-426b-ab3a-da8b637a1b31
  collection: library
  db_op: list
  out_dir: C:\Users\ACER\.claude\skills\longbox-cadastrar\snapshot
```

- [ ] **Step 3: Rodar**

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar" && node test-aceitacao.mjs
```

Esperado: toda série citada pelo Compendium One já cadastrada, e `totalEdicoes`, `anoInicio` e `anoFim` batendo com o banco em cada uma.

**Se `totalEdicoes` divergir numa série**, não ajuste o teste. Investigue: ou o `TotalIssues` é texto livre e caiu na contagem por categoria, ou o usuário digitou outro número. Nos dois casos o dossiê precisa dizer isso, e o resultado da investigação vira uma linha no spec.

- [ ] **Step 4: Não versionar o retrato**

O retrato tem a biblioteca do usuário e não pertence ao repositório da skill.

```bash
cd "/c/Users/ACER/.claude/skills/longbox-cadastrar"
printf 'snapshot/\n' > .gitignore
git add .gitignore test-aceitacao.mjs
git commit -m "$(printf 'test: aceitacao contra a biblioteca real, sem gravar\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

- [ ] **Step 5: O segundo teste do spec, com o usuário presente**

Rode a skill contra `Nightwing: A Knight in Blüdhaven Compendium Two` e **pare no dossiê**. O esperado, do spec:

- 41 edições confirmadas pelas duas fontes: as 34 de Nightwing (Volume 2) mais `Action Comics #771`, `Batman Annual #23`, `Birds of Prey #8, #20, #21`, `Nightwing Secret Files and Origins #1`, `Nightwing 80-Page Giant #1`
- três em conflito: `DCU Holiday Bash #2` e `Batman Chronicles #20` (só o Fandom) e `Nightwing: The Target #1` (só a editora)
- o volume já existe no banco com 34 edições vinculadas, então a skill deve oferecer **completar**, não duplicar

Só grave com a aprovação do usuário.

---

## Auto-revisão

**Cobertura do spec, seção por seção:**

| Seção do spec | Onde é implementada |
|---|---|
| 2, escopo, só DC | SKILL.md regra 4 |
| 3, data de capa | Global Constraints; SKILL.md regra 5 |
| 3, slots completos | Task 5 `numerosDaCategoria`, Task 9 `mesclarEdicoes`, SKILL.md passo 6 |
| 4, fontes e armadilhas | Task 1 fixtures, Task 4 cliente, Task 8 cascata de capa, SKILL.md regras 2 e 6 |
| 5, formato de destino | Task 9 `montarEscritas`; Task 5 e 6 os registros de série |
| 5, mapeamento do template | Task 2 e Task 5 |
| 6, regra de verificação | Task 7 `cruzar`; SKILL.md passo 8 |
| 7 fase 1, identificar | SKILL.md passo 2; Task 7 `dadosDoTrade` |
| 7 fase 2, conteúdo | Task 7 `parseIssueList` e `parseCollects` |
| 7 fase 3, resolver séries | Task 3 `casar`; Task 5 `montarSerie` |
| 7 fase 4, anuais | Task 6 |
| 7 fase 5, edições | Task 4 `categoria`, Task 9 `mesclarEdicoes` |
| 7 fase 6, coleção | SKILL.md passo 2 e 8, via `dadosDoTrade().anterior` |
| 8, gravação atômica | Task 9 `montarEscritas`; SKILL.md passo 9 |
| 9.1 série renumerada | Task 5, aviso "contado, nao lido" |
| 9.2 edições não inteiras | Task 5 `numerosDaCategoria`, Task 9 string exata |
| 9.3 série em curso | Task 2 `emCurso`, Task 5 `anoFim: presente` |
| 9.4 faixa de personagem | Task 5 `faixasDoHistory` |
| 9.5 volume já cadastrado | SKILL.md passo 2 |
| 9.6 editora fora da DC | SKILL.md regra 4 |
| 9.7 e 9.8 capa | Task 8; SKILL.md passo 7 |
| 10, falhas | SKILL.md passo 9 |
| 11, como validar | Task 11 |
| 12, onde mora | Estrutura de arquivos |

Nenhuma seção do spec ficou sem tarefa.

**Consistência de nomes entre tarefas:** `campo`, `campoLongo`, `mesPtBr`, `MESES`, `emCurso` (Task 2) são usados com esses nomes nas Tasks 5 e 6. `paraLongbox`, `paraFandom`, `chave`, `casar` (Task 3) nas Tasks 5, 6, 7 e 11. `paginas`, `categoria`, `umaPagina` (Task 4) nas Tasks 6 e 11. `montarSerie`, `numerosDaCategoria`, `faixasDoHistory` (Task 5) na Task 11. `parseIssueList`, `parseCollects`, `cruzar`, `dadosDoTrade` (Task 7) na Task 11. `criarId`, `mesclarEdicoes`, `montarEscritas` (Task 9) no SKILL.md.

**Onde o plano é mais frágil, para quem executa saber onde olhar:** `parseCollects` (Task 7) lê prosa da editora e o teste fixa 41 itens; `faixasDoHistory` (Task 5) lê prosa do wiki. Prosa muda. Se um desses falhar, imprima o texto de entrada e ajuste o padrão ao texto real — **nunca afrouxe a asserção**, porque é ela que segura a regra de verificação.
