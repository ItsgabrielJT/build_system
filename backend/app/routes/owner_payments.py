"""Endpoints de pagos para el PROPIETARIO (SPEC-008).

Rutas:
  POST   /api/v1/owner/payments                             — crear solicitud
  GET    /api/v1/owner/payments                             — listar pagos propios
  GET    /api/v1/owner/payments/{payment_id}/acknowledgement — constancia PDF
  GET    /api/v1/owner/payments/{payment_id}/receipt         — recibo oficial PDF
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import Response

from app.auth.dependencies import require_owner
from app.config.database import get_db
from app.models.schemas import OwnerPaymentCreate
from app.repositories.notification_repository import NotificationRepository
from app.repositories.owner_repository import OwnerRepository
from app.repositories.payment_proof_repository import PaymentProofRepository
from app.repositories.payment_repository import PaymentRepository
from app.services.owner_payment_service import OwnerPaymentService

router = APIRouter(prefix="/owner/payments", tags=["owner-payments"])


def _build_service(db) -> OwnerPaymentService:
    return OwnerPaymentService(
        payment_repo=PaymentRepository(db),
        proof_repo=PaymentProofRepository(db),
        owner_repo=OwnerRepository(db),
        notification_repo=NotificationRepository(db),
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_owner_payment(
    apartment_id: UUID = Form(...),
    period: str = Form(...),
    paid_at: str = Form(...),
    amount: str = Form(...),
    method: Optional[str] = Form(None),
    reference: Optional[str] = Form(None),
    proof_file: UploadFile = File(...),
    user: dict = Depends(require_owner),
    db=Depends(get_db),
):
    """Registra una solicitud de pago con comprobante adjunto."""
    from datetime import date
    from decimal import Decimal

    data = OwnerPaymentCreate(
        apartment_id=apartment_id,
        period=period,
        paid_at=date.fromisoformat(paid_at),
        amount=Decimal(amount),
        method=method,
        reference=reference,
    )
    service = _build_service(db)
    return await service.create_payment(
        data=data,
        proof_file=proof_file,
        user_id=user["user_id"],
    )


@router.get("")
async def list_owner_payments(
    status: Optional[str] = None,
    period: Optional[str] = None,
    apartment_id: Optional[UUID] = None,
    user: dict = Depends(require_owner),
    db=Depends(get_db),
):
    """Lista los pagos del propietario autenticado."""
    service = _build_service(db)
    return await service.list_payments(
        user_id=user["user_id"],
        status_filter=status,
        period=period,
        apartment_id=apartment_id,
    )


@router.get("/{payment_id}/acknowledgement")
async def download_acknowledgement(
    payment_id: UUID,
    user: dict = Depends(require_owner),
    db=Depends(get_db),
):
    """Descarga la constancia de envío del comprobante en PDF."""
    service = _build_service(db)
    pdf_bytes = await service.generate_acknowledgement_pdf(
        payment_id=payment_id,
        user_id=user["user_id"],
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="constancia-{payment_id}.pdf"'
        },
    )


@router.get("/{payment_id}/receipt")
async def download_receipt(
    payment_id: UUID,
    user: dict = Depends(require_owner),
    db=Depends(get_db),
):
    """Descarga el recibo oficial del pago aprobado en PDF."""
    service = _build_service(db)
    pdf_bytes = await service.generate_receipt_pdf(
        payment_id=payment_id,
        user_id=user["user_id"],
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="recibo-{payment_id}.pdf"'
        },
    )
