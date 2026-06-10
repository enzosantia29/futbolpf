import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getEquipoActivo } from '@/lib/equipo'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { equipo } = await getEquipoActivo(supabase, user.id)

  const { data: ultimasSesiones } = equipo
    ? await supabase
        .from('sesiones')
        .select('*')
        .eq('equipo_id', equipo.id)
        .order('fecha', { ascending: false })
        .limit(3)
    : { data: null }

  const { count: totalActivos } = equipo
    ? await supabase
        .from('jugadores')
        .select('*', { count: 'exact', head: true })
        .eq('equipo_id', equipo.id)
        .eq('estado', 'activo')
    : { count: 0 }

  const { count: totalLesionados } = equipo
    ? await supabase
        .from('jugadores')
        .select('*', { count: 'exact', head: true })
        .eq('equipo_id', equipo.id)
        .eq('estado', 'lesionado')
    : { count: 0 }

  const { count: totalSuspendidos } = equipo
    ? await supabase
        .from('jugadores')
        .select('*', { count: 'exact', head: true })
        .eq('equipo_id', equipo.id)
        .eq('estado', 'suspendido')
    : { count: 0 }

  if (!equipo) {
    return (
      <div className="px-4 pt-8 pb-4">
        <div className="text-center py-12">
          <div className="text-4xl mb-3">⚽</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Bienvenido a FutbolPF</h1>
          <p className="text-gray-500 text-sm mb-6">
            Todavía no tenés un equipo configurado.
          </p>
          <Link
            href="/plantel/nuevo-equipo"
            className="bg-green-600 text-white px-6 py-3 rounded-xl text-sm font-medium"
          >
            Crear mi equipo
          </Link>
        </div>
      </div>
    )
  }

  const disponibles = (totalActivos ?? 0)
  const noDisponibles = (totalLesionados ?? 0) + (totalSuspendidos ?? 0)

  return (
    <div className="px-4 pt-4 pb-4 max-w-lg mx-auto space-y-5">
      {/* Acciones rápidas */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/sesion/nueva"
          className="bg-green-600 hover:bg-green-700 text-white rounded-2xl p-4 flex flex-col gap-1 transition-colors shadow-sm"
        >
          <span className="text-2xl">🏃</span>
          <span className="font-semibold text-sm">Nuevo entrenamiento</span>
          <span className="text-xs text-green-100">Cargar sesión de hoy</span>
        </Link>

        <Link
          href="/partido/nuevo"
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl p-4 flex flex-col gap-1 transition-colors shadow-sm"
        >
          <span className="text-2xl">⚽</span>
          <span className="font-semibold text-sm">Partido</span>
          <span className="text-xs text-blue-100">Registrar partido</span>
        </Link>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center shadow-sm">
          <div className="text-2xl font-bold text-green-600">{disponibles}</div>
          <div className="text-xs text-gray-500">Disponibles</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center shadow-sm">
          <div className="text-2xl font-bold text-red-500">{totalLesionados ?? 0}</div>
          <div className="text-xs text-gray-500">Lesionados</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center shadow-sm">
          <div className="text-2xl font-bold text-yellow-500">{totalSuspendidos ?? 0}</div>
          <div className="text-xs text-gray-500">Suspendidos</div>
        </div>
      </div>

      {/* Disponibilidad */}
      {(disponibles + noDisponibles) > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-600">Disponibilidad del plantel</p>
            <p className="text-xs font-bold text-green-700">{disponibles}/{disponibles + noDisponibles}</p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.round((disponibles / (disponibles + noDisponibles)) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {Math.round((disponibles / (disponibles + noDisponibles)) * 100)}% listo para entrenar
          </p>
        </div>
      )}

      {/* Últimas sesiones */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 text-sm">Últimas sesiones</h2>
          <Link href="/sesion" className="text-xs text-green-600">Ver todas</Link>
        </div>

        {!ultimasSesiones || ultimasSesiones.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center text-sm text-gray-400 shadow-sm">
            Todavía no hay sesiones cargadas.
          </div>
        ) : (
          <div className="space-y-2">
            {ultimasSesiones.map(sesion => (
              <div
                key={sesion.id}
                className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{sesion.tipo === 'partido' ? '⚽' : '🏃'}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {sesion.tipo === 'partido'
                        ? `Partido${sesion.rival ? ` vs ${sesion.rival}` : ''}`
                        : 'Entrenamiento'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(sesion.fecha + 'T12:00:00').toLocaleDateString('es-AR', {
                        weekday: 'short', day: 'numeric', month: 'short'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Accesos secundarios */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/plantel"
          className="bg-white border border-gray-200 hover:border-green-300 rounded-xl p-3 flex items-center gap-3 transition-colors shadow-sm"
        >
          <span className="text-xl">👥</span>
          <div>
            <p className="text-sm font-medium text-gray-900">Plantel</p>
            <p className="text-xs text-gray-400">Gestionar jugadores</p>
          </div>
        </Link>

        <Link
          href="/alertas"
          className="bg-white border border-gray-200 hover:border-yellow-300 rounded-xl p-3 flex items-center gap-3 transition-colors shadow-sm"
        >
          <span className="text-xl">⚠️</span>
          <div>
            <p className="text-sm font-medium text-gray-900">Alertas</p>
            <p className="text-xs text-gray-400">Ratio A:C del plantel</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
