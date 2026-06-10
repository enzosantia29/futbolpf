'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/dashboard',  label: 'Inicio',   icon: '🏠' },
  { href: '/plantel',    label: 'Plantel',  icon: '👥' },
  { href: '/sesion',     label: 'Sesiones', icon: '📋' },
  { href: '/alertas',    label: 'Alertas',  icon: '⚠️' },
  { href: '/reportes',   label: 'Reportes', icon: '📊' },
]

export default function NavBar() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex items-center justify-around max-w-lg mx-auto px-2">
        {nav.map(item => {
          const active =
            item.href === '/dashboard'
              ? pathname === '/dashboard' || pathname === '/clubs' || pathname.startsWith('/dashboard/')
              : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-3 px-4 text-xs transition-colors ${
                active ? 'text-green-600' : 'text-gray-400'
              }`}
            >
              <span className="text-xl mb-0.5">{item.icon}</span>
              <span className={active ? 'font-medium' : ''}>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
