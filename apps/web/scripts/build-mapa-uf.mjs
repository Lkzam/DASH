/**
 * Gera public/apuracao/uf-paths.json a partir da malha de UFs do IBGE.
 * Pré-calcula os paths SVG projetados (d3-geo) para o mapa NÃO depender de
 * d3 nem baixar nada em runtime. Rode de novo só se quiser regenerar:
 *   node scripts/build-mapa-uf.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { geoMercator, geoPath } from 'd3-geo';

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
const geo = JSON.parse(readFileSync(new URL('./uf-raw.json', import.meta.url)));
const proj = geoMercator().fitExtent([[PAD, PAD], [W - PAD, H - PAD]], geo);
const path = geoPath(proj);

const ufs = geo.features.map((f) => {
  const cod = String(f.properties.codarea);
  const [sigla, nome, regiao] = UF[cod] || [cod, cod, '—'];
  const [cx, cy] = path.centroid(f);
  return { uf: sigla, nome, regiao, d: path(f), cx: Math.round(cx), cy: Math.round(cy) };
}).sort((a, b) => a.uf.localeCompare(b.uf));

mkdirSync(new URL('../public/apuracao/', import.meta.url), { recursive: true });
writeFileSync(
  new URL('../public/apuracao/uf-paths.json', import.meta.url),
  JSON.stringify({ width: W, height: H, ufs })
);
console.log(`OK — ${ufs.length} UFs geradas em public/apuracao/uf-paths.json`);
console.log('exemplo:', ufs[0].uf, ufs[0].nome, '| path len', ufs[0].d.length);
