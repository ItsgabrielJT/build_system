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
        owner_id: Optional[UUID] = None,
        reason: Optional[str] = None,
        search: Optional[str] = None,
        start_date=None,
        end_date=None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
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
        if owner_id:
            conditions.append(f"f.owner_id = ${idx}")
            params.append(owner_id)
            idx += 1
        if reason:
            conditions.append(f"f.reason = ${idx}")
            params.append(reason)
            idx += 1
        if search:
            conditions.append(
                f"(LOWER(COALESCE(f.reason, '')) LIKE ${idx} "
                f"OR LOWER(a.code) LIKE ${idx} "
                f"OR LOWER(o.full_name) LIKE ${idx})"
            )
            params.append(f"%{search.lower()}%")
            idx += 1
        if start_date:
            conditions.append(f"f.issued_at >= ${idx}")
            params.append(start_date)
            idx += 1
        if end_date:
            conditions.append(f"f.issued_at <= ${idx}")
            params.append(end_date)
            idx += 1

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        pagination = ""
        if limit is not None:
            pagination = f"LIMIT ${idx}"
            params.append(limit)
            idx += 1
            if offset is not None:
                pagination += f" OFFSET ${idx}"
                params.append(offset)
                idx += 1

        query = f"""
            SELECT f.*, a.code AS apartment_code, o.full_name AS owner_name
            FROM fines f
            JOIN apartments a ON f.apartment_id = a.id
            JOIN owners o ON f.owner_id = o.id
            {where}
            ORDER BY f.created_at DESC
            {pagination}
        """
        rows = await self._conn.fetch(query, *params)
        return [dict(r) for r in rows]

    async def count_all(
        self,
        period: Optional[str] = None,
        status: Optional[str] = None,
        owner_id: Optional[UUID] = None,
        reason: Optional[str] = None,
        search: Optional[str] = None,
        start_date=None,
        end_date=None,
    ) -> int:
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
        if owner_id:
            conditions.append(f"f.owner_id = ${idx}")
            params.append(owner_id)
            idx += 1
        if reason:
            conditions.append(f"f.reason = ${idx}")
            params.append(reason)
            idx += 1
        if search:
            conditions.append(
                f"(LOWER(COALESCE(f.reason, '')) LIKE ${idx} "
                f"OR LOWER(a.code) LIKE ${idx} "
                f"OR LOWER(o.full_name) LIKE ${idx})"
            )
            params.append(f"%{search.lower()}%")
            idx += 1
        if start_date:
            conditions.append(f"f.issued_at >= ${idx}")
            params.append(start_date)
            idx += 1
        if end_date:
            conditions.append(f"f.issued_at <= ${idx}")
            params.append(end_date)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        query = f"""
            SELECT COUNT(*)
            FROM fines f
            JOIN apartments a ON f.apartment_id = a.id
            JOIN owners o ON f.owner_id = o.id
            {where}
        """
        return int(await self._conn.fetchval(query, *params) or 0)

    async def get_stats(
        self,
        period: Optional[str] = None,
        status: Optional[str] = None,
        owner_id: Optional[UUID] = None,
        reason: Optional[str] = None,
        search: Optional[str] = None,
        start_date=None,
        end_date=None,
    ) -> dict:
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
        if owner_id:
            conditions.append(f"f.owner_id = ${idx}")
            params.append(owner_id)
            idx += 1
        if reason:
            conditions.append(f"f.reason = ${idx}")
            params.append(reason)
            idx += 1
        if search:
            conditions.append(
                f"(LOWER(COALESCE(f.reason, '')) LIKE ${idx} "
                f"OR LOWER(a.code) LIKE ${idx} "
                f"OR LOWER(o.full_name) LIKE ${idx})"
            )
            params.append(f"%{search.lower()}%")
            idx += 1
        if start_date:
            conditions.append(f"f.issued_at >= ${idx}")
            params.append(start_date)
            idx += 1
        if end_date:
            conditions.append(f"f.issued_at <= ${idx}")
            params.append(end_date)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        totals = await self._conn.fetchrow(
            f"""
            SELECT
                COUNT(*)::int AS total_count,
                COALESCE(SUM(f.amount), 0)::numeric AS total_amount,
                COUNT(*) FILTER (WHERE f.status = 'ACTIVA')::int AS active_count,
                COALESCE(SUM(f.amount) FILTER (WHERE f.status = 'ACTIVA'), 0)::numeric AS active_amount,
                COUNT(*) FILTER (WHERE f.status = 'ANULADA')::int AS annulled_count,
                COALESCE(SUM(f.amount) FILTER (WHERE f.status = 'ANULADA'), 0)::numeric AS annulled_amount
            FROM fines f
            JOIN apartments a ON f.apartment_id = a.id
            JOIN owners o ON f.owner_id = o.id
            {where}
            """,
            *params,
        )
        status_rows = await self._conn.fetch(
            f"""
            SELECT f.status, COUNT(*)::int AS count, COALESCE(SUM(f.amount), 0)::numeric AS amount
            FROM fines f
            JOIN apartments a ON f.apartment_id = a.id
            JOIN owners o ON f.owner_id = o.id
            {where}
            GROUP BY f.status
            ORDER BY count DESC
            """,
            *params,
        )
        monthly_rows = await self._conn.fetch(
            f"""
            SELECT f.period, COUNT(*)::int AS count, COALESCE(SUM(f.amount), 0)::numeric AS amount
            FROM fines f
            JOIN apartments a ON f.apartment_id = a.id
            JOIN owners o ON f.owner_id = o.id
            {where}
            GROUP BY f.period
            ORDER BY f.period DESC
            LIMIT 6
            """,
            *params,
        )
        reason_rows = await self._conn.fetch(
            f"""
            SELECT COALESCE(NULLIF(TRIM(f.reason), ''), 'Sin motivo') AS reason,
                   COUNT(*)::int AS count,
                   COALESCE(SUM(f.amount), 0)::numeric AS amount
            FROM fines f
            JOIN apartments a ON f.apartment_id = a.id
            JOIN owners o ON f.owner_id = o.id
            {where}
            GROUP BY COALESCE(NULLIF(TRIM(f.reason), ''), 'Sin motivo')
            ORDER BY count DESC, amount DESC
            LIMIT 8
            """,
            *params,
        )

        return {
            "totals": dict(totals) if totals else {},
            "status": [dict(row) for row in status_rows],
            "monthly": [dict(row) for row in reversed(monthly_rows)],
            "reasons": [dict(row) for row in reason_rows],
        }

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
