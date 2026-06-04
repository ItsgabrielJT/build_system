"""Endpoints de notificaciones para el PROPIETARIO."""

from __future__ import annotations

from uuid import UUID
from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import require_owner
from app.config.database import get_db
from app.repositories.notification_repository import NotificationRepository
from app.repositories.owner_repository import OwnerRepository
from app.repositories.payment_proof_repository import PaymentProofRepository
from app.repositories.payment_repository import PaymentRepository
from app.services.owner_payment_service import OwnerPaymentService

router = APIRouter(prefix="/owner/notifications", tags=["owner-notifications"])


def _build_service(db) -> OwnerPaymentService:
    return OwnerPaymentService(
        payment_repo=PaymentRepository(db),
        proof_repo=PaymentProofRepository(db),
        owner_repo=OwnerRepository(db),
        notification_repo=NotificationRepository(db),
    )


@router.get("/payments")
async def list_owner_payment_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_owner),
    db=Depends(get_db),
):
    """Lista notificaciones internas visibles para el propietario autenticado."""
    service = _build_service(db)
    return await service.list_notifications(
        user_id=user["user_id"],
        page=page,
        page_size=page_size,
    )


@router.put("/{notification_id}/read")
async def mark_owner_notification_as_read(
    notification_id: UUID,
    user: dict = Depends(require_owner),
    db=Depends(get_db),
):
    """Marca una notificación de propietario como leída."""
    repo = NotificationRepository(db)
    notification = await repo.get_by_id(notification_id)
    if not notification:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Notificación no encontrada")

    if notification.get("target_role") != "PROPIETARIO":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="No tiene permisos para ver esta notificación")
    if notification.get("target_user_id") and notification.get("target_user_id") != str(user["user_id"]):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="No tiene permisos para ver esta notificación")

    success = await repo.mark_as_read(notification_id)
    return {"success": success}