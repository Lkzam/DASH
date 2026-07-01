-- ================================================================
-- OpinAI — HARDENING DE SEGURANÇA DO BANCO
-- Execute no Supabase: SQL Editor → New Query
-- Corrige TODOS os alertas do Database Linter:
--   1. "role mutable search_path" nas funções
--   2. SECURITY DEFINER executável por anon/authenticated
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Fixar o search_path das funções (impede sequestro de search_path)
--    Sem isto, um usuário pode criar objetos numa schema temporária
--    e fazer a função SECURITY DEFINER executá-los com privilégio elevado.
-- ----------------------------------------------------------------
ALTER FUNCTION public.get_municipios_eleitorais(text, text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_candidatos_eleitorais(text, text, text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.update_updated_at_column()
  SET search_path = public, pg_temp;

-- ----------------------------------------------------------------
-- 2. Remover acesso de anon/authenticated às funções SECURITY DEFINER.
--    O app NÃO chama estes RPCs pelo cliente — só o servidor chama,
--    e o servidor usa a service_role_key. Logo, ninguém deslogado
--    (ou logado sem ser admin) precisa executá-las via /rest/v1/rpc.
-- ----------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_municipios_eleitorais(text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_candidatos_eleitorais(text, text, text)
  FROM PUBLIC, anon, authenticated;

-- Garantir que o servidor (service_role) continua podendo executar:
GRANT EXECUTE ON FUNCTION public.get_municipios_eleitorais(text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_candidatos_eleitorais(text, text, text)
  TO service_role;

-- ----------------------------------------------------------------
-- 3. (Opcional, recomendado) A tabela de resultados é lida só pelo
--    servidor. A política de leitura pública anon não é necessária.
--    Se quiser bloquear leitura direta via anon key, descomente:
-- ----------------------------------------------------------------
-- DROP POLICY IF EXISTS "leitura_publica_resultados" ON resultados_eleitorais_2022;
-- CREATE POLICY "leitura_resultados_service_role"
--   ON resultados_eleitorais_2022 FOR SELECT
--   TO service_role USING (true);

-- ----------------------------------------------------------------
-- 4. Verificação — confirma que search_path foi aplicado
-- ----------------------------------------------------------------
SELECT p.proname AS funcao, p.proconfig AS config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_municipios_eleitorais',
    'get_candidatos_eleitorais',
    'update_updated_at_column'
  );
