from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status

from app.models.schemas import PaymentCreate, PaymentUpdate
from app.repositories.payment_repository import PaymentRepository

_VALID_TRANSITIONS = {"REGISTRADO": {"ANULADO"}}


class PaymentService:
    def __init__(self, repo: PaymentRepository) -> None:
        self._repo = repo

    async def get_all(self, period=None, owner_id=None, status_filter=None) -> list[dict]:
        return await self._repo.get_all(
            period=period, owner_id=owner_id, status=status_filter
        )

    async def create(self, data: PaymentCreate, created_by: str) -> dict:
        return await self._repo.create(data, created_by)

    async def update_status(self, payment_id: UUID, data: PaymentUpdate) -> dict:
        payment = await self._repo.get_by_id(payment_id)
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pago no encontrado",
            )
        allowed = _VALID_TRANSITIONS.get(payment["status"], set())
        if data.status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Transición inválida: {payment['status']} → {data.status}",
            )
        updated = await self._repo.update_status(payment_id, data.status)
        return updated
