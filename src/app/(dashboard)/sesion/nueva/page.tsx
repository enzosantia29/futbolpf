'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { calcularCargaPF, calcularCargaDT, LABEL_TIPO_DT, INTENSIDAD_LABEL_DT } from '@/utils/carga'
import { INTENSIDAD_DT, type Jugador, type TipoEjercicioPF, type TipoCargaDT } from '@/types'
import { getEquipoActivoCookieId } from '@/lib/equipo-client'

const TIPOS_EJERCICIO: { value: TipoEjercicioPF; label: string }[] = [
  { value: 'fuerza_tren_inferior',   label: 'Fuerza tren inferior' },
  { value: 'fuerza_tren_superior',   label: 'Fuerza tren superior' },
  { value: 'core',                   label: 'Core' },
  { value: 'resistencia_aerobica',   label: 'Resistencia aeróbica' },
  { value: 'resistencia_anaerobica', label: 'Resistencia anaeróbica' },
  { value: 'velocidad',              label: 'Velocidad' },
  { value: 'potencia',               label: 'Potencia' },
  { value: 'recuperacion',           label: 'Recuperación' },
  { value: 'flexibilidad',           label: 'Flexibilidad' },
]

const TIPOS_DT = Object.entries(LABEL_TIPO_DT) as [TipoCargaDT, string][]

