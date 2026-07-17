-- ============================================================
-- Migración 020: Agregar documents_link a buildings
-- Ejecutar sobre la base de datos "edificios"
-- ============================================================

ALTER TABLE buildings
ADD COLUMN IF NOT EXISTS documents_link VARCHAR(500);

-- ============================================================
-- FIN MIGRACIÓN 020
-- ============================================================
