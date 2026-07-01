-- ================================================================
-- OpinAI — SOLICITAÇÕES DE PESQUISA (Fase 2)
-- Recurso dos planos Médio (cota mensal) e Máximo (ilimitado + prioridade).
-- Execute no Supabase: SQL Editor → New Query. Idempotente.
-- ================================================================

CREATE TABLE IF NOT EXISTS solicitacoes_pesquisa (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email         TEXT NOT NULL,
  tier          TEXT,                                -- tier no momento da solicitação
  titulo        TEXT NOT NULL,
  objetivo      TEXT NOT NULL,                       -- o que o cliente quer descobrir
  publico_alvo  TEXT,                                -- região / perfil do eleitorado
  detalhes      TEXT,                                -- observações extras (opcional)
  prioridade    TEXT NOT NULL DEFAULT 'normal',      -- 'normal' | 'alta' (máximo)
  status        TEXT NOT NULL DEFAULT 'pendente',    -- pendente|em_andamento|concluida|rejeitada
  resposta_admin TEXT,                               -- retorno/parecer do gestor
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Valores válidos
ALTER TABLE solicitacoes_pesquisa DROP CONSTRAINT IF EXISTS solicitacoes_status_check;
ALTER TABLE solicitacoes_pesquisa ADD CONSTRAINT solicitacoes_status_check
  CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'rejeitada'));

ALTER TABLE solicitacoes_pesquisa DROP CONSTRAINT IF EXISTS solicitacoes_prioridade_check;
ALTER TABLE solicitacoes_pesquisa ADD CONSTRAINT solicitacoes_prioridade_check
  CHECK (prioridade IN ('normal', 'alta'));

-- Índices: por usuário (cota) e fila de trabalho dos gestores (prioridade → data)
CREATE INDEX IF NOT EXISTS idx_solic_user_created
  ON solicitacoes_pesquisa (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_solic_fila
  ON solicitacoes_pesquisa (status, prioridade, created_at);

-- RLS: acesso somente via servidor (service_role). O paywall/cota é aplicado
-- no servidor Hono, que já usa service_role.
ALTER TABLE solicitacoes_pesquisa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_gerencia_solicitacoes" ON solicitacoes_pesquisa;
CREATE POLICY "service_role_gerencia_solicitacoes"
  ON solicitacoes_pesquisa FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Verificação
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'solicitacoes_pesquisa'
ORDER BY ordinal_position;
