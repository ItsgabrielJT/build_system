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
