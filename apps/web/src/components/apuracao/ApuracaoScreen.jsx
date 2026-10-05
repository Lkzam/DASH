import { useEffect, useMemo, useRef, useState } from 'react';
import { criarFonteDados } from './dados.js';
import MapaBrasil, { liderDe } from './MapaBrasil.jsx';
import { REGIOES, UF_REGIAO, UF_NOME, COR_NEUTRA } from './candidatos.js';
import { fmtInt, fmtPct, fmtCompacto, horaBR } from './formato.js';

const SERIF = { fontFamily: '"Fraunces", Georgia, "Times New Roman", serif' };
const CARGOS = [
  { id: 'presidente', label: 'Presidente', ativo: true },
  { id: 'governadores', label: 'Governadores', ativo: false },
  { id: 'senado', label: 'Senado', ativo: false },
  { id: 'deputados', label: 'Deputados', ativo: false },
];

const validosDe = (u) => (u ? Math.max(0, (u.comparecimento || 0) - (u.brancos || 0) - (u.nulos || 0)) : 0);

function rankingDe(unidade, lista) {
  if (!unidade?.votos) return [];
  const total = Object.values(unidade.votos).reduce((s, v) => s + v, 0) || 1;
  return lista
    .map((c) => ({ cand: c, votos: unidade.votos[c.numero] || 0, pct: ((unidade.votos[c.numero] || 0) / total) * 100 }))
    .sort((a, b) => b.votos - a.votos);
}

