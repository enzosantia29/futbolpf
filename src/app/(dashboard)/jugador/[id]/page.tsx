import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { calcularRatioAC, LABEL_POSICION, COLOR_ZONA, BG_ZONA } from '@/utils/carga'
import type { Posicion } from '@/types'
import GraficoCarga from '@/components/jugador/GraficoCarga'
import LesionPanel from '@/components/jugador/LesionPanel'
import TarjetasPanel from '@/components/jugador/TarjetasPanel'
import EliminarJugador from '@/components/jugador/EliminarJugador'
import Link from 'next/link'

function getISOWeek(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `${d.getFullYear()}-S${String(weekNum).padStart(2, '0')}`
}

export default async function JugadorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: jugador } = await supabase
    .from('jugadores').select('*').eq('id', id).single()
  if (!jugador) redirect('/plantel')

  // Registros con fecha de sesión (últimas 12 semanas)
  const desde = new Date()
  desde.setDate(desde.getDate() - 84)

  const { data: registros } = await supabase
    .from('registros')
    .select('*, sesiones(fecha, tipo)')
    .eq('jugador_id', id)
    .eq('presente', true)
    .gte('sesiones.fecha', desde.toISOString().split('T')[0])
    .order('sesiones(fecha)', { ascending: true })

  // Últimas sesiones para el historial
  const { data: ultimosRegistros } = await supabase
    .from('registros')
    .select('*, sesiones(fecha, tipo, rival)')
    .eq('jugador_id', id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Totales de la temporada
  const { data: totalRegistros } = await supabase
    .from('registros')
    .select('presente, carga_total')
    .eq('jugador_id', id)

  const totalSesiones = totalRegistros?.length ?? 0
  const totalPresentes = totalRegistros?.filter(r => r.presente).length ?? 0
  const totalCarga = totalRegistros?.reduce((acc, r) => acc + (r.carga_total ?? 0), 0) ?? 0
  const pctAsistencia = totalSesiones > 0 ? Math.round((totalPresentes / totalSesiones) * 100) : 0

  // Agrupar por semana para el gráfico
  const porSemana: Record<string, { carga: number; sesiones: number }> = {}
  for (const r of registros ?? []) {
    const sesion = r.sesiones as { fecha: string; tipo: string } | null
    if (!sesion) continue
    const semana = getISOWeek(new Date(sesion.fecha))
    if (!porSemana[semana]) porSemana[semana] = { carga: 0, sesiones: 0 }
    porSemana[semana].carga += r.carga_total ?? 0
    porSemana[semana].sesiones += 1
  }

  const dataSemanas = Object.entries(porSemana)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([semana, v]) => ({ semana: semana.split('-S')[1] ? `S${semana.split('-S')[1]}` : semana, carga: Math.round(v.carga), sesiones: v.sesiones }))

  const semanasParaAC = Object.entries(porSemana)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([semana, v]) => ({ semana, carga_total: v.carga, sesiones: v.sesiones }))
  const ratioAC = calcularRatioAC(semanasParaAC)

  // Lesión activa
  const { data: lesion } = await supabase
    .from('lesiones')
    .select('*')
    .eq('jugador_id', id)
    .eq('activa', true)
    .maybeSingle()

  // Historial de lesiones previas
  const { data: lesionesHistorial } = await supabase
    .from('lesiones')
    .select('*')
    .eq('jugador_id', id)
    .eq('activa', false)
    .order('fecha_inicio', { ascending: false })
    .limit(5)

  // Tarjetas: traer todos los registros con tarjetas
  const { data: registrosTarjetas } = await supabase
    .from('registros')
    .select('tarjeta_amarilla, tarjeta_roja, sesiones(fecha)')
    .eq('jugador_id', id)
    .or('tarjeta_amarilla.eq.true,tarjeta_roja.eq.true')

  const ultimoReset: string | null = jugador.ultimo_reset_tarjetas ?? null

  const tarjetasFiltradas = (registrosTarjetas ?? []).filter(r => {
    const s = r.sesiones as unknown as { fecha: string } | null
    if (!s) return false
    if (ultimoReset && s.fecha < ultimoReset) return false
    return true
  })
  const totalAmarillas = tarjetasFiltradas.filter(r => r.tarjeta_amarilla).length
  const totalRojas = tarjetasFiltradas.filter(r => r.tarjeta_roja).length

  // Badges de tarjetas en el header
  const badgeTarjetas: string[] = []
  if (totalAmarillas > 0) badgeTarjetas.push(`🟡×${totalAmarillas}`)
  if (totalRojas > 0) badgeTarjetas.push(`🔴×${totalRojas}`)

  return (
    <div className="px-4 pt-6 pb-6 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/plantel" className="text-gray-400 text-xl">←</Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{jugador.nombre}</h1>
            {badgeTarjetas.map((b, i) => (
              <span key={i} className="text-sm font-semibold text-gray-700">{b}</span>
            ))}
          </div>
          <p className="text-sm text-gray-500">
            #{jugador.numero ?? '—'} · {LABEL_POSICION[jugador.posicion as Posicion]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/jugador/${id}/editar`}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-xl font-medium transition-colors">
            Editar
          </Link>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            jugador.estado === 'activo' ? 'bg-green-100 text-green-700' :
            jugador.estado === 'lesionado' ? 'bg-red-100 text-red-700' :
            jugador.estado === 'suspendido' ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-500'
          }`}>{jugador.estado}</span>
        </div>
      </div>

      {/* Panel de lesión */}
      <LesionPanel jugadorId={id} lesionActiva={lesion} />

      {/* Panel de tarjetas */}
      <TarjetasPanel
        jugadorId={id}
        amarillas={totalAmarillas}
        rojas={totalRojas}
        ultimoReset={ultimoReset}
      />

      {/* Stats resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-gray-900">{pctAsistencia}%</div>
          <div className="text-xs text-gray-500">Asistencia</div>
          <div className="text-xs text-gray-400">{totalPresentes}/{totalSesiones} sesiones</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-gray-900">{Math.round(totalCarga)}</div>
          <div className="text-xs text-gray-500">Carga total</div>
          <div className="text-xs text-gray-400">UA temporada</div>
        </div>
        <div className={`border rounded-xl p-3 text-center ${BG_ZONA[ratioAC.zona]}`}>
          <div className={`text-xl font-bold ${COLOR_ZONA[ratioAC.zona]}`}>{ratioAC.ratio}</div>
          <div className="text-xs text-gray-500">Ratio A:C</div>
          <div className={`text-xs font-medium ${COLOR_ZONA[ratioAC.zona]}`}>{
            ratioAC.zona === 'segura' ? 'OK' :
            ratioAC.zona === 'precaucion' ? 'Precaución' :
            ratioAC.zona === 'riesgo' ? '⚠ Riesgo' : 'Bajo'
          }</div>
        </div>
      </div>

      {/* Ratio A:C detalle */}
      <div className={`border rounded-xl p-4 ${BG_ZONA[ratioAC.zona]}`}>
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Ratio Agudo:Crónico</p>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Carga aguda (semana actual)</span>
          <span className="font-semibold">{ratioAC.carga_aguda} UA</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-gray-600">Carga crónica (prom. 4 semanas)</span>
          <span className="font-semibold">{ratioAC.carga_cronica} UA</span>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between text-sm font-bold">
          <span className={COLOR_ZONA[ratioAC.zona]}>Ratio A:C</span>
          <span className={COLOR_ZONA[ratioAC.zona]}>{ratioAC.ratio} {
            ratioAC.zona === 'riesgo' ? '— RIESGO DE LESIÓN' :
            ratioAC.zona === 'precaucion' ? '— PRECAUCIÓN' :
            ratioAC.zona === 'segura' ? '— ZONA SEGURA' : '— SUBESTIMULADO'
          }</span>
        </div>
      </div>

      {/* Gráfico de carga */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-gray-800 mb-3">Carga por semana (últimas 12 semanas)</p>
        <GraficoCarga data={dataSemanas} />
      </div>

      {/* Factor de posición */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">Factor de posición</p>
          <p className="text-xs text-gray-400">Ajusta la carga en partidos</p>
        </div>
        <span className="text-lg font-bold text-gray-700">×{jugador.factor_posicion}</span>
      </div>

      {/* Historial reciente */}
      <div>
        <p className="text-sm font-semibold text-gray-800 mb-2">Últimas sesiones</p>
        <div className="space-y-2">
          {(ultimosRegistros ?? []).map(r => {
            const s = r.sesiones as { fecha: string; tipo: string; rival?: string } | null
            if (!s) return null
            return (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{r.presente ? (s.tipo === 'partido' ? '⚽' : '🏃') : '✗'}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {!r.presente ? 'Ausente' : s.tipo === 'partido' ? `Partido${s.rival ? ` vs ${s.rival}` : ''}` : 'Entrenamiento'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(s.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {r.presente && (
                    <>
                      <p className="text-sm font-semibold text-gray-900">{Math.round(r.carga_total ?? 0)} UA</p>
                      {r.rpe && <p className="text-xs text-gray-400">RPE {r.rpe}</p>}
                      {r.minutos_jugados != null && <p className="text-xs text-gray-400">{r.minutos_jugados} min</p>}
                    </>
                  )}
                  {/* Mostrar tarjetas en el historial */}
                  {(r.tarjeta_amarilla || r.tarjeta_roja) && (
                    <p className="text-xs mt-0.5">
                      {r.tarjeta_amarilla && '🟡'}{r.tarjeta_roja && '🔴'}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Historial de lesiones */}
      {(lesionesHistorial ?? []).length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-2">Lesiones anteriores</p>
          <div className="space-y-2">
            {(lesionesHistorial ?? []).map(l => {
              const diasBaja = l.fecha_retorno_estimada
                ? Math.round((new Date(l.fecha_retorno_estimada).getTime() - new Date(l.fecha_inicio).getTime()) / 86400000)
                : null
              return (
                <div key={l.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 capitalize">{l.tipo}</p>
                    {diasBaja && <span className="text-xs text-gray-400">{diasBaja} días baja</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(l.fecha_inicio + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {l.fecha_retorno_estimada && ` → ${new Date(l.fecha_retorno_estimada + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`}
                  </p>
                  {l.notas && <p className="text-xs text-gray-400 italic mt-0.5">"{l.notas}"</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Zona de peligro */}
      <div className="border border-red-100 rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Zona de peligro</p>
        <EliminarJugador jugadorId={id} nombre={jugador.nombre} />
      </div>
    </div>
  )
}
