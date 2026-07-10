-- ============================================================
-- Migración 015: Agregar columnas de perfil detallado a owners y apartments,
-- y configurar datos de demostración de "Juan Francisco Cuaical"
-- ============================================================

-- 1. AGREGAR COLUMNAS A LA TABLA OWNERS
ALTER TABLE owners
ADD COLUMN IF NOT EXISTS birth_date DATE DEFAULT '1985-04-15',
ADD COLUMN IF NOT EXISTS occupant_name VARCHAR(255) DEFAULT 'María Fernanda Cuaical',
ADD COLUMN IF NOT EXISTS occupant_relation VARCHAR(100) DEFAULT 'Cónyuge',
ADD COLUMN IF NOT EXISTS occupant_phone VARCHAR(20) DEFAULT '+593 98 765 4321',
ADD COLUMN IF NOT EXISTS occupant_inhabitants INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS emergency_name VARCHAR(255) DEFAULT 'Carlos Cuaical',
ADD COLUMN IF NOT EXISTS emergency_relation VARCHAR(100) DEFAULT 'Hermano',
ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(20) DEFAULT '+593 97 123 4567',
ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS last_update_date TIMESTAMPTZ DEFAULT NOW();

-- 2. AGREGAR COLUMNAS A LA TABLA APARTMENTS (INCLUYENDO AREA Y ALICUOTA SI NO EXISTIERAN)
ALTER TABLE apartments
ADD COLUMN IF NOT EXISTS area_sqm DECIMAL(10, 2) DEFAULT 120.50,
ADD COLUMN IF NOT EXISTS allocated_quota_percent DECIMAL(5, 2) DEFAULT 2.45,
ADD COLUMN IF NOT EXISTS bedrooms INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS bathrooms NUMERIC(3, 1) DEFAULT 2.5,
ADD COLUMN IF NOT EXISTS parking VARCHAR(50) DEFAULT '1 (P-28)',
ADD COLUMN IF NOT EXISTS storage VARCHAR(50) DEFAULT 'B-12',
ADD COLUMN IF NOT EXISTS acquisition_date DATE DEFAULT '2022-06-15',
ADD COLUMN IF NOT EXISTS use_type VARCHAR(100) DEFAULT 'Residencial';

-- 3. ACTUALIZAR CONFIGURACIÓN DE EDIFICIO Y NOMBRE
UPDATE settings
SET building_name = 'Edificio Torres Netanya'
WHERE TRUE;

UPDATE buildings
SET name = 'Edificio Torres Netanya'
WHERE TRUE;

-- 4. ACTUALIZAR PROPIETARIO MARÍA TORRES A JUAN FRANCISCO CUAICAL
-- Vincular al usuario owner@edificios.local (firebase_uid = '550e8400-e29b-41d4-a716-446655440020')
UPDATE owners
SET full_name = 'Juan Francisco Cuaical',
    document_id = '1712345678',
    phone = '+593 99 295 3596',
    email = 'juan.cuaical@example.com',
    firebase_uid = '550e8400-e29b-41d4-a716-446655440020',
    birth_date = '1985-04-15',
    occupant_name = 'María Fernanda Cuaical',
    occupant_relation = 'Cónyuge',
    occupant_phone = '+593 98 765 4321',
    occupant_inhabitants = 3,
    emergency_name = 'Carlos Cuaical',
    emergency_relation = 'Hermano',
    emergency_phone = '+593 97 123 4567',
    notifications_enabled = TRUE,
    last_update_date = NOW()
WHERE full_name = 'María Torres' OR email = 'maria.torres@mail.com';

-- 5. ACTUALIZAR APARTAMENTO 202 A DEP 2B CON VALORES DE DEMOSTRACIÓN
UPDATE apartments
SET code = 'DEP 2B',
    tower = 'B',
    floor = 2,
    area_sqm = 120.50,
    allocated_quota_percent = 2.45,
    bedrooms = 3,
    bathrooms = 2.5,
    parking = '1 (P-28)',
    storage = 'B-12',
    acquisition_date = '2022-06-15',
    use_type = 'Departamento residencial'
WHERE code = '202';

-- 6. ACTUALIZAR CORREO DEL USUARIO PROPIETARIO A juan.cuaical@example.com
UPDATE users
SET email = 'juan.cuaical@example.com'
WHERE id = '550e8400-e29b-41d4-a716-446655440020';
