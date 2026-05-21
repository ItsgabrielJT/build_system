---
id: SPEC-002
status: APPROVED
feature: autenticacion-bd-local
created: 2026-05-21
updated: 2026-05-21
author: spec-generator
version: "1.0"
related-specs: ["SPEC-001"]
---

# Spec: Autenticación Local con Base de Datos — Sistema de Usuarios, Roles y Permisos

> **Estado:** `APPROVED` → se requiere aprobación (`status: APPROVED`) antes de iniciar implementación.
> **Ciclo de vida:** DRAFT → APPROVED → IN_PROGRESS → IMPLEMENTED
> **Nota:** Esta spec reemplaza la autenticación Firebase con un sistema local de BD. Firebase queda pendiente para futuras implementaciones.

---

## 1. REQUERIMIENTOS

### Descripción

Sistema de autenticación local basado en base de datos PostgreSQL. Gestiona usuarios, roles y permisos sin depender de servicios externos. Permite login/logout, generación de JWT, gestión de roles (ADMIN y PROPIETARIO) y validación de permisos en los endpoints. Incluye seeders para datos iniciales.

### Requerimiento de Negocio

El sistema MVP requiere un mecanismo de autenticación confiable, controlado internamente, que:

1. **Gestione Usuarios**: Registro, login, logout, recuperación de perfil.
2. **Gestione Roles**: ADMIN (acceso total) y PROPIETARIO (acceso limitado a sus departamentos).
3. **Gestione Permisos**: Permisos granulares asignados a roles (crear, leer, actualizar, eliminar por entidad).
4. **Genere Tokens JWT**: Token de corta duración para autenticar requests. Token refresh para renovación.
5. **Auditoría Básica**: Registrar login/logout y cambios de contraseña.
6. **No usar Firebase**: Toda la autenticación en la BD local de PostgreSQL.

---

## 2. DISEÑO

### Historias de Usuario

#### HU-01: ADMIN/PROPIETARIO — Login y Obtención de Token JWT

```
Como:        Usuario del sistema (ADMIN o PROPIETARIO)
Quiero:      Autenticarme ingresando usuario y contraseña
Para:        Acceder al sistema y obtener un token JWT válido

Prioridad:   Alta
Estimación:  M
Dependencias: Ninguna (base)
Capa:        Backend
```

##### Criterios de Aceptación — HU-01

**Happy Path — Login exitoso**
```gherkin
CRITERIO-1.1: Autenticación exitosa con credenciales válidas
  Dado que:  Usuario "admin@edificios.com" existe con contraseña hasheada
  Cuando:    Envía POST /api/v1/auth/login con {"email": "admin@edificios.com", "password": "securePass123"}
  Entonces:  Retorna 200 con { "access_token": "jwt...", "token_type": "bearer", "user": { ... } }
             El token es válido por 24 horas
```

**Error Path — Credenciales inválidas**
```gherkin
CRITERIO-1.2: Rechazar login con contraseña incorrecta
  Dado que:  Usuario "admin@edificios.com" existe
  Cuando:    Envía POST /api/v1/auth/login con password incorrecto
  Entonces:  Retorna 401 Unauthorized con mensaje "Credenciales inválidas"
```

**Error Path — Usuario no existe**
```gherkin
CRITERIO-1.3: Rechazar login si usuario no existe
  Dado que:  Usuario "nonexistent@edificios.com" no existe
  Cuando:    Intenta login
  Entonces:  Retorna 401 Unauthorized con mensaje "Credenciales inválidas"
```

**Validación — Campos obligatorios**
```gherkin
CRITERIO-1.4: Validar campos requeridos
  Dado que:  Endpoint /api/v1/auth/login recibe request
  Cuando:    Falta el campo "email" o "password"
  Entonces:  Retorna 400 Bad Request con detalles de validación
```

---

#### HU-02: ADMIN/PROPIETARIO — Logout

