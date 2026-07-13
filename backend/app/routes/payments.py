from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status

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


@router.delete("/payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment(
    payment_id: UUID,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = PaymentService(PaymentRepository(db))
    await service.delete(payment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/payments/{payment_id}/receipt")
async def download_receipt_admin(
    payment_id: UUID,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    from app.services.owner_payment_service import OwnerPaymentService
    from app.repositories.payment_proof_repository import PaymentProofRepository
    from app.repositories.owner_repository import OwnerRepository
    from app.repositories.notification_repository import NotificationRepository
    from fastapi.responses import Response

    service = OwnerPaymentService(
        payment_repo=PaymentRepository(db),
        proof_repo=PaymentProofRepository(db),
        owner_repo=OwnerRepository(db),
        notification_repo=NotificationRepository(db),
    )
    pdf_bytes = await service.generate_receipt_pdf(payment_id, admin_request=True)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="recibo_{payment_id}.pdf"'
        },
    )

@router.get("/payments/{payment_id}/acknowledgement")
async def download_acknowledgement_admin(
    payment_id: UUID,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    from app.services.owner_payment_service import OwnerPaymentService
    from app.repositories.payment_proof_repository import PaymentProofRepository
    from app.repositories.owner_repository import OwnerRepository
    from app.repositories.notification_repository import NotificationRepository
    from fastapi.responses import Response

    service = OwnerPaymentService(
        payment_repo=PaymentRepository(db),
        proof_repo=PaymentProofRepository(db),
        owner_repo=OwnerRepository(db),
        notification_repo=NotificationRepository(db),
    )
    pdf_bytes = await service.generate_acknowledgement_pdf(payment_id, admin_request=True)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="constancia_{payment_id}.pdf"'
        },
    )
