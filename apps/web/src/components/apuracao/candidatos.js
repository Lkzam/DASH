// Cadastro estático dos candidatos (SIMULAÇÃO — nomes fictícios) e metadados
// eleitorais. As cores de partido são tokens; não espalhar hex pelo código.
//
// ⚠️ Simulação: nomes e fotos são fictícios de propósito. Ao ligar o coletor
// real do TSE, troque este cadastro pelos candidatos oficiais do pleito.

export const CANDIDATOS = {
  presidente: [
    { numero: '13', nome: 'Helena Prado',  partido: 'PT',   cor: '#E5372B' },
    { numero: '22', nome: 'Marco Vieira',  partido: 'PL',   cor: '#3A5FE0' },
    { numero: '12', nome: 'Rafael Dias',   partido: 'PDT',  cor: '#13A3B8' },
    { numero: '15', nome: 'Sofia Mendes',  partido: 'MDB',  cor: '#2E9E5B' },
    { numero: '50', nome: 'Caio Nunes',    partido: 'PSOL', cor: '#C9227A' },
    { numero: '40', nome: 'Lívia Rocha',   partido: 'PSB',  cor: '#E0900B' },
  ],
};

/** número → candidato */
export function mapaCandidatos(cargo = 'presidente') {
  const m = {};
  for (const c of CANDIDATOS[cargo] || []) m[c.numero] = c;
  return m;
}

export const COR_NEUTRA = '#4B5563';

export const REGIOES = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul', 'Exterior'];

export const UF_REGIAO = {
  RO: 'Norte', AC: 'Norte', AM: 'Norte', RR: 'Norte', PA: 'Norte', AP: 'Norte', TO: 'Norte',
  MA: 'Nordeste', PI: 'Nordeste', CE: 'Nordeste', RN: 'Nordeste', PB: 'Nordeste',
  PE: 'Nordeste', AL: 'Nordeste', SE: 'Nordeste', BA: 'Nordeste',
  MG: 'Sudeste', ES: 'Sudeste', RJ: 'Sudeste', SP: 'Sudeste',
  PR: 'Sul', SC: 'Sul', RS: 'Sul',
  MS: 'Centro-Oeste', MT: 'Centro-Oeste', GO: 'Centro-Oeste', DF: 'Centro-Oeste',
  ZZ: 'Exterior',
};

export const UF_NOME = {
  RO: 'Rondônia', AC: 'Acre', AM: 'Amazonas', RR: 'Roraima', PA: 'Pará', AP: 'Amapá',
  TO: 'Tocantins', MA: 'Maranhão', PI: 'Piauí', CE: 'Ceará', RN: 'Rio Grande do Norte',
  PB: 'Paraíba', PE: 'Pernambuco', AL: 'Alagoas', SE: 'Sergipe', BA: 'Bahia',
  MG: 'Minas Gerais', ES: 'Espírito Santo', RJ: 'Rio de Janeiro', SP: 'São Paulo',
  PR: 'Paraná', SC: 'Santa Catarina', RS: 'Rio Grande do Sul', MS: 'Mato Grosso do Sul',
  MT: 'Mato Grosso', GO: 'Goiás', DF: 'Distrito Federal', ZZ: 'Exterior',
};

// Eleitorado aproximado por UF (em milhares) — base para a simulação e para o
// comparecimento. Valores de ordem de grandeza real; não são oficiais.
export const ELEITORADO_UF = {
  SP: 34500, MG: 16300, RJ: 12800, BA: 11000, RS: 8500, PR: 8200, PE: 6800,
  CE: 6800, PA: 5800, SC: 5500, MA: 4900, GO: 4900, PB: 3100, ES: 2900,
  AM: 2700, PI: 2500, MT: 2500, RN: 2500, AL: 2300, DF: 2200, MS: 2000,
  SE: 1600, RO: 1300, TO: 1100, AC: 600, AP: 600, RR: 400,
};

// "Tendência" fictícia por UF: peso extra para o candidato 13 (+) ou 22 (−).
// Dá variação regional ao mapa da simulação (Nordeste tende 13, Sul tende 22).
export const TENDENCIA_UF = {
  AC: -0.18, AL: 0.22, AM: -0.02, AP: 0.04, BA: 0.26, CE: 0.24, DF: -0.10,
  ES: -0.06, GO: -0.14, MA: 0.28, MG: 0.02, MS: -0.12, MT: -0.16, PA: 0.10,
  PB: 0.22, PE: 0.20, PI: 0.30, PR: -0.16, RJ: -0.08, RN: 0.18, RO: -0.18,
  RR: -0.10, RS: -0.12, SC: -0.20, SE: 0.18, SP: -0.04, TO: 0.02,
};
