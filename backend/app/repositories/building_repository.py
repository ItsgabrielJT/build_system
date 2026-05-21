from __future__ import annotations

from typing import Optional
from uuid import UUID

import asyncpg

from app.models.schemas import BuildingCreate, BuildingUpdate


class BuildingRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def get_all(self) -> list[dict]:
        rows = await self._conn.fetch(
            "SELECT * FROM buildings ORDER BY created_at"
        )
        return [dict(r) for r in rows]

    async def get_by_id(self, building_id: UUID) -> dict | None:
        row = await self._conn.fetchrow(
            "SELECT * FROM buildings WHERE id = $1",
            building_id,
        )
        return dict(row) if row else None

    async def create(self, data: BuildingCreate) -> dict:
        row = await self._conn.fetchrow(
            """
            INSERT INTO buildings (name, address, phone, email)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            """,
            data.name,
            data.address,
            data.phone,
            data.email,
        )
        return dict(row)

    async def update(self, building_id: UUID, data: BuildingUpdate) -> dict | None:
        row = await self._conn.fetchrow(
            """
            UPDATE buildings SET
                name        = COALESCE($2, name),
                address     = COALESCE($3, address),
                phone       = COALESCE($4, phone),
                email       = COALESCE($5, email),
                updated_at  = NOW()
            WHERE id = $1
            RETURNING *
            """,
            building_id,
            data.name,
            data.address,
            data.phone,
            data.email,
        )
        return dict(row)

    async def delete(self, building_id: UUID) -> bool:
        result = await self._conn.execute(
            "DELETE FROM buildings WHERE id = $1",
            building_id,
        )
        return result != "DELETE 0"
