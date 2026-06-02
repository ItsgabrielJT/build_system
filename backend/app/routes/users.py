"""Rutas de gestión de usuarios — crear, listar, actualizar, cambiar contraseña."""

from __future__ import annotations

import logging
from typing import List, Optional
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.config.database import get_db
from app.auth.dependencies import get_current_user, require_admin
from app.models.schemas import (
    ChangePasswordRequest,
    UserCreate,
    UserResponse,
    UserUpdate,
    RoleResponse,
)
from app.repositories.role_repository import RoleRepository
from app.repositories.user_repository import UserRepository
from app.services.auth_service import AuthService
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])
logger = logging.getLogger(__name__)


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def create_user(
    request: UserCreate,
    db: asyncpg.Connection = Depends(get_db),
) -> dict:
    """
    Crear nuevo usuario — SOLO para ADMIN.

    Campos:
    - **email**: email único del usuario
    - **password**: contraseña (mín. 8 chars, mayúscula, minúscula, número)
    - **role_id**: UUID del rol (ADMIN o PROPIETARIO)
    """
    user_repo = UserRepository(db)
    role_repo = RoleRepository(db)
    auth_service = AuthService(user_repo, role_repo)
    user_service = UserService(user_repo, role_repo, auth_service)

    return await user_service.create_user(request.email, request.password, request.role_id)


@router.get("/me", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def get_current_user_profile(
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict:
    """
    Obtener perfil del usuario actual autenticado.

    Retorna: email, rol, status, timestamps.
    """
    user_repo = UserRepository(db)
    role_repo = RoleRepository(db)
    auth_service = AuthService(user_repo, role_repo)
    user_service = UserService(user_repo, role_repo, auth_service)

    return await user_service.get_current_user(current_user["user_id"])


@router.post("/me/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict:
    """
    Cambiar contraseña del usuario actual.

    Campos:
    - **current_password**: contraseña actual (debe ser correcta)
    - **new_password**: nueva contraseña (mín. 8 chars, mayúscula, minúscula, número)
    """
    user_repo = UserRepository(db)
    role_repo = RoleRepository(db)
    auth_service = AuthService(user_repo, role_repo)
    user_service = UserService(user_repo, role_repo, auth_service)

    return await user_service.change_password(
        current_user["user_id"],
        request.current_password,
        request.new_password,
    )


@router.get(
    "",
    response_model=List[UserResponse],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_admin)],
)
async def list_users(
    role: Optional[str] = Query(None, description="Filtrar por nombre de rol (ej: ADMIN)"),
    db: asyncpg.Connection = Depends(get_db),
) -> list:
    """
    Listar todos los usuarios — SOLO para ADMIN.

    Parámetros query:
    - **role**: (opcional) filtrar por rol (ej: ?role=PROPIETARIO)
    """
    user_repo = UserRepository(db)
    role_repo = RoleRepository(db)
    auth_service = AuthService(user_repo, role_repo)
    user_service = UserService(user_repo, role_repo, auth_service)

    return await user_service.list_users(role_filter=role)


@router.get(
    "/roles",
    response_model=List[RoleResponse],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_admin)],
)
async def list_roles(
    db: asyncpg.Connection = Depends(get_db),
) -> list:
    """
    Listar todos los roles disponibles — SOLO para ADMIN.
    """
    user_repo = UserRepository(db)
    role_repo = RoleRepository(db)
    auth_service = AuthService(user_repo, role_repo)
    user_service = UserService(user_repo, role_repo, auth_service)

    return await user_service.get_all_roles()


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_admin)],
)
async def get_user_by_id(
    user_id: UUID,
    db: asyncpg.Connection = Depends(get_db),
) -> dict:
    """
    Obtener usuario por ID — SOLO para ADMIN.

    Path parameters:
    - **user_id**: UUID del usuario
    """
    user_repo = UserRepository(db)
    role_repo = RoleRepository(db)
    auth_service = AuthService(user_repo, role_repo)
    user_service = UserService(user_repo, role_repo, auth_service)

    return await user_service.get_user_by_id(user_id)


@router.put(
    "/{user_id}",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_admin)],
)
async def update_user(
    user_id: UUID,
    request: UserUpdate,
    db: asyncpg.Connection = Depends(get_db),
) -> dict:
    """
    Actualizar usuario (cambiar rol o status) — SOLO para ADMIN.

    Path parameters:
    - **user_id**: UUID del usuario

    Campos:
    - **role_id**: (opcional) nuevo rol
    - **status**: (opcional) nuevo status (ACTIVO, INACTIVO)
    """
    user_repo = UserRepository(db)
    role_repo = RoleRepository(db)
    auth_service = AuthService(user_repo, role_repo)
    user_service = UserService(user_repo, role_repo, auth_service)

    return await user_service.update_user(
        user_id,
        role_id=request.role_id,
        status=request.status,
    )
