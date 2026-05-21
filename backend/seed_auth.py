"""
Seeders para la base de datos de autenticación.

Genera datos iniciales para:
- Roles (ADMIN, PROPIETARIO)
- Permisos (por recurso y acción)
- Usuarios iniciales con roles asignados
- Relaciones entre roles y permisos

USO:
    python backend/seed.py --auth
    python backend/seed.py --all
"""

import asyncio
import logging
from uuid import UUID

import asyncpg
from app.config.settings import settings
from app.services.auth_service import hash_password

logger = logging.getLogger(__name__)

# UUIDs fijos para datos iniciales (determinísticos para testing)
ADMIN_ROLE_ID = "550e8400-e29b-41d4-a716-446655440001"
PROPIETARIO_ROLE_ID = "550e8400-e29b-41d4-a716-446655440002"

ADMIN_USER_ID = "550e8400-e29b-41d4-a716-446655441101"
JUAN_USER_ID = "550e8400-e29b-41d4-a716-446655441102"
MARIA_USER_ID = "550e8400-e29b-41d4-a716-446655441103"

# Permisos predefinidos
PERMISSIONS = [
    # Owners
    {"id": "550e8400-e29b-41d4-a716-446655440101", "name": "owners:create", "resource": "owners", "action": "create", "description": "Crear propietarios"},
    {"id": "550e8400-e29b-41d4-a716-446655440102", "name": "owners:read", "resource": "owners", "action": "read", "description": "Leer propietarios"},
    {"id": "550e8400-e29b-41d4-a716-446655440103", "name": "owners:update", "resource": "owners", "action": "update", "description": "Actualizar propietarios"},
    {"id": "550e8400-e29b-41d4-a716-446655440104", "name": "owners:delete", "resource": "owners", "action": "delete", "description": "Eliminar propietarios"},
    
    # Apartments
    {"id": "550e8400-e29b-41d4-a716-446655440201", "name": "apartments:create", "resource": "apartments", "action": "create", "description": "Crear apartamentos"},
    {"id": "550e8400-e29b-41d4-a716-446655440202", "name": "apartments:read", "resource": "apartments", "action": "read", "description": "Leer apartamentos"},
    {"id": "550e8400-e29b-41d4-a716-446655440203", "name": "apartments:update", "resource": "apartments", "action": "update", "description": "Actualizar apartamentos"},
    {"id": "550e8400-e29b-41d4-a716-446655440204", "name": "apartments:delete", "resource": "apartments", "action": "delete", "description": "Eliminar apartamentos"},
    
    # Apartment Fees
    {"id": "550e8400-e29b-41d4-a716-446655440301", "name": "fees:create", "resource": "apartment_fees", "action": "create", "description": "Crear cuotas"},
    {"id": "550e8400-e29b-41d4-a716-446655440302", "name": "fees:read", "resource": "apartment_fees", "action": "read", "description": "Leer cuotas"},
    {"id": "550e8400-e29b-41d4-a716-446655440303", "name": "fees:update", "resource": "apartment_fees", "action": "update", "description": "Actualizar cuotas"},
    {"id": "550e8400-e29b-41d4-a716-446655440304", "name": "fees:delete", "resource": "apartment_fees", "action": "delete", "description": "Eliminar cuotas"},
    
    # Payments
    {"id": "550e8400-e29b-41d4-a716-446655440401", "name": "payments:create", "resource": "payments", "action": "create", "description": "Crear pagos"},
    {"id": "550e8400-e29b-41d4-a716-446655440402", "name": "payments:read", "resource": "payments", "action": "read", "description": "Leer pagos"},
    {"id": "550e8400-e29b-41d4-a716-446655440403", "name": "payments:update", "resource": "payments", "action": "update", "description": "Actualizar pagos"},
    {"id": "550e8400-e29b-41d4-a716-446655440404", "name": "payments:delete", "resource": "payments", "action": "delete", "description": "Eliminar pagos"},
    
    # Fines
    {"id": "550e8400-e29b-41d4-a716-446655440501", "name": "fines:create", "resource": "fines", "action": "create", "description": "Crear multas"},
    {"id": "550e8400-e29b-41d4-a716-446655440502", "name": "fines:read", "resource": "fines", "action": "read", "description": "Leer multas"},
    {"id": "550e8400-e29b-41d4-a716-446655440503", "name": "fines:update", "resource": "fines", "action": "update", "description": "Actualizar multas"},
    {"id": "550e8400-e29b-41d4-a716-446655440504", "name": "fines:delete", "resource": "fines", "action": "delete", "description": "Eliminar multas"},
    
    # Expenses
    {"id": "550e8400-e29b-41d4-a716-446655440601", "name": "expenses:create", "resource": "expenses", "action": "create", "description": "Crear gastos"},
    {"id": "550e8400-e29b-41d4-a716-446655440602", "name": "expenses:read", "resource": "expenses", "action": "read", "description": "Leer gastos"},
    {"id": "550e8400-e29b-41d4-a716-446655440603", "name": "expenses:update", "resource": "expenses", "action": "update", "description": "Actualizar gastos"},
    {"id": "550e8400-e29b-41d4-a716-446655440604", "name": "expenses:delete", "resource": "expenses", "action": "delete", "description": "Eliminar gastos"},
    
    # Delinquency
    {"id": "550e8400-e29b-41d4-a716-446655440701", "name": "delinquency:read", "resource": "delinquency", "action": "read", "description": "Leer morosidad"},
    
    # Account Statement
    {"id": "550e8400-e29b-41d4-a716-446655440801", "name": "account_statement:read", "resource": "account_statement", "action": "read", "description": "Leer estado de cuenta"},
    {"id": "550e8400-e29b-41d4-a716-446655440802", "name": "account_statement:export", "resource": "account_statement", "action": "export", "description": "Exportar estado de cuenta"},
    
    # Reports
    {"id": "550e8400-e29b-41d4-a716-446655440901", "name": "reports:read", "resource": "reports", "action": "read", "description": "Generar reportes"},
    
    # Users
    {"id": "550e8400-e29b-41d4-a716-446655441001", "name": "users:create", "resource": "users", "action": "create", "description": "Crear usuarios"},
    {"id": "550e8400-e29b-41d4-a716-446655441002", "name": "users:read", "resource": "users", "action": "read", "description": "Leer usuarios"},
    {"id": "550e8400-e29b-41d4-a716-446655441003", "name": "users:update", "resource": "users", "action": "update", "description": "Actualizar usuarios"},
    {"id": "550e8400-e29b-41d4-a716-446655441004", "name": "users:delete", "resource": "users", "action": "delete", "description": "Eliminar usuarios"},
]

