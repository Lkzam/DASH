import { useState } from 'react';
import { SERIF } from './tema.js';
import { fmtPct, horaBR } from './formato.js';
import { corPartido, nomePartido } from './partidos.js';

/** Foto do candidato com borda na cor do partido; cai nas iniciais se a foto falhar. */
export function Avatar({ cand, tamanho = 36, anel = true }) {
  const [falhou, setFalhou] = useState(false);
  if (!cand) return null;
  const ini = String(cand.nome || '?').split(' ').map((p) => p[0]).slice(0, 2).join('');
  const estilo = { width: tamanho, height: tamanho, borderColor: cand.cor };
  if (cand.foto && !falhou) {
    return (
      <img
        src={cand.foto}
        alt={cand.nome}
        loading="lazy"
        onError={() => setFalhou(true)}
        style={estilo}
        className={`rounded-full object-cover shrink-0 bg-[var(--ap-elev2)] ${anel ? 'border-2' : ''}`}
      />
    );
  }
  return (
    <div
      style={{ ...estilo, background: cand.cor, fontSize: tamanho * 0.34 }}
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
    >
      {ini}
    </div>
  );
}

/** Candidato estadual (formato do coletor) → formato que os componentes usam. */
export function candEst(c) {
  if (!c) return null;
  return { ...c, numero: c.n, cor: corPartido(c.partido), sigla: nomePartido(c.partido) };
}

export const eleitoDe = (c) => /^eleit/i.test(c?.st || '');

export const BOTAO_ICONE =
  'w-7 h-7 rounded-md bg-[var(--ap-elev)] border border-[var(--ap-borda2)] text-[var(--ap-txt2)] hover:text-[var(--ap-forte)] hover:bg-[var(--ap-elev2)] leading-none';

export const CAIXA = 'rounded-xl border border-[var(--ap-borda)] bg-[var(--ap-painel)]';

/** Sigla da UF num quadradinho; `cores` com 2 itens divide na diagonal (Senado). */
export function ChipUF({ uf, cores = [], claro = false, onClick, ativo, largura = 34 }) {
  const [c1, c2] = cores;
  const fundo = !c1 ? 'var(--ap-elev2)' : c2 ? `linear-gradient(135deg, ${c1} 50%, ${c2} 50%)` : c1;
  return (
    <button
      type="button"
      onClick={onClick}
      title={uf}
      style={{ background: fundo, width: largura, opacity: claro ? 0.55 : 1 }}
      className={`h-6 rounded-[5px] text-[10px] font-bold text-white tracking-wide shadow-sm hover:brightness-110 ${ativo ? 'ring-2 ring-[var(--ap-forte)]' : ''}`}
    >
      <span style={{ textShadow: '0 1px 2px rgba(0,0,0,.5)' }}>{uf}</span>
    </button>
  );
}

export function Paginador({ pagina, total, setPagina }) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center gap-2 text-[11px] text-[var(--ap-mudo)] tabular-nums">
      <button onClick={() => setPagina((p) => (p - 1 + total) % total)} className="px-1 hover:text-[var(--ap-forte)]" aria-label="Anterior">‹</button>
      {pagina + 1}/{total}
      <button onClick={() => setPagina((p) => (p + 1) % total)} className="px-1 hover:text-[var(--ap-forte)]" aria-label="Próxima">›</button>
    </div>
  );
}

export function BadgeSituacao({ situacao, pct }) {
  const mapa = {
    eleito: ['Eleito', 'bg-[#16a34a]/15 text-[#16a34a]'],
    'segundo-turno': ['2º turno', 'bg-[var(--ap-aviso-bg)] text-[var(--ap-aviso)]'],
    apurando: [`Apurando ${fmtPct(pct ?? 0, 0)}`, 'bg-[var(--ap-elev2)] text-[var(--ap-mudo)]'],
    aguardando: ['Aguardando', 'bg-[var(--ap-elev2)] text-[var(--ap-mudo)]'],
  };
  const [txt, cls] = mapa[situacao] || mapa.aguardando;
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>{txt}</span>;
}

