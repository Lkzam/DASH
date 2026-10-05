// Motor de SIMULAÇÃO da apuração. Gera snapshots progressivos (0 → 100%) no
// MESMO formato do feed real, para desenvolver e demonstrar fora do dia da
// eleição. Determinístico em função do progresso `p` (0..1).
import { CANDIDATOS, ELEITORADO_UF, TENDENCIA_UF } from './candidatos.js';

const NUMS = CANDIDATOS.presidente.map((c) => c.numero);
const SHARES_BASE = { '12': 0.04, '15': 0.025, '50': 0.012, '40': 0.008 }; // demais

// hash estável UF → [0,1), para escalonar o ritmo de apuração por estado.
function hash01(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

const UFS = Object.keys(ELEITORADO_UF);

// Estrutura fixa por UF (seções, eleitorado, shares-alvo, offset de ritmo).
const BASE = UFS.map((uf) => {
  const eleitorado = ELEITORADO_UF[uf] * 1000;
  const secoes = Math.max(1, Math.round(eleitorado / 320));
  const t = TENDENCIA_UF[uf] ?? 0;
  const s22 = 0.47 - t * 0.65;
  const s13 = 0.45 + t * 0.65;
  const shares = { '13': s13, '22': s22, ...SHARES_BASE };
  const soma = Object.values(shares).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(shares)) shares[k] /= soma; // normaliza p/ 1
  return {
    uf, eleitorado, secoes, shares,
    offset: hash01(uf) * 0.14,           // alguns estados começam a reportar depois
    compar: 0.78 + hash01(uf + 'c') * 0.08, // comparecimento 78–86%
  };
});

function situacao(p, votos, validos) {
  if (p <= 0.02) return 'aguardando';
  if (p < 1) return 'apurando';
  const ord = Object.values(votos).sort((a, b) => b - a);
  const lider = validos > 0 ? ord[0] / validos : 0;
  return lider > 0.5 ? 'eleito' : 'segundo-turno';
}

function zeros() {
  const v = {};
  for (const n of NUMS) v[n] = 0;
  return v;
}

/** Retorna o objeto `agora` completo para o progresso p (0..1). */
export function snapshotSimulado(p, nowMs = Date.now()) {
  p = Math.max(0, Math.min(1, p));
  const brVotos = zeros();
  let brSecoes = 0, brTot = 0, brEle = 0, brComp = 0, brBra = 0, brNul = 0;
  const uf = {};

  for (const b of BASE) {
    const pUF = b.offset >= 1 ? 0 : Math.max(0, Math.min(1, (p - b.offset) / (1 - b.offset)));
    const tot = Math.round(b.secoes * pUF);
    const frac = b.secoes ? tot / b.secoes : 0;
    const comparTot = Math.round(b.eleitorado * b.compar * frac);
    const brancos = Math.round(comparTot * 0.015);
    const nulos = Math.round(comparTot * 0.045);
    const validos = Math.max(0, comparTot - brancos - nulos);
    const votos = zeros();
    for (const n of NUMS) votos[n] = Math.round(validos * b.shares[n]);

    uf[b.uf] = {
      secoes: b.secoes, totalizadas: tot, eleitorado: b.eleitorado,
      comparecimento: comparTot, brancos, nulos, votos,
      situacao: situacao(pUF, votos, validos),
    };
    brSecoes += b.secoes; brTot += tot; brEle += b.eleitorado;
    brComp += comparTot; brBra += brancos; brNul += nulos;
    for (const n of NUMS) brVotos[n] += votos[n];
  }

  const brValidos = Math.max(0, brComp - brBra - brNul);
  const br = {
    secoes: brSecoes, totalizadas: brTot, eleitorado: brEle,
    comparecimento: brComp, brancos: brBra, nulos: brNul, votos: brVotos,
    situacao: situacao(p, brVotos, brValidos),
  };

  return { versao: 1, gerado: nowMs, turno: 1, presidente: { br, uf }, recarregar: null };
}
