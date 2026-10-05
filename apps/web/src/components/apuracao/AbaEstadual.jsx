import { useEffect, useMemo, useState } from 'react';
import MapaEstados from './MapaEstados.jsx';
import { BarraEspectro, Hemiciclo, LegendaPartidos, BarraPartidos } from './Hemiciclo.jsx';
import {
  Avatar, candEst, eleitoDe, ChipUF, Paginador, BadgeSituacao, Feed, BOTAO_ICONE,
} from './ui.jsx';
import { UFS_ORDEM, rankingDe } from './AbaPresidente.jsx';
import { UF_NOME } from './candidatos.js';
import { corPartido, nomePartido } from './partidos.js';
import { SENADO_2022 } from './senado2022.js';
import { fmtInt, fmtPct, fmtCompacto } from './formato.js';
import { SERIF } from './tema.js';

/**
 * Abas Governadores, Senado e Deputados. Todas usam o mesmo esqueleto de 3
 * colunas da aba Presidente; muda a coluna da esquerda, a pintura do mapa e a
 * ordem das seções no painel do estado.
 *
 * Dados: /feed/estadual.json (resumo) e /feed/estadual/<UF>.json (listas completas).
 */

const UFS27 = UFS_ORDEM;
const CHAVE_CASA = { federal: 'depf', estadual: 'depe' };

// ═════════════════════════════ Tela ═════════════════════════════
export default function AbaEstadual({ cargo, estadual, agora, cadastro, sel, setSel, feed, tema, casa, setCasa }) {
  const detalhe = useDetalheUF(sel.uf, estadual?.seq);
  const mapaPres = useMemo(
    () => Object.fromEntries((cadastro?.candidatos ?? []).map((c) => [c.numero, c])),
    [cadastro],
  );

  if (!estadual) {
    return (
      <div className="p-10 bg-[var(--ap-bg)] min-h-[60vh]">
        <h2 style={SERIF} className="text-2xl font-semibold text-[var(--ap-txt)]">Aguardando os resultados estaduais</h2>
        <p className="text-sm text-[var(--ap-mudo)] mt-2 max-w-xl">
          Governadores, Senado e Deputados aparecem assim que o coletor publicar o primeiro resultado do TSE
          (no modo simulação esta aba fica vazia).
        </p>
      </div>
    );
  }

  const mapa = configMapa(cargo, estadual, casa);
  const irUF = (uf) => setSel({ uf: uf === sel.uf ? null : uf });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)_minmax(290px,340px)] gap-px bg-[var(--ap-gap)]">
      <section className="bg-[var(--ap-bg)] p-5 lg:max-h-[calc(100vh-7.5rem)] lg:overflow-y-auto space-y-5">
        {cargo === 'governadores' && <ColunaGovernadores est={estadual} onUF={irUF} ufSel={sel.uf} />}
        {cargo === 'senado' && <ColunaSenado est={estadual} onUF={irUF} ufSel={sel.uf} />}
        {cargo === 'deputados' && <ColunaDeputados est={estadual} casa={casa} setCasa={setCasa} />}
      </section>

      <section className="bg-[var(--ap-bg)] p-4 h-[72vh] lg:h-[calc(100vh-7.5rem)] flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 min-h-[24px]">
          <div className="flex items-center gap-1.5 text-xs text-[var(--ap-mudo)]">
            <button onClick={() => setSel({ uf: null })} className={!sel.uf ? 'text-[var(--ap-forte)] font-medium' : 'hover:text-[var(--ap-forte)]'}>Brasil</button>
            {sel.uf && (<><span>›</span><span className="text-[var(--ap-forte)] font-medium">{UF_NOME[sel.uf]}</span></>)}
          </div>
          <LegendaMapa itens={mapa.legenda} unidade={mapa.unidade} />
        </div>
        <div className="flex-1 min-h-0 relative">
          <MapaEstados
            estilos={mapa.estilos}
            marcadores={mapa.marcadores}
            tooltip={mapa.tooltip}
            ufSel={sel.uf}
            onSelecionar={(uf) => setSel({ uf })}
            tema={tema}
          />
        </div>
      </section>

      <aside className="bg-[var(--ap-bg)] p-4 lg:max-h-[calc(100vh-7.5rem)] lg:overflow-y-auto space-y-5">
        {sel.uf && (
          <PainelEstadual
            uf={sel.uf}
            cargo={cargo}
            est={estadual}
            detalhe={detalhe}
            presUF={agora?.presidente?.uf?.[sel.uf]}
            mapaPres={mapaPres}
            casa={casa}
            setCasa={setCasa}
            onVoltar={() => setSel({ uf: null })}
            onIr={(uf) => setSel({ uf })}
          />
        )}
        <Feed feed={feed} />
      </aside>
    </div>
  );
}

