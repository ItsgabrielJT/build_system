from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4
from unittest.mock import AsyncMock, patch
import pytest
from httpx import AsyncClient

from app.repositories.payment_repository import PaymentRepository
from app.models.schemas import PaymentCreate, OwnerPaymentCreate
from tests.conftest import (
    ADMIN_USER_ID,
    PROPIETARIO_USER_ID,
)

@pytest.mark.asyncio
async def test_create_payment_with_fine_id(mock_db):
    """
    Test that creating a payment with a fine_id executes the status update on the fine.
    """
    fine_id = uuid4()
    apartment_id = uuid4()
    owner_id = uuid4()
    
    payment_data = PaymentCreate(
        apartment_id=apartment_id,
        owner_id=owner_id,
        period="2026-05",
        paid_at=date(2026, 5, 21),
        amount=Decimal("150.00"),
        method="transferencia",
        reference="REF001",
        fine_id=fine_id,
    )
    
    mock_db.fetchrow = AsyncMock(return_value={
        "id": uuid4(),
        "apartment_id": apartment_id,
        "owner_id": owner_id,
        "period": "2026-05",
        "paid_at": date(2026, 5, 21),
        "amount": Decimal("150.00"),
        "method": "transferencia",
        "reference": "REF001",
        "fine_id": fine_id,
        "status": "REGISTRADO",
    })
    mock_db.execute = AsyncMock()
    
    repo = PaymentRepository(mock_db)
    result = await repo.create(payment_data, created_by=str(ADMIN_USER_ID))
    
    assert result["fine_id"] == fine_id
    mock_db.fetchrow.assert_called_once()
    mock_db.execute.assert_called_once_with(
        "UPDATE fines SET status = 'PAGADA', updated_at = NOW() WHERE id = $1",
        fine_id,
    )


@pytest.mark.asyncio
async def test_update_payment_status_updates_fine(mock_db):
    """
    Test that updating payment status updates the linked fine's status accordingly.
    """
    payment_id = uuid4()
    fine_id = uuid4()
    
    mock_db.fetchrow = AsyncMock(return_value={
        "id": payment_id,
        "fine_id": fine_id,
        "status": "REGISTRADO",
    })
    mock_db.execute = AsyncMock()
    
    repo = PaymentRepository(mock_db)
    
    # 1. Update status to REGISTRADO -> Sets fine to PAGADA
    await repo.update_status(payment_id, "REGISTRADO")
    mock_db.execute.assert_any_call(
        "UPDATE fines SET status = $2, updated_at = NOW() WHERE id = $1",
        fine_id,
        "PAGADA",
    )
    
    # 2. Update status to RECHAZADO / ANULADO -> Sets fine to ACTIVA
    mock_db.fetchrow = AsyncMock(return_value={
        "id": payment_id,
        "fine_id": fine_id,
        "status": "ANULADO",
    })
    mock_db.execute.reset_mock()
    await repo.update_status(payment_id, "ANULADO")
    mock_db.execute.assert_called_once_with(
        "UPDATE fines SET status = $2, updated_at = NOW() WHERE id = $1",
        fine_id,
        "ACTIVA",
    )


@pytest.mark.asyncio
async def test_approve_reject_payment_updates_fine(mock_db):
    """
    Test that approving and rejecting a payment updates the linked fine.
    """
    payment_id = uuid4()
    fine_id = uuid4()
    
    repo = PaymentRepository(mock_db)
    
    # Approve
    mock_db.fetchrow = AsyncMock(return_value={
        "id": payment_id,
        "fine_id": fine_id,
        "status": "REGISTRADO",
    })
    mock_db.execute = AsyncMock()
    await repo.approve(payment_id, str(ADMIN_USER_ID))
    mock_db.execute.assert_called_once_with(
        "UPDATE fines SET status = 'PAGADA', updated_at = NOW() WHERE id = $1",
        fine_id,
    )
    
    # Reject
    mock_db.fetchrow = AsyncMock(return_value={
        "id": payment_id,
        "fine_id": fine_id,
        "status": "RECHAZADO",
    })
    mock_db.execute.reset_mock()
    await repo.reject(payment_id, str(ADMIN_USER_ID), "Comprobante falso")
    mock_db.execute.assert_called_once_with(
        "UPDATE fines SET status = 'ACTIVA', updated_at = NOW() WHERE id = $1",
        fine_id,
    )


@pytest.mark.asyncio
async def test_get_apartment_pending_debts_endpoint(async_client, admin_headers, db_with_users):
    """
    Test GET /api/v1/apartments/{apartment_id}/pending-debts returns unpaid fees and active fines.
    """
    apartment_id = uuid4()
    
    # Mock return values for DB fetches: fees query and fines query
    db_with_users.fetch = AsyncMock()
    db_with_users.fetch.side_effect = [
        # Fees response
        [
            {
                "id": uuid4(),
                "period": "2026-05",
                "amount": Decimal("150.00"),
            }
        ],
        # Fines response
        [
            {
                "id": uuid4(),
                "period": "2026-05",
                "amount": Decimal("50.00"),
                "reason": "Mascotas",
            }
        ]
    ]
    
    response = await async_client.get(
        f"/api/v1/apartments/{apartment_id}/pending-debts",
        headers=admin_headers,
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "cuotas" in data
    assert "multas" in data
    
    assert len(data["cuotas"]) == 1
    assert data["cuotas"][0]["period"] == "2026-05"
    assert data["cuotas"][0]["amount"] == 150.0
    
    assert len(data["multas"]) == 1
    assert data["multas"][0]["period"] == "2026-05"
    assert data["multas"][0]["amount"] == 50.0
    assert "Mascotas" in data["multas"][0]["description"]


def test_period_status_with_fines_is_overdue():
    """
    Test that if there is a fine in the period (meaning balance > expected monthly fee),
    the status is immediately OVERDUE, even if we are before the due date.
    """
    from app.services.delinquency_service import _period_status
    
    today = date.today()
    current_period = f"{today.year}-{today.month:02d}"
    
    # 1. No fines, before due date (e.g., day 10, and today is before due_day)
    # We choose due_day = today.day + 5
    due_day = min(today.day + 5, 28)
    status = _period_status(current_period, Decimal("400.00"), due_day, Decimal("400.00"))
    assert status == "CURRENT"
    
    # 2. Unpaid fine present (saldo > esperado) before due date
    status_with_fine = _period_status(current_period, Decimal("600.00"), due_day, Decimal("0.00"))
    assert status_with_fine == "OVERDUE"
    
    # 3. Fine paid, monthly fee still pending (saldo <= esperado) before due date
    status_paid_fine = _period_status(current_period, Decimal("400.00"), due_day, Decimal("400.00"))
    assert status_paid_fine == "CURRENT"

