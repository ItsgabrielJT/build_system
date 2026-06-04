-- ============================================================
-- Migración: Agregar columna password_is_temp a la tabla users
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_is_temp BOOLEAN NOT NULL DEFAULT FALSE;
