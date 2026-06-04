from __future__ import annotations

from typing import Optional
from uuid import UUID

import asyncpg

from app.models.schemas import OwnerPaymentCreate, PaymentCreate


class PaymentRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def owner_has_apartment(self, owner_id: UUID, apartment_id: UUID) -> bool:
        row = await self._conn.fetchrow(
            """
            SELECT 1
            FROM owner_apartments
            WHERE owner_id = $1 AND apartment_id = $2
            """,
            owner_id,
            apartment_id,
        )
        return row is not None

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

    async def create_owner_payment(
        self,
        data: OwnerPaymentCreate,
        owner_id: UUID,
        created_by: str,
    ) -> dict:
        row = await self._conn.fetchrow(
            """
            INSERT INTO payments (
                apartment_id,
                owner_id,
                period,
                paid_at,
                amount,
                method,
                reference,
                status,
                created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
            """,
            data.apartment_id,
            owner_id,
            data.period,
            data.paid_at,
            data.amount,
            data.method,
            data.reference,
            "PENDIENTE_APROBACION",
            str(created_by),
        )
        return dict(row)

    async def get_owner_payments(
        self,
        owner_id: UUID,
        status: Optional[str] = None,
        period: Optional[str] = None,
        apartment_id: Optional[UUID] = None,
    ) -> list[dict]:
        conditions = ["p.owner_id = $1"]
        params: list = [owner_id]
        idx = 2

        if status:
            conditions.append(f"p.status = ${idx}")
            params.append(status)
            idx += 1
        if period:
            conditions.append(f"p.period = ${idx}")
            params.append(period)
            idx += 1
        if apartment_id:
            conditions.append(f"p.apartment_id = ${idx}")
            params.append(apartment_id)

        rows = await self._conn.fetch(
            f"""
            SELECT p.*, a.code AS apartment_code, o.full_name AS owner_name
            FROM payments p
            JOIN apartments a ON p.apartment_id = a.id
            JOIN owners o ON p.owner_id = o.id
            WHERE {' AND '.join(conditions)}
            ORDER BY p.created_at DESC
            """,
            *params,
        )
        return [dict(r) for r in rows]

    async def get_by_id_for_owner(
        self,
        payment_id: UUID,
        owner_id: UUID,
    ) -> dict | None:
        row = await self._conn.fetchrow(
            """
            SELECT p.*, a.code AS apartment_code, o.full_name AS owner_name
            FROM payments p
            JOIN apartments a ON p.apartment_id = a.id
            JOIN owners o ON p.owner_id = o.id
            WHERE p.id = $1 AND p.owner_id = $2
            """,
            payment_id,
            owner_id,
        )
        return dict(row) if row else None

    async def get_pending_for_admin(
        self,
        page: int = 1,
        page_size: int = 20,
    ) -> list[dict]:
        offset = (page - 1) * page_size
        rows = await self._conn.fetch(
            """
            SELECT p.*, a.code AS apartment_code, o.full_name AS owner_name
            FROM payments p
            JOIN apartments a ON p.apartment_id = a.id
            JOIN owners o ON p.owner_id = o.id
            WHERE p.status = 'PENDIENTE_APROBACION'
            ORDER BY p.created_at DESC
            LIMIT $1 OFFSET $2
            """,
            page_size,
            offset,
        )
        return [dict(r) for r in rows]

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

    async def approve(self, payment_id: UUID, admin_id: str) -> dict | None:
        row = await self._conn.fetchrow(
            """
            UPDATE payments
            SET
                status = 'REGISTRADO',
                approved_by = $2,
                approved_at = NOW(),
                rejected_by = NULL,
                rejected_at = NULL,
                rejection_reason = NULL,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            """,
            payment_id,
            admin_id,
        )
        return dict(row) if row else None

    async def reject(
        self,
        payment_id: UUID,
        admin_id: str,
        reason: str,
    ) -> dict | None:
        row = await self._conn.fetchrow(
            """
            UPDATE payments
            SET
                status = 'RECHAZADO',
                rejected_by = $2,
                rejected_at = NOW(),
                rejection_reason = $3,
                approved_by = NULL,
                approved_at = NULL,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            """,
            payment_id,
            admin_id,
            reason,
        )
        return dict(row) if row else None
