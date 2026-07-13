from __future__ import annotations

from typing import Optional
from uuid import UUID

import asyncpg

from app.models.schemas import OwnerCreate, OwnerUpdate, OwnerProfileUpdate


class OwnerRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def get_all(self, status: Optional[str] = None) -> list[dict]:
        if status:
            rows = await self._conn.fetch(
                "SELECT * FROM owners WHERE status = $1 ORDER BY full_name",
                status,
            )
        else:
            rows = await self._conn.fetch("SELECT * FROM owners ORDER BY full_name")
        return [dict(r) for r in rows]

    async def get_by_id(self, owner_id: UUID) -> dict | None:
        row = await self._conn.fetchrow(
            "SELECT * FROM owners WHERE id = $1",
            owner_id,
        )
        return dict(row) if row else None

    async def get_by_id_with_apartments(self, owner_id: UUID) -> dict | None:
        owner = await self.get_by_id(owner_id)
        if not owner:
            return None
        apartments = await self._conn.fetch(
            """
            SELECT a.* FROM apartments a
            JOIN owner_apartments oa ON a.id = oa.apartment_id
            WHERE oa.owner_id = $1
            ORDER BY a.code
            """,
            owner_id,
        )
        owner["apartments"] = [dict(a) for a in apartments]
        return owner

    async def get_by_firebase_uid(self, firebase_uid: str) -> dict | None:
        row = await self._conn.fetchrow(
            "SELECT * FROM owners WHERE firebase_uid = $1 AND status = 'ACTIVO'",
            firebase_uid,
        )
        return dict(row) if row else None

    async def get_by_user_id(self, user_id: UUID) -> dict | None:
        """Retorna el owner vinculado al user_id local."""
        row = await self._conn.fetchrow(
            "SELECT * FROM owners WHERE firebase_uid = $1 AND status = 'ACTIVO'",
            str(user_id),
        )
        return dict(row) if row else None

    async def document_id_exists(
        self, document_id: str, exclude_id: Optional[UUID] = None
    ) -> bool:
        if exclude_id:
            row = await self._conn.fetchrow(
                "SELECT 1 FROM owners WHERE document_id = $1 AND id != $2",
                document_id,
                exclude_id,
            )
        else:
            row = await self._conn.fetchrow(
                "SELECT 1 FROM owners WHERE document_id = $1",
                document_id,
            )
        return row is not None

    async def create(self, data: OwnerCreate) -> dict:
        row = await self._conn.fetchrow(
            """
            INSERT INTO owners (full_name, document_id, phone, email, allocated_quota_percent)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            """,
            data.full_name,
            data.document_id,
            data.phone,
            data.email,
            data.allocated_quota_percent if data.allocated_quota_percent is not None else 0,
        )
        return dict(row)

    async def update(self, owner_id: UUID, data: OwnerUpdate) -> dict | None:
        row = await self._conn.fetchrow(
            """
            UPDATE owners SET
                full_name   = COALESCE($2, full_name),
                document_id = COALESCE($3, document_id),
                phone       = COALESCE($4, phone),
                email       = COALESCE($5, email),
                status      = COALESCE($6, status),
                allocated_quota_percent = COALESCE($7, allocated_quota_percent),
                updated_at  = NOW()
            WHERE id = $1
            RETURNING *
            """,
            owner_id,
            data.full_name,
            data.document_id,
            data.phone,
            data.email,
            data.status,
            data.allocated_quota_percent,
        )
        return dict(row) if row else None

    async def soft_delete(self, owner_id: UUID) -> bool:
        result = await self._conn.execute(
            "UPDATE owners SET status = 'INACTIVO', updated_at = NOW() WHERE id = $1",
            owner_id,
        )
        return result == "UPDATE 1"

    async def get_directory_paginated(
        self,
        page: int = 1,
        per_page: int = 10,
        search: Optional[str] = None,
        start_date=None,
        end_date=None,
    ) -> tuple[list[dict], int]:
        """
        Get paginated owners directory with consolidated balance.
        Returns (items, total_count)
        """
        conditions = ["o.status = 'ACTIVO'"]
        params = []
        idx = 1

        if search:
            search_pattern = f"%{search}%"
            conditions.append(f"(o.full_name ILIKE ${idx} OR o.email ILIKE ${idx + 1} OR o.phone ILIKE ${idx + 2})")
            params.extend([search_pattern, search_pattern, search_pattern])
            idx += 3
        if start_date:
            conditions.append(f"o.created_at::date >= ${idx}")
            params.append(start_date)
            idx += 1
        if end_date:
            conditions.append(f"o.created_at::date <= ${idx}")
            params.append(end_date)
            idx += 1

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        # Get total count
        count_row = await self._conn.fetchval(
            f"SELECT COUNT(DISTINCT o.id) FROM owners o {where}",
            *params,
        )
        total_count = count_row or 0

        # Get paginated items with balance calculation
        offset = (page - 1) * per_page
        query_params = params.copy()
        query_params.extend([per_page, offset])

        rows = await self._conn.fetch(
            f"""
            SELECT DISTINCT
                o.id,
                o.full_name,
                o.document_id,
                o.email,
                o.phone,
                COALESCE(o.allocated_quota_percent, 0.0) as allocated_quota_percent,
                o.created_at as ingress_date,
                COALESCE(balance.total_balance, 0.0) as balance,
                'USD' as currency
            FROM owners o
            LEFT JOIN (
                SELECT
                    owner_id,
                    SUM(fees_amount - payments_amount + fines_amount) as total_balance
                FROM (
                    SELECT
                        p.owner_id,
                        COALESCE(af.amount, 0.0) as fees_amount,
                        COALESCE(p.amount, 0.0) as payments_amount,
                        COALESCE(f.amount, 0.0) as fines_amount
                    FROM payments p
                    FULL OUTER JOIN apartment_fees af ON p.apartment_id = af.apartment_id AND p.period = af.period
                    FULL OUTER JOIN fines f ON p.apartment_id = f.apartment_id AND p.period = f.period
                    WHERE p.owner_id IS NOT NULL
                    
                    UNION ALL
                    
                    SELECT
                        oa.owner_id,
                        af.amount as fees_amount,
                        0.0 as payments_amount,
                        0.0 as fines_amount
                    FROM apartment_fees af
                    JOIN owner_apartments oa ON af.apartment_id = oa.apartment_id
                    WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.apartment_id = af.apartment_id AND p.period = af.period)
                    
                    UNION ALL
                    
                    SELECT
                        oa.owner_id,
                        0.0 as fees_amount,
                        0.0 as payments_amount,
                        f.amount as fines_amount
                    FROM fines f
                    JOIN owner_apartments oa ON f.apartment_id = oa.apartment_id
                    WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.apartment_id = f.apartment_id AND p.period = f.period)
                ) balance_calc
                GROUP BY owner_id
            ) balance ON o.id = balance.owner_id
            {where}
            ORDER BY o.full_name
            LIMIT ${idx} OFFSET ${idx + 1}
            """,
            *query_params,
        )

        return [dict(r) for r in rows], total_count

    async def get_detail_with_transactions(
        self,
        owner_id: UUID,
        limit_transactions: int = 3,
    ) -> dict | None:
        """
        Get owner details with recent transactions.
        """
        owner = await self.get_by_id_with_apartments(owner_id)
        if not owner:
            return None

        # Get recent transactions (payments and fines)
        transactions = await self._conn.fetch(
            f"""
            SELECT
                'PAYMENT' as type,
                p.period,
                p.amount,
                p.paid_at as date,
                COALESCE(p.reference, 'Pago de cuota') as reference
            FROM payments p
            WHERE p.owner_id = $1 AND p.status = 'REGISTRADO'

            UNION ALL

            SELECT
                'INCOME' as type,
                COALESCE(i.period, TO_CHAR(i.date, 'YYYY-MM')) as period,
                i.amount,
                i.date,
                COALESCE(i.reference, i.concept, 'Ingreso') as reference
            FROM incomes i
            WHERE i.owner_id = $1 AND i.status = 'REGISTRADO'
            
            UNION ALL
            
            SELECT
                'FINE' as type,
                f.period,
                f.amount,
                f.issued_at as date,
                COALESCE(f.reason, 'Multa') as reference
            FROM fines f
            WHERE f.owner_id = $1
            
            ORDER BY date DESC
            LIMIT $2
            """,
            owner_id,
            limit_transactions,
        )

        # Calculate consolidated balance from the current owner/apartment model.
        balance_row = await self._conn.fetchrow(
            """
            SELECT
                COALESCE(fees.total, 0.0)
                - COALESCE(payments.total, 0.0)
                + COALESCE(fines.total, 0.0) AS total_balance
            FROM (SELECT $1::uuid AS owner_id) current_owner
            LEFT JOIN LATERAL (
                SELECT SUM(af.amount) AS total
                FROM apartment_fees af
                JOIN owner_apartments oa ON oa.apartment_id = af.apartment_id
                WHERE oa.owner_id = current_owner.owner_id
            ) fees ON TRUE
            LEFT JOIN LATERAL (
                SELECT SUM(amount) AS total
                FROM (
                    SELECT p.amount
                    FROM payments p
                    WHERE p.owner_id = current_owner.owner_id
                      AND p.status = 'REGISTRADO'
                    UNION ALL
                    SELECT i.amount
                    FROM incomes i
                    WHERE i.owner_id = current_owner.owner_id
                      AND i.status = 'REGISTRADO'
                ) paid_sources
            ) payments ON TRUE
            LEFT JOIN LATERAL (
                SELECT SUM(f.amount) AS total
                FROM fines f
                WHERE f.owner_id = current_owner.owner_id
                  AND f.status = 'ACTIVA'
            ) fines ON TRUE
            """,
            owner_id,
        )

        balance = float(balance_row["total_balance"]) if balance_row else 0.0

        return {
            **owner,
            "balance_consolidated": balance,
            "recent_transactions": [dict(t) for t in transactions],
        }

    async def link_user(self, owner_id: UUID, user_id: UUID) -> bool:
        """Vincula el owner con un user_id local (guardándolo en firebase_uid)."""
        query = "UPDATE owners SET firebase_uid = $1, updated_at = NOW() WHERE id = $2"
        await self._conn.execute(query, str(user_id), owner_id)
        return True

    async def update_profile(self, owner_id: UUID, data: OwnerProfileUpdate) -> dict | None:
        row = await self._conn.fetchrow(
            """
            UPDATE owners SET
                full_name = COALESCE($2, full_name),
                document_id = COALESCE($3, document_id),
                phone = COALESCE($4, phone),
                email = COALESCE($5, email),
                birth_date = COALESCE($6, birth_date),
                occupant_name = COALESCE($7, occupant_name),
                occupant_relation = COALESCE($8, occupant_relation),
                occupant_phone = COALESCE($9, occupant_phone),
                occupant_inhabitants = COALESCE($10, occupant_inhabitants),
                emergency_name = COALESCE($11, emergency_name),
                emergency_relation = COALESCE($12, emergency_relation),
                emergency_phone = COALESCE($13, emergency_phone),
                notifications_enabled = COALESCE($14, notifications_enabled),
                allocated_quota_percent = COALESCE($15, allocated_quota_percent),
                last_update_date = NOW(),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            """,
            owner_id,
            data.full_name,
            data.document_id,
            data.phone,
            data.email,
            data.birth_date,
            data.occupant_name,
            data.occupant_relation,
            data.occupant_phone,
            data.occupant_inhabitants,
            data.emergency_name,
            data.emergency_relation,
            data.emergency_phone,
            data.notifications_enabled,
            data.allocated_quota_percent,
        )
        if row:
            return await self.get_by_id_with_apartments(owner_id)
        return None
