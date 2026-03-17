-- ============================================================
--  MIGRACION v2 
-- ============================================================

-- ── EXPEDIENTES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expedientes (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    estudiante_id   UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    psicologo_id    UUID        NOT NULL REFERENCES psicologos(id) ON DELETE CASCADE,
    titulo          VARCHAR(200) NOT NULL DEFAULT 'Expediente clinico',
    resumen         TEXT,
    diagnostico     TEXT,
    objetivos       TEXT,
    observaciones   TEXT,
    activo          BOOLEAN     NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (estudiante_id, psicologo_id)
);

CREATE TRIGGER trg_expedientes_updated
    BEFORE UPDATE ON expedientes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── ARCHIVOS DEL EXPEDIENTE ────────────────────────────────
CREATE TABLE IF NOT EXISTS archivos_expediente (
    id              SERIAL      PRIMARY KEY,
    expediente_id   UUID        NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
    nombre_original VARCHAR(255) NOT NULL,
    nombre_guardado VARCHAR(255) NOT NULL,
    tipo_mime       VARCHAR(100),
    tamano_bytes    INT,
    descripcion     TEXT,
    subido_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── NOTAS DE SESION (por cita) ─────────────────────────────
CREATE TABLE IF NOT EXISTS notas_sesion (
    id              SERIAL      PRIMARY KEY,
    cita_id         UUID        NOT NULL REFERENCES citas(id) ON DELETE CASCADE UNIQUE,
    expediente_id   UUID        REFERENCES expedientes(id) ON DELETE SET NULL,
    contenido       TEXT        NOT NULL,
    humor_paciente  VARCHAR(50),
    avance          VARCHAR(50) CHECK (avance IN ('sin_cambio','leve','moderado','significativo')),
    proximos_pasos  TEXT,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_notas_sesion_updated
    BEFORE UPDATE ON notas_sesion
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── TAREAS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tareas (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    estudiante_id   UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    psicologo_id    UUID        NOT NULL REFERENCES psicologos(id) ON DELETE CASCADE,
    expediente_id   UUID        REFERENCES expedientes(id) ON DELETE SET NULL,
    titulo          VARCHAR(200) NOT NULL,
    descripcion     TEXT        NOT NULL,
    instrucciones   TEXT,
    fecha_limite    DATE,
    estado          VARCHAR(30) NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente','en_proceso','completada','revisada')),
    respuesta_alumno TEXT,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_tareas_updated
    BEFORE UPDATE ON tareas
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RETROALIMENTACION ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS retroalimentacion (
    id              SERIAL      PRIMARY KEY,
    tarea_id        UUID        REFERENCES tareas(id) ON DELETE CASCADE,
    estudiante_id   UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    psicologo_id    UUID        NOT NULL REFERENCES psicologos(id) ON DELETE CASCADE,
    titulo          VARCHAR(200),
    contenido       TEXT        NOT NULL,
    tipo            VARCHAR(30) NOT NULL DEFAULT 'general'
                        CHECK (tipo IN ('general','tarea','sesion','progreso')),
    leida           BOOLEAN     NOT NULL DEFAULT FALSE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INDICES ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_expedientes_estudiante ON expedientes(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_expedientes_psicologo  ON expedientes(psicologo_id);
CREATE INDEX IF NOT EXISTS idx_tareas_estudiante      ON tareas(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_tareas_estado          ON tareas(estado);
CREATE INDEX IF NOT EXISTS idx_retro_estudiante       ON retroalimentacion(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_notas_cita             ON notas_sesion(cita_id);
