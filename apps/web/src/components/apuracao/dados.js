// Fonte de dados da Apuração. Duas origens, mesma interface `assinar(cb)`:
//   • SIMULAÇÃO: gera a apuração localmente (sem backend) — preview/demonstração.
//   • REAL: polling resiliente dos JSON estáticos em /feed (coletor no VPS).
// O componente não sabe qual é — só recebe { agora, historico, status }.
import { snapshotSimulado } from './simulacao.js';

const FEED = '/feed';

function montarHistorico(seq, pontos) {
  return { versao: 1, seq, pontos };
}

export function criarFonteDados(opts = {}) {
  const sim = opts.sim ?? false;
  const duracaoMs = opts.duracaoMs ?? 180_000; // 3 min do 0% ao 100% na simulação
  const subs = new Set();
  const pontos = [];
  let seq = 0;
  let parado = false;
  let timer = null;
  let backoff = 5000;

  const emitir = (agora, status) => {
    for (const cb of subs) cb({ agora, historico: montarHistorico(seq, pontos), status });
  };
  const pctDe = (br) => (br?.secoes ? (br.totalizadas / br.secoes) * 100 : 0);

  function registrarPonto(agora) {
    const br = agora.presidente.br;
    pontos.push({
      t: agora.gerado, totalizadas: br.totalizadas, secoes: br.secoes,
      votos: { '13': br.votos['13'] ?? 0, '22': br.votos['22'] ?? 0 }, situacao: br.situacao,
    });
    if (pontos.length > 600) pontos.shift();
  }

  // ───────────────────────── SIMULAÇÃO ─────────────────────────
  function iniciarSim() {
    const inicio = Date.now();
    const tick = () => {
      if (parado) return;
      const p = Math.min(1, (Date.now() - inicio) / duracaoMs);
      const agora = snapshotSimulado(p);
      seq += 1;
      agora.seq = seq;
      registrarPonto(agora);
      emitir(agora, { modo: 'sim', estado: 'ao-vivo', gerado: agora.gerado, pctSecoes: pctDe(agora.presidente.br) });
      if (p >= 1 && timer) { clearInterval(timer); timer = null; }
    };
    tick();
    timer = setInterval(tick, 1500);
  }

  // ─────────────────────────── REAL ────────────────────────────
  async function buscar(url) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const res = await fetch(url, { cache: 'no-cache', signal: ctrl.signal });
      if (res.status === 429 || res.status === 503) {
        const ra = Number(res.headers.get('Retry-After'));
        throw Object.assign(new Error('rate'), { retryAfter: Number.isFinite(ra) ? ra * 1000 : null });
      }
      if (!res.ok) throw new Error('http ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(to);
    }
  }
  async function cicloReal() {
    if (parado) return;
    if (document.visibilityState === 'hidden') { agendarReal(15_000); return; }
    try {
      const agora = await buscar(`${FEED}/agora.json`);
      if (typeof agora?.seq === 'number' && agora.seq >= seq) {
        seq = agora.seq;
        try { const h = await buscar(`${FEED}/historico.json`); if (h?.pontos) { pontos.length = 0; pontos.push(...h.pontos); } } catch {}
        emitir(agora, { modo: 'real', estado: 'ao-vivo', gerado: agora.gerado, pctSecoes: pctDe(agora.presidente.br) });
        if (agora.recarregar && opts.build && agora.recarregar !== opts.build) {
          setTimeout(() => location.reload(), 2000 + Math.random() * 58_000);
        }
      }
      backoff = 5000;
      const jitter = 1 + (Math.random() * 0.4 - 0.2);
      agendarReal(15_000 * jitter);
    } catch (e) {
      for (const cb of subs) cb({ status: { modo: 'real', estado: 'reconectando' } });
      const espera = e?.retryAfter ?? backoff;
      backoff = Math.min(backoff * 2, 30_000);
      agendarReal(espera);
    }
  }
  function agendarReal(ms) {
    if (parado) return;
    timer = setTimeout(cicloReal, ms);
  }

  // ───────────────────────── visibilidade ──────────────────────
  const onVisible = () => { if (!parado && !sim && document.visibilityState === 'visible') { clearTimeout(timer); cicloReal(); } };
  const onOnline = () => { if (!parado && !sim) { clearTimeout(timer); cicloReal(); } };

  return {
    assinar(cb) {
      subs.add(cb);
      if (subs.size === 1) {
        if (sim) iniciarSim();
        else {
          document.addEventListener('visibilitychange', onVisible);
          window.addEventListener('online', onOnline);
          cicloReal();
        }
      }
      return () => subs.delete(cb);
    },
    parar() {
      parado = true;
      if (timer) { clearInterval(timer); clearTimeout(timer); timer = null; }
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    },
  };
}
