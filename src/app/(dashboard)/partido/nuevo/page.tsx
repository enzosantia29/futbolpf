'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { calcularCargaPartido, LABEL_POSICION } from '@/utils/carga'
import type { Jugador, Posicion } from '@/types'
import { getEquipoActivoCookieId } from '@/lib/equipo-client'

export default function NuevoPartidoPage() {
  const router = useRouter()
  const supabase = createClient()

  const [equipoId, setEquipoId] = useState('')
  const [jugadores, setJugadores] = useState<Jugador[]>([])
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [rival, setRival] = useState('')
  const [rpePartido, setRpePartido] = useState('8')

  const [minutos, setMinutos] = useState<Record<string, string>>({})
  const [tarjetas, setTarjetas] = useState<Record<string, { amarilla: boolean; roja: boolean }>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: equipos } = await supabase.from('equipos').select('id').eq('user_id', user.id).order('created_at').limit(2)
      if (!equipos?.length) return
      const cookieId = getEquipoActivoCookieId()
      const eq = cookieId ? equipos.find(e => e.id === cookieId) ?? equipos[0] : equipos[0]
      setEquipoId(eq.id)
      const { data: jug } = await supabase
        .from('jugadores').select('*').eq('equipo_id', eq.id).eq('estado', 'activo').order('nombre')
      setJugadores(jug ?? [])
    }
    cargar()
  }, [])

  function setMin(id: string, val: string) {
    setMinutos(prev => ({ ...prev, [id]: val }))
  }

  function toggleTarjeta(id: string, tipo: 'amarilla' | 'roja') {
    setTarjetas(prev => ({
      ...prev,
      [id]: {
        amarilla: prev[id]?.amarilla ?? false,
        roja: prev[id]?.roja ?? false,
        [tipo]: !(prev[id]?.[tipo] ?? false),
      }
    }))
  }

  const rpe = Number(rpePartido) || 8

  function getCarga(j: Jugador) {
    const min = Number(minutos[j.id]) || 0
    if (min === 0) return 0
    return Math.round(calcularCargaPartido(rpe, min, j.posicion as Posicion, j.factor_posicion))
  }

  const umbral = 90 * 0.75
  const grupoA = jugadores.filter(j => Number(minutos[j.id] || 0) >= umbral)
  const grupoB = jugadores.filter(j => {
    const min = Number(minutos[j.id] || 0)
    return min > 0 && min < umbral
  })

  async function handleGuardar() {
    if (!rpePartido) { setError('Ingresá el RPE del partido.'); return }
    setLoading(true)
    setError('')

    const { data: sesion, error: errSes } = await supabase
      .from('sesiones')
      .insert({
        equipo_id: equipoId,
        fecha,
        tipo: 'partido',
        rival: rival.trim() || null,
        rpe_partido: rpe,
      })
      .select('id')
      .single()

    if (errSes || !sesion) { setError('Error al guardar el partido.'); setLoading(false); return }

    const registros = jugadores.map(j => {
      const min = Number(minutos[j.id]) || 0
      const carga = getCarga(j)
      const card = tarjetas[j.id] ?? {}
      return {
        sesion_id: sesion.id,
        jugador_id: j.id,
        presente: min > 0,
        minutos_jugados: min,
        rpe: min > 0 ? rpe : null,
        carga_pf: carga,
        carga_dt: 0,
        carga_total: carga,
        tarjeta_amarilla: card.amarilla ?? false,
        tarjeta_roja: card.roja ?? false,
      }
    })

    await supabase.from('registros').insert(registros)
    router.push('/sesion')
    router.refresh()
  }

  return (
    <div className="px-4 pt-6 pb-6 max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 text-xl">←</button>
        <h1 className="text-xl font-bold text-gray-900">Registrar partido</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">RPE partido (1–10)</label>
          <input type="number" value={rpePartido} onChange={e => setRpePartido(e.target.value)}
            min="1" max="10" step="0.5"
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Rival (opcional)</label>
        <input type="text" value={rival} onChange={e => setRival(e.target.value)}
          placeholder="Ej: Independiente"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Minutos + tarjetas por jugador */}
      <div>
        <p className="text-sm font-semibold text-gray-800 mb-1">Minutos y tarjetas</p>
        <p className="text-xs text-gray-400 mb-3">Dejá en 0 si no participó. Tocá 🟡 o 🔴 si recibió tarjeta.</p>
        <div className="space-y-2">
          {jugadores.map(j => {
            const carga = getCarga(j)
            const card = tarjetas[j.id] ?? {}
            return (
              <div key={j.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{j.nombre}</p>
                  <p className="text-xs text-gray-400">{LABEL_POSICION[j.posicion as Posicion]}</p>
                </div>

                {/* Tarjetas */}
                <button
                  type="button"
                  onClick={() => toggleTarjeta(j.id, 'amarilla')}
                  className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-colors ${
                    card.amarilla ? 'bg-yellow-400' : 'bg-gray-100 opacity-40'
                  }`}
                  title="Tarjeta amarilla"
                >
                  🟡
                </button>
                <button
                  type="button"
                  onClick={() => toggleTarjeta(j.id, 'roja')}
                  className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-colors ${
                    card.roja ? 'bg-red-400' : 'bg-gray-100 opacity-40'
                  }`}
                  title="Tarjeta roja"
                >
                  🔴
                </button>

                <input
                  type="number"
                  value={minutos[j.id] ?? ''}
                  onChange={e => setMin(j.id, e.target.value)}
                  placeholder="0"
                  min="0" max="120"
                  className="w-14 text-center border border-gray-300 rounded-lg px-1 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400 w-12 text-right">
                  {carga > 0 ? `${carga} UA` : '—'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Grupos A/B */}
      {(grupoA.length > 0 || grupoB.length > 0) && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Grupos para mañana</p>
          {grupoA.length > 0 && (
            <div>
              <span className="text-xs font-medium text-orange-600">Grupo A (jugaron +{Math.round(umbral)} min):</span>
              <span className="text-xs text-gray-700 ml-1">{grupoA.map(j => j.nombre).join(', ')}</span>
            </div>
          )}
          {grupoB.length > 0 && (
            <div>
              <span className="text-xs font-medium text-blue-600">Grupo B (jugaron menos):</span>
              <span className="text-xs text-gray-700 ml-1">{grupoB.map(j => j.nombre).join(', ')}</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <button
        onClick={handleGuardar}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 rounded-xl text-sm transition-colors"
      >
        {loading ? 'Guardando...' : 'Guardar partido'}
      </button>
    </div>
  )
}
