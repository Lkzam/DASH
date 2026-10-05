// Fonte de dados da Apuração. Duas origens, mesma interface `assinar(cb)`:
//   • REAL (padrão): polling resiliente dos JSON estáticos em /feed, publicados
//     pelo coletor (collector/coletor.mjs) a partir do TSE.
//   • SIMULAÇÃO (?sim=1): gera uma apuração fictícia localmente — demonstração.
// O componente não sabe qual é: recebe { agora, historico, cadastro, status }.
import { snapshotSimulado } from './simulacao.js';
import { CANDIDATOS } from './candidatos.js';

const FEED = '/feed';

export function criarFonteDados(opts = {}) {
  const sim = opts.sim ?? false;
  const duracaoMs = opts.duracaoMs ?? 180_000;
  const subs = new Set();
  let pontos = [];
  let seq = 0;
  let cadastro = sim ? { candidatos: CANDIDATOS.presidente, data2t: '25 de outubro' } : null;
  let parado = false;
  let timer = null;
  let backoff = 5000;

  const pctDe = (br) => (br?.secoes ? (br.totalizadas / br.secoes) * 100 : 0);
  const notificar = (payload) => { for (const cb of subs) cb(payload); };
  const emitir = (agora, status) =>
    notificar({ agora, cadastro, historico: { versao: 1, seq, pontos: [...pontos] }, status });

  // ───────────────────────── SIMULAÇÃO ─────────────────────────
  function iniciarSim() {
    const inicio = Date.now();
    const tick = () => {
      if (parado) return;
      const p = Math.min(1, (Date.now() - inicio) / duracaoMs);
      const agora = snapshotSimulado(p);
      seq += 1;
      agora.seq = seq;
      const br = agora.presidente.br;
      pontos.push({ t: agora.gerado, totalizadas: br.totalizadas, secoes: br.secoes, votos: { ...br.votos }, situacao: br.situacao });
      if (pontos.length > 600) pontos.shift();
      emitir(agora, { modo: 'sim', estado: 'ao-vivo', gerado: agora.gerado, pctSecoes: pctDe(br) });
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
        throw Object.assign(new Error('limite'), { retryAfter: Number.isFinite(ra) && ra > 0 ? ra * 1000 : null });
      }
      if (!res.ok) throw Object.assign(new Error('http ' + res.status), { status: res.status });
      return await res.json();
    } finally {
      clearTimeout(to);
    }
  }

  async function cicloReal() {
    if (parado) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      agendar(15_000);
      return;
    }
    try {
      if (!cadastro) cadastro = await buscar(`${FEED}/candidatos.json`);
      const agora = await buscar(`${FEED}/agora.json`);
      // Só aceita snapshot igual/mais novo: ignora cache velho do CDN.
      if (typeof agora?.seq === 'number' && agora.seq >= seq) {
        const mudou = agora.seq > seq || pontos.length === 0;
        seq = agora.seq;
        if (mudou) {
          try {
            const h = await buscar(`${FEED}/historico.json`);
            if (Array.isArray(h?.pontos)) pontos = h.pontos;
          } catch { /* histórico é acessório */ }
        }
        emitir(agora, { modo: 'real', estado: 'ao-vivo', gerado: agora.gerado, pctSecoes: pctDe(agora.presidente?.br) });
        if (agora.recarregar && opts.build && agora.recarregar !== opts.build) {
          setTimeout(() => location.reload(), 2000 + Math.random() * 58_000);
        }
      }
      backoff = 5000;
      agendar(15_000 * (1 + (Math.random() * 0.4 - 0.2))); // 15s ±20%
    } catch (e) {
      const semFeed = e?.status === 404;
      notificar({ status: { modo: 'real', estado: semFeed ? 'sem-feed' : 'reconectando' } });
      const espera = e?.retryAfter ?? backoff;
      backoff = Math.min(backoff * 2, 30_000); // 5s → 30s
      agendar(espera);
    }
  }
  function agendar(ms) {
    if (parado) return;
    clearTimeout(timer);
    timer = setTimeout(cicloReal, ms);
  }

  // ───────────────────────── visibilidade / rede ───────────────
  const retomar = () => {
    if (!parado && !sim && document.visibilityState === 'visible') { clearTimeout(timer); cicloReal(); }
  };

  return {
    assinar(cb) {
      subs.add(cb);
      if (subs.size === 1) {
        if (sim) iniciarSim();
        else {
          document.addEventListener('visibilitychange', retomar);
          window.addEventListener('online', retomar);
          cicloReal();
        }
      }
      return () => subs.delete(cb);
    },
    parar() {
      parado = true;
      clearInterval(timer);
      clearTimeout(timer);
      timer = null;
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', retomar);
        window.removeEventListener('online', retomar);
      }
    },
  };
}
