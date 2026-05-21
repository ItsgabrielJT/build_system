from __future__ import annotations

from typing import Optional
from uuid import UUID

import asyncpg

from app.models.schemas import OwnerCreate, OwnerUpdate


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
            INSERT INTO owners (full_name, document_id, phone, email)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            """,
            data.full_name,
            data.document_id,
            data.phone,
            data.email,
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
                        a.owner_id,
                        af.amount as fees_amount,
                        0.0 as payments_amount,
                        0.0 as fines_amount
                    FROM apartment_fees af
                    JOIN apartments a ON af.apartment_id = a.id
                    WHERE a.owner_id IS NOT NULL
                        AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.apartment_id = af.apartment_id AND p.period = af.period)
                    
                    UNION ALL
                    
                    SELECT
                        a.owner_id,
                        0.0 as fees_amount,
                        0.0 as payments_amount,
                        f.amount as fines_amount
                    FROM fines f
                    JOIN apartments a ON f.apartment_id = a.id
                    WHERE a.owner_id IS NOT NULL
                        AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.apartment_id = f.apartment_id AND p.period = f.period)
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
            WHERE p.owner_id = $1 AND p.status = 'PAGADO'
            
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

        # Calculate consolidated balance
        balance_row = await self._conn.fetchrow(
            """
            SELECT
                COALESCE(SUM(fees_amount - payments_amount + fines_amount), 0.0) as total_balance
            FROM (
                SELECT
                    COALESCE(af.amount, 0.0) as fees_amount,
                    COALESCE(p.amount, 0.0) as payments_amount,
                    COALESCE(f.amount, 0.0) as fines_amount
                FROM apartment_fees af
                FULL OUTER JOIN payments p ON p.apartment_id = af.apartment_id AND p.period = af.period
                FULL OUTER JOIN fines f ON f.apartment_id = af.apartment_id AND f.period = af.period
                JOIN apartments a ON af.apartment_id = a.id
                WHERE a.owner_id = $1 OR p.owner_id = $1 OR f.owner_id = $1
            ) balance_calc
            """,
            owner_id,
        )

        balance = float(balance_row["total_balance"]) if balance_row else 0.0

        return {
            **owner,
            "balance_consolidated": balance,
            "recent_transactions": [dict(t) for t in transactions],
        }