```
Como:        Usuario autenticado
Quiero:      Cerrar sesión y invalidar mi token
Para:        Asegurar que mi sesión termine

Prioridad:   Media
Estimación:  S
Dependencias: HU-01
Capa:        Backend
```

##### Criterios de Aceptación — HU-02

**Happy Path — Logout exitoso**
```gherkin
CRITERIO-2.1: Logout sin errores
  Dado que:  Usuario está autenticado con token válido
  Cuando:    Envía POST /api/v1/auth/logout con Authorization: Bearer {token}
  Entonces:  Retorna 200 {"message": "Sesión cerrada exitosamente"}
             El token se añade a blacklist (opcional: implementación futura)
```

**Error Path — Sin token**
```gherkin
CRITERIO-2.2: Rechazar logout sin autenticación
  Dado que:  No hay token en Authorization header
  Cuando:    Envía POST /api/v1/auth/logout
  Entonces:  Retorna 401 Unauthorized
```

---

#### HU-03: ADMIN — Crear Usuario

```
Como:        Administrador
Quiero:      Crear nuevos usuarios (ADMIN o PROPIETARIO)
Para:        Registrar personas con acceso al sistema

Prioridad:   Alta
Estimación:  M
Dependencias: Ninguna (base de seguridad)
Capa:        Backend
```

##### Criterios de Aceptación — HU-03

**Happy Path — Crear usuario**
```gherkin
CRITERIO-3.1: Crear usuario con rol PROPIETARIO
  Dado que:  Admin está autenticado
  Cuando:    Envía POST /api/v1/users con { "email": "juan@edificios.com", "password": "Secure123!", "role_id": "{PROPIETARIO_ROLE_ID}" }
  Entonces:  Retorna 201 Created
             Usuario se crea con password hasheado (bcrypt)
             Se asigna el rol
             created_at y updated_at se establecen a NOW()
```

**Validación — Email único**
```gherkin
CRITERIO-3.2: Rechazar duplicado de email
  Dado que:  Usuario "juan@edificios.com" ya existe
  Cuando:    Intenta crear otro usuario con el mismo email
  Entonces:  Retorna 409 Conflict con mensaje "Email ya registrado"
```

**Validación — Contraseña fuerte**
```gherkin
CRITERIO-3.3: Validar fortaleza de contraseña
  Dado que:  Se intenta crear usuario
  Cuando:    Envía password = "123" (muy débil)
  Entonces:  Retorna 400 Bad Request con mensaje de validación
             Requerimiento: mínimo 8 caracteres, mayúscula, minúscula, número
```

---

#### HU-04: ADMIN — Listar Usuarios

```
Como:        Administrador
Quiero:      Ver la lista de usuarios del sistema
Para:        Gestionar accesos y roles

Prioridad:   Media
Estimación:  S
Dependencias: HU-03
Capa:        Backend
```

##### Criterios de Aceptación — HU-04

**Happy Path — Listar todos los usuarios**
```gherkin
CRITERIO-4.1: Obtener lista de usuarios
  Dado que:  Existen 5 usuarios en el sistema
  Cuando:    Admin envía GET /api/v1/users
  Entonces:  Retorna 200 con array de usuarios (sin passwords)
             Campos: id, email, role { id, name }, status, created_at, updated_at
```

**Filtro — Por rol**
```gherkin
CRITERIO-4.2: Filtrar usuarios por rol
  Dado que:  Existen 3 ADMIN y 2 PROPIETARIO
  Cuando:    Envía GET /api/v1/users?role=PROPIETARIO
  Entonces:  Retorna 200 con solo los 2 PROPIETARIO
```

---

#### HU-05: ADMIN — Actualizar Usuario (cambiar rol, status)

```
Como:        Administrador
Quiero:      Cambiar el rol o status de un usuario
Para:        Gestionar permisos dinámicamente

Prioridad:   Media
Estimación:  S
Dependencias: HU-03
Capa:        Backend
```

##### Criterios de Aceptación — HU-05

