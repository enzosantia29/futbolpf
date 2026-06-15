import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getEquipoActivo } from '@/lib/equipo'
import Link from 'next/link'
import { LABEL_POSICION } from '@/utils/carga'
import type { Jugador } from '@/types'

const BADGE_ESTADO: Record<string, string> = {
  activo:     'bg-green-100 text-green-700',
  lesionado:  'bg-red-100 text-red-700',
  suspendido: 'bg-yellow-100 text-yellow-700',
  baja:       'bg-gray-100 text-gray-500',
}

const LABEL_ESTADO: Record<string, string> = {
  activo: 'Activo', lesionado: 'Lesionado',
  suspendido: 'Suspendido', baja: 'Baja',
}

type KPIs = {
  aguda: number       // UA últimos 7 días
  cronica: number     // promedio semanal 28 días
  ratio: number | null
  ultimaSesion: string | null
}

function ratioColor(r: number): string {
  if (r < 0.8)  return 'text-blue-500'
  if (r < 1.3)  return 'text-green-600'
  if (r <= 1.5) return 'text-yellow-500'
  return 'text-red-500'
}

function ratioDot(r: number): string {
  if (r < 0.8)  return 'bg-blue-400'
  if (r < 1.3)  return 'bg-green-500'
  if (r <= 1.5) return 'bg-yellow-400'
  return 'bg-red-500'
}

function diasDesde(fecha: string): string {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const f = new Date(fecha + 'T12:00:00')
  const diff = Math.round((hoy.getTime() - f.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  return `Hace ${diff}d`
}

export default async function PlantelPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { equipo } = await getEquipoActivo(supabase, user.id)
  if (!equipo) redirect('/plantel/nuevo-equipo')

  const { data: jugadores } = await supabase
    .from('jugadores')
    .select('*')
    .eq('equipo_id', equipo.id)
    .order('estado')
    .order('nombre')

  // Calcular KPIs — una sola query para todo el plantel
  const hoy = new Date()
  const hace28str = new Date(hoy.getTime() - 28 * 86400000).toISOString().split('T')[0]
  const hace7str  = new Date(hoy.getTime() -  7 * 86400000).toISOString().split('T')[0]

  const { data: sesData } = await supabase
    .from('sesiones')
    .select('fecha, registros(jugador_id, carga_total, presente)')
    .eq('equipo_id', equipo.id)
    .gte('fecha', hace28str)

  const kpiMap: Record<string, KPIs> = {}

  for (const ses of sesData ?? []) {
    const fecha = ses.fecha as string
    for (const reg of (ses.registros as { jugador_id: string; carga_total: number | null; presente: boolean }[]) ?? []) {
      if (!reg.presente) continue
      const jid = reg.jugador_id
      if (!kpiMap[jid]) kpiMap[jid] = { aguda: 0, cronica: 0, ratio: null, ultimaSesion: null }
      const carga = reg.carga_total ?? 0
      kpiMap[jid].cronica += carga
      if (fecha >= hace7str) kpiMap[jid].aguda += carga
      if (!kpiMap[jid].ultimaSesion || fecha > kpiMap[jid].ultimaSesion) {
        kpiMap[jid].ultimaSesion = fecha
      }
    }
  }

  for (const jid in kpiMap) {
    const k = kpiMap[jid]
    k.cronica = Math.round(k.cronica / 4) // promedio semanal (28d / 4 semanas)
    k.aguda   = Math.round(k.aguda)
    k.ratio   = k.cronica > 0 ? Math.round((k.aguda / k.cronica) * 100) / 100 : null
  }

  const activos   = jugadores?.filter(j => j.estado === 'activo') ?? []
  const inactivos = jugadores?.filter(j => j.estado !== 'activo') ?? []

  return (
    <div className="px-4 pt-4 pb-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Plantel</h1>
          <p className="text-sm text-gray-500">{activos.length} activos · {inactivos.length} inactivos</p>
        </div>
        <Link
          href="/plantel/nuevo-jugador"
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          + Jugador
        </Link>
      </div>

      {!jugadores?.length && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-sm">Todavía no hay jugadores.<br/>Agregá el primero.</p>
        </div>
      )}

      {activos.length > 0 && (
        <div className="space-y-2 mb-4">
          {activos.map(j => <JugadorRow key={j.id} j={j} kpis={kpiMap[j.id] ?? null} />)}
        </div>
      )}

      {inactivos.length > 0 && (
        <>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 mt-4">Inactivos</p>
          <div className="space-y-2">
            {inactivos.map(j => <JugadorRow key={j.id} j={j} kpis={kpiMap[j.id] ?? null} />)}
          </div>
        </>
      )}
    </div>
  )
}

function JugadorRow({ j, kpis }: { j: Jugador; kpis: KPIs | null }) {
  const hasData = kpis && (kpis.aguda > 0 || kpis.cronica > 0)

  return (
    <Link
      href={`/jugador/${j.id}`}
      className="block bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-green-300 transition-colors shadow-sm"
    >
      <div className="flex items-start gap-3">
        {/* Número */}
        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0 mt-0.5">
          {j.numero ?? '—'}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Nombre + estado */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900 truncate">{j.nombre}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${BADGE_ESTADO[j.estado]}`}>
              {LABEL_ESTADO[j.estado]}
            </span>
          </div>

          {/* Posición */}
          <p className="text-xs text-gray-400 mt-0.5">
            {LABEL_POSICION[j.posicion as keyof typeof LABEL_POSICION]}
          </p>

          {/* KPIs de carga */}
          {hasData ? (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {/* Carga aguda */}
              <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1">
                <span className="text-xs font-bold text-gray-800">{kpis.aguda}</span>
                <span className="text-[10px] text-gray-400">UA 7d</span>
              </div>

              {/* Carga crónica */}
              <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1">
                <span className="text-xs font-bold text-gray-800">{kpis.cronica}</span>
                <span className="text-[10px] text-gray-400">UA cr.</span>
              </div>

              {/* Ratio A:C */}
              {kpis.ratio !== null && (
                <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ratioDot(kpis.ratio)}`} />
                  <span className={`text-xs font-bold ${ratioColor(kpis.ratio)}`}>
                    A:C {kpis.ratio.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Última sesión */}
              {kpis.ultimaSesion && (
                <span className="text-[10px] text-gray-400 ml-auto">
                  {diasDesde(kpis.ultimaSesion)}
                </span>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-gray-300 mt-1.5 italic">Sin sesiones en los últimos 28 días</p>
          )}
        </div>
      </div>
    </Link>
  )
}
