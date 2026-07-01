-- ================================================================
-- OpinAI — MIGRAÇÃO PLANOS v2 (modelo de 3 tiers)
-- Execute no Supabase: SQL Editor → New Query
-- Idempotente: pode rodar mais de uma vez com segurança.
-- ================================================================

-- 1. Novas colunas em planos_usuario
ALTER TABLE planos_usuario
  ADD COLUMN IF NOT EXISTS tier TEXT,                 -- 'basico' | 'medio' | 'maximo'
  ADD COLUMN IF NOT EXISTS permanente BOOLEAN DEFAULT false,  -- corrige schema drift (check-plan já lia)
  ADD COLUMN IF NOT EXISTS pesquisas_cota INTEGER,    -- NULL = ilimitado (maximo); 0 = nenhum (basico)
  ADD COLUMN IF NOT EXISTS pesquisas_usadas INTEGER DEFAULT 0;

-- 2. Backfill do modelo antigo (mensal/anual) → tier básico
--    (registros antigos viram 'basico' por padrão; ajuste manualmente se preciso)
UPDATE planos_usuario
SET tier = 'basico'
WHERE tier IS NULL;

-- 3. Restringir valores válidos de tier
ALTER TABLE planos_usuario
  DROP CONSTRAINT IF EXISTS planos_usuario_tier_check;
ALTER TABLE planos_usuario
  ADD CONSTRAINT planos_usuario_tier_check
  CHECK (tier IN ('basico', 'medio', 'maximo'));

-- 4. Índice para a checagem de acesso por e-mail + status
CREATE INDEX IF NOT EXISTS idx_planos_usuario_email_status
  ON planos_usuario(email, status);

-- 5. RLS já está habilitada (ver supabase-setup.sql). Confirmar:
ALTER TABLE planos_usuario ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- Verificação
-- ================================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'planos_usuario'
ORDER BY ordinal_position;
