import { createClient } from '@/lib/supabase/server'
import { getEquipoActivo } from '@/lib/equipo'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { equipo } = await getEquipoActivo(supabase, user.id)
  if (!equipo) return NextResponse.json({ error: 'Sin equipo' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const hoy = new Date()
  const periodo = searchParams.get('periodo')
  const desdeParam = searchParams.get('desde')
  const hastaParam = searchParams.get('hasta')

  let desde: string
  const hasta: string = hastaParam ?? hoy.toISOString().split('T')[0]

  if (desdeParam) {
    desde = desdeParam
  } else if (periodo === 'semana') {
    const d = new Date(hoy); d.setDate(d.getDate() - 7)
    desde = d.toISOString().split('T')[0]
  } else if (periodo === 'temporada') {
    desde = `${hoy.getFullYear()}-01-01`
  } else {
    const d = new Date(hoy); d.setDate(d.getDate() - 30)
    desde = d.toISOString().split('T')[0]
  }

  const { data: sesiones } = await supabase
    .from('sesiones')
    .select('id, fecha, tipo, rival, duracion_pf')
    .eq('equipo_id', equipo.id)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })

  if (!sesiones || sesiones.length === 0) {
    return NextResponse.json({ error: 'Sin sesiones en el período' }, { status: 404 })
  }

  const { data: jugadores } = await supabase
    .from('jugadores')
    .select('id, nombre, numero, posicion')
    .eq('equipo_id', equipo.id)
    .neq('estado', 'baja')
    .order('nombre')

  if (!jugadores) return NextResponse.json({ error: 'Sin jugadores' }, { status: 404 })

  const { data: registros } = await supabase
    .from('registros')
    .select('jugador_id, sesion_id, presente, carga_total, rpe, minutos_jugados')
    .in('sesion_id', sesiones.map(s => s.id))

  const idx: Record<string, Record<string, { presente: boolean; carga: number; rpe: number | null; minutos: number | null }>> = {}
  for (const r of registros ?? []) {
    if (!idx[r.jugador_id]) idx[r.jugador_id] = {}
    idx[r.jugador_id][r.sesion_id] = {
      presente: r.presente,
      carga: r.carga_total ?? 0,
      rpe: r.rpe,
      minutos: r.minutos_jugados,
    }
  }

  // ── Hoja 1: Asistencia ───────────────────────────────────────────
  const headerAsistencia = [
    'Jugador', 'N°',
    ...sesiones.map(s => {
      const fecha = new Date(s.fecha + 'T12:00:00')
      const d = fecha.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
      return s.tipo === 'partido' ? `⚽ ${d}` : d
    }),
    'Presentes', 'Ausentes', '% Asistencia',
  ]

  const rowsAsistencia = jugadores.map(j => {
    let presentes = 0, ausentes = 0
    const celdas = sesiones.map(s => {
      const reg = idx[j.id]?.[s.id]
      if (!reg) return '—'
      if (reg.presente) { presentes++; return '✓' }
      ausentes++; return '✗'
    })
    const total = presentes + ausentes
    return [j.nombre, j.numero ?? '', ...celdas, presentes, ausentes, total > 0 ? `${Math.round((presentes / total) * 100)}%` : '—']
  })

  const footerFirma = buildFooter(equipo, hoy, `${desde} al ${hasta}`)

  const wsAsistencia = XLSX.utils.aoa_to_sheet([headerAsistencia, ...rowsAsistencia, [''], ...footerFirma])
  wsAsistencia['!cols'] = [{ wch: 24 }, { wch: 5 }, ...sesiones.map(() => ({ wch: 12 })), { wch: 10 }, { wch: 10 }, { wch: 12 }]

  // ── Hoja 2: Carga ────────────────────────────────────────────────
  const headerCarga = [
    'Jugador', 'N°',
    ...sesiones.map(s => new Date(s.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })),
    'Carga Total', 'Promedio/sesión',
  ]

  const rowsCarga = jugadores.map(j => {
    let total = 0, count = 0
    const celdas = sesiones.map(s => {
      const reg = idx[j.id]?.[s.id]
      if (!reg || !reg.presente) return 0
      total += reg.carga; count++
      return Math.round(reg.carga)
    })
    return [j.nombre, j.numero ?? '', ...celdas, Math.round(total), count > 0 ? Math.round(total / count) : 0]
  })

  const wsCarga = XLSX.utils.aoa_to_sheet([headerCarga, ...rowsCarga, [''], ...footerFirma])
  wsCarga['!cols'] = [{ wch: 24 }, { wch: 5 }, ...sesiones.map(() => ({ wch: 10 })), { wch: 12 }, { wch: 15 }]

  // ── Hoja 3: Sesiones ────────────────────────────────────────────
  const headerSesiones = ['Fecha', 'Día', 'Tipo', 'Rival / Info', 'Duración (min)', 'Presentes', 'Carga prom. UA']
  const rowsSesiones = sesiones.map(s => {
    const fecha = new Date(s.fecha + 'T12:00:00')
    const regsPresentes = (registros ?? []).filter(r => r.sesion_id === s.id && r.presente)
    const cargaProm = regsPresentes.length > 0
      ? Math.round(regsPresentes.reduce((a, r) => a + (r.carga_total ?? 0), 0) / regsPresentes.length)
      : 0
    return [
      s.fecha,
      fecha.toLocaleDateString('es-AR', { weekday: 'long' }),
      s.tipo === 'partido' ? 'Partido' : 'Entrenamiento',
      s.tipo === 'partido' ? (s.rival ?? '') : '',
      s.tipo === 'entrenamiento' ? (s.duracion_pf ?? '') : 90,
      regsPresentes.length,
      cargaProm,
    ]
  })

  const wsSesiones = XLSX.utils.aoa_to_sheet([headerSesiones, ...rowsSesiones, [''], ...footerFirma])
  wsSesiones['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 16 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, wsAsistencia, 'Asistencia')
  XLSX.utils.book_append_sheet(wb, wsCarga, 'Carga UA')
  XLSX.utils.book_append_sheet(wb, wsSesiones, 'Sesiones')

  const sufijo = desdeParam ? `${desde}_al_${hasta}` : (periodo ?? 'mes')
  const nombreArchivo = `FutbolPF_${equipo.nombre.replace(/\s+/g, '_')}_${sufijo}.xlsx`
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
    },
  })
}

function buildFooter(equipo: { nombre: string; nombre_pf?: string | null }, hoy: Date, periodo: string): string[][] {
  const rows: string[][] = [
    [`Club: ${equipo.nombre}`],
    [`Período: ${periodo}`],
    [`Generado: ${hoy.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`],
  ]
  if (equipo.nombre_pf) {
    rows.push([`Preparador Físico: ${equipo.nombre_pf}`])
  }
  return rows
}
