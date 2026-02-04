import { useState, useEffect } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useDarkMode } from '../contexts/DarkModeContext';
import { Search, TrendingUp, Users, Award, MapPin, FileText, Filter } from 'lucide-react';
import Papa from 'papaparse';

const AnaliseEleitoral = () => {
  const { isDarkMode } = useDarkMode();
  
  // Estados para filtros
  const [estadoSelecionado, setEstadoSelecionado] = useState('');
  const [municipios, setMunicipios] = useState([]);
  const [municipioSelecionado, setMunicipioSelecionado] = useState('');
  const [cargoSelecionado, setCargoSelecionado] = useState('6'); // 6 = Deputado Federal
  
  // Estados para dados processados
  const [dadosProcessados, setDadosProcessados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Lista de estados do Brasil
  const ESTADOS = [
    { sigla: 'AC', nome: 'Acre' },
    { sigla: 'AL', nome: 'Alagoas' },
    { sigla: 'AP', nome: 'Amapá' },
    { sigla: 'AM', nome: 'Amazonas' },
    { sigla: 'BA', nome: 'Bahia' },
    { sigla: 'CE', nome: 'Ceará' },
    { sigla: 'DF', nome: 'Distrito Federal' },
    { sigla: 'ES', nome: 'Espírito Santo' },
    { sigla: 'GO', nome: 'Goiás' },
    { sigla: 'MA', nome: 'Maranhão' },
    { sigla: 'MT', nome: 'Mato Grosso' },
    { sigla: 'MS', nome: 'Mato Grosso do Sul' },
    { sigla: 'MG', nome: 'Minas Gerais' },
    { sigla: 'PA', nome: 'Pará' },
    { sigla: 'PB', nome: 'Paraíba' },
    { sigla: 'PR', nome: 'Paraná' },
    { sigla: 'PE', nome: 'Pernambuco' },
    { sigla: 'PI', nome: 'Piauí' },
    { sigla: 'RJ', nome: 'Rio de Janeiro' },
    { sigla: 'RN', nome: 'Rio Grande do Norte' },
    { sigla: 'RS', nome: 'Rio Grande do Sul' },
    { sigla: 'RO', nome: 'Rondônia' },
    { sigla: 'RR', nome: 'Roraima' },
    { sigla: 'SC', nome: 'Santa Catarina' },
    { sigla: 'SP', nome: 'São Paulo' },
    { sigla: 'SE', nome: 'Sergipe' },
    { sigla: 'TO', nome: 'Tocantins' },
  ];

  const CARGOS = [
    { codigo: '6', nome: 'Deputado Federal' },
    { codigo: '7', nome: 'Deputado Estadual' },
    { codigo: '8', nome: 'Deputado Distrital' },
    { codigo: '1', nome: 'Presidente' },
    { codigo: '3', nome: 'Governador' },
    { codigo: '5', nome: 'Senador' },
  ];

  // Cores para os gráficos
  const CORES_PARTIDOS = {
    'PT': '#E41E26',
    'PL': '#1E4D8B',
    'PSOL': '#FFD700',
    'PSDB': '#005BAA',
    'PDT': '#FF6B00',
    'MDB': '#00923F',
    'UNIÃO': '#0066CC',
    'PP': '#0080FF',
    'REPUBLICANOS': '#009CDE',
    'PSB': '#FF8C00',
    'PV': '#00A651',
    'CIDADANIA': '#9933CC',
    'PODE': '#FF6600',
    'SOLIDARIEDADE': '#FF8040',
    'AVANTE': '#FF6B35',
    'PCdoB': '#8B0000',
  };

  const CORES_GRAFICOS = ['#1570FF', '#E74C3C', '#2ECC71', '#F39C12', '#9B59B6', '#3498DB', '#E67E22', '#1ABC9C'];

  // Quando o estado mudar, carregar municípios
  useEffect(() => {
    if (estadoSelecionado) {
      carregarMunicipios();
    } else {
      setMunicipios([]);
      setMunicipioSelecionado('');
      setDadosProcessados(null);
    }
  }, [estadoSelecionado]);

  const carregarMunicipios = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Para SP, carregar lista de municípios dos arquivos divididos
      if (estadoSelecionado === 'SP') {
        try {
          // Tentar carregar o índice de municípios de SP
          const response = await fetch('/data/municipios_sp/index.json');
          const municipiosData = await response.json();
          setMunicipios(municipiosData.sort());
        } catch {
          // Se não tiver index.json, carregar do CSV completo (outros estados)
          await carregarMunicipiosDoCSV();
        }
      } else {
        // Para outros estados, usar o CSV completo
        await carregarMunicipiosDoCSV();
      }
    } catch (err) {
      console.error('Erro ao carregar municípios:', err);
      setError('Erro ao carregar municípios');
    } finally {
      setLoading(false);
    }
  };

  const carregarMunicipiosDoCSV = async () => {
    const response = await fetch(`/data/votacao_candidato_munzona_2022_${estadoSelecionado}.csv`);
    const arrayBuffer = await response.arrayBuffer();
    
    // Decodificar como latin1 (ISO-8859-1)
    const decoder = new TextDecoder('iso-8859-1');
    const csvText = decoder.decode(arrayBuffer);
    
    Papa.parse(csvText, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      complete: (results) => {
        // Extrair lista única de municípios
        const municipiosUnicos = [...new Set(
          results.data
            .map(row => row.NM_MUNICIPIO)
            .filter(m => m && m !== '#NULO')
        )].sort();
        
        setMunicipios(municipiosUnicos);
      },
      error: (error) => {
        console.error('Erro ao parsear CSV:', error);
        setError('Erro ao carregar municípios');
      }
    });
  };

  const buscarDados = async () => {
    if (!estadoSelecionado || !municipioSelecionado || !cargoSelecionado) {
      setError('Por favor, selecione Estado, Município e Cargo');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      let csvUrl;
      
      // Para SP, usar arquivo dividido por município
      if (estadoSelecionado === 'SP') {
        // Converter nome do município para formato do arquivo
        const nomeMunicipioArquivo = municipioSelecionado.replace(/\s+/g, '_');
        csvUrl = `/data/municipios_sp/SP_${nomeMunicipioArquivo}.csv`;
      } else {
        // Para outros estados, usar CSV completo
        csvUrl = `/data/votacao_candidato_munzona_2022_${estadoSelecionado}.csv`;
      }
      
      const response = await fetch(csvUrl);
      
      if (!response.ok) {
        throw new Error(`Arquivo não encontrado: ${csvUrl}`);
      }
      
      // Decodificar como latin1 (ISO-8859-1)
      const arrayBuffer = await response.arrayBuffer();
      const decoder = new TextDecoder('iso-8859-1');
      const csvText = decoder.decode(arrayBuffer);
      
      Papa.parse(csvText, {
        header: true,
        delimiter: ';',
        skipEmptyLines: true,
        complete: (results) => {
          // Filtrar dados pelo cargo selecionado
          let dadosFiltrados = results.data.filter(row => 
            row.CD_CARGO === cargoSelecionado &&
            row.QT_VOTOS_NOMINAIS && 
            parseInt(row.QT_VOTOS_NOMINAIS) > 0
          );
          
          // Se não for SP, filtrar também por município (já que SP já está filtrado por arquivo)
          if (estadoSelecionado !== 'SP') {
            dadosFiltrados = dadosFiltrados.filter(row => 
              row.NM_MUNICIPIO === municipioSelecionado
            );
          }

          if (dadosFiltrados.length === 0) {
            setError('Nenhum dado encontrado para os filtros selecionados');
            setDadosProcessados(null);
            return;
          }

          // Processar dados
          const candidatos = dadosFiltrados.map(row => ({
            nome: row.NM_URNA_CANDIDATO || row.NM_CANDIDATO,
            nomeCompleto: row.NM_CANDIDATO,
            numero: row.NR_CANDIDATO,
            partido: row.SG_PARTIDO,
            nomePartido: row.NM_PARTIDO,
            votos: parseInt(row.QT_VOTOS_NOMINAIS) || 0,
            situacao: row.DS_SIT_TOT_TURNO,
          }));

          // Ordenar por votos
          candidatos.sort((a, b) => b.votos - a.votos);

          // Top 10 candidatos
          const top10 = candidatos.slice(0, 10);

          // Calcular total de votos
          const totalVotos = candidatos.reduce((sum, c) => sum + c.votos, 0);

          // Votos por partido
          const votosPorPartido = {};
          candidatos.forEach(c => {
            if (!votosPorPartido[c.partido]) {
              votosPorPartido[c.partido] = {
                partido: c.partido,
                votos: 0,
                candidatos: 0,
              };
            }
            votosPorPartido[c.partido].votos += c.votos;
            votosPorPartido[c.partido].candidatos++;
          });

          const dadosPartidos = Object.values(votosPorPartido)
            .sort((a, b) => b.votos - a.votos)
            .slice(0, 10);

          setDadosProcessados({
            candidatos,
            top10,
            totalVotos,
            totalCandidatos: candidatos.length,
            maisVotado: candidatos[0],
            dadosPartidos,
            cargo: CARGOS.find(c => c.codigo === cargoSelecionado)?.nome,
          });
        },
        error: (error) => {
          console.error('Erro ao processar dados:', error);
          setError('Erro ao processar dados do CSV');
        }
      });
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full p-6 space-y-6 overflow-auto">
      {/* Header */}
      <div>
        <h1 className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-[#2A2E45]'}`}>
          Análise Eleitoral por Município
        </h1>
        <p className={`text-sm mt-1 ${isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'}`}>
          Selecione o estado, município e cargo para visualizar os dados eleitorais
        </p>
      </div>

      {/* Filtros */}
      <div className={`rounded-lg border p-6 ${
        isDarkMode ? 'bg-[#2A2E45] border-[#3A3E55]' : 'bg-white border-[#E4E9F2]'
      }`}>
        <div className="flex items-center gap-2 mb-4">
          <Filter className={`w-5 h-5 ${isDarkMode ? 'text-[#4A90E2]' : 'text-[#1570FF]'}`} />
          <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-[#2A2E45]'}`}>
            Filtros
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Select Estado */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
            }`}>
              Estado
            </label>
            <select
              value={estadoSelecionado}
              onChange={(e) => setEstadoSelecionado(e.target.value)}
              className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                isDarkMode
                  ? 'bg-[#1A1D21] border-[#3A3E55] text-white'
                  : 'bg-white border-[#E4E9F2] text-[#2A2E45]'
              } outline-none focus:border-[#1570FF]`}
            >
              <option value="">Selecione o Estado</option>
              {ESTADOS.map(estado => (
                <option key={estado.sigla} value={estado.sigla}>
                  {estado.sigla} - {estado.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Select Município */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
            }`}>
              Município
            </label>
            <select
              value={municipioSelecionado}
              onChange={(e) => setMunicipioSelecionado(e.target.value)}
              disabled={!estadoSelecionado || municipios.length === 0}
              className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                isDarkMode
                  ? 'bg-[#1A1D21] border-[#3A3E55] text-white'
                  : 'bg-white border-[#E4E9F2] text-[#2A2E45]'
              } outline-none focus:border-[#1570FF] disabled:opacity-50`}
            >
              <option value="">Selecione o Município</option>
              {municipios.map(municipio => (
                <option key={municipio} value={municipio}>
                  {municipio}
                </option>
              ))}
            </select>
          </div>

          {/* Select Cargo */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
            }`}>
              Cargo
            </label>
            <select
              value={cargoSelecionado}
              onChange={(e) => setCargoSelecionado(e.target.value)}
              className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                isDarkMode
                  ? 'bg-[#1A1D21] border-[#3A3E55] text-white'
                  : 'bg-white border-[#E4E9F2] text-[#2A2E45]'
              } outline-none focus:border-[#1570FF]`}
            >
              {CARGOS.map(cargo => (
                <option key={cargo.codigo} value={cargo.codigo}>
                  {cargo.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Botão Buscar */}
          <div className="flex items-end">
            <button
              onClick={buscarDados}
              disabled={!estadoSelecionado || !municipioSelecionado || loading}
              className="w-full px-6 py-2 bg-[#1570FF] text-white rounded-lg hover:bg-[#0D5CD7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Carregando...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Buscar
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mensagem de erro */}
        {error && (
          <div className="mt-4 px-4 py-3 rounded-lg bg-red-50 text-red-600 border border-red-200 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Resultados */}
      {dadosProcessados && (
        <>
          {/* Cards de Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total de Votos */}
            <div className={`rounded-lg border p-4 ${
              isDarkMode ? 'bg-[#2A2E45] border-[#3A3E55]' : 'bg-white border-[#E4E9F2]'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className={`text-sm ${isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'}`}>
                  Total de Votos
                </div>
                <TrendingUp className={`w-5 h-5 ${isDarkMode ? 'text-[#4A90E2]' : 'text-[#1570FF]'}`} />
              </div>
              <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-[#2A2E45]'}`}>
                {dadosProcessados.totalVotos.toLocaleString('pt-BR')}
              </div>
              <div className={`text-xs mt-1 ${isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'}`}>
                votos válidos
              </div>
            </div>

            {/* Total de Candidatos */}
            <div className={`rounded-lg border p-4 ${
              isDarkMode ? 'bg-[#2A2E45] border-[#3A3E55]' : 'bg-white border-[#E4E9F2]'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className={`text-sm ${isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'}`}>
                  Candidatos
                </div>
                <Users className={`w-5 h-5 ${isDarkMode ? 'text-[#4A90E2]' : 'text-[#1570FF]'}`} />
              </div>
              <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-[#2A2E45]'}`}>
                {dadosProcessados.totalCandidatos}
              </div>
              <div className={`text-xs mt-1 ${isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'}`}>
                candidatos votados
              </div>
            </div>

            {/* Mais Votado */}
            <div className={`rounded-lg border p-4 ${
              isDarkMode ? 'bg-[#2A2E45] border-[#3A3E55]' : 'bg-white border-[#E4E9F2]'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className={`text-sm ${isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'}`}>
                  Mais Votado
                </div>
                <Award className={`w-5 h-5 ${isDarkMode ? 'text-[#F39C12]' : 'text-[#F39C12]'}`} />
              </div>
              <div className={`text-lg font-bold truncate ${isDarkMode ? 'text-white' : 'text-[#2A2E45]'}`}>
                {dadosProcessados.maisVotado.nome}
              </div>
              <div className={`text-xs mt-1 ${isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'}`}>
                {dadosProcessados.maisVotado.partido} - {dadosProcessados.maisVotado.votos.toLocaleString('pt-BR')} votos
              </div>
            </div>

            {/* Localização */}
            <div className={`rounded-lg border p-4 ${
              isDarkMode ? 'bg-[#2A2E45] border-[#3A3E55]' : 'bg-white border-[#E4E9F2]'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className={`text-sm ${isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'}`}>
                  Localização
                </div>
                <MapPin className={`w-5 h-5 ${isDarkMode ? 'text-[#4A90E2]' : 'text-[#1570FF]'}`} />
              </div>
              <div className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-[#2A2E45]'}`}>
                {municipioSelecionado}
              </div>
              <div className={`text-xs mt-1 ${isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'}`}>
                {estadoSelecionado} - {dadosProcessados.cargo}
              </div>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Barras - Top 10 Candidatos */}
            <div className={`rounded-lg border p-6 ${
              isDarkMode ? 'bg-[#2A2E45] border-[#3A3E55]' : 'bg-white border-[#E4E9F2]'
            }`}>
              <h3 className={`text-lg font-semibold mb-4 ${
                isDarkMode ? 'text-white' : 'text-[#2A2E45]'
              }`}>
                Top 10 Candidatos Mais Votados
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={dadosProcessados.top10} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#3A3E55' : '#E4E9F2'} />
                  <XAxis type="number" tick={{ fill: isDarkMode ? '#B0B5C9' : '#6F7689' }} />
                  <YAxis 
                    dataKey="nome" 
                    type="category" 
                    width={150}
                    tick={{ fill: isDarkMode ? '#B0B5C9' : '#6F7689', fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#2A2E45' : '#fff',
                      border: `1px solid ${isDarkMode ? '#3A3E55' : '#E4E9F2'}`,
                      borderRadius: '8px',
                      color: isDarkMode ? '#fff' : '#2A2E45',
                    }}
                    formatter={(value, name, props) => [
                      `${value.toLocaleString('pt-BR')} votos`,
                      props.payload.partido
                    ]}
                  />
                  <Bar dataKey="votos" fill="#1570FF" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico de Pizza - Votos por Partido */}
            <div className={`rounded-lg border p-6 ${
              isDarkMode ? 'bg-[#2A2E45] border-[#3A3E55]' : 'bg-white border-[#E4E9F2]'
            }`}>
              <h3 className={`text-lg font-semibold mb-4 ${
                isDarkMode ? 'text-white' : 'text-[#2A2E45]'
              }`}>
                Distribuição de Votos por Partido
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={dadosProcessados.dadosPartidos}
                    dataKey="votos"
                    nameKey="partido"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    label={(entry) => `${entry.partido} (${((entry.votos / dadosProcessados.totalVotos) * 100).toFixed(1)}%)`}
                    labelLine={true}
                  >
                    {dadosProcessados.dadosPartidos.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={CORES_PARTIDOS[entry.partido] || CORES_GRAFICOS[index % CORES_GRAFICOS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#2A2E45' : '#fff',
                      border: `1px solid ${isDarkMode ? '#3A3E55' : '#E4E9F2'}`,
                      borderRadius: '8px',
                      color: isDarkMode ? '#fff' : '#2A2E45',
                    }}
                    formatter={(value) => `${value.toLocaleString('pt-BR')} votos`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabela de Resultados */}
          <div className={`rounded-lg border overflow-hidden ${
            isDarkMode ? 'bg-[#2A2E45] border-[#3A3E55]' : 'bg-white border-[#E4E9F2]'
          }`}>
            <div className="p-6 border-b ${isDarkMode ? 'border-[#3A3E55]' : 'border-[#E4E9F2]'}">
              <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-[#2A2E45]'}`}>
                Resultados Completos
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={isDarkMode ? 'bg-[#1A1D21]' : 'bg-[#F7F9FC]'}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                    }`}>
                      Posição
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                    }`}>
                      Candidato
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                    }`}>
                      Número
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                    }`}>
                      Partido
                    </th>
                    <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${
                      isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                    }`}>
                      Votos
                    </th>
                    <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${
                      isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'
                    }`}>
                      %
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-[#3A3E55]' : 'divide-[#E4E9F2]'}`}>
                  {dadosProcessados.candidatos.slice(0, 20).map((candidato, index) => (
                    <tr key={index} className={isDarkMode ? 'hover:bg-[#1A1D21]' : 'hover:bg-[#F7F9FC]'}>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                        isDarkMode ? 'text-white' : 'text-[#2A2E45]'
                      }`}>
                        {index + 1}º
                      </td>
                      <td className={`px-6 py-4 text-sm ${
                        isDarkMode ? 'text-[#B0B5C9]' : 'text-[#2A2E45]'
                      }`}>
                        <div className="font-medium">{candidato.nome}</div>
                        <div className={`text-xs ${isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'}`}>
                          {candidato.situacao}
                        </div>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                        isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
                      }`}>
                        {candidato.numero}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span 
                          className="px-2 py-1 rounded text-white text-xs font-medium"
                          style={{
                            backgroundColor: CORES_PARTIDOS[candidato.partido] || '#1570FF'
                          }}
                        >
                          {candidato.partido}
                        </span>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                        isDarkMode ? 'text-white' : 'text-[#2A2E45]'
                      }`}>
                        {candidato.votos.toLocaleString('pt-BR')}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${
                        isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'
                      }`}>
                        {((candidato.votos / dadosProcessados.totalVotos) * 100).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Estado Vazio */}
      {!dadosProcessados && !loading && !error && (
        <div className={`rounded-lg border p-12 text-center ${
          isDarkMode ? 'bg-[#2A2E45] border-[#3A3E55]' : 'bg-white border-[#E4E9F2]'
        }`}>
          <FileText className={`w-16 h-16 mx-auto mb-4 ${
            isDarkMode ? 'text-[#4A4E65]' : 'text-[#E4E9F2]'
          }`} />
          <h3 className={`text-lg font-medium mb-2 ${
            isDarkMode ? 'text-white' : 'text-[#2A2E45]'
          }`}>
            Selecione os filtros para começar
          </h3>
          <p className={`text-sm ${isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'}`}>
            Escolha o estado, município e cargo para visualizar os dados eleitorais detalhados
          </p>
        </div>
      )}
    </div>
  );
};

export default AnaliseEleitoral;