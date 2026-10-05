// Tema da Apuração: acompanha o modo claro/escuro do site (DarkModeContext).
// A tela usa só as variáveis CSS abaixo (bg-[var(--ap-…)]); o mapa em canvas
// lê as cores de MAPA_TEMA, porque o canvas não enxerga CSS.

export const TEMA = {
  escuro: {
    '--ap-bg': '#0b0b0d',
    '--ap-painel': '#121216',
    '--ap-elev': '#17171c',
    '--ap-elev2': '#1f1f26',
    '--ap-borda': '#1d1d22',
    '--ap-borda2': '#26262c',
    '--ap-gap': '#131317',
    '--ap-txt': '#E8E8EA',
    '--ap-txt2': '#C9C9D1',
    '--ap-mudo': '#9A9AA3',
    '--ap-mudo2': '#6c6c76',
    '--ap-mudo3': '#5c5c66',
    '--ap-link': '#7aa2ff',
    '--ap-forte': '#ffffff',
    '--ap-tooltip': 'rgba(20,20,24,0.96)',
    '--ap-topo': 'rgba(11,11,13,0.95)',
    '--ap-aviso-bg': '#3a2a08',
    '--ap-aviso': '#E0A000',
  },
  claro: {
    '--ap-bg': '#F4F6FA',
    '--ap-painel': '#FFFFFF',
    '--ap-elev': '#EEF1F6',
    '--ap-elev2': '#E3E8F0',
    '--ap-borda': '#E3E7EE',
    '--ap-borda2': '#D3D9E3',
    '--ap-gap': '#E3E7EE',
    '--ap-txt': '#1E2235',
    '--ap-txt2': '#2F3447',
    '--ap-mudo': '#5F667A',
    '--ap-mudo2': '#8A8FA6',
    '--ap-mudo3': '#A3A8BA',
    '--ap-link': '#1570FF',
    '--ap-forte': '#0F1222',
    '--ap-tooltip': 'rgba(255,255,255,0.97)',
    '--ap-topo': 'rgba(244,246,250,0.95)',
    '--ap-aviso-bg': '#FFF4D6',
    '--ap-aviso': '#A86B00',
  },
};

export const MAPA_TEMA = {
  escuro: {
    fundo: '#0b0b0d',
    semDado: '#1f1f25',
    bordaMun: 'rgba(11,11,13,0.42)',
    esmaecer: 'rgba(11,11,13,0.66)',
    bordaUF: 'rgba(0,0,0,0.92)',
    contorno: 'rgba(255,255,255,0.85)',
    destaque: '#ffffff',
    linha: 'rgba(255,255,255,0.28)',
    neutro: '#E8E8EA',
  },
  claro: {
    fundo: '#F4F6FA',
    semDado: '#E1E5EC',
    bordaMun: 'rgba(255,255,255,0.5)',
    esmaecer: 'rgba(244,246,250,0.74)',
    bordaUF: 'rgba(255,255,255,0.95)',
    contorno: 'rgba(30,34,53,0.9)',
    destaque: '#1E2235',
    linha: 'rgba(30,34,53,0.3)',
    neutro: '#1E2235',
  },
};

export const SERIF = { fontFamily: '"Fraunces", Georgia, "Times New Roman", serif' };
