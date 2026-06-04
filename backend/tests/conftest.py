"""Configuración de pytest — fixtures, mocks de BD, clientes HTTP."""

from __future__ import annotations

import os
from typing import Any, AsyncGenerator
from uuid import UUID, uuid4
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
import asyncpg
from fastapi.testclient import TestClient
from httpx import AsyncClient

from app.main import app
from app.config.settings import settings
from app.services.auth_service import AuthService
from app.repositories.user_repository import UserRepository
from app.repositories.role_repository import RoleRepository


# ─── IDs FIJOS PARA TESTS ──────────────────────────────────────────────────────

ADMIN_ROLE_ID = UUID("550e8400-e29b-41d4-a716-446655440001")
PROPIETARIO_ROLE_ID = UUID("550e8400-e29b-41d4-a716-446655440002")

ADMIN_USER_ID = UUID("550e8400-e29b-41d4-a716-446655440011")
PROPIETARIO_USER_ID = UUID("550e8400-e29b-41d4-a716-446655440012")
INACTIVE_USER_ID = UUID("550e8400-e29b-41d4-a716-446655440013")

ADMIN_EMAIL = "admin@edificios.com"
ADMIN_PASSWORD = "SecureAdmin123"
ADMIN_PASSWORD_HASH = AuthService.hash_password(ADMIN_PASSWORD)

PROPIETARIO_EMAIL = "propietario@edificios.com"
PROPIETARIO_PASSWORD = "SecureProp123"
PROPIETARIO_PASSWORD_HASH = AuthService.hash_password(PROPIETARIO_PASSWORD)

INACTIVE_EMAIL = "inactive@edificios.com"
INACTIVE_PASSWORD_HASH = AuthService.hash_password("InactivePass123")

NEW_USER_EMAIL = "newuser@edificios.com"
NEW_USER_PASSWORD = "NewPass123"


# ─── FIXTURES: DATABASE MOCK ──────────────────────────────────────────────────

@pytest_asyncio.fixture
async def mock_db() -> AsyncMock:
    """Mock de asyncpg.Connection para simular BD sin conectar realmente."""
    mock = AsyncMock(spec=asyncpg.Connection)
    return mock


