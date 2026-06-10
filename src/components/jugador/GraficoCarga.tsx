'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'

interface Semana {
  semana: string
  carga: number
  sesiones: number
}

export default function GraficoCarga({ data }: { data: Semana[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        Sin datos suficientes para el gráfico.
      </div>
    )
  }

  const promedio = Math.round(data.reduce((a, d) => a + d.carga, 0) / data.length)

  return (
    <div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(val) => [`${val} UA`, 'Carga']}
            labelFormatter={(label) => `Semana ${label}`}
          />
          <ReferenceLine y={promedio} stroke="#16a34a" strokeDasharray="4 2"
            label={{ value: `Prom. ${promedio}`, position: 'right', fontSize: 10, fill: '#16a34a' }} />
          <Bar dataKey="carga" fill="#16a34a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-400 text-center mt-1">Unidades Arbitrarias (UA) por semana</p>
    </div>
  )
}
