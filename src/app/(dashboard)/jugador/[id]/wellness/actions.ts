'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function guardarWellness(data: {
  jugadorId: string
  equipoId: string
  sueno: number
  fatiga: number
  dolor: number
  estres: number
  humor: number
}) {
  const supabase = await createClient()
  const hoy = new Date().toISOString().split('T')[0]

  const { error } = await supabase.from('wellness').upsert(
    {
      jugador_id: data.jugadorId,
      equipo_id: data.equipoId,
      fecha: hoy,
      sueno: data.sueno,
      fatiga: data.fatiga,
      dolor: data.dolor,
      estres: data.estres,
      humor: data.humor,
    },
    { onConflict: 'jugador_id,fecha' }
  )

  if (error) throw error

  revalidatePath(`/jugador/${data.jugadorId}`)
}
