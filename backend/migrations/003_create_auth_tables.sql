-- ============================================================
-- Migración: Tablas de Autenticación Local (JWT, Roles, Permisos)
-- Ejecutar sobre la base de datos "edificios" DESPUÉS de init.sql
-- ============================================================

-- 1. ROLES (predefinidos: ADMIN, PROPIETARIO)
CREATE TABLE IF NOT EXISTS roles (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name      VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. PERMISSIONS (granulares: owners:create, apartments:read, etc.)
CREATE TABLE IF NOT EXISTS permissions (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name      VARCHAR(100) UNIQUE NOT NULL,
    resource  VARCHAR(50),
    action    VARCHAR(50),
    description VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ROLE_PERMISSIONS (muchos a muchos)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

-- 4. USERS (autenticación local con contraseña hasheada)
CREATE TABLE IF NOT EXISTS users (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email      VARCHAR(255) UNIQUE NOT NULL,
    password   VARCHAR(255) NOT NULL,
    status     VARCHAR(50) NOT NULL DEFAULT 'ACTIVO',
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. USER_ROLES (muchos a muchos — actualmente solo 1 rol por usuario)
CREATE TABLE IF NOT EXISTS user_roles (
    user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id    UUID REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- 6. AUDIT_LOGS (opcional — para trazabilidad de login/logout/cambios)
CREATE TABLE IF NOT EXISTS audit_logs (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    action    VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─ ÍNDICES
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ─ INSERTS iniciales: ROLES
INSERT INTO roles (id, name, description) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'ADMIN', 'Administrador del sistema — acceso total'),
    ('550e8400-e29b-41d4-a716-446655440002', 'PROPIETARIO', 'Propietario de departamentos — acceso limitado')
ON CONFLICT (name) DO NOTHING;

-- ─ INSERTS iniciales: PERMISSIONS
INSERT INTO permissions (id, name, resource, action, description) VALUES
    -- Owners
    ('550e8400-e29b-41d4-a716-446655440101', 'owners:create', 'owners', 'create', 'Crear propietarios'),
    ('550e8400-e29b-41d4-a716-446655440102', 'owners:read', 'owners', 'read', 'Leer propietarios'),
    ('550e8400-e29b-41d4-a716-446655440103', 'owners:update', 'owners', 'update', 'Actualizar propietarios'),
    ('550e8400-e29b-41d4-a716-446655440104', 'owners:delete', 'owners', 'delete', 'Eliminar propietarios'),
    
    -- Apartments
    ('550e8400-e29b-41d4-a716-446655440201', 'apartments:create', 'apartments', 'create', 'Crear apartamentos'),
    ('550e8400-e29b-41d4-a716-446655440202', 'apartments:read', 'apartments', 'read', 'Leer apartamentos'),
    ('550e8400-e29b-41d4-a716-446655440203', 'apartments:update', 'apartments', 'update', 'Actualizar apartamentos'),
    ('550e8400-e29b-41d4-a716-446655440204', 'apartments:delete', 'apartments', 'delete', 'Eliminar apartamentos'),
    
    -- Apartment Fees
    ('550e8400-e29b-41d4-a716-446655440301', 'fees:create', 'apartment_fees', 'create', 'Crear cuotas'),
    ('550e8400-e29b-41d4-a716-446655440302', 'fees:read', 'apartment_fees', 'read', 'Leer cuotas'),
    ('550e8400-e29b-41d4-a716-446655440303', 'fees:update', 'apartment_fees', 'update', 'Actualizar cuotas'),
    
    -- Payments
    ('550e8400-e29b-41d4-a716-446655440401', 'payments:create', 'payments', 'create', 'Crear pagos'),
    ('550e8400-e29b-41d4-a716-446655440402', 'payments:read', 'payments', 'read', 'Leer pagos'),
    ('550e8400-e29b-41d4-a716-446655440403', 'payments:update', 'payments', 'update', 'Actualizar pagos'),
    
    -- Fines
    ('550e8400-e29b-41d4-a716-446655440501', 'fines:create', 'fines', 'create', 'Crear multas'),
    ('550e8400-e29b-41d4-a716-446655440502', 'fines:read', 'fines', 'read', 'Leer multas'),
    ('550e8400-e29b-41d4-a716-446655440503', 'fines:update', 'fines', 'update', 'Actualizar multas'),
    
    -- Expenses
    ('550e8400-e29b-41d4-a716-446655440601', 'expenses:create', 'expenses', 'create', 'Crear gastos'),
    ('550e8400-e29b-41d4-a716-446655440602', 'expenses:read', 'expenses', 'read', 'Leer gastos'),
    ('550e8400-e29b-41d4-a716-446655440603', 'expenses:update', 'expenses', 'update', 'Actualizar gastos'),
    
    -- Delinquency
    ('550e8400-e29b-41d4-a716-446655440701', 'delinquency:read', 'delinquency', 'read', 'Leer morosidad'),
    
    -- Account Statement
    ('550e8400-e29b-41d4-a716-446655440801', 'account_statement:read', 'account_statement', 'read', 'Leer estado de cuenta'),
    
    -- Reports
    ('550e8400-e29b-41d4-a716-446655440901', 'reports:read', 'reports', 'read', 'Generar reportes'),
    
    -- User Management
    ('550e8400-e29b-41d4-a716-446655441001', 'users:create', 'users', 'create', 'Crear usuarios'),
    ('550e8400-e29b-41d4-a716-446655441002', 'users:read', 'users', 'read', 'Leer usuarios'),
    ('550e8400-e29b-41d4-a716-446655441003', 'users:update', 'users', 'update', 'Actualizar usuarios')
ON CONFLICT (name) DO NOTHING;

-- ─ ASIGNAR PERMISOS AL ROL ADMIN (todos)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    r.id,
    p.id
FROM roles r, permissions p
WHERE r.name = 'ADMIN'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ─ ASIGNAR PERMISOS AL ROL PROPIETARIO (lectura y acceso limitado)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    r.id,
    p.id
FROM roles r, permissions p
WHERE r.name = 'PROPIETARIO'
AND p.name IN (
    'apartments:read',
    'fees:read',
    'payments:read',
    'payments:create',
    'fines:read',
    'delinquency:read',
    'account_statement:read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;
