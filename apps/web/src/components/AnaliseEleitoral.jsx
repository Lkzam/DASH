import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useDarkMode } from '../contexts/DarkModeContext';
import { Search, TrendingUp, Users, Award, MapPin, FileText, Filter } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

// Cabeçalho de autorização com o JWT da sessão Supabase (paywall server-side).
async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
}

// ─── Constantes ──────────────────────────────────────────────────────────────

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

const CORES_PARTIDOS = {
  PT: '#E41E26', PL: '#1E4D8B', PSOL: '#FFD700', PSDB: '#005BAA',
  PDT: '#FF6B00', MDB: '#00923F', 'UNIÃO': '#0066CC', PP: '#0080FF',
  REPUBLICANOS: '#009CDE', PSB: '#FF8C00', PV: '#00A651',
  CIDADANIA: '#9933CC', PODE: '#FF6600', SOLIDARIEDADE: '#FF8040',
  AVANTE: '#FF6B35', 'PCdoB': '#8B0000',
};

const CORES_GRAFICOS = ['#1570FF', '#E74C3C', '#2ECC71', '#F39C12', '#9B59B6', '#3498DB', '#E67E22', '#1ABC9C'];

// ─── Componente ──────────────────────────────────────────────────────────────

const AnaliseEleitoral = () => {
  const { isDarkMode } = useDarkMode();

  // Filtros
  const [estadoSelecionado, setEstadoSelecionado] = useState('');
  const [cargoSelecionado, setCargoSelecionado] = useState('6');

  // municipios: [{ nome: string, codigo: string }]
  const [municipios, setMunicipios] = useState([]);
  const [municipioSelecionado, setMunicipioSelecionado] = useState(''); // nome do município

  // Resultados
  const [dadosProcessados, setDadosProcessados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Carregar municípios ao mudar estado ou cargo ────────────────────────────
  const carregarMunicipios = useCallback(async () => {
    if (!estadoSelecionado) return;
    setLoading(true);
    setError(null);
    setMunicipios([]);
    setMunicipioSelecionado('');
    setDadosProcessados(null);

    try {
      const res = await fetch(
        `/api/electoral/municipios?uf=${estadoSelecionado}&cargo=${cargoSelecionado}`,
        { headers: await authHeaders() }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setMunicipios(json); // [{ nome, codigo }]
    } catch (err) {
      console.error('[AnaliseEleitoral] erro ao carregar municípios:', err);
      setError('Não foi possível carregar os municípios. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [estadoSelecionado, cargoSelecionado]);

  useEffect(() => {
    if (estadoSelecionado) {
      carregarMunicipios();
    } else {
      setMunicipios([]);
      setMunicipioSelecionado('');
      setDadosProcessados(null);
    }
  }, [estadoSelecionado, cargoSelecionado]);

  // ── Buscar dados de candidatos ──────────────────────────────────────────────
  const buscarDados = async () => {
    if (!estadoSelecionado || !municipioSelecionado || !cargoSelecionado) {
      setError('Por favor, selecione Estado, Município e Cargo.');
      return;
    }

    // Encontrar código TSE do município selecionado
    const municipioObj = municipios.find((m) => m.nome === municipioSelecionado);
    if (!municipioObj) {
      setError('Município não encontrado na lista.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/electoral/candidatos?uf=${estadoSelecionado}&municipio=${encodeURIComponent(municipioObj.codigo)}&cargo=${cargoSelecionado}`,
        { headers: await authHeaders() }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

      const { candidatos, totalVotos } = json;

      if (!candidatos || candidatos.length === 0) {
        setError('Nenhum dado encontrado para os filtros selecionados.');
        setDadosProcessados(null);
        return;
      }

      // Top 10
      const top10 = candidatos.slice(0, 10);

      // Votos por partido
      const votosPorPartidoMap = {};
      candidatos.forEach((c) => {
        if (!c.partido) return;
        if (!votosPorPartidoMap[c.partido]) {
          votosPorPartidoMap[c.partido] = { partido: c.partido, votos: 0, candidatos: 0 };
        }
        votosPorPartidoMap[c.partido].votos += c.votos;
        votosPorPartidoMap[c.partido].candidatos++;
      });
      const dadosPartidos = Object.values(votosPorPartidoMap)
        .sort((a, b) => b.votos - a.votos)
        .slice(0, 10);

      setDadosProcessados({
        candidatos,
        top10,
        totalVotos,
        totalCandidatos: candidatos.length,
        maisVotado: candidatos[0],
        dadosPartidos,
        cargo: CARGOS.find((c) => c.codigo === cargoSelecionado)?.nome,
      });
    } catch (err) {
      console.error('[AnaliseEleitoral] erro ao buscar candidatos:', err);
      setError('Erro ao carregar dados: ' + err.message);
      setDadosProcessados(null);
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full p-6 space-y-6 overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-[#2A2E45]'}`}>
            Análise Eleitoral por Município
          </h1>
          <p className={`text-sm mt-1 ${isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'}`}>
            Selecione o estado, município e cargo para visualizar os dados eleitorais
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#1570FF]/10 text-[#1570FF] border border-[#1570FF]/20 whitespace-nowrap">
          📊 Eleições Gerais 2022 — Dados Oficiais TSE
        </span>
      </div>

      {/* Filtros */}
      <div className={`rounded-lg border p-6 ${isDarkMode ? 'bg-[#2A2E45] border-[#3A3E55]' : 'bg-white border-[#E4E9F2]'}`}>
        <div className="flex items-center gap-2 mb-4">
          <Filter className={`w-5 h-5 ${isDarkMode ? 'text-[#4A90E2]' : 'text-[#1570FF]'}`} />
          <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-[#2A2E45]'}`}>
            Filtros
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Estado */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'}`}>
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
              {ESTADOS.map((estado) => (
                <option key={estado.sigla} value={estado.sigla}>
                  {estado.sigla} - {estado.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Cargo — antes do município para que mudar o cargo recarregue a lista */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'}`}>
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
              {CARGOS.map((cargo) => (
                <option key={cargo.codigo} value={cargo.codigo}>
                  {cargo.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Município */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'}`}>
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
              <option value="">
                {loading && !dadosProcessados
                  ? 'Carregando municípios...'
                  : municipios.length === 0 && estadoSelecionado
                  ? 'Nenhum município encontrado'
                  : 'Selecione o Município'}
              </option>
              {municipios.map((m) => (
                <option key={m.codigo} value={m.nome}>
                  {m.nome}
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
              {loading && dadosProcessados === null && municipioSelecionado ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Buscando...
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

        {/* Erro */}
        {error && (
          <div className="mt-4 px-4 py-3 rounded-lg bg-red-50 text-red-600 border border-red-200 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Resultados */}
      {dadosProcessados && (
        <>
          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total de Votos"
              value={dadosProcessados.totalVotos.toLocaleString('pt-BR')}
              sub="votos válidos"
              icon={<TrendingUp className={`w-5 h-5 ${isDarkMode ? 'text-[#4A90E2]' : 'text-[#1570FF]'}`} />}
              isDarkMode={isDarkMode}
            />
            <StatCard
              label="Candidatos"
              value={dadosProcessados.totalCandidatos}
              sub="candidatos votados"
              icon={<Users className={`w-5 h-5 ${isDarkMode ? 'text-[#4A90E2]' : 'text-[#1570FF]'}`} />}
              isDarkMode={isDarkMode}
            />
            <StatCard
              label="Mais Votado"
              value={dadosProcessados.maisVotado.nome}
              sub={`${dadosProcessados.maisVotado.partido} — ${dadosProcessados.maisVotado.votos.toLocaleString('pt-BR')} votos`}
              icon={<Award className="w-5 h-5 text-[#F39C12]" />}
              isDarkMode={isDarkMode}
              valueClass="text-lg truncate"
            />
            <StatCard
              label="Localização"
              value={municipioSelecionado}
              sub={`${estadoSelecionado} — ${dadosProcessados.cargo}`}
              icon={<MapPin className={`w-5 h-5 ${isDarkMode ? 'text-[#4A90E2]' : 'text-[#1570FF]'}`} />}
              isDarkMode={isDarkMode}
              valueClass="text-lg"
            />
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 10 candidatos */}
            <div className={`rounded-lg border p-6 ${isDarkMode ? 'bg-[#2A2E45] border-[#3A3E55]' : 'bg-white border-[#E4E9F2]'}`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-[#2A2E45]'}`}>
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
                    formatter={(value, _name, props) => [
                      `${value.toLocaleString('pt-BR')} votos`,
                      props.payload.partido,
                    ]}
                  />
                  <Bar dataKey="votos" fill="#1570FF" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Distribuição por partido */}
            <div className={`rounded-lg border p-6 ${isDarkMode ? 'bg-[#2A2E45] border-[#3A3E55]' : 'bg-white border-[#E4E9F2]'}`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-[#2A2E45]'}`}>
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
                    label={(entry) =>
                      `${entry.partido} (${((entry.votos / dadosProcessados.totalVotos) * 100).toFixed(1)}%)`
                    }
                    labelLine
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

          {/* Tabela completa */}
          <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-[#2A2E45] border-[#3A3E55]' : 'bg-white border-[#E4E9F2]'}`}>
            <div className={`p-6 border-b ${isDarkMode ? 'border-[#3A3E55]' : 'border-[#E4E9F2]'}`}>
              <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-[#2A2E45]'}`}>
                Resultados Completos
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={isDarkMode ? 'bg-[#1A1D21]' : 'bg-[#F7F9FC]'}>
                  <tr>
                    {['Posição', 'Candidato', 'Número', 'Partido', 'Votos', '%'].map((h, i) => (
                      <th
                        key={h}
                        className={`px-6 py-3 text-xs font-medium uppercase tracking-wider ${
                          i >= 4 ? 'text-right' : 'text-left'
                        } ${isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-[#3A3E55]' : 'divide-[#E4E9F2]'}`}>
                  {dadosProcessados.candidatos.slice(0, 50).map((candidato, index) => (
                    <tr key={index} className={isDarkMode ? 'hover:bg-[#1A1D21]' : 'hover:bg-[#F7F9FC]'}>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDarkMode ? 'text-white' : 'text-[#2A2E45]'}`}>
                        {index + 1}º
                      </td>
                      <td className={`px-6 py-4 text-sm ${isDarkMode ? 'text-[#B0B5C9]' : 'text-[#2A2E45]'}`}>
                        <div className="font-medium">{candidato.nome}</div>
                        {candidato.situacao && (
                          <div className={`text-xs ${isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'}`}>
                            {candidato.situacao}
                          </div>
                        )}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'}`}>
                        {candidato.numero}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className="px-2 py-1 rounded text-white text-xs font-medium"
                          style={{ backgroundColor: CORES_PARTIDOS[candidato.partido] || '#1570FF' }}
                        >
                          {candidato.partido}
                        </span>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${isDarkMode ? 'text-white' : 'text-[#2A2E45]'}`}>
                        {candidato.votos.toLocaleString('pt-BR')}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${isDarkMode ? 'text-[#B0B5C9]' : 'text-[#6F7689]'}`}>
                        {dadosProcessados.totalVotos > 0
                          ? ((candidato.votos / dadosProcessados.totalVotos) * 100).toFixed(2)
                          : '0.00'}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Estado vazio */}
      {!dadosProcessados && !loading && !error && (
        <div className={`rounded-lg border p-12 text-center ${isDarkMode ? 'bg-[#2A2E45] border-[#3A3E55]' : 'bg-white border-[#E4E9F2]'}`}>
          <FileText className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-[#4A4E65]' : 'text-[#E4E9F2]'}`} />
          <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-[#2A2E45]'}`}>
            Selecione os filtros para começar
          </h3>
          <p className={`text-sm ${isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'}`}>
            Escolha o estado, cargo e município para visualizar os dados eleitorais detalhados
          </p>
        </div>
      )}

      {/* Loading geral */}
      {loading && !dadosProcessados && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-[#1570FF] border-t-transparent rounded-full animate-spin" />
            <span className={`text-sm ${isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'}`}>
              Carregando dados...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Sub-componente: card de estatística ─────────────────────────────────────
function StatCard({ label, value, sub, icon, isDarkMode, valueClass = 'text-2xl font-bold' }) {
  return (
    <div className={`rounded-lg border p-4 ${isDarkMode ? 'bg-[#2A2E45] border-[#3A3E55]' : 'bg-white border-[#E4E9F2]'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`text-sm ${isDarkMode ? 'text-[#B0B5C9]' : 'text-[#8A8FA6]'}`}>{label}</div>
        {icon}
      </div>
      <div className={`${valueClass} ${isDarkMode ? 'text-white' : 'text-[#2A2E45]'}`}>{value}</div>
      <div className={`text-xs mt-1 ${isDarkMode ? 'text-[#8A8FA6]' : 'text-[#6F7689]'}`}>{sub}</div>
    </div>
  );
}

export default AnaliseEleitoral;
