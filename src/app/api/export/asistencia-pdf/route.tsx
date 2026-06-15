import { createClient } from '@/lib/supabase/server'
import { getEquipoActivo } from '@/lib/equipo'
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, Document, Page, View, Text, StyleSheet, Font } from '@react-pdf/renderer'
import path from 'path'

Font.register({ family: 'Roboto',     src: path.join(process.cwd(), 'public/fonts/Roboto-Regular.woff') })
Font.register({ family: 'Roboto-Bold', src: path.join(process.cwd(), 'public/fonts/Roboto-Bold.woff') })

// ── Estilos ──────────────────────────────────────────────────────────────────

const VERDE  = '#16a34a'
const GRIS   = '#6b7280'
const GRIS_L = '#f3f4f6'
const BORDE  = '#e5e7eb'
const NEGRO  = '#111827'

const styles = StyleSheet.create({
  page: { fontFamily: 'Roboto', fontSize: 8, padding: 28, backgroundColor: '#ffffff', color: NEGRO },

  // Header
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  clubBadge:   { backgroundColor: VERDE, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  clubNombre:  { color: '#ffffff', fontSize: 13, fontFamily: 'Roboto-Bold' },
  headerRight: { alignItems: 'flex-end' },
  titulo:      { fontSize: 11, fontFamily: 'Roboto-Bold', color: NEGRO },
  subtitulo:   { fontSize: 7.5, color: GRIS, marginTop: 2 },
  periodo:     { fontSize: 7, color: VERDE, fontFamily: 'Roboto-Bold', marginTop: 3 },

  divider: { borderBottomWidth: 1, borderBottomColor: BORDE, marginBottom: 12 },

  // Tabla asistencia
  tablaTitulo:  { fontSize: 8.5, fontFamily: 'Roboto-Bold', color: NEGRO, marginBottom: 5 },
  tablaRow:     { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: BORDE, minHeight: 16, alignItems: 'center' },
  tablaRowPar:  { backgroundColor: GRIS_L },
  tablaHeaderRow: { flexDirection: 'row', backgroundColor: VERDE, minHeight: 18, alignItems: 'center', borderRadius: 3, marginBottom: 1 },

  celdaNombre:   { width: 110, paddingHorizontal: 5, paddingVertical: 3 },
  celdaNum:      { width: 22,  paddingHorizontal: 3, textAlign: 'center' },
  celdaSesion:   { width: 34,  paddingHorizontal: 2, textAlign: 'center', paddingVertical: 3 },
  celdaTotal:    { width: 40,  paddingHorizontal: 4, textAlign: 'center', paddingVertical: 3 },
  celdaPct:      { width: 42,  paddingHorizontal: 4, textAlign: 'center', paddingVertical: 3 },

  headerText:  { color: '#ffffff', fontFamily: 'Roboto-Bold', fontSize: 7 },
  presente:    { color: VERDE, fontFamily: 'Roboto-Bold' },
  ausente:     { color: '#dc2626' },
  sinDato:     { color: '#9ca3af' },

  // Tabla carga
  celdaCarga:  { width: 38, paddingHorizontal: 3, textAlign: 'center', paddingVertical: 3 },
  celdaTotal2: { width: 46, paddingHorizontal: 4, textAlign: 'center', paddingVertical: 3, fontFamily: 'Roboto-Bold' },

  // Footer
  footer:     { position: 'absolute', bottom: 18, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: BORDE, paddingTop: 5 },
  footerText: { fontSize: 6.5, color: GRIS },
  footerBold: { fontSize: 6.5, color: GRIS, fontFamily: 'Roboto-Bold' },

  pageNum:    { position: 'absolute', bottom: 18, right: 28, fontSize: 6.5, color: GRIS },

  // Resumen sesiones
  resumenGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  resumenCard:   { width: 76, backgroundColor: GRIS_L, borderRadius: 5, padding: 6, borderLeftWidth: 2, borderLeftColor: VERDE },
  resumenCardP:  { width: 76, backgroundColor: '#eff6ff', borderRadius: 5, padding: 6, borderLeftWidth: 2, borderLeftColor: '#3b82f6' },
  resumenTipo:   { fontSize: 6, color: GRIS, fontFamily: 'Roboto-Bold', textTransform: 'uppercase', marginBottom: 2 },
  resumenFecha:  { fontSize: 7.5, fontFamily: 'Roboto-Bold', color: NEGRO },
  resumenCarga:  { fontSize: 6.5, color: GRIS, marginTop: 2 },
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtFecha(fecha: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', opts)
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { equipo } = await getEquipoActivo(supabase, user.id)
  if (!equipo) return NextResponse.json({ error: 'Sin equipo' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const hoy = new Date()
  const periodo   = searchParams.get('periodo')
  const desdeParam = searchParams.get('desde')
  const hastaParam = searchParams.get('hasta')

  let desde: string
  const hasta: string = hastaParam ?? hoy.toISOString().split('T')[0]
  if (desdeParam) {
    desde = desdeParam
  } else if (periodo === 'semana') {
    const d = new Date(hoy); d.setDate(d.getDate() - 7); desde = d.toISOString().split('T')[0]
  } else if (periodo === 'temporada') {
    desde = `${hoy.getFullYear()}-01-01`
  } else {
    const d = new Date(hoy); d.setDate(d.getDate() - 30); desde = d.toISOString().split('T')[0]
  }

  const { data: sesiones } = await supabase
    .from('sesiones').select('id, fecha, tipo, rival, duracion_pf, rpe_partido')
    .eq('equipo_id', equipo.id).gte('fecha', desde).lte('fecha', hasta)
    .order('fecha', { ascending: true })

  if (!sesiones?.length) return NextResponse.json({ error: 'Sin sesiones en el período' }, { status: 404 })

  const { data: jugadores } = await supabase
    .from('jugadores').select('id, nombre, numero')
    .eq('equipo_id', equipo.id).neq('estado', 'baja').order('nombre')

  if (!jugadores) return NextResponse.json({ error: 'Sin jugadores' }, { status: 404 })

  const { data: registros } = await supabase
    .from('registros').select('jugador_id, sesion_id, presente, carga_total')
    .in('sesion_id', sesiones.map(s => s.id))

  type RegEntry = { presente: boolean; carga: number }
  const idx: Record<string, Record<string, RegEntry>> = {}
  for (const r of registros ?? []) {
    if (!idx[r.jugador_id]) idx[r.jugador_id] = {}
    idx[r.jugador_id][r.sesion_id] = { presente: r.presente, carga: r.carga_total ?? 0 }
  }

  const periodoLabel = desdeParam
    ? `${fmtFecha(desde, { day: 'numeric', month: 'short', year: 'numeric' })} al ${fmtFecha(hasta, { day: 'numeric', month: 'short', year: 'numeric' })}`
    : periodo === 'semana' ? 'Esta semana'
    : periodo === 'temporada' ? 'Temporada completa'
    : 'Últimos 30 días'

  const generadoStr = hoy.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

  // Limitar columnas de sesiones por página
  const MAX_COLS = 12
  const chunks: typeof sesiones[] = []
  for (let i = 0; i < sesiones.length; i += MAX_COLS) chunks.push(sesiones.slice(i, i + MAX_COLS))

  const FooterComp = ({ equipo: eq, periodo: p, generado }: { equipo: { nombre: string; nombre_pf?: string | null }, periodo: string, generado: string }) => (
    <View style={styles.footer}>
      <View>
        <Text style={styles.footerBold}>{eq.nombre}{eq.nombre_pf ? ` · PF: ${eq.nombre_pf}` : ''}</Text>
        <Text style={styles.footerText}>Período: {p}  ·  Generado: {generado}</Text>
      </View>
      <Text style={styles.footerText}>FutbolPF — futbolpf.vercel.app</Text>
    </View>
  )

  const doc = (
    <Document title={`Asistencia y Carga — ${equipo.nombre}`} author="FutbolPF">

      {/* ── Páginas de asistencia ── */}
      {chunks.map((chunk, ci) => (
        <Page key={`as-${ci}`} size="A4" orientation="landscape" style={styles.page}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.clubBadge}><Text style={styles.clubNombre}>{equipo.nombre}</Text></View>
            <View style={styles.headerRight}>
              <Text style={styles.titulo}>Asistencia del Plantel</Text>
              <Text style={styles.subtitulo}>{sesiones.length} sesiones · {jugadores.length} jugadores</Text>
              <Text style={styles.periodo}>{periodoLabel}</Text>
            </View>
          </View>
          <View style={styles.divider} />

          {/* Tabla */}
          <Text style={styles.tablaTitulo}>
            ASISTENCIA {chunks.length > 1 ? `(parte ${ci + 1} de ${chunks.length})` : ''}
          </Text>

          {/* Header tabla */}
          <View style={styles.tablaHeaderRow}>
            <View style={styles.celdaNombre}><Text style={styles.headerText}>JUGADOR</Text></View>
            <View style={styles.celdaNum}><Text style={styles.headerText}>N°</Text></View>
            {chunk.map(s => (
              <View key={s.id} style={styles.celdaSesion}>
                <Text style={[styles.headerText, { fontSize: 6 }]}>
                  {s.tipo === 'partido' ? 'PAR' : 'ENT'} {fmtFecha(s.fecha, { day: 'numeric', month: 'short' })}
                </Text>
              </View>
            ))}
            <View style={styles.celdaTotal}><Text style={styles.headerText}>PRES.</Text></View>
            <View style={styles.celdaTotal}><Text style={styles.headerText}>AUS.</Text></View>
            <View style={styles.celdaPct}><Text style={styles.headerText}>% ASIST.</Text></View>
          </View>

          {/* Filas */}
          {jugadores.map((j, ji) => {
            let presentes = 0, ausentes = 0
            return (
              <View key={j.id} style={[styles.tablaRow, ji % 2 === 1 ? styles.tablaRowPar : {}]}>
                <View style={styles.celdaNombre}><Text>{j.nombre}</Text></View>
                <View style={styles.celdaNum}><Text style={{ color: GRIS }}>{j.numero ?? '—'}</Text></View>
                {chunk.map(s => {
                  const reg = idx[j.id]?.[s.id]
                  if (!reg) return <View key={s.id} style={styles.celdaSesion}><Text style={styles.sinDato}>—</Text></View>
                  if (reg.presente) { presentes++ }
                  else { ausentes++ }
                  return (
                    <View key={s.id} style={styles.celdaSesion}>
                      <Text style={reg.presente ? styles.presente : styles.ausente}>
                        {reg.presente ? '✓' : '✗'}
                      </Text>
                    </View>
                  )
                })}
                <View style={styles.celdaTotal}><Text style={{ fontFamily: 'Roboto-Bold' }}>{presentes}</Text></View>
                <View style={styles.celdaTotal}><Text style={styles.ausente}>{ausentes}</Text></View>
                <View style={styles.celdaPct}>
                  <Text style={{ fontFamily: 'Roboto-Bold', color: VERDE }}>
                    {presentes + ausentes > 0 ? `${Math.round((presentes / (presentes + ausentes)) * 100)}%` : '—'}
                  </Text>
                </View>
              </View>
            )
          })}

          <FooterComp equipo={equipo} periodo={periodoLabel} generado={generadoStr} />
        </Page>
      ))}

      {/* ── Página de carga UA ── */}
      {chunks.map((chunk, ci) => (
        <Page key={`cg-${ci}`} size="A4" orientation="landscape" style={styles.page}>
          <View style={styles.header}>
            <View style={styles.clubBadge}><Text style={styles.clubNombre}>{equipo.nombre}</Text></View>
            <View style={styles.headerRight}>
              <Text style={styles.titulo}>Carga Individual (UA)</Text>
              <Text style={styles.subtitulo}>Unidades Arbitrarias — RPE × Duración (Foster 2001)</Text>
              <Text style={styles.periodo}>{periodoLabel}</Text>
            </View>
          </View>
          <View style={styles.divider} />

          <Text style={styles.tablaTitulo}>
            CARGA POR SESIÓN {chunks.length > 1 ? `(parte ${ci + 1} de ${chunks.length})` : ''}
          </Text>

          <View style={styles.tablaHeaderRow}>
            <View style={styles.celdaNombre}><Text style={styles.headerText}>JUGADOR</Text></View>
            <View style={styles.celdaNum}><Text style={styles.headerText}>N°</Text></View>
            {chunk.map(s => (
              <View key={s.id} style={styles.celdaCarga}>
                <Text style={[styles.headerText, { fontSize: 6 }]}>
                  {s.tipo === 'partido' ? 'PAR' : 'ENT'} {fmtFecha(s.fecha, { day: 'numeric', month: 'short' })}
                </Text>
              </View>
            ))}
            <View style={styles.celdaTotal2}><Text style={styles.headerText}>TOTAL UA</Text></View>
            <View style={styles.celdaTotal2}><Text style={styles.headerText}>PROM./SES.</Text></View>
          </View>

          {jugadores.map((j, ji) => {
            let total = 0, count = 0
            return (
              <View key={j.id} style={[styles.tablaRow, ji % 2 === 1 ? styles.tablaRowPar : {}]}>
                <View style={styles.celdaNombre}><Text>{j.nombre}</Text></View>
                <View style={styles.celdaNum}><Text style={{ color: GRIS }}>{j.numero ?? '—'}</Text></View>
                {chunk.map(s => {
                  const reg = idx[j.id]?.[s.id]
                  if (!reg || !reg.presente) return <View key={s.id} style={styles.celdaCarga}><Text style={styles.sinDato}>—</Text></View>
                  total += reg.carga; count++
                  return <View key={s.id} style={styles.celdaCarga}><Text style={{ color: NEGRO }}>{Math.round(reg.carga)}</Text></View>
                })}
                <View style={styles.celdaTotal2}><Text style={{ color: VERDE, fontFamily: 'Roboto-Bold' }}>{Math.round(total)}</Text></View>
                <View style={styles.celdaTotal2}><Text style={{ color: GRIS }}>{count > 0 ? Math.round(total / count) : '—'}</Text></View>
              </View>
            )
          })}

          <FooterComp equipo={equipo} periodo={periodoLabel} generado={generadoStr} />
        </Page>
      ))}

      {/* ── Página resumen de sesiones ── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.clubBadge}><Text style={styles.clubNombre}>{equipo.nombre}</Text></View>
          <View style={styles.headerRight}>
            <Text style={styles.titulo}>Resumen de Sesiones</Text>
            <Text style={styles.subtitulo}>{sesiones.length} sesiones en el período</Text>
            <Text style={styles.periodo}>{periodoLabel}</Text>
          </View>
        </View>
        <View style={styles.divider} />

        <Text style={styles.tablaTitulo}>SESIONES DEL PERÍODO</Text>

        <View style={styles.resumenGrid}>
          {sesiones.map(s => {
            const regsP = (registros ?? []).filter(r => r.sesion_id === s.id && r.presente)
            const cargaProm = regsP.length > 0
              ? Math.round(regsP.reduce((a, r) => a + (r.carga_total ?? 0), 0) / regsP.length)
              : 0
            const esPartido = s.tipo === 'partido'
            return (
              <View key={s.id} style={esPartido ? styles.resumenCardP : styles.resumenCard}>
                <Text style={styles.resumenTipo}>{esPartido ? 'Partido' : 'Entrenamiento'}</Text>
                <Text style={styles.resumenFecha}>
                  {fmtFecha(s.fecha, { weekday: 'short', day: 'numeric', month: 'short' })}
                </Text>
                {esPartido && s.rival ? <Text style={[styles.resumenCarga, { color: '#3b82f6' }]}>vs {s.rival}</Text> : null}
                <Text style={styles.resumenCarga}>{regsP.length} pres. · {cargaProm} UA prom.</Text>
              </View>
            )
          })}
        </View>

        <FooterComp equipo={equipo} periodo={periodoLabel} generado={generadoStr} />
      </Page>

    </Document>
  )

  const buffer = await renderToBuffer(doc)
  const sufijo = desdeParam ? `${desde}_${hasta}` : (periodo ?? 'mes')
  const nombre = `FutbolPF_Asistencia_${equipo.nombre.replace(/\s+/g, '_')}_${sufijo}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombre}"`,
    },
  })
}
