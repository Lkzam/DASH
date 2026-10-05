// Partidos: cor no mapa, nome de exibição e posição no espectro (para a barra
// Esquerda · Centrão · Direita). Compartilhado pelo coletor e pela tela.
//
// A classificação de espectro é uma aproximação editorial, não oficial:
// "Centrão" = PP, União, PSD, Republicanos e MDB; os demais partidos fora da
// esquerda contam como direita.

export const PARTIDOS = {
  PT:            { nome: 'PT',            cor: '#E5372B', ideo: 'esquerda' },
  PL:            { nome: 'PL',            cor: '#3A5FE0', ideo: 'direita' },
  PSD:           { nome: 'PSD',           cor: '#8BC34A', ideo: 'centrao' },
  MDB:           { nome: 'MDB',           cor: '#1E8E4F', ideo: 'centrao' },
  PP:            { nome: 'PP',            cor: '#4FC3F7', ideo: 'centrao' },
  REPUBLICANOS:  { nome: 'Republicanos',  cor: '#4A78A8', ideo: 'centrao' },
  'UNIÃO':       { nome: 'União',         cor: '#17A2B8', ideo: 'centrao' },
  PSB:           { nome: 'PSB',           cor: '#F5B700', ideo: 'esquerda' },
  PDT:           { nome: 'PDT',           cor: '#E8833A', ideo: 'esquerda' },
  PSOL:          { nome: 'PSOL',          cor: '#C2185B', ideo: 'esquerda' },
  PCDOB:         { nome: 'PCdoB',         cor: '#9E1B32', ideo: 'esquerda' },
  PV:            { nome: 'PV',            cor: '#4CAF50', ideo: 'esquerda' },
  REDE:          { nome: 'Rede',          cor: '#00A39A', ideo: 'esquerda' },
  PSDB:          { nome: 'PSDB',          cor: '#2E7BCF', ideo: 'direita' },
  CIDADANIA:     { nome: 'Cidadania',     cor: '#E05FA0', ideo: 'direita' },
  NOVO:          { nome: 'Novo',          cor: '#F26B21', ideo: 'direita' },
  AVANTE:        { nome: 'Avante',        cor: '#B07CF0', ideo: 'direita' },
  PODE:          { nome: 'Podemos',       cor: '#5C6BC0', ideo: 'direita' },
  SOLIDARIEDADE: { nome: 'Solidariedade', cor: '#FF8A65', ideo: 'direita' },
  'MISSÃO':      { nome: 'Missão',        cor: '#6D28D9', ideo: 'direita' },
  PRD:           { nome: 'PRD',           cor: '#78909C', ideo: 'direita' },
  DC:            { nome: 'DC',            cor: '#0EA5E9', ideo: 'direita' },
  AGIR:          { nome: 'Agir',          cor: '#A1887F', ideo: 'direita' },
  MOBILIZA:      { nome: 'Mobiliza',      cor: '#8D6E63', ideo: 'direita' },
  PRTB:          { nome: 'PRTB',          cor: '#6D8B3A', ideo: 'direita' },
  PMB:           { nome: 'PMB',           cor: '#D06BC8', ideo: 'direita' },
  PSC:           { nome: 'PSC',           cor: '#3F8F5F', ideo: 'direita' },
  DEMOCRATA:     { nome: 'Democrata',     cor: '#2563EB', ideo: 'direita' },
  UP:            { nome: 'UP',            cor: '#B4232A', ideo: 'esquerda' },
  PSTU:          { nome: 'PSTU',          cor: '#8B1A1A', ideo: 'esquerda' },
  PCO:           { nome: 'PCO',           cor: '#6B1D1D', ideo: 'esquerda' },
  PCB:           { nome: 'PCB',           cor: '#C2410C', ideo: 'esquerda' },
};

export const COR_NEUTRA_PARTIDO = '#6B7280';

export const corPartido = (sg) => PARTIDOS[sg]?.cor ?? COR_NEUTRA_PARTIDO;
export const nomePartido = (sg) => PARTIDOS[sg]?.nome ?? sg ?? '';
export const ideologia = (sg) => PARTIDOS[sg]?.ideo ?? 'direita';

export const CENTRAO_ROTULO = 'PP, União, PSD, Republicanos e MDB';
