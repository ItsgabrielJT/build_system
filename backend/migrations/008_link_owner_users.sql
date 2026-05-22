-- ============================================================
-- Migración: Vincular usuario owner@edificios.local a registro owners
-- Ejecutar DESPUÉS de 004_seed_users.sql y seed.py
-- ============================================================

-- El usuario de prueba owner@edificios.local (ID: 550e8400-e29b-41d4-a716-446655440020)
-- necesita estar vinculado a un registro de owners mediante firebase_uid
-- para que el rol PROPIETARIO pueda acceder a sus apartamentos y estado de cuenta.

UPDATE owners
SET firebase_uid = '550e8400-e29b-41d4-a716-446655440020'
WHERE id = (
    SELECT o.id
    FROM owners o
    LEFT JOIN owner_apartments oa ON oa.owner_id = o.id
    WHERE o.firebase_uid IS NULL
    GROUP BY o.id
    ORDER BY COUNT(oa.apartment_id) DESC
    LIMIT 1
);