@pytest_asyncio.fixture
async def db_with_users(mock_db: AsyncMock) -> AsyncMock:
    """Mock de BD prePopulado con usuarios y roles de test."""

    # ─── Roles
    roles_data = {
        ADMIN_ROLE_ID: {
            "id": ADMIN_ROLE_ID,
            "name": "ADMIN",
            "description": "Administrador del sistema",
        },
        PROPIETARIO_ROLE_ID: {
            "id": PROPIETARIO_ROLE_ID,
            "name": "PROPIETARIO",
            "description": "Propietario de departamentos",
        },
    }

    # ─── Usuarios (mutable para que los tests puedan modificarlos)
    users_data = {
        ADMIN_USER_ID: {
            "id": ADMIN_USER_ID,
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD_HASH,
            "status": "ACTIVO",
            "created_at": "2026-05-20T10:00:00Z",
            "updated_at": "2026-05-20T10:00:00Z",
        },
        PROPIETARIO_USER_ID: {
            "id": PROPIETARIO_USER_ID,
            "email": PROPIETARIO_EMAIL,
            "password": PROPIETARIO_PASSWORD_HASH,
            "status": "ACTIVO",
            "created_at": "2026-05-20T10:00:00Z",
            "updated_at": "2026-05-20T10:00:00Z",
        },
        INACTIVE_USER_ID: {
            "id": INACTIVE_USER_ID,
            "email": INACTIVE_EMAIL,
            "password": INACTIVE_PASSWORD_HASH,
            "status": "INACTIVO",
            "created_at": "2026-05-20T10:00:00Z",
            "updated_at": "2026-05-20T10:00:00Z",
        },
    }

    # ─── Users with roles mapping
    user_roles_map = {
        ADMIN_USER_ID: ADMIN_ROLE_ID,
        PROPIETARIO_USER_ID: PROPIETARIO_ROLE_ID,
        INACTIVE_USER_ID: PROPIETARIO_ROLE_ID,
    }

    def build_users_with_roles():
        """Construir dict de usuarios con roles."""
        result = {}
        for user_id, user in users_data.items():
            role_id = user_roles_map.get(user_id)
            if role_id and role_id in roles_data:
                role = roles_data[role_id]
                result[user_id] = {
                    **user,
                    "role_id": role["id"],
                    "role_name": role["name"],
                    "role_description": role["description"],
                }
        return result

    # ─── Configurar fetchrow
    async def fetchrow_side_effect(query: str, *args):
        if "FROM users u" in query and "WHERE u.email" in query:
            email = args[0]
            for uid, user in users_data.items():
                if user["email"] == email:
                    if "LEFT JOIN" in query:
                        users_with_roles = build_users_with_roles()
                        return users_with_roles.get(uid)
                    else:
                        return user
            return None
            
        elif "FROM users u" in query and "WHERE u.id" in query:
            user_id = args[0]
            if "LEFT JOIN" in query:
                users_with_roles = build_users_with_roles()
                return users_with_roles.get(user_id)
            else:
                return users_data.get(user_id)
                
        elif "FROM roles" in query and "INNER JOIN user_roles" in query and "ur.user_id" in query:
            user_id = args[0]
            role_id = user_roles_map.get(user_id)
            if role_id and role_id in roles_data:
                role = roles_data[role_id]
                return {
                    "id": role["id"],
                    "name": role["name"],
                    "description": role["description"],
                }
            return None
            
        elif "FROM roles" in query and "id =" in query:
            role_id = args[0]
            return roles_data.get(role_id)
        elif "FROM roles" in query and "name =" in query:
            role_name = args[0]
            for role in roles_data.values():
                if role["name"] == role_name:
                    return role
            return None
        return None

    # ─── Configurar fetchval (para inserts)
    async def fetchval_side_effect(query: str, *args):
        if "INSERT INTO users" in query:
            new_id = uuid4()
            email = args[0]
            password_hash = args[1]
            password_is_temp = args[2] if len(args) > 2 else False
            users_data[new_id] = {
                "id": new_id,
                "email": email,
                "password": password_hash,
                "status": "ACTIVO",
                "password_is_temp": password_is_temp,
                "created_at": "2026-05-20T10:00:00Z",
                "updated_at": "2026-05-20T10:00:00Z",
            }
            return new_id
        elif "SELECT 1 FROM users" in query:
            email = args[0]
            for user in users_data.values():
                if user["email"] == email:
                    return 1
            return None
        return None

    # ─── Configurar execute (para inserts/updates/deletes)
    async def execute_side_effect(query: str, *args):
        if "INSERT INTO user_roles" in query:
            uid = args[0]
            rid = args[1]
            user_roles_map[uid] = rid
        elif "UPDATE users" in query:
            uid = args[-1] if len(args) > 0 else None
            if uid in users_data:
                if "status =" in query:
                    users_data[uid]["status"] = args[1]
                if "password =" in query:
                    users_data[uid]["password"] = args[0]
                    users_data[uid]["password_is_temp"] = False
        return None

    # ─── Configurar fetch (para queries que retornan lista)
    async def fetch_side_effect(query: str, *args):
        if "SELECT" in query and "FROM users u" in query:
            users_with_roles = build_users_with_roles()
            
            if "WHERE u.status" in query or ("WHERE" in query and "email" not in query and "id" not in query):
                # List con condiciones WHERE
                if "ACTIVO" in query:
                    return [u for u in users_with_roles.values() if u["status"] == "ACTIVO"]
            else:
                # List all
                result = list(users_with_roles.values())
                
                # Aplicar filtro por rol si existe
                if "WHERE r.name" in query or (len(args) > 0 and isinstance(args[0], str)):
                    role_filter = args[0] if args else None
                    if role_filter:
                        result = [u for u in result if u["role_name"] == role_filter]
                
                return result
        
        elif "SELECT" in query and "FROM owners" in query:
            return []  # Sin dueños para tests de permisos
        elif "SELECT" in query and "FROM apartments" in query:
            return []  # Sin departamentos para tests de permisos
        return []

    # ─── Aplicar side effects
    mock_db.fetchrow = AsyncMock(side_effect=fetchrow_side_effect)
    mock_db.fetchval = AsyncMock(side_effect=fetchval_side_effect)
    mock_db.execute = AsyncMock(side_effect=execute_side_effect)
    mock_db.fetch = AsyncMock(side_effect=fetch_side_effect)

    # ─── Transaction context manager
    mock_db.transaction = MagicMock()
    mock_db.transaction.return_value.__aenter__ = AsyncMock(return_value=None)
    mock_db.transaction.return_value.__aexit__ = AsyncMock(return_value=None)

    return mock_db


