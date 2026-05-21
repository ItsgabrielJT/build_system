"""Servicio para gestión de usuarios."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status

from app.repositories.role_repository import RoleRepository
from app.repositories.user_repository import UserRepository
from app.services.auth_service import AuthService


class UserService:
    """Gestión de usuarios: crear, actualizar, cambiar contraseña."""

    def __init__(
        self,
        user_repo: UserRepository,
        role_repo: RoleRepository,
        auth_service: AuthService,
    ):
        self.user_repo = user_repo
        self.role_repo = role_repo
        self.auth_service = auth_service

    async def create_user(
        self, email: str, password: str, role_id: UUID
    ) -> dict:
        """Crear nuevo usuario."""
        # Validar email único
        if await self.user_repo.email_exists(email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email ya registrado",
            )

        # Validar rol existe
        role = await self.role_repo.get_role_by_id(role_id)
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Rol no válido",
            )

        # Hashear contraseña
        password_hash = self.auth_service.hash_password(password)

        # Crear usuario
        user_id = await self.user_repo.create(email, password_hash, role_id)

        # Obtener usuario creado
        user = await self.user_repo.get_by_id_with_role(user_id)

        return {
            "id": user["id"],
            "email": user["email"],
            "role": {
                "id": user["role_id"],
                "name": user["role_name"],
                "description": user["role_description"],
            },
            "status": user["status"],
            "created_at": user["created_at"],
            "updated_at": user["updated_at"],
        }

    async def get_user_by_id(self, user_id: UUID) -> dict:
        """Obtener usuario con su rol."""
        user = await self.user_repo.get_by_id_with_role(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado",
            )

        return {
            "id": user["id"],
            "email": user["email"],
            "role": {
                "id": user["role_id"],
                "name": user["role_name"],
                "description": user["role_description"],
            },
            "status": user["status"],
            "created_at": user["created_at"],
            "updated_at": user["updated_at"],
        }

    async def get_current_user(self, user_id: UUID) -> dict:
        """Obtener usuario actual (para endpoint /me)."""
        return await self.get_user_by_id(user_id)

    async def list_users(self, role_filter: str | None = None) -> list[dict]:
        """Listar usuarios, opcionalmente filtrados por rol."""
        if role_filter:
            users = await self.user_repo.list_by_role(role_filter)
        else:
            users = await self.user_repo.list_all()

        result = []
        for user in users:
            result.append({
                "id": user["id"],
                "email": user["email"],
                "role": {
                    "id": user["role_id"],
                    "name": user["role_name"],
                    "description": user["role_description"],
                },
                "status": user["status"],
                "created_at": user["created_at"],
                "updated_at": user["updated_at"],
            })

        return result

    async def update_user(
        self,
        user_id: UUID,
        role_id: UUID | None = None,
        status: str | None = None,
    ) -> dict:
        """Actualizar usuario (rol, status)."""
        # Verificar usuario existe
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado",
            )

        # Validar rol si se proporciona
        if role_id:
            role = await self.role_repo.get_role_by_id(role_id)
            if not role:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Rol no válido",
                )

        # Actualizar
        await self.user_repo.update(user_id, role_id=role_id, status=status)

        # Retornar usuario actualizado
        return await self.get_user_by_id(user_id)

    async def change_password(
        self, user_id: UUID, current_password: str, new_password: str
    ) -> dict:
        """Cambiar contraseña del usuario."""
        # Obtener usuario
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado",
            )

        # Verificar contraseña actual
        if not self.auth_service.verify_password(
            current_password, user["password"]
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Contraseña actual incorrecta",
            )

        # Hashear nueva contraseña
        new_password_hash = self.auth_service.hash_password(new_password)

        # Actualizar
        await self.user_repo.update_password(user_id, new_password_hash)

        return {"message": "Contraseña actualizada exitosamente"}
