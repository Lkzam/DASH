import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Resultados oficiais finais da eleição presidencial 2022 (TSE)
// Fonte: https://resultados.tse.jus.br
// Dados imutáveis — eleição já encerrada.
const RESULTADOS_2022 = {
  1: [
    // 1º turno — 2 de outubro de 2022
    { name: 'Lula',           votos: 57259504, fill: '#E74C3C' },
    { name: 'Jair Bolsonaro', votos: 51072345, fill: '#3498DB' },
    { name: 'Simone Tebet',   votos: 4915423,  fill: '#F39C12' },
    { name: 'Ciro Gomes',     votos: 3599287,  fill: '#2ECC71' },
    { name: 'Outros',         votos: 2496945,  fill: '#95A5A6' },
  ],
  2: [
    // 2º turno — 30 de outubro de 2022
    { name: 'Lula',           votos: 60345999, fill: '#E74C3C' },
    { name: 'Jair Bolsonaro', votos: 58206354, fill: '#3498DB' },
    { name: 'Branco',         votos: 2402358,  fill: '#BDC3C7' },
    { name: 'Nulo',           votos: 3838884,  fill: '#7F8C8D' },
  ],
};

export default function ElectionChart({ round }) {
  const turno = round === 2 ? 2 : 1;
  const chartData = RESULTADOS_2022[turno];

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
              padding: '8px 12px',
            }}
            labelStyle={{ fontWeight: 600, marginBottom: 4 }}
          />
          <Bar dataKey="votos" radius={[8, 8, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
