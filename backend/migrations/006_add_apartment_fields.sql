-- ============================================================
-- Migración 006: Agregar campos de área y alícuota a Apartments
-- Ejecutar sobre la base de datos "edificios"
-- ============================================================

-- ─── 1. AGREGAR COLUMNAS A APARTMENTS ──────────────────────────────

ALTER TABLE apartments
ADD COLUMN IF NOT EXISTS area_sqm DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS allocated_quota_percent DECIMAL(5, 2) DEFAULT 2.145;

-- ─── 2. CREAR ÍNDICES PARA OPTIMIZACIÓN ──────────────────────────

CREATE INDEX IF NOT EXISTS idx_apartments_status ON apartments(status);
CREATE INDEX IF NOT EXISTS idx_apartments_owner_id ON apartments(owner_id);
CREATE INDEX IF NOT EXISTS idx_apartments_building_id ON apartments(building_id);
CREATE INDEX IF NOT EXISTS idx_owners_email ON owners(email);
CREATE INDEX IF NOT EXISTS idx_owners_phone ON owners(phone);
CREATE INDEX IF NOT EXISTS idx_owners_status ON owners(status);

-- ─── 3. VALIDACIÓN (comentado, solo para referencia) ──────────────

-- Verificar que los índices se crearon correctamente:
-- SELECT indexname FROM pg_indexes WHERE tablename = 'apartments' OR tablename = 'owners';
