import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import WellnessForm from './WellnessForm'

export default async function WellnessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: jugador } = await supabase
    .from('jugadores').select('nombre, equipo_id').eq('id', id).single()
  if (!jugador) redirect('/plantel')

  const hoy = new Date().toISOString().split('T')[0]
  const fechaLabel = new Date(hoy + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const { data: existente } = await supabase
    .from('wellness')
    .select('sueno, fatiga, dolor, estres, humor')
    .eq('jugador_id', id)
    .eq('fecha', hoy)
    .maybeSingle()

  return (
    <div className="px-4 pt-6 pb-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/jugador/${id}`} className="text-gray-400 text-xl leading-none">←</Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Wellness</h1>
          <p className="text-sm text-gray-500 capitalize">{jugador.nombre} · {fechaLabel}</p>
        </div>
      </div>

      <WellnessForm
        jugadorId={id}
        equipoId={jugador.equipo_id}
        existente={existente ?? null}
      />
    </div>
  )
}
