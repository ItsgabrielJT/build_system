from __future__ import annotations

import asyncpg
from typing import Optional


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
