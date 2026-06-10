// ============================================================
// TIPOS PRINCIPALES — FutbolPF
// Basados en el esquema definido en Concepto_v05.md
// ============================================================

export type EstadoJugador = 'activo' | 'lesionado' | 'suspendido' | 'baja'

export type Posicion =
  | 'portero'
  | 'defensa_central'
  | 'lateral'
  | 'mediocentro_defensivo'
  | 'mediocentro'
  | 'extremo'
  | 'delantero'

export type FaseTipo = 'pretemporada' | 'temporada' | 'copa' | 'amistoso'

export type SesionTipo = 'entrenamiento' | 'partido'

export type TipoEjercicioPF =
  | 'fuerza_tren_inferior'
  | 'fuerza_tren_superior'
  | 'core'
  | 'resistencia_aerobica'
  | 'resistencia_anaerobica'
  | 'velocidad'
  | 'potencia'
  | 'recuperacion'
  | 'flexibilidad'

export type TipoCargaDT =
  | 'tactico_caminado'
  | 'posesion_tranquila'
  | 'entrenamiento_futbol'
  | 'juego_reducido_extenso'
  | 'juego_reducido_intenso'
  | 'pressing_transiciones'

export type TipoLesion = 'muscular' | 'articular' | 'traumatica' | 'otra'

// ── Factores de carga por posición (modificables por el PF) ──────────────────
export const FACTOR_POSICION: Record<Posicion, number> = {
  portero: 0.65,
  defensa_central: 0.85,
  lateral: 1.05,
  mediocentro_defensivo: 1.0,
  mediocentro: 1.0,
  extremo: 1.15,
  delantero: 0.90,
}

// Intensidad base del trabajo del DT (1-5)
export const INTENSIDAD_DT: Record<TipoCargaDT, number> = {
  tactico_caminado:       1,
  posesion_tranquila:     2,
  entrenamiento_futbol:   3,
  juego_reducido_extenso: 3,
  juego_reducido_intenso: 4,
  pressing_transiciones:  5,
}

// ── Entidades de base de datos ───────────────────────────────────────────────

export interface Equipo {
  id: string
  nombre: string
  temporada_activa: string
  user_id: string
  created_at: string
}

export interface Jugador {
  id: string
  equipo_id: string
  nombre: string
  numero: number | null
  posicion: Posicion
  fecha_nacimiento: string | null
  estado: EstadoJugador
  factor_posicion: number
  created_at: string
}

export interface Fase {
  id: string
  equipo_id: string
  nombre: string
  tipo: FaseTipo
  fecha_inicio: string
  fecha_fin: string
}

export interface Sesion {
  id: string
  equipo_id: string
  fase_id: string | null
  fecha: string
  tipo: SesionTipo
  // Solo entrenamiento
  tipos_ejercicio: TipoEjercicioPF[] | null
  duracion_pf: number | null
  rpe_tipo: 'grupal' | 'subgrupo' | null
  // Solo partido
  rival: string | null
  rpe_partido: number | null
  // Carga DT (entrenamiento)
  tipo_dt: TipoCargaDT | null
  duracion_dt: number | null
  intensidad_dt: number | null
  created_at: string
}

export interface RegistroJugadorSesion {
  id: string
  sesion_id: string
  jugador_id: string
  presente: boolean
  rpe: number | null
  minutos_jugados: number | null  // solo partidos
  carga_pf: number | null
  carga_dt: number | null
  carga_total: number | null
}

export interface Lesion {
  id: string
  jugador_id: string
  tipo: TipoLesion
  fecha_inicio: string
  fecha_retorno_estimada: string | null
  activa: boolean
  notas: string | null
}

// ── Tipos calculados (no son tablas, son derivados) ──────────────────────────

export interface CargaSemanal {
  semana: string   // ISO week, e.g. "2026-W23"
  carga_total: number
  sesiones: number
}

export interface RatioAC {
  carga_aguda: number   // semana actual
  carga_cronica: number // promedio 4 semanas
  ratio: number
  zona: 'subestimulacion' | 'segura' | 'precaucion' | 'riesgo'
}

export interface GrupoPartido {
  grupo_a: Jugador[]  // jugaron >75% de los minutos
  grupo_b: Jugador[]  // jugaron <75% o no jugaron
  minutos_totales: number
}
