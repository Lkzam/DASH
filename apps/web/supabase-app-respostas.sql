-- ============================================================
-- OpinAI — Respostas do APP (coleta pública por CPF)
-- Rode no Supabase SQL Editor (depois do supabase-app-loja.sql).
-- ============================================================

-- Respostas de pesquisas vindas do aplicativo.
-- REGRA: 1 resposta por CPF por pesquisa (UNIQUE abaixo).
-- O saldo de moedas do usuário é calculado como:
--   soma(app_respostas.moedas_ganhas) - soma(cupons_resgates.moedas_pagas)
CREATE TABLE IF NOT EXISTS app_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formulario_id UUID NOT NULL REFERENCES formularios(id) ON DELETE CASCADE,
  cpf_hash TEXT NOT NULL,             -- hash SHA-256 do CPF (LGPD)
  respostas JSONB NOT NULL,           -- [{pergunta_id, resposta}, ...]
  moedas_ganhas INTEGER NOT NULL DEFAULT 0,  -- recompensa no momento da resposta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_resposta_por_cpf UNIQUE (formulario_id, cpf_hash)
);

CREATE INDEX IF NOT EXISTS idx_app_respostas_cpf ON app_respostas(cpf_hash);
CREATE INDEX IF NOT EXISTS idx_app_respostas_form ON app_respostas(formulario_id);

-- RLS: acesso somente via servidor (service_role).
ALTER TABLE app_respostas ENABLE ROW LEVEL SECURITY;

-- Verificação
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'app_respostas' ORDER BY ordinal_position;
