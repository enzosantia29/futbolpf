import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LABEL_TIPO_DT } from '@/utils/carga'
import type { TipoCargaDT } from '@/types'
import Link from 'next/link'

const LABEL_EJERCICIO: Record<string, string> = {
  fuerza_tren_inferior:   'Fuerza inf.',
  fuerza_tren_superior:   'Fuerza sup.',
  core:                   'Core',
  resistencia_aerobica:   'Res. aeróbica',
  resistencia_anaerobica: 'Res. anaeróbica',
  velocidad:              'Velocidad',
  potencia:               'Potencia',
  recuperacion:           'Recuperación',
  flexibilidad:           'Flexibilidad',
}

export default async function DetalleSesionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: sesion } = await supabase
    .from('sesiones').select('*').eq('id', id).single()
  if (!sesion) redirect('/sesion')

  const { data: registros } = await supabase
    .from('registros')
    .select('*, jugadores(id, nombre, numero, posicion)')
    .eq('sesion_id', id)
    .order('jugadores(nombre)')

  const presentes = (registros ?? []).filter(r => r.presente)
  const ausentes  = (registros ?? []).filter(r => !r.presente)

  const esPartido  = sesion.tipo === 'partido'
  const modoGrupos = sesion.rpe_tipo === 'subgrupo'

  const totalCarga = presentes.reduce((acc, r) => acc + (r.carga_total ?? 0), 0)
  const promCarga  = presentes.length > 0 ? Math.round(totalCarga / presentes.length) : 0

  // Agrupar presentes por grupo (null → 'Base')
  const gruposMap: Record<string, typeof presentes> = {}
  if (modoGrupos) {
    for (const r of presentes) {
      const key = r.grupo ?? 'Base'
      if (!gruposMap[key]) gruposMap[key] = []
      gruposMap[key].push(r)
    }
    // Base primero
    const ordered: Record<string, typeof presentes> = {}
    if (gruposMap['Base']) ordered['Base'] = gruposMap['Base']
    Object.keys(gruposMap).filter(k => k !== 'Base').forEach(k => { ordered[k] = gruposMap[k] })
    Object.assign(gruposMap, ordered)
  }

  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/sesion" className="text-gray-400 text-xl">←</Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            {esPartido ? `Partido${sesion.rival ? ` vs ${sesion.rival}` : ''}` : 'Entrenamiento'}
          </h1>
          <p className="text-sm text-gray-500">
            {new Date(sesion.fecha + 'T12:00:00').toLocaleDateString('es-AR', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            })}
          </p>
        </div>
        <span className={`text-2xl`}>{esPartido ? '⚽' : '🏃'}</span>
      </div>

      {/* Info de la sesión */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        {!esPartido && sesion.tipos_ejercicio && sesion.tipos_ejercicio.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Trabajo PF</p>
            <div className="flex flex-wrap gap-1.5">
              {(sesion.tipos_ejercicio as string[]).map((t: string) => (
                <span key={t} className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">
                  {LABEL_EJERCICIO[t] ?? t}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-sm">
          {sesion.duracion_pf && (
            <div>
              <span className="text-gray-400 text-xs">Duración PF</span>
              <p className="font-semibold text-gray-900">{sesion.duracion_pf} min</p>
            </div>
          )}
          {sesion.tipo_dt && (
            <div>
              <span className="text-gray-400 text-xs">Trabajo DT</span>
              <p className="font-semibold text-blue-700">{LABEL_TIPO_DT[sesion.tipo_dt as TipoCargaDT]?.split('(')[0].trim()}</p>
            </div>
          )}
          {sesion.duracion_dt && (
            <div>
              <span className="text-gray-400 text-xs">Duración DT</span>
              <p className="font-semibold text-gray-900">{sesion.duracion_dt} min</p>
            </div>
          )}
          {modoGrupos && (
            <div>
              <span className="text-gray-400 text-xs">Modo</span>
              <p className="font-semibold text-gray-700">Grupos</p>
            </div>
          )}
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{presentes.length}</p>
          <p className="text-xs text-green-600">Presentes</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-gray-700">{promCarga}</p>
          <p className="text-xs text-gray-500">UA promedio</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-500">{ausentes.length}</p>
          <p className="text-xs text-red-400">Ausentes</p>
        </div>
      </div>

      {/* Presentes */}
      {presentes.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-2">Presentes ({presentes.length})</p>
          {modoGrupos ? (
            // Modo grupos: mostrar por sección
            <div className="space-y-3">
              {Object.entries(gruposMap).map(([grupo, regs]) => (
                <div key={grupo}>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1 mb-1.5">{grupo}</p>
                  <div className="space-y-1.5">
                    {regs.map(r => <RowJugador key={r.id} r={r} esPartido={esPartido} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {presentes.map(r => <RowJugador key={r.id} r={r} esPartido={esPartido} />)}
            </div>
          )}
        </div>
      )}

      {/* Ausentes */}
      {ausentes.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-2">Ausentes ({ausentes.length})</p>
          <div className="flex flex-wrap gap-2">
            {ausentes.map(r => {
              const jug = r.jugadores as { nombre: string } | null
              return (
                <span key={r.id} className="text-sm bg-red-50 border border-red-200 text-red-600 px-3 py-1.5 rounded-full">
                  {jug?.nombre ?? '—'}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function RowJugador({ r, esPartido }: { r: any; esPartido: boolean }) {
  const jug = r.jugadores as { nombre: string; numero: number | null } | null
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        {jug?.numero != null && (
          <span className="text-xs font-bold text-gray-400 w-6 text-right flex-shrink-0">#{jug.numero}</span>
        )}
        <p className="text-sm font-medium text-gray-900 truncate">{jug?.nombre ?? '—'}</p>
      </div>
      <div className="text-right flex-shrink-0 ml-3">
        <p className="text-sm font-bold text-gray-900">{Math.round(r.carga_total ?? 0)} UA</p>
        <div className="flex gap-2 justify-end text-xs text-gray-400">
          {r.rpe && <span>RPE {r.rpe}</span>}
          {r.carga_pf > 0 && r.carga_dt > 0 && (
            <span>PF {Math.round(r.carga_pf)} + DT {Math.round(r.carga_dt)}</span>
          )}
          {esPartido && r.minutos_jugados != null && <span>{r.minutos_jugados} min</span>}
        </div>
      </div>
    </div>
  )
}
