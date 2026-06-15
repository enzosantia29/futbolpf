import { createClient } from '@/lib/supabase/server'
import { getEquipoActivo } from '@/lib/equipo'
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, Document, Page, View, Text, StyleSheet, Font } from '@react-pdf/renderer'
import path from 'path'
import { calcularRatioAC } from '@/utils/carga'

Font.register({ family: 'Roboto',     src: path.join(process.cwd(), 'public/fonts/Roboto-Regular.woff') })
Font.register({ family: 'Roboto-Bold', src: path.join(process.cwd(), 'public/fonts/Roboto-Bold.woff') })

// ── Estilos ──────────────────────────────────────────────────────────────────

const VERDE   = '#16a34a'
const GRIS    = '#6b7280'
const GRIS_L  = '#f3f4f6'
const BORDE   = '#e5e7eb'
const NEGRO   = '#111827'

const ZONA_COLOR: Record<string, string> = {
  riesgo:          '#dc2626',
  precaucion:      '#d97706',
  segura:          '#16a34a',
  subestimulacion: '#3b82f6',
}
const ZONA_BG: Record<string, string> = {
  riesgo:          '#fef2f2',
  precaucion:      '#fffbeb',
  segura:          '#f0fdf4',
  subestimulacion: '#eff6ff',
}
const ZONA_LABEL: Record<string, string> = {
  riesgo:          'RIESGO',
  precaucion:      'PRECAUCIÓN',
  segura:          'ZONA SEGURA',
  subestimulacion: 'BAJO ESTÍMULO',
}

