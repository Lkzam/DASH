import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { criarFonteDados } from './dados.js';
import { liderDe } from './MapaBrasil.jsx';
import AbaPresidente, { rankingDe } from './AbaPresidente.jsx';
import AbaEstadual from './AbaEstadual.jsx';
import { StatusAoVivo, TelaCarregando, SemFeed, candEst } from './ui.jsx';
import { UF_NOME } from './candidatos.js';
import { fmtInt, fmtPct } from './formato.js';
import { TEMA, SERIF } from './tema.js';

const CARGOS = [
  { id: 'presidente', label: 'Presidente' },
  { id: 'governadores', label: 'Governadores' },
  { id: 'senado', label: 'Senado' },
  { id: 'deputados', label: 'Deputados' },
];
const RE_HASH = /^#(presidente|governadores|senado|deputados)(?:-([a-z]{2}))?(?:-(\d{7}))?$/i;

// URL: #presidente · #presidente-ba · #presidente-ba-2908200 · #senado-ba …
function lerHash() {
  const vazio = { cargo: 'presidente', uf: null, mun: null };
  if (typeof window === 'undefined') return vazio;
  const m = window.location.hash.match(RE_HASH);
  if (!m) return vazio;
  const cargo = m[1].toLowerCase();
  return { cargo, uf: m[2] ? m[2].toUpperCase() : null, mun: cargo === 'presidente' && m[2] ? m[3] || null : null };
}
const montarHash = ({ cargo, uf, mun }) => `#${cargo}` + (uf ? `-${uf.toLowerCase()}` : '') + (uf && mun ? `-${mun}` : '');

/** Tema do site: prop `escuro` (dashboard) ou a classe `dark` no <html>. */
function temaAtual(escuro) {
  if (typeof escuro === 'boolean') return escuro ? 'escuro' : 'claro';
  if (typeof document !== 'undefined') return document.documentElement.classList.contains('dark') ? 'escuro' : 'claro';
  return 'escuro';
}

