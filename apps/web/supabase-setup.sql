-- ================================================================
-- OpinAI — Tabela de Planos de Usuário
-- Execute este SQL no Supabase: SQL Editor → New Query
-- ================================================================

-- 1. Criar tabela de planos
CREATE TABLE IF NOT EXISTS planos_usuario (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'pendente',
  -- status: 'pendente' | 'ativo' | 'cancelado' | 'expirado'
  plano         TEXT NOT NULL DEFAULT 'mensal',
  -- plano: 'mensal' | 'anual'
  abacatepay_billing_id TEXT UNIQUE,
  data_inicio   TIMESTAMPTZ,
  data_fim      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Índices para performance
CREATE INDEX IF NOT EXISTS idx_planos_usuario_email   ON planos_usuario(email);
CREATE INDEX IF NOT EXISTS idx_planos_usuario_user_id ON planos_usuario(user_id);
CREATE INDEX IF NOT EXISTS idx_planos_usuario_status  ON planos_usuario(status);

-- 3. Row Level Security (RLS)
ALTER TABLE planos_usuario ENABLE ROW LEVEL SECURITY;

-- Usuário autenticado só pode ver o próprio plano (pelo e-mail)
CREATE POLICY "usuario_ve_proprio_plano"
  ON planos_usuario
  FOR SELECT
  TO authenticated
  USING (email = auth.jwt()->>'email');

-- Somente o service_role pode inserir/atualizar (via API server-side)
CREATE POLICY "service_role_gerencia_planos"
  ON planos_usuario
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ================================================================
-- PRONTO! Agora configure as variáveis de ambiente no .env:
--   SUPABASE_SERVICE_ROLE_KEY=<sua service role key>
--   ABACATEPAY_API_KEY=<sua api key>
--   APP_URL=http://localhost:4000
-- ================================================================
