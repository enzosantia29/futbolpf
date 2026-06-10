'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function NuevoEquipoPage() {
  const [nombre, setNombre] = useState('')
  const [nombrePF, setNombrePF] = useState('')
  const [temporada, setTemporada] = useState('2026')
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

    // Verificar límite de 2 equipos
    const { data: existentes } = await supabase
      .from('equipos').select('id').eq('user_id', user.id)
    if (existentes && existentes.length >= 2) {
      setError('Ya tenés 2 categorías. Máximo 2 por cuenta.')
      setLoading(false)
      return
    }

    const insertData: Record<string, unknown> = {
      nombre: nombre.trim(),
      temporada_activa: temporada,
      user_id: user.id,
    }
    if (nombrePF.trim()) insertData.nombre_pf = nombrePF.trim()

    const { error: err } = await supabase.from('equipos').insert(insertData)

    if (err) {
      if (err.code === '42703') {
        // Columna no existe → SQL pendiente
        setError('Falta ejecutar la migración SQL en Supabase. Corrés el ALTER TABLE de supabase_schema.sql y volvés a intentar.')
      } else {
        setError(`Error: ${err.message}`)
      }
      setLoading(false)
      return
    }

    router.push('/plantel')
    router.refresh()
  }

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Crear equipo</h1>
        <p className="text-sm text-gray-500 mt-1">Configurá los datos básicos para empezar.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del equipo / club *</label>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            required
            placeholder="Ej: Club Atlético Rivadavia"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Temporada activa</label>
          <input
            type="text"
            value={temporada}
            onChange={e => setTemporada(e.target.value)}
            required
            placeholder="2026"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tu nombre <span className="text-gray-400 font-normal">(Preparador Físico, opcional)</span>
          </label>
          <input
            type="text"
            value={nombrePF}
            onChange={e => setNombrePF(e.target.value)}
            placeholder="Ej: Juan Manuel Pérez"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="text-xs text-gray-400 mt-1">Aparece al pie de los reportes Excel.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !nombre.trim()}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium py-3 rounded-xl text-sm transition-colors"
        >
          {loading ? 'Creando...' : 'Crear equipo'}
        </button>
      </form>
    </div>
  )
}
