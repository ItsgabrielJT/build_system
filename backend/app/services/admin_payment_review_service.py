"""Servicio para revisión administrativa de pagos (SPEC-008)."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status

from app.repositories.notification_repository import NotificationRepository
from app.repositories.payment_proof_repository import PaymentProofRepository
from app.repositories.payment_repository import PaymentRepository

_STATUS_PENDIENTE = "PENDIENTE_APROBACION"


class AdminPaymentReviewService:
    def __init__(
        self,
        payment_repo: PaymentRepository,
        proof_repo: PaymentProofRepository,
        notification_repo: NotificationRepository,
    ) -> None:
        self._payment_repo = payment_repo
        self._proof_repo = proof_repo
        self._notification_repo = notification_repo

    async def list_pending(
        self, page: int = 1, page_size: int = 20
    ) -> list[dict]:
        return await self._payment_repo.get_pending_for_admin(
            page=page, page_size=page_size
        )

    async def approve(self, payment_id: UUID, admin_id: str) -> dict:
        payment = await self._payment_repo.get_by_id(payment_id)
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pago no encontrado",
            )
        if payment["status"] != _STATUS_PENDIENTE:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Transición inválida: el pago está en estado {payment['status']}",
            )
        updated = await self._payment_repo.approve(payment_id, admin_id)
        return updated

    async def reject(
        self, payment_id: UUID, admin_id: str, reason: str
    ) -> dict:
        payment = await self._payment_repo.get_by_id(payment_id)
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pago no encontrado",
            )
        if payment["status"] != _STATUS_PENDIENTE:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Transición inválida: el pago está en estado {payment['status']}",
            )
        updated = await self._payment_repo.reject(payment_id, admin_id, reason)
        return updated

    async def list_notifications(
        self, page: int = 1, page_size: int = 20
    ) -> dict:
        data, total = await self._notification_repo.list_for_admin(
            page=page, page_size=page_size
        )
        return {
            "data": data,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
