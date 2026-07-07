-- ============================================================
-- Migración 005: Agregar Buildings y Owner a Apartments
-- Ejecutar sobre la base de datos "edificios"
-- ============================================================

-- ─── 1. CREAR TABLA BUILDINGS ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS buildings (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(255) NOT NULL,
    address      VARCHAR(255),
    phone        VARCHAR(20),
    email        VARCHAR(255),
    photo_file_name VARCHAR(255),
    photo_content_type VARCHAR(100),
    photo_storage_path VARCHAR(500),
    logo_file_name VARCHAR(255),
    logo_content_type VARCHAR(100),
    logo_storage_path VARCHAR(500),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE buildings
ADD COLUMN IF NOT EXISTS photo_file_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS photo_content_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS photo_storage_path VARCHAR(500),
ADD COLUMN IF NOT EXISTS logo_file_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS logo_content_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS logo_storage_path VARCHAR(500);

-- ─── 2. AGREGAR COLUMNAS A APARTMENTS ──────────────────────────────

ALTER TABLE apartments
ADD COLUMN IF NOT EXISTS building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS owner_id   UUID REFERENCES owners(id)    ON DELETE SET NULL;

-- ─── 3. CREAR ÍNDICES ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_apartments_building_id ON apartments(building_id);
CREATE INDEX IF NOT EXISTS idx_apartments_owner_id    ON apartments(owner_id);

-- ─── 4. INSERTAR BUILDING POR DEFECTO ──────────────────────────────
-- (si aún no existe ninguno)

INSERT INTO buildings (name, address, phone, email)
SELECT 
    'Edificio Principal',
    'Dirección por defecto',
    '+34 123 456 789',
    'info@edificio.local'
WHERE NOT EXISTS (SELECT 1 FROM buildings)
RETURNING id;

-- ─── 5. ASIGNAR BUILDING A TODOS LOS APARTMENTS ────────────────────
-- (los que no tengan building_id aún)

UPDATE apartments
SET building_id = (
    SELECT id FROM buildings 
    ORDER BY created_at ASC 
    LIMIT 1
)
WHERE building_id IS NULL;

-- ─── 6. DATOS DE PRUEBA: ASIGNAR PROPIETARIOS A DEPARTAMENTOS ───────

-- Obtener propietarios de prueba
-- owner@edificios.local → Propietario de depto 101
-- Se asigna el primer propietario activo a departamentos sin propietario

UPDATE apartments
SET owner_id = (
    SELECT id FROM owners
    WHERE status = 'ACTIVO'
    ORDER BY created_at ASC
    LIMIT 1
)
WHERE code IN ('101', '102', '103')
  AND owner_id IS NULL
  AND EXISTS (
    SELECT 1 FROM owners WHERE status = 'ACTIVO' LIMIT 1
  );

-- ============================================================
-- FIN MIGRACIÓN 005
-- ============================================================
