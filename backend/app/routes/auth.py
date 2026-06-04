"""Rutas de autenticación — login, logout."""

from __future__ import annotations

import logging
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from app.config.database import get_db
from app.auth.dependencies import get_current_user
from app.models.schemas import (
    LoginRequest,
    LoginResponse,
    PasswordRecoveryRequest,
    PasswordRecoveryResponse,
    UserResponse,
)
from app.repositories.role_repository import RoleRepository
from app.repositories.user_repository import UserRepository
from app.services.auth_service import AuthService
from app.services.user_service import UserService

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def login(
    request: LoginRequest,
    db: asyncpg.Connection = Depends(get_db),
) -> dict:
    """
    Endpoint de login — autentica usuario y retorna JWT token.

    - **email**: email del usuario
    - **password**: contraseña del usuario

    Retorna token JWT válido por 24 horas.
    """
    # Instanciar servicios
    user_repo = UserRepository(db)
    role_repo = RoleRepository(db)
    auth_service = AuthService(user_repo, role_repo)

    # Autenticar usuario
    auth_result = await auth_service.authenticate_user(request.email, request.password)

    # Generar JWT token
    token = auth_service.create_jwt_token(
        user_id=str(auth_result["user_id"]),
        email=auth_result["email"],
        role_name=auth_result["role_name"],
    )

    # Obtener datos del usuario
    user = await user_repo.get_by_id_with_role(auth_result["user_id"])

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "role": {
                "id": user["role_id"],
                "name": user["role_name"],
                "description": user["role_description"],
            },
            "status": user["status"],
            "password_is_temp": user.get("password_is_temp", False),
            "created_at": user["created_at"],
            "updated_at": user["updated_at"],
        },
    }


@router.post(
    "/forgot-password",
    response_model=PasswordRecoveryResponse,
    status_code=status.HTTP_200_OK,
)
async def forgot_password(
    request: PasswordRecoveryRequest,
    db: asyncpg.Connection = Depends(get_db),
) -> dict:
    """
    Solicita recuperación de contraseña.

    La respuesta es siempre genérica para no revelar si un correo existe.
    """
    user_repo = UserRepository(db)
    role_repo = RoleRepository(db)
    auth_service = AuthService(user_repo, role_repo)
    user_service = UserService(user_repo, role_repo, auth_service)

    logger.info("Solicitud de recuperación de contraseña para correo %s", request.email)
    
    return await user_service.recover_password(request.email)


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    user: dict = Depends(get_current_user),
) -> dict:
    """
    Endpoint de logout — cierra sesión del usuario.

    Nota: En esta implementación básica, el logout es informativo.
    Para invalidar tokens, se puede implementar un sistema de blacklist en futuras versiones.
    """
    logger.info(f"Usuario {user['email']} cerró sesión")
    return {"message": "Sesión cerrada exitosamente"}
