from __future__ import annotations

from typing import Optional
from uuid import UUID

import asyncpg

from app.models.schemas import BuildingCreate, BuildingUpdate


class BuildingRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def get_all(self) -> list[dict]:
        rows = await self._conn.fetch(
            "SELECT * FROM buildings ORDER BY created_at"
        )
        return [dict(r) for r in rows]

    async def get_by_id(self, building_id: UUID) -> dict | None:
        row = await self._conn.fetchrow(
            "SELECT * FROM buildings WHERE id = $1",
            building_id,
        )
        return dict(row) if row else None

    async def create(self, data: BuildingCreate) -> dict:
        row = await self._conn.fetchrow(
            """
            INSERT INTO buildings (
                name, address, phone, email,
                photo_file_name, photo_content_type, photo_storage_path,
                logo_file_name, logo_content_type, logo_storage_path,
                signature_file_name, signature_content_type, signature_storage_path,
                seal_file_name, seal_content_type, seal_storage_path,
                regulation_file_name, regulation_content_type, regulation_storage_path,
                documents_link
            )
            VALUES (
                $1, $2, $3, $4,
                $5, $6, $7,
                $8, $9, $10,
                $11, $12, $13,
                $14, $15, $16,
                $17, $18, $19,
                $20
            )
            RETURNING *
            """,
            data.name,
            data.address,
            data.phone,
            data.email,
            getattr(data, "photo_file_name", None),
            getattr(data, "photo_content_type", None),
            getattr(data, "photo_storage_path", None),
            getattr(data, "logo_file_name", None),
            getattr(data, "logo_content_type", None),
            getattr(data, "logo_storage_path", None),
            getattr(data, "signature_file_name", None),
            getattr(data, "signature_content_type", None),
            getattr(data, "signature_storage_path", None),
            getattr(data, "seal_file_name", None),
            getattr(data, "seal_content_type", None),
            getattr(data, "seal_storage_path", None),
            getattr(data, "regulation_file_name", None),
            getattr(data, "regulation_content_type", None),
            getattr(data, "regulation_storage_path", None),
            getattr(data, "documents_link", None),
        )
        return dict(row)

    async def update(self, building_id: UUID, data: BuildingUpdate) -> dict | None:
        row = await self._conn.fetchrow(
            """
            UPDATE buildings SET
                name        = COALESCE($2, name),
                address     = COALESCE($3, address),
                phone       = COALESCE($4, phone),
                email       = COALESCE($5, email),
                photo_file_name = COALESCE($6, photo_file_name),
                photo_content_type = COALESCE($7, photo_content_type),
                photo_storage_path = COALESCE($8, photo_storage_path),
                logo_file_name = COALESCE($9, logo_file_name),
                logo_content_type = COALESCE($10, logo_content_type),
                logo_storage_path = COALESCE($11, logo_storage_path),
                signature_file_name = COALESCE($12, signature_file_name),
                signature_content_type = COALESCE($13, signature_content_type),
                signature_storage_path = COALESCE($14, signature_storage_path),
                seal_file_name = COALESCE($15, seal_file_name),
                seal_content_type = COALESCE($16, seal_content_type),
                seal_storage_path = COALESCE($17, seal_storage_path),
                regulation_file_name = COALESCE($18, regulation_file_name),
                regulation_content_type = COALESCE($19, regulation_content_type),
                regulation_storage_path = COALESCE($20, regulation_storage_path),
                documents_link = COALESCE($21, documents_link),
                updated_at  = NOW()
            WHERE id = $1
            RETURNING *
            """,
            building_id,
            data.name,
            data.address,
            data.phone,
            data.email,
            getattr(data, "photo_file_name", None),
            getattr(data, "photo_content_type", None),
            getattr(data, "photo_storage_path", None),
            getattr(data, "logo_file_name", None),
            getattr(data, "logo_content_type", None),
            getattr(data, "logo_storage_path", None),
            getattr(data, "signature_file_name", None),
            getattr(data, "signature_content_type", None),
            getattr(data, "signature_storage_path", None),
            getattr(data, "seal_file_name", None),
            getattr(data, "seal_content_type", None),
            getattr(data, "seal_storage_path", None),
            getattr(data, "regulation_file_name", None),
            getattr(data, "regulation_content_type", None),
            getattr(data, "regulation_storage_path", None),
            getattr(data, "documents_link", None),
        )
        return dict(row)

    async def get_default(self) -> dict | None:
        row = await self._conn.fetchrow(
            "SELECT * FROM buildings ORDER BY created_at ASC LIMIT 1"
        )
        return dict(row) if row else None

    async def delete(self, building_id: UUID) -> bool:
        result = await self._conn.execute(
            "DELETE FROM buildings WHERE id = $1",
            building_id,
        )
        return result != "DELETE 0"
