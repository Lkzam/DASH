-- ============================================================
-- OpinAI — Preparação para o APP (moedas + loja de cupons)
-- Rode no Supabase SQL Editor.
-- ============================================================

-- 1. Moedas que o usuário do app ganha ao responder cada formulário
ALTER TABLE formularios
  ADD COLUMN IF NOT EXISTS moedas_recompensa INTEGER NOT NULL DEFAULT 0
  CHECK (moedas_recompensa >= 0);

-- 2. Cupons da loja do app (criados pela Retaguarda)
CREATE TABLE IF NOT EXISTS cupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,                 -- ex: "R$ 20 OFF no iFood"
  descricao TEXT,
  parceiro TEXT NOT NULL DEFAULT 'outro'
    CHECK (parceiro IN ('ifood', 'uber', '99', 'outro')),
  custo_moedas INTEGER NOT NULL CHECK (custo_moedas > 0),
  quantidade INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),  -- estoque total
  resgatados INTEGER NOT NULL DEFAULT 0,                          -- já trocados no app
  ativo BOOLEAN NOT NULL DEFAULT true,
  validade DATE,                        -- NULL = sem validade
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cupons_ativo ON cupons(ativo);

-- RLS: nenhum acesso direto de anon/authenticated.
-- Todo acesso passa pelo servidor Hono (service_role), inclusive o futuro app.
ALTER TABLE cupons ENABLE ROW LEVEL SECURITY;

-- Verificação
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'cupons' ORDER BY ordinal_position;
