from __future__ import annotations

from typing import Optional

import asyncpg

from app.models.schemas import ExpenseCreate


class ExpenseRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def get_by_month(self, month: Optional[str] = None) -> list[dict]:
        if month:
            rows = await self._conn.fetch(
                """
                SELECT * FROM expenses
                WHERE TO_CHAR(date, 'YYYY-MM') = $1
                ORDER BY date DESC
                """,
                month,
            )
        else:
            rows = await self._conn.fetch(
                "SELECT * FROM expenses ORDER BY date DESC"
            )
        return [dict(r) for r in rows]

    async def create(self, data: ExpenseCreate, created_by: str) -> dict:
        row = await self._conn.fetchrow(
            """
            INSERT INTO expenses (date, provider, category, concept, amount, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            """,
            data.date,
            data.provider,
            data.category,
            data.concept,
            data.amount,
            created_by,
        )
        return dict(row)
