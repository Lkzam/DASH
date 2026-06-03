#!/usr/bin/env python3
"""
Importa os dados eleitorais TSE 2022 do CSV local para o Supabase.

Pré-requisito:
  1. Execute apps/web/supabase-resultados.sql no Supabase SQL Editor
  2. Tenha SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no arquivo apps/web/.env

Uso:
  python scripts/importar_dados_tse.py             # importa todos os estados
  python scripts/importar_dados_tse.py SP MG RJ    # importa só os estados informados
  python scripts/importar_dados_tse.py SP --reset  # apaga checkpoint do SP e reinicia

Tempo estimado: 30-90 minutos (depende da velocidade da conexão e dos CSVs)
SP pode demorar mais (645 municípios) mas agora faz upload município por município,
usa checkpoint e pode ser retomado se interrompido.
"""

import csv
import os
import sys
import json
import time
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path
from collections import defaultdict

# ─── Configuração ────────────────────────────────────────────────────────────

SCRIPT_DIR  = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent                          # apps/web/
DATA_DIR    = PROJECT_DIR / 'public' / 'data'
ENV_FILE    = PROJECT_DIR / '.env'

# Cargos a importar (códigos TSE)
CARGOS_INCLUIR = {'1', '3', '5', '6', '7', '8'}
CARGOS_NOMES   = {
    '1': 'Presidente',
    '3': 'Governador',
    '5': 'Senador',
    '6': 'Deputado Federal',
    '7': 'Deputado Estadual',
    '8': 'Deputado Distrital',
}

BATCH_SIZE  = 1000   # linhas por requisição (aumentado de 400 → 1000)
BATCH_DELAY = 0.05   # segundos entre batches (evita rate-limit)

TODOS_ESTADOS = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
    'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
    'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

# ─── Funções auxiliares ───────────────────────────────────────────────────────

