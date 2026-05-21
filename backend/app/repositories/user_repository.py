"""Repository para operaciones CRUD de usuarios."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

import asyncpg


class UserRepository:
    """Acceso a datos de usuarios en PostgreSQL."""

    def __init__(self, db: asyncpg.Connection):
        self.db = db

    async def get_by_email(self, email: str) -> dict | None:
        """Obtener usuario por email."""
        query = """
            SELECT u.id, u.email, u.password, u.status, u.created_at, u.updated_at
            FROM users u
            WHERE u.email = $1
        """
        return await self.db.fetchrow(query, email)

    async def get_by_id(self, user_id: UUID) -> dict | None:
        """Obtener usuario por ID."""
        query = """
            SELECT u.id, u.email, u.password, u.status, u.created_at, u.updated_at
            FROM users u
            WHERE u.id = $1
        """
        return await self.db.fetchrow(query, user_id)

    async def get_by_id_with_role(self, user_id: UUID) -> dict | None:
        """Obtener usuario con su rol."""
        query = """
            SELECT 
                u.id, u.email, u.password, u.status, u.created_at, u.updated_at,
                r.id as role_id, r.name as role_name, r.description as role_description
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            WHERE u.id = $1
        """
        return await self.db.fetchrow(query, user_id)

    async def create(
        self, email: str, password_hash: str, role_id: UUID
    ) -> UUID:
        """Crear nuevo usuario y asignar rol."""
        async with self.db.transaction():
            query = """
                INSERT INTO users (email, password, status)
                VALUES ($1, $2, 'ACTIVO')
                RETURNING id
            """
            user_id = await self.db.fetchval(query, email, password_hash)

            # Asignar rol al usuario
            role_query = """
                INSERT INTO user_roles (user_id, role_id)
                VALUES ($1, $2)
            """
            await self.db.execute(role_query, user_id, role_id)

        return user_id

    async def update(
        self, user_id: UUID, role_id: Optional[UUID] = None, status: Optional[str] = None
    ) -> bool:
        """Actualizar usuario (rol, status)."""
        updates = []
        params = [user_id]
        param_idx = 2

        if status is not None:
            updates.append(f"status = ${param_idx}")
            params.append(status)
            param_idx += 1

        if not updates:
            return True

        # Actualizar tabla users
        query = f"""
            UPDATE users
            SET {', '.join(updates)}, updated_at = NOW()
            WHERE id = $1
        """
        await self.db.execute(query, *params)

        # Si hay cambio de rol
        if role_id is not None:
            await self.db.execute(
                "DELETE FROM user_roles WHERE user_id = $1",
                user_id
            )
            await self.db.execute(
                "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)",
                user_id,
                role_id
            )

        return True

    async def update_password(self, user_id: UUID, new_password_hash: str) -> bool:
        """Actualizar contraseña de usuario."""
        query = """
            UPDATE users
            SET password = $1, updated_at = NOW()
            WHERE id = $2
        """
        await self.db.execute(query, new_password_hash, user_id)
        return True

    async def list_all(self) -> list[dict]:
        """Listar todos los usuarios con sus roles."""
        query = """
            SELECT 
                u.id, u.email, u.status, u.created_at, u.updated_at,
                r.id as role_id, r.name as role_name, r.description as role_description
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            ORDER BY u.created_at DESC
        """
        return await self.db.fetch(query)

    async def list_by_role(self, role_name: str) -> list[dict]:
        """Listar usuarios por rol."""
        query = """
            SELECT 
                u.id, u.email, u.status, u.created_at, u.updated_at,
                r.id as role_id, r.name as role_name, r.description as role_description
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            WHERE r.name = $1
            ORDER BY u.created_at DESC
        """
        return await self.db.fetch(query, role_name)

    async def email_exists(self, email: str) -> bool:
        """Verificar si email ya existe."""
        query = "SELECT 1 FROM users WHERE email = $1"
        result = await self.db.fetchval(query, email)
        return result is not None
