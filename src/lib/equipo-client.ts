// Funciones de equipo para usar en client components (sin imports de servidor)

export function getEquipoActivoCookieId(): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(/(?:^|;\s*)equipo_activo=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}
