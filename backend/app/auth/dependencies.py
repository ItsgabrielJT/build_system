"""Dependencias de autenticación — JWT local, validación de permisos."""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import asyncpg

from app.config.database import get_db
from app.config.settings import settings
from app.models.schemas import TokenPayload
from app.repositories.role_repository import RoleRepository
from app.services.auth_service import AuthService

security = HTTPBearer()
logger = logging.getLogger(__name__)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: asyncpg.Connection = Depends(get_db),
) -> dict:
    """Validar JWT token y retornar usuario actual."""
    token = credentials.credentials

    # Decodificar token
    auth_service = AuthService(None, None)
    try:
        payload = auth_service.decode_jwt_token(token)
    except HTTPException:
        raise

    # Obtener usuario de BD para verificar status
    query = """
        SELECT u.id, u.email, u.status
        FROM users u
        WHERE u.id = $1
    """
    user = await db.fetchrow(query, UUID(payload.sub))

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado",
        )

    if user["status"] != "ACTIVO":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario inactivo",
        )

    return {
        "user_id": user["id"],
        "email": user["email"],
        "role": payload.role,
    }


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Verificar que usuario tiene rol ADMIN."""
    if user.get("role") != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permisos para esta acción",
        )
    return user


def require_owner(user: dict = Depends(get_current_user)) -> dict:
    """Verificar que usuario tiene rol PROPIETARIO."""
    if user.get("role") != "PROPIETARIO":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permisos para esta acción",
        )
    return user


def require_authenticated(user: dict = Depends(get_current_user)) -> dict:
    """Verificar que usuario está autenticado."""
    return user


async def require_permission(
    permission_name: str,
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict:
    """Verificar que usuario tiene permiso específico."""
    role_repo = RoleRepository(db)
    has_perm = await role_repo.has_permission(user["user_id"], permission_name)

    if not has_perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permisos para esta acción",
        )

    return user

