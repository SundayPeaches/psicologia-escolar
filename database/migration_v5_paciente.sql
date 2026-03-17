-- ============================================================
--  MIGRACION v5 - Funciones para paciente
-- ============================================================

-- Diario de bienestar
CREATE TABLE IF NOT EXISTS diario_bienestar (
  id           SERIAL      PRIMARY KEY,
  usuario_id   UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha        DATE        NOT NULL DEFAULT CURRENT_DATE,
  estado_animo SMALLINT    NOT NULL CHECK (estado_animo BETWEEN 1 AND 10),
  emociones    TEXT[],
  nota         TEXT,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(usuario_id, fecha)
);

-- Recursos / biblioteca
CREATE TABLE IF NOT EXISTS recursos (
  id            SERIAL      PRIMARY KEY,
  psicologo_id  UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo        VARCHAR(200) NOT NULL,
  descripcion   TEXT,
  tipo          VARCHAR(30) NOT NULL DEFAULT 'articulo'
                  CHECK (tipo IN ('articulo','audio','video','ejercicio','documento','enlace')),
  url           TEXT,
  contenido     TEXT,
  publico       BOOLEAN     NOT NULL DEFAULT FALSE,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asignación de recursos a pacientes
CREATE TABLE IF NOT EXISTS recursos_asignados (
  id           SERIAL      PRIMARY KEY,
  recurso_id   INT         NOT NULL REFERENCES recursos(id) ON DELETE CASCADE,
  estudiante_id UUID       NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  psicologo_id  UUID       NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  visto        BOOLEAN     NOT NULL DEFAULT FALSE,
  visto_en     TIMESTAMPTZ,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(recurso_id, estudiante_id)
);

-- Encuestas post-sesión
CREATE TABLE IF NOT EXISTS encuestas_sesion (
  id              SERIAL      PRIMARY KEY,
  cita_id         UUID        NOT NULL REFERENCES citas(id) ON DELETE CASCADE,
  estudiante_id   UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  utilidad        SMALLINT    CHECK (utilidad BETWEEN 1 AND 5),
  bienestar_antes SMALLINT    CHECK (bienestar_antes BETWEEN 1 AND 10),
  bienestar_despues SMALLINT  CHECK (bienestar_despues BETWEEN 1 AND 10),
  comentario      TEXT,
  respondida      BOOLEAN     NOT NULL DEFAULT FALSE,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cita_id)
);

-- ── Cuadernos personales del paciente ───────────────────────
CREATE TABLE IF NOT EXISTS cuadernos (
  id          SERIAL       PRIMARY KEY,
  usuario_id  UUID         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre      VARCHAR(80)  NOT NULL DEFAULT 'Mi diario',
  icono       VARCHAR(10)  NOT NULL DEFAULT '📓',
  color       VARCHAR(20)  NOT NULL DEFAULT 'sage',
  papel       VARCHAR(20)  NOT NULL DEFAULT 'lined',
  es_principal BOOLEAN     NOT NULL DEFAULT FALSE,
  creado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  orden       SMALLINT     NOT NULL DEFAULT 0
);

-- Solo puede haber un cuaderno principal por usuario
CREATE UNIQUE INDEX IF NOT EXISTS cuadernos_principal_uq
  ON cuadernos (usuario_id) WHERE es_principal = TRUE;

-- Entradas de cuadernos personales (libre, no clínico)
CREATE TABLE IF NOT EXISTS cuaderno_entradas (
  id           SERIAL      PRIMARY KEY,
  cuaderno_id  INT         NOT NULL REFERENCES cuadernos(id) ON DELETE CASCADE,
  usuario_id   UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha        DATE        NOT NULL DEFAULT CURRENT_DATE,
  titulo       VARCHAR(200),
  contenido    TEXT,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
