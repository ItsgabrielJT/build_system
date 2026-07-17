from __future__ import annotations

from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.models.schemas import ApartmentUpdate
from app.repositories.apartment_repository import ApartmentRepository
from app.services.apartment_service import ApartmentService


@pytest.mark.asyncio
async def test_update_preserves_vacant_status():
    apartment_id = uuid4()
    repo = AsyncMock()
    repo.code_exists = AsyncMock(return_value=False)
    repo.update = AsyncMock(return_value={"id": apartment_id, "status": "VACANTE"})

    service = ApartmentService(repo)

    await service.update(apartment_id, ApartmentUpdate(status="VACANTE"))

    saved_data = repo.update.await_args.args[1]
    assert saved_data.status == "VACANTE"


@pytest.mark.asyncio
async def test_statistics_counts_explicit_apartment_statuses():
    class FakeConnection:
        def __init__(self):
            self.query = None

        async def fetchrow(self, query, *args):
            self.query = query
            return {
                "total": 2,
                "occupied": 1,
                "vacant": 1,
                "maintenance": 0,
                "occupancy_rate_percent": 50.0,
                "allocated_quota_percent": 100.0,
            }

    conn = FakeConnection()
    repo = ApartmentRepository(conn)

    stats = await repo.get_statistics()

    assert stats["vacant"] == 1
    assert "a.status = 'VACANTE'" in conn.query
    assert "a.status = 'OCUPADO'" in conn.query