# ─── FIXTURES: ASYNC HTTP CLIENT ──────────────────────────────────────────────

@pytest_asyncio.fixture
async def async_client(db_with_users: AsyncMock) -> AsyncGenerator[AsyncClient, None]:
    """AsyncClient para hacer peticiones HTTP a la app FastAPI."""
    from app.config.database import get_db as original_get_db

    # Patchear get_db para usar mock_db
    async def get_db_override():
        return db_with_users

    app.dependency_overrides[original_get_db] = get_db_override

    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client

    # Cleanup
    app.dependency_overrides.clear()


# ─── FIXTURES: JWT TOKENS ─────────────────────────────────────────────────────

@pytest.fixture
def admin_token() -> str:
    """JWT token válido para ADMIN."""
    auth_service = AuthService(None, None)
    return auth_service.create_jwt_token(
        user_id=str(ADMIN_USER_ID),
        email=ADMIN_EMAIL,
        role_name="ADMIN",
    )


@pytest.fixture
def propietario_token() -> str:
    """JWT token válido para PROPIETARIO."""
    auth_service = AuthService(None, None)
    return auth_service.create_jwt_token(
        user_id=str(PROPIETARIO_USER_ID),
        email=PROPIETARIO_EMAIL,
        role_name="PROPIETARIO",
    )


@pytest.fixture
def inactive_token() -> str:
    """JWT token para usuario inactivo (será rechazado por get_current_user)."""
    auth_service = AuthService(None, None)
    return auth_service.create_jwt_token(
        user_id=str(INACTIVE_USER_ID),
        email=INACTIVE_EMAIL,
        role_name="PROPIETARIO",
    )


@pytest.fixture
def expired_token() -> str:
    """JWT token expirado."""
    auth_service = AuthService(None, None)
    return auth_service.create_jwt_token(
        user_id=str(ADMIN_USER_ID),
        email=ADMIN_EMAIL,
        role_name="ADMIN",
        expires_hours=-1,  # Ya expirado
    )


# ─── FIXTURES: TEST DATA ──────────────────────────────────────────────────────

@pytest.fixture
def admin_headers(admin_token: str) -> dict:
    """Headers con Authorization para ADMIN."""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def propietario_headers(propietario_token: str) -> dict:
    """Headers con Authorization para PROPIETARIO."""
    return {"Authorization": f"Bearer {propietario_token}"}


@pytest.fixture
def inactive_headers(inactive_token: str) -> dict:
    """Headers con Authorization para usuario inactivo."""
    return {"Authorization": f"Bearer {inactive_token}"}


@pytest.fixture
def expired_headers(expired_token: str) -> dict:
    """Headers con Authorization token expirado."""
    return {"Authorization": f"Bearer {expired_token}"}


@pytest.fixture
def get_db():
    """Fixture para get_db de la app."""
    from app.config.database import get_db as original_get_db
    return original_get_db
