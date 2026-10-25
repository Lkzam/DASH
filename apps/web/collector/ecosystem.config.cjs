// PM2 do coletor da Apuração no VPS (Hostinger).
//   pm2 start collector/ecosystem.config.cjs && pm2 save
// Busca Presidente, municípios e estadual no TSE e publica os JSON em
// /var/www/opinai/feed (servidos pelo nginx em /feed/).
//
// ⚠️  AO VIVO (noite de apuração): os intervalos abaixo estão em modo rápido.
// Depois que a apuração encerrar, volte os três para '300000' (5 min) — o TSE
// para de mudar e não há motivo para insistir a cada 15 s.
//
// TROCA DE TURNO: ver o cabeçalho de coletor.mjs. Códigos de 2026 —
//   1º turno: TSE_ELEICAO=6257 · TSE_ELEICAO_GOV=6259 (TSE_TURNO=1)
//   2º turno: TSE_ELEICAO=6258 · TSE_ELEICAO_GOV=6260 (TSE_TURNO=2)
// Senado e Deputados NÃO têm 2º turno: TSE_ELEICAO_ESTADUAL fica em 6259
// sempre, e é de lá que sai o resultado final deles.
module.exports = {
  apps: [
    {
      name: 'opinai-coletor',
      script: 'collector/coletor.mjs',
      cwd: '/var/www/opinai/apps/web',
      env: {
        FEED_DIR: '/var/www/opinai/feed',

        // ── 2º turno (25/10/2026) ──
        TSE_ELEICAO: '6258',          // Presidente, 2º turno
        TSE_TURNO: '2',
        TSE_ELEICAO_ESTADUAL: '6259', // Senado e Deputados: resultado do 1º turno
        TSE_ELEICAO_GOV: '6260',      // Governador, 2º turno (AC, AM, DF, ES, RN, TO)

        // ── ao vivo ──
        COLETOR_INTERVALO_MS: '15000',      // nacional + UFs
        COLETOR_MUN_INTERVALO_MS: '60000',  // 5.570 municípios: leva ~2 min por volta
        COLETOR_EST_INTERVALO_MS: '60000',  // governadores
      },
      max_memory_restart: '400M',
      restart_delay: 10000,
    },
  ],
};
