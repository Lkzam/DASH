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
 *   COLETOR_MUN_INTERVALO_MS  30000   (ciclo dos municípios)
 *   COLETOR_CONCORRENCIA      6       (downloads simultâneos; o TSE limita rajadas)
 *   TSE_ELEICAO_ESTADUAL      6259    (Governador/Senado/Deputados, 1º turno)
 *   TSE_ELEICAO_GOV           6259    (no 2º turno de governador: 6260)
 *   COLETOR_EST_INTERVALO_MS  20000   (ciclo estadual)
 *
 * Arquivos publicados em FEED_DIR:
 *   agora.json               resultado nacional + por UF (seq/gerado)
 *   historico.json           pontos para o gráfico "Ao longo da apuração"
 *   candidatos.json          cadastro (nome, partido, cor, foto)
 *   fotos/<número>.jpeg      fotos oficiais dos candidatos
 *   municipios-info.json     código IBGE → [nome, UF, capital]
 *   municipios-resumo.json   código IBGE → [% seções, 1º, votos, 2º, votos, total]
 *   municipios/<UF>.json     resultado completo dos municípios da UF
 *   estadual.json            Governador, Senado e Deputados por UF (resumo)
 *   estadual/<UF>.json       todos os candidatos da UF, por cargo
 *   fotos-e/<sqcand>.jpeg    fotos dos candidatos estaduais exibidas na tela
 */
