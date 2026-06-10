import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FutbolPF',
  description: 'Seguimiento físico para preparadores físicos de fútbol',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FutbolPF',
  },
}

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50`}>
        {children}
      </body>
    </html>
  )
}
