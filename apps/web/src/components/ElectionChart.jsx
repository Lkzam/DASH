import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Papa from 'papaparse';

export default function ElectionChart({ round }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Carregar CSV direto do public/data ou /data
        const filename = round === 1 
          ? 'Historico_Totalizacao_Presidente_BR_1T_2022.csv'
          : 'Historico_Totalizacao_Presidente_BR_2T_2022.csv';
        
        // Tentar diferentes caminhos
        const paths = [
          `/data/${filename}`,
          `/public/data/${filename}`,
        ];
        
        let csvText = null;
        let loadedPath = null;
        
        for (const path of paths) {
          try {
            const response = await fetch(path);
            if (response.ok) {
              csvText = await response.text();
              loadedPath = path;
              console.log(`✅ CSV carregado de: ${path}`);
              break;
            }
          } catch (err) {
            console.log(`❌ Falhou em: ${path}`);
          }
        }
        
        if (!csvText) {
          throw new Error('CSV não encontrado. Verifique se os arquivos estão em apps/web/public/data/');
        }
        
        // Parse do CSV
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          delimiter: ';',
          transformHeader: (header) => header.trim(),
          complete: (results) => {
            console.log(`✅ CSV parseado: ${results.data.length} linhas`);
            setData(results.data);
            setIsLoading(false);
          },
          error: (err) => {
            console.error('❌ Erro ao parsear CSV:', err);
            setError(err.message);
            setIsLoading(false);
          }
        });
        
      } catch (err) {
        console.error('❌ Erro ao carregar CSV:', err);
        setError(err.message);
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [round]);

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
        <div className="text-center max-w-md">
          <div className="text-red-500 font-medium mb-2">Erro ao carregar dados</div>
          <div className="text-[#8A8FA6] text-sm mb-4">{error}</div>
          <div className="text-xs text-[#8A8FA6] bg-gray-50 p-3 rounded">
            <p className="font-medium mb-2">Instruções:</p>
            <ol className="text-left list-decimal list-inside space-y-1">
              <li>Os arquivos CSV devem estar em <code className="bg-gray-200 px-1">apps/web/public/data/</code></li>
              <li>Certifique-se que a pasta <code className="bg-gray-200 px-1">public</code> existe</li>
              <li>Mova os CSVs de <code className="bg-gray-200 px-1">data/</code> para <code className="bg-gray-200 px-1">public/data/</code></li>
            </ol>
          </div>
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
    // Primeiro turno
    chartData = [
      { name: 'Lula', votos: 57259504, fill: '#E74C3C' },
      { name: 'Jair Bolsonaro', votos: 51072345, fill: '#3498DB' },
      { name: 'Ciro Gomes', votos: 3599287, fill: '#2ECC71' },
      { name: 'Simone Tebet', votos: 4915423, fill: '#F39C12' },
      { name: 'Outros', votos: 2500000, fill: '#95A5A6' },
    ];
  }

  return (
    <div className="w-full h-full p-6">
      <ResponsiveContainer width="100%" height="100%" minHeight={400}>
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
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}