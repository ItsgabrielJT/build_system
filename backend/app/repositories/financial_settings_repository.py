from __future__ import annotations

from decimal import Decimal
from typing import Optional

import asyncpg


class FinancialSettingsRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def get_due_day(self) -> int:
        row = await self._conn.fetchrow("SELECT due_day FROM settings ORDER BY created_at ASC LIMIT 1")
        return int(row["due_day"]) if row else 5

    async def update_due_day(self, due_day: int) -> dict:
        row = await self._conn.fetchrow("SELECT id FROM settings ORDER BY created_at ASC LIMIT 1")
        if row:
            updated = await self._conn.fetchrow(
                """
                UPDATE settings
                SET due_day = $2, updated_at = NOW()
                WHERE id = $1
                RETURNING due_day
                """,
                row["id"],
                due_day,
            )
        else:
            updated = await self._conn.fetchrow(
                """
                INSERT INTO settings (building_name, building_address, due_day)
                VALUES ('Edificio Principal', '', $1)
                RETURNING due_day
                """,
                due_day,
            )
        return {"due_day": int(updated["due_day"])}

    async def list_interest_rates(
        self,
        start_period: Optional[str] = None,
        end_period: Optional[str] = None,
    ) -> list[dict]:
        conditions: list[str] = []
        params: list = []
        idx = 1
        if start_period:
            conditions.append(f"period >= ${idx}")
            params.append(start_period)
            idx += 1
        if end_period:
            conditions.append(f"period <= ${idx}")
            params.append(end_period)
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        rows = await self._conn.fetch(
            f"""
            SELECT *
            FROM interest_rates
            {where}
            ORDER BY period DESC
            """,
            *params,
        )
        return [dict(r) for r in rows]

    async def get_interest_rate_map(
        self,
        start_period: Optional[str] = None,
        end_period: Optional[str] = None,
    ) -> dict[str, Decimal]:
        rows = await self.list_interest_rates(start_period, end_period)
        return {
            row["period"]: Decimal(str(row["annual_rate_percent"]))
            for row in rows
        }

    async def upsert_interest_rate(
        self,
        *,
        period: str,
        annual_rate_percent: Decimal,
        source: Optional[str],
        created_by: str,
    ) -> dict:
        row = await self._conn.fetchrow(
            """
            INSERT INTO interest_rates (period, annual_rate_percent, source, created_by)
            VALUES ($1, $2, COALESCE($3, 'Banco Central del Ecuador'), $4)
            ON CONFLICT (period)
            DO UPDATE SET
                annual_rate_percent = EXCLUDED.annual_rate_percent,
                source = EXCLUDED.source,
                updated_at = NOW()
            RETURNING *
            """,
            period,
            annual_rate_percent,
            source,
            created_by,
        )
        return dict(row)
