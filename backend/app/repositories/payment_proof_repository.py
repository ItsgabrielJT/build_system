"""Repositorio para comprobantes de pago (SPEC-008)."""

from __future__ import annotations

from uuid import UUID

import asyncpg


class PaymentProofRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def create(
        self,
        payment_id: UUID,
        file_name: str,
        content_type: str,
        storage_path: str,
        uploaded_by: str,
    ) -> dict:
        row = await self._conn.fetchrow(
            """
            INSERT INTO payment_proofs
                (payment_id, file_name, content_type, storage_path, uploaded_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            """,
            payment_id,
            file_name,
            content_type,
            storage_path,
            uploaded_by,
        )
        return dict(row)

    async def get_latest_by_payment(self, payment_id: UUID) -> dict | None:
        row = await self._conn.fetchrow(
            """
            SELECT * FROM payment_proofs
            WHERE payment_id = $1
            ORDER BY created_at DESC
            LIMIT 1
            """,
            payment_id,
        )
        return dict(row) if row else None

    async def list_by_payment(self, payment_id: UUID) -> list[dict]:
        rows = await self._conn.fetch(
            """
            SELECT * FROM payment_proofs
            WHERE payment_id = $1
            ORDER BY created_at ASC
            """,
            payment_id,
        )
        return [dict(r) for r in rows]
