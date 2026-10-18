import { useEffect, useMemo, useRef, useState } from "react";
import { EMBLEMAS } from "../lib/emblemas";
import { coverUrl, miniUrl, useMiniVersao } from "../lib/capas";
import { coverColors, useCores } from "../lib/cores";
import { prefersReducedMotion, useCelular } from "../lib/hooks";
import { distribuirCapas, numerosDoPersonagem, sortearEmblema, volumesDoEmblema } from "../lib/mosaico";

export function Destaque({ lib, onOpenVolume }) {
  const [sorteio, setSorteio] = useState(() => {
    const seed = Math.floor(Math.random() * 0x100000000);
    return { seed, id: sortearEmblema(lib, seed)?.id };
  });
  // Keep the chosen character through library/thumbnail updates. If its last
  // volume is removed, fall back to an eligible character with the same seed.
  const atual = useMemo(() => emblemaElegivel(lib, sorteio.id) || sortearEmblema(lib, sorteio.seed), [lib.volumes, sorteio]);
  const outroRef = useRef(null), focarOutro = useRef(false);
  useEffect(() => {
    if (atual && atual.id !== sorteio.id) setSorteio((s) => ({ ...s, id: atual.id }));
  }, [atual, sorteio.id]);
  useEffect(() => {
    if (focarOutro.current) { outroRef.current?.focus({ preventScroll: true }); focarOutro.current = false; }
  }, [sorteio.seed]);
  const outro = () => {
    const seed = (sorteio.seed + 1 + Math.floor(Math.random() * 0xffff)) >>> 0;
    const proximo = sortearEmblema(lib, seed, atual?.id);
    focarOutro.current = true;
    setSorteio({ seed, id: proximo?.id });
  };
  return (
    <section className="destaque">
      <div className="hub-section-head"><h2>Em destaque</h2></div>
      {atual ? (
        <Personagem key={atual.id + ":" + sorteio.seed} emblema={atual} seed={sorteio.seed}
          lib={lib} onOutro={outro} outroRef={outroRef} onOpenVolume={onOpenVolume} />
      ) : (
        <p className="hub-note">Os personagens da sua coleção ainda não têm um emblema disponível.</p>
      )}
    </section>
  );
}

// Registry lookup is kept outside render state; masks are never changed.
function emblemaElegivel(lib, id) {
  const e = EMBLEMAS.find((item) => item.id === id);
  return e && volumesDoEmblema(e, lib.volumes).length ? e : null;
}