**Happy Path — Cambiar rol**
```gherkin
CRITERIO-5.1: Cambiar usuario de PROPIETARIO a ADMIN
  Dado que:  Usuario "juan@edificios.com" tiene rol PROPIETARIO
  Cuando:    Admin envía PUT /api/v1/users/{user_id} con { "role_id": "{ADMIN_ROLE_ID}" }
  Entonces:  Retorna 200 con usuario actualizado
             updated_at se actualiza a NOW()
```

**Happy Path — Cambiar status**
```gherkin
CRITERIO-5.2: Desactivar usuario
  Dado que:  Usuario existe con status="ACTIVO"
  Cuando:    Admin envía PUT /api/v1/users/{user_id} con { "status": "INACTIVO" }
  Entonces:  Retorna 200
             Usuario inactivo no puede loginear
```

---

#### HU-06: USUARIO — Ver y Actualizar Perfil Propio

```
Como:        Usuario autenticado
Quiero:      Ver mis datos de perfil y cambiar mi contraseña
Para:        Mantener mi cuenta segura y actualizada

Prioridad:   Media
Estimación:  S
Dependencias: HU-01
Capa:        Backend
```

##### Criterios de Aceptación — HU-06

**Happy Path — Ver perfil propio**
```gherkin
CRITERIO-6.1: Usuario ve su perfil
  Dado que:  Usuario está autenticado con token válido
  Cuando:    Envía GET /api/v1/users/me con Authorization header
  Entonces:  Retorna 200 con { id, email, role, status, created_at }
             No retorna password
```

**Happy Path — Cambiar contraseña**
```gherkin
CRITERIO-6.2: Usuario cambia su contraseña
  Dado que:  Usuario está autenticado
  Cuando:    Envía POST /api/v1/users/me/change-password
             Con { "current_password": "OldPass123", "new_password": "NewPass456" }
  Entonces:  Retorna 200 {"message": "Contraseña actualizada"}
             La nueva contraseña está hasheada
```

**Error Path — Contraseña actual incorrecta**
```gherkin
CRITERIO-6.3: Rechazar cambio si contraseña actual es incorrecta
  Dado que:  current_password es incorrecto
  Cuando:    Envía POST /api/v1/users/me/change-password
  Entonces:  Retorna 401 Unauthorized
```

---

#### HU-07: SISTEMA — Validación de Permisos en Endpoints

```
Como:        Sistema
Quiero:      Verificar que el usuario autenticado tiene permisos para la acción
Para:        Aplicar control de acceso basado en roles y permisos

Prioridad:   Alta
Estimación:  L
Dependencias: Todas las HUs (autenticación)
Capa:        Backend
```

##### Criterios de Aceptación — HU-07

**Validación — Solo ADMIN puede crear propietarios**
```gherkin
CRITERIO-7.1: Rechazar si no es ADMIN
  Dado que:  Usuario "propietario@edificios.com" con rol PROPIETARIO
  Cuando:    Intenta POST /api/v1/owners (crear propietario)
  Entonces:  Retorna 403 Forbidden con mensaje "No tiene permisos para esta acción"
```

**Validación — PROPIETARIO solo ve sus departamentos**
```gherkin
CRITERIO-7.2: Filtrar departamentos por propietario
  Dado que:  Usuario con rol PROPIETARIO posee deptos "101" y "102"
  Cuando:    Consulta GET /api/v1/apartments
  Entonces:  Retorna 200 solo con sus 2 departamentos
             Otro PROPIETARIO no puede verlos
```

**Validación — ADMIN ve todo**
```gherkin
CRITERIO-7.3: ADMIN accede a todos los recursos
  Dado que:  Usuario con rol ADMIN
  Cuando:    Consulta GET /api/v1/apartments
  Entonces:  Retorna 200 con TODOS los apartamentos del sistema
```

---

### Reglas de Negocio

