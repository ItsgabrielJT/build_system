from __future__ import annotations

from typing import Optional
from uuid import UUID

import asyncpg

from app.models.schemas import FineCreate


class FineRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def get_all(
        self,
        period: Optional[str] = None,
        status: Optional[str] = None,
    ) -> list[dict]:
        conditions: list[str] = []
        params: list = []
        idx = 1

        if period:
            conditions.append(f"f.period = ${idx}")
            params.append(period)
            idx += 1
        if status:
            conditions.append(f"f.status = ${idx}")
            params.append(status)
            idx += 1

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        query = f"""
            SELECT f.*, a.code AS apartment_code, o.full_name AS owner_name
            FROM fines f
            JOIN apartments a ON f.apartment_id = a.id
            JOIN owners o ON f.owner_id = o.id
            {where}
            ORDER BY f.created_at DESC
        """
        rows = await self._conn.fetch(query, *params)
        return [dict(r) for r in rows]

    async def get_by_id(self, fine_id: UUID) -> dict | None:
        row = await self._conn.fetchrow(
            """
            SELECT f.*, a.code AS apartment_code, o.full_name AS owner_name
            FROM fines f
            JOIN apartments a ON f.apartment_id = a.id
            JOIN owners o ON f.owner_id = o.id
            WHERE f.id = $1
            """,
            fine_id,
        )
        return dict(row) if row else None

    async def create(self, data: FineCreate, created_by: str) -> dict:
        row = await self._conn.fetchrow(
            """
            INSERT INTO fines
                (apartment_id, owner_id, period, issued_at, reason, amount, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            """,
            data.apartment_id,
            data.owner_id,
            data.period,
            data.issued_at,
            data.reason,
            data.amount,
            str(created_by),
        )
        return dict(row)

    async def update_status(self, fine_id: UUID, new_status: str) -> dict | None:
        row = await self._conn.fetchrow(
            """
            UPDATE fines SET status = $2, updated_at = NOW()
            WHERE id = $1
            RETURNING *
            """,
            fine_id,
            new_status,
        )
        return dict(row) if row else None