export default function NuevaSesionPage() {
  const router = useRouter()
  const supabase = createClient()
  const searchRef = useRef<HTMLInputElement>(null)

  const [equipoId, setEquipoId] = useState('')
  const [jugadores, setJugadores] = useState<Jugador[]>([])
  const [ausentes, setAusentes] = useState<Jugador[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [mostrarResultados, setMostrarResultados] = useState(false)

  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [tiposEjercicio, setTiposEjercicio] = useState<TipoEjercicioPF[]>([])
  const [duracionPF, setDuracionPF] = useState('')
  const [rpe, setRpe] = useState('')

  const [usaDT, setUsaDT] = useState(false)
  const [tipoDT, setTipoDT] = useState<TipoCargaDT>('entrenamiento_futbol')
  const [duracionDT, setDuracionDT] = useState('')

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

  // Jugadores que coinciden con la búsqueda y no están ya marcados como ausentes
  const ausentesIds = new Set(ausentes.map(j => j.id))
  const resultados = busqueda.length > 0
    ? jugadores.filter(j =>
        !ausentesIds.has(j.id) &&
        j.nombre.toLowerCase().includes(busqueda.toLowerCase())
      )
    : []

  function agregarAusente(j: Jugador) {
    setAusentes(prev => [...prev, j])
    setBusqueda('')
    setMostrarResultados(false)
    searchRef.current?.focus()
  }

  function quitarAusente(id: string) {
    setAusentes(prev => prev.filter(j => j.id !== id))
  }

  function toggleEjercicio(tipo: TipoEjercicioPF) {
    setTiposEjercicio(prev =>
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    )
  }

  const presentes = jugadores.filter(j => !ausentesIds.has(j.id))
  const cargaPF = duracionPF && rpe ? calcularCargaPF(Number(rpe), Number(duracionPF)) : 0
  const cargaDT = usaDT && duracionDT ? calcularCargaDT(tipoDT, Number(duracionDT)) : 0
  const cargaTotal = cargaPF + cargaDT

  async function handleGuardar() {
    if (!duracionPF || !rpe) { setError('Completá duración y RPE.'); return }
    if (tiposEjercicio.length === 0) { setError('Seleccioná al menos un tipo de ejercicio.'); return }
    setLoading(true)
    setError('')

    const { data: sesion, error: errSesion } = await supabase
      .from('sesiones')
      .insert({
        equipo_id: equipoId,
        fecha,
        tipo: 'entrenamiento',
        tipos_ejercicio: tiposEjercicio,
        duracion_pf: Number(duracionPF),
        rpe_tipo: 'grupal',
        tipo_dt: usaDT ? tipoDT : null,
        duracion_dt: usaDT && duracionDT ? Number(duracionDT) : null,
        intensidad_dt: usaDT ? INTENSIDAD_DT[tipoDT] : null,
      })
      .select('id')
      .single()

    if (errSesion || !sesion) { setError('Error al guardar la sesión.'); setLoading(false); return }

    const registros = jugadores.map(j => {
      const esAusente = ausentesIds.has(j.id)
      return {
        sesion_id: sesion.id,
        jugador_id: j.id,
        presente: !esAusente,
        rpe: esAusente ? null : Number(rpe),
        carga_pf: esAusente ? 0 : cargaPF,
        carga_dt: esAusente ? 0 : cargaDT,
        carga_total: esAusente ? 0 : cargaTotal,
      }
    })

    await supabase.from('registros').insert(registros)
    router.push('/sesion')
    router.refresh()
  }

  return (
    <div className="px-4 pt-6 pb-6 max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 text-xl">←</button>
        <h1 className="text-xl font-bold text-gray-900">Nuevo entrenamiento</h1>
      </div>

      {/* Fecha */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>

      {/* Buscador de ausentes */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          Ausentes del día
          <span className="text-gray-400 font-normal ml-1">
            ({ausentes.length} ausente{ausentes.length !== 1 ? 's' : ''} · {presentes.length} presentes)
          </span>
        </p>

        {/* Lista de ausentes marcados */}
        {ausentes.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {ausentes.map(j => (
              <span key={j.id} className="flex items-center gap-1 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-1 rounded-full">
                {j.nombre}
                <button
                  type="button"
                  onClick={() => quitarAusente(j.id)}
                  className="text-red-400 hover:text-red-700 font-bold ml-1 leading-none"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Input de búsqueda */}
        <div className="relative">
          <input
            ref={searchRef}
            type="text"
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setMostrarResultados(true) }}
            onFocus={() => setMostrarResultados(true)}
            placeholder="Buscar jugador ausente..."
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />

          {/* Resultados del buscador */}
          {mostrarResultados && resultados.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              {resultados.slice(0, 6).map(j => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => agregarAusente(j)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 flex items-center justify-between border-b border-gray-100 last:border-0"
                >
                  <span className="font-medium text-gray-800">{j.nombre}</span>
                  <span className="text-xs text-red-500">+ marcar ausente</span>
                </button>
              ))}
            </div>
          )}

          {/* Sin resultados */}
          {mostrarResultados && busqueda.length > 0 && resultados.length === 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm text-gray-400">
              No se encontró ningún jugador activo con ese nombre.
            </div>
          )}
        </div>

        {busqueda && (
          <button type="button" onClick={() => { setBusqueda(''); setMostrarResultados(false) }}
            className="text-xs text-gray-400 mt-1 ml-1">
            Limpiar búsqueda
          </button>
        )}
      </div>

      {/* Trabajo del PF */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-800">Trabajo del PF</p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de ejercicio</label>
          <div className="flex flex-wrap gap-2">
            {TIPOS_EJERCICIO.map(t => (
              <button key={t.value} type="button" onClick={() => toggleEjercicio(t.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  tiposEjercicio.includes(t.value)
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-600 border-gray-300'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duración (min)</label>
            <input type="number" value={duracionPF} onChange={e => setDuracionPF(e.target.value)}
              placeholder="60" min="1"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">RPE grupal (1–10)</label>
            <input type="number" value={rpe} onChange={e => setRpe(e.target.value)}
              placeholder="7" min="1" max="10" step="0.5"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>
      </div>

      {/* Trabajo del DT */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">Trabajo del DT</p>
          <button type="button" onClick={() => setUsaDT(v => !v)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              usaDT ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-300'
            }`}>
            {usaDT ? 'Incluido ✓' : '+ Agregar'}
          </button>
        </div>

        {usaDT && (
          <div className="space-y-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de tarea</label>
              <select value={tipoDT} onChange={e => setTipoDT(e.target.value as TipoCargaDT)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {TIPOS_DT.map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <p className="text-xs text-blue-500 mt-1">{INTENSIDAD_LABEL_DT[tipoDT]}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duración DT (min)</label>
              <input type="number" value={duracionDT} onChange={e => setDuracionDT(e.target.value)}
                placeholder="20" min="1"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {duracionDT && (
              <p className="text-xs text-blue-600">
                Carga DT = {INTENSIDAD_DT[tipoDT]} × {duracionDT} min = <strong>{calcularCargaDT(tipoDT, Number(duracionDT))} UA</strong> por jugador presente
              </p>
            )}
          </div>
        )}
      </div>

      {/* Resumen de carga */}
      {cargaTotal > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs font-medium text-green-700 uppercase tracking-wide mb-2">Carga calculada</p>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">PF — {duracionPF} min × RPE {rpe}</span>
            <span className="font-semibold">{cargaPF} UA</span>
          </div>
          {cargaDT > 0 && (
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600">DT — {LABEL_TIPO_DT[tipoDT].split('(')[0].trim()} {duracionDT} min</span>
              <span className="font-semibold">{cargaDT} UA</span>
            </div>
          )}
          <div className="border-t border-green-200 mt-2 pt-2 flex justify-between text-sm font-bold text-green-800">
            <span>Total por jugador presente</span>
            <span>{cargaTotal} UA</span>
          </div>
          <p className="text-xs text-green-600 mt-1">
            Se asigna a {presentes.length} jugador{presentes.length !== 1 ? 'es' : ''}
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <button onClick={handleGuardar} disabled={loading}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium py-3 rounded-xl text-sm transition-colors">
        {loading ? 'Guardando...' : `Guardar sesión (${presentes.length} jugadores)`}
      </button>
    </div>
  )
}
