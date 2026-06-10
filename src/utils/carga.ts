import { FACTOR_POSICION, INTENSIDAD_DT, type Posicion, type TipoCargaDT, type RatioAC, type CargaSemanal } from '@/types'

// ── Cálculos de carga ────────────────────────────────────────────────────────

export function calcularCargaPF(rpe: number, duracionMin: number): number {
  return rpe * duracionMin
}

export function calcularCargaDT(tipoDT: TipoCargaDT, duracionMin: number): number {
  return INTENSIDAD_DT[tipoDT] * duracionMin
}

export function calcularCargaPartido(
  rpePartido: number,
  minutosJugados: number,
  posicion: Posicion,
  factorCustom?: number
): number {
  const factor = factorCustom ?? FACTOR_POSICION[posicion]
  return rpePartido * minutosJugados * factor
}

// ── Ratio Agudo:Crónico ──────────────────────────────────────────────────────

export function calcularRatioAC(semanas: CargaSemanal[]): RatioAC {
  if (semanas.length === 0) {
    return { carga_aguda: 0, carga_cronica: 0, ratio: 0, zona: 'subestimulacion' }
  }

  // La semana más reciente es la carga aguda
  const cargaAguda = semanas[semanas.length - 1]?.carga_total ?? 0

  // Promedio de las últimas 4 semanas (o las disponibles) = carga crónica
  const ultimasCuatro = semanas.slice(-4)
  const cargaCronica =
    ultimasCuatro.reduce((acc, s) => acc + s.carga_total, 0) / ultimasCuatro.length

  const ratio = cargaCronica > 0 ? cargaAguda / cargaCronica : 0

  let zona: RatioAC['zona']
  if (ratio < 0.8) zona = 'subestimulacion'
  else if (ratio <= 1.3) zona = 'segura'
  else if (ratio <= 1.5) zona = 'precaucion'
  else zona = 'riesgo'

  return {
    carga_aguda: Math.round(cargaAguda),
    carga_cronica: Math.round(cargaCronica),
    ratio: Math.round(ratio * 100) / 100,
    zona,
  }
}

// ── Grupo A / Grupo B post-partido ──────────────────────────────────────────

export function clasificarGrupoPartido(
  minutosPorJugador: Record<string, number>,
  minutosTotales: number = 90
): { grupoA: string[]; grupoB: string[] } {
  const umbral = minutosTotales * 0.75

  const grupoA: string[] = []
  const grupoB: string[] = []

  for (const [jugadorId, minutos] of Object.entries(minutosPorJugador)) {
    if (minutos >= umbral) grupoA.push(jugadorId)
    else grupoB.push(jugadorId)
  }

  return { grupoA, grupoB }
}

// ── Etiquetas legibles ───────────────────────────────────────────────────────

export const LABEL_POSICION: Record<Posicion, string> = {
  portero: 'Portero',
  defensa_central: 'Defensa Central',
  lateral: 'Lateral / Carrilero',
  mediocentro_defensivo: 'Mediocentro Defensivo',
  mediocentro: 'Mediocentro',
  extremo: 'Extremo / Enganche',
  delantero: 'Delantero',
}

export const LABEL_TIPO_DT: Record<TipoCargaDT, string> = {
  tactico_caminado:       'Táctico caminado / Charla táctica',
  posesion_tranquila:     'Posesión tranquila (rondo, conservación)',
  entrenamiento_futbol:   'Entrenamiento de fútbol (técnico-táctico general)',
  juego_reducido_extenso: 'Juego reducido extenso (8v8 o más)',
  juego_reducido_intenso: 'Juego reducido intenso (4v4, 5v5)',
  pressing_transiciones:  'Pressing / Transiciones / Alta intensidad',
}

// Intensidad base de cada tipo DT (1–5) — usada para calcular carga DT
export const INTENSIDAD_LABEL_DT: Record<TipoCargaDT, string> = {
  tactico_caminado:       'Intensidad 1 — carga muy baja',
  posesion_tranquila:     'Intensidad 2 — carga baja',
  entrenamiento_futbol:   'Intensidad 3 — carga media',
  juego_reducido_extenso: 'Intensidad 3 — carga media',
  juego_reducido_intenso: 'Intensidad 4 — carga alta',
  pressing_transiciones:  'Intensidad 5 — carga muy alta',
}

export const COLOR_ZONA: Record<RatioAC['zona'], string> = {
  subestimulacion: 'text-blue-500',
  segura: 'text-green-500',
  precaucion: 'text-yellow-500',
  riesgo: 'text-red-500',
}

export const BG_ZONA: Record<RatioAC['zona'], string> = {
  subestimulacion: 'bg-blue-50 border-blue-200',
  segura: 'bg-green-50 border-green-200',
  precaucion: 'bg-yellow-50 border-yellow-200',
  riesgo: 'bg-red-50 border-red-200',
}