/** Lista completa da UF (estadual/<UF>.json); recarrega quando o resumo muda. */
function useDetalheUF(uf, seq) {
  const [det, setDet] = useState({});
  useEffect(() => {
    if (!uf) return;
    let vivo = true;
    fetch(`/feed/estadual/${uf}.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo && d) setDet((m) => ({ ...m, [uf]: d })); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [uf, seq]);
  return uf ? det[uf] : null;
}

// ═════════════════════════ Pintura do mapa ═════════════════════════
const pctTxt = (p) => `${Math.round(p)}%`;

function contarLegenda(pares, top = 4) {
  const c = {};
  for (const sg of pares) if (sg) c[sg] = (c[sg] || 0) + 1;
  const lista = Object.entries(c).sort((a, b) => b[1] - a[1]);
  const outros = lista.slice(top).reduce((s, [, n]) => s + n, 0);
  return [...lista.slice(0, top).map(([sg, n]) => ({ sg, n })), ...(outros ? [{ sg: null, n: outros }] : [])];
}

function configMapa(cargo, est, casa) {
  const estilos = {}, marcadores = {};
  const pares = [];

  if (cargo === 'governadores' || cargo === 'senado') {
    const chave = cargo === 'governadores' ? 'gov' : 'sen';
    for (const uf of UFS27) {
      const r = est[chave]?.[uf];
      if (!r?.c?.length) continue;
      const c = r.c.map(candEst);
      if (chave === 'gov') {
        const dois = r.situacao === 'segundo-turno';
        estilos[uf] = { cores: dois ? [c[0].cor, c[1]?.cor] : [c[0].cor], forte: r.situacao !== 'apurando' };
        marcadores[uf] = dois ? { cands: c.slice(0, 2) } : { cands: [c[0]], texto: pctTxt(c[0].pct) };
        pares.push(c[0].partido);
      } else {
        estilos[uf] = { cores: [c[0].cor, c[1]?.cor], forte: r.situacao === 'eleito' };
        marcadores[uf] = { cands: c.slice(0, 2) };
        pares.push(c[0].partido, c[1]?.partido);
      }
    }
    return {
      estilos, marcadores,
      legenda: contarLegenda(pares),
      unidade: chave === 'gov' ? 'estados' : 'vagas',
      tooltip: (uf) => <TooltipMajoritario uf={uf} r={est[chave]?.[uf]} />,
    };
  }

  // Deputados: estado pintado pelo partido com mais cadeiras na UF.
  const k = CHAVE_CASA[casa];
  for (const uf of UFS27) {
    const r = est[k]?.[uf];
    if (!r) continue;
    const [sg] = Object.entries(r.partidos || {}).sort((a, b) => b[1] - a[1])[0] || [];
    if (!sg) continue;
    estilos[uf] = { cores: [corPartido(sg)], forte: r.pct >= 100 };
    pares.push(sg);
  }
  return {
    estilos, marcadores: null,
    legenda: contarLegenda(pares),
    unidade: 'estados',
    tooltip: (uf) => <TooltipDeputados uf={uf} r={est[k]?.[uf]} casa={casa} />,
  };
}

function LegendaMapa({ itens, unidade }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[11px] text-[var(--ap-mudo)] tabular-nums">
      {itens.map(({ sg, n }) => (
        <span key={sg || 'outros'} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: sg ? corPartido(sg) : 'var(--ap-mudo3)' }} />
          {sg ? nomePartido(sg) : 'Outros'} <b className="text-[var(--ap-txt)] font-semibold">{n}</b>
        </span>
      ))}
      {itens.length > 0 && <span className="text-[var(--ap-mudo2)]">{unidade}</span>}
      <span className="flex items-center gap-1.5 text-[10px] text-[var(--ap-mudo2)]">
        <span className="flex"><span className="w-3 h-2 bg-[#3A5FE0] opacity-50" /><span className="w-3 h-2 bg-[#3A5FE0]" /></span>
        claro: apurando · forte: definido
      </span>
    </div>
  );
}

// ═════════════════════════ Tooltips ═════════════════════════
function CabecalhoTooltip({ uf, linha }) {
  return (
    <div className="flex items-start gap-2">
      <span className="px-1.5 py-0.5 rounded bg-[var(--ap-elev2)] text-[10px] font-semibold text-[var(--ap-txt2)]">{uf}</span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[var(--ap-forte)] truncate">{UF_NOME[uf]}</div>
        {linha && <div className="text-[11px] text-[var(--ap-mudo)] tabular-nums">{linha}</div>}
      </div>
    </div>
  );
}

function TooltipMajoritario({ uf, r }) {
  if (!r) return <CabecalhoTooltip uf={uf} linha="Aguardando os primeiros votos." />;
  return (
    <>
      <CabecalhoTooltip uf={uf} linha={`${fmtPct(r.pct, r.pct >= 100 ? 0 : 1)} das seções`} />
      <div className="mt-2.5 space-y-2">
        {r.c.slice(0, 2).map((c0) => {
          const c = candEst(c0);
          return (
            <div key={c.n} className="flex items-center gap-2">
              <Avatar cand={c} tamanho={30} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-[var(--ap-forte)] truncate">{c.nome}</div>
                <div className="text-[10px] font-semibold" style={{ color: c.cor }}>{c.sigla} {c.n}</div>
              </div>
              <div className="text-[13px] font-semibold text-[var(--ap-forte)] tabular-nums">{fmtPct(c.pct, 1)}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function TooltipDeputados({ uf, r, casa }) {
  if (!r) return <CabecalhoTooltip uf={uf} linha="Aguardando os primeiros votos." />;
  const mais = r.top?.[0];
  const partidos = Object.entries(r.partidos || {}).sort((a, b) => b[1] - a[1]).slice(0, 4);
  return (
    <>
      <CabecalhoTooltip uf={uf} linha={`${casa === 'federal' ? 'Deputados federais' : 'Deputados estaduais'} · ${r.nv} vagas · ${fmtPct(r.pct, r.pct >= 100 ? 0 : 1)} das seções`} />
      {mais && (
        <p className="mt-2 text-[12px] text-[var(--ap-txt2)]">
          Mais votado: <b className="text-[var(--ap-forte)]">{mais.nome}</b> ({nomePartido(mais.partido)}), {fmtInt(mais.vap)} votos
        </p>
      )}
      {partidos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] text-[var(--ap-mudo)] tabular-nums">
          {partidos.map(([sg, n]) => (
            <span key={sg} className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: corPartido(sg) }} />{nomePartido(sg)} {n}</span>
          ))}
        </div>
      )}
    </>
  );
}

// ═════════════════════════ Coluna: Governadores ═════════════════════════
function ColunaGovernadores({ est, onUF, ufSel }) {
  const [pagina, setPagina] = useState(0);
  const lista = UFS27.map((uf) => ({ uf, r: est.gov?.[uf] })).filter((x) => x.r);
  const eleitos = lista.filter((x) => x.r.situacao === 'eleito');
  const segundo = lista.filter((x) => x.r.situacao === 'segundo-turno');
  const apurando = lista.filter((x) => !['eleito', 'segundo-turno'].includes(x.r.situacao));
  const porEleitorado = (a, b) => (b.r.eleitorado || 0) - (a.r.eleitorado || 0);
  const chips = [...eleitos.sort(porEleitorado), ...segundo.sort(porEleitorado), ...apurando.sort(porEleitorado)];
  const disputas = lista
    .filter((x) => x.r.c.length > 1)
    .map((x) => ({ ...x, margem: x.r.c[0].pct - x.r.c[1].pct }))
    .sort((a, b) => a.margem - b.margem);
  const POR = 7, paginas = Math.ceil(disputas.length / POR);

  return (
    <>
      <div className="flex items-baseline justify-between">
        <h2 style={SERIF} className="text-xl font-semibold text-[var(--ap-txt)]">Governadores</h2>
        <span className="text-xs text-[var(--ap-mudo)]">{lista.length} disputas</span>
      </div>
      <div className="flex items-baseline gap-3 text-[var(--ap-mudo)] text-sm">
        <span><b style={SERIF} className="text-3xl text-[var(--ap-forte)] font-semibold">{eleitos.length}</b> eleitos</span>
        <span>·</span>
        <span><b style={SERIF} className="text-3xl text-[var(--ap-forte)] font-semibold">{segundo.length}</b> no 2º turno</span>
        {apurando.length > 0 && <><span>·</span><span>{apurando.length} apurando</span></>}
      </div>
      <div className="flex flex-wrap gap-1">
        {chips.map(({ uf, r }) => {
          const c = r.c.map(candEst);
          const dois = r.situacao === 'segundo-turno';
          return (
            <ChipUF key={uf} uf={uf} cores={dois ? [c[0].cor, c[1]?.cor] : [c[0].cor]} claro={r.situacao === 'apurando'} ativo={ufSel === uf} onClick={() => onUF(uf)} />
          );
        })}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-[var(--ap-txt2)]">Disputas, das mais apertadas</h3>
          <Paginador pagina={pagina} total={paginas} setPagina={setPagina} />
        </div>
        <ul className="divide-y divide-[var(--ap-borda)]">
          {disputas.slice(pagina * POR, pagina * POR + POR).map(({ uf, r }) => (
            <li key={uf}>
              <button onClick={() => onUF(uf)} className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-[var(--ap-elev)] rounded-md px-1">
                <div className="flex flex-col items-center gap-1 w-14 shrink-0">
                  <ChipUF uf={uf} cores={[candEst(r.c[0]).cor]} />
                  <span className="text-[10px] text-[var(--ap-mudo)]">{rotuloSituacao(r.situacao)}</span>
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  {r.c.slice(0, 2).map((c0, i) => {
                    const c = candEst(c0);
                    return (
                      <div key={c.n} className="flex items-center gap-2 text-sm">
                        <Avatar cand={c} tamanho={22} />
                        <span className={`flex-1 truncate ${i ? 'text-[var(--ap-mudo)]' : 'text-[var(--ap-txt)]'}`}>{c.nome}</span>
                        <span className="tabular-nums font-medium" style={{ color: c.cor }}>{fmtPct(c.pct, 1)}</span>
                      </div>
                    );
                  })}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

const rotuloSituacao = (s) => ({ eleito: 'eleito', 'segundo-turno': '2º turno', apurando: 'apurando', aguardando: 'aguardando' }[s] || '');

// ═════════════════════════ Coluna: Senado ═════════════════════════
function ColunaSenado({ est, onUF, ufSel }) {
  const [pagina, setPagina] = useState(0);
  const lista = UFS27.map((uf) => ({ uf, r: est.sen?.[uf] })).filter((x) => x.r);

  // Plenário de 81: as 27 cadeiras de 2022 + as 54 em disputa agora.
  const { partidos, definidas, emDisputa } = useMemo(() => {
    const p = {};
    let def = 0, disp = 0;
    for (const s of Object.values(SENADO_2022)) p[s.partido] = (p[s.partido] || 0) + 1;
    for (const { r } of lista) {
      for (const c of r.c.slice(0, r.nv || 2)) {
        if (eleitoDe(c)) { p[c.partido] = (p[c.partido] || 0) + 1; def++; } else disp++;
      }
    }
    return { partidos: p, definidas: def, emDisputa: disp };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [est]);

  const completas = lista.filter((x) => x.r.situacao === 'eleito').sort((a, b) => (b.r.eleitorado || 0) - (a.r.eleitorado || 0));
  const outras = lista.filter((x) => x.r.situacao !== 'eleito');
  const segundaVaga = lista
    .filter((x) => x.r.c.length > 2)
    .map((x) => ({ ...x, margem: x.r.c[1].pct - x.r.c[2].pct }))
    .sort((a, b) => a.margem - b.margem);
  const POR = 3, paginas = Math.ceil(segundaVaga.length / POR);

  return (
    <>
      <div className="flex items-baseline justify-between">
        <h2 style={SERIF} className="text-xl font-semibold text-[var(--ap-txt)]">Senado</h2>
        <span className="text-xs text-[var(--ap-mudo)]">Duas vagas por estado</span>
      </div>
      <BarraEspectro partidos={partidos} total={81} />
      <Hemiciclo partidos={partidos} total={81} centro={definidas} sub={`de ${definidas + emDisputa} definidas`} />
      <LegendaPartidos
        partidos={partidos}
        extra={<span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[var(--ap-elev2)]" />Em disputa <b className="text-[var(--ap-txt)] font-semibold">{emDisputa}</b></span>}
      />
      <p className="text-[10px] text-[var(--ap-mudo2)] -mt-3">Inclui as 27 cadeiras eleitas em 2022 (mandato até 2031).</p>

      <div>
        <div className="text-sm text-[var(--ap-mudo)] mb-2">
          <b style={SERIF} className="text-2xl text-[var(--ap-forte)] font-semibold mr-1">{completas.length}</b>com as duas vagas
        </div>
        <div className="flex flex-wrap gap-1">
          {[...completas, ...outras].map(({ uf, r }) => {
            const c = r.c.map(candEst);
            return <ChipUF key={uf} uf={uf} cores={[c[0]?.cor, c[1]?.cor]} claro={r.situacao !== 'eleito'} ativo={ufSel === uf} onClick={() => onUF(uf)} />;
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-[var(--ap-txt2)]">A disputa pela 2ª vaga</h3>
          <Paginador pagina={pagina} total={paginas} setPagina={setPagina} />
        </div>
        <ul className="divide-y divide-[var(--ap-borda)]">
          {segundaVaga.slice(pagina * POR, pagina * POR + POR).map(({ uf, r }) => (
            <li key={uf}>
              <button onClick={() => onUF(uf)} className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-[var(--ap-elev)] rounded-md px-1">
                <div className="flex flex-col items-center gap-1 w-14 shrink-0">
                  <ChipUF uf={uf} cores={[candEst(r.c[1]).cor]} />
                  <span className="text-[10px] text-[var(--ap-mudo)]">{eleitoDe(r.c[1]) ? 'eleito' : 'apurando'}</span>
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  {r.c.slice(1, 3).map((c0, i) => {
                    const c = candEst(c0);
                    return (
                      <div key={c.n} className="flex items-center gap-2 text-sm">
                        <Avatar cand={c} tamanho={22} />
                        <span className={`flex-1 truncate ${i ? 'text-[var(--ap-mudo)]' : 'text-[var(--ap-txt)]'}`}>{c.nome}</span>
                        <span className="tabular-nums font-medium" style={{ color: c.cor }}>{fmtPct(c.pct, 2)}</span>
                      </div>
                    );
                  })}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

// ═════════════════════════ Coluna: Deputados ═════════════════════════
function somarPartidos(est, k) {
  const p = {};
  let eleitos = 0, vagas = 0, pctPond = 0;
  for (const uf of UFS27) {
    const r = est[k]?.[uf];
    if (!r) continue;
    for (const [sg, n] of Object.entries(r.partidos || {})) p[sg] = (p[sg] || 0) + n;
    eleitos += r.eleitos || 0;
    vagas += r.nv || 0;
    pctPond += (r.pct || 0) * (r.nv || 0);
  }
  return { partidos: p, eleitos, vagas, pct: vagas ? pctPond / vagas : 0 };
}

function AbasCasa({ casa, setCasa }) {
  return (
    <div className="inline-flex p-0.5 rounded-lg bg-[var(--ap-elev)] text-xs">
      {[['federal', 'Federais'], ['estadual', 'Estaduais']].map(([id, txt]) => (
        <button
          key={id}
          onClick={() => setCasa(id)}
          className={`px-3 py-1 rounded-md ${casa === id ? 'bg-[var(--ap-painel)] text-[var(--ap-forte)] font-medium shadow-sm' : 'text-[var(--ap-mudo)] hover:text-[var(--ap-forte)]'}`}
        >
          {txt}
        </button>
      ))}
    </div>
  );
}

function ColunaDeputados({ est, casa, setCasa }) {
  const [verMais, setVerMais] = useState(false);
  const k = CHAVE_CASA[casa];
  const { partidos, eleitos, vagas, pct } = useMemo(() => somarPartidos(est, k), [est, k]);
  const top = est.topBR?.[k] ?? [];
  const federal = casa === 'federal';

  return (
    <>
      <div className="flex items-baseline justify-between">
        <h2 style={SERIF} className="text-xl font-semibold text-[var(--ap-txt)] whitespace-nowrap">{federal ? 'Câmara dos Deputados' : 'Assembleias Legislativas'}</h2>
        <span className="text-xs text-[var(--ap-mudo)] tabular-nums whitespace-nowrap ml-2">{fmtInt(vagas)} vagas</span>
      </div>
      <AbasCasa casa={casa} setCasa={setCasa} />

      {federal ? (
        <>
          <BarraEspectro partidos={partidos} total={vagas || 513} />
          <Hemiciclo partidos={partidos} total={vagas || 513} centro={fmtInt(eleitos)} sub={`eleitos de ${fmtInt(vagas)}`} />
        </>
      ) : (
        <>
          <div className="text-sm text-[var(--ap-mudo)]">
            <b style={SERIF} className="text-3xl text-[var(--ap-forte)] font-semibold mr-1.5">{fmtInt(eleitos)}</b>
            eleitos de {fmtInt(vagas)} nas 27 assembleias
          </div>
          <BarraPartidos partidos={partidos} />
        </>
      )}
      <LegendaPartidos partidos={partidos} />

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-[var(--ap-txt2)]">{federal ? 'Mais votados do Brasil' : 'Mais votados para deputado estadual'}</h3>
          <span className="text-[11px] text-[var(--ap-mudo)] tabular-nums">{fmtPct(pct, pct >= 100 ? 0 : 1)} das seções</span>
        </div>
        <ListaDeputados lista={verMais ? top : top.slice(0, 10)} comUF />
        {top.length > 10 && (
          <button onClick={() => setVerMais((v) => !v)} className="mt-3 w-full text-sm py-2 rounded-lg bg-[var(--ap-elev)] border border-[var(--ap-borda2)] text-[var(--ap-txt2)] hover:text-[var(--ap-forte)]">
            {verMais ? 'Mostrar menos' : `Ver os ${top.length} mais votados`}
          </button>
        )}
        <p className="mt-2 text-[11px] text-[var(--ap-mudo2)] text-center">ou clique num estado no mapa para ver só os dele</p>
      </div>
    </>
  );
}

function ListaDeputados({ lista, comUF, inicio = 0 }) {
  return (
    <ol className="space-y-2">
      {lista.map((c0, i) => {
        const c = candEst(c0);
        return (
          <li key={`${c.uf || ''}${c.n}`} className="flex items-center gap-2.5 text-sm">
            <span className="w-5 text-right text-[11px] text-[var(--ap-mudo2)] tabular-nums">{inicio + i + 1}</span>
            <Avatar cand={c} tamanho={28} />
            <div className="flex-1 min-w-0">
              <div className="truncate text-[var(--ap-txt)]">{c.nome}</div>
              <div className="text-[10px] font-semibold" style={{ color: c.cor }}>{c.sigla}{comUF && c.uf ? ` · ${c.uf}` : ''}</div>
            </div>
            <div className="text-right">
              <div className="tabular-nums text-[var(--ap-txt)] text-[13px]">{fmtInt(c.vap)}</div>
              {c.e && <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-px rounded bg-[#16a34a]/15 text-[#16a34a]">eleito</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ═════════════════════════ Painel do estado ═════════════════════════
function PainelEstadual({ uf, cargo, est, detalhe, presUF, mapaPres, casa, setCasa, onVoltar, onIr }) {
  const gov = est.gov?.[uf], sen = est.sen?.[uf];
  const ref = gov || sen || est.depf?.[uf];
  const i = UFS27.indexOf(uf);
  const ir = (passo) => onIr(UFS27[(i + passo + UFS27.length) % UFS27.length]);

  const blocos = {
    gov: <BlocoGovernador key="gov" r={gov} />,
    sen: <BlocoSenado key="sen" r={sen} />,
    pres: <BlocoPresidente key="pres" uf={uf} dados={presUF} mapaPres={mapaPres} />,
    dep: <BlocoDeputados key="dep" uf={uf} est={est} detalhe={detalhe} casa={casa} setCasa={setCasa} />,
  };
  const ordem = {
    governadores: ['gov', 'sen', 'pres'],
    senado: ['sen', 'gov', 'pres'],
    deputados: ['dep'],
  }[cargo];

  return (
    <div className={`rounded-xl border border-[var(--ap-borda)] bg-[var(--ap-painel)] p-4`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 style={SERIF} className="text-2xl font-semibold text-[var(--ap-txt)] leading-tight">{UF_NOME[uf]}</h3>
          {ref && (
            <p className="text-xs text-[var(--ap-mudo)] tabular-nums">
              {fmtPct(ref.pct, ref.pct >= 100 ? 0 : 1)} das seções
              {gov?.eleitorado ? ` · ${fmtCompacto(gov.eleitorado)} de eleitores` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => ir(-1)} className={BOTAO_ICONE} aria-label="Estado anterior">‹</button>
          <button onClick={() => ir(1)} className={BOTAO_ICONE} aria-label="Próximo estado">›</button>
          <button onClick={onVoltar} className={BOTAO_ICONE} aria-label="Voltar para o Brasil">✕</button>
        </div>
      </div>
      <div className="divide-y divide-[var(--ap-borda)]">
        {ordem.map((k) => <div key={k} className="py-4 first:pt-1 last:pb-0">{blocos[k]}</div>)}
      </div>
    </div>
  );
}

function TituloBloco({ children, direita }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h4 className="text-[13px] font-semibold text-[var(--ap-txt2)]">{children}</h4>
      {direita}
    </div>
  );
}

function LinhaCandidato({ c, direita }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Avatar cand={c} tamanho={24} />
      <span className="flex-1 truncate text-[var(--ap-txt2)]">{c.nome} <span className="text-[var(--ap-mudo2)]">· {c.sigla}</span></span>
      {direita}
    </div>
  );
}

function BlocoGovernador({ r }) {
  const [todos, setTodos] = useState(false);
  if (!r?.c?.length) return <TituloBloco>Governador</TituloBloco>;
  const c = r.c.map(candEst);
  const [a, b] = c;
  const vantagem = b ? a.vap - b.vap : 0;
  const outros = c.slice(2);
  const pctOutros = outros.reduce((s, x) => s + x.pct, 0);
  return (
    <div>
      <TituloBloco direita={<BadgeSituacao situacao={r.situacao} pct={r.pct} />}>Governador</TituloBloco>
      <div className="grid grid-cols-2 gap-3">
        {[a, b].map((x, i) => x && (
          <div key={x.n} className={i ? 'text-right' : ''}>
            <div className={`flex items-center gap-2 ${i ? 'flex-row-reverse' : ''}`}>
              <Avatar cand={x} tamanho={40} />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--ap-txt)] leading-tight">{x.nome}</div>
                <div className="text-[10px] font-semibold" style={{ color: x.cor }}>{x.sigla} {x.n}</div>
              </div>
            </div>
            <div style={{ ...SERIF, color: x.cor }} className="mt-1.5 text-3xl font-semibold tabular-nums">{fmtPct(x.pct, 1)}</div>
          </div>
        ))}
      </div>
      {b && (
        <div className="relative mt-2 flex h-2 rounded-full overflow-hidden bg-[var(--ap-elev2)]">
          <div style={{ width: `${a.pct}%`, background: a.cor, transition: 'width 600ms' }} />
          <div className="flex-1" />
          <div style={{ width: `${b.pct}%`, background: b.cor, transition: 'width 600ms' }} />
          <span className="absolute left-1/2 top-0 bottom-0 w-px bg-[var(--ap-mudo)]" />
        </div>
      )}
      <div className="mt-2 flex justify-between text-[11px] text-[var(--ap-mudo)] tabular-nums">
        <span>Vantagem<br /><b className="text-[var(--ap-txt)] font-medium">{fmtCompacto(vantagem)} de votos</b></span>
        {outros.length > 0 && (
          <span className="text-right">Outras {outros.length} candidaturas<br /><b className="text-[var(--ap-txt)] font-medium">{fmtPct(pctOutros, 1)}</b></span>
        )}
      </div>
      {todos && (
        <div className="mt-3 space-y-2">
          {c.map((x) => <LinhaCandidato key={x.n} c={x} direita={<span className="tabular-nums text-[var(--ap-txt)]">{fmtPct(x.pct, 1)}</span>} />)}
        </div>
      )}
      <button onClick={() => setTodos((v) => !v)} className="mt-3 text-xs text-[var(--ap-link)] hover:underline">
        {todos ? 'Mostrar menos' : `Todos os ${c.length} candidatos`}
      </button>
    </div>
  );
}

function BlocoSenado({ r }) {
  const [todos, setTodos] = useState(false);
  if (!r?.c?.length) return <TituloBloco>Senado · duas vagas</TituloBloco>;
  const c = r.c.map(candEst);
  const vagas = r.nv || 2;
  const lista = todos ? c : c.slice(0, vagas);
  return (
    <div>
      <TituloBloco direita={<BadgeSituacao situacao={r.situacao} pct={r.pct} />}>Senado · {vagas === 2 ? 'duas vagas' : `${vagas} vaga`}</TituloBloco>
      <div className="space-y-2.5">
        {lista.map((x, i) => (
          <div key={x.n} className="flex items-center gap-2.5">
            <Avatar cand={x} tamanho={i < vagas ? 32 : 24} />
            <div className="flex-1 min-w-0">
              <div className={`leading-tight ${i < vagas ? 'text-sm font-semibold text-[var(--ap-txt)]' : 'text-sm text-[var(--ap-txt2)]'}`}>{x.nome}</div>
              <div className="text-[10px] font-semibold" style={{ color: x.cor }}>{x.sigla} {x.n}</div>
            </div>
            <span className="tabular-nums text-sm text-[var(--ap-txt)]">{fmtPct(x.pct, 1)}</span>
            {eleitoDe(x) && <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-px rounded bg-[#16a34a]/15 text-[#16a34a]">eleito</span>}
          </div>
        ))}
      </div>
      <button onClick={() => setTodos((v) => !v)} className="mt-3 text-xs text-[var(--ap-link)] hover:underline">
        {todos ? 'Mostrar menos' : `Todos os ${c.length} candidatos`}
      </button>
    </div>
  );
}

function BlocoPresidente({ uf, dados, mapaPres }) {
  const [todos, setTodos] = useState(false);
  const rank = rankingDe(dados, Object.values(mapaPres)).filter((r) => r.votos > 0);
  if (!rank.length) return null;
  return (
    <div>
      <TituloBloco>Presidente {preposicao(uf)} {UF_NOME[uf]}</TituloBloco>
      <div className="space-y-2">
        {(todos ? rank : rank.slice(0, 3)).map((r) => (
          <LinhaCandidato key={r.cand.numero} c={{ ...r.cand, sigla: `${r.cand.partido} ${r.cand.numero}` }} direita={<span className="tabular-nums text-[var(--ap-txt)]">{fmtPct(r.pct, 1)}</span>} />
        ))}
      </div>
      {rank.length > 3 && (
        <button onClick={() => setTodos((v) => !v)} className="mt-3 text-xs text-[var(--ap-link)] hover:underline">
          {todos ? 'Mostrar menos' : `Todos os ${rank.length} candidatos`}
        </button>
      )}
    </div>
  );
}

// "na Bahia", "no Ceará", "em São Paulo"…
const PREP = {
  AC: 'no', AL: 'em', AM: 'no', AP: 'no', BA: 'na', CE: 'no', DF: 'no', ES: 'no', GO: 'em', MA: 'no',
  MG: 'em', MS: 'em', MT: 'em', PA: 'no', PB: 'na', PE: 'em', PI: 'no', PR: 'no', RJ: 'no', RN: 'no',
  RO: 'em', RR: 'em', RS: 'no', SC: 'em', SE: 'em', SP: 'em', TO: 'no',
};
const preposicao = (uf) => PREP[uf] || 'em';

function BlocoDeputados({ uf, est, detalhe, casa, setCasa }) {
  const [qtd, setQtd] = useState(10);
  useEffect(() => setQtd(10), [uf, casa]);
  const k = CHAVE_CASA[casa];
  const r = est[k]?.[uf];
  if (!r) return <TituloBloco>Deputados</TituloBloco>;
  const completa = detalhe?.[k]?.c;
  const lista = qtd > 10 && completa ? completa : r.top;
  const partidos = Object.entries(r.partidos || {}).sort((a, b) => b[1] - a[1]);
  const titulo = casa === 'federal' ? 'Deputados federais' : uf === 'DF' ? 'Deputados distritais' : 'Deputados estaduais';
  return (
    <div>
      <div className="mb-3"><AbasCasa casa={casa} setCasa={setCasa} /></div>
      <TituloBloco direita={<span className="text-[11px] text-[var(--ap-mudo)] tabular-nums">{fmtPct(r.pct, r.pct >= 100 ? 0 : 1)}</span>}>
        {titulo} · {r.nv} vagas
      </TituloBloco>
      <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] text-[var(--ap-mudo)] tabular-nums mb-2">
        {partidos.map(([sg, n]) => (
          <span key={sg} className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: corPartido(sg) }} />{nomePartido(sg)} <b className="text-[var(--ap-txt)]">{n}</b></span>
        ))}
      </div>
      <p className="text-[11px] text-[var(--ap-mudo2)] mb-3 tabular-nums">{r.eleitos} de {r.nv} eleitos</p>
      <ListaDeputados lista={lista.slice(0, qtd)} />
      {qtd < r.ncand && (
        <button
          onClick={() => setQtd((q) => (q <= 10 ? 60 : q + 50))}
          disabled={qtd > 10 && !completa}
          className="mt-3 w-full text-sm py-2 rounded-lg bg-[var(--ap-elev)] border border-[var(--ap-borda2)] text-[var(--ap-txt2)] hover:text-[var(--ap-forte)] disabled:opacity-50"
        >
          {qtd <= 10 ? `Ver todos os ${fmtInt(r.ncand)} candidatos` : !completa ? 'Carregando…' : 'Mostrar mais'}
        </button>
      )}
    </div>
  );
}
