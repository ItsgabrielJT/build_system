-- ============================================================
-- Migración 013: Agregar foto y logo configurables a edificios
-- ============================================================

ALTER TABLE buildings
ADD COLUMN IF NOT EXISTS photo_file_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS photo_content_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS photo_storage_path VARCHAR(500),
ADD COLUMN IF NOT EXISTS logo_file_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS logo_content_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS logo_storage_path VARCHAR(500);

