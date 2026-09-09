-- ================================================================
-- OpinAI — ESTADO INTERNO DO SISTEMA (chave/valor)
-- Execute no Supabase: SQL Editor → New Query. Idempotente.
--
-- Tabela genérica para o servidor lembrar de coisas entre reinícios.
-- Primeiro uso: a data do último "keep-alive" da chave da Asaas.
--
-- Por que precisa de banco: o Render (plano free) dorme e reinicia o
-- processo, então um setInterval na memória nunca chegaria a disparar
-- um intervalo de 30 dias. O carimbo tem que sobreviver ao restart.
-- ================================================================

CREATE TABLE IF NOT EXISTS sistema_estado (
  chave         TEXT PRIMARY KEY,
  valor         TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: nenhum acesso de anon/authenticated. Só o servidor (service_role),
-- como todo o resto do projeto.
ALTER TABLE sistema_estado ENABLE ROW LEVEL SECURITY;

-- ── Verificação ──────────────────────────────────────────────────
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name = 'sistema_estado'
 ORDER BY ordinal_position;
