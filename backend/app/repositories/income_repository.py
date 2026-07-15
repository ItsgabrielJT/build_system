from __future__ import annotations

from datetime import date
from typing import Optional
from uuid import UUID

import asyncpg

from app.models.schemas import IncomeCreate


class IncomeRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def get_all(
        self,
        period: Optional[str] = None,
        status: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> list[dict]:
        conditions: list[str] = []
        params: list = []
        idx = 1

        if period:
            conditions.append(f"COALESCE(i.period, TO_CHAR(i.date, 'YYYY-MM')) = ${idx}")
            params.append(period)
            idx += 1
        if status:
            conditions.append(f"i.status = ${idx}")
            params.append(status)
            idx += 1
        if start_date:
            conditions.append(f"i.date >= ${idx}")
            params.append(start_date)
            idx += 1
        if end_date:
            conditions.append(f"i.date <= ${idx}")
            params.append(end_date)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        rows = await self._conn.fetch(
            f"""
            SELECT
                i.*,
                a.code AS apartment_code,
                o.full_name AS owner_name
            FROM incomes i
            LEFT JOIN apartments a ON i.apartment_id = a.id
            LEFT JOIN owners o ON i.owner_id = o.id
            {where}
            ORDER BY i.date DESC, i.created_at DESC
            """,
            *params,
        )
        return [dict(row) for row in rows]

    async def get_by_id(self, income_id: UUID) -> dict | None:
        row = await self._conn.fetchrow(
            """
            SELECT
                i.*,
                a.code AS apartment_code,
                o.full_name AS owner_name
            FROM incomes i
            LEFT JOIN apartments a ON i.apartment_id = a.id
            LEFT JOIN owners o ON i.owner_id = o.id
            WHERE i.id = $1
            """,
            income_id,
        )
        return dict(row) if row else None

    async def create(self, data: IncomeCreate, created_by: str) -> dict:
        row = await self._conn.fetchrow(
            """
            INSERT INTO incomes (
                date, concept, amount, source, category, method, reference,
                period, apartment_id, owner_id, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
            """,
            data.date,
            data.concept,
            data.amount,
            data.source,
            data.category,
            data.method,
            data.reference,
            data.period,
            data.apartment_id,
            data.owner_id,
            str(created_by),
        )
        return dict(row)

    async def update_status(self, income_id: UUID, status: str) -> dict | None:
        row = await self._conn.fetchrow(
            """
            UPDATE incomes
            SET status = $2, updated_at = NOW()
            WHERE id = $1
            RETURNING *
            """,
            income_id,
            status,
        )
        return dict(row) if row else None

    async def delete(self, income_id: UUID) -> bool:
        result = await self._conn.execute(
            "DELETE FROM incomes WHERE id = $1",
            income_id,
        )
        return result == "DELETE 1"
