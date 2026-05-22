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
            str(created_by),
        )
        return dict(row)

    async def get_monthly_stats(self, month: str) -> list[dict]:
        rows = await self._conn.fetch(
            """
            SELECT category, SUM(amount) as total
            FROM expenses
            WHERE TO_CHAR(date, 'YYYY-MM') = $1
            GROUP BY category
            ORDER BY total DESC
            """,
            month,
        )
        return [{"category": r["category"] or "Sin categoría", "total": float(r["total"])} for r in rows]

    async def get_chart_data(self) -> dict:
        monthly_rows = await self._conn.fetch("""
            SELECT TO_CHAR(date, 'YYYY-MM') as month, SUM(amount) as total
            FROM expenses
            WHERE date >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
            GROUP BY TO_CHAR(date, 'YYYY-MM')
            ORDER BY month ASC
        """)
        category_rows = await self._conn.fetch("""
            SELECT category, SUM(amount) as total
            FROM expenses
            WHERE date >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
            GROUP BY category
            ORDER BY total DESC
        """)
        return {
            "monthly_trend": [{"month": r["month"], "total": float(r["total"])} for r in monthly_rows],
            "by_category": [{"category": r["category"] or "Sin categoría", "amount": float(r["total"])} for r in category_rows],
        }

    async def get_recent(self, limit: int = 10) -> list[dict]:
        rows = await self._conn.fetch(
            """
            SELECT * FROM expenses
            ORDER BY date DESC, created_at DESC
            LIMIT $1
            """,
            limit,
        )
        return [dict(r) for r in rows]
