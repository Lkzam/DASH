// Formatação pt-BR centralizada para a Apuração.

export const fmtInt = (n) => new Intl.NumberFormat('pt-BR').format(Math.round(n || 0));

export const fmtPct = (n, casas = 2) =>
  (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) + '%';

/** "2,2 milhões", "845 mil", "1.203" — para diferenças de votos. */
export function fmtCompacto(n) {
  const v = Math.abs(Math.round(n || 0));
  if (v >= 1_000_000) return (v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' milhões';
  if (v >= 10_000) return Math.round(v / 1000) + ' mil';
  return fmtInt(v);
}

export const horaBR = (ms) =>
  new Date(ms || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const horaCurta = (ms) =>
  new Date(ms || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
