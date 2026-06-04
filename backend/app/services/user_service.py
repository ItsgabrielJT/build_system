"""Servicio para gestión de usuarios."""

from __future__ import annotations

from uuid import UUID

import random
from fastapi import HTTPException, status as fastapi_status

from app.repositories.role_repository import RoleRepository
from app.repositories.user_repository import UserRepository
from app.repositories.owner_repository import OwnerRepository
from app.services.auth_service import AuthService
from app.services.email_service import EmailService


class UserService:
    """Gestión de usuarios: crear, actualizar, cambiar contraseña."""

    def __init__(
        self,
        user_repo: UserRepository,
        role_repo: RoleRepository,
        auth_service: AuthService,
        owner_repo: OwnerRepository | None = None,
    ):
        self.user_repo = user_repo
        self.role_repo = role_repo
        self.auth_service = auth_service
        self.owner_repo = owner_repo

    async def create_user(
        self,
        email: str,
        role_id: UUID,
        password: str | None = None,
        owner_id: UUID | None = None,
    ) -> dict:
        """Crear nuevo usuario."""
        # Validar email único
        if await self.user_repo.email_exists(email):
            raise HTTPException(
                status_code=fastapi_status.HTTP_409_CONFLICT,
                detail="Email ya registrado",
            )

        # Validar rol existe
        role = await self.role_repo.get_role_by_id(role_id)
        if not role:
            raise HTTPException(
                status_code=fastapi_status.HTTP_400_BAD_REQUEST,
                detail="Rol no válido",
            )

        # Generar contraseña temporal si no se proporciona
        password_is_temp = False
        if not password:
            password = "".join(random.choices("0123456789", k=8))
            password_is_temp = True

        # Hashear contraseña
        password_hash = self.auth_service.hash_password(password)

        # Crear usuario
        user_id = await self.user_repo.create(
            email, password_hash, role_id, password_is_temp=password_is_temp
        )

        # Vincular con propietario si se indica
        if owner_id and self.owner_repo:
            await self.owner_repo.link_user(owner_id, user_id)

        # Enviar correo de bienvenida
        await EmailService.send_user_created_email(
            email, password, role["name"]
        )

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
            "password_is_temp": user.get("password_is_temp", False),
            "created_at": user["created_at"],
            "updated_at": user["updated_at"],
        }

    async def get_user_by_id(self, user_id: UUID) -> dict:
        """Obtener usuario con su rol."""
        user = await self.user_repo.get_by_id_with_role(user_id)
        if not user:
            raise HTTPException(
                status_code=fastapi_status.HTTP_404_NOT_FOUND,
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
            "password_is_temp": user.get("password_is_temp", False),
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

    async def get_all_roles(self) -> list[dict]:
        """Obtener todos los roles disponibles."""
        roles = await self.role_repo.list_all_roles()
        return [dict(r) for r in roles]

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
                status_code=fastapi_status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado",
            )

        # Validar rol si se proporciona
        if role_id:
            role = await self.role_repo.get_role_by_id(role_id)
            if not role:
                raise HTTPException(
                    status_code=fastapi_status.HTTP_400_BAD_REQUEST,
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
                status_code=fastapi_status.HTTP_401_UNAUTHORIZED,
                detail="Contraseña actual incorrecta",
            )

        # Hashear nueva contraseña
        new_password_hash = self.auth_service.hash_password(new_password)

        # Actualizar
        await self.user_repo.update_password(user_id, new_password_hash)

        return {"message": "Contraseña actualizada exitosamente"}