PROPIETARIO_PERMISSIONS = [
    "apartments:read",
    "apartment_fees:read",
    "payments:read",
    "fines:read",
    "expenses:read",
    "delinquency:read",
    "account_statement:read",
    "account_statement:export",
    "reports:read",
]


async def seed_roles(conn: asyncpg.Connection) -> None:
    """Crea los roles predefinidos."""
    logger.info("Insertando roles...")
    
    roles = [
        (ADMIN_ROLE_ID, "ADMIN", "Administrador del sistema — acceso total"),
        (PROPIETARIO_ROLE_ID, "PROPIETARIO", "Propietario de departamentos — acceso limitado"),
    ]
    
    for role_id, name, description in roles:
        await conn.execute(
            """
            INSERT INTO roles (id, name, description)
            VALUES ($1, $2, $3)
            ON CONFLICT (name) DO NOTHING
            """,
            role_id,
            name,
            description,
        )
    
    logger.info("✓ Roles creados")


async def seed_permissions(conn: asyncpg.Connection) -> None:
    """Crea los permisos predefinidos."""
    logger.info("Insertando permisos...")
    
    for perm in PERMISSIONS:
        await conn.execute(
            """
            INSERT INTO permissions (id, name, resource, action, description)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (name) DO NOTHING
            """,
            perm["id"],
            perm["name"],
            perm["resource"],
            perm["action"],
            perm["description"],
        )
    
    logger.info(f"✓ {len(PERMISSIONS)} permisos creados")


async def seed_role_permissions(conn: asyncpg.Connection) -> None:
    """Asigna permisos a roles."""
    logger.info("Asignando permisos a roles...")
    
    # ADMIN: todos los permisos
    for perm in PERMISSIONS:
        await conn.execute(
            """
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT (role_id, permission_id) DO NOTHING
            """,
            ADMIN_ROLE_ID,
            perm["id"],
        )
    
    # PROPIETARIO: permisos limitados
    for perm in PERMISSIONS:
        if perm["name"] in PROPIETARIO_PERMISSIONS:
            await conn.execute(
                """
                INSERT INTO role_permissions (role_id, permission_id)
                VALUES ($1, $2)
                ON CONFLICT (role_id, permission_id) DO NOTHING
                """,
                PROPIETARIO_ROLE_ID,
                perm["id"],
            )
    
    logger.info("✓ Permisos asignados a roles")


async def seed_users(conn: asyncpg.Connection) -> None:
    """Crea los usuarios iniciales."""
    logger.info("Insertando usuarios...")
    
    # Contraseña: "Admin123!"
    password_hash = hash_password("Admin123!")
    
    users = [
        (ADMIN_USER_ID, "admin@edificios.com", password_hash, "ACTIVO"),
        (JUAN_USER_ID, "juan@edificios.com", password_hash, "ACTIVO"),
        (MARIA_USER_ID, "maria@edificios.com", password_hash, "ACTIVO"),
    ]
    
    for user_id, email, password, status in users:
        await conn.execute(
            """
            INSERT INTO users (id, email, password, status)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (email) DO NOTHING
            """,
            user_id,
            email,
            password,
            status,
        )
    
    logger.info(f"✓ {len(users)} usuarios creados")


async def seed_user_roles(conn: asyncpg.Connection) -> None:
    """Asigna roles a usuarios."""
    logger.info("Asignando roles a usuarios...")
    
    user_role_assignments = [
        (ADMIN_USER_ID, ADMIN_ROLE_ID),
        (JUAN_USER_ID, PROPIETARIO_ROLE_ID),
        (MARIA_USER_ID, PROPIETARIO_ROLE_ID),
    ]
    
    for user_id, role_id in user_role_assignments:
        await conn.execute(
            """
            INSERT INTO user_roles (user_id, role_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, role_id) DO NOTHING
            """,
            user_id,
            role_id,
        )
    
    logger.info(f"✓ {len(user_role_assignments)} asignaciones creadas")


async def seed_auth() -> None:
    """Ejecuta todos los seeders de autenticación."""
    logger.info("Iniciando seeders de autenticación...")
    
    pool = await asyncpg.create_pool(settings.database_url)
    
    try:
        async with pool.acquire() as conn:
            await seed_roles(conn)
            await seed_permissions(conn)
            await seed_role_permissions(conn)
            await seed_users(conn)
            await seed_user_roles(conn)
        
        logger.info("\n✅ SEEDERS DE AUTENTICACIÓN COMPLETADOS\n")
        logger.info("Credenciales iniciales:")
        logger.info("  Admin: admin@edificios.com / Admin123!")
        logger.info("  Propietario 1: juan@edificios.com / Admin123!")
        logger.info("  Propietario 2: maria@edificios.com / Admin123!")
    finally:
        await pool.close()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    asyncio.run(seed_auth())
