-- ============================================================
-- Migración 002: Sistema de Autenticación Local
-- Gestión de Usuarios, Roles, Permisos y Auditoría
-- ============================================================
-- IMPORTANTE: Ejecutar DESPUÉS de migrations/init.sql
-- Base de datos: "edificios"
-- ============================================================

-- Extensión para gen_random_uuid() (si no existe)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. ROLES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_roles_name ON roles(name);

-- ── 2. PERMISSIONS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) UNIQUE NOT NULL,
    description VARCHAR(255),
    resource    VARCHAR(50),
    action      VARCHAR(50),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_permissions_name ON permissions(name);
CREATE INDEX idx_permissions_resource_action ON permissions(resource, action);

-- ── 3. ROLE_PERMISSIONS (muchos a muchos) ──────────────
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);

-- ── 4. USERS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email      VARCHAR(255) UNIQUE NOT NULL,
    password   VARCHAR(255) NOT NULL,
    status     VARCHAR(50)  NOT NULL DEFAULT 'ACTIVO',
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);

-- ── 5. USER_ROLES (muchos a muchos) ─────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
    user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id    UUID REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

-- ── 6. AUDIT_LOGS (Trazabilidad de accesos) ────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    action    VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- ============================================================
-- FIN DE MIGRACIÓN
-- ============================================================
