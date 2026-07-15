from __future__ import annotations

from decimal import Decimal
from typing import Optional
from uuid import UUID

import asyncpg

from app.models.schemas import ApartmentCreate, ApartmentUpdate


class ApartmentRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def get_all(self) -> list[dict]:
        rows = await self._conn.fetch(
            """
            SELECT
                a.id,
                a.code,
                a.floor,
                a.tower,
                CASE
                    WHEN a.status = 'MANTENIMIENTO' THEN 'MANTENIMIENTO'
                    WHEN oa.owner_id IS NULL THEN 'VACANTE'
                    ELSE 'OCUPADO'
                END AS status,
                a.building_id,
                oa.owner_id                                 AS owner_id,
                a.created_at,
                a.updated_at,
                o.full_name                                 AS owner_name,
                o.email                                     AS owner_email,
                COALESCE(o.allocated_quota_percent, 0.0)    AS owner_allocated_quota_percent
            FROM apartments a
            LEFT JOIN (
                SELECT DISTINCT ON (apartment_id) apartment_id, owner_id
                FROM owner_apartments
                WHERE is_primary = TRUE
                ORDER BY apartment_id, assigned_at DESC
            ) oa ON a.id = oa.apartment_id
            LEFT JOIN owners o ON oa.owner_id = o.id
            ORDER BY a.code
            """
        )
        return [dict(r) for r in rows]

    async def get_by_id(self, apartment_id: UUID) -> dict | None:
        row = await self._conn.fetchrow(
            """
            SELECT
                a.id,
                a.code,
                a.floor,
                a.tower,
                CASE
                    WHEN a.status = 'MANTENIMIENTO' THEN 'MANTENIMIENTO'
                    WHEN oa.owner_id IS NULL THEN 'VACANTE'
                    ELSE 'OCUPADO'
                END AS status,
                a.building_id,
                oa.owner_id                                 AS owner_id,
                a.created_at,
                a.updated_at,
                o.full_name                                 AS owner_name,
                o.email                                     AS owner_email,
                COALESCE(o.allocated_quota_percent, 0.0)    AS owner_allocated_quota_percent
            FROM apartments a
            LEFT JOIN (
                SELECT DISTINCT ON (apartment_id) apartment_id, owner_id
                FROM owner_apartments
                WHERE is_primary = TRUE
                ORDER BY apartment_id, assigned_at DESC
            ) oa ON a.id = oa.apartment_id
            LEFT JOIN owners o ON oa.owner_id = o.id
            WHERE a.id = $1
            """,
            apartment_id,
        )
        return dict(row) if row else None

    async def code_exists(
        self, code: str, exclude_id: Optional[UUID] = None
    ) -> bool:
        if exclude_id:
            row = await self._conn.fetchrow(
                "SELECT 1 FROM apartments WHERE code = $1 AND id != $2",
                code,
                exclude_id,
            )
        else:
            row = await self._conn.fetchrow(
                "SELECT 1 FROM apartments WHERE code = $1",
                code,
            )
        return row is not None

    async def create(self, data: ApartmentCreate) -> dict:
        row = await self._conn.fetchrow(
            """
            INSERT INTO apartments (code, floor, tower, building_id)
            VALUES ($1, $2, $3, $4)
            RETURNING id, code, floor, tower, status, building_id, created_at, updated_at
            """,
            data.code,
            data.floor,
            data.tower,
            data.building_id,
        )
        return dict(row)

    async def update(self, apartment_id: UUID, data: ApartmentUpdate) -> dict | None:
        row = await self._conn.fetchrow(
            """
            UPDATE apartments SET
                code       = COALESCE($2, code),
                floor      = COALESCE($3, floor),
                tower      = COALESCE($4, tower),
                status     = COALESCE($5, status),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, code, floor, tower, status, building_id, created_at, updated_at
            """,
            apartment_id,
            data.code,
            data.floor,
            data.tower,
            data.status,
        )
        return dict(row) if row else None

    async def assign_owner(
        self, apartment_id: UUID, owner_id: UUID, is_primary: bool
    ) -> dict:
        if is_primary:
            await self._conn.execute(
                "UPDATE owner_apartments SET is_primary = FALSE WHERE apartment_id = $1 AND owner_id != $2",
                apartment_id,
                owner_id,
            )
        row = await self._conn.fetchrow(
            """
            INSERT INTO owner_apartments (apartment_id, owner_id, is_primary)
            VALUES ($1, $2, $3)
            ON CONFLICT (owner_id, apartment_id) DO UPDATE SET is_primary = EXCLUDED.is_primary
            RETURNING *
            """,
            apartment_id,
            owner_id,
            is_primary,
        )
        return dict(row)

    async def remove_owner(self, apartment_id: UUID, owner_id: UUID) -> bool:
        result = await self._conn.execute(
            "DELETE FROM owner_apartments WHERE apartment_id = $1 AND owner_id = $2",
            apartment_id,
            owner_id,
        )
        return result == "DELETE 1"

    async def get_statistics(self, building_id: Optional[UUID] = None) -> dict:
        """
        Get occupancy statistics for apartments.
        """
        where_clause = ""
        params = []
        idx = 1

        if building_id:
            where_clause = f"WHERE a.building_id = ${idx}"
            params.append(building_id)

        row = await self._conn.fetchrow(
            f"""
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN a.status IN ('ACTIVA', 'ACTIVO') AND EXISTS (SELECT 1 FROM owner_apartments oa WHERE oa.apartment_id = a.id) THEN 1 END) as occupied,
                COUNT(CASE WHEN a.status IN ('ACTIVA', 'ACTIVO') AND NOT EXISTS (SELECT 1 FROM owner_apartments oa WHERE oa.apartment_id = a.id) THEN 1 END) as vacant,
                COUNT(CASE WHEN a.status = 'MANTENIMIENTO' THEN 1 END) as maintenance,
                CASE WHEN COUNT(*) > 0 THEN
                    (COUNT(CASE WHEN a.status IN ('ACTIVA', 'ACTIVO') AND EXISTS (SELECT 1 FROM owner_apartments oa WHERE oa.apartment_id = a.id) THEN 1 END)::float / COUNT(*)::float * 100)
                ELSE 0 END as occupancy_rate_percent,
                100.0 as allocated_quota_percent
            FROM apartments a
            {where_clause}
            """,
            *params,
        )
        return dict(row) if row else {
            "total": 0,
            "occupied": 0,
            "vacant": 0,
            "maintenance": 0,
            "occupancy_rate_percent": 0.0,
            "allocated_quota_percent": 0.0,
        }

    async def get_by_filter_paginated(
        self,
        page: int = 1,
        per_page: int = 4,
        status: Optional[str] = None,
        building_id: Optional[UUID] = None,
    ) -> tuple[list[dict], int]:
        """
        Get paginated apartments with optional status filter.
        Returns (items, total_count)
        """
        conditions = []
        params = []
        idx = 1

        conditions.append("a.status IN ('ACTIVA', 'ACTIVO', 'MANTENIMIENTO')")

        if status and status.upper() in ["OCUPADO", "VACANTE", "MANTENIMIENTO"]:
            if status.upper() == "OCUPADO":
                conditions.append("a.status IN ('ACTIVA', 'ACTIVO')")
                conditions.append("EXISTS (SELECT 1 FROM owner_apartments oa_f WHERE oa_f.apartment_id = a.id)")
            elif status.upper() == "VACANTE":
                conditions.append("a.status IN ('ACTIVA', 'ACTIVO')")
                conditions.append("NOT EXISTS (SELECT 1 FROM owner_apartments oa_f WHERE oa_f.apartment_id = a.id)")
            elif status.upper() == "MANTENIMIENTO":
                conditions.append("a.status = 'MANTENIMIENTO'")

        if building_id:
            conditions.append(f"a.building_id = ${idx}")
            params.append(building_id)
            idx += 1

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        # Get total count
        count_row = await self._conn.fetchval(
            f"SELECT COUNT(*) FROM apartments a {where}",
            *params,
        )
        total_count = count_row or 0

        # Get paginated items
        offset = (page - 1) * per_page
        rows = await self._conn.fetch(
            f"""
            SELECT
                a.id,
                a.code,
                a.floor,
                a.tower,
                CASE
                    WHEN a.status = 'MANTENIMIENTO' THEN 'MANTENIMIENTO'
                    WHEN oa.owner_id IS NULL THEN 'VACANTE'
                    ELSE 'OCUPADO'
                END AS status,
                a.building_id,
                oa.owner_id,
                a.created_at,
                a.updated_at,
                o.full_name as owner_name,
                COALESCE(o.allocated_quota_percent, 0.0) as owner_allocated_quota_percent,
                CAST(COALESCE(af.allocated_quota, 0.0) as float) as allocated_quota_percent,
                NULL::text as image_url
            FROM apartments a
            LEFT JOIN (
                SELECT DISTINCT ON (apartment_id) apartment_id, owner_id
                FROM owner_apartments
                WHERE is_primary = TRUE
                ORDER BY apartment_id, assigned_at DESC
            ) oa ON a.id = oa.apartment_id
            LEFT JOIN owners o ON oa.owner_id = o.id
            LEFT JOIN (
                SELECT apartment_id, SUM(amount)::float / (SELECT SUM(amount) FROM apartment_fees WHERE period = CURRENT_DATE::text) * 100 as allocated_quota
                FROM apartment_fees
                WHERE period = CURRENT_DATE::text
                GROUP BY apartment_id
            ) af ON a.id = af.apartment_id
            {where}
            ORDER BY a.code
            LIMIT ${idx} OFFSET ${idx + 1}
            """,
            *params,
            per_page,
            offset,
        )

        return [dict(r) for r in rows], total_count

    async def get_by_owner_id(self, owner_id: UUID) -> list[dict]:
        rows = await self._conn.fetch(
            """
            SELECT
                a.id,
                a.code,
                a.floor,
                a.tower,
                CASE
                    WHEN a.status = 'MANTENIMIENTO' THEN 'MANTENIMIENTO'
                    WHEN oa.owner_id IS NULL THEN 'VACANTE'
                    ELSE 'OCUPADO'
                END AS status,
                a.building_id,
                oa.owner_id                                 AS owner_id,
                a.created_at,
                a.updated_at,
                o.full_name                                 AS owner_name,
                o.email                                     AS owner_email,
                COALESCE(o.allocated_quota_percent, 0.0)    AS owner_allocated_quota_percent
            FROM apartments a
            JOIN owner_apartments oa ON a.id = oa.apartment_id
            JOIN owners o ON oa.owner_id = o.id
            WHERE oa.owner_id = $1
            ORDER BY a.code
            """,
            owner_id,
        )
        return [dict(r) for r in rows]
