-- ============================================================
--  MIGRACION v4 
-- ============================================================

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS foto_url     TEXT,
  ADD COLUMN IF NOT EXISTS color_perfil VARCHAR(30) DEFAULT 'sage',
  ADD COLUMN IF NOT EXISTS emoji_perfil VARCHAR(10) DEFAULT '✨',
  ADD COLUMN IF NOT EXISTS bio_personal TEXT;
