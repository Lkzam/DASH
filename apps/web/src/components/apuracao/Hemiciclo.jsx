import { useMemo } from 'react';
import { corPartido, nomePartido, ideologia, CENTRAO_ROTULO } from './partidos.js';
import { fmtInt } from './formato.js';
import { SERIF } from './tema.js';

const ORDEM_IDEO = { esquerda: 0, centrao: 1, direita: 2 };
const COR_IDEO = { esquerda: '#E5372B', centrao: 'var(--ap-mudo)', direita: '#3A5FE0' };

/**
 * Partidos na ordem do plenário: esquerda → centrão → direita. Dentro de cada
 * bloco, o maior partido fica na ponta (PT à esquerda, PL à direita).
 */
export function ordenarPlenario(partidos) {
  return Object.entries(partidos)
    .filter(([, n]) => n > 0)
    .sort(([a, na], [b, nb]) => {
      const ia = ORDEM_IDEO[ideologia(a)], ib = ORDEM_IDEO[ideologia(b)];
      if (ia !== ib) return ia - ib;
      return ia === 2 ? na - nb : nb - na;
    });
}

export function contarIdeologia(partidos) {
  const c = { esquerda: 0, centrao: 0, direita: 0 };
  for (const [sg, n] of Object.entries(partidos)) c[ideologia(sg)] += n;
  return c;
}

/** Barra "Esquerda 124 · Centrão 207 · 181 Direita" com a marca da maioria. */
export function BarraEspectro({ partidos, total }) {
  const c = contarIdeologia(partidos);
  const maioria = Math.floor(total / 2) + 1;
  const w = (n) => `${(n / total) * 100}%`;
  return (
    <div>
      <div className="flex items-end justify-between text-[11px] text-[var(--ap-mudo)] mb-1">
        <span>Esquerda <b style={SERIF} className="text-lg text-[var(--ap-txt)] ml-0.5">{c.esquerda}</b></span>
        <span>Centrão <b style={SERIF} className="text-lg text-[var(--ap-txt)] ml-0.5">{c.centrao}</b></span>
        <span><b style={SERIF} className="text-lg text-[var(--ap-txt)] mr-1">{c.direita}</b>Direita</span>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden bg-[var(--ap-elev2)] flex">
        <div style={{ width: w(c.esquerda), background: COR_IDEO.esquerda }} />
        <div style={{ width: w(c.centrao), background: COR_IDEO.centrao, opacity: 0.55 }} />
        <div style={{ width: w(c.direita), background: COR_IDEO.direita }} />
      </div>
      <div className="relative h-0">
        <span className="absolute -top-3 w-px h-4 bg-[var(--ap-forte)]" style={{ left: w(maioria) }} />
      </div>
      <p className="mt-1.5 text-[10px] text-[var(--ap-mudo2)] text-center">
        maioria {maioria} · Centrão: {CENTRAO_ROTULO}
      </p>
    </div>
  );
}

/** Distribui `n` cadeiras em fileiras semicirculares (posições normalizadas). */
function layout(n) {
  const fileiras = Math.max(3, Math.round(Math.pow(n, 0.42))); // 81 → 6 · 513 → 14
  const r0 = 0.46; // miolo vazio para o número central
  const raios = Array.from({ length: fileiras }, (_, i) => r0 + ((1 - r0) * i) / (fileiras - 1));
  const soma = raios.reduce((a, r) => a + r, 0);
  const qtd = raios.map((r) => Math.round((n * r) / soma));
  qtd[qtd.length - 1] += n - qtd.reduce((a, b) => a + b, 0);
  const pts = [];
  raios.forEach((r, i) => {
    const q = qtd[i];
    for (let j = 0; j < q; j++) {
      const ang = Math.PI * (q === 1 ? 0.5 : j / (q - 1));
      pts.push({ x: -Math.cos(ang) * r, y: -Math.sin(ang) * r, ang, r });
    }
  });
  // Da esquerda para a direita (ângulo), de dentro para fora no empate.
  pts.sort((a, b) => a.ang - b.ang || a.r - b.r);
  const raioCadeira = ((1 - r0) / (fileiras - 1)) * 0.36;
  return { pts, raioCadeira };
}

/**
 * Hemiciclo: cada bolinha é uma cadeira, colorida pelo partido. `vazias`
 * (ainda em disputa) ficam cinza no fim.
 */
export function Hemiciclo({ partidos, total, centro, sub }) {
  const { pts, raioCadeira } = useMemo(() => layout(total), [total]);
  const cores = useMemo(() => {
    const lista = [];
    for (const [sg, n] of ordenarPlenario(partidos)) for (let i = 0; i < n; i++) lista.push(corPartido(sg));
    return lista;
  }, [partidos]);
  const W = 300, H = 158, esc = 140, cx = W / 2, cy = 150;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={cx + p.x * esc}
            cy={cy + p.y * esc}
            r={raioCadeira * esc}
            fill={cores[i] || 'var(--ap-elev2)'}
            style={{ transition: 'fill 400ms' }}
          />
        ))}
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center leading-none">
        <div style={SERIF} className="text-3xl font-semibold text-[var(--ap-forte)] tabular-nums">{centro}</div>
        {sub && <div className="text-[10px] text-[var(--ap-mudo2)] mt-1">{sub}</div>}
      </div>
    </div>
  );
}

/** "PL 121 · PT 70 · … · Outros 192" (top N + outros). */
export function LegendaPartidos({ partidos, top = 5, extra }) {
  const lista = Object.entries(partidos).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const outros = lista.slice(top).reduce((s, [, n]) => s + n, 0);
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--ap-mudo)] tabular-nums">
      {lista.slice(0, top).map(([sg, n]) => (
        <span key={sg} className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm" style={{ background: corPartido(sg) }} />
          {nomePartido(sg)} <b className="text-[var(--ap-txt)] font-semibold">{fmtInt(n)}</b>
        </span>
      ))}
      {outros > 0 && (
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-[var(--ap-mudo3)]" />Outros <b className="text-[var(--ap-txt)] font-semibold">{fmtInt(outros)}</b>
        </span>
      )}
      {extra}
    </div>
  );
}

/** Barra empilhada por partido (Assembleias). */
export function BarraPartidos({ partidos }) {
  const lista = ordenarPlenario(partidos);
  const total = lista.reduce((s, [, n]) => s + n, 0) || 1;
  return (
    <div className="flex h-2.5 rounded-full overflow-hidden bg-[var(--ap-elev2)]">
      {lista.map(([sg, n]) => <div key={sg} title={`${nomePartido(sg)} ${n}`} style={{ width: `${(n / total) * 100}%`, background: corPartido(sg) }} />)}
    </div>
  );
}
