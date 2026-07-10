from __future__ import annotations

import asyncpg
from uuid import UUID


class AnnouncementRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def create(self, title: str, description: str) -> dict:
        row = await self._conn.fetchrow(
            """
            INSERT INTO announcements (title, description)
            VALUES ($1, $2)
            RETURNING *
            """,
            title,
            description,
        )
        return dict(row)

    async def get_all(self) -> list[dict]:
        rows = await self._conn.fetch(
            "SELECT * FROM announcements ORDER BY created_at DESC"
        )
        return [dict(r) for r in rows]

    async def get_recent(self, limit: int = 5) -> list[dict]:
        rows = await self._conn.fetch(
            "SELECT * FROM announcements ORDER BY created_at DESC LIMIT $1",
            limit,
        )
        return [dict(r) for r in rows]

    async def get_by_id(self, announcement_id: str) -> dict | None:
        row = await self._conn.fetchrow(
            "SELECT * FROM announcements WHERE id = $1",
            announcement_id,
        )
        return dict(row) if row else None

    async def update(self, announcement_id: UUID, title: str, description: str) -> dict | None:
        row = await self._conn.fetchrow(
            """
            UPDATE announcements
            SET title = $2,
                description = $3
            WHERE id = $1
            RETURNING *
            """,
            announcement_id,
            title,
            description,
        )
        return dict(row) if row else None

    async def delete(self, announcement_id: UUID) -> bool:
        result = await self._conn.execute(
            "DELETE FROM announcements WHERE id = $1",
            announcement_id,
        )
        return result == "DELETE 1"
