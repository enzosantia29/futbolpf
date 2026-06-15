'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  calcularCargaPF,
  calcularCargaDT,
  calcularCargaPartido,
  LABEL_TIPO_DT,
  INTENSIDAD_LABEL_DT,
} from '@/utils/carga'
import { INTENSIDAD_DT, type TipoEjercicioPF, type TipoCargaDT, type Posicion } from '@/types'

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

type GrupoEdit = {
  nombre: string
  rpe: string
  duracion: string
  registroIds: string[]
}

export default function EditarSesionPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const supabase = createClient()

  const [sesionId, setSesionId]       = useState('')
  const [cargando, setCargando]       = useState(true)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Campos generales
  const [tipo, setTipo]   = useState<'entrenamiento' | 'partido'>('entrenamiento')
  const [fecha, setFecha] = useState('')

  // Partido
  const [rpePartido, setRpePartido] = useState('8')
  const [rival, setRival]           = useState('')

  // Entrenamiento — grupal
  const [modoGrupos, setModoGrupos]       = useState(false)
  const [tiposEjercicio, setTiposEjercicio] = useState<TipoEjercicioPF[]>([])
  const [duracionPF, setDuracionPF]       = useState('')
  const [rpe, setRpe]                     = useState('')

  // Entrenamiento — subgrupos
  const [grupos, setGrupos] = useState<GrupoEdit[]>([])

  // Trabajo DT
  const [usaDT, setUsaDT]       = useState(false)
  const [tipoDT, setTipoDT]     = useState<TipoCargaDT>('entrenamiento_futbol')
  const [duracionDT, setDuracionDT] = useState('')

  useEffect(() => {
    async function cargar() {
      const { id } = await params
      setSesionId(id)

      const { data: sesion } = await supabase.from('sesiones').select('*').eq('id', id).single()
      if (!sesion) { router.push('/sesion'); return }

      setTipo(sesion.tipo)
      setFecha(sesion.fecha)

      if (sesion.tipo === 'partido') {
        setRpePartido(sesion.rpe_partido?.toString() ?? '8')
        setRival(sesion.rival ?? '')
      } else {
        setTiposEjercicio((sesion.tipos_ejercicio as TipoEjercicioPF[]) ?? [])
        setDuracionPF(sesion.duracion_pf?.toString() ?? '')
        setUsaDT(!!sesion.tipo_dt)
        if (sesion.tipo_dt)   setTipoDT(sesion.tipo_dt as TipoCargaDT)
        if (sesion.duracion_dt) setDuracionDT(sesion.duracion_dt.toString())

        const esSubgrupo = sesion.rpe_tipo === 'subgrupo'
        setModoGrupos(esSubgrupo)

        const { data: regs } = await supabase
          .from('registros')
          .select('id, grupo, rpe, carga_pf, presente')
          .eq('sesion_id', id)
          .eq('presente', true)

        if (esSubgrupo) {
          const gruposMap: Record<string, GrupoEdit> = {}
          for (const r of regs ?? []) {
            const key = r.grupo ?? 'Base'
            if (!gruposMap[key]) {
              const inferDur = r.rpe && r.rpe > 0 ? Math.round((r.carga_pf ?? 0) / r.rpe) : 0
              gruposMap[key] = { nombre: key, rpe: r.rpe?.toString() ?? '', duracion: inferDur.toString(), registroIds: [] }
            }
            gruposMap[key].registroIds.push(r.id)
          }
          const ordered: GrupoEdit[] = []
          if (gruposMap['Base']) ordered.push(gruposMap['Base'])
          Object.keys(gruposMap).filter(k => k !== 'Base').forEach(k => ordered.push(gruposMap[k]))
          setGrupos(ordered)
        } else {
          const primer = regs?.[0]
          if (primer) setRpe(primer.rpe?.toString() ?? '')
        }
      }

      setCargando(false)
    }
    cargar()
  }, [])

  function toggleEjercicio(t: TipoEjercicioPF) {
    setTiposEjercicio(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  function updateGrupo(idx: number, patch: Partial<GrupoEdit>) {
    setGrupos(prev => prev.map((g, i) => i === idx ? { ...g, ...patch } : g))
  }

  async function handleGuardar() {
    setLoading(true)
    setError('')

    try {
      if (tipo === 'partido') {
        await supabase.from('sesiones').update({
          fecha,
          rival: rival.trim() || null,
          rpe_partido: Number(rpePartido) || 8,
        }).eq('id', sesionId)

        const rpeNum = Number(rpePartido) || 8
        const { data: regs } = await supabase
          .from('registros')
          .select('id, minutos_jugados, jugadores(posicion, factor_posicion)')
          .eq('sesion_id', sesionId)
          .eq('presente', true)

        for (const r of regs ?? []) {
          const jug = r.jugadores as unknown as { posicion: string; factor_posicion: number } | null
          const min = r.minutos_jugados ?? 0
          const carga = Math.round(calcularCargaPartido(rpeNum, min, jug?.posicion as Posicion, jug?.factor_posicion))
          await supabase.from('registros').update({ rpe: rpeNum, carga_pf: carga, carga_total: carga }).eq('id', r.id)
        }
      } else if (!modoGrupos) {
        if (!duracionPF || !rpe) { setError('Completá duración y RPE.'); setLoading(false); return }

        const rpeNum    = Number(rpe)
        const durNum    = Number(duracionPF)
        const cargaPF   = calcularCargaPF(rpeNum, durNum)
        const cargaDT   = usaDT && duracionDT ? calcularCargaDT(tipoDT, Number(duracionDT)) : 0
        const cargaTotal = cargaPF + cargaDT

        await supabase.from('sesiones').update({
          fecha,
          tipos_ejercicio: tiposEjercicio,
          duracion_pf:   durNum,
          tipo_dt:       usaDT ? tipoDT : null,
          duracion_dt:   usaDT && duracionDT ? Number(duracionDT) : null,
          intensidad_dt: usaDT ? INTENSIDAD_DT[tipoDT] : null,
        }).eq('id', sesionId)

        await supabase.from('registros').update({
          rpe: rpeNum, carga_pf: cargaPF, carga_dt: cargaDT, carga_total: cargaTotal,
        }).eq('sesion_id', sesionId).eq('presente', true)
      } else {
        // Subgrupos
        const dtCarga = usaDT && duracionDT ? calcularCargaDT(tipoDT, Number(duracionDT)) : 0

        await supabase.from('sesiones').update({
          fecha,
          tipos_ejercicio: tiposEjercicio,
          tipo_dt:       usaDT ? tipoDT : null,
          duracion_dt:   usaDT && duracionDT ? Number(duracionDT) : null,
          intensidad_dt: usaDT ? INTENSIDAD_DT[tipoDT] : null,
        }).eq('id', sesionId)

        for (const g of grupos) {
          if (!g.rpe || !g.duracion || g.registroIds.length === 0) continue
          const rpeNum    = Number(g.rpe)
          const durNum    = Number(g.duracion)
          const cargaPF   = calcularCargaPF(rpeNum, durNum)
          const cargaTotal = cargaPF + dtCarga
          await supabase.from('registros').update({
            rpe: rpeNum, carga_pf: cargaPF, carga_dt: dtCarga, carga_total: cargaTotal,
          }).in('id', g.registroIds)
        }
      }

      router.push(`/sesion/${sesionId}`)
      router.refresh()
    } catch {
      setError('Error al guardar. Intentá de nuevo.')
      setLoading(false)
    }
  }

  async function handleBorrar() {
    setLoading(true)
    await supabase.from('registros').delete().eq('sesion_id', sesionId)
    await supabase.from('sesiones').delete().eq('id', sesionId)
    router.push('/sesion')
    router.refresh()
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto pb-8 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 text-xl">←</button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Editar sesión</h1>
          <p className="text-sm text-gray-500">{tipo === 'partido' ? 'Partido' : 'Entrenamiento'}</p>
        </div>
      </div>

      {/* Fecha */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>

      {/* ── PARTIDO ── */}
      {tipo === 'partido' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RPE del partido (1–10)</label>
              <input type="number" value={rpePartido} onChange={e => setRpePartido(e.target.value)}
                min="1" max="10" step="0.5"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rival</label>
              <input type="text" value={rival} onChange={e => setRival(e.target.value)}
                placeholder="Opcional"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <p className="text-xs text-gray-400 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
            Los minutos por jugador no se editan acá. Si necesitás corregirlos, borrá el partido y cargalo de nuevo.
          </p>
        </>
      )}

      {/* ── ENTRENAMIENTO ── */}
      {tipo === 'entrenamiento' && (
        <>
          {/* Tipos de ejercicio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipos de ejercicio</label>
            <div className="flex flex-wrap gap-1.5">
              {TIPOS_EJERCICIO.map(t => (
                <button key={t.value} type="button" onClick={() => toggleEjercicio(t.value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    tiposEjercicio.includes(t.value)
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-gray-600 border-gray-300'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grupal */}
          {!modoGrupos && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duración PF (min)</label>
                <input type="number" value={duracionPF} onChange={e => setDuracionPF(e.target.value)}
                  min="1" placeholder="60"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RPE (1–10)</label>
                <input type="number" value={rpe} onChange={e => setRpe(e.target.value)}
                  min="1" max="10" step="0.5" placeholder="7"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
          )}

          {/* Subgrupos */}
          {modoGrupos && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Grupos</p>
              {grupos.map((g, idx) => (
                <div key={g.nombre} className={`border-2 rounded-2xl overflow-hidden ${idx === 0 ? 'border-green-200' : 'border-blue-200'}`}>
                  <div className={`px-4 py-2.5 ${idx === 0 ? 'bg-green-50' : 'bg-blue-50'}`}>
                    <span className={`text-sm font-bold ${idx === 0 ? 'text-green-700' : 'text-blue-700'}`}>
                      {g.nombre} · {g.registroIds.length} jugadores
                    </span>
                  </div>
                  <div className="p-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Duración (min)</label>
                      <input type="number" value={g.duracion} onChange={e => updateGrupo(idx, { duracion: e.target.value })}
                        min="1" placeholder="60"
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">RPE (1–10)</label>
                      <input type="number" value={g.rpe} onChange={e => updateGrupo(idx, { rpe: e.target.value })}
                        min="1" max="10" step="0.5" placeholder="7"
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Trabajo DT */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Trabajo DT</p>
              <button type="button" onClick={() => setUsaDT(!usaDT)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  usaDT ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-300'
                }`}>
                {usaDT ? 'Incluido ✓' : '+ Agregar'}
              </button>
            </div>
            {usaDT && (
              <div className="space-y-2 bg-blue-50 rounded-xl p-3">
                <select value={tipoDT} onChange={e => setTipoDT(e.target.value as TipoCargaDT)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {TIPOS_DT.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                </select>
                <p className="text-xs text-blue-500">{INTENSIDAD_LABEL_DT[tipoDT]}</p>
                <input type="number" value={duracionDT} onChange={e => setDuracionDT(e.target.value)}
                  placeholder="Duración DT (min)" min="1"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
          </div>
        </>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <button onClick={handleGuardar} disabled={loading}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium py-3 rounded-xl text-sm transition-colors">
        {loading ? 'Guardando...' : 'Guardar cambios'}
      </button>

      {/* Zona de peligro — borrar */}
      <div className="border border-red-100 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Zona de peligro</p>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}
            className="text-sm text-red-600 hover:text-red-700 font-medium">
            Borrar esta sesión
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-red-700 font-medium">
              ¿Seguro? Se eliminarán todos los registros de carga de esta fecha.
            </p>
            <div className="flex gap-2">
              <button onClick={handleBorrar} disabled={loading}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
                Sí, borrar sesión
              </button>
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 border border-gray-300 text-sm text-gray-600 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
