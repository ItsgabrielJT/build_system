from __future__ import annotations

from typing import Optional
from uuid import UUID

import asyncpg

from app.models.schemas import PaymentCreate


class PaymentRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def get_all(
        self,
        period: Optional[str] = None,
        owner_id: Optional[UUID] = None,
        status: Optional[str] = None,
    ) -> list[dict]:
        conditions: list[str] = []
        params: list = []
        idx = 1

        if period:
            conditions.append(f"p.period = ${idx}")
            params.append(period)
            idx += 1
        if owner_id:
            conditions.append(f"p.owner_id = ${idx}")
            params.append(owner_id)
            idx += 1
        if status:
            conditions.append(f"p.status = ${idx}")
            params.append(status)
            idx += 1

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        query = f"""
            SELECT p.*, a.code AS apartment_code, o.full_name AS owner_name
            FROM payments p
            JOIN apartments a ON p.apartment_id = a.id
            JOIN owners o ON p.owner_id = o.id
            {where}
            ORDER BY p.created_at DESC
        """
        rows = await self._conn.fetch(query, *params)
        return [dict(r) for r in rows]

    async def get_by_id(self, payment_id: UUID) -> dict | None:
        row = await self._conn.fetchrow(
            """
            SELECT p.*, a.code AS apartment_code, o.full_name AS owner_name
            FROM payments p
            JOIN apartments a ON p.apartment_id = a.id
            JOIN owners o ON p.owner_id = o.id
            WHERE p.id = $1
            """,
            payment_id,
        )
        return dict(row) if row else None

    async def create(self, data: PaymentCreate, created_by: str) -> dict:
        row = await self._conn.fetchrow(
            """
            INSERT INTO payments
                (apartment_id, owner_id, period, paid_at, amount, method, reference, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            """,
            data.apartment_id,
            data.owner_id,
            data.period,
            data.paid_at,
            data.amount,
            data.method,
            data.reference,
            str(created_by),
        )
        return dict(row)

    async def update_status(self, payment_id: UUID, new_status: str) -> dict | None:
        row = await self._conn.fetchrow(
            """
            UPDATE payments SET status = $2, updated_at = NOW()
            WHERE id = $1
            RETURNING *
            """,
            payment_id,
            new_status,
        )
        return dict(row) if row else None
