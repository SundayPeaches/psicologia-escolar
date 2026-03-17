-- ============================================================
--  MIGRACION v3
-- ============================================================

CREATE TABLE IF NOT EXISTS resultados_tests (
    id              SERIAL       PRIMARY KEY,
    expediente_id   UUID         NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
    psicologo_id    UUID         NOT NULL REFERENCES psicologos(id)  ON DELETE CASCADE,
    nombre_test     VARCHAR(200) NOT NULL,
    fecha_aplicacion DATE        NOT NULL DEFAULT CURRENT_DATE,
    puntuacion_raw  VARCHAR(100),
    puntuacion_std  VARCHAR(100),
    percentil       VARCHAR(50),
    interpretacion  TEXT,
    observaciones   TEXT,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resultados_expediente ON resultados_tests(expediente_id);
