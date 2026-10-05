/**
 * Coletor da Apuração — TSE → normaliza → /feed/*.json
 *
 * Roda FORA do navegador (sua máquina em dev, processo PM2 no VPS em produção).
 * A cada ciclo baixa os JSON públicos de divulgação do TSE (BR + 27 UFs +
 * Exterior), normaliza, e SÓ quando algo mudou publica novos arquivos com `seq`
 * incrementado. Escrita atômica (temporário + rename). Se o TSE falhar, mantém o
 * último snapshot válido. Usa ETag/If-None-Match para não rebaixar o que não mudou.
 *
 * Uso:
 *   node collector/coletor.mjs              # loop contínuo (padrão a cada 10s)
 *   node collector/coletor.mjs --uma-vez    # um ciclo e sai (teste)
 *
 * Variáveis de ambiente (todas opcionais — padrão = 1º turno de 2026):
 *   TSE_BASE      https://resultados.tse.jus.br/oficial
 *   TSE_CICLO     ele2026
 *   TSE_ELEICAO   6257   (1º turno Presidente · 2º turno = 6258)
 *   TSE_TURNO     1
 *   FEED_DIR      ./public/feed   (produção: /var/www/opinai/feed)
 *   COLETOR_INTERVALO_MS  10000
 *   DATA_2T       "25 de outubro"
 */
import { writeFile, rename, mkdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.TSE_BASE || 'https://resultados.tse.jus.br/oficial';
const CICLO = process.env.TSE_CICLO || 'ele2026';
const ELEICAO = process.env.TSE_ELEICAO || '6257';
const TURNO = Number(process.env.TSE_TURNO || 1);
const FEED = path.resolve(process.env.FEED_DIR || 'public/feed');
const INTERVALO = Number(process.env.COLETOR_INTERVALO_MS || 10_000);
const DATA_2T = process.env.DATA_2T || '25 de outubro';
const UMA_VEZ = process.argv.includes('--uma-vez');

const E6 = String(ELEICAO).padStart(6, '0');
const UFS = ['ac','al','am','ap','ba','ce','df','es','go','ma','mg','ms','mt','pa','pb','pe',
  'pi','pr','rj','rn','ro','rr','rs','sc','se','sp','to','zz'];

// Cores por partido (tokens). Partido sem cor cai no neutro.
const COR_PARTIDO = {
  PT: '#E13223', PL: '#1B3A8B', AVANTE: '#E0900B', 'MISSÃO': '#7C3AED', PSD: '#0E9F6E',
  NOVO: '#F97316', UP: '#B4232A', PSTU: '#8B1A1A', DC: '#0EA5E9', PCB: '#C2410C',
  DEMOCRATA: '#2563EB', PCO: '#6B1D1D', MDB: '#2E9E5B', PSDB: '#1E66D0', PSB: '#E0900B',
  PDT: '#13A3B8', PSOL: '#C9227A', REDE: '#16A34A', PP: '#3B82F6', UNIÃO: '#0B4BA8',
  REPUBLICANOS: '#1D4ED8', PODE: '#0F766E', SOLIDARIEDADE: '#EA580C', CIDADANIA: '#DB2777',
};
const COR_NEUTRA = '#4B5563';

const urlUnidade = (uf) => `${BASE}/${CICLO}/${ELEICAO}/dados/${uf}/${uf}-c0001-e${E6}-u.json`;
const urlFoto = (sq) => `${BASE}/${CICLO}/${ELEICAO}/fotos/br/${sq}.jpeg`;

// ── HTTP com ETag (If-None-Match) ───────────────────────────────────────────
const cacheHttp = new Map(); // url → { etag, json }
async function buscarJSON(url) {
  const prev = cacheHttp.get(url);
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, {
      headers: prev?.etag ? { 'If-None-Match': prev.etag } : {},
      signal: ctrl.signal,
    });
    if (res.status === 304 && prev) return prev.json;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    cacheHttp.set(url, { etag: res.headers.get('etag'), json });
    return json;
  } finally {
    clearTimeout(to);
  }
}

// ── Normalização ────────────────────────────────────────────────────────────
const int = (x) => Number(String(x ?? '0').replace(/\D/g, '')) || 0;

function candidatosDe(u) {
  const out = [];
  for (const a of u?.carg?.[0]?.agr ?? []) for (const p of a.par ?? []) for (const c of p.cand ?? [])
    out.push({ n: String(c.n), nmu: c.nmu || c.nm, sg: p.sg, sqcand: c.sqcand, st: c.st || '', vap: int(c.vap) });
  return out;
}

function situacaoDe(tot, sec, cands) {
  if (!sec || tot === 0) return 'aguardando';
  if (cands.some((c) => /^eleito/i.test(c.st))) return 'eleito';
  if (cands.some((c) => /2º turno/i.test(c.st))) return 'segundo-turno';
  return 'apurando';
}

function normalizar(u) {
  const cands = candidatosDe(u);
  const votos = {};
  for (const c of cands) votos[c.n] = c.vap;
  const secoes = int(u?.s?.ts), totalizadas = int(u?.s?.st);
  return {
    secoes, totalizadas,
    eleitorado: int(u?.e?.te),
    comparecimento: int(u?.e?.c),
    brancos: int(u?.v?.vb),
    nulos: int(u?.v?.tvn),
    votos,
    situacao: situacaoDe(totalizadas, secoes, cands),
  };
}

