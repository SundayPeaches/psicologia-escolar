-- Migration v6: imágenes en entradas de cuadernos personales
ALTER TABLE cuaderno_entradas
  ADD COLUMN IF NOT EXISTS imagenes JSONB NOT NULL DEFAULT '[]';
