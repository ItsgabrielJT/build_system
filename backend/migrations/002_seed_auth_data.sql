-- ============================================================
-- SEEDERS: Roles, Permisos y Usuarios Iniciales
-- Ejecutar DESPUÉS de migrations/002_create_auth_schema.sql
-- ============================================================

-- ── 1. INSERTAR ROLES ───────────────────────────────────
INSERT INTO roles (id, name, description) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'ADMIN', 'Administrador del sistema — acceso total'),
  ('550e8400-e29b-41d4-a716-446655440002', 'PROPIETARIO', 'Propietario de departamentos — acceso limitado')
ON CONFLICT (name) DO NOTHING;

-- ── 2. INSERTAR PERMISOS ────────────────────────────────
INSERT INTO permissions (id, name, resource, action, description) VALUES
  -- Owners (Propietarios)
  ('550e8400-e29b-41d4-a716-446655440101', 'owners:create', 'owners', 'create', 'Crear propietarios'),
  ('550e8400-e29b-41d4-a716-446655440102', 'owners:read', 'owners', 'read', 'Leer propietarios'),
  ('550e8400-e29b-41d4-a716-446655440103', 'owners:update', 'owners', 'update', 'Actualizar propietarios'),
  ('550e8400-e29b-41d4-a716-446655440104', 'owners:delete', 'owners', 'delete', 'Eliminar propietarios'),
  
  -- Apartments (Departamentos)
  ('550e8400-e29b-41d4-a716-446655440201', 'apartments:create', 'apartments', 'create', 'Crear apartamentos'),
  ('550e8400-e29b-41d4-a716-446655440202', 'apartments:read', 'apartments', 'read', 'Leer apartamentos'),
  ('550e8400-e29b-41d4-a716-446655440203', 'apartments:update', 'apartments', 'update', 'Actualizar apartamentos'),
  ('550e8400-e29b-41d4-a716-446655440204', 'apartments:delete', 'apartments', 'delete', 'Eliminar apartamentos'),
  
  -- Apartment Fees (Cuotas por período)
  ('550e8400-e29b-41d4-a716-446655440301', 'fees:create', 'apartment_fees', 'create', 'Crear cuotas'),
  ('550e8400-e29b-41d4-a716-446655440302', 'fees:read', 'apartment_fees', 'read', 'Leer cuotas'),
  ('550e8400-e29b-41d4-a716-446655440303', 'fees:update', 'apartment_fees', 'update', 'Actualizar cuotas'),
  ('550e8400-e29b-41d4-a716-446655440304', 'fees:delete', 'apartment_fees', 'delete', 'Eliminar cuotas'),
  
  -- Payments (Pagos)
  ('550e8400-e29b-41d4-a716-446655440401', 'payments:create', 'payments', 'create', 'Crear pagos'),
  ('550e8400-e29b-41d4-a716-446655440402', 'payments:read', 'payments', 'read', 'Leer pagos'),
  ('550e8400-e29b-41d4-a716-446655440403', 'payments:update', 'payments', 'update', 'Actualizar pagos'),
  ('550e8400-e29b-41d4-a716-446655440404', 'payments:delete', 'payments', 'delete', 'Eliminar pagos'),
  
  -- Fines (Multas)
  ('550e8400-e29b-41d4-a716-446655440501', 'fines:create', 'fines', 'create', 'Crear multas'),
  ('550e8400-e29b-41d4-a716-446655440502', 'fines:read', 'fines', 'read', 'Leer multas'),
  ('550e8400-e29b-41d4-a716-446655440503', 'fines:update', 'fines', 'update', 'Actualizar multas'),
  ('550e8400-e29b-41d4-a716-446655440504', 'fines:delete', 'fines', 'delete', 'Eliminar multas'),
  
  -- Expenses (Gastos)
  ('550e8400-e29b-41d4-a716-446655440601', 'expenses:create', 'expenses', 'create', 'Crear gastos'),
  ('550e8400-e29b-41d4-a716-446655440602', 'expenses:read', 'expenses', 'read', 'Leer gastos'),
  ('550e8400-e29b-41d4-a716-446655440603', 'expenses:update', 'expenses', 'update', 'Actualizar gastos'),
  ('550e8400-e29b-41d4-a716-446655440604', 'expenses:delete', 'expenses', 'delete', 'Eliminar gastos'),
  
  -- Delinquency (Morosidad)
  ('550e8400-e29b-41d4-a716-446655440701', 'delinquency:read', 'delinquency', 'read', 'Leer morosidad'),
  
  -- Account Statement (Estado de cuenta)
  ('550e8400-e29b-41d4-a716-446655440801', 'account_statement:read', 'account_statement', 'read', 'Leer estado de cuenta'),
  ('550e8400-e29b-41d4-a716-446655440802', 'account_statement:export', 'account_statement', 'export', 'Exportar estado de cuenta'),
  
  -- Reports (Reportes)
  ('550e8400-e29b-41d4-a716-446655440901', 'reports:read', 'reports', 'read', 'Generar reportes'),
  
  -- Users (Gestión de usuarios)
  ('550e8400-e29b-41d4-a716-446655441001', 'users:create', 'users', 'create', 'Crear usuarios'),
  ('550e8400-e29b-41d4-a716-446655441002', 'users:read', 'users', 'read', 'Leer usuarios'),
  ('550e8400-e29b-41d4-a716-446655441003', 'users:update', 'users', 'update', 'Actualizar usuarios'),
  ('550e8400-e29b-41d4-a716-446655441004', 'users:delete', 'users', 'delete', 'Eliminar usuarios')
ON CONFLICT (name) DO NOTHING;

-- ── 3. ASIGNAR TODOS LOS PERMISOS AL ROL ADMIN ──────────
INSERT INTO role_permissions (role_id, permission_id) 
SELECT 
  r.id,
  p.id
FROM roles r, permissions p
WHERE r.name = 'ADMIN'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ── 4. ASIGNAR PERMISOS LIMITADOS AL ROL PROPIETARIO ───
-- Solo lectura en sus recursos y estado de cuenta
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  r.id,
  p.id
FROM roles r, permissions p
WHERE r.name = 'PROPIETARIO' 
  AND p.name IN (
    'apartments:read',
    'apartment_fees:read',
    'payments:read',
    'fines:read',
    'expenses:read',
    'delinquency:read',
    'account_statement:read',
    'account_statement:export',
    'reports:read'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;