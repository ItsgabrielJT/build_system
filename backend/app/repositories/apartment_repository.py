from __future__ import annotations

from typing import Optional
from uuid import UUID

import asyncpg

from app.models.schemas import ApartmentCreate, ApartmentUpdate


class ApartmentRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def get_all(self) -> list[dict]:
        rows = await self._conn.fetch(
            """
            SELECT 
                a.id,
                a.code,
                a.floor,
                a.tower,
                a.status,
                a.building_id,
                a.owner_id,
                a.created_at,
                a.updated_at,
                o.full_name as owner_name,
                o.email as owner_email
            FROM apartments a
            LEFT JOIN owners o ON a.owner_id = o.id
            ORDER BY a.code
            """
        )
        return [dict(r) for r in rows]

    async def get_by_id(self, apartment_id: UUID) -> dict | None:
        row = await self._conn.fetchrow(
            """
            SELECT 
                a.*,
                o.full_name as owner_name,
                o.email as owner_email
            FROM apartments a
            LEFT JOIN owners o ON a.owner_id = o.id
            WHERE a.id = $1
            """,
            apartment_id,
        )
        return dict(row) if row else None

    async def code_exists(
        self, code: str, exclude_id: Optional[UUID] = None
    ) -> bool:
        if exclude_id:
            row = await self._conn.fetchrow(
                "SELECT 1 FROM apartments WHERE code = $1 AND id != $2",
                code,
                exclude_id,
            )
        else:
            row = await self._conn.fetchrow(
                "SELECT 1 FROM apartments WHERE code = $1",
                code,
            )
        return row is not None

    async def create(self, data: ApartmentCreate) -> dict:
        row = await self._conn.fetchrow(
            """
            INSERT INTO apartments (code, floor, tower, building_id, owner_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, code, floor, tower, status, building_id, owner_id, created_at, updated_at
            """,
            data.code,
            data.floor,
            data.tower,
            data.building_id,
            data.owner_id,
        )
        return dict(row)

    async def update(self, apartment_id: UUID, data: ApartmentUpdate) -> dict | None:
        row = await self._conn.fetchrow(
            """
            UPDATE apartments SET
                code       = COALESCE($2, code),
                floor      = COALESCE($3, floor),
                tower      = COALESCE($4, tower),
                status     = COALESCE($5, status),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, code, floor, tower, status, building_id, owner_id, created_at, updated_at
            """,
            apartment_id,
            data.code,
            data.floor,
            data.tower,
            data.status,
        )
        return dict(row) if row else None

    async def assign_owner(
        self, apartment_id: UUID, owner_id: UUID, is_primary: bool
    ) -> dict:
        row = await self._conn.fetchrow(
            """
            INSERT INTO owner_apartments (apartment_id, owner_id, is_primary)
            VALUES ($1, $2, $3)
            ON CONFLICT (owner_id, apartment_id) DO UPDATE SET is_primary = EXCLUDED.is_primary
            RETURNING *
            """,
            apartment_id,
            owner_id,
            is_primary,
        )
        return dict(row)

    async def remove_owner(self, apartment_id: UUID, owner_id: UUID) -> bool:
        result = await self._conn.execute(
            "DELETE FROM owner_apartments WHERE apartment_id = $1 AND owner_id = $2",
            apartment_id,
            owner_id,
        )
        return result == "DELETE 1"
