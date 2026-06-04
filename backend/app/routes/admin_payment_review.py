"""Endpoints de revisión administrativa de pagos (SPEC-008).

Rutas:
  GET  /api/v1/admin/payments/pending              — listar pendientes
    GET  /api/v1/admin/payments/{payment_id}/proof   — descargar comprobante
  PUT  /api/v1/admin/payments/{payment_id}/approve — aprobar
  PUT  /api/v1/admin/payments/{payment_id}/reject  — rechazar
  GET  /api/v1/admin/notifications/payments        — notificaciones internas
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response

from app.auth.dependencies import require_admin
from app.config.database import get_db
from app.models.schemas import PaymentRejectRequest
from app.repositories.notification_repository import NotificationRepository
from app.repositories.payment_proof_repository import PaymentProofRepository
from app.repositories.payment_repository import PaymentRepository
from app.repositories.owner_repository import OwnerRepository
from app.services.admin_payment_review_service import AdminPaymentReviewService

router = APIRouter(prefix="/admin", tags=["admin-payment-review"])


def _build_service(db) -> AdminPaymentReviewService:
    return AdminPaymentReviewService(
        payment_repo=PaymentRepository(db),
        proof_repo=PaymentProofRepository(db),
        notification_repo=NotificationRepository(db),
        owner_repo=OwnerRepository(db),
    )


@router.get("/payments/pending")
async def list_pending_payments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Lista todos los pagos pendientes de revisión para el ADMIN."""
    service = _build_service(db)
    return await service.list_pending(page=page, page_size=page_size)


@router.get("/payments/{payment_id}/proof")
async def download_payment_proof(
    payment_id: UUID,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Descarga el comprobante adjunto de un pago para revisión administrativa."""
    service = _build_service(db)
    proof = await service.download_proof(payment_id)
    return Response(
        content=proof["content"],
        media_type=proof["content_type"],
        headers={
            "Content-Disposition": f'attachment; filename="{proof["file_name"]}"'
        },
    )


@router.put("/payments/{payment_id}/approve")
async def approve_payment(
    payment_id: UUID,
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Aprueba un pago pendiente."""
    service = _build_service(db)
    return await service.approve(
        payment_id=payment_id,
        admin_id=str(user["user_id"]),
    )


@router.put("/payments/{payment_id}/reject")
async def reject_payment(
    payment_id: UUID,
    body: PaymentRejectRequest,
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Rechaza un pago pendiente con motivo obligatorio."""
    service = _build_service(db)
    return await service.reject(
        payment_id=payment_id,
        admin_id=str(user["user_id"]),
        reason=body.reason,
    )


@router.get("/notifications/payments")
async def list_payment_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Lista notificaciones internas de pagos pendientes para el ADMIN."""
    service = _build_service(db)
    return await service.list_notifications(page=page, page_size=page_size)
