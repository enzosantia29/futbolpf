'use client'

import { useState } from 'react'

type Periodo = 'semana' | 'mes' | 'temporada' | 'custom'

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: 'semana',    label: 'Esta semana' },
  { value: 'mes',       label: 'Últimos 30 días' },
  { value: 'temporada', label: 'Temporada' },
  { value: 'custom',    label: '📅 Fechas' },
]

function hoy() { return new Date().toISOString().split('T')[0] }
function hace30() {
  const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
}

export default function ReportesPage() {
  const [periodo, setPeriodo]               = useState<Periodo>('mes')
  const [desde, setDesde]                   = useState(hace30())
  const [hasta, setHasta]                   = useState(hoy())
  const [loadingAsistXls, setLoadingAsistXls] = useState(false)
  const [loadingAsistPdf, setLoadingAsistPdf] = useState(false)
  const [loadingCargaXls, setLoadingCargaXls] = useState(false)
  const [loadingCargaPdf, setLoadingCargaPdf] = useState(false)
  const [error, setError]                   = useState('')

  function buildUrl(base: string): string {
    return periodo === 'custom'
      ? `${base}?desde=${desde}&hasta=${hasta}`
      : `${base}?periodo=${periodo}`
  }

  async function descargar(base: string, setLoading: (v: boolean) => void, ext: 'xlsx' | 'pdf') {
    if (periodo === 'custom' && desde > hasta) {
      setError('La fecha de inicio no puede ser posterior a la fecha de fin.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(buildUrl(base))
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Error al generar el reporte.')
        return
      }
      const blob = await res.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      const cd = res.headers.get('Content-Disposition') ?? ''
      const match = cd.match(/filename="(.+)"/)
      link.download = match ? match[1] : `reporte.${ext}`
      link.click()
      URL.revokeObjectURL(link.href)
    } catch {
      setError('No se pudo generar el reporte. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const periodoLabel =
    periodo === 'semana'    ? 'Esta semana' :
    periodo === 'mes'       ? 'Últimos 30 días' :
    periodo === 'temporada' ? 'Temporada completa' :
    `${desde} al ${hasta}`

  return (
    <div className="px-4 pt-6 pb-6 max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-400">Descargá los datos del equipo en PDF o Excel</p>
      </div>

      {/* Selector de período */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Período</p>
        <div className="grid grid-cols-4 gap-1.5">
          {PERIODOS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriodo(p.value)}
              className={`py-2 px-1 rounded-xl text-xs font-medium transition-colors ${
                periodo === p.value
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:border-gray-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {periodo === 'custom' && (
          <div className="mt-3 grid grid-cols-2 gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)} max={hasta}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} min={desde} max={hoy()}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── Reporte 1: Asistencia y Carga ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-xl flex-shrink-0">📋</div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">Asistencia y Carga del Plantel</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Asistencia por sesión (✓/✗), carga UA individual y resumen de sesiones del período.
            </p>
            <p className="text-xs text-green-600 font-medium mt-1">Período: {periodoLabel}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => descargar('/api/export/asistencia-pdf', setLoadingAsistPdf, 'pdf')}
            disabled={loadingAsistPdf}
            className="flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
          >
            {loadingAsistPdf ? <Spinner /> : <><span>📄</span> PDF</>}
          </button>
          <button
            onClick={() => descargar('/api/export/asistencia', setLoadingAsistXls, 'xlsx')}
            disabled={loadingAsistXls}
            className="flex items-center justify-center gap-1.5 bg-white border-2 border-green-600 hover:bg-green-50 disabled:opacity-50 text-green-700 font-medium py-2.5 rounded-xl text-sm transition-colors"
          >
            {loadingAsistXls ? <Spinner color="green" /> : <><span>📊</span> Excel</>}
          </button>
        </div>
      </div>

      {/* ── Reporte 2: Carga A:C ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-xl flex-shrink-0">⚠️</div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">Estado de Carga — Ratio A:C</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Plantel ordenado por zona de riesgo con carga aguda, crónica y ratio A:C. Ideal para la reunión con el cuerpo técnico.
            </p>
            <p className="text-xs text-orange-500 font-medium mt-1">Siempre usa toda la temporada</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => descargar('/api/export/carga-plantel-pdf', setLoadingCargaPdf, 'pdf')}
            disabled={loadingCargaPdf}
            className="flex items-center justify-center gap-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
          >
            {loadingCargaPdf ? <Spinner /> : <><span>📄</span> PDF</>}
          </button>
          <button
            onClick={() => descargar('/api/export/carga-plantel', setLoadingCargaXls, 'xlsx')}
            disabled={loadingCargaXls}
            className="flex items-center justify-center gap-1.5 bg-white border-2 border-orange-500 hover:bg-orange-50 disabled:opacity-50 text-orange-600 font-medium py-2.5 rounded-xl text-sm transition-colors"
          >
            {loadingCargaXls ? <Spinner color="orange" /> : <><span>📊</span> Excel</>}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500 space-y-1.5">
        <p className="font-semibold text-gray-600">¿Cómo usar los reportes?</p>
        <p><span className="font-medium text-gray-700">PDF</span> — listo para imprimir o compartir por WhatsApp. Con colores, logo del club y formato profesional.</p>
        <p><span className="font-medium text-gray-700">Excel</span> — para trabajar los datos, filtrar o pegar en Google Sheets.</p>
      </div>
    </div>
  )
}

function Spinner({ color = 'white' }: { color?: 'white' | 'green' | 'orange' }) {
  const cls = color === 'white' ? 'text-white' : color === 'green' ? 'text-green-600' : 'text-orange-500'
  return (
    <svg className={`animate-spin h-4 w-4 ${cls}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}