// ───────────────────────────── Tela ──────────────────────────────
export default function ApuracaoScreen() {
  const [agora, setAgora] = useState(null);
  const [cadastro, setCadastro] = useState(null);
  const [historico, setHistorico] = useState({ pontos: [] });
  const [status, setStatus] = useState({ estado: 'conectando' });
  const [ufSel, setUfSel] = useState(null);
  const [feed, setFeed] = useState([]);
  const anterior = useRef(null);
  const mapaRef = useRef({});

  // Dados REAIS por padrão; simulação só com ?sim=1 (demonstração fora da eleição).
  const sim = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('sim') === '1';
  }, []);

  useEffect(() => {
    const fonte = criarFonteDados({ sim });
    const parar = fonte.assinar(({ agora, cadastro, historico, status }) => {
      if (status) setStatus(status);
      if (cadastro) setCadastro(cadastro);
      if (!agora) return;
      setAgora(agora);
      if (historico) setHistorico(historico);
      setFeed((f) => gerarEventos(anterior.current, agora, f, mapaRef.current));
      anterior.current = agora;
    });
    return () => { parar?.(); fonte.parar(); };
  }, [sim]);

  const lista = cadastro?.candidatos ?? [];
  const mapaCand = useMemo(() => Object.fromEntries(lista.map((c) => [c.numero, c])), [lista]);
  mapaRef.current = mapaCand;

  const br = agora?.presidente?.br;
  const dadosUF = agora?.presidente?.uf;

  if (!br || lista.length === 0) {
    return status.estado === 'sem-feed' ? <SemFeed /> : <TelaCarregando />;
  }

  const rank = rankingDe(br, lista);
  const pctSecoes = br.secoes ? (br.totalizadas / br.secoes) * 100 : 0;

  return (
    <div style={{ background: '#0b0b0d' }} className="text-[#E8E8EA] min-h-full">
      {/* Topo */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 border-b border-[#1d1d22] bg-[#0b0b0d]/95 backdrop-blur">
        <h1 style={SERIF} className="text-xl font-semibold tracking-tight">Apuração 2026</h1>
        <nav className="flex items-center gap-1 text-sm">
          {CARGOS.map((c) => (
            <span
              key={c.id}
              title={c.ativo ? '' : 'Em breve'}
              className={`px-3 py-1.5 rounded-md ${c.ativo ? 'bg-[#1b1b20] text-white font-medium' : 'text-[#5c5c66] cursor-not-allowed'}`}
            >
              {c.label}
            </span>
          ))}
        </nav>
        <div className="ml-auto"><StatusAoVivo status={status} pctSecoes={pctSecoes} sim={sim} /></div>
      </div>

      {/* 3 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,1fr)_minmax(0,1.4fr)_minmax(300px,1fr)] gap-px bg-[#131317]">
        <ColunaResumo br={br} rank={rank} historico={historico} data2t={cadastro?.data2t} />
        <section className="bg-[#0b0b0d] p-4 lg:max-h-[calc(100vh-7.5rem)] lg:overflow-hidden flex flex-col">
          <Legenda dadosUF={dadosUF} mapaCand={mapaCand} />
          <div className="flex-1 min-h-[380px]">
            <MapaBrasil dadosUF={dadosUF} mapaCand={mapaCand} ufSelecionada={ufSel} onSelecionarUF={(uf) => setUfSel((p) => (p === uf ? null : uf))} isDarkMode />
          </div>
        </section>
        <aside className="bg-[#0b0b0d] p-4 lg:max-h-[calc(100vh-7.5rem)] lg:overflow-y-auto space-y-5">
          {ufSel ? (
            <PainelEstado uf={ufSel} dados={dadosUF?.[ufSel]} lista={lista} onVoltar={() => setUfSel(null)} />
          ) : (
            <PorRegiao dadosUF={dadosUF} mapaCand={mapaCand} />
          )}
          <Feed feed={feed} />
        </aside>
      </div>
    </div>
  );
}

// ─────────────────────── Coluna esquerda ───────────────────────
function ColunaResumo({ br, rank, historico, data2t }) {
  const [verTodos, setVerTodos] = useState(false);
  const t1 = rank[0], t2 = rank[1];
  const validos = validosDe(br);
  const manchete = montarManchete(br, t1, t2);
  const demais = rank.slice(2);
  const visiveis = verTodos ? demais : demais.slice(0, 4);

  return (
    <section className="bg-[#0b0b0d] p-5 lg:max-h-[calc(100vh-7.5rem)] lg:overflow-y-auto space-y-5">
      <div>
        <h2 style={SERIF} className="text-2xl leading-snug font-semibold text-balance">
          {manchete.map((p, i) => (<span key={i} style={p.cor ? { color: p.cor } : undefined}>{p.txt}</span>))}
        </h2>
        {br.situacao === 'segundo-turno' && data2t && (
          <p className="mt-1 text-xs text-[#9A9AA3]">2º turno em {data2t}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[t1, t2].map((r, i) => r && (
          <div key={i} className="rounded-xl border border-[#1d1d22] bg-[#121216] p-3">
            <div className="flex items-center gap-2">
              <Avatar cand={r.cand} tamanho={40} />
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{r.cand.nome}</div>
                <div className="text-xs text-[#9A9AA3]">{r.cand.partido} · {r.cand.numero}</div>
              </div>
            </div>
            <div style={{ ...SERIF, color: r.cand.cor }} className="mt-2 text-3xl font-semibold tabular-nums">{fmtPct(r.pct)}</div>
            <div className="text-xs text-[#9A9AA3] tabular-nums">{fmtInt(r.votos)} votos</div>
          </div>
        ))}
      </div>

      {t1 && t2 && (
        <div>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-[#1d1d22]">
            <div style={{ width: `${t1.pct}%`, background: t1.cand.cor, transition: 'width 600ms' }} />
            <div className="flex-1" />
            <div style={{ width: `${t2.pct}%`, background: t2.cand.cor, transition: 'width 600ms' }} />
          </div>
          <p className="mt-2 text-xs text-[#9A9AA3] tabular-nums">
            Diferença: <span className="text-[#E8E8EA] font-medium">{fmtPct(Math.abs(t1.pct - t2.pct))}</span> ponto · {fmtCompacto(t1.votos - t2.votos)} de votos
          </p>
        </div>
      )}

      <div className="space-y-2">
        {visiveis.map((r) => (
          <div key={r.cand.numero} className="flex items-center gap-2 text-sm">
            <Avatar cand={r.cand} tamanho={24} />
            <span className="flex-1 truncate text-[#C9C9D1]">{r.cand.nome} <span className="text-[#6c6c76]">· {r.cand.partido}</span></span>
            <span className="tabular-nums text-[#9A9AA3]">{fmtPct(r.pct)}</span>
          </div>
        ))}
        {demais.length > 4 && (
          <button onClick={() => setVerTodos((v) => !v)} className="text-xs text-[#7aa2ff] hover:underline">
            {verTodos ? 'Mostrar menos' : `Todos os ${rank.length} candidatos`}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm border-t border-[#1d1d22] pt-4">
        <Numero rotulo="Votos válidos" valor={fmtInt(validos)} />
        <Numero rotulo="Comparecimento" valor={`${fmtInt(br.comparecimento)}`} sub={br.eleitorado ? fmtPct((br.comparecimento / br.eleitorado) * 100) : ''} />
        <Numero rotulo="Brancos" valor={fmtInt(br.brancos)} sub={br.comparecimento ? fmtPct((br.brancos / br.comparecimento) * 100) : ''} />
        <Numero rotulo="Nulos" valor={fmtInt(br.nulos)} sub={br.comparecimento ? fmtPct((br.nulos / br.comparecimento) * 100) : ''} />
      </div>

      <GraficoHistorico historico={historico} t1={t1} t2={t2} />
    </section>
  );
}

function montarManchete(br, t1, t2) {
  if (!t1 || br.situacao === 'aguardando') return [{ txt: 'Aguardando os primeiros resultados' }];
  if (br.situacao === 'eleito') return [{ txt: t1.cand.nome, cor: t1.cand.cor }, { txt: ' está eleito' }];
  if (br.situacao === 'segundo-turno' && t2)
    return [{ txt: t1.cand.nome, cor: t1.cand.cor }, { txt: ' e ' }, { txt: t2.cand.nome, cor: t2.cand.cor }, { txt: ' vão ao 2º turno' }];
  return [{ txt: t1.cand.nome, cor: t1.cand.cor }, { txt: ` lidera com ${fmtPct(t1.pct)}` }];
}

function GraficoHistorico({ historico, t1, t2 }) {
  const pts = historico?.pontos ?? [];
  const caixa = 'rounded-xl border border-[#1d1d22] bg-[#121216] p-3';
  if (!t1 || !t2) return null;
  if (pts.length < 2) {
    return (
      <div className={caixa}>
        <div className="text-xs text-[#9A9AA3] mb-1">Ao longo da apuração</div>
        <p className="text-xs text-[#6c6c76]">
          A curva se forma enquanto a apuração acontece ao vivo. Este turno já estava totalizado quando o
          coletor começou a registrar — no 2º turno o gráfico vai sendo desenhado em tempo real.
        </p>
      </div>
    );
  }
  const W = 280, H = 90, n1 = t1.cand.numero, n2 = t2.cand.numero;
  const serie = (num) => pts.map((p) => {
    const tot = (p.votos?.[n1] || 0) + (p.votos?.[n2] || 0) || 1;
    const x = p.secoes ? p.totalizadas / p.secoes : 0;
    return [x, (p.votos?.[num] || 0) / tot];
  });
  const linha = (s) => s.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * W).toFixed(1)},${(H - y * H).toFixed(1)}`).join(' ');
  return (
    <div className={caixa}>
      <div className="text-xs text-[#9A9AA3] mb-1">Ao longo da apuração <span className="text-[#5c5c66]">(% entre os dois × seções apuradas)</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#1d1d22" strokeWidth="1" />
        <path d={linha(serie(n1))} fill="none" stroke={t1.cand.cor} strokeWidth="2" />
        <path d={linha(serie(n2))} fill="none" stroke={t2.cand.cor} strokeWidth="2" />
      </svg>
    </div>
  );
}

// ─────────────────────── Coluna direita ───────────────────────
function PorRegiao({ dadosUF, mapaCand }) {
  const regioes = useMemo(() => {
    const acc = {};
    for (const [uf, d] of Object.entries(dadosUF || {})) {
      const reg = UF_REGIAO[uf]; if (!reg) continue;
      const a = (acc[reg] ||= { votos: {}, totalizadas: 0, secoes: 0 });
      a.totalizadas += d.totalizadas || 0; a.secoes += d.secoes || 0;
      for (const [k, v] of Object.entries(d.votos || {})) a.votos[k] = (a.votos[k] || 0) + v;
    }
    return acc;
  }, [dadosUF]);

  return (
    <div>
      <h3 className="text-sm font-semibold text-[#C9C9D1] mb-2">Por região</h3>
      <div className="space-y-2">
        {REGIOES.map((reg) => {
          const a = regioes[reg];
          if (!a) return null;
          const lid = liderDe(a, mapaCand);
          const pct = a.secoes ? (a.totalizadas / a.secoes) * 100 : 0;
          return (
            <div key={reg} className="rounded-lg border border-[#1d1d22] bg-[#121216] p-2.5">
              <div className="flex items-center gap-2 text-sm">
                {lid?.cand && <Avatar cand={lid.cand} tamanho={22} />}
                <span className="text-[#C9C9D1] flex-1">{reg}</span>
                <span className="tabular-nums text-[#E8E8EA]">{lid ? `${lid.cand?.partido} ${fmtPct(lid.pct, 1)}` : '—'}</span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-[#1d1d22] overflow-hidden">
                <div style={{ width: `${pct}%`, background: lid?.cand?.cor ?? COR_NEUTRA, transition: 'width 500ms' }} className="h-full" />
              </div>
              <div className="text-[10px] text-[#6c6c76] mt-1 tabular-nums">{fmtPct(pct, 0)} apurado</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PainelEstado({ uf, dados, lista, onVoltar }) {
  const rank = rankingDe(dados, lista);
  const pct = dados?.secoes ? (dados.totalizadas / dados.secoes) * 100 : 0;
  return (
    <div>
      <button onClick={onVoltar} className="text-xs text-[#9A9AA3] hover:text-white mb-2">← Brasil › {UF_NOME[uf] || uf}</button>
      <h3 style={SERIF} className="text-xl font-semibold">{UF_NOME[uf] || uf}</h3>
      <p className="text-xs text-[#9A9AA3] tabular-nums mb-3">
        {fmtPct(pct, 0)} das seções · {fmtInt(dados?.eleitorado || 0)} eleitores
      </p>
      <div className="space-y-2">
        {rank.map((r) => (
          <div key={r.cand.numero} className="flex items-center gap-2 text-sm">
            <Avatar cand={r.cand} tamanho={24} />
            <span className="flex-1 truncate text-[#C9C9D1]">{r.cand.nome} <span className="text-[#6c6c76]">· {r.cand.partido}</span></span>
            <span className="tabular-nums text-[#E8E8EA] font-medium">{fmtPct(r.pct)}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm border-t border-[#1d1d22] mt-3 pt-3">
        <Numero rotulo="Comparecimento" valor={fmtInt(dados?.comparecimento || 0)} />
        <Numero rotulo="Brancos" valor={fmtInt(dados?.brancos || 0)} />
        <Numero rotulo="Nulos" valor={fmtInt(dados?.nulos || 0)} />
        <Numero rotulo="Seções" valor={`${fmtInt(dados?.totalizadas || 0)} / ${fmtInt(dados?.secoes || 0)}`} />
      </div>
      <p className="text-[11px] text-[#5c5c66] mt-3">Zoom e resultado por município chegam na próxima fase.</p>
    </div>
  );
}

function Feed({ feed }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[#C9C9D1] mb-2">Últimas atualizações</h3>
      {feed.length === 0 ? (
        <p className="text-xs text-[#6c6c76]">Os eventos aparecem aqui conforme a apuração avança.</p>
      ) : (
        <ul className="space-y-2">
          {feed.map((e) => (
            <li key={e.id} className="flex gap-2 text-sm">
              <span className="text-[10px] text-[#6c6c76] tabular-nums pt-0.5 w-10 shrink-0">{horaBR(e.t).slice(0, 5)}</span>
              <span className="text-[#C9C9D1]">{e.texto}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────── Eventos do feed ───────────────────────
function gerarEventos(prev, novo, feedAtual, mapaCand) {
  if (!prev || !novo?.presidente || !prev?.presidente) return feedAtual;
  const eventos = [];
  const push = (texto) => eventos.push({ id: `${novo.seq}-${eventos.length}`, t: novo.gerado, texto });
  const lista = Object.values(mapaCand);
  const brN = novo.presidente.br, brP = prev.presidente.br;
  const lidN = liderDe(brN, mapaCand), lidP = liderDe(brP, mapaCand);

  if (lidN && lidP && lidN.numero !== lidP.numero)
    push(`Virada nacional: ${lidN.cand?.nome} assume a liderança com ${fmtPct(lidN.pct, 1)}.`);

  const pN = brN.secoes ? (brN.totalizadas / brN.secoes) * 100 : 0;
  const pP = brP.secoes ? (brP.totalizadas / brP.secoes) * 100 : 0;
  for (const marco of [10, 50, 90]) if (pP < marco && pN >= marco) push(`${marco}% das seções apuradas no Brasil.`);

  if (brP.situacao !== 'eleito' && brN.situacao === 'eleito' && lidN) push(`${lidN.cand?.nome} está eleito presidente.`);
  if (brP.situacao !== 'segundo-turno' && brN.situacao === 'segundo-turno') {
    const r = rankingDe(brN, lista);
    push(`${r[0]?.cand.nome} e ${r[1]?.cand.nome} vão ao 2º turno.`);
  }
  if (brN.totalizadas > brP.totalizadas) {
    const r = rankingDe(brN, lista);
    push(`+${fmtInt(brN.totalizadas - brP.totalizadas)} seções — ${r[0]?.cand.nome} ${fmtPct(r[0]?.pct, 1)}, ${r[1]?.cand.nome} ${fmtPct(r[1]?.pct, 1)}`);
  }
  return [...eventos.reverse(), ...feedAtual].slice(0, 30);
}

// ─────────────────────── Peças de UI ───────────────────────
function Avatar({ cand, tamanho = 36 }) {
  const [falhou, setFalhou] = useState(false);
  const ini = String(cand.nome || '?').split(' ').map((p) => p[0]).slice(0, 2).join('');
  const estilo = { width: tamanho, height: tamanho, borderColor: cand.cor };
  if (cand.foto && !falhou) {
    return (
      <img
        src={cand.foto}
        alt={cand.nome}
        onError={() => setFalhou(true)}
        style={estilo}
        className="rounded-full object-cover border-2 shrink-0 bg-[#1b1b20]"
      />
    );
  }
  return (
    <div style={{ ...estilo, background: cand.cor, fontSize: tamanho * 0.34 }} className="rounded-full flex items-center justify-center font-bold text-white shrink-0">
      {ini}
    </div>
  );
}

function Numero({ rotulo, valor, sub }) {
  return (
    <div>
      <div className="text-[11px] text-[#6c6c76]">{rotulo}</div>
      <div className="tabular-nums text-[#E8E8EA] font-medium">
        {valor} {sub && <span className="text-[11px] text-[#6c6c76] font-normal">· {sub}</span>}
      </div>
    </div>
  );
}

function Legenda({ dadosUF, mapaCand }) {
  const cont = useMemo(() => {
    const c = {};
    for (const [uf, d] of Object.entries(dadosUF || {})) {
      if (uf === 'ZZ') continue;
      const lid = liderDe(d, mapaCand);
      if (lid) c[lid.numero] = (c[lid.numero] || 0) + 1;
    }
    return c;
  }, [dadosUF, mapaCand]);
  const itens = Object.entries(cont).sort((a, b) => b[1] - a[1]);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#9A9AA3] mb-2">
      <span className="text-[#6c6c76]">Estados liderados:</span>
      {itens.length === 0 && <span>aguardando…</span>}
      {itens.map(([num, q]) => (
        <span key={num} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: mapaCand[num]?.cor }} />
          {mapaCand[num]?.partido} · {q}
        </span>
      ))}
    </div>
  );
}

function StatusAoVivo({ status, pctSecoes, sim }) {
  const reconect = status.estado === 'reconectando' || status.estado === 'conectando';
  return (
    <div className="flex items-center gap-2 text-xs">
      {sim && <span className="px-2 py-0.5 rounded-full bg-[#3a2a08] text-[#E0A000] font-semibold">Simulação</span>}
      <span className={`w-2 h-2 rounded-full ${reconect ? 'bg-[#E0A000]' : 'bg-[#22c55e] animate-pulse'}`} />
      {reconect ? (
        <span className="text-[#E0A000]">{status.estado === 'conectando' ? 'Conectando…' : 'Reconectando…'}</span>
      ) : (
        <span className="text-[#9A9AA3] tabular-nums">
          Atualizado às {horaBR(status.gerado)} · {fmtPct(pctSecoes, pctSecoes >= 100 ? 0 : 2)} das seções
        </span>
      )}
    </div>
  );
}

function TelaCarregando() {
  return (
    <div style={{ background: '#0b0b0d' }} className="min-h-full p-6 text-[#E8E8EA]">
      <div className="animate-pulse space-y-4">
        <div className="h-7 w-48 bg-[#1b1b20] rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="h-80 bg-[#121216] rounded-xl" />
          <div className="h-80 bg-[#121216] rounded-xl" />
          <div className="h-80 bg-[#121216] rounded-xl" />
        </div>
      </div>
      <p className="text-sm text-[#6c6c76] mt-4">Carregando apuração…</p>
    </div>
  );
}

function SemFeed() {
  return (
    <div style={{ background: '#0b0b0d' }} className="min-h-full p-10 text-[#E8E8EA]">
      <h2 style={SERIF} className="text-2xl font-semibold">Aguardando os resultados</h2>
      <p className="text-sm text-[#9A9AA3] mt-2 max-w-xl">
        O painel ainda não recebeu dados da apuração. Assim que o coletor publicar o primeiro resultado do TSE,
        esta tela atualiza sozinha.
      </p>
      <p className="text-xs text-[#6c6c76] mt-4">
        Para ver uma demonstração agora, abra com <code className="text-[#C9C9D1]">?sim=1</code> no endereço.
      </p>
    </div>
  );
}
