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

    async def create(
        self,
        data: ExpenseCreate,
        created_by: str,
        receipt_file_name: Optional[str] = None,
        receipt_content_type: Optional[str] = None,
        receipt_storage_path: Optional[str] = None,
    ) -> dict:
        row = await self._conn.fetchrow(
            """
            INSERT INTO expenses (
                date, provider, category, concept, amount, created_by,
                receipt_file_name, receipt_content_type, receipt_storage_path
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
            """,
            data.date,
            data.provider,
            data.category,
            data.concept,
            data.amount,
            str(created_by),
            receipt_file_name,
            receipt_content_type,
            receipt_storage_path,
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

    async def get_stats_by_month(self, month: str) -> list[dict]:
        """Agrupa gastos por categoría para un mes. Retorna [{category, total}]"""
        rows = await self._conn.fetch(
            """
            SELECT category, SUM(amount) as total
            FROM expenses
            WHERE TO_CHAR(date, 'YYYY-MM') = $1
            GROUP BY category
            """,
            month,
        )
        return [{"category": r["category"], "total": r["total"]} for r in rows]

    async def get_monthly_total(self, month: str):
        """Suma total de gastos para un mes."""
        from decimal import Decimal
        row = await self._conn.fetchval(
            """
            SELECT COALESCE(SUM(amount), 0)
            FROM expenses
            WHERE TO_CHAR(date, 'YYYY-MM') = $1
            """,
            month,
        )
        return Decimal(str(row)) if row is not None else Decimal("0")

    async def get_last_6_months_totals(self) -> list[dict]:
        """Totales agrupados por mes de los últimos 6 meses. Retorna [{month, total}]"""
        rows = await self._conn.fetch(
            """
            SELECT TO_CHAR(date, 'YYYY-MM') as month, SUM(amount) as total
            FROM expenses
            WHERE date >= CURRENT_DATE - INTERVAL '6 months'
            GROUP BY TO_CHAR(date, 'YYYY-MM')
            ORDER BY month ASC
            """,
        )
        return [{"month": r["month"], "total": r["total"]} for r in rows]

    async def get_category_totals_last_6_months(self) -> list[dict]:
        """Suma de gastos por categoría de los últimos 6 meses."""
        rows = await self._conn.fetch(
            """
            SELECT category, SUM(amount) as total
            FROM expenses
            WHERE date >= CURRENT_DATE - INTERVAL '6 months'
            GROUP BY category
            ORDER BY total DESC
            """,
        )
        return [{"category": r["category"], "total": r["total"]} for r in rows]

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

    async def get_by_id(self, expense_id: UUID) -> dict | None:
        row = await self._conn.fetchrow(
            "SELECT * FROM expenses WHERE id = $1",
            expense_id,
        )
        return dict(row) if row else None

    async def update(
        self,
        expense_id: UUID,
        data: ExpenseCreate,
        receipt_file_name: Optional[str] = None,
        receipt_content_type: Optional[str] = None,
        receipt_storage_path: Optional[str] = None,
    ) -> dict | None:
        if receipt_file_name:
            row = await self._conn.fetchrow(
                """
                UPDATE expenses
                SET date = $2, provider = $3, category = $4, concept = $5, amount = $6,
                    receipt_file_name = $7, receipt_content_type = $8, receipt_storage_path = $9
                WHERE id = $1
                RETURNING *
                """,
                expense_id,
                data.date,
                data.provider,
                data.category,
                data.concept,
                data.amount,
                receipt_file_name,
                receipt_content_type,
                receipt_storage_path,
            )
        else:
            row = await self._conn.fetchrow(
                """
                UPDATE expenses
                SET date = $2, provider = $3, category = $4, concept = $5, amount = $6
                WHERE id = $1
                RETURNING *
                """,
                expense_id,
                data.date,
                data.provider,
                data.category,
                data.concept,
                data.amount,
            )
        return dict(row) if row else None

    async def delete(self, expense_id: UUID) -> bool:
        result = await self._conn.execute(
            "DELETE FROM expenses WHERE id = $1",
            expense_id,
        )
        return result == "DELETE 1" or result.endswith(" 1")

