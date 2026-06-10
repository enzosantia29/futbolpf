import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getEquipoActivo } from '@/lib/equipo'
import Link from 'next/link'
import { LABEL_TIPO_DT } from '@/utils/carga'
import type { TipoCargaDT } from '@/types'

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

export default async function SesionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { equipo } = await getEquipoActivo(supabase, user.id)
  if (!equipo) redirect('/plantel/nuevo-equipo')

  const { data: sesiones } = await supabase
    .from('sesiones')
    .select('*')
    .eq('equipo_id', equipo.id)
    .order('fecha', { ascending: false })
    .limit(60)

  const sesionIds = sesiones?.map(s => s.id) ?? []
  const { data: resumen } = sesionIds.length > 0
    ? await supabase
        .from('registros')
        .select('sesion_id, presente, carga_total')
        .in('sesion_id', sesionIds)
    : { data: [] }

  const porSesion: Record<string, { presentes: number; cargaPromedio: number }> = {}
  for (const r of resumen ?? []) {
    if (!porSesion[r.sesion_id]) porSesion[r.sesion_id] = { presentes: 0, cargaPromedio: 0 }
    if (r.presente) {
      porSesion[r.sesion_id].presentes += 1
      porSesion[r.sesion_id].cargaPromedio += r.carga_total ?? 0
    }
  }
  for (const sid of Object.keys(porSesion)) {
    const p = porSesion[sid].presentes
    if (p > 0) porSesion[sid].cargaPromedio = Math.round(porSesion[sid].cargaPromedio / p)
  }

  const porMes: Record<string, typeof sesiones> = {}
  for (const s of sesiones ?? []) {
    const mes = new Date(s.fecha + 'T12:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    if (!porMes[mes]) porMes[mes] = []
    porMes[mes]!.push(s)
  }

  return (
    <div className="px-4 pt-4 pb-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sesiones</h1>
          <p className="text-sm text-gray-400">{sesiones?.length ?? 0} registradas</p>
        </div>
        <div className="flex gap-2">
          <Link href="/partido/nuevo" className="bg-blue-600 text-white text-sm font-medium px-3 py-2 rounded-xl transition-colors hover:bg-blue-700">
            ⚽ Partido
          </Link>
          <Link href="/sesion/nueva" className="bg-green-600 text-white text-sm font-medium px-3 py-2 rounded-xl transition-colors hover:bg-green-700">
            + Sesión
          </Link>
        </div>
      </div>

      {!sesiones || sesiones.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">📋</div>
          <p className="text-sm">Todavía no hay sesiones.<br />Cargá el primer entrenamiento.</p>
          <Link href="/sesion/nueva" className="mt-4 inline-block bg-green-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl">
            Cargar entrenamiento
          </Link>
        </div>
      ) : (
        <div className="space-y-1">
          {Object.entries(porMes).map(([mes, lista]) => (
            <div key={mes}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide py-2 px-1 capitalize">{mes}</p>
              <div className="space-y-2">
                {lista!.map(s => {
                  const res = porSesion[s.id]
                  const esPartido = s.tipo === 'partido'
                  return (
                    <Link
                      key={s.id}
                      href={`/sesion/${s.id}`}
                      className={`block bg-white border rounded-xl px-4 py-3 shadow-sm active:opacity-70 ${esPartido ? 'border-blue-200' : 'border-gray-200'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="text-xl mt-0.5 flex-shrink-0">{esPartido ? '⚽' : '🏃'}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900">
                              {esPartido
                                ? `Partido${s.rival ? ` vs ${s.rival}` : ''}`
                                : 'Entrenamiento'}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(s.fecha + 'T12:00:00').toLocaleDateString('es-AR', {
                                weekday: 'long', day: 'numeric', month: 'short'
                              })}
                            </p>
                            {!esPartido && s.tipos_ejercicio && s.tipos_ejercicio.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {(s.tipos_ejercicio as string[]).map((t: string) => (
                                  <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                    {LABEL_EJERCICIO[t] ?? t}
                                  </span>
                                ))}
                                {s.tipo_dt && (
                                  <span className="text-xs bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full">+DT</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {res && res.presentes > 0 && (
                            <>
                              <p className={`text-sm font-bold ${esPartido ? 'text-blue-600' : 'text-green-600'}`}>
                                {res.cargaPromedio} UA
                              </p>
                              <p className="text-xs text-gray-400">prom./jug.</p>
                            </>
                          )}
                          <div className="flex items-center gap-1 justify-end mt-1">
                            {!esPartido && s.duracion_pf && (
                              <span className="text-xs text-gray-400">{s.duracion_pf} min</span>
                            )}
                            {res && (
                              <span className="text-xs text-gray-400">· {res.presentes} pres.</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {!esPartido && s.duracion_pf && s.tipo_dt && (
                        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-400">
                          <span>⏱ {s.duracion_pf} min</span>
                          <span className="text-blue-400">
                            🔵 DT: {LABEL_TIPO_DT[s.tipo_dt as TipoCargaDT]?.split('(')[0].trim()}
                          </span>
                        </div>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
