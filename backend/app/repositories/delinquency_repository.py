from __future__ import annotations

from typing import Optional
from uuid import UUID

import asyncpg

_PERIOD_DATA_QUERY = """
    WITH all_periods AS (
        SELECT apartment_id, period FROM apartment_fees
        UNION
        SELECT apartment_id, period FROM payments
        UNION
        SELECT apartment_id, period FROM fines
    )
    SELECT
        o.id           AS owner_id,
        o.full_name,
        o.email,
        o.document_id,
        a.id           AS apartment_id,
        a.code         AS apartment_code,
        a.floor,
        ap.period,
        COALESCE(af.amount, 0)                                                     AS esperado,
        COALESCE(SUM(CASE WHEN f.status  = 'ACTIVA'     THEN f.amount ELSE 0 END), 0) AS multas,
        COALESCE(SUM(CASE WHEN p.status  = 'REGISTRADO' THEN p.amount ELSE 0 END), 0) AS pagado
    FROM owners o
    JOIN owner_apartments oa ON o.id = oa.owner_id
    JOIN apartments        a  ON oa.apartment_id = a.id
    JOIN all_periods       ap ON ap.apartment_id = a.id
    LEFT JOIN apartment_fees af ON af.apartment_id = a.id AND af.period = ap.period
    LEFT JOIN fines          f  ON  f.apartment_id = a.id AND  f.period = ap.period
    LEFT JOIN payments       p  ON  p.apartment_id = a.id AND  p.period = ap.period
    WHERE o.status = 'ACTIVO'
"""


class DelinquencyRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    _GROUP_ALL = (
        " GROUP BY o.id, o.full_name, o.email, o.document_id,"
        " a.id, a.code, a.floor, ap.period, af.amount"
    )

    async def get_all_period_data(self) -> list[dict]:
        query = _PERIOD_DATA_QUERY + self._GROUP_ALL + " ORDER BY o.id, a.id, ap.period"
        rows = await self._conn.fetch(query)
        return [dict(r) for r in rows]

    async def get_active_apartment_count(self) -> int:
        row = await self._conn.fetchrow(
            """
            SELECT COUNT(*) AS total
            FROM apartments
            WHERE status IN ('ACTIVA', 'ACTIVO')
            """
        )
        return int(row["total"] or 0) if row else 0

    async def get_period_data_for_owner(self, owner_id: UUID) -> list[dict]:
        query = (
            _PERIOD_DATA_QUERY
            + " AND o.id = $1"
            + self._GROUP_ALL
            + " ORDER BY a.code, ap.period"
        )
        rows = await self._conn.fetch(query, owner_id)
        return [dict(r) for r in rows]

    async def get_statement_data(
        self,
        owner_id: UUID,
        start_period: Optional[str],
        end_period: Optional[str],
    ) -> list[dict]:
        params: list = [owner_id]
        idx = 2
        extra = " AND o.id = $1"

        if start_period:
            extra += f" AND ap.period >= ${idx}"
            params.append(start_period)
            idx += 1
        if end_period:
            extra += f" AND ap.period <= ${idx}"
            params.append(end_period)
            idx += 1

        query = (
            _PERIOD_DATA_QUERY
            + extra
            + self._GROUP_ALL
            + " ORDER BY ap.period, a.code"
        )
        rows = await self._conn.fetch(query, *params)
        return [dict(r) for r in rows]
