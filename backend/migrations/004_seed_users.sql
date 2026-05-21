-- ============================================================
-- Seeder: Usuarios iniciales (ADMIN y PROPIETARIO de prueba)
-- Ejecutar sobre la base de datos "edificios" DESPUÉS de 003_create_auth_tables.sql
-- ============================================================

-- Contraseña: AdminPassword123!
-- Hash generado con bcrypt 10 rounds
-- Usuario: admin@edificios.local / AdminPassword123!
INSERT INTO users (id, email, password, status) VALUES
    (
        '550e8400-e29b-41d4-a716-446655440010',
        'admin@edificios.local',
        '$2b$10$EGUhUokZaFUfT7GBDvVBMuH4WVtWIgCavoJmoXi402uBFsSAwzqx2',
        'ACTIVO'
    )
ON CONFLICT (email) DO NOTHING;

-- Asignar rol ADMIN
INSERT INTO user_roles (user_id, role_id)
SELECT 
    '550e8400-e29b-41d4-a716-446655440010',
    r.id
FROM roles r
WHERE r.name = 'ADMIN'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Contraseña: OwnerPassword123!
-- Usuario: owner@edificios.local / OwnerPassword123!
INSERT INTO users (id, email, password, status) VALUES
    (
        '550e8400-e29b-41d4-a716-446655440020',
        'owner@edificios.local',
        '$2b$10$a/gyMSVE4eT8suB530yv.OMbvcIQsyuhgYTi1jnG//dPuReQM7SVW',
        'ACTIVO'
    )
ON CONFLICT (email) DO NOTHING;

-- Asignar rol PROPIETARIO
INSERT INTO user_roles (user_id, role_id)
SELECT 
    '550e8400-e29b-41d4-a716-446655440020',
    r.id
FROM roles r
WHERE r.name = 'PROPIETARIO'
ON CONFLICT (user_id, role_id) DO NOTHING;
