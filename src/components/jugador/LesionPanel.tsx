'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { TipoLesion } from '@/types'

const TIPOS_LESION: { value: TipoLesion; label: string; icon: string }[] = [
  { value: 'muscular',   label: 'Muscular',    icon: '💪' },
  { value: 'articular',  label: 'Articular',   icon: '🦵' },
  { value: 'traumatica', label: 'Traumática',  icon: '🤕' },
  { value: 'otra',       label: 'Otra',        icon: '🏥' },
]

interface LesionActiva {
  id: string
  tipo: TipoLesion
  fecha_inicio: string
  fecha_retorno_estimada: string | null
  notas: string | null
}

interface Props {
  jugadorId: string
  lesionActiva: LesionActiva | null
}

export default function LesionPanel({ jugadorId, lesionActiva }: Props) {
  const supabase = createClient()
  const router = useRouter()

  const [modo, setModo] = useState<'idle' | 'nueva' | 'cerrar'>('idle')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Nueva lesión
  const [tipo, setTipo] = useState<TipoLesion>('muscular')
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0])
  const [fechaRetorno, setFechaRetorno] = useState('')
  const [notas, setNotas] = useState('')

  // Cerrar lesión
  const [fechaAlta, setFechaAlta] = useState(new Date().toISOString().split('T')[0])

  async function handleNuevaLesion() {
    setLoading(true)
    setError('')
    const { error: err } = await supabase.from('lesiones').insert({
      jugador_id: jugadorId,
      tipo,
      fecha_inicio: fechaInicio,
      fecha_retorno_estimada: fechaRetorno || null,
      notas: notas || null,
      activa: true,
    })
    if (err) { setError('Error al guardar la lesión.'); setLoading(false); return }

    // Actualizar estado del jugador a lesionado
    await supabase.from('jugadores').update({ estado: 'lesionado' }).eq('id', jugadorId)
    router.refresh()
    setModo('idle')
    setLoading(false)
  }

  async function handleCerrarLesion() {
    if (!lesionActiva) return
    setLoading(true)
    setError('')
    const { error: err } = await supabase.from('lesiones').update({
      activa: false,
      fecha_retorno_estimada: fechaAlta,
    }).eq('id', lesionActiva.id)
    if (err) { setError('Error al dar de alta.'); setLoading(false); return }

    // Volver estado del jugador a activo
    await supabase.from('jugadores').update({ estado: 'activo' }).eq('id', jugadorId)
    router.refresh()
    setModo('idle')
    setLoading(false)
  }

  if (lesionActiva) {
    return (
      <div className="space-y-3">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-red-700">
                {TIPOS_LESION.find(t => t.value === lesionActiva.tipo)?.icon} Lesión activa — {TIPOS_LESION.find(t => t.value === lesionActiva.tipo)?.label}
              </p>
              <p className="text-xs text-red-500 mt-1">
                Desde {new Date(lesionActiva.fecha_inicio + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
              </p>
              {lesionActiva.fecha_retorno_estimada && (
                <p className="text-xs text-red-400 mt-0.5">
                  Retorno estimado: {new Date(lesionActiva.fecha_retorno_estimada + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
                </p>
              )}
              {lesionActiva.notas && (
                <p className="text-xs text-red-400 mt-1 italic">"{lesionActiva.notas}"</p>
              )}
            </div>
          </div>
        </div>

        {modo === 'idle' && (
          <button
            onClick={() => setModo('cerrar')}
            className="w-full border border-green-300 text-green-700 bg-green-50 font-medium py-2.5 rounded-xl text-sm hover:bg-green-100 transition-colors"
          >
            ✅ Dar de alta — jugador recuperado
          </button>
        )}

        {modo === 'cerrar' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-green-800">Confirmar alta médica</p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha de retorno real</label>
              <input
                type="date"
                value={fechaAlta}
                onChange={e => setFechaAlta(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setModo('idle')} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm">
                Cancelar
              </button>
              <button
                onClick={handleCerrarLesion}
                disabled={loading}
                className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {loading ? 'Guardando...' : 'Confirmar alta'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {modo === 'idle' && (
        <button
          onClick={() => setModo('nueva')}
          className="w-full border border-red-300 text-red-600 bg-white font-medium py-2.5 rounded-xl text-sm hover:bg-red-50 transition-colors"
        >
          🏥 Registrar lesión
        </button>
      )}

      {modo === 'nueva' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-red-800">Nueva lesión</p>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Tipo de lesión</label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS_LESION.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTipo(t.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors ${
                    tipo === t.value
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-gray-600 border-gray-300'
                  }`}
                >
                  <span>{t.icon}</span> {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha de inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={e => setFechaInicio(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Retorno estimado</label>
              <input
                type="date"
                value={fechaRetorno}
                onChange={e => setFechaRetorno(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Zona afectada, contexto..."
              rows={2}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button onClick={() => setModo('idle')} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm">
              Cancelar
            </button>
            <button
              onClick={handleNuevaLesion}
              disabled={loading}
              className="flex-1 bg-red-600 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar lesión'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
