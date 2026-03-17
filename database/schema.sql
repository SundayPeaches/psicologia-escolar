-- ============================================================
--  SISTEMA DE RESERVACION DE CITAS - PSICOLOGIA ESCOLAR
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ROLES
CREATE TABLE roles (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT
);
INSERT INTO roles (nombre, descripcion) VALUES
  ('estudiante','Alumno que puede solicitar citas'),
  ('psicologo','Profesional que atiende citas'),
  ('admin','Administrador del sistema');

-- FACULTADES
CREATE TABLE facultades (
    id     SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    codigo VARCHAR(20)  NOT NULL UNIQUE
);
INSERT INTO facultades (nombre, codigo) VALUES
  ('Ciencias e Ingenieria','CI'),
  ('Humanidades y Ciencias Sociales','HCS'),
  ('Ciencias Economicas','CE'),
  ('Salud','SAL'),
  ('Artes y Diseno','AD');

-- USUARIOS
CREATE TABLE usuarios (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre         VARCHAR(100) NOT NULL,
    apellido       VARCHAR(100) NOT NULL,
    email          VARCHAR(200) NOT NULL UNIQUE,
    password_hash  TEXT         NOT NULL,
    telefono       VARCHAR(20),
    matricula      VARCHAR(30),
    rol_id         INT          NOT NULL REFERENCES roles(id),
    facultad_id    INT          REFERENCES facultades(id),
    activo         BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- PSICOLOGOS
CREATE TABLE psicologos (
    id             UUID        PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    cedula_prof    VARCHAR(50) NOT NULL,
    especialidades TEXT[],
    bio            TEXT,
    foto_url       TEXT,
    max_citas_dia  INT         NOT NULL DEFAULT 8
);

-- HORARIOS DISPONIBLES
CREATE TABLE horarios_disponibles (
    id            SERIAL   PRIMARY KEY,
    psicologo_id  UUID     NOT NULL REFERENCES psicologos(id) ON DELETE CASCADE,
    dia_semana    SMALLINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
    hora_inicio   TIME     NOT NULL,
    hora_fin      TIME     NOT NULL,
    duracion_min  INT      NOT NULL DEFAULT 50,
    activo        BOOLEAN  NOT NULL DEFAULT TRUE,
    CONSTRAINT horario_valido CHECK (hora_fin > hora_inicio)
);

-- BLOQUEOS AGENDA
CREATE TABLE bloqueos_agenda (
    id            SERIAL      PRIMARY KEY,
    psicologo_id  UUID        NOT NULL REFERENCES psicologos(id) ON DELETE CASCADE,
    fecha_inicio  TIMESTAMPTZ NOT NULL,
    fecha_fin     TIMESTAMPTZ NOT NULL,
    motivo        TEXT,
    CONSTRAINT bloqueo_valido CHECK (fecha_fin > fecha_inicio)
);

-- MOTIVOS CONSULTA
CREATE TABLE motivos_consulta (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo      BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO motivos_consulta (nombre) VALUES
  ('Ansiedad y estres academico'),
  ('Depresion y estado de animo'),
  ('Dificultades de aprendizaje'),
  ('Problemas de relaciones interpersonales'),
  ('Orientacion vocacional'),
  ('Manejo del tiempo y habitos de estudio'),
  ('Crisis emocional'),
  ('Otro');

-- CITAS
CREATE TYPE estado_cita AS ENUM (
    'pendiente','confirmada','en_curso','completada',
    'cancelada_estudiante','cancelada_psicologo','no_presentado'
);

CREATE TABLE citas (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    estudiante_id      UUID        NOT NULL REFERENCES usuarios(id),
    psicologo_id       UUID        NOT NULL REFERENCES psicologos(id),
    motivo_id          INT         REFERENCES motivos_consulta(id),
    fecha_hora_inicio  TIMESTAMPTZ NOT NULL,
    fecha_hora_fin     TIMESTAMPTZ NOT NULL,
    modalidad          VARCHAR(20) NOT NULL DEFAULT 'presencial'
                           CHECK (modalidad IN ('presencial','virtual')),
    estado             estado_cita NOT NULL DEFAULT 'pendiente',
    notas_estudiante   TEXT,
    notas_psicologo    TEXT,
    url_videollamada   TEXT,
    cancelacion_motivo TEXT,
    creado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cita_valida CHECK (fecha_hora_fin > fecha_hora_inicio)
);

-- NOTIFICACIONES
CREATE TABLE notificaciones (
    id         SERIAL      PRIMARY KEY,
    usuario_id UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    cita_id    UUID        REFERENCES citas(id) ON DELETE SET NULL,
    tipo       VARCHAR(50) NOT NULL,
    mensaje    TEXT        NOT NULL,
    leida      BOOLEAN     NOT NULL DEFAULT FALSE,
    creada_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SESIONES TOKEN
CREATE TABLE sesiones_token (
    id         SERIAL      PRIMARY KEY,
    usuario_id UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash TEXT        NOT NULL UNIQUE,
    expira_en  TIMESTAMPTZ NOT NULL,
    creada_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDICES
CREATE INDEX idx_citas_estudiante   ON citas(estudiante_id);
CREATE INDEX idx_citas_psicologo    ON citas(psicologo_id);
CREATE INDEX idx_citas_fecha        ON citas(fecha_hora_inicio);
CREATE INDEX idx_citas_estado       ON citas(estado);
CREATE INDEX idx_notif_usuario      ON notificaciones(usuario_id, leida);
CREATE INDEX idx_horarios_psicologo ON horarios_disponibles(psicologo_id);

-- TRIGGER updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.actualizado_en = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usuarios_updated
    BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_citas_updated
    BEFORE UPDATE ON citas FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- VISTA COMPLETA
CREATE OR REPLACE VIEW v_citas_completas AS
SELECT
    c.id, c.fecha_hora_inicio, c.fecha_hora_fin, c.modalidad, c.estado,
    c.notas_estudiante, c.url_videollamada, c.creado_en,
    u_est.nombre||' '||u_est.apellido AS estudiante_nombre,
    u_est.email AS estudiante_email, u_est.matricula,
    f.nombre AS facultad,
    u_psi.nombre||' '||u_psi.apellido AS psicologo_nombre,
    u_psi.email AS psicologo_email,
    m.nombre AS motivo
FROM citas c
JOIN usuarios u_est ON u_est.id = c.estudiante_id
JOIN usuarios u_psi ON u_psi.id = c.psicologo_id
LEFT JOIN facultades f ON f.id = u_est.facultad_id
LEFT JOIN motivos_consulta m ON m.id = c.motivo_id;
