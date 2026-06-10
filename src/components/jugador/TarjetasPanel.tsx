'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  jugadorId: string
  amarillas: number
  rojas: number
  ultimoReset: string | null
}

export default function TarjetasPanel({ jugadorId, amarillas, rojas, ultimoReset }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [confirmar, setConfirmar] = useState(false)
  const [loading, setLoading] = useState(false)

  const suspendidoPorAmarillos = amarillas > 0 && amarillas % 5 === 0
  const avisoPorAmarillos = amarillas % 5 === 4
  const suspendidoPorRoja = rojas > 0

  async function handleLimpiarTarjetas() {
    setLoading(true)
    const hoy = new Date().toISOString().split('T')[0]
    await supabase.from('jugadores').update({ ultimo_reset_tarjetas: hoy }).eq('id', jugadorId)
    router.refresh()
    setConfirmar(false)
    setLoading(false)
  }

  const tieneTarjetas = amarillas > 0 || rojas > 0

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tarjetas</p>

      {/* Contadores */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🟡</span>
          <div>
            <p className="text-xl font-bold text-gray-900 leading-none">{amarillas}</p>
            <p className="text-xs text-gray-400">amarillas</p>
          </div>
        </div>
        <div className="w-px h-8 bg-gray-200" />
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔴</span>
          <div>
            <p className="text-xl font-bold text-gray-900 leading-none">{rojas}</p>
            <p className="text-xs text-gray-400">rojas</p>
          </div>
        </div>

        {tieneTarjetas && (
          <div className="flex-1 text-right">
            <p className="text-xs text-gray-400">
              {amarillas % 5 > 0 ? `${5 - (amarillas % 5)} para susp.` : ''}
            </p>
          </div>
        )}
      </div>

      {/* Alertas de suspensión */}
      {suspendidoPorAmarillos && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <p className="text-sm font-semibold text-red-700">⛔ Suspendido — {amarillas} amarillas</p>
          <p className="text-xs text-red-500 mt-0.5">Próxima fecha no puede jugar.</p>
        </div>
      )}

      {suspendidoPorRoja && !suspendidoPorAmarillos && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <p className="text-sm font-semibold text-red-700">⛔ Expulsado — tarjeta roja</p>
          <p className="text-xs text-red-500 mt-0.5">Verificar fechas de suspensión con el torneo.</p>
        </div>
      )}

      {avisoPorAmarillos && !suspendidoPorAmarillos && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2">
          <p className="text-sm font-semibold text-yellow-700">⚠ Una más = suspensión</p>
          <p className="text-xs text-yellow-600 mt-0.5">{amarillas} amarillas acumuladas.</p>
        </div>
      )}

      {!tieneTarjetas && (
        <p className="text-sm text-gray-400">Sin tarjetas acumuladas.</p>
      )}

      {/* Reset */}
      {tieneTarjetas && !confirmar && (
        <button
          onClick={() => setConfirmar(true)}
          className="w-full border border-gray-300 text-gray-600 bg-white font-medium py-2 rounded-xl text-sm hover:bg-gray-50 transition-colors"
        >
          🗑 Limpiar tarjetas
        </button>
      )}

      {confirmar && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
          <p className="text-sm font-medium text-gray-800">¿Confirmar limpieza de tarjetas?</p>
          <p className="text-xs text-gray-500">Las tarjetas anteriores quedan en el historial de partidos. Solo se resetea el conteo actual.</p>
          <div className="flex gap-2 mt-1">
            <button onClick={() => setConfirmar(false)} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm">
              Cancelar
            </button>
            <button
              onClick={handleLimpiarTarjetas}
              disabled={loading}
              className="flex-1 bg-gray-800 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}

      {ultimoReset && (
        <p className="text-xs text-gray-400">
          Último reset: {new Date(ultimoReset + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}
    </div>
  )
}
