-- ================================================================
-- OpinAI — CONTA ÚNICA entre o site e o aplicativo
-- Execute no Supabase: SQL Editor → New Query. Idempotente.
--
-- Contexto: o app deixou de ser "sem login". A partir daqui a conta é a
-- mesma do site (Supabase Auth) e o CPF passa a ser um atributo dela,
-- guardado em perfil_usuario.
--
-- O elo com os dados já existentes do app é o hash: o servidor calcula
-- sha256(cpf || CPF_PEPPER) a partir do CPF do perfil e encontra o que
-- já estava gravado em app_respostas / cupons_resgates. Por isso NÃO há
-- migração de dados aqui — quem se cadastrar com o mesmo CPF que já usou
-- no app reencontra respostas, moedas e cupons automaticamente.
-- ================================================================

-- 1. Quando o CPF foi definido. Depois de definido ele é TRAVADO: moedas,
--    respostas e resgates ficam atrelados a ele, então permitir a troca
--    deixaria transferir saldo entre CPFs e responder a mesma pesquisa
--    duas vezes (o que destruiria o valor do dado eleitoral).
ALTER TABLE perfil_usuario
  ADD COLUMN IF NOT EXISTS cpf_definido_em TIMESTAMPTZ;

-- Preenche o histórico: perfis que já tinham CPF contam como definidos.
UPDATE perfil_usuario
   SET cpf_definido_em = COALESCE(cpf_definido_em, updated_at, created_at, now())
 WHERE cpf IS NOT NULL AND cpf_definido_em IS NULL;

-- 2. Um CPF por conta. Sem isto, duas contas com o mesmo CPF apontariam
--    para o MESMO hash — ou seja, compartilhariam saldo de moedas e
--    conseguiriam burlar o limite de uma resposta por pessoa.
--    (índice único parcial: vários perfis sem CPF continuam válidos)
CREATE UNIQUE INDEX IF NOT EXISTS uq_perfil_cpf
  ON perfil_usuario (cpf)
  WHERE cpf IS NOT NULL;

-- 3. Busca por CPF é feita a cada requisição autenticada do app.
CREATE INDEX IF NOT EXISTS idx_perfil_cpf ON perfil_usuario (cpf);

-- ── Verificação ──────────────────────────────────────────────────
-- Deve listar cpf_definido_em, e o índice único uq_perfil_cpf.
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name = 'perfil_usuario'
 ORDER BY ordinal_position;

SELECT indexname FROM pg_indexes
 WHERE tablename = 'perfil_usuario';

-- Duplicatas de CPF impediriam o índice único acima de ser criado.
-- Se o CREATE INDEX falhar, rode isto para achar os conflitos:
--   SELECT cpf, count(*) FROM perfil_usuario
--    WHERE cpf IS NOT NULL GROUP BY cpf HAVING count(*) > 1;
