-- ================================================================
-- OpinAI — MIGRAÇÃO PARA ASAAS (assinaturas recorrentes)
-- Execute no Supabase: SQL Editor → New Query. Idempotente.
-- ================================================================

-- Guarda o cliente e a assinatura do Asaas por usuário.
ALTER TABLE planos_usuario
  ADD COLUMN IF NOT EXISTS asaas_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_planos_asaas_sub
  ON planos_usuario(asaas_subscription_id);
CREATE INDEX IF NOT EXISTS idx_planos_asaas_cust
  ON planos_usuario(asaas_customer_id);

-- Verificação
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'planos_usuario'
  AND column_name IN ('asaas_customer_id', 'asaas_subscription_id');
