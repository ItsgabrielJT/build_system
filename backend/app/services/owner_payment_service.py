"""Servicio para el flujo de pagos del PROPIETARIO (SPEC-008)."""

from __future__ import annotations

import io
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

from app.config.storage import validate_and_store_proof
from app.models.schemas import OwnerPaymentCreate
from app.repositories.notification_repository import NotificationRepository
from app.repositories.owner_repository import OwnerRepository
from app.repositories.payment_proof_repository import PaymentProofRepository
from app.repositories.payment_repository import PaymentRepository

_STATUS_APROBADO = "APROBADO"


class OwnerPaymentService:
    def __init__(
        self,
        payment_repo: PaymentRepository,
        proof_repo: PaymentProofRepository,
        owner_repo: OwnerRepository,
        notification_repo: NotificationRepository,
    ) -> None:
        self._payment_repo = payment_repo
        self._proof_repo = proof_repo
        self._owner_repo = owner_repo
        self._notification_repo = notification_repo

    async def _resolve_owner(self, user_id: UUID) -> dict:
        owner = await self._owner_repo.get_by_user_id(user_id)
        if not owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tiene perfil de propietario vinculado a su cuenta",
            )
        return owner

    async def create_payment(
        self,
        data: OwnerPaymentCreate,
        proof_file: UploadFile,
        user_id: UUID,
    ) -> dict:
        owner = await self._resolve_owner(user_id)
        owner_id: UUID = owner["id"]

        owns = await self._payment_repo.owner_has_apartment(owner_id, data.apartment_id)
        if not owns:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tiene acceso al departamento indicado",
            )

        proof_meta = await validate_and_store_proof(proof_file)

        payment = await self._payment_repo.create_owner_payment(
            data=data,
            owner_id=owner_id,
            created_by=str(user_id),
        )

        await self._proof_repo.create(
            payment_id=payment["id"],
            file_name=proof_meta["file_name"],
            content_type=proof_meta["content_type"],
            storage_path=proof_meta["storage_path"],
            uploaded_by=str(user_id),
        )

        await self._notification_repo.create(
            notification_type="PAGO_PENDIENTE",
            title=f"Pago pendiente de revisión — {data.period}",
            body=(
                f"El propietario {owner['full_name']} envió un comprobante "
                f"de ${data.amount} para el período {data.period}. "
                f"ID pago: {payment['id']}"
            ),
            recipient="ADMIN",
            metadata={"payment_id": str(payment["id"])},
        )

        return {
            "id": payment["id"],
            "status": payment["status"],
            "period": payment["period"],
            "amount": payment["amount"],
            "constancia_disponible": True,
            "created_at": payment["created_at"],
        }

    async def list_payments(
        self,
        user_id: UUID,
        status_filter: str | None = None,
        period: str | None = None,
        apartment_id: UUID | None = None,
    ) -> list[dict]:
        owner = await self._resolve_owner(user_id)
        rows = await self._payment_repo.get_owner_payments(
            owner_id=owner["id"],
            status=status_filter,
            period=period,
            apartment_id=apartment_id,
        )
        return [
            {
                "id": r["id"],
                "period": r["period"],
                "amount": r["amount"],
                "status": r["status"],
                "receipt_available": r["status"] == _STATUS_APROBADO,
                "rejection_reason": r.get("rejection_reason"),
                "apartment_id": r["apartment_id"],
                "apartment_code": r.get("apartment_code"),
                "created_at": r["created_at"],
            }
            for r in rows
        ]

    async def list_notifications(
        self, user_id: UUID, page: int = 1, page_size: int = 20
    ) -> dict:
        data, total = await self._notification_repo.list_for_user(
            user_id=str(user_id),
            page=page,
            page_size=page_size,
        )
        return {
            "data": data,
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def get_payment_for_owner(self, payment_id: UUID, user_id: UUID) -> dict:
        owner = await self._resolve_owner(user_id)
        payment = await self._payment_repo.get_by_id_for_owner(
            payment_id=payment_id, owner_id=owner["id"]
        )
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pago no encontrado",
            )
        return payment

    async def generate_acknowledgement_pdf(
        self, payment_id: UUID, user_id: UUID
    ) -> bytes:
        """Genera la constancia de envío del comprobante en PDF."""
        payment = await self.get_payment_for_owner(payment_id, user_id)
        owner = await self._resolve_owner(user_id)
        proof = await self._proof_repo.get_latest_by_payment(payment_id)

        output = io.BytesIO()
        doc = SimpleDocTemplate(
            output,
            pagesize=letter,
            topMargin=0.8 * inch,
            bottomMargin=0.8 * inch,
        )
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "ConstanciaTitle",
            parent=styles["Heading1"],
            fontSize=16,
            textColor=colors.HexColor("#1f2937"),
            spaceAfter=8,
        )
        story = [
            Paragraph("Constancia de Envío de Comprobante", title_style),
            Paragraph(
                f"Generado: {datetime.utcnow().strftime('%d/%m/%Y %H:%M')} UTC",
                styles["Normal"],
            ),
            Spacer(1, 0.2 * inch),
        ]

        data = [
            ["Campo", "Valor"],
            ["ID Pago", str(payment["id"])],
            ["Estado", payment["status"]],
            ["Propietario", owner["full_name"]],
            ["Departamento", payment.get("apartment_code") or "—"],
            ["Período", payment["period"]],
            ["Fecha de Pago", str(payment["paid_at"])],
            ["Monto", f"${float(payment['amount']):.2f}"],
            ["Método", payment.get("method") or "—"],
            ["Referencia", payment.get("reference") or "—"],
            [
                "Comprobante",
                proof["file_name"] if proof else "No registrado",
            ],
            [
                "Fecha de Envío",
                payment["created_at"].strftime("%d/%m/%Y %H:%M") if payment.get("created_at") else "—",
            ],
        ]

        table = Table(data, colWidths=[2.5 * inch, 4 * inch])
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("BACKGROUND", (0, 1), (-1, -1), colors.beige),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.append(table)
        story.append(Spacer(1, 0.3 * inch))
        story.append(
            Paragraph(
                "Esta constancia certifica que el comprobante fue recibido por el sistema "
                "y está pendiente de revisión administrativa. "
                "No equivale al recibo oficial de pago.",
                styles["Normal"],
            )
        )

        doc.build(story)
        return output.getvalue()

    async def generate_receipt_pdf(
        self, payment_id: UUID, user_id: UUID
    ) -> bytes:
        """Genera el recibo oficial del pago aprobado en PDF."""
        payment = await self.get_payment_for_owner(payment_id, user_id)

        if payment["status"] != _STATUS_APROBADO:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El recibo oficial solo está disponible para pagos aprobados",
            )

        owner = await self._resolve_owner(user_id)

        output = io.BytesIO()
        doc = SimpleDocTemplate(
            output,
            pagesize=letter,
            topMargin=0.8 * inch,
            bottomMargin=0.8 * inch,
        )
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "ReciboTitle",
            parent=styles["Heading1"],
            fontSize=18,
            textColor=colors.HexColor("#065f46"),
            spaceAfter=8,
        )
        subtitle_style = ParagraphStyle(
            "ReciboSubtitle",
            parent=styles["Normal"],
            fontSize=11,
            textColor=colors.HexColor("#374151"),
        )
        story = [
            Paragraph("Recibo Oficial de Pago", title_style),
            Paragraph(
                f"Emitido: {datetime.utcnow().strftime('%d/%m/%Y %H:%M')} UTC",
                subtitle_style,
            ),
            Spacer(1, 0.25 * inch),
        ]

        approved_at = payment.get("approved_at")
        approved_at_str = (
            approved_at.strftime("%d/%m/%Y %H:%M")
            if approved_at
            else "—"
        )

        data = [
            ["Campo", "Valor"],
            ["ID Recibo", str(payment["id"])],
            ["Estado", "APROBADO"],
            ["Propietario", owner["full_name"]],
            ["Departamento", payment.get("apartment_code") or "—"],
            ["Período", payment["period"]],
            ["Fecha de Pago", str(payment["paid_at"])],
            ["Monto Aprobado", f"${float(payment['amount']):.2f}"],
            ["Método", payment.get("method") or "—"],
            ["Referencia", payment.get("reference") or "—"],
            ["Aprobado por", payment.get("approved_by") or "—"],
            ["Fecha de Aprobación", approved_at_str],
        ]

        table = Table(data, colWidths=[2.5 * inch, 4 * inch])
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#065f46")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#ecfdf5")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.append(table)
        story.append(Spacer(1, 0.3 * inch))
        story.append(
            Paragraph(
                "Este recibo oficial certifica que el pago fue revisado y aprobado "
                "por la administración del edificio.",
                styles["Normal"],
            )
        )

        doc.build(story)
        return output.getvalue()
