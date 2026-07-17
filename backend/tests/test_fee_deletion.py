from __future__ import annotations

import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4


@pytest.mark.asyncio
async def test_delete_fee_returns_200_and_deletes_associated_payments(
    async_client: AsyncClient,
    admin_headers: dict,
    db_with_users,
):
    fee_id = uuid4()
    apt_id = uuid4()
    period = "2026-05"

    async def fetchrow_side_effect(query: str, *args):
        # Auth query
        if "FROM users u" in query and "WHERE u.id" in query:
            return {
                "id": args[0],
                "email": "admin@edificios.com",
                "status": "ACTIVO",
            }
        # Check if fee exists/get fee info before deleting
        if "FROM apartment_fees" in query and "WHERE id = $1" in query:
            return {"apartment_id": apt_id, "period": period}
        return None

    # Mock fetchrow for both get_by_id in service and repository queries
    db_with_users.fetchrow = AsyncMock(side_effect=fetchrow_side_effect)

    # Mock fetch for bulk query inside transaction
    db_with_users.fetch = AsyncMock(return_value=[{"apartment_id": apt_id, "period": period}])

    # Mock execute for deletion queries
    db_with_users.execute = AsyncMock(side_effect=lambda query, *args: "DELETE 1")

    response = await async_client.delete(
        f"/api/v1/apartment-fees/{fee_id}",
        headers=admin_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["deleted_fees"] == 1
    assert data["deleted_payments"] == 1

    # Check execute calls to ensure both payments and apartment_fees were deleted
    execute_calls = db_with_users.execute.call_args_list
    assert len(execute_calls) == 2
    
    # First query deletes payments
    assert "DELETE FROM payments" in execute_calls[0].args[0]
    # Second query deletes fees
    assert "DELETE FROM apartment_fees" in execute_calls[1].args[0]


@pytest.mark.asyncio
async def test_bulk_delete_fees_returns_200(
    async_client: AsyncClient,
    admin_headers: dict,
    db_with_users,
):
    fee_ids = [str(uuid4()), str(uuid4())]

    # Mock fetch for fetch combinations inside bulk_delete
    db_with_users.fetch = AsyncMock(return_value=[
        {"apartment_id": uuid4(), "period": "2026-05"},
        {"apartment_id": uuid4(), "period": "2026-05"}
    ])

    # Mock execute for bulk deletion queries
    db_with_users.execute = AsyncMock(side_effect=lambda query, *args: "DELETE 2")

    response = await async_client.post(
        "/api/v1/apartment-fees/bulk-delete",
        json={"fee_ids": fee_ids},
        headers=admin_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["deleted_fees"] == 2
    assert data["deleted_payments"] == 2
