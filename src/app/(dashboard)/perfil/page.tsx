'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { getEquipoActivoCookieId } from '@/lib/equipo-client'
import Image from 'next/image'

export default function PerfilPage() {
  const supabase = createClient()
  const router = useRouter()

  const [equipoId, setEquipoId] = useState('')
  const [equipos, setEquipos] = useState<{ id: string; nombre: string; temporada_activa: string }[]>([])
  const [nombrePF, setNombrePF] = useState('')
  const [nombreClub, setNombreClub] = useState('')
  const [temporada, setTemporada] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: eqs } = await supabase
        .from('equipos').select('*').eq('user_id', user.id).order('created_at').limit(2)
      if (!eqs?.length) return
      setEquipos(eqs)
      const cookieId = getEquipoActivoCookieId()
      const eq = cookieId ? eqs.find(e => e.id === cookieId) ?? eqs[0] : eqs[0]
      setEquipoId(eq.id)
      setNombrePF(eq.nombre_pf ?? '')
      setNombreClub(eq.nombre)
      setTemporada(eq.temporada_activa)
      setLogoUrl(eq.logo_url ?? null)
    }
    cargar()
  }, [])

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !equipoId) return
    if (!file.type.startsWith('image/')) { setError('Solo se aceptan imágenes (JPG, PNG, etc.).'); return }
    if (file.size > 2 * 1024 * 1024) { setError('El logo no puede pesar más de 2MB.'); return }

    setUploadingLogo(true)
    setError('')

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
    const path = `${equipoId}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      setError('Error al subir. Verificá que el bucket "logos" en Supabase Storage sea público.')
      setUploadingLogo(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
    // Agrega versión para limpiar caché del navegador
    const urlFinal = `${publicUrl}?v=${Date.now()}`

    await supabase.from('equipos').update({ logo_url: urlFinal }).eq('id', equipoId)
    setLogoUrl(urlFinal)
    setUploadingLogo(false)
    router.refresh()
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    if (!nombreClub.trim()) return
    setLoading(true)
    setError('')
    setGuardado(false)

    const { error: err } = await supabase.from('equipos').update({
      nombre: nombreClub.trim(),
      nombre_pf: nombrePF.trim() || null,
      temporada_activa: temporada.trim() || '2026',
    }).eq('id', equipoId)

    if (err) { setError('Error al guardar.'); setLoading(false); return }
    setGuardado(true)
    setLoading(false)
    router.refresh()
    setTimeout(() => setGuardado(false), 3000)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const iniciales = nombreClub
    ? nombreClub.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <div className="px-4 pt-6 pb-6 max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 text-xl">←</button>
        <h1 className="text-xl font-bold text-gray-900">Configuración</h1>
      </div>

      {/* Logo del club */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Logo del club</p>
        <div className="flex items-center gap-4">
          {/* Preview del logo */}
          <div className="w-20 h-20 rounded-full overflow-hidden bg-green-100 flex items-center justify-center flex-shrink-0 border-2 border-green-200 shadow-sm">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt="Logo del club"
                width={80}
                height={80}
                className="w-full h-full object-cover"
                unoptimized
              />
            ) : (
              <span className="text-2xl font-extrabold text-green-700 leading-none select-none">
                {iniciales}
              </span>
            )}
          </div>

          <div className="flex-1">
            <p className="text-sm text-gray-700 font-medium">
              {logoUrl ? 'Logo cargado' : 'Sin logo'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Aparece en el encabezado de la app. JPG o PNG, máx. 2MB.</p>
            <label className={`mt-2.5 inline-block ${uploadingLogo ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
              <span className={`text-sm px-4 py-2 rounded-xl font-medium transition-colors inline-block ${
                uploadingLogo
                  ? 'bg-gray-100 text-gray-400'
                  : 'bg-green-100 hover:bg-green-200 text-green-700'
              }`}>
                {uploadingLogo ? 'Subiendo...' : logoUrl ? 'Cambiar logo' : 'Subir logo'}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
                disabled={uploadingLogo}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Formulario datos del equipo */}
      <form onSubmit={handleGuardar} className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos del equipo</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del club</label>
            <input
              type="text"
              value={nombreClub}
              onChange={e => setNombreClub(e.target.value)}
              placeholder="Club Atlético Rivadavia"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Temporada activa</label>
            <input
              type="text"
              value={temporada}
              onChange={e => setTemporada(e.target.value)}
              placeholder="2026"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tu nombre <span className="text-gray-400 font-normal">(Preparador Físico)</span>
            </label>
            <input
              type="text"
              value={nombrePF}
              onChange={e => setNombrePF(e.target.value)}
              placeholder="Ej: Juan Manuel Pérez"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Aparece al pie de todos los reportes Excel exportados.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {guardado && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
            ✅ Cambios guardados correctamente.
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !nombreClub.trim()}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium py-3 rounded-xl text-sm transition-colors"
        >
          {loading ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>

      {/* Mis categorías */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Mis categorías</p>
        {equipos.map(eq => (
          <div key={eq.id} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
            <div>
              <p className="text-sm font-medium text-gray-900">{eq.nombre}</p>
              <p className="text-xs text-gray-400">Temporada {eq.temporada_activa}</p>
            </div>
            {eq.id === equipoId && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">activa</span>
            )}
          </div>
        ))}

        {equipos.length < 2 ? (
          <button
            type="button"
            onClick={() => router.push('/plantel/nuevo-equipo')}
            className="w-full mt-2 border border-dashed border-gray-300 text-gray-500 py-2.5 rounded-xl text-sm hover:border-green-400 hover:text-green-600 transition-colors"
          >
            + Agregar segunda categoría
          </button>
        ) : (
          <p className="text-xs text-gray-400 text-center py-1">Máximo 2 categorías por cuenta.</p>
        )}
      </div>

      {/* Cerrar sesión */}
      <button
        type="button"
        onClick={handleLogout}
        className="w-full border border-gray-300 text-gray-500 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors"
      >
        Cerrar sesión
      </button>
    </div>
  )
}
