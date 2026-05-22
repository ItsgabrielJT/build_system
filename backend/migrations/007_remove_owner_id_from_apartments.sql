-- ============================================================
-- Migración 007: Eliminar columna owner_id de apartments
-- La asignación de propietarios se gestiona exclusivamente
-- a través de la tabla owner_apartments (muchos a muchos).
-- ============================================================

-- ─── 1. SINCRONIZAR DATOS HISTÓRICOS ───────────────────────
-- Migrar cualquier owner_id existente en apartments a owner_apartments
-- para no perder asignaciones ya registradas

INSERT INTO owner_apartments (apartment_id, owner_id, is_primary, assigned_at)
SELECT
    a.id          AS apartment_id,
    a.owner_id    AS owner_id,
    TRUE          AS is_primary,
    NOW()         AS assigned_at
FROM apartments a
WHERE a.owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM owner_apartments oa
    WHERE oa.apartment_id = a.id AND oa.owner_id = a.owner_id
  );

-- ─── 2. ELIMINAR ÍNDICE ────────────────────────────────────

DROP INDEX IF EXISTS idx_apartments_owner_id;

-- ─── 3. ELIMINAR COLUMNA ───────────────────────────────────

ALTER TABLE apartments DROP COLUMN IF EXISTS owner_id;
