/**
 * Gera os assets estáticos do mapa da Apuração a partir das malhas do IBGE:
 *   public/apuracao/uf-paths.json     — paths SVG + centroide + bbox de cada UF
 *   public/apuracao/br-mun.topo.json  — TopoJSON quantizado e simplificado dos
 *                                       5.570 municípios, JÁ PROJETADO (0..1000)
 *
 * Estados e municípios usam a MESMA projeção, então as divisas encaixam.
 * Nada é baixado em runtime: o front só lê esses arquivos.
 *
 *   node scripts/build-mapa.mjs
 *
 * A malha de municípios (3,6 MB) é baixada do IBGE para scripts/.cache/ na
 * primeira vez (pasta ignorada pelo git).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { geoMercator, geoPath } from 'd3-geo';
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import { quantize } from 'topojson-client';

const UF = {
  '11': ['RO', 'Rondônia', 'Norte'], '12': ['AC', 'Acre', 'Norte'],
  '13': ['AM', 'Amazonas', 'Norte'], '14': ['RR', 'Roraima', 'Norte'],
  '15': ['PA', 'Pará', 'Norte'], '16': ['AP', 'Amapá', 'Norte'],
  '17': ['TO', 'Tocantins', 'Norte'], '21': ['MA', 'Maranhão', 'Nordeste'],
  '22': ['PI', 'Piauí', 'Nordeste'], '23': ['CE', 'Ceará', 'Nordeste'],
  '24': ['RN', 'Rio Grande do Norte', 'Nordeste'], '25': ['PB', 'Paraíba', 'Nordeste'],
  '26': ['PE', 'Pernambuco', 'Nordeste'], '27': ['AL', 'Alagoas', 'Nordeste'],
  '28': ['SE', 'Sergipe', 'Nordeste'], '29': ['BA', 'Bahia', 'Nordeste'],
  '31': ['MG', 'Minas Gerais', 'Sudeste'], '32': ['ES', 'Espírito Santo', 'Sudeste'],
  '33': ['RJ', 'Rio de Janeiro', 'Sudeste'], '35': ['SP', 'São Paulo', 'Sudeste'],
  '41': ['PR', 'Paraná', 'Sul'], '42': ['SC', 'Santa Catarina', 'Sul'],
  '43': ['RS', 'Rio Grande do Sul', 'Sul'], '50': ['MS', 'Mato Grosso do Sul', 'Centro-Oeste'],
  '51': ['MT', 'Mato Grosso', 'Centro-Oeste'], '52': ['GO', 'Goiás', 'Centro-Oeste'],
  '53': ['DF', 'Distrito Federal', 'Centro-Oeste'],
};
const W = 1000, H = 1000, PAD = 24;
const URL_MUN = 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?intrarregiao=municipio&formato=application/vnd.geo+json&qualidade=minima';

// O d3-geo trabalha na esfera e exige anel EXTERNO horário (furos anti-horário)
// — o contrário da RFC 7946, que é como o IBGE entrega. Sem reorientar, cada
// polígono vira "o planeta menos o polígono" (mapa sai como um retângulo cheio).
const area = (r) => { let s = 0; for (let i = 0; i < r.length - 1; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return s / 2; };
const rewindPoly = (rings) => rings.map((r, i) => ((i === 0 ? area(r) > 0 : area(r) < 0) ? r.slice().reverse() : r));
const rewind = (g) =>
  g.type === 'Polygon' ? { ...g, coordinates: rewindPoly(g.coordinates) }
  : g.type === 'MultiPolygon' ? { ...g, coordinates: g.coordinates.map(rewindPoly) } : g;
const rewindFC = (fc) => ({ ...fc, features: fc.features.map((f) => ({ ...f, geometry: rewind(f.geometry) })) });

const out = (p) => new URL(`../public/apuracao/${p}`, import.meta.url);
mkdirSync(out(''), { recursive: true });

// ── Estados ─────────────────────────────────────────────────────────────────
const ufGeo = rewindFC(JSON.parse(readFileSync(new URL('./uf-raw.json', import.meta.url))));
const proj = geoMercator().fitExtent([[PAD, PAD], [W - PAD, H - PAD]], ufGeo);
const path = geoPath(proj);

const ufs = ufGeo.features.map((f) => {
  const [sigla, nome, regiao] = UF[String(f.properties.codarea)];
  const [cx, cy] = path.centroid(f);
  const [[x0, y0], [x1, y1]] = path.bounds(f);
  const r = (n) => Math.round(n * 10) / 10;
  return { uf: sigla, nome, regiao, d: path(f), cx: Math.round(cx), cy: Math.round(cy), bbox: [r(x0), r(y0), r(x1), r(y1)] };
}).sort((a, b) => a.uf.localeCompare(b.uf));
writeFileSync(out('uf-paths.json'), JSON.stringify({ width: W, height: H, ufs }));
console.log(`UFs: ${ufs.length} → uf-paths.json`);

// ── Municípios ──────────────────────────────────────────────────────────────
const cache = new URL('./.cache/mun-raw.json', import.meta.url);
if (!existsSync(cache)) {
  mkdirSync(new URL('./.cache/', import.meta.url), { recursive: true });
  console.log('baixando malha de municípios do IBGE…');
  const res = await fetch(URL_MUN);
  if (!res.ok) throw new Error('IBGE ' + res.status);
  writeFileSync(cache, Buffer.from(await res.arrayBuffer()));
}
const munGeo = rewindFC(JSON.parse(readFileSync(cache)));

// Projeta ponto a ponto para o plano 0..1000 (mesma projeção dos estados).
const projRing = (ring) => ring.map((p) => { const [x, y] = proj(p); return [Math.round(x * 100) / 100, Math.round(y * 100) / 100]; });
const projGeom = (g) =>
  g.type === 'Polygon' ? { type: 'Polygon', coordinates: g.coordinates.map(projRing) }
  : { type: 'MultiPolygon', coordinates: g.coordinates.map((poly) => poly.map(projRing)) };

const plano = {
  type: 'FeatureCollection',
  features: munGeo.features.map((f) => ({ type: 'Feature', id: String(f.properties.codarea), properties: {}, geometry: projGeom(f.geometry) })),
};

// Simplifica SEM quantização (o presimplify decodifica e anexa um peso por
// ponto), remove os pesos e só então quantiza com codificação delta — senão o
// arquivo carrega coordenadas absolutas + pesos e não encolhe.
const pre = presimplify(topology({ mun: plano }));
let melhor = null;
// quantile(t, p) devolve o peso que MANTÉM a fração p dos pontos.
// O piso (~850 KB) vem da estrutura: 5.570 polígonos com divisas compartilhadas.
// Remover mais pontos quase não reduz e piora o zoom — 32% é o equilíbrio.
for (const manter of [0.32]) {
  let t = simplify(pre, quantile(pre, manter));
  t = { ...t, arcs: t.arcs.map((arc) => arc.map((p) => [p[0], p[1]])) };
  const s = JSON.stringify(quantize(t, 1e4));
  console.log(`  mantendo ${Math.round(manter * 100)}% dos pontos: ${(s.length / 1024).toFixed(0)} KB`);
  melhor = s;
  if (s.length < 650 * 1024) break;
}
writeFileSync(out('br-mun.topo.json'), melhor);
console.log(`Municípios: ${plano.features.length} → br-mun.topo.json (${(melhor.length / 1024).toFixed(0)} KB)`);
