#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json

def gerar_index_municipios(pasta_municipios='output_municipios', arquivo_saida='index.json'):
    """
    Gera um arquivo index.json com a lista de todos os municípios de SP
    """
    
    if not os.path.exists(pasta_municipios):
        print(f"❌ Pasta não encontrada: {pasta_municipios}")
        return
    
    municipios = []
    
    # Listar todos os arquivos CSV na pasta
    for arquivo in os.listdir(pasta_municipios):
        if arquivo.startswith('SP_') and arquivo.endswith('.csv'):
            # Extrair nome do município do nome do arquivo
            # SP_SAO_PAULO.csv -> SAO PAULO
            nome_municipio = arquivo[3:-4].replace('_', ' ')
            municipios.append(nome_municipio)
    
    # Ordenar alfabeticamente
    municipios.sort()
    
    # Salvar como JSON na pasta de municípios
    caminho_saida = os.path.join(pasta_municipios, arquivo_saida)
    with open(caminho_saida, 'w', encoding='utf-8') as f:
        json.dump(municipios, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Index criado com sucesso!")
    print(f"📂 Arquivo: {caminho_saida}")
    print(f"🏙️  Total de municípios: {len(municipios)}")
    print(f"\n📋 Primeiros 10 municípios:")
    for i, mun in enumerate(municipios[:10]):
        print(f"   {i+1}. {mun}")

if __name__ == "__main__":
    import sys
    
    pasta = sys.argv[1] if len(sys.argv) > 1 else 'output_municipios'
    gerar_index_municipios(pasta)