export function Numero({ rotulo, valor, sub }) {
  return (
    <div>
      <div className="text-[11px] text-[var(--ap-mudo2)]">{rotulo}</div>
      <div className="tabular-nums text-[var(--ap-txt)] font-medium">
        {valor} {sub && <span className="text-[11px] text-[var(--ap-mudo2)] font-normal">· {sub}</span>}
      </div>
    </div>
  );
}

/** "Últimas atualizações": eventos de todas as abas, mais novo primeiro. */
export function Feed({ feed }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--ap-txt2)] mb-2">Últimas atualizações</h3>
      {feed.length === 0 ? (
        <p className="text-xs text-[var(--ap-mudo2)]">Os eventos aparecem aqui conforme a apuração avança.</p>
      ) : (
        <ul className="divide-y divide-[var(--ap-borda)]">
          {feed.map((e) => (
            <li key={e.id} className="flex gap-2.5 py-2.5 text-sm">
              <span className="text-[10px] text-[var(--ap-mudo2)] tabular-nums pt-1 w-9 shrink-0">{horaBR(e.t).slice(0, 5).replace(':', 'h')}</span>
              {e.cands?.length ? (
                <span className="flex -space-x-2 shrink-0 pt-0.5">
                  {e.cands.slice(0, 2).map((c, i) => <Avatar key={i} cand={c} tamanho={22} />)}
                </span>
              ) : (
                <span className="w-[22px] h-[22px] mt-0.5 rounded-full border-2 border-[var(--ap-mudo3)] shrink-0" />
              )}
              <span className="text-[var(--ap-txt2)] leading-snug">{e.texto}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function StatusAoVivo({ status, pctSecoes, sim }) {
  const reconect = status.estado === 'reconectando' || status.estado === 'conectando';
  return (
    <div className="flex items-center gap-2 text-xs">
      {sim && <span className="px-2 py-0.5 rounded-full bg-[var(--ap-aviso-bg)] text-[var(--ap-aviso)] font-semibold">Simulação</span>}
      <span className={`w-2 h-2 rounded-full ${reconect ? 'bg-[#E0A000]' : 'bg-[#22c55e] animate-pulse'}`} />
      {reconect ? (
        <span className="text-[var(--ap-aviso)]">{status.estado === 'conectando' ? 'Conectando…' : 'Reconectando…'}</span>
      ) : (
        <span className="text-[var(--ap-mudo)] tabular-nums">
          Atualizado às {horaBR(status.gerado)} · {fmtPct(pctSecoes, pctSecoes >= 100 ? 0 : 2)} das seções
        </span>
      )}
    </div>
  );
}

export function TelaCarregando() {
  return (
    <div className="min-h-full p-6 bg-[var(--ap-bg)] text-[var(--ap-txt)]">
      <div className="animate-pulse space-y-4">
        <div className="h-7 w-48 bg-[var(--ap-elev2)] rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="h-80 bg-[var(--ap-painel)] rounded-xl" />
          <div className="h-80 bg-[var(--ap-painel)] rounded-xl" />
          <div className="h-80 bg-[var(--ap-painel)] rounded-xl" />
        </div>
      </div>
      <p className="text-sm text-[var(--ap-mudo2)] mt-4">Carregando apuração…</p>
    </div>
  );
}

export function SemFeed() {
  return (
    <div className="min-h-full p-10 bg-[var(--ap-bg)] text-[var(--ap-txt)]">
      <h2 style={SERIF} className="text-2xl font-semibold">Aguardando os resultados</h2>
      <p className="text-sm text-[var(--ap-mudo)] mt-2 max-w-xl">
        O painel ainda não recebeu dados da apuração. Assim que o coletor publicar o primeiro resultado do TSE,
        esta tela atualiza sozinha.
      </p>
      <p className="text-xs text-[var(--ap-mudo2)] mt-4">
        Para ver uma demonstração agora, abra com <code className="text-[var(--ap-txt2)]">?sim=1</code> no endereço.
      </p>
    </div>
  );
}
