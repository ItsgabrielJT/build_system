from __future__ import annotations

from decimal import Decimal
from uuid import UUID

import asyncpg

from app.models.schemas import ApartmentFeeCreate


class ApartmentFeeRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def get_all(self) -> list[dict]:
        rows = await self._conn.fetch(
            "SELECT * FROM apartment_fees ORDER BY period, apartment_id"
        )
        return [dict(r) for r in rows]

    async def get_by_period(self, period: str) -> list[dict]:
        rows = await self._conn.fetch(
            "SELECT * FROM apartment_fees WHERE period = $1 ORDER BY apartment_id",
            period,
        )
        return [dict(r) for r in rows]

    async def fee_exists(self, apartment_id: UUID, period: str) -> bool:
        row = await self._conn.fetchrow(
            "SELECT 1 FROM apartment_fees WHERE apartment_id = $1 AND period = $2",
            apartment_id,
            period,
        )
        return row is not None

    async def create(self, data: ApartmentFeeCreate) -> dict:
        row = await self._conn.fetchrow(
            """
            INSERT INTO apartment_fees (apartment_id, period, amount)
            VALUES ($1, $2, $3)
            RETURNING *
            """,
            data.apartment_id,
            data.period,
            data.amount,
        )
        return dict(row)

    async def upsert(
        self, apartment_id: UUID, period: str, amount: Decimal
    ) -> tuple[dict, bool]:
        existing = await self._conn.fetchrow(
            "SELECT id FROM apartment_fees WHERE apartment_id = $1 AND period = $2",
            apartment_id,
            period,
        )
        if existing:
            row = await self._conn.fetchrow(
                """
                UPDATE apartment_fees SET amount = $3
                WHERE apartment_id = $1 AND period = $2
                RETURNING *
                """,
                apartment_id,
                period,
                amount,
            )
            return dict(row), False
        else:
            row = await self._conn.fetchrow(
                """
                INSERT INTO apartment_fees (apartment_id, period, amount)
                VALUES ($1, $2, $3)
                RETURNING *
                """,
                apartment_id,
                period,
                amount,
            )
            return dict(row), True
