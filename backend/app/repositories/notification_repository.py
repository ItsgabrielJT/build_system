"""Repositorio para notificaciones internas (SPEC-008)."""

from __future__ import annotations

import json
from typing import Optional

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
        data["recipient"] = data.get("target_role") or data.get("target_user_id")
        return data

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
        target_role = recipient if recipient in {"ADMIN", "PROPIETARIO"} else None
        target_user_id = None if target_role else recipient
        reference_id = metadata.get("payment_id") if metadata else None

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

    async def list_for_admin(
        self, page: int = 1, page_size: int = 20
    ) -> tuple[list[dict], int]:
        offset = (page - 1) * page_size
        rows = await self._conn.fetch(
            """
            SELECT * FROM notifications
            WHERE target_role = 'ADMIN'
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
            """,
            page_size,
            offset,
        )
        total = await self._conn.fetchval(
            "SELECT COUNT(*) FROM notifications WHERE target_role = 'ADMIN'"
        )
        return [self._map_notification_row(r) or {} for r in rows], int(total or 0)
