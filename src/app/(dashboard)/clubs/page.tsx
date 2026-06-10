'use client'

import { useState, useEffect, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cambiarEquipoActivo } from '@/app/actions/equipo'
import Image from 'next/image'

type Equipo = {
  id: string
  nombre: string
  temporada_activa: string
  logo_url: string | null
  _jugadores?: number
}

export default function ClubsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: eqs, error: eqsError } = await supabase
        .from('equipos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at')
        .limit(2)

      if (eqsError) {
        console.error('Error cargando clubes:', eqsError.message)
        setCargando(false)
        return
      }
      if (!eqs?.length) {
        router.push('/plantel/nuevo-equipo')
        return
      }

      // Contar jugadores activos por equipo
      const conConteo = await Promise.all(eqs.map(async eq => {
        const { count } = await supabase
          .from('jugadores')
          .select('id', { count: 'exact', head: true })
          .eq('equipo_id', eq.id)
          .eq('estado', 'activo')
        return { ...eq, _jugadores: count ?? 0 }
      }))

      setEquipos(conConteo)
      setCargando(false)
    }
    cargar()
  }, [])

  function entrarClub(id: string) {
    setLoadingId(id)
    startTransition(async () => {
      await cambiarEquipoActivo(id)
      router.push('/dashboard')
    })
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-4 pt-8 pb-6 max-w-lg mx-auto">
      {/* Título */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-green-600 uppercase tracking-widest mb-1">FutbolPF</p>
        <h1 className="text-2xl font-extrabold text-gray-900">Mis clubes</h1>
        <p className="text-sm text-gray-400 mt-1">
          {equipos.length === 1
            ? 'Tu club activo. Tocá para entrar.'
            : 'Seleccioná el club con el que trabajar hoy.'}
        </p>
      </div>

      <div className="space-y-3">
        {equipos.map(eq => {
          const iniciales = eq.nombre
            .split(' ')
            .map(w => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()
          const entrando = loadingId === eq.id

          return (
            <button
              key={eq.id}
              onClick={() => entrarClub(eq.id)}
              disabled={loadingId !== null}
              className={`w-full bg-white border rounded-2xl p-5 flex items-center gap-4 shadow-sm text-left transition-all
                ${entrando
                  ? 'border-green-500 shadow-green-100 shadow-md scale-[0.99]'
                  : 'border-gray-200 hover:border-green-400 hover:shadow-md active:scale-[0.99]'
                }`}
            >
              {/* Logo del club */}
              <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-green-100 border-2 border-green-200 flex items-center justify-center shadow-sm">
                {eq.logo_url ? (
                  <Image
                    src={eq.logo_url}
                    alt={eq.nombre}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="text-xl font-extrabold text-green-700 leading-none select-none">
                    {iniciales}
                  </span>
                )}
              </div>

              {/* Info del club */}
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold text-gray-900 truncate leading-tight">{eq.nombre}</p>
                <p className="text-sm text-gray-400 mt-0.5">Temporada {eq.temporada_activa}</p>
                {eq._jugadores !== undefined && (
                  <p className="text-xs text-green-600 mt-1 font-medium">
                    {eq._jugadores} jugador{eq._jugadores !== 1 ? 'es' : ''} activo{eq._jugadores !== 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {/* Flecha / loading */}
              <div className="flex-shrink-0 w-8 flex items-center justify-center">
                {entrando ? (
                  <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="text-gray-300 text-xl font-light">›</span>
                )}
              </div>
            </button>
          )
        })}

        {/* Agregar segundo club */}
        {equipos.length < 2 && (
          <button
            onClick={() => router.push('/plantel/nuevo-equipo')}
            className="w-full border-2 border-dashed border-gray-300 rounded-2xl p-5 flex items-center gap-4 hover:border-green-400 hover:bg-green-50/50 transition-all text-left group"
          >
            <div className="w-16 h-16 rounded-full bg-gray-100 group-hover:bg-green-100 flex items-center justify-center flex-shrink-0 transition-colors">
              <span className="text-2xl text-gray-400 group-hover:text-green-500 transition-colors">+</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600 group-hover:text-green-700 transition-colors">
                Agregar otro club
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                ¿Trabajás en un segundo club también?
              </p>
            </div>
          </button>
        )}
      </div>
    </div>
  )
}
