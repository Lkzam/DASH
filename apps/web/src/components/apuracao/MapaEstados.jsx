import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar } from './ui.jsx';
import { misturar } from './MapaMunicipios.jsx';
import { MAPA_TEMA } from './tema.js';

/**
 * Mapa por estado (SVG) das abas Governadores, Senado e Deputados.
 *
 *   estilos[UF]    = { cores: [cor] | [cor1, cor2], forte }   2 cores = divisão diagonal
 *   marcadores[UF] = { cands: [...], texto }                  fotos + rótulo no estado
 *   tooltip(UF)    → conteúdo do cartão que segue o mouse
 *
 * "claro: apurando · forte: definido" — `forte: false` mistura a cor com o fundo.
 */

const VERSAO_MALHA = '3';
const LATERAIS = ['RN', 'PB', 'PE', 'AL', 'SE', 'ES', 'RJ'];
let malhaPromise = null;
const carregarMalha = () =>
  (malhaPromise ||= fetch(`/apuracao/uf-paths.json?v=${VERSAO_MALHA}`).then((r) => {
    if (!r.ok) throw new Error('malha');
    return r.json();
  }).catch((e) => { malhaPromise = null; throw e; }));

const reduzMovimento = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const easing = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default function MapaEstados({ estilos = {}, marcadores, ufSel, onSelecionar, tooltip, tema = 'escuro' }) {
  const T = MAPA_TEMA[tema] || MAPA_TEMA.escuro;
  const caixaRef = useRef(null);
  const [malha, setMalha] = useState(null);
  const [erro, setErro] = useState(false);
  const [tam, setTam] = useState({ w: 0, h: 0 });
  const [vista, setVista] = useState(null);
  const vistaRef = useRef(null);
  vistaRef.current = vista;
  const [hover, setHover] = useState(null); // { uf, sx, sy }
  const animRef = useRef(0);
  const arrasto = useRef(null);

  useEffect(() => {
    let vivo = true;
    carregarMalha().then((m) => vivo && setMalha(m)).catch(() => vivo && setErro(true));
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    const el = caixaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTam({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const encaixar = useCallback((bbox, folga, reserva = 0) => {
    const [a, b, c, d] = bbox;
    const lw = Math.max(1, tam.w - reserva);
    const k = Math.min(lw / (c - a), tam.h / (d - b)) * folga;
    return { k, x: lw / 2 - ((a + c) / 2) * k, y: tam.h / 2 - ((b + d) / 2) * k };
  }, [tam]);

  const reserva = tam.w > 560 ? 110 : 0;
  const encaixeBR = tam.w ? encaixar([24, 24, 976, 976], 0.95, reserva) : null;
  const alvo = useCallback(() => {
    if (!tam.w || !malha) return null;
    const u = ufSel && malha.ufs.find((x) => x.uf === ufSel);
    return u ? encaixar(u.bbox, 0.8) : encaixar([24, 24, 976, 976], 0.95, reserva);
  }, [tam, malha, ufSel, encaixar, reserva]);

  // Seleção/tamanho mudou → anima até o novo enquadramento.
  useEffect(() => {
    const destino = alvo();
    if (!destino) return;
    cancelAnimationFrame(animRef.current);
    const de = vistaRef.current;
    if (!de || reduzMovimento()) { setVista(destino); return; }
    const t0 = performance.now();
    const passo = (t) => {
      const p = Math.min(1, (t - t0) / 500), e = easing(p);
      setVista({ k: de.k + (destino.k - de.k) * e, x: de.x + (destino.x - de.x) * e, y: de.y + (destino.y - de.y) * e });
      if (p < 1) animRef.current = requestAnimationFrame(passo);
    };
    animRef.current = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(animRef.current);
  }, [alvo]);

  const zoomEm = (sx, sy, f) => {
    const v = vistaRef.current;
    if (!v || !encaixeBR) return;
    cancelAnimationFrame(animRef.current);
    const k = Math.max(encaixeBR.k * 0.85, Math.min(encaixeBR.k * 12, v.k * f));
    setVista({ k, x: sx - (sx - v.x) * (k / v.k), y: sy - (sy - v.y) * (k / v.k) });
  };

  useEffect(() => {
    const el = caixaRef.current;
    if (!el) return;
    const roda = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomEm(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0016));
    };
    el.addEventListener('wheel', roda, { passive: false });
    return () => el.removeEventListener('wheel', roda);
  });

  const pos = (e) => { const r = caixaRef.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const onPointerDown = (e) => {
    const [sx, sy] = pos(e);
    arrasto.current = { sx, sy, v: vistaRef.current, moveu: false };
  };
  const onPointerMove = (e) => {
    const [sx, sy] = pos(e);
    const a = arrasto.current;
    if (a && e.buttons) {
      const dx = sx - a.sx, dy = sy - a.sy;
      if (!a.moveu && Math.hypot(dx, dy) > 4) { a.moveu = true; caixaRef.current.setPointerCapture?.(e.pointerId); }
      if (a.moveu) {
        cancelAnimationFrame(animRef.current);
        setVista({ ...a.v, x: a.v.x + dx, y: a.v.y + dy });
        setHover(null);
        return;
      }
    }
    const uf = e.target?.dataset?.uf;
    setHover(uf ? { uf, sx, sy } : null);
  };
  const onPointerUp = (e) => {
    const a = arrasto.current;
    arrasto.current = null;
    if (!a || a.moveu) return;
    const uf = e.target?.dataset?.uf;
    if (uf) onSelecionar?.(uf);
  };

  if (erro) return <div className="p-6 text-sm text-[var(--ap-mudo)]">Não foi possível carregar o mapa.</div>;

  const v = vista;
  const corDe = (uf) => {
    const s = estilos[uf];
    if (!s?.cores?.[0]) return { fill: T.semDado, grad: null };
    const ajusta = (c) => (s.forte ? c : misturar(c, 0.5, T.fundo));
    if (s.cores.length > 1 && s.cores[1]) return { fill: `url(#ap-g-${uf})`, grad: [ajusta(s.cores[0]), ajusta(s.cores[1])] };
    return { fill: ajusta(s.cores[0]), grad: null };
  };

  // Marcadores (fotos/rótulos) e pílulas laterais
  const tela = (wx, wy) => [wx * v.k + v.x, wy * v.k + v.y];
  const pertoDoBrasil = v && encaixeBR && v.k < encaixeBR.k * 1.6 && !ufSel;
  const rotulos = [], pilulas = [];
  if (malha && v) {
    for (const u of malha.ufs) {
      if (ufSel) continue;
      const [sx, sy] = tela(u.cx, u.cy);
      if (pertoDoBrasil && LATERAIS.includes(u.uf)) pilulas.push({ u, sx, sy });
      else rotulos.push({ u, sx, sy });
    }
    const xPil = Math.min(tam.w - 104, tela(990, 0)[0] + 12);
    pilulas.sort((a, b) => a.sy - b.sy);
    let ultimo = -1e9;
    for (const p of pilulas) { p.py = Math.max(p.sy - 13, ultimo + 32); ultimo = p.py; p.px = xPil; }
  }

  return (
    <div
      ref={caixaRef}
      className="relative w-full h-full select-none overflow-hidden touch-none"
      style={{ cursor: arrasto.current?.moveu ? 'grabbing' : hover ? 'pointer' : 'grab' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => setHover(null)}
      onDoubleClick={(e) => { const [sx, sy] = pos(e); zoomEm(sx, sy, 2); }}
    >
      {!malha && <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--ap-mudo2)] animate-pulse">Carregando mapa…</div>}
      {malha && v && (
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            {malha.ufs.map((u) => {
              const { grad } = corDe(u.uf);
              if (!grad) return null;
              return (
                <linearGradient key={u.uf} id={`ap-g-${u.uf}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0.5" stopColor={grad[0]} />
                  <stop offset="0.5" stopColor={grad[1]} />
                </linearGradient>
              );
            })}
          </defs>
          <g transform={`translate(${v.x},${v.y}) scale(${v.k})`}>
            {malha.ufs.map((u) => {
              const sel = ufSel === u.uf, apagado = ufSel && !sel;
              return (
                <path
                  key={u.uf}
                  data-uf={u.uf}
                  d={u.d}
                  fill={corDe(u.uf).fill}
                  fillRule="evenodd"
                  opacity={apagado ? 0.28 : 1}
                  stroke={T.bordaUF}
                  strokeWidth={1.1}
                  vectorEffect="non-scaling-stroke"
                  style={{ transition: 'fill 450ms, opacity 300ms' }}
                />
              );
            })}
            {(hover || ufSel) && malha.ufs.filter((u) => u.uf === ufSel || u.uf === hover?.uf).map((u) => (
              <path
                key={`c-${u.uf}`}
                d={u.d}
                fill="none"
                stroke={u.uf === ufSel ? T.contorno : T.destaque}
                strokeWidth={u.uf === ufSel ? 2 : 1.6}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            ))}
          </g>
          {pilulas.map((p) => (
            <line key={p.u.uf} x1={p.sx} y1={p.sy} x2={p.px} y2={p.py + 13} stroke={T.linha} strokeWidth="1" />
          ))}
        </svg>
      )}

      {rotulos.map(({ u, sx, sy }) => {
        const m = marcadores?.[u.uf];
        return (
          <div key={u.uf} className="absolute pointer-events-none flex flex-col items-center leading-none" style={{ left: sx, top: sy, transform: 'translate(-50%,-50%)' }}>
            {m?.cands?.length > 0 && (
              <div className="flex -space-x-2.5">
                {m.cands.slice(0, 2).map((c, i) => <Avatar key={i} cand={c} tamanho={m.cands.length > 1 ? 22 : 26} />)}
              </div>
            )}
            <div className="mt-0.5 text-[10px] font-bold text-white tracking-wide" style={{ textShadow: '0 1px 3px rgba(0,0,0,.9)' }}>{u.uf}</div>
            {m?.texto && <div className="text-[10px] text-white/90 tabular-nums" style={{ textShadow: '0 1px 3px rgba(0,0,0,.9)' }}>{m.texto}</div>}
          </div>
        );
      })}

      {pilulas.map(({ u, px, py }) => {
        const m = marcadores?.[u.uf];
        const s = estilos[u.uf];
        const [c1, c2] = s?.cores ?? [];
        const fundo = !c1 ? 'var(--ap-elev2)' : c2 ? `linear-gradient(135deg, ${c1} 50%, ${c2} 50%)` : c1;
        return (
          <button
            key={u.uf}
            onClick={() => onSelecionar?.(u.uf)}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            className="absolute flex items-center gap-1.5 pl-1.5 pr-2 h-[26px] rounded-md text-[11px] font-semibold text-white tabular-nums shadow"
            style={{ left: px, top: py, background: fundo, opacity: s?.forte === false ? 0.75 : 1 }}
          >
            <span style={{ textShadow: '0 1px 2px rgba(0,0,0,.6)' }}>{u.uf}</span>
            {m?.cands?.length > 0 && (
              <span className="flex -space-x-1.5">{m.cands.slice(0, 2).map((c, i) => <Avatar key={i} cand={c} tamanho={18} />)}</span>
            )}
            {m?.texto && <span style={{ textShadow: '0 1px 2px rgba(0,0,0,.6)' }}>{m.texto}</span>}
          </button>
        );
      })}

      <div className="absolute left-3 bottom-3 flex flex-col gap-1" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
        {[['+', 1.6], ['−', 1 / 1.6]].map(([t, f]) => (
          <button key={t} onClick={() => zoomEm(tam.w / 2, tam.h / 2, f)} className="w-8 h-8 rounded-md bg-[var(--ap-elev)] border border-[var(--ap-borda2)] text-[var(--ap-txt)] text-lg leading-none hover:bg-[var(--ap-elev2)]" aria-label={t === '+' ? 'Aproximar' : 'Afastar'}>{t}</button>
        ))}
      </div>

      {hover && tooltip && (() => {
        const conteudo = tooltip(hover.uf);
        if (!conteudo) return null;
        const W = 270;
        const left = hover.sx + 18 + W > tam.w ? hover.sx - W - 14 : hover.sx + 18;
        const top = Math.max(8, Math.min(hover.sy + 14, tam.h - 170));
        return (
          <div className="absolute pointer-events-none z-10 rounded-xl border border-[var(--ap-borda2)] bg-[var(--ap-tooltip)] backdrop-blur p-3 shadow-2xl" style={{ left, top, width: W }}>
            {conteudo}
          </div>
        );
      })()}
    </div>
  );
}
