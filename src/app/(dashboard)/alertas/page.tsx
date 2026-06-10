import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getEquipoActivo } from '@/lib/equipo'
import { calcularRatioAC, LABEL_POSICION, COLOR_ZONA, BG_ZONA } from '@/utils/carga'
import type { Posicion, RatioAC } from '@/types'
import Link from 'next/link'

function getISOWeek(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `${d.getFullYear()}-S${String(weekNum).padStart(2, '0')}`
}

const ZONA_ORDEN: Record<RatioAC['zona'], number> = {
  riesgo: 0, precaucion: 1, subestimulacion: 2, segura: 3,
}
const ZONA_LABEL: Record<RatioAC['zona'], string> = {
  riesgo: 'Riesgo', precaucion: 'Precaución', subestimulacion: 'Bajo estímulo', segura: 'Zona segura',
}
const ZONA_ICON: Record<RatioAC['zona'], string> = {
  riesgo: '🔴', precaucion: '🟡', subestimulacion: '🔵', segura: '🟢',
}
const ZONA_BG_CARD: Record<RatioAC['zona'], string> = {
  riesgo: 'bg-red-50 border-red-200',
  precaucion: 'bg-yellow-50 border-yellow-200',
  subestimulacion: 'bg-blue-50 border-blue-200',
  segura: 'bg-white border-gray-200',
}

export default async function AlertasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { equipo } = await getEquipoActivo(supabase, user.id)
  if (!equipo) redirect('/plantel/nuevo-equipo')

  const { data: jugadores } = await supabase
    .from('jugadores')
    .select('*')
    .eq('equipo_id', equipo.id)
    .eq('estado', 'activo')
    .order('nombre')

  if (!jugadores || jugadores.length === 0) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-lg mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Alertas</h1>
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-sm">No hay jugadores activos todavía.</p>
        </div>
      </div>
    )
  }

  const desde = new Date()
  desde.setDate(desde.getDate() - 56)

  const { data: todosRegistros } = await supabase
    .from('registros')
    .select('jugador_id, carga_total, presente, sesiones(fecha)')
    .in('jugador_id', jugadores.map(j => j.id))
    .eq('presente', true)
    .gte('sesiones.fecha', desde.toISOString().split('T')[0])

  const resultados = jugadores.map(jugador => {
    const regs = (todosRegistros ?? []).filter(r => r.jugador_id === jugador.id)
    const porSemana: Record<string, { carga: number; sesiones: number }> = {}
    for (const r of regs) {
      const s = r.sesiones as unknown as { fecha: string } | null
      if (!s) continue
      const semana = getISOWeek(new Date(s.fecha))
      if (!porSemana[semana]) porSemana[semana] = { carga: 0, sesiones: 0 }
      porSemana[semana].carga += r.carga_total ?? 0
      porSemana[semana].sesiones += 1
    }
    const semanasOrdenadas = Object.entries(porSemana)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([semana, v]) => ({ semana, carga_total: v.carga, sesiones: v.sesiones }))
    const ratioAC = calcularRatioAC(semanasOrdenadas)
    return { jugador, ratioAC }
  })

  resultados.sort((a, b) => ZONA_ORDEN[a.ratioAC.zona] - ZONA_ORDEN[b.ratioAC.zona])

  const enRiesgo     = resultados.filter(r => r.ratioAC.zona === 'riesgo').length
  const enPrecaucion = resultados.filter(r => r.ratioAC.zona === 'precaucion').length
  const enSegura     = resultados.filter(r => r.ratioAC.zona === 'segura').length
  const subestimulados = resultados.filter(r => r.ratioAC.zona === 'subestimulacion').length

  return (
    <div className="px-4 pt-4 pb-6 max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Alertas del plantel</h1>
        <p className="text-sm text-gray-400">Ratio Agudo:Crónico · Gabbett 2016</p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="bg-red-50 border border-red-200 rounded-xl p-2 text-center shadow-sm">
          <div className="text-lg font-bold text-red-600">{enRiesgo}</div>
          <div className="text-xs text-red-400">Riesgo</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-2 text-center shadow-sm">
          <div className="text-lg font-bold text-yellow-600">{enPrecaucion}</div>
          <div className="text-xs text-yellow-500">Precaución</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-2 text-center shadow-sm">
          <div className="text-lg font-bold text-green-600">{enSegura}</div>
          <div className="text-xs text-green-500">Seguros</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-2 text-center shadow-sm">
          <div className="text-lg font-bold text-blue-500">{subestimulados}</div>
          <div className="text-xs text-blue-400">Bajo est.</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3 text-xs text-gray-500 space-y-1 shadow-sm">
        <p className="font-semibold text-gray-600 mb-1">Zonas del Ratio A:C (Gabbett 2016)</p>
        <p>🔵 &lt;0.8 — Subestimulado: carga insuficiente</p>
        <p>🟢 0.8–1.3 — Zona segura: carga óptima</p>
        <p>🟡 1.3–1.5 — Precaución: vigilar fatiga</p>
        <p>🔴 &gt;1.5 — Riesgo: probabilidad alta de lesión</p>
      </div>

      <div className="space-y-2">
        {resultados.map(({ jugador, ratioAC }) => (
          <Link
            key={jugador.id}
            href={`/jugador/${jugador.id}`}
            className={`flex items-center justify-between border rounded-xl px-4 py-3 transition-colors hover:opacity-80 shadow-sm ${ZONA_BG_CARD[ratioAC.zona]}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{ZONA_ICON[ratioAC.zona]}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{jugador.nombre}</p>
                <p className="text-xs text-gray-400">
                  {LABEL_POSICION[jugador.posicion as Posicion]} · #{jugador.numero ?? '—'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-base font-bold ${COLOR_ZONA[ratioAC.zona]}`}>{ratioAC.ratio}</p>
              <p className={`text-xs font-medium ${COLOR_ZONA[ratioAC.zona]}`}>{ZONA_LABEL[ratioAC.zona]}</p>
              <p className="text-xs text-gray-400">{ratioAC.carga_aguda} / {ratioAC.carga_cronica} UA</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