const s = StyleSheet.create({
  page: { fontFamily: 'Roboto', fontSize: 8.5, padding: 28, backgroundColor: '#ffffff', color: NEGRO },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  clubBadge:   { backgroundColor: VERDE, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  clubNombre:  { color: '#ffffff', fontSize: 13, fontFamily: 'Roboto-Bold' },
  headerRight: { alignItems: 'flex-end' },
  titulo:      { fontSize: 12, fontFamily: 'Roboto-Bold', color: NEGRO },
  subtitulo:   { fontSize: 7.5, color: GRIS, marginTop: 2 },
  fechaGen:    { fontSize: 7, color: VERDE, fontFamily: 'Roboto-Bold', marginTop: 3 },

  divider: { borderBottomWidth: 1, borderBottomColor: BORDE, marginBottom: 12 },

  // Tabla
  tablaHeaderRow: {
    flexDirection: 'row', backgroundColor: NEGRO, minHeight: 20,
    alignItems: 'center', borderRadius: 3, marginBottom: 2,
  },
  row:     { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: BORDE, minHeight: 22, alignItems: 'center' },
  rowPar:  { backgroundColor: GRIS_L },

  cNombre:  { width: 150, paddingHorizontal: 7, paddingVertical: 4 },
  cNum:     { width: 24,  paddingHorizontal: 3, textAlign: 'center' },
  cUA:      { width: 72,  paddingHorizontal: 6, textAlign: 'center' },
  cRatio:   { width: 55,  paddingHorizontal: 6, textAlign: 'center' },
  cZona:    { flex: 1,    paddingHorizontal: 7 },

  hText:    { color: '#ffffff', fontFamily: 'Roboto-Bold', fontSize: 7.5 },

  // Zona badge
  zonaBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  zonaText:  { fontSize: 7, fontFamily: 'Roboto-Bold' },

  // Leyenda
  leyendaBox:   { marginTop: 18, borderWidth: 0.5, borderColor: BORDE, borderRadius: 6, padding: 10 },
  leyendaTitulo:{ fontSize: 8, fontFamily: 'Roboto-Bold', color: NEGRO, marginBottom: 8 },
  leyendaGrid:  { flexDirection: 'row', gap: 8 },
  leyendaItem:  { flex: 1, borderRadius: 5, padding: 8 },
  leyendaZona:  { fontSize: 7.5, fontFamily: 'Roboto-Bold', marginBottom: 2 },
  leyendaRatio: { fontSize: 7, color: GRIS },
  leyendaDesc:  { fontSize: 6.5, color: GRIS, marginTop: 2 },

  // Estadísticas resumen
  statsRow:  { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statCard:  { flex: 1, borderRadius: 6, padding: 8, borderWidth: 0.5, borderColor: BORDE },
  statNum:   { fontSize: 20, fontFamily: 'Roboto-Bold' },
  statLabel: { fontSize: 6.5, color: GRIS, marginTop: 1 },

  // Footer
  footer:     { position: 'absolute', bottom: 18, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: BORDE, paddingTop: 5 },
  footerText: { fontSize: 6.5, color: GRIS },
  footerBold: { fontSize: 6.5, color: GRIS, fontFamily: 'Roboto-Bold' },
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function getISOWeek(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `${d.getFullYear()}-S${String(weekNum).padStart(2, '0')}`
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { equipo } = await getEquipoActivo(supabase, user.id)
  if (!equipo) return NextResponse.json({ error: 'Sin equipo' }, { status: 404 })

  const { data: jugadores } = await supabase
    .from('jugadores').select('id, nombre, numero, posicion')
    .eq('equipo_id', equipo.id).eq('estado', 'activo').order('nombre')

  if (!jugadores?.length) return NextResponse.json({ error: 'Sin jugadores activos' }, { status: 404 })

  const { data: registros } = await supabase
    .from('registros').select('jugador_id, carga_total, sesiones(fecha)')
    .in('jugador_id', jugadores.map(j => j.id)).eq('presente', true)

  const filas = jugadores.map(j => {
    const regs = (registros ?? []).filter(r => r.jugador_id === j.id)
    const porSemana: Record<string, number> = {}
    for (const r of regs) {
      const ses = r.sesiones as unknown as { fecha: string } | null
      if (!ses) continue
      const sem = getISOWeek(new Date(ses.fecha))
      porSemana[sem] = (porSemana[sem] ?? 0) + (r.carga_total ?? 0)
    }
    const semanas = Object.entries(porSemana).sort(([a], [b]) => a.localeCompare(b))
      .map(([semana, carga_total]) => ({ semana, carga_total, sesiones: 1 }))
    const ratio = calcularRatioAC(semanas)
    return { jugador: j, ratio }
  })

  // Ordenar: riesgo → precaucion → segura → subestimulacion
  const orden: Record<string, number> = { riesgo: 0, precaucion: 1, segura: 2, subestimulacion: 3 }
  filas.sort((a, b) => (orden[a.ratio.zona] ?? 4) - (orden[b.ratio.zona] ?? 4))

  const counts = {
    riesgo:          filas.filter(f => f.ratio.zona === 'riesgo').length,
    precaucion:      filas.filter(f => f.ratio.zona === 'precaucion').length,
    segura:          filas.filter(f => f.ratio.zona === 'segura').length,
    subestimulacion: filas.filter(f => f.ratio.zona === 'subestimulacion').length,
  }

  const hoy = new Date()
  const generadoStr = hoy.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

  const doc = (
    <Document title={`Estado de Carga — ${equipo.nombre}`} author="FutbolPF">
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.clubBadge}><Text style={s.clubNombre}>{equipo.nombre}</Text></View>
          <View style={s.headerRight}>
            <Text style={s.titulo}>Estado de Carga del Plantel</Text>
            <Text style={s.subtitulo}>Ratio Agudo:Crónico · Método Gabbett (2016)</Text>
            <Text style={s.fechaGen}>Generado: {generadoStr}</Text>
          </View>
        </View>
        <View style={s.divider} />

        {/* Stats resumen */}
        <View style={s.statsRow}>
          {(['riesgo', 'precaucion', 'segura', 'subestimulacion'] as const).map(zona => (
            <View key={zona} style={[s.statCard, { backgroundColor: ZONA_BG[zona], borderColor: ZONA_COLOR[zona] }]}>
              <Text style={[s.statNum, { color: ZONA_COLOR[zona] }]}>{counts[zona]}</Text>
              <Text style={s.statLabel}>{ZONA_LABEL[zona]}</Text>
            </View>
          ))}
        </View>

        {/* Tabla */}
        <View style={s.tablaHeaderRow}>
          <View style={s.cNombre}><Text style={s.hText}>JUGADOR</Text></View>
          <View style={s.cNum}><Text style={s.hText}>N°</Text></View>
          <View style={s.cUA}><Text style={s.hText}>CARGA AGUDA</Text></View>
          <View style={s.cUA}><Text style={s.hText}>CARGA CRÓNICA</Text></View>
          <View style={s.cRatio}><Text style={s.hText}>RATIO A:C</Text></View>
          <View style={s.cZona}><Text style={s.hText}>ZONA</Text></View>
        </View>

        {filas.map(({ jugador: j, ratio }, fi) => {
          const color = ZONA_COLOR[ratio.zona]
          const bg    = ZONA_BG[ratio.zona]
          return (
            <View key={j.id} style={[s.row, fi % 2 === 1 ? s.rowPar : {}]}>
              <View style={s.cNombre}><Text style={{ fontFamily: 'Roboto-Bold' }}>{j.nombre}</Text></View>
              <View style={s.cNum}><Text style={{ color: GRIS }}>{j.numero ?? '—'}</Text></View>
              <View style={s.cUA}><Text style={{ textAlign: 'center' }}>{ratio.carga_aguda} UA</Text></View>
              <View style={s.cUA}><Text style={{ textAlign: 'center', color: GRIS }}>{ratio.carga_cronica} UA</Text></View>
              <View style={s.cRatio}>
                <Text style={{ textAlign: 'center', fontFamily: 'Roboto-Bold', fontSize: 10, color }}>
                  {ratio.ratio}
                </Text>
              </View>
              <View style={s.cZona}>
                <View style={[s.zonaBadge, { backgroundColor: bg }]}>
                  <Text style={[s.zonaText, { color }]}>{ZONA_LABEL[ratio.zona]}</Text>
                </View>
              </View>
            </View>
          )
        })}

        {/* Leyenda */}
        <View style={s.leyendaBox}>
          <Text style={s.leyendaTitulo}>LEYENDA — Ratio Agudo:Crónico (Gabbett, 2016, BJSM)</Text>
          <View style={s.leyendaGrid}>
            {([
              { zona: 'riesgo',          rango: '> 1.5',     desc: 'Reducir carga inmediatamente. Riesgo elevado de lesión.' },
              { zona: 'precaucion',      rango: '1.3 – 1.5', desc: 'Vigilar signos de fatiga. No aumentar carga esta semana.' },
              { zona: 'segura',          rango: '0.8 – 1.3', desc: 'Carga óptima. Margen para mantener o incrementar.' },
              { zona: 'subestimulacion', rango: '< 0.8',     desc: 'Carga insuficiente. Puede perderse adaptación física.' },
            ] as const).map(({ zona, rango, desc }) => (
              <View key={zona} style={[s.leyendaItem, { backgroundColor: ZONA_BG[zona] }]}>
                <Text style={[s.leyendaZona, { color: ZONA_COLOR[zona] }]}>{ZONA_LABEL[zona]}</Text>
                <Text style={[s.leyendaRatio, { color: ZONA_COLOR[zona] }]}>{rango}</Text>
                <Text style={s.leyendaDesc}>{desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <View>
            <Text style={s.footerBold}>
              {equipo.nombre}{(equipo as { nombre_pf?: string | null }).nombre_pf ? ` · PF: ${(equipo as { nombre_pf?: string | null }).nombre_pf}` : ''}
            </Text>
            <Text style={s.footerText}>Temporada completa · Generado: {generadoStr}</Text>
          </View>
          <Text style={s.footerText}>FutbolPF — futbolpf.vercel.app</Text>
        </View>

      </Page>
    </Document>
  )

  const buffer = await renderToBuffer(doc)
  const nombre = `FutbolPF_CargaPlantel_${equipo.nombre.replace(/\s+/g, '_')}_${hoy.toISOString().split('T')[0]}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombre}"`,
    },
  })
}