1. **RN-01**: Todo usuario **debe** tener un email único en la BD. No se permiten duplicados.
2. **RN-02**: Toda contraseña **debe** estar hasheada usando bcrypt (min 10 rounds) antes de guardarse.
3. **RN-03**: Un token JWT **tiene validez de 24 horas** desde su emisión.
4. **RN-04**: Un usuario puede tener **un único rol** en el momento de autenticación. Futuro: multi-rol.
5. **RN-05**: Los permisos se heredan del rol. Un usuario con rol ADMIN tiene todos los permisos. Un PROPIETARIO tiene permisos limitados.
6. **RN-06**: Un usuario con status `INACTIVO` **no puede autenticarse** bajo ninguna circunstancia.
7. **RN-07**: El cambio de contraseña **requiere confirmar la contraseña anterior** para garantizar que quien solicita tiene acceso válido a la cuenta.
8. **RN-08**: Los timestamps `created_at` y `updated_at` están en UTC, formato ISO 8601, y se actualizan automáticamente.
9. **RN-09**: Los roles están predefinidos en la BD (ADMIN, PROPIETARIO) y no se crean dinámicamente por usuarios.
10. **RN-10**: Los permisos son granulares por entidad y acción (owners:create, owners:read, apartments:update, etc.).

---

### Modelos de Datos

#### Entidades principales

| Entidad | Almacén | Estado | Descripción |
|---------|---------|--------|-------------|
| `users` | PostgreSQL | nueva | Usuarios del sistema con email y contraseña hasheada |
| `roles` | PostgreSQL | nueva | Roles predefinidos (ADMIN, PROPIETARIO) |
| `permissions` | PostgreSQL | nueva | Permisos disponibles (owners:create, apartments:read, etc.) |
| `user_roles` | PostgreSQL | nueva | Relación muchos a muchos entre users y roles |
| `role_permissions` | PostgreSQL | nueva | Relación muchos a muchos entre roles y permissions |
| `audit_logs` | PostgreSQL | nueva | Registro de login/logout para auditoría (opcional) |

#### Schema PostgreSQL (DDL recomendado)

```sql
-- 1. ROLES
CREATE TABLE IF NOT EXISTS roles (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name      VARCHAR(50) UNIQUE NOT NULL,  -- 'ADMIN', 'PROPIETARIO'
    description VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. PERMISSIONS
CREATE TABLE IF NOT EXISTS permissions (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name      VARCHAR(100) UNIQUE NOT NULL,  -- 'owners:create', 'apartments:read', etc.
    description VARCHAR(255),
    resource  VARCHAR(50),  -- 'owners', 'apartments', 'payments', etc.
    action    VARCHAR(50),  -- 'create', 'read', 'update', 'delete'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ROLE_PERMISSIONS (muchos a muchos)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

-- 4. USERS
CREATE TABLE IF NOT EXISTS users (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email      VARCHAR(255) UNIQUE NOT NULL,
    password   VARCHAR(255) NOT NULL,  -- Hasheado con bcrypt
    status     VARCHAR(50) NOT NULL DEFAULT 'ACTIVO',  -- ACTIVO, INACTIVO
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

-- 6. AUDIT_LOGS (Opcional — para trazabilidad)
CREATE TABLE IF NOT EXISTS audit_logs (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    action    VARCHAR(100) NOT NULL,  -- 'LOGIN', 'LOGOUT', 'PASSWORD_CHANGE'
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. ÍNDICES
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

---

### Seeders SQL

```sql
-- ============================================================
-- SEEDERS: Roles, Permisos y Usuarios Iniciales
-- Ejecutar sobre la base de datos "edificios" DESPUÉS de crear tablas
-- ============================================================

-- 1. INSERTAR ROLES
INSERT INTO roles (id, name, description) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'ADMIN', 'Administrador del sistema — acceso total'),
  ('550e8400-e29b-41d4-a716-446655440002', 'PROPIETARIO', 'Propietario de departamentos — acceso limitado')
ON CONFLICT (name) DO NOTHING;

-- 2. INSERTAR PERMISOS
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

-- 3. ASIGNAR PERMISOS AL ROL ADMIN (todos)
INSERT INTO role_permissions (role_id, permission_id) 
SELECT 
  r.id,
  p.id
