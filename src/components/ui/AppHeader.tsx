'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cambiarEquipoActivo } from '@/app/actions/equipo'

interface Equipo {
  id: string
  nombre: string
  temporada_activa: string
  nombre_pf?: string | null
  logo_url?: string | null
}

interface Props {
  equipoActivo: Equipo | null
  equipos: Equipo[]
}

export default function AppHeader({ equipoActivo, equipos }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const tieneMultiples = equipos.length > 1

  function handleCambiarRapido(id: string) {
    if (id === equipoActivo?.id) return
    startTransition(async () => {
      await cambiarEquipoActivo(id)
      router.refresh()
    })
  }

  const iniciales = equipoActivo?.nombre
    ? equipoActivo.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'PF'

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-green-900">
        {/* Decoración de líneas del campo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.12]" aria-hidden="true">
          <svg viewBox="0 0 400 52" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
            <line x1="200" y1="-20" x2="200" y2="72" stroke="white" strokeWidth="1.5"/>
            <circle cx="200" cy="26" r="22" fill="none" stroke="white" strokeWidth="1.5"/>
            <rect x="0" y="0" width="400" height="52" fill="none" stroke="white" strokeWidth="1.5"/>
          </svg>
        </div>

        <div className="relative max-w-lg mx-auto px-4 py-2.5 flex items-center justify-between gap-2">

          {/* Izquierda: logo + nombre del club → va a /clubs */}
          <Link href="/clubs" className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Logo del club */}
            {equipoActivo?.logo_url ? (
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-green-700 shadow-sm">
                <Image
                  src={equipoActivo.logo_url}
                  alt={equipoActivo.nombre}
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full flex-shrink-0 bg-green-800 border border-green-700 flex items-center justify-center">
                <span className="text-[9px] font-extrabold text-green-300 leading-none">{iniciales}</span>
              </div>
            )}

            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-medium tracking-widest text-green-400 uppercase">FutbolPF</span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold text-white truncate max-w-[170px] leading-tight">
                  {equipoActivo?.nombre ?? 'Sin equipo'}
                </span>
                {/* Indicador de múltiples clubes */}
                {tieneMultiples && (
                  <span className="text-green-400 text-[9px] flex-shrink-0 mt-0.5">▼</span>
                )}
              </div>
            </div>
          </Link>

          {/* Derecha: temporada + configuración */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {equipoActivo && (
              <span className="text-xs text-green-400 font-medium">{equipoActivo.temporada_activa}</span>
            )}
            <Link
              href="/perfil"
              className="text-green-300 hover:text-white transition-colors text-base leading-none"
              title="Configuración"
            >
              ⚙
            </Link>
          </div>
        </div>

        {/* Cambio rápido de club (si hay 2) — tira horizontal bajo el header */}
        {tieneMultiples && (
          <div className="relative max-w-lg mx-auto px-4 pb-2 flex gap-2">
            {equipos.map(eq => (
              <button
                key={eq.id}
                type="button"
                onClick={() => handleCambiarRapido(eq.id)}
                className={`flex-1 text-center text-xs py-1 rounded-lg font-medium transition-colors truncate ${
                  eq.id === equipoActivo?.id
                    ? 'bg-green-700 text-white'
                    : 'bg-green-800/60 text-green-300 hover:bg-green-700/50'
                }`}
              >
                {eq.nombre}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Espaciador */}
      <div className={tieneMultiples ? 'h-[76px]' : 'h-[52px]'} />
    </>
  )
}
