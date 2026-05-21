"""Repository para operaciones con roles y permisos."""

from __future__ import annotations

from uuid import UUID

import asyncpg


class RoleRepository:
    """Acceso a datos de roles y permisos."""

    def __init__(self, db: asyncpg.Connection):
        self.db = db

    async def get_role_by_name(self, name: str) -> dict | None:
        """Obtener rol por nombre."""
        query = """
            SELECT id, name, description
            FROM roles
            WHERE name = $1
        """
        return await self.db.fetchrow(query, name)

    async def get_role_by_id(self, role_id: UUID) -> dict | None:
        """Obtener rol por ID."""
        query = """
            SELECT id, name, description
            FROM roles
            WHERE id = $1
        """
        return await self.db.fetchrow(query, role_id)

    async def get_user_role(self, user_id: UUID) -> dict | None:
        """Obtener el rol de un usuario."""
        query = """
            SELECT r.id, r.name, r.description
            FROM roles r
            INNER JOIN user_roles ur ON r.id = ur.role_id
            WHERE ur.user_id = $1
        """
        return await self.db.fetchrow(query, user_id)

    async def get_role_permissions(self, role_id: UUID) -> list[dict]:
        """Obtener permisos asignados a un rol."""
        query = """
            SELECT 
                p.id, p.name, p.resource, p.action, p.description
            FROM permissions p
            INNER JOIN role_permissions rp ON p.id = rp.permission_id
            WHERE rp.role_id = $1
        """
        return await self.db.fetch(query, role_id)

    async def has_permission(self, user_id: UUID, permission_name: str) -> bool:
        """Verificar si usuario tiene permisos específico."""
        query = """
            SELECT 1
            FROM permissions p
            INNER JOIN role_permissions rp ON p.id = rp.permission_id
            INNER JOIN roles r ON rp.role_id = r.id
            INNER JOIN user_roles ur ON r.id = ur.role_id
            WHERE ur.user_id = $1 AND p.name = $2
        """
        result = await self.db.fetchval(query, user_id, permission_name)
        return result is not None

    async def get_permission_by_name(self, name: str) -> dict | None:
        """Obtener permiso por nombre."""
        query = """
            SELECT id, name, resource, action, description
            FROM permissions
            WHERE name = $1
        """
        return await self.db.fetchrow(query, name)

    async def list_all_roles(self) -> list[dict]:
        """Listar todos los roles."""
        query = """
            SELECT id, name, description
            FROM roles
            ORDER BY name
        """
        return await self.db.fetch(query)

    async def list_all_permissions(self) -> list[dict]:
        """Listar todos los permisos."""
        query = """
            SELECT id, name, resource, action, description
            FROM permissions
            ORDER BY resource, action
        """
        return await self.db.fetch(query)
