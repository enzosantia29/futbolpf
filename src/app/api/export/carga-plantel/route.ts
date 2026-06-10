import { createClient } from '@/lib/supabase/server'
import { getEquipoActivo } from '@/lib/equipo'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { calcularRatioAC } from '@/utils/carga'

function getISOWeek(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `${d.getFullYear()}-S${String(weekNum).padStart(2, '0')}`
}

const ZONA_LABEL: Record<string, string> = {
  riesgo: '🔴 RIESGO',
  precaucion: '🟡 Precaución',
  segura: '🟢 Segura',
  subestimulacion: '🔵 Bajo estímulo',
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { equipo } = await getEquipoActivo(supabase, user.id)
  if (!equipo) return NextResponse.json({ error: 'Sin equipo' }, { status: 404 })

  const { data: jugadores } = await supabase
    .from('jugadores')
    .select('id, nombre, numero, posicion, estado')
    .eq('equipo_id', equipo.id)
    .eq('estado', 'activo')
    .order('nombre')

  if (!jugadores) return NextResponse.json({ error: 'Sin jugadores' }, { status: 404 })

  const { data: registros } = await supabase
    .from('registros')
    .select('jugador_id, carga_total, sesiones(fecha)')
    .in('jugador_id', jugadores.map(j => j.id))
    .eq('presente', true)

  const filas = jugadores.map(j => {
    const regs = (registros ?? []).filter(r => r.jugador_id === j.id)
    const porSemana: Record<string, number> = {}
    for (const r of regs) {
      const s = r.sesiones as unknown as { fecha: string } | null
      if (!s) continue
      const semana = getISOWeek(new Date(s.fecha))
      porSemana[semana] = (porSemana[semana] ?? 0) + (r.carga_total ?? 0)
    }
    const semanas = Object.entries(porSemana)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([semana, carga_total]) => ({ semana, carga_total, sesiones: 1 }))
    const ratio = calcularRatioAC(semanas)
    return [j.nombre, j.numero ?? '', ratio.carga_aguda, ratio.carga_cronica, ratio.ratio, ZONA_LABEL[ratio.zona] ?? ratio.zona]
  })

  filas.sort((a, b) => {
    const zA = (a[5] as string).includes('RIESGO') ? 0 : (a[5] as string).includes('Precaución') ? 1 : (a[5] as string).includes('Bajo') ? 2 : 3
    const zB = (b[5] as string).includes('RIESGO') ? 0 : (b[5] as string).includes('Precaución') ? 1 : (b[5] as string).includes('Bajo') ? 2 : 3
    return zA - zB
  })

  const hoy = new Date()
  const header = ['Jugador', 'N°', 'Carga Aguda (UA)', 'Carga Crónica (UA)', 'Ratio A:C', 'Zona']

  const infoFirma: string[][] = [
    [`Equipo: ${equipo.nombre}`],
    [`Generado: ${hoy.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`],
  ]
  if (equipo.nombre_pf) {
    infoFirma.push([`Preparador Físico: ${equipo.nombre_pf}`])
  }

  const leyenda = [
    ['LEYENDA DEL RATIO A:C (Gabbett, 2016)'],
    ['🔴 > 1.5', 'RIESGO — Reducir carga inmediatamente'],
    ['🟡 1.3–1.5', 'Precaución — Vigilar signos de fatiga'],
    ['🟢 0.8–1.3', 'Zona segura — Carga óptima'],
    ['🔵 < 0.8', 'Bajo estímulo — Carga insuficiente para adaptación'],
  ]

  const ws = XLSX.utils.aoa_to_sheet([
    ...infoFirma,
    [''],
    header,
    ...filas,
    [''],
    ...leyenda,
  ])
  ws['!cols'] = [{ wch: 26 }, { wch: 5 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 22 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Carga del Plantel')

  const nombreArchivo = `FutbolPF_CargaPlantel_${hoy.toISOString().split('T')[0]}.xlsx`
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
    },
  })
}
