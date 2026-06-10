'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  jugadorId: string
  nombre: string
}

export default function EliminarJugador({ jugadorId, nombre }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [paso, setPaso] = useState<'idle' | 'confirmar' | 'loading'>('idle')

  async function handleEliminar() {
    setPaso('loading')
    await supabase.from('jugadores').update({ estado: 'baja' }).eq('id', jugadorId)
    router.push('/plantel')
    router.refresh()
  }

  if (paso === 'idle') {
    return (
      <button
        onClick={() => setPaso('confirmar')}
        className="w-full border border-red-200 text-red-500 bg-white font-medium py-2.5 rounded-xl text-sm hover:bg-red-50 transition-colors"
      >
        Dar de baja al jugador
      </button>
    )
  }

  if (paso === 'confirmar') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-red-800">¿Dar de baja a {nombre}?</p>
        <p className="text-xs text-red-600">
          El jugador dejará de aparecer en el plantel activo. Su historial de sesiones y tarjetas se conserva. Podés reactivarlo desde la base de datos si es necesario.
        </p>
        <div className="flex gap-2">
          <button onClick={() => setPaso('idle')} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm">
            Cancelar
          </button>
          <button
            onClick={handleEliminar}
            className="flex-1 bg-red-600 text-white py-2 rounded-xl text-sm font-semibold"
          >
            Confirmar baja
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="text-center py-4 text-sm text-gray-400">Procesando...</div>
  )
}
