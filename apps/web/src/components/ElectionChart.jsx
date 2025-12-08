import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function ElectionChart({ round }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['election', round],
    queryFn: async () => {
      const endpoint = round === 1 ? '/api/first-round' : '/api/second-round';
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch election data');
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-[#1570FF] border-t-transparent rounded-full animate-spin"></div>
          <div className="text-[#8A8FA6]">Carregando dados...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="text-red-500 font-medium mb-2">Erro ao carregar dados</div>
          <div className="text-[#8A8FA6] text-sm">{error.message}</div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-[#8A8FA6]">Nenhum dado disponível</div>
      </div>
    );
  }

  // Pegar a última linha (resultado final)
  const finalData = data[data.length - 1];
  
  let chartData = [];
  
  if (round === 2) {
    // Segundo turno - usar colunas específicas
    const lulaVotes = parseInt(finalData['LULA_QT_VOTOS_TOT_ACUMULADO']) || 0;
    const bolsonaroVotes = parseInt(finalData['JAIR_BOLSONARO_QT_VOTOS_TOT_ACUMULADO']) || 0;
    const brancoVotes = parseInt(finalData['BRANCO_QT_VOTOS_TOT_ACUMULADO']) || 0;
    const nuloVotes = parseInt(finalData['NULO_QT_VOTOS_TOT_ACUMULADO']) || 0;
    
    chartData = [
      { name: 'Lula', votos: lulaVotes, fill: '#E74C3C' },
      { name: 'Jair Bolsonaro', votos: bolsonaroVotes, fill: '#3498DB' },
      { name: 'Branco', votos: brancoVotes, fill: '#95A5A6' },
      { name: 'Nulo', votos: nuloVotes, fill: '#7F8C8D' },
    ];
  } else {
    // Primeiro turno - processar todos os candidatos
    // Precisaríamos de uma lógica diferente aqui baseada na estrutura do CSV do 1º turno
    // Por enquanto, usar dados de exemplo
    chartData = [
      { name: 'Candidato 1', votos: 50000000, fill: '#E74C3C' },
      { name: 'Candidato 2', votos: 45000000, fill: '#3498DB' },
      { name: 'Candidato 3', votos: 30000000, fill: '#2ECC71' },
      { name: 'Outros', votos: 20000000, fill: '#95A5A6' },
    ];
  }

  return (
    <div className="w-full h-full p-6">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={chartData} 
          margin={{ top: 20, right: 30, left: 60, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E4E9F2" />
          <XAxis 
            dataKey="name" 
            angle={-45}
            textAnchor="end"
            height={100}
            interval={0}
            tick={{ fill: '#6F7689', fontSize: 12 }}
          />
          <YAxis 
            tick={{ fill: '#6F7689' }}
            tickFormatter={(value) => {
              if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
              if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
              return value;
            }}
          />
          <Tooltip 
            formatter={(value) => [value.toLocaleString('pt-BR'), 'Votos']}
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '1px solid #E4E9F2',
              borderRadius: '8px',
              padding: '8px 12px'
            }}
            labelStyle={{ fontWeight: 600, marginBottom: 4 }}
          />
          <Bar 
            dataKey="votos" 
            radius={[8, 8, 0, 0]}
            label={{ position: 'top', fill: '#6F7689', fontSize: 11 }}
          >
            {chartData.map((entry, index) => (
              <Bar key={`cell-${index}`} dataKey="votos" fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}