FROM roles r, permissions p
WHERE r.name = 'ADMIN'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. ASIGNAR PERMISOS AL ROL PROPIETARIO (lectura y acceso limitado)
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
    'reports:read'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 5. INSERTAR USUARIOS INICIALES
-- Password: 'Admin123!' (hasheado con bcrypt, 10 rounds)
-- En la práctica, estos serán creados vía API con password hasheado
INSERT INTO users (id, email, password, status) VALUES
  ('550e8400-e29b-41d4-a716-446655441101', 'admin@edificios.com', '$2b$10$4PK1qvdLNrvh4n3K4PxVNOHLQKrNFKEhqQxRFM7tB8M4EKZhQvKMe', 'ACTIVO'),
  ('550e8400-e29b-41d4-a716-446655441102', 'juan@edificios.com', '$2b$10$4PK1qvdLNrvh4n3K4PxVNOHLQKrNFKEhqQxRFM7tB8M4EKZhQvKMe', 'ACTIVO'),
  ('550e8400-e29b-41d4-a716-446655441103', 'maria@edificios.com', '$2b$10$4PK1qvdLNrvh4n3K4PxVNOHLQKrNFKEhqQxRFM7tB8M4EKZhQvKMe', 'ACTIVO')
ON CONFLICT (email) DO NOTHING;

-- 6. ASIGNAR ROLES A USUARIOS
INSERT INTO user_roles (user_id, role_id) VALUES
  ('550e8400-e29b-41d4-a716-446655441101', '550e8400-e29b-41d4-a716-446655440001'),  -- admin@edificios.com → ADMIN
  ('550e8400-e29b-41d4-a716-446655441102', '550e8400-e29b-41d4-a716-446655440002'),  -- juan@edificios.com → PROPIETARIO
  ('550e8400-e29b-41d4-a716-446655441103', '550e8400-e29b-41d4-a716-446655440002')   -- maria@edificios.com → PROPIETARIO
ON CONFLICT (user_id, role_id) DO NOTHING;

