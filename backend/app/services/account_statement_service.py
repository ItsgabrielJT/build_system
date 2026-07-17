from __future__ import annotations

import io
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional
from uuid import UUID
from xml.sax.saxutils import escape

from app.config.settings import settings
from app.repositories.delinquency_repository import DelinquencyRepository
from app.repositories.owner_repository import OwnerRepository
from app.services.delinquency_service import _period_status, _saldo
from app.services.pdf_branding import (
    build_pdf_footer_bar,
    build_pdf_signature_seal_qr_grid,
    get_building_contact_lines,
    get_building_logo,
    get_building_name,
    get_default_building_config,
)

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


class AccountStatementService:
    def __init__(
        self,
        delinquency_repo: DelinquencyRepository,
        owner_repo: OwnerRepository,
    ) -> None:
        self._delinquency_repo = delinquency_repo
        self._owner_repo = owner_repo

    async def resolve_owner_id(
        self, user: dict, requested_owner_id: Optional[UUID] = None
    ) -> UUID | None:
        """
        ADMIN puede pasar owner_id explícito.
        PROPIETARIO se resuelve automáticamente por firebase_uid.
        """
        if user.get("role") == "ADMIN" and requested_owner_id:
            return requested_owner_id

        owner = await self._owner_repo.get_by_firebase_uid(str(user["user_id"]))
        return owner["id"] if owner else None

    async def get_statement(
        self,
        owner_id: UUID,
        start_period: Optional[str],
        end_period: Optional[str],
    ) -> list[dict]:
        rows = await self._delinquency_repo.get_statement_data(
            owner_id, start_period, end_period
        )
        result = []
        for row in rows:
            s = _saldo(
                Decimal(str(row["esperado"])),
                Decimal(str(row["multas"])),
                Decimal(str(row["pagado"])),
            )
            ps = _period_status(row["period"], s, settings.due_day, Decimal(str(row["esperado"])))
            result.append(
                {
                    "period": row["period"],
                    "apartment_id": row["apartment_id"],
                    "apartment_code": row["apartment_code"],
                    "esperado": float(row["esperado"]),
                    "multas": float(row["multas"]),
                    "pagado": float(row["pagado"]),
                    "saldo": float(s),
                    "status": ps,
                }
            )
        return result

    def _money(self, value) -> str:
        return f"${float(Decimal(str(value or 0))):,.2f}"

    def _usd(self, value) -> str:
        return f"USD {float(Decimal(str(value or 0))):,.2f}"

    def _spanish_date(self, value: date) -> str:
        months = [
            "enero", "febrero", "marzo", "abril", "mayo", "junio",
            "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
        ]
        return f"{value.day:02d} de {months[value.month - 1]} de {value.year}"

    def _status_label(self, status: str | None) -> str:
        labels = {
            "CURRENT": "Al día",
            "OVERDUE": "Vencido",
        }
        return labels.get((status or "").upper(), status or "")

    def _p(self, text: str, size: int = 8, *, bold: bool = False, color="#102a56", align: str = "LEFT", raw: bool = False) -> Paragraph:
        safe = str(text or "") if raw else escape(str(text or ""))
        return Paragraph(
            f'<font color="{color}">{"<b>" if bold else ""}{safe}{"</b>" if bold else ""}</font>',
            ParagraphStyle(
                f"AccountPdf{size}{bold}{align}",
                fontName="Helvetica-Bold" if bold else "Helvetica",
                fontSize=size,
                leading=size + 4,
                alignment={"LEFT": 0, "CENTER": 1, "RIGHT": 2, "JUSTIFY": 4}.get(align, 0),
            ),
        )

    async def _owner_profile(self, owner_id: UUID) -> dict | None:
        owner = await self._owner_repo.get_by_id_with_apartments(owner_id)
        if not owner:
            return None
        balance = await self._owner_repo._conn.fetchval(
            """
            SELECT COALESCE(SUM(af.amount - COALESCE(p.paid_amount, 0) + COALESCE(f.fine_amount, 0)), 0)
            FROM owner_apartments oa
            JOIN apartment_fees af ON af.apartment_id = oa.apartment_id
            LEFT JOIN (
                SELECT apartment_id, period, SUM(amount) AS paid_amount
                FROM payments
                WHERE status IN ('REGISTRADO', 'APROBADO') AND fine_id IS NULL
                GROUP BY apartment_id, period
            ) p ON p.apartment_id = af.apartment_id AND p.period = af.period
            LEFT JOIN (
                SELECT apartment_id, period, SUM(amount) AS fine_amount
                FROM fines
                WHERE status = 'ACTIVA'
                GROUP BY apartment_id, period
            ) f ON f.apartment_id = af.apartment_id AND f.period = af.period
            WHERE oa.owner_id = $1
            """,
            owner_id,
        )
        last_payment = await self._owner_repo._conn.fetchrow(
            """
            SELECT paid_at, amount, method, reference
            FROM (
                SELECT paid_at, amount, method, reference, created_at
                FROM payments
                WHERE owner_id = $1 AND status IN ('REGISTRADO', 'APROBADO')
                UNION ALL
                SELECT date AS paid_at, amount, method, reference, created_at
                FROM incomes
                WHERE owner_id = $1 AND status = 'REGISTRADO'
            ) income_sources
            ORDER BY paid_at DESC, created_at DESC
            LIMIT 1
            """,
            owner_id,
        )
        owner["balance"] = Decimal(str(balance or 0))
        owner["last_payment"] = dict(last_payment) if last_payment else None
        return owner

    def _doc_header(
        self,
        title: str,
        doc_no: str,
        building: dict | None,
        width: float,
        *,
        alert_message: str | None = None,
        alert_label: str | None = None,
        alert_color: str = "#2f9b43",
    ) -> Table:
        building_name = get_building_name(building)
        logo = get_building_logo(building, max_width=4.0 * cm, max_height=2.55 * cm)
        if not logo:
            logo = self._p(
                f"<font size='14'><b>{escape(building_name.upper())}</b></font><br/><font size='8'>Administración del Edificio</font>",
                9,
                raw=True,
            )

        left_width = width * 0.23
        center_width = width * 0.45
        right_width = width * 0.32

        left = Table([[logo]], colWidths=[left_width])
        left.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ]))

        center_rows = [
            [
                self._p(
                    f"<font size='16'><b>{escape(title.upper()).replace(' DE ', ' DE<br/>')}</b></font>",
                    12,
                    color="#092b62",
                    align="CENTER",
                    raw=True,
                )
            ]
        ]
        row_heights = [1.32 * cm]
        if alert_message or alert_label:
            alert_width = max(center_width * 0.78, 1 * cm)
            alert = Table(
                [
                    [self._p(alert_message or "", 6, color="#092b62", align="CENTER")],
                    [self._p(alert_label or "", 12, bold=True, color="#ffffff", align="CENTER")],
                ],
                colWidths=[alert_width],
                rowHeights=[0.70 * cm, 0.62 * cm],
            )
            alert.setStyle(TableStyle([
                ("BACKGROUND", (0, 1), (0, 1), colors.HexColor(alert_color)),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d4dfef")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]))
            center_rows.append([alert])
            row_heights.append(1.32 * cm)

        center = Table(center_rows, colWidths=[center_width], rowHeights=row_heights)
        center.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ]))

        right = self._p(
            f"<font size='15'><b>{escape(doc_no)}</b></font><br/><br/>Fecha de emisión: {self._spanish_date(date.today())}<br/>Documento emitido automáticamente",
            10,
            align="RIGHT",
            raw=True,
        )
        header = Table([[left, center, right]], colWidths=[left_width, center_width, right_width])
        header.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOX", (0, 0), (-1, -1), 0.9, colors.HexColor("#123c7a")),
            ("LINEBEFORE", (1, 0), (1, 0), 0.7, colors.HexColor("#9aa8bd")),
            ("LINEBEFORE", (2, 0), (2, 0), 0.7, colors.HexColor("#9aa8bd")),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ]))
        return header

    def _report_style_doc_header(self, title: str, doc_no: str, building: dict | None, width: float) -> list:
        logo = get_building_logo(building, max_width=2.8 * cm, max_height=2.4 * cm)
        if not logo:
            logo = self._p(
                f"<b>{escape(get_building_name(building).upper())}</b>",
                10,
                bold=True,
                align="CENTER",
                raw=True,
            )

        title_block = Paragraph(
            f"<font size='18'><b>{escape(title)}</b></font><br/><font size='9'>Emitido el {escape(self._spanish_date(date.today()))}</font>",
            ParagraphStyle(
                "AccountHeaderTitle",
                fontName="Helvetica",
                fontSize=12,
                leading=22,
                textColor="#082f6f",
                alignment=1,
            ),
        )

        info_width = 4.3 * cm
        info_table = Table(
            [
                [self._p("Documento", 8, bold=True, color="#123c7a", align="LEFT")],
                [self._p(doc_no, 10, bold=True, color="#123c7a", align="LEFT")],
                [self._p("Documento emitido automaticamente", 8, color="#4b5563", align="LEFT")],
            ],
            colWidths=[info_width],
        )
        info_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#123c7a")),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d4dfef")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        header = Table([[logo, title_block, info_table]], colWidths=[3.2 * cm, width - 7.5 * cm, info_width])
        header.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 1.2, colors.HexColor("#123c7a")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (0, 0), (1, -1), "CENTER"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (2, 0), (2, 0), 0),
            ("RIGHTPADDING", (2, 0), (2, 0), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ("LINEAFTER", (0, 0), (0, 0), 0.8, colors.HexColor("#123c7a")),
            ("LINEAFTER", (1, 0), (1, 0), 0.8, colors.HexColor("#123c7a")),
        ]))
        return [header, Spacer(1, 0.2 * cm)]

    def _blue_table(self, data: list[list], col_widths: list[float], *, font_size: int = 7, total_rows: Optional[list[int]] = None) -> Table:
        table = Table(data, colWidths=col_widths, repeatRows=1)
        style = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#002e6d")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), font_size + 1),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
            ("ALIGN", (0, 1), (-1, -1), "LEFT"),
            ("ALIGN", (2, 1), (5, -1), "RIGHT"),
            ("ALIGN", (-1, 1), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#c8d6e8")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7faff")]),
            ("FONTSIZE", (0, 1), (-1, -1), font_size),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]
        for row in total_rows or []:
            style.extend([
                ("BACKGROUND", (0, row), (-1, row), colors.HexColor("#edf4ff")),
                ("FONTNAME", (0, row), (-1, row), "Helvetica-Bold"),
            ])
        table.setStyle(TableStyle(style))
        return table

    def _signature_grid(
        self,
        *,
        width: float,
        building: dict | None,
        document_tag: str,
        signer_name: str,
        signer_role: str,
        file_name: str | None = None,
    ) -> Table:
        qr_value = f"{document_tag}|{datetime.now().strftime('%Y%m%d%H%M%S')}|{get_building_name(building)}"
        return build_pdf_signature_seal_qr_grid(
            building,
            width=width,
            qr_value=qr_value,
            signer_name=signer_name,
            signer_role=signer_role,
            file_name=file_name,
        )

    async def statement_pdf(self, owner_id: UUID, start_period: Optional[str], end_period: Optional[str]) -> bytes:
        rows = await self.get_statement(owner_id, start_period, end_period)
        profile = await self._owner_profile(owner_id)
        building = await get_default_building_config(self._owner_repo._conn)
        output = io.BytesIO()
        width = A4[0] - 2 * cm
        doc = SimpleDocTemplate(output, pagesize=A4, leftMargin=1 * cm, rightMargin=1 * cm, topMargin=0.9 * cm, bottomMargin=2.3 * cm)

        def draw_footer(canvas, pdf_doc):
            canvas.saveState()
            footer = build_pdf_footer_bar(building, width=pdf_doc.width, page_text=f"Página {canvas.getPageNumber()}")
            _, footer_height = footer.wrap(pdf_doc.width, pdf_doc.bottomMargin)
            footer_y = max(0.35 * cm, pdf_doc.bottomMargin - footer_height)
            footer.drawOn(canvas, pdf_doc.leftMargin, footer_y)
            canvas.restoreState()

        story = [*self._report_style_doc_header("Estado de Cuenta", f"N. EC-{date.today().year}-000245", building, width)]
        story.append(Spacer(1, 0.18 * cm))
        owner = profile or {}
        apt = (owner.get("apartments") or [{}])[0]
        owner_box = Table(
            [[
                self._p(f"<b>{escape(owner.get('full_name') or 'Propietario')}</b><br/>Copropietario<br/><br/>{escape(apt.get('code') or '')} - Torre {escape(str(apt.get('tower') or ''))} - Piso {escape(str(apt.get('floor') or ''))}<br/>{escape(owner.get('email') or '')}<br/>{escape(owner.get('phone') or '')}<br/>C.I.: {escape(owner.get('document_id') or '')}", 9, raw=True),
                self._p(f"<b>Unidad:</b> {escape(apt.get('code') or '')}<br/><br/><b>Área:</b> {escape(str(apt.get('area_sqm') or ''))} m²<br/><br/><b>Porcentaje de alícuota:</b> 2.45 %<br/><br/><b>Próximo vencimiento:</b> {(date.today().replace(day=1) + timedelta(days=35)).replace(day=settings.due_day).strftime('%d/%m/%Y')}", 9, raw=True),
            ]],
            colWidths=[width * 0.49, width * 0.49],
        )
        owner_box.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#c8d6e8")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 12), ("TOPPADDING", (0, 0), (-1, -1), 12), ("BOTTOMPADDING", (0, 0), (-1, -1), 12)]))
        story.append(owner_box)
        totals = {
            "esperado": sum(Decimal(str(r.get("esperado", 0))) for r in rows),
            "multas": sum(Decimal(str(r.get("multas", 0))) for r in rows),
            "pagado": sum(Decimal(str(r.get("pagado", 0))) for r in rows),
            "saldo": sum(Decimal(str(r.get("saldo", 0))) for r in rows),
        }
        story.append(Spacer(1, 0.32 * cm))
        saldo_val = totals["saldo"]
        if saldo_val < 0:
            saldo_text = f"Saldo actual (A favor)<br/><font size='14'><b>{self._money(abs(saldo_val))}</b></font>"
            saldo_color = "#159447"
        else:
            saldo_text = f"Saldo actual<br/><font size='14'><b>{self._money(saldo_val)}</b></font>"
            saldo_color = "#c91f1f" if saldo_val > 0 else "#159447"

        summary = Table([[
            self._p(saldo_text, 8, color=saldo_color, raw=True),
            self._p(f"Total ingresos<br/><font size='14'><b>{self._money(totals['pagado'])}</b></font>", 8, color="#159447", raw=True),
            self._p(f"Total egresos<br/><font size='14'><b>-{self._money(totals['esperado'] + totals['multas'])}</b></font>", 8, color="#c91f1f", raw=True),
            self._p(f"Total pagos realizados<br/><font size='14'><b>{self._money(totals['pagado'])}</b></font>", 8, color="#1f5bd8", raw=True),
        ]], colWidths=[width / 4] * 4)
        summary.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#d4dfef")), ("INNERGRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#d4dfef")), ("BACKGROUND", (0, 0), (-1, -1), colors.white), ("TOPPADDING", (0, 0), (-1, -1), 12), ("BOTTOMPADDING", (0, 0), (-1, -1), 12)]))
        story.append(summary)
        story.append(Spacer(1, 0.3 * cm))
        story.append(self._p("DETALLE DE MOVIMIENTOS", 10, bold=True, color="#0c42a0"))
        data = [["PERIODO", "DEPARTAMENTO", "ESPERADO", "MULTAS", "PAGADO", "SALDO", "ESTADO"]]
        for row in rows:
            s_val = Decimal(str(row["saldo"]))
            s_str = f"{self._money(abs(s_val))} A favor" if s_val < 0 else self._money(s_val)
            data.append([row["period"], row["apartment_code"], self._money(row["esperado"]), self._money(row["multas"]), self._money(row["pagado"]), s_str, self._status_label(row["status"])])
        
        total_s_val = totals["saldo"]
        total_s_str = f"{self._money(abs(total_s_val))} A favor" if total_s_val < 0 else self._money(total_s_val)
        data.append(["TOTALES DEL PERIODO", "", self._money(totals["esperado"]), self._money(totals["multas"]), self._money(totals["pagado"]), total_s_str, ""])
        story.append(self._blue_table(data, [2.4 * cm, 3 * cm, 2.4 * cm, 2.2 * cm, 2.4 * cm, 2.4 * cm, 3.2 * cm], font_size=7, total_rows=[len(data) - 1]))
        story.append(Spacer(1, 0.35 * cm))
        important = Table([[self._p("INFORMACIÓN IMPORTANTE<br/><br/>El vencimiento de la alícuota es el día 5 de cada mes.<br/>Realiza tus pagos a tiempo para evitar recargos.<br/>Si tienes alguna duda, contáctanos a través del sistema.", 8, raw=True)]], colWidths=[width])
        important.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#d4dfef")), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 12), ("TOPPADDING", (0, 0), (-1, -1), 12), ("BOTTOMPADDING", (0, 0), (-1, -1), 12)]))
        story.append(important)
        story.append(Spacer(1, 0.35 * cm))
        story.append(self._p("Gracias por contribuir al bienestar de nuestra comunidad.", 8, color="#667085", align="CENTER"))
        story.append(Spacer(1, 0.25 * cm))
        story.append(
            self._signature_grid(
                width=width,
                building=building,
                document_tag=f"ESTADO-CUENTA-{owner_id}",
                signer_name=owner.get("full_name") or "Copropietario",
                signer_role="Copropietario",
                file_name="estado-cuenta.pdf",
            )
        )
        story.append(Spacer(1, 0.28 * cm))
        doc.build(story, onFirstPage=draw_footer, onLaterPages=draw_footer)
        return output.getvalue()

    async def expense_certificate_pdf(self, owner_id: UUID) -> bytes:
        profile = await self._owner_profile(owner_id)
        if not profile:
            raise ValueError("Propietario no encontrado")
        building = await get_default_building_config(self._owner_repo._conn)
        apt = (profile.get("apartments") or [{}])[0]
        balance = Decimal(str(profile.get("balance") or 0))
        last_payment = profile.get("last_payment") or {}
        verification = f"TN-EXP-{date.today().year}-{str(owner_id).split('-')[0].upper()}"
        output = io.BytesIO()
        width = A4[0] - 2 * cm
        doc = SimpleDocTemplate(output, pagesize=A4, leftMargin=1 * cm, rightMargin=1 * cm, topMargin=0.7 * cm, bottomMargin=0.7 * cm)
        status_label = "AL DÍA" if balance <= 0 else "PENDIENTE"
        status_color = "#2f9b43" if balance <= 0 else "#d23b3b"
        story = [
            self._doc_header(
                "Certificado de Expensas",
                f"N. CE-{date.today().year}-000312",
                building,
                width,
                alert_message="Este certificado se genera automáticamente únicamente cuando el copropietario se encuentra al día en todas sus obligaciones.",
                alert_label=status_label,
                alert_color=status_color,
            ),
            Spacer(1, 0.25 * cm),
        ]
        story.append(self._p("La Administración del Edificio Torres Netanya certifica que el/la copropietario/a detallado/a en el presente documento se encuentra al día en el pago de alícuotas, expensas ordinarias y demás obligaciones registradas en el sistema, a la fecha de emisión de este certificado.", 10, align="JUSTIFY", color="#222222"))
        story.append(Spacer(1, 0.25 * cm))
        story.append(HRFlowable(width=width, thickness=0.7, color=colors.HexColor("#9aa8bd")))
        story.append(Spacer(1, 0.25 * cm))
        owner_rows = [
            [self._p("INFORMACIÓN DEL COPROPIETARIO", 10, bold=True, color="#ffffff", align="CENTER"), ""],
            [self._p("<b>Copropietario:</b> " + escape(profile.get("full_name") or ""), 8, raw=True), self._p("<b>Piso:</b> " + escape(str(apt.get("floor") or "")), 8, raw=True)],
            [self._p("<b>Cédula:</b> " + escape(profile.get("document_id") or ""), 8, raw=True), self._p("<b>Correo:</b> " + escape(profile.get("email") or ""), 8, raw=True)],
            [self._p("<b>Unidad:</b> " + escape(apt.get("code") or ""), 8, raw=True), self._p("<b>Teléfono:</b> " + escape(profile.get("phone") or ""), 8, raw=True)],
            [self._p("<b>Torre:</b> " + escape(str(apt.get("tower") or "")), 8, raw=True), self._p("<b>Fecha de registro:</b> " + (profile.get("created_at").strftime("%d/%m/%Y") if profile.get("created_at") else ""), 8, raw=True)],
        ]
        owner_table = Table(owner_rows, colWidths=[width * 0.5, width * 0.5])
        owner_table.setStyle(TableStyle([("SPAN", (0, 0), (-1, 0)), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#002e6d")), ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#0b3a76")), ("INNERGRID", (0, 1), (-1, -1), 0.3, colors.HexColor("#d4dfef")), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
        story.append(owner_table)
        story.append(Spacer(1, 0.25 * cm))
        valid_rows = [
            [self._p("VALIDACIÓN FINANCIERA", 10, bold=True, color="#ffffff", align="CENTER"), ""],
            [self._p(f"<b>Estado de cuenta:</b> <font color='{status_color}'>{status_label.title()}</font>", 8, raw=True), self._p("<b>Periodo validado:</b> " + date.today().strftime("%m/%Y"), 8, raw=True)],
            [self._p("<b>Saldo pendiente:</b> " + self._usd(max(balance, Decimal("0"))), 8, raw=True), self._p("<b>Próximo vencimiento:</b> " + (date.today().replace(day=1) + timedelta(days=35)).replace(day=settings.due_day).strftime("%d/%m/%Y"), 8, raw=True)],
            [self._p("<b>Último pago registrado:</b> " + (last_payment.get("paid_at").strftime("%d/%m/%Y") if last_payment.get("paid_at") else "Sin pagos"), 8, raw=True), self._p("<b>Observación:</b> " + ("Sin valores vencidos" if balance <= 0 else "Registra valores pendientes"), 8, raw=True)],
        ]
        valid_table = Table(valid_rows, colWidths=[width * 0.5, width * 0.5])
        valid_table.setStyle(TableStyle([("SPAN", (0, 0), (-1, 0)), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#002e6d")), ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#0b3a76")), ("INNERGRID", (0, 1), (-1, -1), 0.3, colors.HexColor("#d4dfef")), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
        story.append(valid_table)
        story.append(Spacer(1, 0.2 * cm))
        story.append(self._p("<b>CONDICIÓN DE EMISIÓN AUTOMÁTICA</b><br/>Este certificado se genera automáticamente únicamente cuando la cuenta del copropietario mantiene saldo pendiente igual a USD 0,00 y no registra obligaciones vencidas en el sistema.", 8, raw=True))
        story.append(Spacer(1, 0.25 * cm))
        verify = Table([[self._p(f"VERIFICACIÓN DEL DOCUMENTO<br/>Código de verificación:<br/><b>{verification}</b>", 8, raw=True), self._p("Administrador del Edificio", 10, align="CENTER", raw=True)]], colWidths=[width * 0.62, width * 0.35])
        verify.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
        story.append(verify)
        story.append(Spacer(1, 0.25 * cm))
        story.append(
            self._signature_grid(
                width=width,
                building=building,
                document_tag=verification,
                signer_name=profile.get("full_name") or "Copropietario",
                signer_role="Copropietario",
                file_name="certificado-expensas.pdf",
            )
        )
        story.append(Spacer(1, 0.2 * cm))
        story.append(build_pdf_footer_bar(building, width=width, page_text="Página 1 de 1"))
        doc.build(story)
        return output.getvalue()
