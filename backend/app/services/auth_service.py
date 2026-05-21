"""Servicio de autenticación — JWT, hashing, login/logout."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import HTTPException, status

from app.config.settings import settings
from app.models.schemas import TokenPayload
from app.repositories.role_repository import RoleRepository
from app.repositories.user_repository import UserRepository


class AuthService:
    """Gestión de autenticación, tokens JWT y contraseñas."""

    def __init__(self, user_repo: UserRepository, role_repo: RoleRepository):
        self.user_repo = user_repo
        self.role_repo = role_repo

    @staticmethod
    def hash_password(password: str) -> str:
        """Hashear contraseña con bcrypt (10 rounds mínimo)."""
        salt = bcrypt.gensalt(rounds=10)
        return bcrypt.hashpw(password.encode(), salt).decode()

    @staticmethod
    def verify_password(plain_password: str, password_hash: str) -> bool:
        """Verificar contraseña contra hash."""
        try:
            return bcrypt.checkpw(plain_password.encode(), password_hash.encode())
        except Exception:
            return False

    def create_jwt_token(
        self, user_id: str, email: str, role_name: str, expires_hours: Optional[int] = None
    ) -> str:
        """Generar JWT token válido por 24 horas (por defecto)."""
        if expires_hours is None:
            expires_hours = settings.jwt_expiration_hours

        expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_hours)
        payload = {
            "sub": str(user_id),
            "email": email,
            "role": role_name,
            "exp": int(expires_at.timestamp()),
        }

        token = jwt.encode(
            payload,
            settings.jwt_secret,
            algorithm=settings.jwt_algorithm,
        )
        return token

    def decode_jwt_token(self, token: str) -> TokenPayload:
        """Decodificar y validar JWT token."""
        try:
            payload = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=[settings.jwt_algorithm],
            )
            return TokenPayload(**payload)
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token expirado",
            )
        except jwt.InvalidTokenError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido",
            ) from e

    async def authenticate_user(self, email: str, password: str) -> dict:
        """Autenticar usuario con email y contraseña."""
        # Obtener usuario
        user = await self.user_repo.get_by_email(email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas",
            )

        # Verificar status
        if user["status"] != "ACTIVO":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario inactivo",
            )

        # Verificar contraseña
        if not self.verify_password(password, user["password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas",
            )

        # Obtener rol
        role = await self.role_repo.get_user_role(user["id"])
        if not role:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Usuario sin rol asignado",
            )

        return {
            "user_id": user["id"],
            "email": user["email"],
            "role_name": role["name"],
            "role_id": role["id"],
            "status": user["status"],
            "created_at": user["created_at"],
            "updated_at": user["updated_at"],
        }
