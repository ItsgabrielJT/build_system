from __future__ import annotations

import asyncpg
from uuid import UUID
from datetime import date, time


class EventRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def create(
        self,
        title: str,
        description: str,
        event_date: date,
        start_time: time,
        end_time: time,
    ) -> dict:
        row = await self._conn.fetchrow(
            """
            INSERT INTO events (title, description, event_date, start_time, end_time)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            """,
            title,
            description,
            event_date,
            start_time,
            end_time,
        )
        return dict(row)

    async def get_by_id(self, event_id: UUID) -> dict | None:
        row = await self._conn.fetchrow(
            "SELECT * FROM events WHERE id = $1",
            event_id,
        )
        return dict(row) if row else None

    async def update(
        self,
        event_id: UUID,
        title: str,
        description: str,
        event_date: date,
        start_time: time,
        end_time: time,
    ) -> dict | None:
        row = await self._conn.fetchrow(
            """
            UPDATE events
            SET title = $2,
                description = $3,
                event_date = $4,
                start_time = $5,
                end_time = $6
            WHERE id = $1
            RETURNING *
            """,
            event_id,
            title,
            description,
            event_date,
            start_time,
            end_time,
        )
        return dict(row) if row else None

    async def delete(self, event_id: UUID) -> bool:
        async with self._conn.transaction():
            await self._conn.execute(
                "DELETE FROM event_owners WHERE event_id = $1",
                event_id,
            )
            result = await self._conn.execute(
                "DELETE FROM events WHERE id = $1",
                event_id,
            )
        return result == "DELETE 1"

    async def assign_to_owners(self, event_id: UUID, owner_ids: list[UUID]) -> None:
        async with self._conn.transaction():
            # Clear existing if any
            await self._conn.execute(
                "DELETE FROM event_owners WHERE event_id = $1",
                event_id,
            )
            # Insert assignments
            for owner_id in owner_ids:
                await self._conn.execute(
                    "INSERT INTO event_owners (event_id, owner_id) VALUES ($1, $2)",
                    event_id,
                    owner_id,
                )

    async def get_all_with_owners(self) -> list[dict]:
        rows = await self._conn.fetch(
            "SELECT * FROM events ORDER BY event_date DESC, start_time DESC"
        )
        events = [dict(r) for r in rows]
        for event in events:
            owners_data = await self._conn.fetch(
                """
                SELECT o.id, o.full_name, o.email
                FROM owners o
                JOIN event_owners eo ON o.id = eo.owner_id
                WHERE eo.event_id = $1
                """,
                event["id"],
            )
            event["assigned_owners"] = [dict(o) for o in owners_data]
        return events

    async def get_by_owner_id(self, owner_id: UUID) -> list[dict]:
        rows = await self._conn.fetch(
            """
            SELECT e.*
            FROM events e
            JOIN event_owners eo ON e.id = eo.event_id
            WHERE eo.owner_id = $1
            ORDER BY e.event_date ASC, e.start_time ASC
            """,
            owner_id,
        )
        return [dict(r) for r in rows]
