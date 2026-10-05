import { useEffect, useState } from 'react';
import { COR_NEUTRA } from './candidatos.js';
import { fmtPct } from './formato.js';

/** Vencedor + margem (em pontos) de uma unidade (UF/BR) a partir dos votos. */
export function liderDe(dadosUnidade, mapaCand) {
  if (!dadosUnidade || !dadosUnidade.votos) return null;
  const pares = Object.entries(dadosUnidade.votos).sort((a, b) => b[1] - a[1]);
  const total = pares.reduce((s, [, v]) => s + v, 0);
  if (total <= 0) return null;
  const [n1, v1] = pares[0];
  const v2 = pares[1]?.[1] ?? 0;
  return {
    numero: n1,
    cand: mapaCand[n1],
    pct: (v1 / total) * 100,
    margem: ((v1 - v2) / total) * 100,
    totalValidos: total,
  };
}

/**
 * Mapa coroplético dos estados (Fase 1). Cor = partido do líder; opacidade =
 * margem de vitória. Clique seleciona a UF. Municípios/zoom vêm na Fase 2.
 */
export default function MapaBrasil({ dadosUF, mapaCand, ufSelecionada, onSelecionarUF, isDarkMode }) {
  const [malha, setMalha] = useState(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch('/apuracao/uf-paths.json', { cache: 'force-cache' })
      .then((r) => { if (!r.ok) throw new Error('malha'); return r.json(); })
      .then((m) => vivo && setMalha(m))
      .catch(() => vivo && setErro(true));
    return () => { vivo = false; };
  }, []);

  if (erro) return <div className="text-sm text-[#9CA3AF] p-6">Não foi possível carregar o mapa.</div>;
  if (!malha) return <div className="animate-pulse text-sm text-[#6B7280] p-6">Carregando mapa…</div>;

  const traco = isDarkMode ? '#0b0b0d' : '#ffffff';

  return (
    <svg viewBox={`0 0 ${malha.width} ${malha.height}`} className="w-full h-full" role="img" aria-label="Mapa do Brasil por estado">
      {malha.ufs.map((e) => {
        const dados = dadosUF?.[e.uf];
        const lid = liderDe(dados, mapaCand);
        const cor = lid?.cand?.cor ?? COR_NEUTRA;
        const op = lid ? 0.4 + 0.6 * Math.min(lid.margem / 20, 1) : 0.18;
        const sel = ufSelecionada === e.uf;
        return (
          <path
            key={e.uf}
            d={e.d}
            fill={cor}
            fillOpacity={sel ? 1 : op}
            stroke={sel ? '#fff' : traco}
            strokeWidth={sel ? 2.4 : 0.8}
            style={{ cursor: 'pointer', transition: 'fill 500ms, fill-opacity 500ms' }}
            onClick={() => onSelecionarUF?.(e.uf)}
          >
            <title>{`${e.nome}${lid ? ` — ${lid.cand?.partido ?? ''} ${fmtPct(lid.pct, 1)}` : ' — aguardando'}`}</title>
          </path>
        );
      })}
      {malha.ufs.map((e) => {
        const lid = liderDe(dadosUF?.[e.uf], mapaCand);
        return (
          <text
            key={'t' + e.uf}
            x={e.cx}
            y={e.cy}
            textAnchor="middle"
            dominantBaseline="middle"
            pointerEvents="none"
            style={{ fontSize: 15, fontWeight: 700, fill: '#fff', paintOrder: 'stroke', stroke: 'rgba(0,0,0,.45)', strokeWidth: 2.5 }}
          >
            {e.uf}
            {lid && <tspan x={e.cx} dy="15" style={{ fontSize: 12, fontWeight: 600 }}>{fmtPct(lid.pct, 0)}</tspan>}
          </text>
        );
      })}
    </svg>
  );
}
