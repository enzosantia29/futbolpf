'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LABEL_POSICION } from '@/utils/carga'
import { FACTOR_POSICION, type Posicion } from '@/types'
import { getEquipoActivoCookieId } from '@/lib/equipo-client'

const POSICIONES = Object.keys(LABEL_POSICION) as Posicion[]

export default function NuevoJugadorPage() {
  const [nombre, setNombre] = useState('')
  const [numero, setNumero] = useState('')
  const [posicion, setPosicion] = useState<Posicion>('mediocentro')
  const [fechaNac, setFechaNac] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: equipos } = await supabase
      .from('equipos').select('id').eq('user_id', user.id).order('created_at').limit(2)
    if (!equipos?.length) { setError('No se encontró el equipo.'); setLoading(false); return }

    const cookieId = getEquipoActivoCookieId()
    const equipo = cookieId ? equipos.find(e => e.id === cookieId) ?? equipos[0] : equipos[0]

    const { error: err } = await supabase.from('jugadores').insert({
      equipo_id: equipo.id,
      nombre: nombre.trim(),
      numero: numero ? parseInt(numero) : null,
      posicion,
      fecha_nacimiento: fechaNac || null,
      estado: 'activo',
      factor_posicion: FACTOR_POSICION[posicion],
    })

    if (err) {
      setError('No se pudo guardar. Intentá de nuevo.')
      setLoading(false)
      return
    }

    router.push('/plantel')
    router.refresh()
  }

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nuevo jugador</h1>
          <p className="text-sm text-gray-500">Completá los datos del jugador</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            required
            placeholder="Ej: Juan Pérez"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
            <input
              type="number"
              value={numero}
              onChange={e => setNumero(e.target.value)}
              placeholder="10"
              min="1" max="99"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de nac.</label>
            <input
              type="date"
              value={fechaNac}
              onChange={e => setFechaNac(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Posición *</label>
          <select
            value={posicion}
            onChange={e => setPosicion(e.target.value as Posicion)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          >
            {POSICIONES.map(p => (
              <option key={p} value={p}>
                {LABEL_POSICION[p]} (factor {FACTOR_POSICION[p]})
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">
            El factor de posición ajusta la carga en los partidos según el rol en el campo.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading || !nombre.trim()}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium py-3 rounded-xl text-sm transition-colors"
        >
          {loading ? 'Guardando...' : 'Guardar jugador'}
        </button>
      </form>
    </div>
  )
}
