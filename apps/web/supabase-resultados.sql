-- ============================================================
-- RESULTADOS ELEITORAIS 2022 — Supabase Schema
-- ============================================================
-- Execute este arquivo no Supabase SQL Editor ANTES de rodar
-- o script de importação: apps/web/scripts/importar_dados_tse.py
-- ============================================================

-- Tabela principal: dados agregados por candidato por município
CREATE TABLE IF NOT EXISTS resultados_eleitorais_2022 (
  id           BIGSERIAL PRIMARY KEY,
  uf           CHAR(2)  NOT NULL,         -- Ex: "SP"
  municipio_nome TEXT   NOT NULL,         -- Ex: "SÃO PAULO"
  cargo_codigo TEXT     NOT NULL,         -- Ex: "6" (Dep. Federal)
  candidato_nome TEXT   NOT NULL,         -- Nome de urna
  candidato_numero TEXT,                  -- Número na urna
  partido      TEXT,                      -- Sigla do partido
  nome_partido TEXT,                      -- Nome completo do partido
  votos        BIGINT   NOT NULL DEFAULT 0,
  situacao     TEXT,                      -- "ELEITO", "NÃO ELEITO", etc.
  CONSTRAINT unique_candidato_municipio_cargo
    UNIQUE (uf, municipio_nome, cargo_codigo, candidato_numero)
);

-- Índices para queries rápidas
CREATE INDEX IF NOT EXISTS idx_resultados_uf_cargo
  ON resultados_eleitorais_2022 (uf, cargo_codigo);

CREATE INDEX IF NOT EXISTS idx_resultados_municipio
  ON resultados_eleitorais_2022 (uf, cargo_codigo, municipio_nome);

-- RLS: apenas leitura pública (sem escrita anon)
ALTER TABLE resultados_eleitorais_2022 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura_publica_resultados" ON resultados_eleitorais_2022;
CREATE POLICY "leitura_publica_resultados"
  ON resultados_eleitorais_2022
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================================
-- Função: lista municípios de um estado por cargo
-- Chamada: GET /rest/v1/rpc/get_municipios_eleitorais?p_uf=SP&p_cargo=6
-- ============================================================
CREATE OR REPLACE FUNCTION get_municipios_eleitorais(p_uf TEXT, p_cargo TEXT)
RETURNS TABLE(municipio_nome TEXT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT DISTINCT r.municipio_nome
  FROM resultados_eleitorais_2022 r
  WHERE r.uf = UPPER(p_uf) AND r.cargo_codigo = p_cargo
  ORDER BY r.municipio_nome;
$$;

GRANT EXECUTE ON FUNCTION get_municipios_eleitorais(TEXT, TEXT) TO anon, authenticated;

-- ============================================================
-- Função: candidatos de um município por cargo (ordenados por votos)
-- Chamada: GET /rest/v1/rpc/get_candidatos_eleitorais?p_uf=SP&p_municipio=SÃO%20PAULO&p_cargo=6
-- ============================================================
CREATE OR REPLACE FUNCTION get_candidatos_eleitorais(p_uf TEXT, p_municipio TEXT, p_cargo TEXT)
RETURNS TABLE(
  candidato_nome   TEXT,
  candidato_numero TEXT,
  partido          TEXT,
  nome_partido     TEXT,
  votos            BIGINT,
  situacao         TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    r.candidato_nome,
    r.candidato_numero,
    r.partido,
    r.nome_partido,
    r.votos,
    r.situacao
  FROM resultados_eleitorais_2022 r
  WHERE r.uf = UPPER(p_uf)
    AND r.municipio_nome = p_municipio
    AND r.cargo_codigo = p_cargo
  ORDER BY r.votos DESC;
$$;

GRANT EXECUTE ON FUNCTION get_candidatos_eleitorais(TEXT, TEXT, TEXT) TO anon, authenticated;

-- ============================================================
-- Verificar se tudo foi criado corretamente
-- ============================================================
SELECT 'tabela criada' AS status WHERE EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_name = 'resultados_eleitorais_2022'
);
