-- ================================================================
-- PERFIL DO USUÁRIO — CPF e dados complementares
-- Execute no Supabase: SQL Editor → New Query
-- ================================================================

CREATE TABLE IF NOT EXISTS perfil_usuario (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  cpf        CHAR(11),          -- apenas dígitos, ex: "12345678900"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perfil_user_id ON perfil_usuario(user_id);

-- RLS: somente o service_role opera nesta tabela (acesso via servidor)
ALTER TABLE perfil_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_gerencia_perfil"
  ON perfil_usuario FOR ALL TO service_role
  USING (true) WITH CHECK (true);