function Personagem({ emblema, seed, lib, onOutro, outroRef, onOpenVolume }) {
  const celular = useCelular();
  const cores = useCores();
  useMiniVersao(); // New miniatures replace full covers without redealing tiles.
  const [grade, setGrade] = useState(false);
  const [entrada, setEntrada] = useState(true);
  const [reduz, setReduz] = useState(prefersReducedMotion);
  const [medida, setMedida] = useState({ largura: 0, rem: 16 });
  const areaRef = useRef(null), ativarRef = useRef(null), pecasRef = useRef([]);
  const gradeAnterior = useRef(false), gestoRef = useRef(null), ondaFeita = useRef(false);
  const volumes = useMemo(() => volumesDoEmblema(emblema, lib.volumes)
    .slice().sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR", { numeric: true })), [emblema, lib.volumes]);
  const numeros = useMemo(() => numerosDoPersonagem(volumes, lib.edicoes), [volumes, lib.edicoes]);
  // Batman carries a library of bat-symbols; the visit's seed picks one.
  const formas = emblema.variantes ? [emblema, ...emblema.variantes] : [emblema];
  const forma = formas[seed % formas.length];
  const linhas = celular ? forma.cel : forma.pc;
  const pecas = useMemo(() => {
    const ids = distribuirCapas(linhas, volumes.map((v) => v.id), seed);
    const vistos = new Set(), porId = new Map(volumes.map((v, i) => [v.id, { v, i }]));
    const out = [];
    let i = 0;
    linhas.forEach((linha, r) => [...linha].forEach((c, q) => {
      if (c !== "#") return;
      const id = ids[i++], unica = !vistos.has(id);
      vistos.add(id);
      out.push({ key: "c" + r + ":" + q, r, q, unica, ...porId.get(id) });
    }));
    // The pool can be larger than the mold. Those books still get a gallery
    // slot, fading in at its final position rather than being lost off-screen.
    volumes.forEach((v, i) => {
      if (!vistos.has(v.id)) out.push({ key: "v" + v.id, v, i, unica: true, extra: true, r: 0, q: 0 });
    });
    return out;
  }, [linhas, volumes, seed]);

  useEffect(() => {
    const el = areaRef.current;
    const medir = () => {
      const largura = el.getBoundingClientRect().width;
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setMedida((m) => m.largura === largura && m.rem === rem ? m : { largura, rem });
    };
    medir();
    const obs = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    obs?.observe(el);
    window.addEventListener("resize", medir);
    return () => { obs?.disconnect(); window.removeEventListener("resize", medir); };
  }, []);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const ler = () => setReduz(!!mq?.matches);
    mq?.addEventListener("change", ler);
    return () => mq?.removeEventListener("change", ler);
  }, []);
  useEffect(() => {
    if (!medida.largura) return undefined;
    const timer = setTimeout(() => setEntrada(false), reduz ? 0 : 1050);
    return () => clearTimeout(timer);
  }, [medida.largura, reduz]);

  const g = useMemo(() => {
    const { largura: W, rem } = medida;
    const gap = rem * 0.125, colunas = celular ? 16 : 40;
    const w = Math.max(0.01, (W - gap * (colunas - 1)) / colunas), h = w * 1.5;
    const colsMolde = Math.max(...linhas.map((l) => l.length));
    const x0 = (W - (colsMolde * (w + gap) - gap)) / 2;
    const H = linhas.length * (h + gap) - gap;
    const gapGrade = rem * (celular ? 0.625 : 0.875);
    const colsGrade = celular ? Math.max(1, Math.min(4, Math.floor((W + gapGrade) / (rem * 2.75 + gapGrade))))
      : Math.max(1, Math.floor((W + gapGrade) / (rem * 6.5 + gapGrade)));
    const gw = Math.max(0.01, (W - gapGrade * (colsGrade - 1)) / colsGrade), gh = gw * 1.5;
    const posicoes = pecas.map((p) => {
      const x = p.extra ? W / 2 : x0 + p.q * (w + gap);
      const y = p.extra ? H / 2 : p.r * (h + gap);
      const gx = p.i % colsGrade * (gw + gapGrade), gy = Math.floor(p.i / colsGrade) * (gh + gapGrade);
      const distancia = Math.hypot(x - W / 2, y - H / 2) / Math.max(1, Math.hypot(W / 2, H / 2));
      return { x, y, gx, gy, atraso: Math.min(320, distancia * 320) };
    });
    return { W, w, h, H, posicoes, escala: gw / w,
      altura: grade ? Math.ceil(volumes.length / colsGrade) * (gh + gapGrade) - gapGrade : H };
  }, [medida, celular, linhas, pecas, volumes.length, grade]);

  useEffect(() => {
    if (gradeAnterior.current === grade) return;
    gradeAnterior.current = grade;
    if (grade) {
      const i = pecas.findIndex((p) => p.unica);
      pecasRef.current[i]?.focus({ preventScroll: true });
    } else ativarRef.current?.focus({ preventScroll: true });
  }, [grade, pecas]);

  // Only pointer events schedule mouse frames. The finite touch sweep runs once
  // after assembly; cleanup cancels it immediately on a mode/character change.
  useEffect(() => {
    const area = areaRef.current;
    let raf = 0, ponto = null, varrendo = false;
    const ondas = pecasRef.current.map((el) => el?.querySelector(".destaque-onda"));
    const pintar = (pt, faixa = false) => {
      const R = g.w * 4.2;
      ondas.forEach((el, i) => {
        // On unmount React has already nulled the piece refs when cleanup runs.
        if (!el || !pecasRef.current[i]) return;
        const p = g.posicoes[i];
        const d = pt ? faixa ? Math.abs(p.x + g.w / 2 - pt.x)
          : Math.hypot(p.x + g.w / 2 - pt.x, p.y + g.h / 2 - pt.y) : R;
        let f = Math.max(0, 1 - d / R);
        f = f * f * (3 - 2 * f);
        el.style.setProperty("--onda-s", 1 + f * 0.4);
        el.style.setProperty("--onda-y", (-f * g.h * 0.18 / medida.rem) + "rem");
        pecasRef.current[i].style.zIndex = f > 0 ? String(Math.round(f * 100)) : "";
      });
    };
    const limpar = () => { if (raf) cancelAnimationFrame(raf); raf = 0; varrendo = false; pintar(null); };
    if (grade || reduz || entrada || !medida.largura) { limpar(); return limpar; }
    const frame = () => { raf = 0; pintar(ponto); };
    const mover = (e) => {
      if (e.pointerType !== "mouse") return;
      if (varrendo) limpar();
      const r = area.getBoundingClientRect();
      ponto = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const sair = () => { ponto = null; if (!raf) raf = requestAnimationFrame(frame); };
    area.addEventListener("pointermove", mover);
    area.addEventListener("pointerleave", sair);
    if (!ondaFeita.current && window.matchMedia?.("(hover: none), (pointer: coarse)").matches) {
      ondaFeita.current = true;
      varrendo = true;
      const inicio = performance.now(), duracao = 1300, R = g.w * 4.2;
      const passo = (t) => {
        const k = (t - inicio) / duracao;
        if (k >= 1) { raf = 0; varrendo = false; pintar(null); return; }
        pintar({ x: -R + k * (g.W + 2 * R) }, true);
        raf = requestAnimationFrame(passo);
      };
      raf = requestAnimationFrame(passo);
    }
    return () => { area.removeEventListener("pointermove", mover); area.removeEventListener("pointerleave", sair); limpar(); };
  }, [g, grade, reduz, entrada, medida.largura, pecas]);

  const alternar = () => { setEntrada(false); setGrade((v) => !v); };
  // Native scrolling remains untouched. A cancelled or travelling pointer must
  // not turn the scroll into a tap if a host synthesizes a click afterwards.
  const iniciar = (e) => { gestoRef.current = { x: e.clientX, y: e.clientY, inicio: performance.now(), moveu: e.isPrimary === false }; };
  const acompanhar = (e) => {
    const p = gestoRef.current;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > medida.rem * 0.5) p.moveu = true;
  };
  const cancelar = () => { if (gestoRef.current) gestoRef.current.moveu = true; };
  const ativar = () => {
    const gesto = gestoRef.current;
    if (!gesto || (!gesto.moveu && performance.now() - gesto.inicio < 600)) alternar();
  };
  const teclado = (e) => { if (e.key === "Enter" || e.key === " ") gestoRef.current = null; };
  // Use the pool's canonical character even when every owned book enters it
  // through tambem or a variant (e.g. Batman/Flash).
  const tamanho = (n) => n / medida.rem + "rem";
  const edge = coverColors({ personagem: emblema.pool[0] }, cores).edge;
  return (
    <div className="destaque-corpo" style={{ "--edge": edge }}>
      <div className="destaque-mosaico" ref={areaRef} data-modo={grade ? "grade" : "emblema"}
        data-entrada={entrada && !reduz ? "true" : "false"} data-medido={medida.largura > 0 ? "true" : "false"} data-emblema={emblema.id}
        style={{ height: tamanho(g.altura) }}>
        {pecas.map((p, i) => {
          const pos = g.posicoes[i], visivel = grade ? p.unica : !p.extra;
          const x = p.extra || (grade && p.unica) ? pos.gx : grade ? pos.x + (i % 7 - 3) * g.w : pos.x;
          const y = p.extra || (grade && p.unica) ? pos.gy : grade ? pos.y + (i % 5 - 2) * g.h : pos.y;
          const cor = coverColors(p.v, cores), url = miniUrl(p.v) || coverUrl(p.v);
          return (
            <button type="button" key={p.key} ref={(el) => { pecasRef.current[i] = el; }}
              className="destaque-peca" data-volume={p.v.id} data-extra={p.extra ? "true" : undefined}
              data-unica={p.unica ? "true" : "false"} data-casa={p.extra ? undefined : p.r + ":" + p.q}
              disabled={!grade || !p.unica} tabIndex={grade && p.unica ? 0 : -1}
              aria-hidden={!grade || !p.unica ? true : undefined} aria-label={p.v.titulo}
              onClick={() => onOpenVolume(p.v.id)}
              style={{ width: tamanho(g.w), height: tamanho(g.h), opacity: visivel ? 1 : 0,
                "--x": tamanho(x), "--y": tamanho(y), "--escala": p.extra || (grade && p.unica) ? g.escala : 1,
                "--entrada-x": tamanho(((i * 37 % 101) / 100 - 0.5) * g.W * 0.8),
                "--entrada-y": tamanho(-g.H * (0.3 + (i * 17 % 71) / 100)),
                "--entrada-r": (i * 13 % 51 - 25) + "deg", "--atraso": pos.atraso + "ms" }}>
              <span className="destaque-onda"><span className="destaque-arte"
                style={{ background: "linear-gradient(145deg, " + cor.a + ", " + cor.b + ")" }}>
                {url && <img src={url} alt="" decoding="async" draggable={false}
                  onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} onLoad={(e) => { e.currentTarget.style.visibility = ""; }} />}
              </span></span>
            </button>
          );
        })}
        {!grade && <button type="button" className="destaque-ativar" ref={ativarRef}
          aria-label={"Emblema de " + emblema.nome + ", feito com " + pecas.filter((p) => !p.extra).length + " capas. Ativar mostra os volumes."}
          onClick={ativar} onKeyDown={teclado} onPointerDown={iniciar} onPointerMove={acompanhar} onPointerCancel={cancelar} />}
      </div>
      <div className="destaque-painel">
        <h3 className="destaque-nome">{emblema.nome}</h3>
        <i className="destaque-traco" aria-hidden="true" />
        <div className="destaque-numeros">
          <p><strong className="num">{numeros.volumes}</strong> volumes</p>
          <p><strong className="num">{numeros.edicoesColetadas}</strong> edições coletadas</p>
          <p>lidos <span className="num">{numeros.lidos} de {numeros.volumes}</span></p>
          {numeros.anoDe !== null && <p className="destaque-anos">edições publicadas entre <span className="num">{numeros.anoDe}</span> e <span className="num">{numeros.anoAte}</span></p>}
        </div>
        {numeros.formatos.length > 0 && <p className="t-small muted destaque-formatos">
          {numeros.formatos.map((f) => f.contagem + " " + f.tipo).join(", ")}
        </p>}
        <div className="destaque-acoes">
          <button type="button" className="btn btn-quiet" onClick={alternar}>
            {grade ? "Remontar o emblema" : "Ver os " + numeros.volumes + " volumes"}
          </button>
          <button type="button" className="btn btn-ghost" ref={outroRef} onClick={onOutro}>Outro personagem</button>
        </div>
      </div>
    </div>
  );
}
