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
