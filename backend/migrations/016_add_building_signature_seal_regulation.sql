-- =====================================================================
-- Migracion 016: agregar firma, sello y reglamento a la configuracion
-- =====================================================================

ALTER TABLE buildings
ADD COLUMN IF NOT EXISTS signature_file_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS signature_content_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS signature_storage_path VARCHAR(500),
ADD COLUMN IF NOT EXISTS seal_file_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS seal_content_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS seal_storage_path VARCHAR(500),
ADD COLUMN IF NOT EXISTS regulation_file_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS regulation_content_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS regulation_storage_path VARCHAR(500);
