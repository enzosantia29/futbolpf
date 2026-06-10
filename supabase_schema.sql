-- ============================================================
-- FUTBOLPF — Schema de base de datos
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- Habilitar UUID
create extension if not exists "uuid-ossp";

-- ── EQUIPOS ──────────────────────────────────────────────────────────────────
create table equipos (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  nombre        text not null,
  temporada_activa text not null default '2026',
  nombre_pf     text,
  logo_url      text,
  created_at    timestamptz default now()
);

-- ── JUGADORES ─────────────────────────────────────────────────────────────────
create table jugadores (
  id                uuid primary key default uuid_generate_v4(),
  equipo_id         uuid references equipos(id) on delete cascade not null,
  nombre            text not null,
  numero            integer,
  posicion          text not null check (posicion in (
                      'portero','defensa_central','lateral',
                      'mediocentro_defensivo','mediocentro',
                      'extremo','delantero'
                    )),
  fecha_nacimiento  date,
  estado            text not null default 'activo' check (estado in (
                      'activo','lesionado','suspendido','baja'
                    )),
  factor_posicion          numeric(4,2) not null default 1.0,
  ultimo_reset_tarjetas    date,
  created_at               timestamptz default now()
);

-- ── FASES ─────────────────────────────────────────────────────────────────────
create table fases (
  id           uuid primary key default uuid_generate_v4(),
  equipo_id    uuid references equipos(id) on delete cascade not null,
  nombre       text not null,
  tipo         text not null check (tipo in (
                 'pretemporada','temporada','copa','amistoso'
               )),
  fecha_inicio date not null,
  fecha_fin    date not null,
  created_at   timestamptz default now()
);

-- ── SESIONES ──────────────────────────────────────────────────────────────────
create table sesiones (
  id              uuid primary key default uuid_generate_v4(),
  equipo_id       uuid references equipos(id) on delete cascade not null,
  fase_id         uuid references fases(id) on delete set null,
  fecha           date not null,
  tipo            text not null check (tipo in ('entrenamiento','partido')),

  -- Entrenamiento: trabajo del PF
  tipos_ejercicio text[],           -- array de TipoEjercicioPF
  duracion_pf     integer,          -- minutos
  rpe_tipo        text check (rpe_tipo in ('grupal','subgrupo')),

  -- Entrenamiento: trabajo del DT
  tipo_dt         text check (tipo_dt in (
                    'tactico_caminado','posesion_tranquila',
                    'entrenamiento_futbol',
                    'juego_reducido_extenso','juego_reducido_intenso',
                    'pressing_transiciones'
                  )),
  duracion_dt     integer,          -- minutos
  intensidad_dt   integer check (intensidad_dt between 1 and 5),

  -- Partido
  rival           text,
  rpe_partido     numeric(3,1) default 8.0,

  created_at      timestamptz default now()
);

-- ── REGISTROS JUGADOR × SESIÓN ────────────────────────────────────────────────
create table registros (
  id              uuid primary key default uuid_generate_v4(),
  sesion_id       uuid references sesiones(id) on delete cascade not null,
  jugador_id      uuid references jugadores(id) on delete cascade not null,
  presente        boolean not null default true,
  rpe             numeric(3,1),
  minutos_jugados integer,           -- solo partidos
  carga_pf        numeric(8,2),
  carga_dt        numeric(8,2),
  carga_total     numeric(8,2),
  tarjeta_amarilla boolean not null default false,
  tarjeta_roja     boolean not null default false,
  unique(sesion_id, jugador_id)
);

-- ── LESIONES ──────────────────────────────────────────────────────────────────
create table lesiones (
  id                      uuid primary key default uuid_generate_v4(),
  jugador_id              uuid references jugadores(id) on delete cascade not null,
  tipo                    text not null check (tipo in (
                            'muscular','articular','traumatica','otra'
                          )),
  fecha_inicio            date not null,
  fecha_retorno_estimada  date,
  activa                  boolean not null default true,
  notas                   text,
  created_at              timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Cada PF solo ve sus propios datos
-- ============================================================

alter table equipos        enable row level security;
alter table jugadores      enable row level security;
alter table fases          enable row level security;
alter table sesiones       enable row level security;
alter table registros      enable row level security;
alter table lesiones       enable row level security;

-- Equipos: solo el dueño
create policy "dueño ve sus equipos"
  on equipos for all
  using (auth.uid() = user_id);

-- Jugadores: acceso a través del equipo
create policy "dueño ve sus jugadores"
  on jugadores for all
  using (
    equipo_id in (select id from equipos where user_id = auth.uid())
  );

-- Fases
create policy "dueño ve sus fases"
  on fases for all
  using (
    equipo_id in (select id from equipos where user_id = auth.uid())
  );

-- Sesiones
create policy "dueño ve sus sesiones"
  on sesiones for all
  using (
    equipo_id in (select id from equipos where user_id = auth.uid())
  );

-- Registros
create policy "dueño ve sus registros"
  on registros for all
  using (
    sesion_id in (
      select id from sesiones
      where equipo_id in (select id from equipos where user_id = auth.uid())
    )
  );

-- Lesiones
create policy "dueño ve sus lesiones"
  on lesiones for all
  using (
    jugador_id in (
      select id from jugadores
      where equipo_id in (select id from equipos where user_id = auth.uid())
    )
  );

-- ============================================================
-- ÍNDICES para consultas frecuentes
-- ============================================================

create index idx_jugadores_equipo     on jugadores(equipo_id);
create index idx_jugadores_estado     on jugadores(equipo_id, estado);
create index idx_sesiones_equipo_fecha on sesiones(equipo_id, fecha desc);
create index idx_registros_jugador    on registros(jugador_id);
create index idx_registros_sesion     on registros(sesion_id);
create index idx_lesiones_jugador     on lesiones(jugador_id, activa);
