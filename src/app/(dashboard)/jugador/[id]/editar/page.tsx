'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LABEL_POSICION } from '@/utils/carga'
import { FACTOR_POSICION, type Posicion, type EstadoJugador } from '@/types'

const POSICIONES = Object.keys(LABEL_POSICION) as Posicion[]

const LABEL_ESTADO: Record<EstadoJugador, string> = {
  activo:     'Activo',
  lesionado:  'Lesionado',
  suspendido: 'Suspendido',
  baja:       'Baja',
}

export default function EditarJugadorPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const supabase = createClient()

  const [jugadorId, setJugadorId]   = useState('')
  const [nombre, setNombre]         = useState('')
  const [numero, setNumero]         = useState('')
  const [posicion, setPosicion]     = useState<Posicion>('mediocentro')
  const [fechaNac, setFechaNac]     = useState('')
  const [estado, setEstado]         = useState<EstadoJugador>('activo')
  const [factorPos, setFactorPos]   = useState('')
  const [loading, setLoading]       = useState(false)
  const [cargando, setCargando]     = useState(true)
  const [error, setError]           = useState('')
  const [exito, setExito]           = useState(false)

  useEffect(() => {
    async function cargar() {
      const { id } = await params
      setJugadorId(id)
      const { data } = await supabase.from('jugadores').select('*').eq('id', id).single()
      if (!data) { router.push('/plantel'); return }
      setNombre(data.nombre ?? '')
      setNumero(data.numero?.toString() ?? '')
      setPosicion(data.posicion ?? 'mediocentro')
      setFechaNac(data.fecha_nacimiento ?? '')
      setEstado(data.estado ?? 'activo')
      setFactorPos(data.factor_posicion?.toString() ?? '')
      setCargando(false)
    }
    cargar()
  }, [])

  // Actualiza factor al cambiar posición (solo si el usuario no lo modificó manualmente)
  function handlePosicionChange(p: Posicion) {
    setPosicion(p)
    setFactorPos(FACTOR_POSICION[p].toString())
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    setLoading(true)
    setError('')

    const { error: err } = await supabase
      .from('jugadores')
      .update({
        nombre:           nombre.trim(),
        numero:           numero ? parseInt(numero) : null,
        posicion,
        fecha_nacimiento: fechaNac || null,
        estado,
        factor_posicion:  factorPos ? parseFloat(factorPos) : FACTOR_POSICION[posicion],
      })
      .eq('id', jugadorId)

    if (err) {
      setError('No se pudo guardar. Intentá de nuevo.')
      setLoading(false)
      return
    }

    setExito(true)
    setTimeout(() => {
      router.push(`/jugador/${jugadorId}`)
      router.refresh()
    }, 800)
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Editar jugador</h1>
          <p className="text-sm text-gray-500">{nombre}</p>
        </div>
      </div>

      <form onSubmit={handleGuardar} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
          <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} required
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
            <input type="number" value={numero} onChange={e => setNumero(e.target.value)}
              placeholder="10" min="1" max="99"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de nac.</label>
            <input type="date" value={fechaNac} onChange={e => setFechaNac(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Posición</label>
          <select value={posicion} onChange={e => handlePosicionChange(e.target.value as Posicion)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
            {POSICIONES.map(p => (
              <option key={p} value={p}>{LABEL_POSICION[p]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(LABEL_ESTADO) as EstadoJugador[]).map(e => (
              <button key={e} type="button" onClick={() => setEstado(e)}
                className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  estado === e
                    ? e === 'activo'     ? 'bg-green-600 text-white border-green-600'
                    : e === 'lesionado'  ? 'bg-red-500 text-white border-red-500'
                    : e === 'suspendido' ? 'bg-yellow-500 text-white border-yellow-500'
                    :                     'bg-gray-500 text-white border-gray-500'
                    : 'bg-white text-gray-600 border-gray-300'
                }`}>
                {LABEL_ESTADO[e]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Factor de posición
            <span className="text-gray-400 font-normal ml-1">(ajusta carga en partidos)</span>
          </label>
          <input type="number" value={factorPos} onChange={e => setFactorPos(e.target.value)}
            step="0.05" min="0.5" max="1.5"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          <p className="text-xs text-gray-400 mt-1">
            Por defecto: {FACTOR_POSICION[posicion]} para {LABEL_POSICION[posicion].toLowerCase()}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <button type="submit" disabled={loading || !nombre.trim()}
          className={`w-full font-medium py-3 rounded-xl text-sm transition-colors ${
            exito
              ? 'bg-green-100 text-green-700 border border-green-300'
              : 'bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white'
          }`}>
          {exito ? 'Guardado' : loading ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  )
}