// ───────────────────────────── Tela ──────────────────────────────
export default function ApuracaoScreen({ escuro }) {
  const tema = temaAtual(escuro);
  const [agora, setAgora] = useState(null);
  const [cadastro, setCadastro] = useState(null);
  const [historico, setHistorico] = useState({ pontos: [] });
  const [status, setStatus] = useState({ estado: 'conectando' });
  const [municipios, setMunicipios] = useState({ info: null, resumo: null });
  const [estadual, setEstadual] = useState(null);
  const [sel, setSelEstado] = useState(lerHash); // { cargo, uf, mun }
  const [casa, setCasa] = useState('federal');   // Deputados: federais | estaduais
  const [feed, setFeed] = useState([]);
  const anterior = useRef(null);
  const anteriorEst = useRef(null);
  const mapaRef = useRef({});

  // Seleção ↔ URL (hash). pushState para o botão Voltar do navegador funcionar.
  const setSel = useCallback((novo) => {
    setSelEstado((atual) => {
      const prox = { ...atual, ...(typeof novo === 'function' ? novo(atual) : novo) };
      const limpo = {
        cargo: prox.cargo || 'presidente',
        uf: prox.uf || null,
        mun: prox.cargo === 'presidente' && prox.uf ? prox.mun || null : null,
      };
      const hash = montarHash(limpo);
      if (typeof window !== 'undefined' && window.location.hash !== hash) window.history.pushState(null, '', hash);
      return limpo;
    });
  }, []);
  useEffect(() => {
    if (!RE_HASH.test(window.location.hash)) window.history.replaceState(null, '', montarHash(lerHash()));
    const aoMudar = () => setSelEstado(lerHash());
    window.addEventListener('popstate', aoMudar);
    window.addEventListener('hashchange', aoMudar);
    return () => {
      window.removeEventListener('popstate', aoMudar);
      window.removeEventListener('hashchange', aoMudar);
      if (RE_HASH.test(window.location.hash)) window.history.replaceState(null, '', window.location.pathname + window.location.search);
    };
  }, []);

  // Esc volta um nível (cidade → estado → Brasil).
  useEffect(() => {
    const tecla = (e) => {
      if (e.key !== 'Escape') return;
      setSel((s) => (s.mun ? { mun: null } : { uf: null, mun: null }));
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [setSel]);

  // Dados REAIS por padrão; simulação só com ?sim=1 (demonstração fora da eleição).
  const sim = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('sim') === '1';
  }, []);

  useEffect(() => {
    const fonte = criarFonteDados({ sim });
    const parar = fonte.assinar(({ agora, cadastro, historico, status, municipios, estadual }) => {
      if (status) setStatus(status);
      if (cadastro) setCadastro(cadastro);
      if (municipios) setMunicipios((m) => (m.info === municipios.info && m.resumo === municipios.resumo ? m : municipios));
      if (estadual && estadual !== anteriorEst.current) {
        const novos = eventosEstaduais(anteriorEst.current, estadual);
        anteriorEst.current = estadual;
        setEstadual(estadual);
        if (novos.length) setFeed((f) => mesclarFeed(f, novos));
      }
      if (!agora) return;
      setAgora(agora);
      if (historico) setHistorico(historico);
      const novos = eventosPresidente(anterior.current, agora, mapaRef.current);
      if (novos.length) setFeed((f) => mesclarFeed(f, novos));
      anterior.current = agora;
    });
    return () => { parar?.(); fonte.parar(); };
  }, [sim]);

  const lista = cadastro?.candidatos ?? [];
  mapaRef.current = useMemo(() => Object.fromEntries(lista.map((c) => [c.numero, c])), [lista]);

  const br = agora?.presidente?.br;
  const vars = TEMA[tema];

  if (!br || lista.length === 0) {
    return <div style={vars}>{status.estado === 'sem-feed' ? <SemFeed /> : <TelaCarregando />}</div>;
  }

  const pctSecoes = br.secoes ? (br.totalizadas / br.secoes) * 100 : 0;
  const props = { agora, cadastro, sel, feed, tema };

  return (
    <div style={{ ...vars, background: 'var(--ap-bg)' }} className="text-[var(--ap-txt)] min-h-full">
      {/* Topo */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 border-b border-[var(--ap-borda)] bg-[var(--ap-topo)] backdrop-blur">
        <h1 style={SERIF} className="text-xl font-semibold tracking-tight">Apuração 2026</h1>
        <nav className="flex items-center gap-1 text-sm p-0.5 rounded-lg bg-[var(--ap-elev)] max-w-full overflow-x-auto">
          {CARGOS.map((c) => (
            <button
              key={c.id}
              onClick={() => setSel((s) => ({ cargo: c.id, uf: s.uf === 'ZZ' ? null : s.uf, mun: null }))}
              className={`px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${sel.cargo === c.id ? 'bg-[var(--ap-painel)] text-[var(--ap-forte)] font-medium shadow-sm' : 'text-[var(--ap-mudo)] hover:text-[var(--ap-forte)]'}`}
            >
              {c.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto"><StatusAoVivo status={status} pctSecoes={pctSecoes} sim={sim} /></div>
      </div>

      {sel.cargo === 'presidente' ? (
        <AbaPresidente
          {...props}
          historico={historico}
          municipios={municipios}
          setSel={(s) => setSel({ ...s, cargo: 'presidente' })}
          sim={sim}
        />
      ) : (
        <AbaEstadual
          {...props}
          cargo={sel.cargo}
          estadual={estadual}
          setSel={(s) => setSel({ ...s, cargo: sel.cargo, mun: null })}
          casa={casa}
          setCasa={setCasa}
        />
      )}
    </div>
  );
}

// ─────────────────────── Eventos do feed ───────────────────────
function mesclarFeed(atual, novos) {
  const vistos = new Set(atual.map((e) => e.id));
  return [...atual, ...novos.filter((e) => !vistos.has(e.id))]
    .sort((a, b) => (b.t || 0) - (a.t || 0))
    .slice(0, 40);
}

function eventosPresidente(prev, novo, mapaCand) {
  if (!prev || !novo?.presidente || !prev?.presidente) return [];
  const eventos = [];
  const lista = Object.values(mapaCand);
  const push = (texto, cands) => eventos.push({ id: `p-${novo.seq}-${eventos.length}`, t: novo.gerado, texto, cands });
  const brN = novo.presidente.br, brP = prev.presidente.br;
  const lidN = liderDe(brN, mapaCand), lidP = liderDe(brP, mapaCand);
  const r = rankingDe(brN, lista);

  if (lidN && lidP && lidN.numero !== lidP.numero)
    push(`Virada nacional: ${lidN.cand?.nome} assume a liderança com ${fmtPct(lidN.pct, 1)}.`, [lidN.cand]);
  const pN = brN.secoes ? (brN.totalizadas / brN.secoes) * 100 : 0;
  const pP = brP.secoes ? (brP.totalizadas / brP.secoes) * 100 : 0;
  for (const marco of [10, 50, 90]) if (pP < marco && pN >= marco) push(`${marco}% das seções apuradas no Brasil.`);
  if (brP.situacao !== 'eleito' && brN.situacao === 'eleito' && lidN) push(`${lidN.cand?.nome} está eleito presidente.`, [lidN.cand]);
  if (brP.situacao !== 'segundo-turno' && brN.situacao === 'segundo-turno')
    push(`${r[0]?.cand.nome} e ${r[1]?.cand.nome} vão ao 2º turno.`, [r[0]?.cand, r[1]?.cand]);
  if (brN.totalizadas > brP.totalizadas) {
    const n = brN.totalizadas - brP.totalizadas;
    push(`+${fmtInt(n)} ${n === 1 ? 'seção' : 'seções'} — ${r[0]?.cand.nome} ${fmtPct(r[0]?.pct, 1)}, ${r[1]?.cand.nome} ${fmtPct(r[1]?.pct, 1)}`);
  }
  return eventos;
}

/**
 * Governador/Senado definidos. Na primeira carga, monta o histórico a partir do
 * horário de totalização de cada UF (vem do TSE) — o feed já abre preenchido.
 */
function eventosEstaduais(prev, novo) {
  const ev = [];
  for (const [chave, cargo] of [['gov', 'governador'], ['sen', 'Senado']]) {
    for (const [uf, r] of Object.entries(novo[chave] || {})) {
      if (!r?.c?.length || prev?.[chave]?.[uf]?.situacao === r.situacao) continue;
      const c = r.c.map(candEst);
      const t = prev ? novo.gerado : r.quando || novo.gerado;
      const nome = UF_NOME[uf] || uf;
      if (chave === 'gov' && r.situacao === 'eleito')
        ev.push({ id: `gov-${uf}-eleito`, t, texto: `${nome}: ${c[0].nome} é eleito ${cargo}.`, cands: [c[0]] });
      else if (chave === 'gov' && r.situacao === 'segundo-turno')
        ev.push({ id: `gov-${uf}-2t`, t, texto: `${nome}: ${c[0].nome} e ${c[1]?.nome} vão ao 2º turno para governador.`, cands: c.slice(0, 2) });
      else if (chave === 'sen' && r.situacao === 'eleito')
        ev.push({ id: `sen-${uf}-eleito`, t, texto: `${nome}: ${c[0].nome} e ${c[1]?.nome} são eleitos para o Senado.`, cands: c.slice(0, 2) });
    }
  }
  return ev;
}
