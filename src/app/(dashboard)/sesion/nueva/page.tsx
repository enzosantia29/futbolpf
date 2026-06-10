'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { calcularCargaPF, calcularCargaDT, LABEL_TIPO_DT, INTENSIDAD_LABEL_DT } from '@/utils/carga'
import { INTENSIDAD_DT, type Jugador, type TipoEjercicioPF, type TipoCargaDT } from '@/types'
import { getEquipoActivoCookieId } from '@/lib/equipo-client'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type GrupoConfig = {
  id: string
  nombre: string
  tiposEjercicio: TipoEjercicioPF[]
  duracionPF: string
  rpe: string
  usaDT: boolean
  tipoDT: TipoCargaDT
  duracionDT: string
}

function grupoBase(): GrupoConfig {
  return { id: 'base', nombre: 'Base', tiposEjercicio: [], duracionPF: '', rpe: '', usaDT: false, tipoDT: 'entrenamiento_futbol', duracionDT: '' }
}

function grupoNuevo(n: number): GrupoConfig {
  return { id: `g_${n}_${Date.now()}`, nombre: `Grupo ${n}`, tiposEjercicio: [], duracionPF: '', rpe: '', usaDT: false, tipoDT: 'entrenamiento_futbol', duracionDT: '' }
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPOS_EJERCICIO: { value: TipoEjercicioPF; label: string }[] = [
  { value: 'fuerza_tren_inferior',   label: 'Fuerza tren inf.' },
  { value: 'fuerza_tren_superior',   label: 'Fuerza tren sup.' },
  { value: 'core',                   label: 'Core' },
  { value: 'resistencia_aerobica',   label: 'Resistencia aeróbica' },
  { value: 'resistencia_anaerobica', label: 'Resistencia anaeróbica' },
  { value: 'velocidad',              label: 'Velocidad' },
  { value: 'potencia',               label: 'Potencia' },
  { value: 'recuperacion',           label: 'Recuperación' },
  { value: 'flexibilidad',           label: 'Flexibilidad' },
]

const TIPOS_DT = Object.entries(LABEL_TIPO_DT) as [TipoCargaDT, string][]

// ─── Página principal ─────────────────────────────────────────────────────────

export default function NuevaSesionPage() {
  const router = useRouter()
  const supabase = createClient()

  const [equipoId, setEquipoId]         = useState('')
  const [jugadores, setJugadores]       = useState<Jugador[]>([])
  const [ausentes, setAusentes]         = useState<Jugador[]>([])
  const [fecha, setFecha]               = useState(new Date().toISOString().split('T')[0])
  const [grupos, setGrupos]             = useState<GrupoConfig[]>([grupoBase()])
  const [asignaciones, setAsignaciones] = useState<Record<string, string>>({}) // jugadorId → grupoId
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')

  const modoGrupos = grupos.length > 1

  useEffect(() => {
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: eqs } = await supabase.from('equipos').select('id').eq('user_id', user.id).order('created_at').limit(2)
      if (!eqs?.length) return
      const cookieId = getEquipoActivoCookieId()
      const eq = cookieId ? eqs.find(e => e.id === cookieId) ?? eqs[0] : eqs[0]
      setEquipoId(eq.id)
      const { data: jug } = await supabase.from('jugadores').select('*').eq('equipo_id', eq.id).eq('estado', 'activo').order('nombre')
      setJugadores(jug ?? [])
    }
    cargar()
  }, [])

  const ausentesIds = new Set(ausentes.map(j => j.id))
  const presentes   = jugadores.filter(j => !ausentesIds.has(j.id))

  // ─── Ausentes ───────────────────────────────────────────────────────────────

  function agregarAusente(j: Jugador) {
    setAusentes(prev => [...prev, j])
    setAsignaciones(prev => { const n = { ...prev }; delete n[j.id]; return n })
  }

  // ─── Grupos ─────────────────────────────────────────────────────────────────

  function agregarGrupo() {
    setGrupos(prev => [...prev, grupoNuevo(prev.length)])
  }

  function eliminarGrupo(id: string) {
    setGrupos(prev => prev.filter(g => g.id !== id))
    setAsignaciones(prev => {
      const n = { ...prev }
      Object.keys(n).forEach(jid => { if (n[jid] === id) delete n[jid] })
      return n
    })
  }

  function updateGrupo(id: string, patch: Partial<GrupoConfig>) {
    setGrupos(prev => prev.map(g => g.id === id ? { ...g, ...patch } : g))
  }

  function toggleEjercicioGrupo(grupoId: string, tipo: TipoEjercicioPF) {
    setGrupos(prev => prev.map(g => {
      if (g.id !== grupoId) return g
      const tiene = g.tiposEjercicio.includes(tipo)
      return { ...g, tiposEjercicio: tiene ? g.tiposEjercicio.filter(t => t !== tipo) : [...g.tiposEjercicio, tipo] }
    }))
  }

  // ─── Asignaciones ────────────────────────────────────────────────────────────

  function asignarJugador(jugadorId: string, grupoId: string) {
    setAsignaciones(prev => ({ ...prev, [jugadorId]: grupoId }))
  }

  function desasignarJugador(jugadorId: string) {
    setAsignaciones(prev => { const n = { ...prev }; delete n[jugadorId]; return n })
  }

  function jugadoresDeGrupo(grupoId: string): Jugador[] {
    if (grupoId === 'base') return presentes.filter(j => !asignaciones[j.id])
    return jugadores.filter(j => asignaciones[j.id] === grupoId)
  }

  // Jugadores disponibles para asignar (presentes y sin grupo extra asignado aún)
  const disponiblesParaAsignar = presentes.filter(j => !asignaciones[j.id])

  // ─── Carga por grupo ─────────────────────────────────────────────────────────

  function cargaGrupo(g: GrupoConfig) {
    const pf = g.duracionPF && g.rpe ? calcularCargaPF(Number(g.rpe), Number(g.duracionPF)) : 0
    const dt = g.usaDT && g.duracionDT ? calcularCargaDT(g.tipoDT, Number(g.duracionDT)) : 0
    return { pf, dt, total: pf + dt }
  }

  // ─── Guardar ─────────────────────────────────────────────────────────────────

  async function handleGuardar() {
    const base = grupos[0]
    if (!base.duracionPF || !base.rpe) { setError('Completá duración y RPE del grupo base.'); return }
    if (base.tiposEjercicio.length === 0) { setError('Seleccioná al menos un tipo de ejercicio para el grupo base.'); return }

    for (const g of grupos.slice(1)) {
      if (!g.duracionPF || !g.rpe) { setError(`Completá duración y RPE del ${g.nombre}.`); return }
      if (g.tiposEjercicio.length === 0) { setError(`Seleccioná tipo de ejercicio para ${g.nombre}.`); return }
    }

    setLoading(true)
    setError('')

    const { data: sesion, error: errSesion } = await supabase
      .from('sesiones')
      .insert({
        equipo_id: equipoId,
        fecha,
        tipo: 'entrenamiento',
        tipos_ejercicio: base.tiposEjercicio,
        duracion_pf: Number(base.duracionPF),
        rpe_tipo: modoGrupos ? 'subgrupo' : 'grupal',
        tipo_dt: base.usaDT ? base.tipoDT : null,
        duracion_dt: base.usaDT && base.duracionDT ? Number(base.duracionDT) : null,
        intensidad_dt: base.usaDT ? INTENSIDAD_DT[base.tipoDT] : null,
      })
      .select('id').single()

    if (errSesion || !sesion) { setError('Error al guardar la sesión.'); setLoading(false); return }

    const registros = jugadores.map(j => {
      if (ausentesIds.has(j.id)) {
        return { sesion_id: sesion.id, jugador_id: j.id, presente: false, rpe: null, carga_pf: 0, carga_dt: 0, carga_total: 0, grupo: null }
      }
      const grupoId = asignaciones[j.id] ?? 'base'
      const g = grupos.find(gr => gr.id === grupoId) ?? base
      const { pf, dt, total } = cargaGrupo(g)
      return {
        sesion_id: sesion.id, jugador_id: j.id, presente: true,
        rpe: Number(g.rpe), carga_pf: pf, carga_dt: dt, carga_total: total,
        grupo: g.id === 'base' ? null : g.nombre,
      }
    })

    await supabase.from('registros').insert(registros)
    router.push('/sesion')
    router.refresh()
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="px-4 pt-6 pb-6 max-w-lg mx-auto space-y-5">
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

      {/* Ausentes */}
      <AusentesSelector
        jugadores={jugadores}
        ausentes={ausentes}
        ausentesIds={ausentesIds}
        onAgregar={agregarAusente}
        onQuitar={id => setAusentes(prev => prev.filter(j => j.id !== id))}
      />

      {/* Grupos de trabajo */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Grupos de trabajo</p>
            {modoGrupos && (
              <p className="text-xs text-gray-400 mt-0.5">
                {presentes.length} presentes · {jugadoresDeGrupo('base').length} en base · {disponiblesParaAsignar.length} sin asignar
              </p>
            )}
          </div>
          {grupos.length < 4 && (
            <button type="button" onClick={agregarGrupo}
              className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-xl font-medium transition-colors">
              + Grupo
            </button>
          )}
        </div>

        {grupos.map(g => (
          <GrupoCard
            key={g.id}
            grupo={g}
            esBase={g.id === 'base'}
            modoGrupos={modoGrupos}
            jugadoresAsignados={jugadoresDeGrupo(g.id)}
            jugadoresDisponibles={disponiblesParaAsignar}
            carga={cargaGrupo(g)}
            onUpdate={patch => updateGrupo(g.id, patch)}
            onToggleEjercicio={tipo => toggleEjercicioGrupo(g.id, tipo)}
            onEliminar={g.id !== 'base' ? () => eliminarGrupo(g.id) : undefined}
            onAsignarJugador={jid => asignarJugador(jid, g.id)}
            onDesasignarJugador={desasignarJugador}
          />
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <button onClick={handleGuardar} disabled={loading}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium py-3 rounded-xl text-sm transition-colors">
        {loading ? 'Guardando...' : `Guardar sesión (${presentes.length} presentes)`}
      </button>
    </div>
  )
}

// ─── AusentesSelector ─────────────────────────────────────────────────────────

function AusentesSelector({ jugadores, ausentes, ausentesIds, onAgregar, onQuitar }: {
  jugadores: Jugador[]
  ausentes: Jugador[]
  ausentesIds: Set<string>
  onAgregar: (j: Jugador) => void
  onQuitar: (id: string) => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto]   = useState(false)
  const resultados = busqueda.length > 0
    ? jugadores.filter(j => !ausentesIds.has(j.id) && j.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : []

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">
        Ausentes del día
        <span className="text-gray-400 font-normal ml-1">
          ({ausentes.length} ausente{ausentes.length !== 1 ? 's' : ''} · {jugadores.length - ausentes.length} presentes)
        </span>
      </p>
      {ausentes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {ausentes.map(j => (
            <span key={j.id} className="flex items-center gap-1 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-1 rounded-full">
              {j.nombre}
              <button type="button" onClick={() => onQuitar(j.id)} className="text-red-400 hover:text-red-700 font-bold ml-1 leading-none">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input type="text" value={busqueda}
          onChange={e => { setBusqueda(e.target.value); setAbierto(true) }}
          onFocus={() => setAbierto(true)}
          placeholder="Buscar jugador ausente..."
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
        {abierto && resultados.length > 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {resultados.slice(0, 6).map(j => (
              <button key={j.id} type="button"
                onClick={() => { onAgregar(j); setBusqueda(''); setAbierto(false) }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 flex items-center justify-between border-b border-gray-100 last:border-0">
                <span className="font-medium">{j.nombre}</span>
                <span className="text-xs text-red-500">+ ausente</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {busqueda && <button type="button" onClick={() => { setBusqueda(''); setAbierto(false) }} className="text-xs text-gray-400 mt-1 ml-1">Limpiar</button>}
    </div>
  )
}

// ─── GrupoCard ────────────────────────────────────────────────────────────────

function GrupoCard({ grupo, esBase, modoGrupos, jugadoresAsignados, jugadoresDisponibles, carga, onUpdate, onToggleEjercicio, onEliminar, onAsignarJugador, onDesasignarJugador }: {
  grupo: GrupoConfig
  esBase: boolean
  modoGrupos: boolean
  jugadoresAsignados: Jugador[]
  jugadoresDisponibles: Jugador[]
  carga: { pf: number; dt: number; total: number }
  onUpdate: (p: Partial<GrupoConfig>) => void
  onToggleEjercicio: (t: TipoEjercicioPF) => void
  onEliminar?: () => void
  onAsignarJugador: (id: string) => void
  onDesasignarJugador: (id: string) => void
}) {
  const [busqJug, setBusqJug]   = useState('')
  const [busqOpen, setBusqOpen] = useState(false)
  const resultadosJug = busqJug.length > 0
    ? jugadoresDisponibles.filter(j => j.nombre.toLowerCase().includes(busqJug.toLowerCase()))
    : jugadoresDisponibles.slice(0, 6)

  const borderColor = esBase ? 'border-green-200' : 'border-blue-200'
  const bgHeader    = esBase ? 'bg-green-50'      : 'bg-blue-50'
  const textColor   = esBase ? 'text-green-700'   : 'text-blue-700'

  return (
    <div className={`border-2 ${borderColor} rounded-2xl overflow-hidden`}>
      {/* Header */}
      <div className={`${bgHeader} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {esBase ? (
            <span className={`text-sm font-bold ${textColor}`}>
              {modoGrupos ? `Base — ${jugadoresAsignados.length} jugadores` : 'Trabajo del día'}
            </span>
          ) : (
            <input
              type="text" value={grupo.nombre}
              onChange={e => onUpdate({ nombre: e.target.value })}
              className={`bg-transparent text-sm font-bold ${textColor} focus:outline-none border-b border-transparent focus:border-blue-400 min-w-0 flex-1`}
              placeholder="Nombre del grupo"
            />
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {carga.total > 0 && (
            <span className="text-xs font-bold text-gray-700 bg-white px-2.5 py-0.5 rounded-full border border-gray-200">
              {carga.total} UA
            </span>
          )}
          {onEliminar && (
            <button type="button" onClick={onEliminar} className="text-gray-400 hover:text-red-500 text-xl leading-none transition-colors">×</button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* PF */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Trabajo PF</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {TIPOS_EJERCICIO.map(t => (
              <button key={t.value} type="button" onClick={() => onToggleEjercicio(t.value)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  grupo.tiposEjercicio.includes(t.value)
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-600 border-gray-300'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Duración (min)</label>
              <input type="number" value={grupo.duracionPF} onChange={e => onUpdate({ duracionPF: e.target.value })}
                placeholder="60" min="1"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">RPE (1–10)</label>
              <input type="number" value={grupo.rpe} onChange={e => onUpdate({ rpe: e.target.value })}
                placeholder="7" min="1" max="10" step="0.5"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
        </div>

        {/* DT */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Trabajo DT</p>
            <button type="button" onClick={() => onUpdate({ usaDT: !grupo.usaDT })}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                grupo.usaDT ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-300'
              }`}>
              {grupo.usaDT ? 'Incluido ✓' : '+ Agregar'}
            </button>
          </div>
          {grupo.usaDT && (
            <div className="space-y-2 bg-blue-50 rounded-xl p-3">
              <select value={grupo.tipoDT} onChange={e => onUpdate({ tipoDT: e.target.value as TipoCargaDT })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {TIPOS_DT.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
              </select>
              <p className="text-xs text-blue-500">{INTENSIDAD_LABEL_DT[grupo.tipoDT]}</p>
              <input type="number" value={grupo.duracionDT} onChange={e => onUpdate({ duracionDT: e.target.value })}
                placeholder="Duración DT (min)" min="1"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {grupo.duracionDT && (
                <p className="text-xs text-blue-600">
                  DT = {INTENSIDAD_DT[grupo.tipoDT]} × {grupo.duracionDT} min = <strong>{calcularCargaDT(grupo.tipoDT, Number(grupo.duracionDT))} UA</strong>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Resumen de carga */}
        {carga.total > 0 && (
          <div className="bg-gray-50 rounded-xl px-3 py-2 flex justify-between text-xs">
            <span className="text-gray-500">
              PF {carga.pf} UA{carga.dt > 0 ? ` + DT ${carga.dt} UA` : ''}
            </span>
            <span className="font-bold text-gray-800">{carga.total} UA / jugador</span>
          </div>
        )}

        {/* Jugadores asignados (solo grupos no-base en modo grupos) */}
        {modoGrupos && !esBase && (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Jugadores {jugadoresAsignados.length > 0 ? `(${jugadoresAsignados.length})` : ''}
            </p>

            {jugadoresAsignados.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {jugadoresAsignados.map(j => (
                  <span key={j.id} className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full">
                    {j.nombre.split(' ')[0]}
                    <button type="button" onClick={() => onDesasignarJugador(j.id)}
                      className="text-blue-400 hover:text-blue-700 font-bold leading-none ml-0.5">×</button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <input type="text" value={busqJug}
                onChange={e => { setBusqJug(e.target.value); setBusqOpen(true) }}
                onFocus={() => setBusqOpen(true)}
                placeholder={jugadoresDisponibles.length > 0 ? '+ Agregar jugador a este grupo...' : 'Sin jugadores disponibles'}
                disabled={jugadoresDisponibles.length === 0}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-400"
              />
              {busqOpen && resultadosJug.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  {resultadosJug.map(j => (
                    <button key={j.id} type="button"
                      onClick={() => { onAsignarJugador(j.id); setBusqJug(''); setBusqOpen(false) }}
                      className="w-full text-left px-4 py-2 text-xs hover:bg-blue-50 flex justify-between border-b border-gray-100 last:border-0">
                      <span className="font-medium text-gray-800">{j.nombre}</span>
                      <span className="text-blue-500">+ agregar</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {busqJug && <button type="button" onClick={() => { setBusqJug(''); setBusqOpen(false) }} className="text-xs text-gray-400 mt-1 ml-1">Limpiar</button>}
          </div>
        )}
      </div>
    </div>
  )
}
