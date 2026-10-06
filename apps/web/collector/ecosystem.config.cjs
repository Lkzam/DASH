// PM2 do coletor da Apuração no VPS (Hostinger).
//   pm2 start collector/ecosystem.config.cjs && pm2 save
// Roda em loop: a cada 5 min busca Presidente, municípios e estadual no TSE e
// publica os JSON em /var/www/opinai/feed (servidos pelo nginx em /feed/).
// Em noite de apuração ao vivo, dá para baixar os intervalos (ex.: 10000/30000/20000).
module.exports = {
  apps: [
    {
      name: 'opinai-coletor',
      script: 'collector/coletor.mjs',
      cwd: '/var/www/opinai/apps/web',
      env: {
        FEED_DIR: '/var/www/opinai/feed',
        COLETOR_INTERVALO_MS: '300000',
        COLETOR_MUN_INTERVALO_MS: '300000',
        COLETOR_EST_INTERVALO_MS: '300000',
      },
      max_memory_restart: '400M',
      restart_delay: 10000,
    },
  ],
};
