import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NavBar from '@/components/ui/NavBar'
import AppHeader from '@/components/ui/AppHeader'
import { getEquipoActivo } from '@/lib/equipo'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { equipo, equipos } = await getEquipoActivo(supabase, user.id)

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f0fdf4' }}>

      {/* Fondo campo de fútbol (decorativo, muy sutil) */}
      <div
        className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
        style={{ opacity: 0.055 }}
      >
        <svg
          viewBox="0 0 360 640"
          xmlns="http://www.w3.org/2000/svg"
          style={{ position: 'absolute', width: '100%', height: '100%' }}
          preserveAspectRatio="xMidYMin slice"
        >
          <rect width="360" height="640" fill="#166534"/>
          {/* Borde del campo */}
          <rect x="16" y="32" width="328" height="576" fill="none" stroke="white" strokeWidth="3.5"/>
          {/* Línea central */}
          <line x1="16" y1="320" x2="344" y2="320" stroke="white" strokeWidth="3.5"/>
          {/* Círculo central */}
          <circle cx="180" cy="320" r="58" fill="none" stroke="white" strokeWidth="3.5"/>
          <circle cx="180" cy="320" r="4.5" fill="white"/>
          {/* Área chica arriba */}
          <rect x="115" y="32" width="130" height="38" fill="none" stroke="white" strokeWidth="2.5"/>
          {/* Área grande arriba */}
          <rect x="62" y="32" width="236" height="86" fill="none" stroke="white" strokeWidth="2.5"/>
          {/* Arco área arriba */}
          <path d="M 102 118 A 52 52 0 0 1 258 118" fill="none" stroke="white" strokeWidth="2.5"/>
          {/* Punto penal arriba */}
          <circle cx="180" cy="86" r="4" fill="white"/>
          {/* Área chica abajo */}
          <rect x="115" y="570" width="130" height="38" fill="none" stroke="white" strokeWidth="2.5"/>
          {/* Área grande abajo */}
          <rect x="62" y="522" width="236" height="86" fill="none" stroke="white" strokeWidth="2.5"/>
          {/* Arco área abajo */}
          <path d="M 102 522 A 52 52 0 0 0 258 522" fill="none" stroke="white" strokeWidth="2.5"/>
          {/* Punto penal abajo */}
          <circle cx="180" cy="554" r="4" fill="white"/>
          {/* Corners */}
          <path d="M 16 32 A 10 10 0 0 1 26 42" fill="none" stroke="white" strokeWidth="2"/>
          <path d="M 344 32 A 10 10 0 0 0 334 42" fill="none" stroke="white" strokeWidth="2"/>
          <path d="M 16 608 A 10 10 0 0 0 26 598" fill="none" stroke="white" strokeWidth="2"/>
          <path d="M 344 608 A 10 10 0 0 1 334 598" fill="none" stroke="white" strokeWidth="2"/>
        </svg>
      </div>

      {/* Header superior */}
      <AppHeader equipoActivo={equipo} equipos={equipos} />

      <main className="flex-1 pb-20 relative z-10">
        {children}
      </main>

      <NavBar />
    </div>
  )
}
