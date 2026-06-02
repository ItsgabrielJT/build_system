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
from reportlab.graphics.shapes import Circle, Drawing, Line, Rect, String

from app.config.storage import validate_and_store_proof
from app.models.schemas import OwnerPaymentCreate
from app.repositories.notification_repository import NotificationRepository
from app.repositories.owner_repository import OwnerRepository
from app.repositories.payment_proof_repository import PaymentProofRepository
from app.repositories.payment_repository import PaymentRepository

_STATUS_APROBADO = "APROBADO"
_PRIMARY_BLUE = colors.HexColor("#123c7a")
_ACCENT_BLUE = colors.HexColor("#dbe7f7")
_SUCCESS_GREEN = colors.HexColor("#1f8f4d")
_SUCCESS_BG = colors.HexColor("#edf9f0")
_DANGER_RED = colors.HexColor("#c74444")
_SLATE = colors.HexColor("#243447")
_SOFT_GRAY = colors.HexColor("#eef2f7")


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

    def _build_pdf_doc(
        self,
        output: io.BytesIO,
        *,
        title: str,
        subject: str,
    ) -> SimpleDocTemplate:
        doc = SimpleDocTemplate(
            output,
            pagesize=letter,
            topMargin=0.45 * inch,
            bottomMargin=0.45 * inch,
            leftMargin=0.45 * inch,
            rightMargin=0.45 * inch,
            pageCompression=0,
        )
        doc.title = title
        doc.subject = subject
        doc.author = "Build System"
        return doc

    def _base_pdf_styles(self) -> dict:
        styles = getSampleStyleSheet()
        return {
            "body": ParagraphStyle(
                "PaymentBody",
                parent=styles["BodyText"],
                fontName="Helvetica",
                fontSize=9,
                leading=12,
                textColor=_SLATE,
            ),
            "muted": ParagraphStyle(
                "PaymentMuted",
                parent=styles["BodyText"],
                fontName="Helvetica",
                fontSize=8.5,
                leading=11,
                textColor=colors.HexColor("#5f6b7a"),
            ),
            "section": ParagraphStyle(
                "PaymentSection",
                parent=styles["BodyText"],
                fontName="Helvetica-Bold",
                fontSize=10.5,
                leading=12,
                textColor=colors.white,
            ),
            "value": ParagraphStyle(
                "PaymentValue",
                parent=styles["BodyText"],
                fontName="Helvetica-Bold",
                fontSize=12,
                leading=14,
                textColor=colors.black,
            ),
            "footer": ParagraphStyle(
                "PaymentFooter",
                parent=styles["BodyText"],
                fontName="Helvetica",
                fontSize=8.5,
                leading=11,
                alignment=1,
                textColor=colors.HexColor("#4b5563"),
            ),
        }

    def _format_date(self, value: object) -> str:
        if value is None:
            return "--"
        if hasattr(value, "strftime"):
            return value.strftime("%d/%m/%Y")
        return str(value)

    def _format_datetime(self, value: object) -> str:
        if value is None:
            return "--"
        if hasattr(value, "strftime"):
            return value.strftime("%d/%m/%Y %H:%M")
        return str(value)

    def _format_currency(self, value: Decimal | float | int | None) -> str:
        amount = Decimal(str(value or 0)).quantize(Decimal("0.01"))
        return f"USD {amount:,.2f}"

    def _format_period_label(self, period: str | None) -> str:
        if not period or "-" not in period:
            return period or "Periodo no definido"
        year_str, month_str = period.split("-", 1)
        months = {
            "01": "enero",
            "02": "febrero",
            "03": "marzo",
            "04": "abril",
            "05": "mayo",
            "06": "junio",
            "07": "julio",
            "08": "agosto",
            "09": "septiembre",
            "10": "octubre",
            "11": "noviembre",
            "12": "diciembre",
        }
        return f"{months.get(month_str, month_str)} de {year_str}"

    def _build_document_number(self, payment: dict, prefix: str) -> str:
        import random
        import string
        suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        return f"{prefix}-{payment['period']}-{suffix}"

    def _build_logo_drawing(self) -> Drawing:
        drawing = Drawing(110, 74)
        drawing.add(Rect(2, 6, 106, 62, strokeColor=_PRIMARY_BLUE, fillColor=colors.white, rx=8, ry=8))
        drawing.add(String(55, 36, "BUILD", fontName="Helvetica-Bold", fontSize=16, fillColor=_PRIMARY_BLUE, textAnchor="middle"))
        drawing.add(String(55, 20, "SYSTEM", fontName="Helvetica-Bold", fontSize=12, fillColor=colors.HexColor("#6b7280"), textAnchor="middle"))
        return drawing



    def _build_header_table(
        self,
        title: str,
        subtitle: str,
        document_number: str,
    ) -> Table:
        title_block = Table(
            [[
                Paragraph(
                    f'<font size="22"><b>{title}</b></font><br/><font size="11">{subtitle}</font>',
                    ParagraphStyle(
                        "HeaderTitle",
                        fontName="Helvetica",
                        leading=16,
                        textColor=_PRIMARY_BLUE,
                    ),
                )
            ]],
            colWidths=[2.7 * inch],
        )
        title_block.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))

        doc_box = Table(
            [
                [Paragraph('<font size="10">Documento No.:</font>', ParagraphStyle("DocLabel", fontName="Helvetica", alignment=1, textColor=_SLATE))],
                [Paragraph(f'<font size="14"><b>{document_number}</b></font>', ParagraphStyle("DocNumber", fontName="Helvetica-Bold", alignment=1, textColor=_PRIMARY_BLUE))],
            ],
            colWidths=[1.8 * inch],
        )
        doc_box.setStyle(
            TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 1.2, _PRIMARY_BLUE),
                    ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ]
            )
        )

        header = Table(
            [[self._build_logo_drawing(), title_block, doc_box]],
            colWidths=[2.2 * inch, 2.9 * inch, 1.9 * inch],
        )
        header.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )
        return header

    def _build_section_title(self, title: str) -> Table:
        table = Table([[Paragraph(title, self._base_pdf_styles()["section"])]], colWidths=[7.0 * inch])
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), _PRIMARY_BLUE),
                    ("LEFTPADDING", (0, 0), (-1, -1), 12),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        return table

    def _build_owner_info_table(self, owner: dict, payment: dict, styles: dict) -> Table:
        rows = []
        info_items = [
            ("Propietario", owner.get("full_name") or "--"),
            ("Departamento", payment.get("apartment_code") or "--"),
            ("Periodo", payment.get("period") or "--"),
            ("Telefono", owner.get("phone") or "--"),
            ("Email", owner.get("email") or "--"),
        ]
        for label, value in info_items:
            rows.append(
                [
                    Paragraph(f'<font size="9" color="#5f6b7a">{label}</font>', styles["muted"]),
                    Paragraph(f'<font size="12"><b>{value}</b></font>', styles["value"]),
                ]
            )

        content = [[self._build_section_title("DATOS DEL PROPIETARIO")]]
        for row in rows:
            content.append([Table([row], colWidths=[2.5 * inch, 4.0 * inch])])

        owner_table = Table(content, colWidths=[7.0 * inch])
        owner_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                    ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#d1dae8")),
                    ("LEFTPADDING", (0, 1), (-1, -1), 12),
                    ("RIGHTPADDING", (0, 1), (-1, -1), 12),
                    ("TOPPADDING", (0, 1), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 1), (-1, -1), 10),
                ]
            )
        )
        return owner_table

    def _build_detail_table(self, detail_rows: list[list[Paragraph | str]]) -> Table:
        table = Table(detail_rows, colWidths=[4.8 * inch, 2.2 * inch])
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), _ACCENT_BLUE),
                    ("TEXTCOLOR", (0, 0), (-1, 0), _PRIMARY_BLUE),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("LINEBELOW", (0, 0), (-1, 0), 1.2, colors.HexColor("#b8c9e6")),
                    ("LINEBELOW", (0, 1), (-1, -2), 0.5, colors.HexColor("#d6e0ef")),
                    ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#d1dae8")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 12),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                    ("TOPPADDING", (0, 0), (-1, -1), 9),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                    ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                    ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f6fbff")),
                ]
            )
        )
        return table

    def _build_status_banner(self, status_text: str, ok: bool = True) -> Table:
        icon_color = _SUCCESS_GREEN if ok else _DANGER_RED
        bg_color = _SUCCESS_BG if ok else colors.HexColor("#fff2f2")
        border_color = icon_color
        drawing = Drawing(18, 18)
        drawing.add(Circle(9, 9, 8, fillColor=icon_color, strokeColor=icon_color))
        drawing.add(String(9, 5, "OK" if ok else "!", fontName="Helvetica-Bold", fontSize=8, fillColor=colors.white, textAnchor="middle"))
        banner = Table(
            [[drawing, Paragraph(f'<font size="16"><b>Estado: {status_text}</b></font>', ParagraphStyle("StatusText", fontName="Helvetica-Bold", textColor=icon_color, leading=16))]],
            colWidths=[0.35 * inch, 6.65 * inch],
        )
        banner.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), bg_color),
                    ("BOX", (0, 0), (-1, -1), 1.2, border_color),
                    ("LEFTPADDING", (0, 0), (-1, -1), 12),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )
        return banner

    def _build_footer(self, styles: dict, signer_label: str) -> list:
        signature = Table(
            [
                [""],
                [Paragraph(f"<b>{signer_label}</b><br/>Administracion del edificio", styles["footer"])],
            ],
            colWidths=[2.6 * inch],
        )
        signature.setStyle(
            TableStyle(
                [
                    ("LINEABOVE", (0, 0), (-1, 0), 1, _PRIMARY_BLUE),
                    ("TOPPADDING", (0, 0), (-1, 0), 12),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
                    ("TOPPADDING", (0, 1), (-1, 1), 4),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ]
            )
        )
        return [
            Table(
                [[Paragraph("Documento emitido electronicamente con fines de control administrativo.", styles["muted"]) ]],
                colWidths=[7.0 * inch],
            ),
            Spacer(1, 0.18 * inch),
            signature,
        ]

    def _build_payment_story(
        self,
        *,
        title: str,
        subtitle: str,
        document_number: str,
        owner: dict,
        payment: dict,
        detail_rows: list[list[str]],
        status_text: str,
        signer_label: str,
        ok: bool = True,
    ) -> list:
        styles = self._base_pdf_styles()
        story = [
            self._build_header_table(title, subtitle, document_number),
            Spacer(1, 0.14 * inch),
            Table([["" ]], colWidths=[7.0 * inch], rowHeights=[0.03 * inch], style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), _PRIMARY_BLUE)])),
            Spacer(1, 0.14 * inch),
            self._build_owner_info_table(owner, payment, styles),
            Spacer(1, 0.16 * inch),
            self._build_section_title("DETALLE DEL PAGO"),
            self._build_detail_table(detail_rows),
            Spacer(1, 0.16 * inch),
            self._build_status_banner(status_text, ok=ok),
            Spacer(1, 0.16 * inch),
        ]
        story.extend(self._build_footer(styles, signer_label))
        return story

    async def generate_acknowledgement_pdf(
        self, payment_id: UUID, user_id: UUID = None, admin_request: bool = False
    ) -> bytes:
        """Genera la constancia de envío del comprobante en PDF."""
        if admin_request:
            payment = await self._payment_repo.get_by_id(payment_id)
            if not payment:
                raise HTTPException(status_code=404, detail="Pago no encontrado")
            owner = await self._owner_repo.get_by_id(payment["owner_id"])
        else:
            payment = await self.get_payment_for_owner(payment_id, user_id)
            owner = await self._resolve_owner(user_id)

        proof = await self._proof_repo.get_latest_by_payment(payment_id)

        output = io.BytesIO()
        doc = self._build_pdf_doc(
            output,
            title="CONSTANCIA DE PAGO",
            subject="DATOS DEL PROPIETARIO | DETALLE DEL PAGO | CONSTANCIA",
        )
        detail_rows = [
            ["CONCEPTO", "VALOR (USD)"],
            ["Monto reportado por el propietario", self._format_currency(payment["amount"])],
            ["Fecha de pago", self._format_date(payment.get("paid_at"))],
            ["Metodo de pago", (payment.get("method") or "--").upper()],
            ["Referencia", payment.get("reference") or "--"],
            ["Comprobante cargado", proof["file_name"] if proof else "No registrado"],
            ["Estado actual", "PENDIENTE DE REVISION"],
        ]
        story = self._build_payment_story(
            title="CONSTANCIA DE PAGO",
            subtitle=f"Solicitud registrada en {self._format_period_label(payment.get('period'))}",
            document_number=self._build_document_number(payment, "C"),
            owner=owner,
            payment=payment,
            detail_rows=detail_rows,
            status_text="Comprobante recibido",
            signer_label="Revision administrativa pendiente",
        )
        doc.build(story)
        return output.getvalue()

    async def generate_receipt_pdf(
        self, payment_id: UUID, user_id: UUID = None, admin_request: bool = False
    ) -> bytes:
        """Genera el recibo oficial del pago aprobado en PDF."""
        if admin_request:
            payment = await self._payment_repo.get_by_id(payment_id)
            if not payment:
                raise HTTPException(status_code=404, detail="Pago no encontrado")
            owner = await self._owner_repo.get_by_id(payment["owner_id"])
        else:
            payment = await self.get_payment_for_owner(payment_id, user_id)
            owner = await self._resolve_owner(user_id)

        if payment["status"] != _STATUS_APROBADO:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El recibo oficial solo está disponible para pagos aprobados",
            )


        output = io.BytesIO()
        approved_at = payment.get("approved_at")
        doc = self._build_pdf_doc(
            output,
            title="RECIBO DE PAGO",
            subject="DATOS DEL PROPIETARIO | DETALLE DEL PAGO | RECIBO APROBADO",
        )
        detail_rows = [
            ["CONCEPTO", "VALOR (USD)"],
            ["Monto aprobado", self._format_currency(payment["amount"])],
            ["Fecha de pago", self._format_date(payment.get("paid_at"))],
            ["Fecha de aprobacion", self._format_datetime(approved_at)],
            ["Metodo de pago", (payment.get("method") or "--").upper()],
            ["Referencia", payment.get("reference") or "--"],
            ["Saldo final registrado", self._format_currency(Decimal("0.00"))],
        ]
        story = self._build_payment_story(
            title="RECIBO DE PAGO",
            subtitle=f"Pago registrado en {self._format_period_label(payment.get('period'))}",
            document_number=self._build_document_number(payment, "R"),
            owner=owner,
            payment=payment,
            detail_rows=detail_rows,
            status_text="Pago aprobado",
            signer_label=payment.get("approved_by") or "Administracion",
        )
        doc.build(story)
        return output.getvalue()
