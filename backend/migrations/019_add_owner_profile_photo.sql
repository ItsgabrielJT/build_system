-- ============================================================
-- Migración 019: Agregar foto de perfil a propietarios (owners)
-- ============================================================

ALTER TABLE owners
ADD COLUMN IF NOT EXISTS photo_file_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS photo_content_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS photo_storage_path VARCHAR(500);