def load_env() -> dict:
    """Lê variáveis de ambiente do arquivo .env"""
    env = {}
    if not ENV_FILE.exists():
        print(f'[AVISO] .env não encontrado em {ENV_FILE}')
        return env
    with open(ENV_FILE, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, _, value = line.partition('=')
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def supabase_upsert(supa_url: str, supa_key: str, table: str, rows: list) -> None:
    """Envia um lote de rows ao Supabase com upsert (merge-duplicates)."""
    url = f'{supa_url}/rest/v1/{table}'
    body = json.dumps(rows).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            'apikey': supa_key,
            'Authorization': f'Bearer {supa_key}',
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates',
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        if resp.status not in (200, 201):
            raise RuntimeError(f'HTTP {resp.status}')


def aggregate_csv(filepath: Path, uf_override: str | None = None) -> list:
    """
    Lê um CSV TSE (ISO-8859-1, delimitador ';') e retorna lista de dicts
    agregados por (uf, municipio, cargo, candidato, numero, partido).
    """
    aggregated: dict = defaultdict(int)
    meta: dict = {}

    try:
        with open(filepath, encoding='iso-8859-1', errors='replace', newline='') as f:
            reader = csv.DictReader(f, delimiter=';')
            for row in reader:
                cargo = row.get('CD_CARGO', '').strip()
                if cargo not in CARGOS_INCLUIR:
                    continue

                try:
                    votos = int(row.get('QT_VOTOS_NOMINAIS', '0').strip())
                except ValueError:
                    continue
                if votos <= 0:
                    continue

                uf        = uf_override or row.get('SG_UF', '').strip().upper()
                municipio = row.get('NM_MUNICIPIO', '').strip()
                candidato = (row.get('NM_URNA_CANDIDATO') or row.get('NM_CANDIDATO', '')).strip()
                numero    = row.get('NR_CANDIDATO', '').strip()
                partido   = row.get('SG_PARTIDO', '').strip()

                if not uf or not municipio or not candidato:
                    continue

                key = (uf, municipio, cargo, numero, candidato, partido)
                aggregated[key] += votos

                if key not in meta:
                    meta[key] = {
                        'nome_partido': row.get('NM_PARTIDO', '').strip(),
                        'situacao':     row.get('DS_SIT_TOT_TURNO', '').strip(),
                    }
    except Exception as e:
        print(f'    [ERRO ao ler {filepath.name}]: {e}')
        return []

    rows = []
    for (uf, municipio, cargo, numero, candidato, partido), votos in aggregated.items():
        m = meta.get((uf, municipio, cargo, numero, candidato, partido), {})
        rows.append({
            'uf':               uf,
            'municipio_nome':   municipio,
            'cargo_codigo':     cargo,
            'candidato_nome':   candidato,
            'candidato_numero': numero,
            'partido':          partido,
            'nome_partido':     m.get('nome_partido', ''),
            'votos':            votos,
            'situacao':         m.get('situacao', ''),
        })
    return rows


def deduplicate_rows(rows: list) -> list:
    """
    Remove duplicatas internas com base na UNIQUE constraint do banco.
    Evita HTTP 409 quando dois rows no mesmo batch compartilham a mesma chave.
    """
    seen: set = set()
    deduped   = []
    for row in rows:
        key = (
            row['uf'],
            row['municipio_nome'],
            row['cargo_codigo'],
            row.get('candidato_numero', ''),
            row['candidato_nome'],
        )
        if key not in seen:
            seen.add(key)
            deduped.append(row)
    removed = len(rows) - len(deduped)
    if removed:
        print(f'    [dedup] {removed} rows duplicadas removidas internamente')
    return deduped


def upload_rows(supa_url: str, supa_key: str, rows: list) -> tuple[int, int]:
    """
    Envia rows para o Supabase em lotes.
    Retorna (qtd_enviada, qtd_erros).
    """
    if not rows:
        return 0, 0

    rows     = deduplicate_rows(rows)
    total    = len(rows)
    uploaded = 0
    errors   = 0

    for i in range(0, total, BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        for attempt in range(4):
            try:
                supabase_upsert(supa_url, supa_key, 'resultados_eleitorais_2022', batch)
                uploaded += len(batch)
                break
            except Exception as e:
                wait = 5 * (attempt + 1)
                print(f'    [ERRO tentativa {attempt+1}/4] lote {i}: {e} — aguardando {wait}s')
                if attempt < 3:
                    time.sleep(wait)
                else:
                    errors += len(batch)

        if BATCH_DELAY > 0:
            time.sleep(BATCH_DELAY)

    return uploaded, errors


def process_state_normal(uf: str) -> list:
    """Agrega os dados de um estado (não-SP)."""
    csv_path = DATA_DIR / f'votacao_candidato_munzona_2022_{uf}.csv'
    if not csv_path.exists():
        print(f'  [AVISO] Arquivo não encontrado: {csv_path.name}')
        return []

    size_mb = csv_path.stat().st_size / 1_000_000
    print(f'  Lendo {csv_path.name} ({size_mb:.1f} MB)...')
    rows = aggregate_csv(csv_path, uf_override=uf)
    print(f'  {len(rows):,} candidatos/municípios agregados')
    return rows


def process_and_upload_sp(supa_url: str, supa_key: str) -> int:
    """
    SP tem 645 arquivos por município — processa e faz upload um por um
    para não acumular 500k rows na RAM. Usa checkpoint para retomar se interrompido.
    """
    sp_dir = DATA_DIR / 'municipios_sp'
    if not sp_dir.exists():
        print(f'  [AVISO] Diretório não encontrado: {sp_dir}')
        return 0

    checkpoint_file = SCRIPT_DIR / 'sp_checkpoint.json'
    csv_files       = sorted(sp_dir.glob('SP_*.csv'))
    total_files     = len(csv_files)
    print(f'  SP: {total_files} arquivos de município...')

    # Carregar checkpoint (se existir e não foi pedido reset)
    start_from      = 0
    total_uploaded  = 0
    errors_total    = 0

    if checkpoint_file.exists():
        try:
            with open(checkpoint_file) as f:
                ck = json.load(f)
            start_from     = ck.get('last_index', 0)
            total_uploaded = ck.get('total_uploaded', 0)
            print(f'  Checkpoint encontrado — retomando do município {start_from + 1}/{total_files}')
            print(f'  ({total_uploaded:,} rows já enviadas em execuções anteriores)')
        except Exception:
            start_from = 0
            total_uploaded = 0

    for i, csv_file in enumerate(csv_files):
        if i < start_from:
            continue  # já processado antes

        rows = aggregate_csv(csv_file, uf_override='SP')
        if rows:
            n, errs = upload_rows(supa_url, supa_key, rows)
            total_uploaded += n
            errors_total   += errs

        # Salvar checkpoint após cada município (permite retomar se travar)
        try:
            with open(checkpoint_file, 'w') as f:
                json.dump({'last_index': i + 1, 'total_uploaded': total_uploaded}, f)
        except Exception:
            pass  # não crítico

        if (i + 1) % 50 == 0 or (i + 1) == total_files:
            print(f'    ... {i+1}/{total_files} municípios | {total_uploaded:,} rows enviadas | {errors_total} erros')

    # Remover checkpoint ao concluir com sucesso
    if checkpoint_file.exists():
        checkpoint_file.unlink()

    print(f'  Concluído: {total_uploaded:,} rows enviadas | {errors_total} erros no total')
    return total_uploaded


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    env = load_env()
    supa_url = env.get('SUPABASE_URL', '').rstrip('/')
    supa_key = env.get('SUPABASE_SERVICE_ROLE_KEY', '')

    if not supa_url or not supa_key:
        print('ERRO: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar no arquivo .env')
        print(f'Arquivo .env esperado em: {ENV_FILE}')
        sys.exit(1)

    # Processar argumentos: remover --reset antes de listar estados
    args       = sys.argv[1:]
    reset_sp   = '--reset' in args
    args       = [a for a in args if a != '--reset']

    if reset_sp:
        cp = SCRIPT_DIR / 'sp_checkpoint.json'
        if cp.exists():
            cp.unlink()
            print('[SP] Checkpoint apagado — SP será reprocessado do zero.')

    estados    = [s.upper() for s in args] if args else TODOS_ESTADOS
    invalidos  = [s for s in estados if s not in TODOS_ESTADOS]
    if invalidos:
        print(f'[AVISO] Estados inválidos ignorados: {invalidos}')
        estados = [s for s in estados if s in TODOS_ESTADOS]

    if not estados:
        print('Nenhum estado válido para processar.')
        sys.exit(1)

    print('=' * 60)
    print(f'OpinAI — Importação TSE 2022 → Supabase')
    print(f'Estados: {", ".join(estados)}')
    print(f'Supabase: {supa_url}')
    print(f'Batch size: {BATCH_SIZE} rows')
    print('=' * 60)
    print()

    total_geral = 0
    inicio      = time.time()

    for uf in estados:
        print(f'[{uf}] Iniciando...')
        t0 = time.time()

        if uf == 'SP':
            # SP: streaming município por município (sem acumular na RAM)
            n = process_and_upload_sp(supa_url, supa_key)
            total_geral += n
        else:
            rows = process_state_normal(uf)
            if rows:
                n, errs = upload_rows(supa_url, supa_key, rows)
                total_geral += n
                print(f'  Concluído: {n:,}/{len(rows):,} rows enviadas | {errs} erros')

        elapsed = time.time() - t0
        print(f'[{uf}] Finalizado em {elapsed:.0f}s | Total acumulado: {total_geral:,} rows')
        print()

    total_elapsed = time.time() - inicio
    print('=' * 60)
    print(f'Importação concluída!')
    print(f'Total de rows inseridas/atualizadas: {total_geral:,}')
    print(f'Tempo total: {total_elapsed/60:.1f} minutos')
    print('=' * 60)


if __name__ == '__main__':
    main()