const tituloCase = (s) => String(s || '').toLowerCase()
  .replace(/(^|\s)(\S)/g, (m, sp, ch) => sp + ch.toUpperCase())
  .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (w) => w.toLowerCase());

// ── Escrita atômica ─────────────────────────────────────────────────────────
async function gravarAtomico(arquivo, dados) {
  const destino = path.join(FEED, arquivo);
  await mkdir(path.dirname(destino), { recursive: true });
  const tmp = `${destino}.${process.pid}.tmp`;
  await writeFile(tmp, typeof dados === 'string' ? dados : JSON.stringify(dados));
  await rename(tmp, destino);
}
const existe = (p) => access(p).then(() => true, () => false);

async function baixarFoto(numero, sqcand) {
  const destino = path.join(FEED, 'fotos', `${numero}.jpeg`);
  if (await existe(destino)) return;
  try {
    const res = await fetch(urlFoto(sqcand));
    if (!res.ok) return;
    await mkdir(path.dirname(destino), { recursive: true });
    const tmp = `${destino}.${process.pid}.tmp`;
    await writeFile(tmp, Buffer.from(await res.arrayBuffer()));
    await rename(tmp, destino);
  } catch { /* sem foto: o front cai nas iniciais */ }
}

// ── Estado entre ciclos ─────────────────────────────────────────────────────
let seq = 0;
let assinaturaAnterior = '';
let ultimo = { br: null, uf: {} };
let pontos = [];
let cadastroPublicado = false;

async function carregarEstado() {
  try {
    const a = JSON.parse(await readFile(path.join(FEED, 'agora.json'), 'utf8'));
    seq = a.seq || 0;
    ultimo = { br: a.presidente?.br ?? null, uf: a.presidente?.uf ?? {} };
    assinaturaAnterior = JSON.stringify(a.presidente);
  } catch { /* primeira execução */ }
  try {
    const h = JSON.parse(await readFile(path.join(FEED, 'historico.json'), 'utf8'));
    pontos = h.pontos || [];
  } catch { /* sem histórico ainda */ }
}

async function ciclo() {
  const t0 = Date.now();
  // BR é obrigatório; sem ele não publica nada (mantém o último snapshot).
  let brBruto;
  try {
    brBruto = await buscarJSON(urlUnidade('br'));
  } catch (e) {
    console.warn(`[coletor] TSE indisponível (BR): ${e.message} — mantendo último snapshot`);
    return;
  }

  const br = normalizar(brBruto);
  const uf = { ...ultimo.uf };
  const res = await Promise.allSettled(UFS.map((s) => buscarJSON(urlUnidade(s))));
  let falhas = 0;
  res.forEach((r, i) => {
    if (r.status === 'fulfilled') uf[UFS[i].toUpperCase()] = normalizar(r.value);
    else falhas++;
  });

  // Cadastro dos candidatos (uma vez por execução) + fotos
  if (!cadastroPublicado) {
    const cands = candidatosDe(brBruto).sort((a, b) => b.vap - a.vap);
    await gravarAtomico('candidatos.json', {
      versao: 1, cargo: 'presidente', turno: TURNO, data2t: DATA_2T,
      candidatos: cands.map((c) => ({
        numero: c.n, nome: tituloCase(c.nmu), partido: c.sg,
        cor: COR_PARTIDO[c.sg] || COR_NEUTRA, foto: `/feed/fotos/${c.n}.jpeg`, situacao: c.st,
      })),
    });
    await Promise.all(cands.map((c) => baixarFoto(c.n, c.sqcand)));
    cadastroPublicado = true;
    console.log(`[coletor] cadastro: ${cands.length} candidatos + fotos`);
  }

  const presidente = { br, uf };
  const assinatura = JSON.stringify(presidente);
  if (assinatura === assinaturaAnterior) {
    console.log(`[coletor] sem mudança (${Date.now() - t0}ms, ${falhas} UF com falha)`);
    return;
  }

  seq += 1;
  const gerado = Date.now();
  await gravarAtomico('agora.json', { versao: 1, seq, gerado, turno: TURNO, presidente, recarregar: null });

  pontos.push({ t: gerado, totalizadas: br.totalizadas, secoes: br.secoes, votos: br.votos, situacao: br.situacao });
  if (pontos.length > 2000) pontos = pontos.slice(-2000);
  await gravarAtomico('historico.json', { versao: 1, seq, pontos });

  assinaturaAnterior = assinatura;
  ultimo = { br, uf };
  const pct = br.secoes ? ((br.totalizadas / br.secoes) * 100).toFixed(2) : '0';
  console.log(`[coletor] publicado seq=${seq} · ${pct}% das seções · ${br.situacao} · ${Date.now() - t0}ms`);
}

async function main() {
  await mkdir(FEED, { recursive: true });
  await carregarEstado();
  console.log(`[coletor] ${CICLO}/${ELEICAO} turno ${TURNO} → ${FEED}`);
  if (UMA_VEZ) { await ciclo(); return; }
  const loop = async () => {
    try { await ciclo(); } catch (e) { console.error('[coletor] erro no ciclo:', e); }
    setTimeout(loop, INTERVALO);
  };
  loop();
}

main();
