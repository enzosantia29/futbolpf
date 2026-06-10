'use server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function cambiarEquipoActivo(equipoId: string) {
  const cookieStore = await cookies()
  cookieStore.set('equipo_activo', equipoId, {
    path: '/',
    httpOnly: false,    // Necesario para que los client components puedan leerla
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  revalidatePath('/', 'layout')
}
