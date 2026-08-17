-- ================================================================
-- OpinAI — PESQUISAS EXTERNAS (dados de terceiros lançados à mão)
-- Execute no Supabase: SQL Editor → New Query. Idempotente.
--
-- Contexto: até aqui a tela de Pesquisa só montava gráficos a partir das
-- RESPOSTAS dos formulários (tabelas `formularios` / `respostas_formulario`
-- / `app_respostas`). Isto é uma SEGUNDA ORIGEM: o gestor lê uma pesquisa
-- publicada (G1, Datafolha, Quaest...) e lança os números direto.
--
-- Três níveis:
--   pesquisas_externas          → a pesquisa e a procedência dela
--     └ pesquisas_externas_blocos   → cada recorte (ex: "Intenção de voto",
--                                      "Espectro político") = 1 gráfico
--         └ pesquisas_externas_opcoes → cada linha do gráfico
-- ================================================================

-- 1. A pesquisa e sua procedência ---------------------------------
CREATE TABLE IF NOT EXISTS pesquisas_externas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        TEXT NOT NULL,
  descricao     TEXT,

  -- Procedência: é o que separa um dado auditável de um número solto.
  instituto     TEXT,           -- quem realizou (Datafolha, Quaest, G1...)
  fonte_url     TEXT,           -- link da matéria de onde os números saíram
  data_pesquisa DATE,           -- quando a pesquisa foi feita (≠ cadastro)
  entrevistados INTEGER CHECK (entrevistados IS NULL OR entrevistados > 0),
  margem_erro   NUMERIC(4,2) CHECK (margem_erro IS NULL OR margem_erro >= 0),
  abrangencia   TEXT,           -- 'Nacional', 'SP', 'Campinas/SP'...

  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_por    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pesq_ext_ativo ON pesquisas_externas(ativo);
CREATE INDEX IF NOT EXISTS idx_pesq_ext_data  ON pesquisas_externas(data_pesquisa DESC);

-- 2. Blocos — cada um vira um gráfico -----------------------------
CREATE TABLE IF NOT EXISTS pesquisas_externas_blocos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pesquisa_id UUID NOT NULL REFERENCES pesquisas_externas(id) ON DELETE CASCADE,
  titulo      TEXT NOT NULL,          -- "Intenção de voto", "Espectro político"
  ordem       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pesq_ext_blocos ON pesquisas_externas_blocos(pesquisa_id, ordem);

-- 3. Opções — cada linha do gráfico -------------------------------
-- votos E percentual são os DOIS opcionais de propósito: matéria de jornal
-- às vezes traz só o %, às vezes só o número de pessoas. O servidor calcula
-- o que faltar a partir do total do bloco. Guardar os dois preserva o que
-- foi realmente publicado, sem inventar precisão que a fonte não deu.
CREATE TABLE IF NOT EXISTS pesquisas_externas_opcoes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bloco_id   UUID NOT NULL REFERENCES pesquisas_externas_blocos(id) ON DELETE CASCADE,
  rotulo     TEXT NOT NULL,           -- "Lula", "Bolsonaro", "Branco/Nulo"
  votos      INTEGER      CHECK (votos IS NULL OR votos >= 0),
  percentual NUMERIC(5,2) CHECK (percentual IS NULL OR (percentual >= 0 AND percentual <= 100)),
  ordem      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Uma opção sem nenhum número não significa nada.
  CONSTRAINT chk_opcao_tem_numero CHECK (votos IS NOT NULL OR percentual IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_pesq_ext_opcoes ON pesquisas_externas_opcoes(bloco_id, ordem);

-- 4. RLS: nenhum acesso direto de anon/authenticated --------------
-- Todo acesso passa pelo servidor Hono (service_role), como no resto do
-- projeto. Ver [[02 - Padrão RLS + Service Role (Hono)]].
ALTER TABLE pesquisas_externas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pesquisas_externas_blocos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pesquisas_externas_opcoes ENABLE ROW LEVEL SECURITY;

-- ── Verificação ──────────────────────────────────────────────────
SELECT table_name, column_name, data_type
  FROM information_schema.columns
 WHERE table_name IN ('pesquisas_externas','pesquisas_externas_blocos','pesquisas_externas_opcoes')
 ORDER BY table_name, ordinal_position;
