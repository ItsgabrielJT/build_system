"""Repositorio para notificaciones internas (SPEC-008)."""

from __future__ import annotations

import json
from typing import Optional
from uuid import UUID

import asyncpg


class NotificationRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    @staticmethod
    def _map_notification_row(row: asyncpg.Record | None) -> dict | None:
        if not row:
            return None
        data = dict(row)
        payload = data.get("payload") or {}
        if isinstance(payload, str):
            payload = json.loads(payload)
        data["title"] = payload.get("title")
        data["body"] = payload.get("body")
        data["metadata"] = payload.get("metadata")
        data["recipient"] = data.get("target_user_id") or data.get("target_role")
        return data

    @staticmethod
    def _get_reference_id(metadata: Optional[dict]) -> str | None:
        if not metadata:
            return None
        return (
            metadata.get("payment_id")
            or metadata.get("event_id")
            or metadata.get("announcement_id")
        )

    async def create(
        self,
        notification_type: str,
        title: str,
        recipient: str,
        body: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> dict:
        payload = {
            "title": title,
            "body": body,
            "metadata": metadata,
        }
        if recipient == "ADMIN":
            target_role = "ADMIN"
            target_user_id = None
        else:
            target_role = "PROPIETARIO"
            target_user_id = None if recipient == "PROPIETARIO" else recipient
        reference_id = self._get_reference_id(metadata)

        row = await self._conn.fetchrow(
            """
            INSERT INTO notifications (
                type,
                payload,
                target_role,
                target_user_id,
                reference_id
            )
            VALUES ($1, $2::jsonb, $3, $4, $5)
            RETURNING *
            """,
            notification_type,
            json.dumps(payload),
            target_role,
            target_user_id,
            reference_id,
        )
        return self._map_notification_row(row) or {}

    async def get_by_id(self, notification_id: UUID) -> dict | None:
        row = await self._conn.fetchrow(
            "SELECT * FROM notifications WHERE id = $1",
            notification_id,
        )
        return self._map_notification_row(row) if row else None

    async def mark_as_read(self, notification_id: UUID) -> bool:
        result = await self._conn.execute(
            """
            UPDATE notifications
            SET read_at = NOW()
            WHERE id = $1 AND read_at IS NULL
            """,
            notification_id,
        )
        return result == "UPDATE 1"

    async def list_for_admin(
        self, page: int = 1, page_size: int = 20
    ) -> tuple[list[dict], int]:
        offset = (page - 1) * page_size
        rows = await self._conn.fetch(
            """
            SELECT * FROM notifications
            WHERE target_role = 'ADMIN' AND read_at IS NULL
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
            """,
            page_size,
            offset,
        )
        total = await self._conn.fetchval(
            "SELECT COUNT(*) FROM notifications WHERE target_role = 'ADMIN' AND read_at IS NULL"
        )
        return [self._map_notification_row(r) or {} for r in rows], int(total or 0)

    async def list_for_user(
        self, user_id: str, page: int = 1, page_size: int = 20
    ) -> tuple[list[dict], int]:
        offset = (page - 1) * page_size
        rows = await self._conn.fetch(
            """
            SELECT * FROM notifications
            WHERE (
                target_user_id = $1
                OR (target_user_id IS NULL AND target_role = 'PROPIETARIO')
            )
            AND read_at IS NULL
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            """,
            user_id,
            page_size,
            offset,
        )
        total = await self._conn.fetchval(
            """
            SELECT COUNT(*) FROM notifications
            WHERE (
                target_user_id = $1
                OR (target_user_id IS NULL AND target_role = 'PROPIETARIO')
            )
            AND read_at IS NULL
            """,
            user_id,
        )
        return [self._map_notification_row(r) or {} for r in rows], int(total or 0)