import { writeFile, rename, mkdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { corPartido } from '../src/components/apuracao/partidos.js';

const BASE = process.env.TSE_BASE || 'https://resultados.tse.jus.br/oficial';
const CICLO = process.env.TSE_CICLO || 'ele2026';
const ELEICAO = process.env.TSE_ELEICAO || '6257';
const TURNO = Number(process.env.TSE_TURNO || 1);
const FEED = path.resolve(process.env.FEED_DIR || 'public/feed');
const INTERVALO = Number(process.env.COLETOR_INTERVALO_MS || 10_000);
const DATA_2T = process.env.DATA_2T || '25 de outubro';
const UMA_VEZ = process.argv.includes('--uma-vez');
const MUN_INTERVALO = Number(process.env.COLETOR_MUN_INTERVALO_MS || 30_000);
const CONCORRENCIA = Number(process.env.COLETOR_CONCORRENCIA || 6);

const E6 = String(ELEICAO).padStart(6, '0');
const UFS = ['ac','al','am','ap','ba','ce','df','es','go','ma','mg','ms','mt','pa','pb','pe',
  'pi','pr','rj','rn','ro','rr','rs','sc','se','sp','to','zz'];

// Eleição estadual (Governador, Senado, Deputados). No 2º turno, só o arquivo de
// Governador muda de eleição (TSE_ELEICAO_GOV); Senado e Deputados ficam no 1º.
const ELEICAO_EST = process.env.TSE_ELEICAO_ESTADUAL || '6259';
const ELEICAO_GOV = process.env.TSE_ELEICAO_GOV || ELEICAO_EST;
const EST_INTERVALO = Number(process.env.COLETOR_EST_INTERVALO_MS || 20_000);

const urlUnidade = (uf) => `${BASE}/${CICLO}/${ELEICAO}/dados/${uf}/${uf}-c0001-e${E6}-u.json`;
const urlFoto = (sq) => `${BASE}/${CICLO}/${ELEICAO}/fotos/br/${sq}.jpeg`;
const urlAbrangencia = (uf) => `${BASE}/${CICLO}/${ELEICAO}/dados/${uf}/${uf}-e${E6}-ab.json`;
const urlMunicipio = (uf, tse) => `${BASE}/${CICLO}/${ELEICAO}/dados/${uf}/${uf}${tse}-c0001-e${E6}-u.json`;
const urlConfigMun = () => `${BASE}/${CICLO}/${ELEICAO}/config/mun-e${E6}-cm.json`;

// ── HTTP com ETag (If-None-Match) ───────────────────────────────────────────
const cacheHttp = new Map(); // url → { etag, json }
// Freio global: se o TSE responder 429/503, ninguém busca nada até `pausaAte`.
let pausaAte = 0;
const pausado = () => Date.now() < pausaAte;
async function buscarJSON(url) {
  if (pausado()) throw new Error('pausa (limite do TSE)');
  const prev = cacheHttp.get(url);
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, {
      headers: prev?.etag ? { 'If-None-Match': prev.etag } : {},
      signal: ctrl.signal,
    });
    if (res.status === 304 && prev) return prev.json;
    if (res.status === 429 || res.status === 503) {
      const ra = Number(res.headers.get('retry-after'));
      const ms = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 60_000;
      if (!pausado()) console.warn(`[coletor] TSE pediu pausa (HTTP ${res.status}) — aguardando ${Math.round(ms / 1000)}s`);
      pausaAte = Math.max(pausaAte, Date.now() + ms);
      throw new Error(`HTTP ${res.status}`);
    }
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

// Siglas (ACM, JHC) ficam em maiúsculas; o resto vira "Título".
const SIGLAS_NOME = new Set(['ACM', 'JHC', 'JK', 'PH', 'II', 'III']);
const tituloCase = (s) => String(s || '').split(/\s+/).filter(Boolean).map((w) => {
  if (SIGLAS_NOME.has(w.toUpperCase())) return w.toUpperCase();
  const l = w.toLowerCase();
  if (/^(de|da|do|das|dos|e)$/.test(l)) return l;
  return l.charAt(0).toUpperCase() + l.slice(1);
}).join(' ');

// ── Escrita atômica ─────────────────────────────────────────────────────────
async function gravarAtomico(arquivo, dados) {
  const destino = path.join(FEED, arquivo);
  await mkdir(path.dirname(destino), { recursive: true });
  const tmp = `${destino}.${process.pid}.tmp`;
  await writeFile(tmp, typeof dados === 'string' ? dados : JSON.stringify(dados));
  await rename(tmp, destino);
}
const existe = (p) => access(p).then(() => true, () => false);

/** Baixa um arquivo binário (foto) se ainda não existe. true = disponível. */
async function baixarArquivo(url, destino) {
  if (await existe(destino)) return true;
  try {
    if (pausado()) return false;
    const res = await fetch(url);
    if (res.status === 429) { pausaAte = Math.max(pausaAte, Date.now() + 60_000); return false; }
    if (!res.ok) return false;
    await mkdir(path.dirname(destino), { recursive: true });
    const tmp = `${destino}.${process.pid}.tmp`;
    await writeFile(tmp, Buffer.from(await res.arrayBuffer()));
    await rename(tmp, destino);
    return true;
  } catch { return false; /* sem foto: o front cai nas iniciais */ }
}
const baixarFoto = (numero, sqcand) => baixarArquivo(urlFoto(sqcand), path.join(FEED, 'fotos', `${numero}.jpeg`));

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
  // seq continua de onde parou: o front ignora snapshots com seq menor.
  try { seqEst = JSON.parse(await readFile(path.join(FEED, 'estadual.json'), 'utf8')).seq || 0; } catch { /* ok */ }
  try { seqMun = JSON.parse(await readFile(path.join(FEED, 'municipios-resumo.json'), 'utf8')).seq || 0; } catch { /* ok */ }
  // Último resultado de cada município: se o TSE falhar para alguns no próximo
  // ciclo, o resumo publicado continua completo (não "some" cidade do mapa).
  for (const uf of UFS) {
    try {
      const d = JSON.parse(await readFile(path.join(FEED, 'municipios', `${uf.toUpperCase()}.json`), 'utf8'));
      for (const [ibge, r] of Object.entries(d.m || {})) resultadoMun.set(ibge, { ...r, uf: uf.toUpperCase() });
    } catch { /* UF ainda não publicada */ }
  }
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
        cor: corPartido(c.sg), foto: `/feed/fotos/${c.n}.jpeg`, situacao: c.st,
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

// ── Municípios ──────────────────────────────────────────────────────────────
// O TSE usa códigos de município próprios; a config da eleição traz a
// correspondência TSE ↔ IBGE (o mapa usa o código IBGE).
const infoMun = new Map();      // "ba|30007" → { ibge, nome, uf, capital }
const assinaturaMun = new Map(); // "ba|30007" → "<seções totalizadas>|<hora>"
const resultadoMun = new Map();  // ibge → resultado normalizado (+ uf)
let seqMun = 0;

async function carregarConfigMun() {
  const cfg = await buscarJSON(urlConfigMun());
  const info = {};
  for (const u of cfg.abr ?? []) {
    const uf = String(u.cd).toLowerCase();
    if (uf === 'zz') continue; // exterior: cidades estrangeiras, sem malha
    for (const m of u.mu ?? []) {
      const reg = { ibge: String(m.cdi), nome: tituloCase(m.nm), uf: uf.toUpperCase(), capital: m.c === 's' };
      infoMun.set(`${uf}|${m.cd}`, reg);
      info[reg.ibge] = [reg.nome, reg.uf, reg.capital ? 1 : 0];
    }
  }
  await gravarAtomico('municipios-info.json', { versao: 1, m: info });
  console.log(`[coletor] config municipal: ${infoMun.size} municípios`);
}

/** Executa `tarefas` (funções async) com no máximo `n` simultâneas. */
async function emLotes(tarefas, n) {
  let i = 0;
  // Para de pegar tarefas novas se o TSE pediu pausa; o resto fica para o próximo ciclo.
  const trabalhador = async () => { while (i < tarefas.length && !pausado()) { const t = tarefas[i++]; await t(); } };
  await Promise.all(Array.from({ length: Math.min(n, tarefas.length) }, trabalhador));
}

async function cicloMunicipal() {
  const t0 = Date.now();
  const fila = [];
  const ufsMudaram = new Set();

  // 1) Abrangência de cada UF: diz quais municípios mudaram desde o último ciclo.
  await Promise.all(UFS.filter((u) => u !== 'zz').map(async (uf) => {
    let ab;
    try { ab = await buscarJSON(urlAbrangencia(uf)); } catch { return; }
    for (const m of ab.abr ?? []) {
      if (m.tpabr !== 'mun') continue;
      const chave = `${uf}|${m.cdabr}`;
      const sig = `${m.s?.st}|${m.ht}`;
      if (assinaturaMun.get(chave) !== sig && infoMun.has(chave)) fila.push({ uf, tse: m.cdabr, chave, sig });
    }
  }));
  if (fila.length === 0) { console.log(`[coletor] municípios: sem mudança (${Date.now() - t0}ms)`); return; }

  // 2) Baixa só os municípios que mudaram.
  let ok = 0, falhas = 0;
  await emLotes(fila.map((item) => async () => {
    try {
      const r = normalizar(await buscarJSON(urlMunicipio(item.uf, item.tse)));
      const info = infoMun.get(item.chave);
      resultadoMun.set(info.ibge, { ...r, uf: info.uf });
      assinaturaMun.set(item.chave, item.sig);
      ufsMudaram.add(info.uf);
      if (++ok % 500 === 0) console.log(`[coletor] municípios: ${ok}/${fila.length}…`);
    } catch { falhas++; /* tenta de novo no próximo ciclo */ }
  }), CONCORRENCIA);
  if (!ok) { console.log(`[coletor] municípios: nada atualizado (${falhas} falhas) — tenta no próximo ciclo`); return; }

  // 3) Publica: arquivo completo por UF (painel da cidade) + resumo nacional (mapa).
  const gerado = Date.now();
  for (const uf of ufsMudaram) {
    const m = {};
    for (const [ibge, r] of resultadoMun) if (r.uf === uf) { const { uf: _u, ...resto } = r; m[ibge] = resto; }
    await gravarAtomico(`municipios/${uf}.json`, { versao: 1, gerado, uf, m });
  }
  const resumo = {};
  for (const [ibge, r] of resultadoMun) {
    const ord = Object.entries(r.votos).sort((a, b) => b[1] - a[1]);
    const total = ord.reduce((s, [, v]) => s + v, 0);
    const pct = r.secoes ? Math.round((r.totalizadas / r.secoes) * 1000) / 10 : 0;
    resumo[ibge] = [pct, ord[0]?.[0] ?? '', ord[0]?.[1] ?? 0, ord[1]?.[0] ?? '', ord[1]?.[1] ?? 0, total];
  }
  seqMun += 1;
  await gravarAtomico('municipios-resumo.json', { versao: 1, seq: seqMun, gerado, m: resumo });
  console.log(`[coletor] municípios publicados: ${ok} atualizados, ${falhas} falhas, ${ufsMudaram.size} UFs · ${Date.now() - t0}ms`);
}

// ── Estadual: Governador, Senado, Deputados federais e estaduais ────────────
const CARGOS_EST = [
  { id: 'gov', cd: 3 }, { id: 'sen', cd: 5 }, { id: 'depf', cd: 6 }, { id: 'depe', cd: 7 },
];
const UFS_EST = UFS.filter((u) => u !== 'zz');
const pad = (n, w) => String(n).padStart(w, '0');
const urlCargo = (ele, uf, cd) => `${BASE}/${CICLO}/${ele}/dados/${uf}/${uf}-c${pad(cd, 4)}-e${pad(ele, 6)}-u.json`;
const urlFotoEst = (uf, sq) => `${BASE}/${CICLO}/${ELEICAO_EST}/fotos/${uf}/${sq}.jpeg`;
const decimal = (x) => Number(String(x ?? '0').replace(/\./g, '').replace(',', '.')) || 0;

/** "05/10/2026" + "00:50:30" (horário de Brasília) → epoch ms. */
function quandoDe(u) {
  const m = String(u?.dt || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m || !u?.ht) return null;
  const t = Date.parse(`${m[3]}-${m[2]}-${m[1]}T${u.ht}-03:00`);
  return Number.isFinite(t) ? t : null;
}

function normalizarCargo(u) {
  const carg = u?.carg?.[0] ?? {};
  const cands = [];
  for (const a of carg.agr ?? []) for (const p of a.par ?? []) for (const c of p.cand ?? []) {
    cands.push({
      n: String(c.n), nome: tituloCase(c.nmu || c.nm), partido: p.sg, sq: String(c.sqcand),
      vap: int(c.vap), pct: decimal(c.pvapn ?? c.pvap), st: c.st || '', e: c.e === 's',
    });
  }
  cands.sort((a, b) => b.vap - a.vap);
  const secoes = int(u?.s?.ts), totalizadas = int(u?.s?.st);
  return {
    secoes, totalizadas,
    pct: secoes ? Math.round((totalizadas / secoes) * 1000) / 10 : 0,
    eleitorado: int(u?.e?.te), comparecimento: int(u?.e?.c),
    brancos: int(u?.v?.vb), nulos: int(u?.v?.tvn), validos: int(u?.v?.vv),
    nv: int(carg.nv) || 1, quando: quandoDe(u), cands,
  };
}

function situacaoMajoritaria(r) {
  if (!r.totalizadas) return 'aguardando';
  if (r.cands.filter((c) => /^eleit/i.test(c.st)).length >= r.nv) return 'eleito';
  if (r.cands.some((c) => /2º turno/i.test(c.st))) return 'segundo-turno';
  return 'apurando';
}

const estUF = new Map();            // UF → { gov, sen, depf, depe } normalizados
const assinaturaUFEst = new Map();  // UF → assinatura do arquivo estadual/<UF>.json
const fotosEst = new Set();         // sqcand com foto disponível em fotos-e/
let seqEst = 0;
let assinaturaEst = '';

async function buscarCargoUF(uf, cargo) {
  const cd = cargo.id === 'depe' && uf === 'df' ? 8 : cargo.cd; // DF elege deputado distrital
  if (cargo.id === 'gov' && ELEICAO_GOV !== ELEICAO_EST) {
    try { return normalizarCargo(await buscarJSON(urlCargo(ELEICAO_GOV, uf, cd))); } catch { /* UF sem 2º turno */ }
  }
  return normalizarCargo(await buscarJSON(urlCargo(ELEICAO_EST, uf, cd)));
}

async function cicloEstadual() {
  const t0 = Date.now();
  let falhas = 0;
  await emLotes(UFS_EST.flatMap((uf) => CARGOS_EST.map((cargo) => async () => {
    try {
      const r = await buscarCargoUF(uf, cargo);
      const U = uf.toUpperCase();
      estUF.set(U, { ...estUF.get(U), [cargo.id]: r });
    } catch { falhas++; /* mantém o último resultado da UF */ }
  })), CONCORRENCIA);
  if (!estUF.size) { console.warn('[coletor] estadual: TSE indisponível'); return; }

  // Fotos só de quem aparece na tela: todos de Governador/Senado; eleitos e
  // top 10 de cada UF para Deputados; top 50 do Brasil.
  const fotos = new Map(); // sqcand → uf
  const rankBR = { depf: [], depe: [] };
  for (const [U, d] of estUF) {
    for (const c of [...(d.gov?.cands ?? []), ...(d.sen?.cands ?? [])]) fotos.set(c.sq, U.toLowerCase());
    for (const k of ['depf', 'depe']) {
      (d[k]?.cands ?? []).forEach((c, i) => { if (c.e || i < 10) fotos.set(c.sq, U.toLowerCase()); });
      for (const c of (d[k]?.cands ?? []).slice(0, 50)) rankBR[k].push({ ...c, uf: U });
    }
  }
  for (const k of ['depf', 'depe']) {
    rankBR[k] = rankBR[k].sort((a, b) => b.vap - a.vap).slice(0, 50);
    for (const c of rankBR[k]) fotos.set(c.sq, c.uf.toLowerCase());
  }
  const novas = [...fotos].filter(([sq]) => !fotosEst.has(sq));
  await emLotes(novas.map(([sq, uf]) => async () => {
    if (await baixarArquivo(urlFotoEst(uf, sq), path.join(FEED, 'fotos-e', `${sq}.jpeg`))) fotosEst.add(sq);
  }), CONCORRENCIA);

  const saida = (c) => ({
    n: c.n, nome: c.nome, partido: c.partido, vap: c.vap, pct: c.pct, st: c.st, e: c.e,
    ...(c.uf ? { uf: c.uf } : {}),
    ...(fotosEst.has(c.sq) ? { foto: `/feed/fotos-e/${c.sq}.jpeg` } : {}),
  });
  const majoritaria = (r) => r && {
    pct: r.pct, situacao: situacaoMajoritaria(r), quando: r.quando, eleitorado: r.eleitorado,
    nv: r.nv, c: r.cands.map(saida),
  };
  const proporcional = (r) => {
    if (!r) return null;
    const partidos = {};
    for (const c of r.cands) if (c.e) partidos[c.partido] = (partidos[c.partido] || 0) + 1;
    return {
      pct: r.pct, nv: r.nv, eleitos: r.cands.filter((c) => c.e).length, ncand: r.cands.length,
      partidos, top: r.cands.slice(0, 10).map(saida),
    };
  };

  // Resumo nacional (mapa + colunas) — só publica se algo mudou.
  const corpo = { gov: {}, sen: {}, depf: {}, depe: {}, topBR: { depf: rankBR.depf.map(saida), depe: rankBR.depe.map(saida) } };
  for (const [U, d] of estUF) {
    corpo.gov[U] = majoritaria(d.gov);
    corpo.sen[U] = majoritaria(d.sen);
    corpo.depf[U] = proporcional(d.depf);
    corpo.depe[U] = proporcional(d.depe);
  }
  const assinatura = JSON.stringify(corpo);
  let publicou = 0;
  if (assinatura !== assinaturaEst) {
    seqEst += 1;
    await gravarAtomico('estadual.json', { versao: 1, seq: seqEst, gerado: Date.now(), eleicao: ELEICAO_EST, ...corpo });
    assinaturaEst = assinatura;
    publicou++;
  }

  // Lista completa de candidatos por UF (painel do estado, "Ver todos").
  for (const [U, d] of estUF) {
    const det = {
      gov: d.gov?.cands.map(saida) ?? [],
      sen: d.sen?.cands.map(saida) ?? [],
      depf: d.depf ? { nv: d.depf.nv, c: d.depf.cands.map(saida) } : null,
      depe: d.depe ? { nv: d.depe.nv, c: d.depe.cands.map(saida) } : null,
    };
    const sig = JSON.stringify(det);
    if (assinaturaUFEst.get(U) === sig) continue;
    await gravarAtomico(`estadual/${U}.json`, { versao: 1, uf: U, ...det });
    assinaturaUFEst.set(U, sig);
    publicou++;
  }
  console.log(`[coletor] estadual: ${publicou ? `publicado seq=${seqEst}` : 'sem mudança'} · ${novas.length} fotos novas · ${falhas} falhas · ${Date.now() - t0}ms`);
}

async function main() {
  await mkdir(FEED, { recursive: true });
  await carregarEstado();
  console.log(`[coletor] ${CICLO}/${ELEICAO} turno ${TURNO} → ${FEED}`);
  try { await carregarConfigMun(); } catch (e) { console.warn('[coletor] config municipal indisponível:', e.message); }

  if (UMA_VEZ) {
    await ciclo();
    await cicloEstadual();
    if (infoMun.size) await cicloMunicipal();
    return;
  }
  const loopEst = async () => {
    try { await cicloEstadual(); } catch (e) { console.error('[coletor] erro no ciclo estadual:', e); }
    setTimeout(loopEst, EST_INTERVALO);
  };
  loopEst();
  const loop = async () => {
    try { await ciclo(); } catch (e) { console.error('[coletor] erro no ciclo:', e); }
    setTimeout(loop, INTERVALO);
  };
  const loopMun = async () => {
    try {
      if (!infoMun.size) await carregarConfigMun();
      await cicloMunicipal();
    } catch (e) { console.error('[coletor] erro no ciclo municipal:', e); }
    setTimeout(loopMun, MUN_INTERVALO);
  };
  loop();
  loopMun();
}

main();