-- ============================================================
-- CREDENCIALES INICIALES (para testing)
-- ============================================================
-- Usuario: admin@edificios.com
-- Password: Admin123!
--
-- Usuario: juan@edificios.com
-- Password: Admin123!
--
-- Usuario: maria@edificios.com
-- Password: Admin123!
-- ============================================================
```

---

### API Endpoints

#### POST /api/v1/auth/login
- **Descripción**: Autenticar usuario y retornar JWT
- **Auth requerida**: No
- **Body**: `{ "email": "string", "password": "string" }`
- **Response 200**: 
  ```json
  {
    "access_token": "eyJhbGc...",
    "token_type": "bearer",
    "user": {
      "id": "uuid",
      "email": "string",
      "role": { "id": "uuid", "name": "ADMIN|PROPIETARIO" },
      "status": "ACTIVO|INACTIVO"
    }
  }
  ```
- **Response 401**: Credenciales inválidas
- **Response 400**: Validación fallida

#### POST /api/v1/auth/logout
- **Descripción**: Cerrar sesión del usuario
- **Auth requerida**: Sí (JWT)
- **Response 200**: `{ "message": "Sesión cerrada exitosamente" }`
- **Response 401**: No autenticado

#### GET /api/v1/users/me
- **Descripción**: Obtener perfil del usuario autenticado
- **Auth requerida**: Sí (JWT)
- **Response 200**: 
  ```json
  {
    "id": "uuid",
    "email": "string",
    "role": { "id": "uuid", "name": "string" },
    "status": "ACTIVO|INACTIVO",
    "created_at": "ISO 8601",
    "updated_at": "ISO 8601"
  }
  ```
- **Response 401**: No autenticado

#### POST /api/v1/users/me/change-password
- **Descripción**: Cambiar contraseña del usuario autenticado
- **Auth requerida**: Sí (JWT)
- **Body**: `{ "current_password": "string", "new_password": "string" }`
- **Response 200**: `{ "message": "Contraseña actualizada" }`
- **Response 401**: Contraseña actual incorrecta
- **Response 400**: Validación fallida (contraseña débil)

#### POST /api/v1/users
- **Descripción**: Crear nuevo usuario (solo ADMIN)
- **Auth requerida**: Sí (JWT + ADMIN)
- **Body**: `{ "email": "string", "password": "string", "role_id": "uuid" }`
- **Response 201**: Usuario creado con role
- **Response 409**: Email ya registrado
- **Response 400**: Validación fallida
- **Response 403**: No autorizado (no es ADMIN)

#### GET /api/v1/users
- **Descripción**: Listar usuarios (solo ADMIN)
- **Auth requerida**: Sí (JWT + ADMIN)
- **Query**: `?role=ADMIN|PROPIETARIO&status=ACTIVO|INACTIVO`
- **Response 200**: Array de usuarios sin passwords
- **Response 403**: No autorizado

#### GET /api/v1/users/{user_id}
- **Descripción**: Obtener usuario específico (solo ADMIN)
- **Auth requerida**: Sí (JWT + ADMIN)
- **Response 200**: Usuario con detalles completos
- **Response 404**: Usuario no encontrado
- **Response 403**: No autorizado

#### PUT /api/v1/users/{user_id}
- **Descripción**: Actualizar usuario (solo ADMIN)
- **Auth requerida**: Sí (JWT + ADMIN)
- **Body**: `{ "role_id": "uuid?", "status": "ACTIVO|INACTIVO?" }`
- **Response 200**: Usuario actualizado
- **Response 404**: Usuario no encontrado
- **Response 403**: No autorizado

---

### Middleware de Autenticación

#### JWT Validation Middleware

```
Middleware: ValidateJWT
  1. Extrae token del header Authorization: Bearer {token}
  2. Valida firma y expiración
  3. Si válido: inyecta user en request.state.user
  4. Si inválido: retorna 401 Unauthorized
  5. Si falta: retorna 401 Unauthorized
```

#### Permission Check Decorator

```
Decorator: require_permission(resource, action)
  1. Obtiene usuario de request.state.user
  2. Obtiene rol del usuario
  3. Busca permisos del rol en role_permissions
  4. Si tiene {resource}:{action} → continúa
  5. Si no → retorna 403 Forbidden
```

Ejemplo de uso:
```python
@router.post("/owners")
@require_permission("owners", "create")
async def create_owner(body: OwnerCreate, db=Depends(get_db)):
    # Solo ADMIN puede llegar aquí
    ...
```

---

### Seguridad

1. **Hashing de Contraseñas**: bcrypt con min 10 rounds
2. **Token JWT**: HS256, 24 horas de validez
3. **CORS**: Configurado para aceptar requests del frontend en desarrollo
4. **Rate Limiting**: 5 intentos de login por IP en 15 minutos (opcional, implementación futura)
5. **SQL Injection**: Uso de prepared statements con asyncpg
6. **Auditoría**: Opcional — `audit_logs` para trazabilidad de login/logout

---

### Configuración (app/config/settings.py)

```python
from pydantic import BaseSettings

class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://user:pass@localhost:5432/edificios"
    
    # JWT
    jwt_secret_key: str = "your-secret-key-min-32-chars-min-32-chars"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24
    
    # Bcrypt
    bcrypt_rounds: int = 10
    
    # API
    api_prefix: str = "/api/v1"
    
    class Config:
        env_file = ".env"
