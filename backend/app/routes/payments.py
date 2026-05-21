from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import require_admin
from app.config.database import get_db
from app.models.schemas import PaymentCreate, PaymentUpdate
from app.repositories.payment_repository import PaymentRepository
from app.services.payment_service import PaymentService

router = APIRouter(tags=["payments"])


@router.get("/payments")
async def list_payments(
    period: Optional[str] = None,
    owner_id: Optional[UUID] = None,
    status: Optional[str] = None,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = PaymentService(PaymentRepository(db))
    return await service.get_all(
        period=period, owner_id=owner_id, status_filter=status
    )


@router.post("/payments", status_code=201)
async def create_payment(
    body: PaymentCreate,
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = PaymentService(PaymentRepository(db))
    return await service.create(body, created_by=user["user_id"])


@router.put("/payments/{payment_id}")
async def update_payment(
    payment_id: UUID,
    body: PaymentUpdate,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = PaymentService(PaymentRepository(db))
    return await service.update_status(payment_id, body)
