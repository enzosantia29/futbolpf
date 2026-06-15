'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { guardarWellness } from './actions'

const PREGUNTAS = [
  { key: 'sueno',  label: 'Calidad del sueño',  bajo: 'Muy malo',      alto: 'Excelente' },
  { key: 'fatiga', label: 'Fatiga muscular',     bajo: 'Muy fatigado',  alto: 'Descansado' },
  { key: 'dolor',  label: 'Dolor / molestias',  bajo: 'Mucho dolor',   alto: 'Sin dolor' },
  { key: 'estres', label: 'Estrés',             bajo: 'Muy estresado', alto: 'Tranquilo' },
  { key: 'humor',  label: 'Humor general',       bajo: 'Muy bajo',      alto: 'Excelente' },
] as const

type Campo = typeof PREGUNTAS[number]['key']
type Valores = Record<Campo, number>

const BTN_ON: Record<number, string> = {
  1: 'bg-red-500 text-white ring-red-400',
  2: 'bg-orange-400 text-white ring-orange-400',
  3: 'bg-yellow-400 text-gray-800 ring-yellow-400',
  4: 'bg-lime-400 text-gray-800 ring-lime-400',
  5: 'bg-green-500 text-white ring-green-400',
}

function scoreInfo(s: number): { label: string; color: string; dot: string } {
  if (s >= 20) return { label: 'Excelente', color: 'text-green-600',  dot: 'bg-green-500' }
  if (s >= 15) return { label: 'Bien',      color: 'text-lime-600',   dot: 'bg-lime-400' }
  if (s >= 10) return { label: 'Regular',   color: 'text-orange-500', dot: 'bg-orange-400' }
  return              { label: 'Bajo',       color: 'text-red-500',    dot: 'bg-red-500' }
}

export default function WellnessForm({
  jugadorId,
  equipoId,
  existente,
}: {
  jugadorId: string
  equipoId: string
  existente: Valores | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [vals, setVals] = useState<Partial<Valores>>(existente ?? {})

  const completo = PREGUNTAS.every(p => vals[p.key] !== undefined)
  const score    = completo ? PREGUNTAS.reduce((acc, p) => acc + (vals[p.key] ?? 0), 0) : null
  const info     = score !== null ? scoreInfo(score) : null

  function handleSubmit() {
    if (!completo) return
    setError('')
    startTransition(async () => {
      try {
        await guardarWellness({
          jugadorId, equipoId,
          sueno:  vals.sueno!,
          fatiga: vals.fatiga!,
          dolor:  vals.dolor!,
          estres: vals.estres!,
          humor:  vals.humor!,
        })
        router.push(`/jugador/${jugadorId}`)
        router.refresh()
      } catch {
        setError('No se pudo guardar. Intentá de nuevo.')
      }
    })
  }

  return (
    <div className="space-y-4">

      {PREGUNTAS.map(p => (
        <div key={p.key} className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-gray-800 mb-3">{p.label}</p>
          <div className="flex gap-2">
            {([1, 2, 3, 4, 5] as const).map(n => (
              <button
                key={n}
                onClick={() => setVals(prev => ({ ...prev, [p.key]: n }))}
                className={`flex-1 h-11 rounded-xl text-sm font-bold transition-all ${
                  vals[p.key] === n
                    ? `${BTN_ON[n]} ring-2 ring-offset-1 scale-105`
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200 active:bg-gray-300'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-gray-400">{p.bajo}</span>
            <span className="text-[10px] text-gray-400">{p.alto}</span>
          </div>
        </div>
      ))}

      {/* Score en tiempo real */}
      {score !== null && info && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">Score wellness</span>
          <div className="text-right">
            <p className={`text-2xl font-bold ${info.color}`}>
              {score}<span className="text-sm font-normal text-gray-400">/25</span>
            </p>
            <p className={`text-xs font-semibold ${info.color}`}>{info.label}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!completo || isPending}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3.5 rounded-2xl text-sm transition-colors"
      >
        {isPending ? 'Guardando...' : existente ? 'Actualizar wellness' : 'Guardar wellness'}
      </button>
    </div>
  )
}