```

---

## 3. LISTA DE TAREAS

### Backend

#### Modelos Pydantic

- [ ] `UserCreate`, `UserUpdate`, `UserResponse` (sin password)
- [ ] `LoginRequest`, `LoginResponse`, `TokenPayload`
- [ ] `RoleResponse`, `PermissionResponse`
- [ ] `ChangePasswordRequest`

#### Repositorio (Database Layer)

- [ ] `UserRepository` — create, read, get_by_email, update, soft_delete
- [ ] `RoleRepository` — get_all, get_by_id, get_by_name
- [ ] `PermissionRepository` — get_all, get_by_resource_action
- [ ] `UserRoleRepository` — assign_role, get_user_roles
- [ ] `RolePermissionRepository` — get_permissions_by_role
- [ ] `AuditLogRepository` — log_action (opcional)

#### Servicios (Lógica de Negocio)

- [ ] `AuthService` — login, logout, validate_token, refresh_token
- [ ] `UserService` — create_user, update_user, change_password, validate_email_unique
- [ ] `RoleService` — get_all_roles, get_user_role
- [ ] `PermissionService` — check_user_permission, get_user_permissions
- [ ] Validadores: `validate_password_strength`, `validate_email_format`

#### Rutas (HTTP Endpoints)

- [ ] `router_auth.py` — POST/login, POST/logout
- [ ] `router_users.py` — GET/me, POST/me/change-password, POST, GET, GET/{id}, PUT/{id}
- [ ] Registrar routers en `app/main.py`

#### Middleware y Dependencias

- [ ] `dependencies.py` — `get_current_user()`, `get_current_admin()`, `require_permission()`
- [ ] JWT token generation y validation
- [ ] CORS configuration

#### Utilidades de Seguridad

- [ ] `security.py` — `hash_password()`, `verify_password()`, `create_jwt_token()`, `decode_jwt_token()`

#### Tests Backend

- [ ] `test_auth_login_success`
- [ ] `test_auth_login_invalid_credentials`
- [ ] `test_user_service_create_success`
- [ ] `test_user_service_duplicate_email_raises_409`
- [ ] `test_user_service_change_password_success`
- [ ] `test_permission_check_admin_allowed`
- [ ] `test_permission_check_propietario_forbidden`
- [ ] `test_router_post_users_requires_admin`
- [ ] `test_jwt_token_validation`
- [ ] `test_jwt_token_expiration`

#### Database

- [ ] Crear script `migrations/002_create_auth_schema.sql`
- [ ] Incluir tables: roles, permissions, role_permissions, users, user_roles, audit_logs
- [ ] Crear índices
- [ ] Crear seeders SQL con datos iniciales

### Eliminación de Referencias Firebase

#### Backend

- [ ] Eliminar campos `firebase_uid` de tablas existentes (owners, apartment_fees, etc.) en migración
- [ ] Eliminar importaciones de Firebase Admin SDK
- [ ] Eliminar middleware/dependencias de Firebase Auth
- [ ] Actualizar SPEC-001 (gestion-edificios-mvp) para remover menciones de Firebase UID

#### Frontend

- [ ] Eliminar configuración de Firebase en `frontend/src/config/firebase.js`
- [ ] Eliminar proveedor de Firebase Auth en `frontend/src/hooks/AuthProvider.jsx`
- [ ] Actualizar `useAuth()` hook para usar la nueva API de login local
- [ ] Eliminar dependencias de Firebase del `package.json`
- [ ] Actualizar `authService.ts` para consumir `/api/v1/auth/login` en lugar de Firebase

### Frontend (Será implementado en fase posterior)

#### Componentes

- [ ] `LoginPage.jsx` — actualizar para usar new auth API
- [ ] `ChangePasswordModal.jsx` — formulario para cambiar contraseña
- [ ] `UserManagementPage.jsx` — CRUD usuarios (solo ADMIN)

#### Services

- [ ] `authService.ts` — login, logout, getCurrentUser, changePassword (local API)

#### Hooks

- [ ] `useAuth()` — actualizar para usar nueva API
- [ ] `useAuthToken()` — gestión de JWT en localStorage

---

## Status

- **Creado**: 2026-05-21
- **Última actualización**: 2026-05-21
- **Próximo paso**: Revisar spec, cambiar status a `APPROVED`, iniciar implementación ASDD Fase 2 (Backend auth + DB schema).
- **Nota importante**: Antes de implementar, ejecutar migraciones SQL de ambos specs (SPEC-001 y SPEC-002) para crear todas las tablas necesarias.
