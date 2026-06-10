import { cookies } from 'next/headers'

// Solo para server components y API routes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getEquipoActivo(supabase: any, userId: string) {
  const cookieStore = await cookies()
  const equipoIdCookie = cookieStore.get('equipo_activo')?.value

  const { data: equipos } = await supabase
    .from('equipos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(2)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!equipos?.length) return { equipo: null as any, equipos: [] as any[] }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let equipo: any = equipos[0]
  if (equipoIdCookie) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const match = equipos.find((e: any) => e.id === equipoIdCookie)
    if (match) equipo = match
  }

  return { equipo, equipos }
}
