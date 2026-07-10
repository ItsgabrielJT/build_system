from __future__ import annotations

import csv
import io
import re
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional
from uuid import UUID
from xml.sax.saxutils import escape

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, inch
from reportlab.graphics.shapes import Drawing
from reportlab.platypus import HRFlowable, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.lib import colors

from app.repositories.expense_repository import ExpenseRepository
from app.repositories.payment_repository import PaymentRepository
from app.services.pdf_branding import (
    build_pdf_brand_header,
    build_pdf_footer_bar,
    build_pdf_signature_seal_qr_grid,
    get_building_contact_lines,
    get_building_logo,
    get_building_name,
    get_default_building_config,
)
from app.services.delinquency_service import DelinquencyService

_MONTH_PERIOD_RE = re.compile(r"^\d{4}-\d{2}$")
_CONFIRMED_PAYMENT_STATUSES = {"REGISTRADO", "APROBADO"}
_EXCLUDED_EXPENSE_STATUSES = {"ANULADO", "ANULADA"}
_PDF_BLUE = colors.HexColor("#123c7a")
_PDF_NAVY = colors.HexColor("#00316f")
_PDF_BORDER = colors.HexColor("#b9cbe3")
_PDF_LIGHT = colors.HexColor("#f8fafc")
_PDF_PALE_BLUE = colors.HexColor("#eaf3ff")


class ReportService:
    def __init__(
        self,
        delinquency_service: DelinquencyService,
        payment_repo: PaymentRepository,
        expense_repo: ExpenseRepository,
    ) -> None:
        self._delinquency = delinquency_service
        self._payment_repo = payment_repo
        self._expense_repo = expense_repo

    def _validate_month_period(self, period: str) -> str:
        if not _MONTH_PERIOD_RE.match(period):
            raise ValueError("Período debe tener formato YYYY-MM")
        return period

    def _previous_period(self, period: str) -> str:
        month_start = datetime.strptime(f"{period}-01", "%Y-%m-%d").date()
        previous_month_last_day = month_start - timedelta(days=1)
        return previous_month_last_day.strftime("%Y-%m")

    def _is_confirmed_payment(self, payment: dict) -> bool:
        return (payment.get("status") or "").upper() in _CONFIRMED_PAYMENT_STATUSES

    def _is_valid_expense(self, expense: dict) -> bool:
        return (expense.get("status") or "REGISTRADO").upper() not in _EXCLUDED_EXPENSE_STATUSES

    async def _monthly_payments(self, period: str) -> list[dict]:
        period = self._validate_month_period(period)
        historical = await self._payment_repo.get_all(period=period, status="REGISTRADO")
        approved = await self._payment_repo.get_all(period=period, status="APROBADO")
        payments_by_id: dict[str, dict] = {}
        for payment in [*historical, *approved]:
            payment_id = str(payment.get("id") or "")
            payments_by_id[payment_id] = payment
        return [
            payment
            for payment in payments_by_id.values()
            if self._is_confirmed_payment(payment)
        ]

    async def _monthly_expenses(self, period: str) -> list[dict]:
        period = self._validate_month_period(period)
        expenses_payload = await self._expense_repo.get_by_month(period)
        expenses = expenses_payload.get("data", []) if isinstance(expenses_payload, dict) else expenses_payload
        return [expense for expense in expenses if self._is_valid_expense(expense)]

    def _sum_amount(self, rows: list[dict]) -> Decimal:
        return sum(Decimal(str(row.get("amount", 0) or 0)) for row in rows)

    def _build_breakdown(self, rows: list[dict], key: str, fallback: str) -> list[dict]:
        totals: dict[str, Decimal] = {}
        for row in rows:
            label = row.get(key) or fallback
            totals[label] = totals.get(label, Decimal("0")) + Decimal(str(row.get("amount", 0) or 0))
        return [
            {"label": label, "amount": amount}
            for label, amount in sorted(totals.items(), key=lambda item: item[1], reverse=True)
        ]

    def _variation_percent(self, current: Decimal, previous: Decimal) -> Optional[float]:
        if previous <= 0:
            return None
        return round(float((current - previous) / previous * 100), 2)

    def _money(self, value) -> str:
        return f"${float(Decimal(str(value or 0))):,.2f}"

    def _usd(self, value) -> str:
        return f"USD {float(Decimal(str(value or 0))):,.2f}"

    def _period_name(self, period: Optional[str]) -> str:
        if not period:
            return "Todos"
        try:
            parsed = datetime.strptime(f"{period}-01", "%Y-%m-%d")
        except ValueError:
            return period
        months = [
            "enero", "febrero", "marzo", "abril", "mayo", "junio",
            "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
        ]
        return f"{months[parsed.month - 1]} {parsed.year}"

    def _spanish_date(self, value: date) -> str:
        months = [
            "enero", "febrero", "marzo", "abril", "mayo", "junio",
            "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
        ]
        return f"{value.day:02d} de {months[value.month - 1]} de {value.year}"

    def _p(self, text: str, size: int = 8, *, bold: bool = False, color="#102a56", align: str = "CENTER", raw: bool = False) -> Paragraph:
        safe_text = str(text or "") if raw else escape(str(text or ""))
        return Paragraph(
            f'<font color="{color}">{"<b>" if bold else ""}{safe_text}{"</b>" if bold else ""}</font>',
            ParagraphStyle(
                f"PdfP{size}{bold}{align}",
                fontName="Helvetica-Bold" if bold else "Helvetica",
                fontSize=size,
                leading=size + 2,
                alignment={"LEFT": 0, "CENTER": 1, "RIGHT": 2}.get(align, 1),
            ),
        )

    async def _modern_report_header(self, title: str, subtitle: str, width: float, *, building: Optional[dict] = None) -> list:
        building = building if building is not None else await get_default_building_config(getattr(self._payment_repo, "_conn", None))
        generated = datetime.now()
        logo = get_building_logo(building, max_width=2.8 * cm, max_height=2.4 * cm)
        if not logo:
            logo = self._p(
                "EDIFICIO<br/><font size='16'><b>TORRES</b></font><br/>NETANYA",
                10,
                bold=True,
                color="#092b62",
                raw=True,
            )
        info = Table(
            [
                [self._p("Formatos: Habittauio", 8, bold=True, align="LEFT")],
                [self._p("Fecha de impresión", 8, bold=True, align="LEFT")],
                [self._p(self._spanish_date(generated.date()), 8, align="LEFT")],
            ],
            colWidths=[4.1 * cm],
        )
        info.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.8, _PDF_BLUE),
            ("LINEBELOW", (0, 0), (-1, 0), 0.6, _PDF_BORDER),
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        title_block = self._p(
            f"<font size='22'><b>{escape(title)}</b></font><br/><font size='8'>{escape(subtitle)}</font>",
            12,
            color="#082f6f",
            align="LEFT",
            raw=True,
        )
        header = Table([[logo, title_block, info]], colWidths=[3.3 * cm, width - 7.9 * cm, 4.6 * cm])
        header.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("LINEAFTER", (0, 0), (0, 0), 0.8, _PDF_BORDER),
            ("LINEBELOW", (0, 0), (-1, -1), 1.3, _PDF_BLUE),
        ]))
        return [header, Spacer(1, 0.25 * cm)]

    async def _three_column_report_header(
        self,
        title: str,
        subtitle: str,
        width: float,
        *,
        building: Optional[dict] = None,
        right_text: Optional[str] = None,
    ) -> list:
        building = building if building is not None else await get_default_building_config(getattr(self._payment_repo, "_conn", None))
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
            f"<font size='18'><b>{escape(title)}</b></font><br/><font size='9'>{escape(subtitle)}</font>",
            ParagraphStyle(
                "PdfHeaderTitle",
                fontName="Helvetica",
                fontSize=12,
                leading=22,
                textColor="#082f6f",
                alignment=1,
            ),
        )

        info_table = Table(
            [
                [self._p("Formatos: Habittauio", 8, bold=True, align="LEFT", raw=True)],
                [self._p("Fecha de impresión", 8, bold=True, align="LEFT", raw=True)],
                [self._p(self._spanish_date(datetime.now().date()), 8, align="LEFT", raw=True)],
                [self._p(escape(right_text or ""), 8, align="LEFT", raw=True)] if right_text else [self._p("", 8, align="LEFT", raw=True)],
            ],
            colWidths=[4.3 * cm],
        )
        info_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.8, _PDF_BLUE),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, _PDF_BORDER),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ]))

        header = Table(
            [[logo, title_block, info_table]],
            colWidths=[3.2 * cm, width - 7.5 * cm, 4.3 * cm],
        )
        header.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (1, -1), "CENTER"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LINEAFTER", (0, 0), (0, 0), 0.8, _PDF_BLUE),
            ("LINEAFTER", (1, 0), (1, 0), 0.8, _PDF_BLUE),
            ("LINEBELOW", (0, 0), (-1, -1), 1.2, _PDF_BLUE),
        ]))
        return [header, Spacer(1, 0.28 * cm)]

    def _metric_cards(self, cards: list[tuple[str, str, str]], width: float) -> Table:
        row = []
        col_width = width / len(cards)
        for title, value, icon in cards:
            card = Table(
                [[self._p(title, 9, bold=True, color="#ffffff")], [self._p(value, 18, bold=True, color="#072f6e")]],
                colWidths=[col_width - 0.25 * cm],
                rowHeights=[0.65 * cm, 1.45 * cm],
            )
            card.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), _PDF_NAVY),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.8, _PDF_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]))
            row.append(card)
        table = Table([row], colWidths=[col_width] * len(cards))
        table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        return table

    def _section_title(self, title: str, width: float) -> Table:
        table = Table([[self._p(title, 14, bold=True, color="#07316d", align="LEFT"), ""]], colWidths=[6 * cm, width - 6 * cm])
        table.setStyle(TableStyle([
            ("LINEAFTER", (0, 0), (0, 0), 0, colors.white),
            ("LINEBELOW", (1, 0), (1, 0), 1.2, _PDF_BLUE),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        return table

    def _report_footer(self, width: float, building: Optional[dict] = None) -> list:
        line = HRFlowable(width=width * 0.52, thickness=1, color=_PDF_BLUE, hAlign="CENTER")
        return [
            Spacer(1, 0.22 * cm),
            line,
            self._p("La Administración", 12, bold=True),
            self._p("Período 2026-2027", 10),
            Spacer(1, 0.18 * cm),
            build_pdf_footer_bar(building or {}, width=width),
        ]

    def _signature_grid(self, width: float, building: Optional[dict], document_tag: str) -> Table:
        qr_value = f"{document_tag}|{datetime.now().strftime('%Y%m%d%H%M%S')}|{get_building_name(building)}"
        return build_pdf_signature_seal_qr_grid(building or {}, width=width, qr_value=qr_value)

    def _append_signature_grid(self, story: list, *, width: float, building: Optional[dict], document_tag: str) -> None:
        story.extend([Spacer(1, 0.24 * cm), self._signature_grid(width, building, document_tag)])

    def _footer_callback(self, building: Optional[dict], width: float):
        def draw_footer(canvas, doc):
            canvas.saveState()
            footer = build_pdf_footer_bar(building or {}, width=doc.width, page_text=f"Página {doc.page}")
            _, footer_height = footer.wrap(doc.width, doc.bottomMargin)
            footer.drawOn(canvas, doc.leftMargin, doc.bottomMargin - footer_height)
            canvas.restoreState()

        return draw_footer

    def _styled_table(self, data: list[list], col_widths: list[float], *, font_size: int = 7, total_rows: Optional[list[int]] = None) -> Table:
        table = Table(data, colWidths=col_widths, repeatRows=1)
        style = [
            ("BACKGROUND", (0, 0), (-1, 0), _PDF_NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), font_size + 1),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("GRID", (0, 0), (-1, -1), 0.45, _PDF_BORDER),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f6f9fd")]),
            ("FONTSIZE", (0, 1), (-1, -1), font_size),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]
        for row in total_rows or []:
            style.extend([
                ("BACKGROUND", (0, row), (-1, row), _PDF_PALE_BLUE),
                ("FONTNAME", (0, row), (-1, row), "Helvetica-Bold"),
                ("TEXTCOLOR", (0, row), (-1, row), _PDF_BLUE),
            ])
        table.setStyle(TableStyle(style))
        return table

    def _comparison_table(self, rows: list[dict], width: float) -> Table:
        max_amount = max([float(row.get("current") or 0) for row in rows] + [1.0])
        data = [[
            self._p("Concepto", 8, bold=True, color="#ffffff", align="LEFT"),
            self._p("Mes actual", 8, bold=True, color="#ffffff"),
            self._p("Mes anterior", 8, bold=True, color="#ffffff"),
            self._p("Valores (USD)", 8, bold=True, color="#ffffff"),
        ]]
        for row in rows:
            current = float(row.get("current") or 0)
            previous = float(row.get("previous") or 0)
            current_bar = "█" * max(1, int((current / max_amount) * 28))
            previous_bar = "█" * max(1, int((previous / max_amount) * 28)) if previous else ""
            data.append([
                self._p(row["label"], 8, bold=True, align="LEFT"),
                self._p(current_bar, 9, color="#003b82"),
                self._p(previous_bar, 9, color="#b8d6f2"),
                self._p(self._money(current), 8, bold=True),
            ])
        return self._styled_table(data, [width * 0.26, width * 0.34, width * 0.25, width * 0.15], font_size=7)

    def _date_label(
        self,
        period: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> str:
        if start_date and end_date:
            return f"{start_date.strftime('%d/%m/%Y')} - {end_date.strftime('%d/%m/%Y')}"
        if start_date:
            return f"Desde {start_date.strftime('%d/%m/%Y')}"
        if end_date:
            return f"Hasta {end_date.strftime('%d/%m/%Y')}"
        if period:
            return period
        return "Todos"

    def _table_style(self, font_size: int = 8) -> TableStyle:
        return TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), _PDF_BLUE),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), font_size + 1),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
            ("BACKGROUND", (0, 1), (-1, -1), _PDF_LIGHT),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("FONTSIZE", (0, 1), (-1, -1), font_size),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ])

    def _style_excel_header(self, ws, headers: list[str]) -> None:
        header_fill = PatternFill(start_color="123C7A", end_color="123C7A", fill_type="solid")
        header_font = Font(bold=True, color="FFFFFF")
        border = Border(bottom=Side(style="thin", color="CBD5E1"))
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col)
            cell.value = header
            cell.fill = header_fill
            cell.font = header_font
            cell.border = border
            cell.alignment = Alignment(horizontal="center")

    async def _payments_report_rows(
        self,
        period: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        status: Optional[str] = None,
    ) -> list[dict]:
        conditions: list[str] = []
        params: list = []
        idx = 1
        if period:
            conditions.append(f"p.period = ${idx}")
            params.append(period)
            idx += 1
        if status:
            conditions.append(f"p.status = ${idx}")
            params.append(status)
            idx += 1
        if start_date:
            conditions.append(f"p.paid_at >= ${idx}")
            params.append(start_date)
            idx += 1
        if end_date:
            conditions.append(f"p.paid_at <= ${idx}")
            params.append(end_date)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        rows = await self._payment_repo._conn.fetch(
            f"""
            SELECT p.*, a.code AS apartment_code, o.full_name AS owner_name
            FROM payments p
            JOIN apartments a ON p.apartment_id = a.id
            JOIN owners o ON p.owner_id = o.id
            {where}
            ORDER BY p.paid_at DESC, p.created_at DESC
            """,
            *params,
        )
        return [dict(row) for row in rows]

    async def _pdf_header(self, title: str, subtitle: str, width: float) -> list:
        conn = getattr(self._payment_repo, "_conn", None)
        building = await get_default_building_config(conn)
        return build_pdf_brand_header(
            title,
            subtitle,
            building,
            width=width,
        )

    async def _payments(
        self,
        period: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> list[dict]:
        if period and not start_date and not end_date:
            return await self._monthly_payments(period)
        if not start_date and not end_date:
            payments = await self._payment_repo.get_all(period=period, status="REGISTRADO")
            approved = await self._payment_repo.get_all(period=period, status="APROBADO")
            return [
                payment
                for payment in [*payments, *approved]
                if self._is_confirmed_payment(payment)
            ]

        conditions = ["p.status IN ('REGISTRADO', 'APROBADO')"]
        params: list = []
        idx = 1
        if period:
            conditions.append(f"p.period = ${idx}")
            params.append(period)
            idx += 1
        if start_date:
            conditions.append(f"p.paid_at >= ${idx}")
            params.append(start_date)
            idx += 1
        if end_date:
            conditions.append(f"p.paid_at <= ${idx}")
            params.append(end_date)

        rows = await self._payment_repo._conn.fetch(
            f"""
            SELECT p.*, a.code AS apartment_code, o.full_name AS owner_name
            FROM payments p
            JOIN apartments a ON p.apartment_id = a.id
            JOIN owners o ON p.owner_id = o.id
            WHERE {' AND '.join(conditions)}
            ORDER BY p.paid_at DESC, p.created_at DESC
            """,
            *params,
        )
        return [dict(row) for row in rows]

    async def _expenses(
        self,
        period: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> list[dict]:
        if period and not start_date and not end_date:
            return await self._monthly_expenses(period)
        if not start_date and not end_date:
            expenses_payload = await self._expense_repo.get_by_month(period)
            expenses = expenses_payload.get("data", []) if isinstance(expenses_payload, dict) else expenses_payload
            return [expense for expense in expenses if self._is_valid_expense(expense)]

        conditions = ["status NOT IN ('ANULADO', 'ANULADA')"]
        params: list = []
        idx = 1
        if period:
            conditions.append(f"TO_CHAR(date, 'YYYY-MM') = ${idx}")
            params.append(period)
            idx += 1
        if start_date:
            conditions.append(f"date >= ${idx}")
            params.append(start_date)
            idx += 1
        if end_date:
            conditions.append(f"date <= ${idx}")
            params.append(end_date)

        rows = await self._expense_repo._conn.fetch(
            f"""
            SELECT *
            FROM expenses
            WHERE {' AND '.join(conditions)}
            ORDER BY date DESC, created_at DESC
            """,
            *params,
        )
        return [dict(row) for row in rows]

    async def monthly_balance_summary(self, period: Optional[str] = None) -> dict:
        target_period = self._validate_month_period(period or date.today().strftime("%Y-%m"))
        previous_period = self._previous_period(target_period)

        payments = await self._monthly_payments(target_period)
        expenses = await self._monthly_expenses(target_period)
        previous_payments = await self._monthly_payments(previous_period)
        previous_expenses = await self._monthly_expenses(previous_period)

        income_total = self._sum_amount(payments)
        expense_total = self._sum_amount(expenses)
        net_balance = income_total - expense_total

        previous_income_total = self._sum_amount(previous_payments)
        previous_expense_total = self._sum_amount(previous_expenses)
        previous_net_balance = previous_income_total - previous_expense_total

        return {
            "period": target_period,
            "income_total": income_total,
            "expense_total": expense_total,
            "net_balance": net_balance,
            "income_breakdown": self._build_breakdown(payments, "method", "Otros ingresos"),
            "expense_breakdown": self._build_breakdown(expenses, "category", "Sin categoría"),
            "previous_period_variation": {
                "income_pct": self._variation_percent(income_total, previous_income_total),
                "expense_pct": self._variation_percent(expense_total, previous_expense_total),
                "net_balance_pct": self._variation_percent(net_balance, previous_net_balance),
            },
        }

    async def dashboard_stats(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> dict:
        payments = await self._payments(start_date=start_date, end_date=end_date)
        expenses = await self._expenses(start_date=start_date, end_date=end_date)
        delinquency = await self._delinquency.get_stats()

        total_revenue = sum(Decimal(str(p.get("amount", 0))) for p in payments)
        total_expenses = sum(Decimal(str(e.get("amount", 0))) for e in expenses)
        net_income = total_revenue - total_expenses

        previous_revenue = Decimal("0")
        previous_expenses = Decimal("0")
        if start_date and end_date:
            days = (end_date - start_date).days + 1
            previous_end = start_date - timedelta(days=1)
            previous_start = previous_end - timedelta(days=days - 1)
            prev_payments = await self._payments(
                start_date=previous_start,
                end_date=previous_end,
            )
            prev_expenses = await self._expenses(
                start_date=previous_start,
                end_date=previous_end,
            )
            previous_revenue = sum(Decimal(str(p.get("amount", 0))) for p in prev_payments)
            previous_expenses = sum(Decimal(str(e.get("amount", 0))) for e in prev_expenses)

        def change(current: Decimal, previous: Decimal) -> Optional[float]:
            if previous <= 0:
                return None
            return round(float((current - previous) / previous * 100), 2)

        category_totals: dict[str, Decimal] = {}
        for expense in expenses:
            category = expense.get("category") or "Sin categoría"
            category_totals[category] = category_totals.get(category, Decimal("0")) + Decimal(
                str(expense.get("amount", 0))
            )

        start_period = start_date.strftime("%Y-%m") if start_date else None
        end_period = end_date.strftime("%Y-%m") if end_date else None
        period_conditions = []
        period_params = []
        if start_period:
            period_conditions.append(f"period >= ${len(period_params) + 1}")
            period_params.append(start_period)
        if end_period:
            period_conditions.append(f"period <= ${len(period_params) + 1}")
            period_params.append(end_period)
        period_where = f"WHERE {' AND '.join(period_conditions)}" if period_conditions else ""
        fee_rows = await self._payment_repo._conn.fetch(
            f"""
            SELECT period, COALESCE(SUM(amount), 0) AS total
            FROM apartment_fees
            {period_where}
            GROUP BY period
            ORDER BY period ASC
            """,
            *period_params,
        )

        expected_by_period = {row["period"]: float(row["total"]) for row in fee_rows}
        collected_by_period: dict[str, float] = {}
        for payment in payments:
            period_key = payment.get("period") or (
                payment.get("paid_at").strftime("%Y-%m") if payment.get("paid_at") else ""
            )
            if not period_key:
                continue
            collected_by_period[period_key] = collected_by_period.get(period_key, 0.0) + float(
                payment.get("amount", 0)
            )

        periods = sorted(set(expected_by_period) | set(collected_by_period))
        monthly = [
            {
                "period": period_key,
                "expected": expected_by_period.get(period_key, 0.0),
                "collected": collected_by_period.get(period_key, 0.0),
            }
            for period_key in periods[-6:]
        ]

        owner_count = await self._payment_repo._conn.fetchval(
            "SELECT COUNT(*) FROM owners WHERE status = 'ACTIVO'"
        )
        apartment_count = await self._payment_repo._conn.fetchval(
            "SELECT COUNT(*) FROM apartments WHERE status = 'ACTIVO'"
        )

        arrears = []
        for unit in delinquency.get("units", [])[:8]:
            if unit.get("90_plus_days", 0) > 0:
                days_overdue = "90+ Days"
                risk_level = "High"
            elif unit.get("60_days", 0) > 0:
                days_overdue = "60 Days"
                risk_level = "Medium"
            else:
                days_overdue = "30 Days"
                risk_level = "Low"
            arrears.append({
                "unit": unit.get("unit"),
                "owner": unit.get("owner_name"),
                "email": unit.get("email"),
                "amount_due": unit.get("total_debt", 0),
                "days_overdue": days_overdue,
                "risk_level": risk_level,
            })

        return {
            "summary": {
                "total_revenue": float(total_revenue),
                "total_expenses": float(total_expenses),
                "net_income": float(net_income),
                "revenue_change_percent": change(total_revenue, previous_revenue),
                "expense_change_percent": change(total_expenses, previous_expenses),
                "net_income_change_percent": change(
                    net_income, previous_revenue - previous_expenses
                ),
            },
            "expense_categories": [
                {"category": category, "amount": float(amount)}
                for category, amount in sorted(
                    category_totals.items(), key=lambda item: item[1], reverse=True
                )
            ],
            "monthly": monthly,
            "arrears": arrears,
            "risk_summary": {
                "high": sum(1 for row in arrears if row["risk_level"] == "High"),
                "medium": sum(1 for row in arrears if row["risk_level"] == "Medium"),
                "low": sum(1 for row in arrears if row["risk_level"] == "Low"),
            },
            "system": {
                "active_owners": int(owner_count or 0),
                "active_apartments": int(apartment_count or 0),
                "delinquent_units": delinquency.get("summary", {}).get("delinquent_units", 0),
            },
        }

    async def delinquency_csv(self) -> bytes:
        owners = await self._delinquency.list_owners()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            ["Propietario", "Email", "Documento", "Deuda Total", "Períodos Vencidos", "Estado"]
        )
        for o in owners:
            writer.writerow(
                [
                    o["owner_name"],
                    o.get("email") or "",
                    o["document_id"],
                    o["deuda_total"],
                    o["periodos_vencidos"],
                    o["status"],
                ]
            )
        return output.getvalue().encode("utf-8-sig")

    async def income_csv(
        self,
        period: Optional[str],
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> bytes:
        payments = await self._payments(period, start_date, end_date)
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            ["Fecha", "Propietario", "Departamento", "Período", "Monto", "Método", "Estado"]
        )
        for p in payments:
            writer.writerow(
                [
                    p.get("paid_at", ""),
                    p.get("owner_name", ""),
                    p.get("apartment_code", ""),
                    p.get("period", ""),
                    p.get("amount", 0),
                    p.get("method", ""),
                    p.get("status", ""),
                ]
            )
        return output.getvalue().encode("utf-8-sig")

    async def balance_csv(
        self,
        period: Optional[str],
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> bytes:
        payments = await self._payments(period, start_date, end_date)
        expenses = await self._expenses(period, start_date, end_date)

        total_income = sum(Decimal(str(p.get("amount", 0))) for p in payments)
        total_expenses = sum(Decimal(str(e.get("amount", 0))) for e in expenses)
        balance = total_income - total_expenses

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Concepto", "Monto"])
        writer.writerow(["Ingresos (pagos registrados)", str(total_income)])
        writer.writerow(["Egresos (gastos)", str(total_expenses)])
        writer.writerow(["Balance neto", str(balance)])
        return output.getvalue().encode("utf-8-sig")

    # ─── PDF REPORTS ─────────────────────────────────────────────────────────

    async def income_pdf(
        self,
        period: Optional[str],
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> bytes:
        payments = await self._payments(period, start_date, end_date)
        previous_payments = await self._payments(self._previous_period(period), None, None) if period else []
        total = sum(Decimal(str(p.get("amount", 0))) for p in payments)
        by_kind = [
            {"label": "Ingresos por alícuotas", "amount": total},
            {"label": "Otros ingresos", "amount": Decimal("0")},
        ]
        previous_total = sum(Decimal(str(p.get("amount", 0))) for p in previous_payments)

        output = io.BytesIO()
        width = A4[0] - 2.2 * cm
        doc = SimpleDocTemplate(output, pagesize=A4, leftMargin=1.1 * cm, rightMargin=1.1 * cm, topMargin=0.8 * cm, bottomMargin=0.7 * cm)
        story = []

        building = await get_default_building_config(getattr(self._payment_repo, "_conn", None))
        story.extend(
            await self._three_column_report_header(
                "Reporte Detallado de Ingresos",
                f"Rango: {self._date_label(period, start_date, end_date)} | Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}",
                width,
                building=building,
                right_text=f"Período: {self._date_label(period, start_date, end_date)}",
            )
        )
        departments = len({p.get("apartment_code") for p in payments if p.get("apartment_code")})
        story.append(self._metric_cards([
            ("Departamentos", str(departments), "▦"),
            ("Ingresos por alícuotas", self._usd(total), "$"),
            ("Otros ingresos", self._usd(0), "✦"),
        ], width))
        story.append(Spacer(1, 0.25 * cm))
        story.append(self._section_title("Detalle de ingresos", width))
        data = [["Torre", "Departamento", "Concepto", "Monto", "Observación"]]
        for p in payments:
            apartment = p.get("apartment_code") or ""
            data.append([
                apartment.split()[-1] if " " in apartment else "",
                self._p(apartment, 7),
                self._p(f"Alícuota {apartment or p.get('period') or ''}", 7),
                self._usd(p.get("amount", 0)),
                self._p("Ingreso por alícuota", 7),
            ])
        if len(data) == 1:
            data.append(["General", "-", "Sin ingresos registrados", self._usd(0), "-"])
        story.append(self._styled_table(data[:14], [2.5 * cm, 4 * cm, 5.2 * cm, 3.3 * cm, 4.1 * cm], font_size=7))
        story.append(Spacer(1, 0.18 * cm))
        total_bar = Table([[self._p("v/p Alícuotas de departamentos suma", 10, bold=True, align="LEFT"), self._p(self._usd(total), 12, bold=True)]], colWidths=[width * 0.72, width * 0.28])
        total_bar.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.8, _PDF_BLUE), ("BACKGROUND", (0, 0), (-1, -1), colors.white)]))
        story.append(total_bar)
        story.append(Spacer(1, 0.22 * cm))
        story.append(self._section_title("Comparativo respecto al mes anterior", width))
        story.append(self._comparison_table([
            {"label": row["label"], "current": row["amount"], "previous": previous_total if index == 0 else 0}
            for index, row in enumerate(by_kind + [{"label": "Total ingresos", "amount": total}])
        ], width))
        story.append(Spacer(1, 0.2 * cm))
        final = Table([[self._p("Ingresos totales registrados en el período", 11, bold=True, color="#ffffff", align="LEFT"), self._p(self._usd(total), 14, bold=True, color="#ffffff")]], colWidths=[width * 0.72, width * 0.28])
        final.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), _PDF_NAVY), ("BOX", (0, 0), (-1, -1), 0.8, _PDF_BLUE), ("LEFTPADDING", (0, 0), (-1, -1), 10)]))
        story.append(final)
        self._append_signature_grid(story, width=width, building=building, document_tag="REPORTE-INGRESOS")
        footer = self._footer_callback(building, width)
        doc.build(story, onFirstPage=footer, onLaterPages=footer)
        return output.getvalue()

    async def balance_pdf(
        self,
        period: Optional[str],
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> bytes:
        payments = await self._payments(period, start_date, end_date)
        expenses = await self._expenses(period, start_date, end_date)

        total_income = sum(Decimal(str(p.get("amount", 0))) for p in payments)
        total_expenses = sum(Decimal(str(e.get("amount", 0))) for e in expenses)
        balance = total_income - total_expenses

        income_by_method = self._build_breakdown(payments, "method", "Sin método")
        expenses_by_category = self._build_breakdown(expenses, "category", "Sin categoría")

        output = io.BytesIO()
        width = A4[0] - 2.2 * cm
        doc = SimpleDocTemplate(output, pagesize=A4, leftMargin=1.1 * cm, rightMargin=1.1 * cm, topMargin=0.8 * cm, bottomMargin=0.7 * cm)
        story = []
        building = await get_default_building_config(getattr(self._payment_repo, "_conn", None))
        story.extend(
            await self._three_column_report_header(
                "Balance de Fin de Mes - Ingresos y Egresos",
                f"Rango: {self._date_label(period, start_date, end_date)} | Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}",
                width,
                building=building,
                right_text=f"Total ingresos: {self._usd(total_income)}",
            )
        )
        story.append(self._metric_cards([
            ("Ingresos", self._usd(total_income), "$"),
            ("Egresos", self._usd(total_expenses), "▤"),
            ("Balance neto", self._usd(balance), "↕"),
            ("Estado", "Superávit" if balance >= 0 else "Déficit", "✓"),
        ], width))
        story.append(Spacer(1, 0.22 * cm))
        story.append(self._section_title("Resumen del balance", width))
        rows = [["Concepto", "Monto", "Observación"]]
        for row in income_by_method or [{"label": "Ingresos por alícuotas", "amount": total_income}]:
            rows.append([row["label"], self._usd(row["amount"]), "Ingreso operativo"])
        rows.append(["Total ingresos", self._usd(total_income), "Ingreso operativo"])
        total_income_row = len(rows) - 1
        for row in expenses_by_category or [{"label": "Gastos registrados", "amount": total_expenses}]:
            rows.append([row["label"], self._usd(row["amount"]), "Egreso operativo"])
        rows.append(["Total egresos", self._usd(total_expenses), "Egreso operativo"])
        total_expense_row = len(rows) - 1
        rows.append(["Balance del período", self._usd(balance), "Resultado del mes"])
        balance_row = len(rows) - 1
        story.append(self._styled_table(rows, [width * 0.36, width * 0.27, width * 0.37], font_size=8, total_rows=[total_income_row, total_expense_row, balance_row]))
        story.append(Spacer(1, 0.2 * cm))
        story.append(self._section_title("Detalle general", width))
        income_data = [["Ingresos", "Monto (USD)"]] + [[r["label"], self._usd(r["amount"])] for r in income_by_method] + [["Subtotal ingresos", self._usd(total_income)]]
        expense_data = [["Egresos", "Monto (USD)"]] + [[r["label"], self._usd(r["amount"])] for r in expenses_by_category] + [["Subtotal egresos", self._usd(total_expenses)]]
        details = Table([[self._styled_table(income_data, [width * 0.32, width * 0.16], font_size=7, total_rows=[len(income_data) - 1]), self._styled_table(expense_data, [width * 0.32, width * 0.16], font_size=7, total_rows=[len(expense_data) - 1])]], colWidths=[width * 0.5, width * 0.5])
        story.append(details)
        story.append(Spacer(1, 0.18 * cm))
        final = Table([[self._p("Balance final del mes", 14, bold=True, color="#ffffff"), self._p(self._usd(balance), 19, bold=True, color="#ffffff")]], colWidths=[width * 0.52, width * 0.48])
        final.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), _PDF_NAVY), ("LINEBEFORE", (1, 0), (1, 0), 1, colors.white), ("BOX", (0, 0), (-1, -1), 0.8, _PDF_BLUE), ("TOPPADDING", (0, 0), (-1, -1), 9), ("BOTTOMPADDING", (0, 0), (-1, -1), 9)]))
        story.append(final)
        story.append(Spacer(1, 0.2 * cm))
        story.append(self._section_title("Comparativo respecto al mes anterior", width))
        story.append(self._comparison_table([
            {"label": "Total ingresos", "current": total_income, "previous": 0},
            {"label": "Total egresos", "current": total_expenses, "previous": 0},
            {"label": "Balance neto", "current": abs(balance), "previous": 0},
        ], width))
        self._append_signature_grid(story, width=width, building=building, document_tag="REPORTE-BALANCE")
        footer = self._footer_callback(building, width)
        doc.build(story, onFirstPage=footer, onLaterPages=footer)
        return output.getvalue()

    async def payments_pdf(
        self,
        period: Optional[str],
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        status: Optional[str] = None,
    ) -> bytes:
        payments = await self._payments_report_rows(period, start_date, end_date, status)
        total = sum(Decimal(str(p.get("amount", 0))) for p in payments)
        by_method = self._build_breakdown(payments, "method", "Sin método")

        output = io.BytesIO()
        doc = SimpleDocTemplate(output, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.8*inch)
        story = []
        styles = getSampleStyleSheet()
        building = await get_default_building_config(getattr(self._payment_repo, "_conn", None))
        story.extend(await self._three_column_report_header(
            "Reporte Detallado de Pagos",
            f"Rango: {self._date_label(period, start_date, end_date)} | Estado: {status or 'Todos'}",
            width=doc.width,
            building=building,
            right_text=f"Total recaudado: {self._money(total)}",
        ))
        summary = Table(
            [["Pagos", "Total recaudado", "Métodos"], [str(len(payments)), self._money(total), str(len(by_method))]],
            colWidths=[1.6*inch, 2*inch, 1.6*inch],
        )
        summary.setStyle(self._table_style(9))
        story.append(summary)
        story.append(Spacer(1, 0.2*inch))
        story.append(Paragraph("Detalle de pagos", styles["Heading3"]))
        data = [["Fecha", "Propietario", "Depto", "Período", "Monto", "Método", "Estado", "Referencia"]]
        for p in payments:
            data.append([
                str(p.get("paid_at") or ""),
                p.get("owner_name") or "",
                p.get("apartment_code") or "",
                p.get("period") or "",
                self._money(p.get("amount", 0)),
                p.get("method") or "",
                p.get("status") or "",
                p.get("reference") or "",
            ])
        table = Table(data, colWidths=[0.75*inch, 1.1*inch, 0.55*inch, 0.7*inch, 0.75*inch, 0.75*inch, 0.85*inch, 1.05*inch], repeatRows=1)
        table.setStyle(self._table_style(7))
        story.append(table)
        self._append_signature_grid(story, width=doc.width, building=building, document_tag="REPORTE-PAGOS")
        footer = self._footer_callback(building, doc.width)
        doc.build(story, onFirstPage=footer, onLaterPages=footer)
        return output.getvalue()

    async def expenses_pdf(
        self,
        period: Optional[str],
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> bytes:
        expenses = await self._expenses(period, start_date, end_date)
        previous_expenses = await self._expenses(self._previous_period(period), None, None) if period else []
        total = sum(Decimal(str(e.get("amount", 0))) for e in expenses)
        previous_by_category = {row["label"]: row["amount"] for row in self._build_breakdown(previous_expenses, "category", "Sin categoría")}
        by_category = self._build_breakdown(expenses, "category", "Sin categoría")

        try:
            output = io.BytesIO()
            width = A4[0] - 2.2 * cm
            doc = SimpleDocTemplate(output, pagesize=A4, leftMargin=1.1 * cm, rightMargin=1.1 * cm, topMargin=0.8 * cm, bottomMargin=0.7 * cm)
            story = []
            building = await get_default_building_config(getattr(self._payment_repo, "_conn", None))
            story.extend(await self._three_column_report_header(
                "Reporte Detallado de Gastos",
                f"Rango: {self._date_label(period, start_date, end_date)} | Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}",
                width,
                building=building,
                right_text=f"Total egresos: {self._money(total)}",
            ))
            story.append(self._metric_cards([
                ("Gastos", str(len(expenses)), "▣"),
                ("Total", self._money(total), "$"),
                ("Categorías", str(len(by_category)), "▦"),
            ], width))
            story.append(Spacer(1, 0.25 * cm))
            story.append(self._section_title("Detalle de gastos", width))
            data = [["Fecha", "Proveedor", "Categoría", "Concepto", "Monto", "Comprobante"]]
            for e in expenses:
                data.append([
                    str(e.get("date") or ""),
                    self._p(e.get("provider") or "", 6),
                    self._p(e.get("category") or "Sin categoría", 6),
                    self._p(e.get("concept") or "", 6),
                    self._money(e.get("amount", 0)),
                    self._p(e.get("receipt_file_name") or "Sin adjunto", 6),
                ])
            if len(data) == 1:
                data.append(["-", "-", "-", "Sin gastos registrados", self._money(0), "-"])
            story.append(self._styled_table(data[:14], [2 * cm, 3.8 * cm, 2.8 * cm, 5.2 * cm, 2 * cm, 3.1 * cm], font_size=6))
            story.append(Spacer(1, 0.22 * cm))
            final = Table([[self._p("Egresos totales registrados en el período", 11, bold=True, color="#ffffff", align="LEFT"), self._p(self._money(total), 16, bold=True, color="#ffffff")]], colWidths=[width * 0.76, width * 0.24])
            final.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), _PDF_NAVY), ("BOX", (0, 0), (-1, -1), 0.8, _PDF_BLUE), ("LEFTPADDING", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
            story.append(final)
            story.append(Spacer(1, 0.22 * cm))
            story.append(self._section_title("Comparativo respecto al mes anterior", width))
            story.append(self._comparison_table([
                {"label": "Egresos totales registrados en el período", "current": total, "previous": sum(previous_by_category.values())},
                *[
                    {"label": row["label"], "current": row["amount"], "previous": previous_by_category.get(row["label"], 0)}
                    for row in by_category[:4]
                ],
            ], width))
            self._append_signature_grid(story, width=width, building=building, document_tag="REPORTE-GASTOS")
            footer = self._footer_callback(building, width)
            doc.build(story, onFirstPage=footer, onLaterPages=footer)
            return output.getvalue()
        except Exception:
            # Fallback resiliente para evitar errores 500 por problemas de layout PDF.
            output = io.BytesIO()
            doc = SimpleDocTemplate(output, pagesize=letter, topMargin=0.6 * inch, bottomMargin=0.6 * inch)
            styles = getSampleStyleSheet()
            story = [
                Paragraph("Reporte de Gastos", styles["Title"]),
                Spacer(1, 0.14 * inch),
                Paragraph(f"Rango: {self._date_label(period, start_date, end_date)}", styles["Normal"]),
                Paragraph(f"Total egresos: {self._money(total)}", styles["Normal"]),
                Spacer(1, 0.2 * inch),
            ]

            table_data = [["Fecha", "Proveedor", "Categoría", "Concepto", "Monto"]]
            for item in expenses[:40]:
                table_data.append([
                    str(item.get("date") or ""),
                    str(item.get("provider") or "")[:40],
                    str(item.get("category") or "Sin categoría")[:30],
                    str(item.get("concept") or "")[:60],
                    self._money(item.get("amount", 0)),
                ])

            if len(table_data) == 1:
                table_data.append(["-", "-", "-", "Sin gastos registrados", self._money(0)])

            table = Table(table_data, colWidths=[1.1 * inch, 1.4 * inch, 1.2 * inch, 2.5 * inch, 1.0 * inch], repeatRows=1)
            table.setStyle(self._table_style(7))
            story.append(table)
            self._append_signature_grid(story, width=doc.width, building={}, document_tag="REPORTE-GASTOS")
            story.extend([Spacer(1, 0.2 * inch), build_pdf_footer_bar({}, width=doc.width)])
            doc.build(story)
            return output.getvalue()

    async def delinquency_pdf(self) -> bytes:
        owners = await self._delinquency.list_owners()
        
        output = io.BytesIO()
        doc = SimpleDocTemplate(output, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        story = []
        
        styles = getSampleStyleSheet()
        story.extend(
            await self._pdf_header(
                "Reporte de Morosidad",
                f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}",
                width=doc.width,
            )
        )
        
        # Table
        data = [["Propietario", "Email", "Documento", "Deuda Total", "Períodos Vencidos", "Estado"]]
        for o in owners:
            data.append([
                o["owner_name"],
                o.get("email") or "",
                o["document_id"],
                f"${float(o['deuda_total']):.2f}",
                str(o["periodos_vencidos"]),
                o["status"],
            ])
        
        table = Table(data, colWidths=[1.2*inch, 1.3*inch, 1*inch, 1*inch, 1*inch, 0.8*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#123c7a')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
        ]))
        story.append(table)
        story.append(Spacer(1, 0.3*inch))
        story.append(Paragraph("Reporte generado automáticamente", styles['Normal']))
        building = await get_default_building_config(getattr(self._payment_repo, "_conn", None))
        self._append_signature_grid(story, width=doc.width, building=building, document_tag="REPORTE-MOROSIDAD")
        footer = self._footer_callback(building, doc.width)
        
        doc.build(story, onFirstPage=footer, onLaterPages=footer)
        return output.getvalue()

    # ─── EXCEL REPORTS ───────────────────────────────────────────────────────

    async def income_excel(
        self,
        period: Optional[str],
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> bytes:
        payments = await self._payments(period, start_date, end_date)
        
        wb = Workbook()
        ws = wb.active
        ws.title = "Ingresos"
        
        # Headers
        headers = ["Fecha", "Propietario", "Departamento", "Período", "Monto", "Método", "Estado"]
        header_fill = PatternFill(start_color="123C7A", end_color="123C7A", fill_type="solid")
        header_font = Font(bold=True, color="FFFFFF")
        
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col)
            cell.value = header
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal='center')
        
        # Data
        for row, p in enumerate(payments, 2):
            ws.cell(row=row, column=1).value = str(p.get("paid_at", ""))
            ws.cell(row=row, column=2).value = p.get("owner_name", "")
            ws.cell(row=row, column=3).value = p.get("apartment_code", "")
            ws.cell(row=row, column=4).value = p.get("period", "")
            ws.cell(row=row, column=5).value = float(p.get("amount", 0))
            ws.cell(row=row, column=6).value = p.get("method", "")
            ws.cell(row=row, column=7).value = p.get("status", "")
        
        # Adjust column widths
        ws.column_dimensions['A'].width = 12
        ws.column_dimensions['B'].width = 15
        ws.column_dimensions['C'].width = 12
        ws.column_dimensions['D'].width = 10
        ws.column_dimensions['E'].width = 12
        ws.column_dimensions['F'].width = 12
        ws.column_dimensions['G'].width = 12
        
        output = io.BytesIO()
        wb.save(output)
        return output.getvalue()

    async def balance_excel(
        self,
        period: Optional[str],
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> bytes:
        payments = await self._payments(period, start_date, end_date)
        expenses = await self._expenses(period, start_date, end_date)

        total_income = sum(Decimal(str(p.get("amount", 0))) for p in payments)
        total_expenses = sum(Decimal(str(e.get("amount", 0))) for e in expenses)
        balance = total_income - total_expenses
        
        wb = Workbook()
        ws = wb.active
        ws.title = "Resumen"
        headers = ["Indicador", "Valor", "Detalle"]
        self._style_excel_header(ws, headers)
        rows = [
            ["Ingresos confirmados", float(total_income), f"{len(payments)} pagos"],
            ["Gastos registrados", float(total_expenses), f"{len(expenses)} gastos"],
            ["Diferencia neta", float(balance), "Ingresos menos gastos"],
        ]
        for row_idx, row in enumerate(rows, 2):
            for col_idx, value in enumerate(row, 1):
                ws.cell(row=row_idx, column=col_idx).value = value
        ws.column_dimensions["A"].width = 26
        ws.column_dimensions["B"].width = 16
        ws.column_dimensions["C"].width = 28

        income_ws = wb.create_sheet("Ingresos")
        self._style_excel_header(income_ws, ["Fecha", "Propietario", "Departamento", "Período", "Monto", "Método", "Estado", "Referencia"])
        for row, p in enumerate(payments, 2):
            values = [str(p.get("paid_at") or ""), p.get("owner_name") or "", p.get("apartment_code") or "", p.get("period") or "", float(p.get("amount", 0)), p.get("method") or "", p.get("status") or "", p.get("reference") or ""]
            for col, value in enumerate(values, 1):
                income_ws.cell(row=row, column=col).value = value
        for col in "ABCDEFGH":
            income_ws.column_dimensions[col].width = 16

        expense_ws = wb.create_sheet("Gastos")
        self._style_excel_header(expense_ws, ["Fecha", "Proveedor", "Categoría", "Concepto", "Monto", "Comprobante"])
        for row, e in enumerate(expenses, 2):
            values = [str(e.get("date") or ""), e.get("provider") or "", e.get("category") or "Sin categoría", e.get("concept") or "", float(e.get("amount", 0)), e.get("receipt_file_name") or ""]
            for col, value in enumerate(values, 1):
                expense_ws.cell(row=row, column=col).value = value
        for col in "ABCDEF":
            expense_ws.column_dimensions[col].width = 18
        
        output = io.BytesIO()
        wb.save(output)
        return output.getvalue()

    async def payments_excel(
        self,
        period: Optional[str],
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        status: Optional[str] = None,
    ) -> bytes:
        payments = await self._payments_report_rows(period, start_date, end_date, status)
        wb = Workbook()
        ws = wb.active
        ws.title = "Pagos"
        headers = ["Fecha", "Propietario", "Departamento", "Período", "Monto", "Método", "Estado", "Referencia"]
        self._style_excel_header(ws, headers)
        for row, p in enumerate(payments, 2):
            values = [str(p.get("paid_at") or ""), p.get("owner_name") or "", p.get("apartment_code") or "", p.get("period") or "", float(p.get("amount", 0)), p.get("method") or "", p.get("status") or "", p.get("reference") or ""]
            for col, value in enumerate(values, 1):
                ws.cell(row=row, column=col).value = value
        for col in "ABCDEFGH":
            ws.column_dimensions[col].width = 16
        output = io.BytesIO()
        wb.save(output)
        return output.getvalue()

    async def expenses_excel(
        self,
        period: Optional[str],
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> bytes:
        expenses = await self._expenses(period, start_date, end_date)
        wb = Workbook()
        ws = wb.active
        ws.title = "Gastos"
        headers = ["Fecha", "Proveedor", "Categoría", "Concepto", "Monto", "Comprobante"]
        self._style_excel_header(ws, headers)
        for row, e in enumerate(expenses, 2):
            values = [str(e.get("date") or ""), e.get("provider") or "", e.get("category") or "Sin categoría", e.get("concept") or "", float(e.get("amount", 0)), e.get("receipt_file_name") or ""]
            for col, value in enumerate(values, 1):
                ws.cell(row=row, column=col).value = value
        ws.column_dimensions["A"].width = 14
        ws.column_dimensions["B"].width = 22
        ws.column_dimensions["C"].width = 18
        ws.column_dimensions["D"].width = 34
        ws.column_dimensions["E"].width = 14
        ws.column_dimensions["F"].width = 24
        output = io.BytesIO()
        wb.save(output)
        return output.getvalue()

    async def _fees_report_rows(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> list[dict]:
        conditions: list[str] = []
        params: list = []
        idx = 1
        if start_date:
            conditions.append(f"af.period >= ${idx}")
            params.append(start_date.strftime("%Y-%m"))
            idx += 1
        if end_date:
            conditions.append(f"af.period <= ${idx}")
            params.append(end_date.strftime("%Y-%m"))
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        rows = await self._payment_repo._conn.fetch(
            f"""
            SELECT
                af.period,
                a.code AS apartment_code,
                COALESCE(o.full_name, 'Sin propietario') AS owner_name,
                af.amount,
                COALESCE(p.paid_amount, 0) AS paid_amount,
                af.amount - COALESCE(p.paid_amount, 0) AS pending_amount,
                CASE WHEN COALESCE(p.paid_amount, 0) >= af.amount THEN 'PAGADA' ELSE 'PENDIENTE' END AS status
            FROM apartment_fees af
            JOIN apartments a ON af.apartment_id = a.id
            LEFT JOIN owner_apartments oa ON oa.apartment_id = a.id
            LEFT JOIN owners o ON o.id = oa.owner_id
            LEFT JOIN (
                SELECT apartment_id, period, SUM(amount) AS paid_amount
                FROM payments
                WHERE status IN ('REGISTRADO', 'APROBADO') AND fine_id IS NULL
                GROUP BY apartment_id, period
            ) p ON p.apartment_id = af.apartment_id AND p.period = af.period
            {where}
            ORDER BY af.period DESC, a.code
            """,
            *params,
        )
        return [dict(row) for row in rows]

    async def _fines_report_rows(
        self,
        period: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        status: Optional[str] = None,
        reason: Optional[str] = None,
        search: Optional[str] = None,
    ) -> list[dict]:
        conditions: list[str] = []
        params: list = []
        idx = 1
        if period:
            conditions.append(f"f.period = ${idx}")
            params.append(period)
            idx += 1
        if status:
            conditions.append(f"f.status = ${idx}")
            params.append(status)
            idx += 1
        if reason:
            conditions.append(f"f.reason = ${idx}")
            params.append(reason)
            idx += 1
        if search:
            conditions.append(
                f"(LOWER(COALESCE(f.reason, '')) LIKE ${idx} OR LOWER(a.code) LIKE ${idx} OR LOWER(o.full_name) LIKE ${idx})"
            )
            params.append(f"%{search.lower()}%")
            idx += 1
        if start_date:
            conditions.append(f"f.issued_at >= ${idx}")
            params.append(start_date)
            idx += 1
        if end_date:
            conditions.append(f"f.issued_at <= ${idx}")
            params.append(end_date)
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        rows = await self._payment_repo._conn.fetch(
            f"""
            SELECT f.*, a.code AS apartment_code, o.full_name AS owner_name
            FROM fines f
            JOIN apartments a ON f.apartment_id = a.id
            JOIN owners o ON f.owner_id = o.id
            {where}
            ORDER BY f.issued_at DESC, f.created_at DESC
            """,
            *params,
        )
        return [dict(row) for row in rows]

    async def _owners_report_rows(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        status: Optional[str] = None,
    ) -> list[dict]:
        conditions: list[str] = []
        params: list = []
        idx = 1
        if status:
            conditions.append(f"o.status = ${idx}")
            params.append(status)
            idx += 1
        if start_date:
            conditions.append(f"o.created_at::date >= ${idx}")
            params.append(start_date)
            idx += 1
        if end_date:
            conditions.append(f"o.created_at::date <= ${idx}")
            params.append(end_date)
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        rows = await self._payment_repo._conn.fetch(
            f"""
            SELECT
                o.id,
                o.full_name,
                o.document_id,
                o.email,
                o.phone,
                o.status,
                o.created_at,
                COUNT(DISTINCT oa.apartment_id)::int AS units_count,
                STRING_AGG(DISTINCT a.code, ', ' ORDER BY a.code) AS units
            FROM owners o
            LEFT JOIN owner_apartments oa ON oa.owner_id = o.id
            LEFT JOIN apartments a ON a.id = oa.apartment_id
            {where}
            GROUP BY o.id
            ORDER BY o.full_name
            """,
            *params,
        )
        return [dict(row) for row in rows]

    async def _buildings_report_rows(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> list[dict]:
        conditions: list[str] = []
        params: list = []
        idx = 1
        if start_date:
            conditions.append(f"b.created_at::date >= ${idx}")
            params.append(start_date)
            idx += 1
        if end_date:
            conditions.append(f"b.created_at::date <= ${idx}")
            params.append(end_date)
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        rows = await self._payment_repo._conn.fetch(
            f"""
            SELECT
                b.*,
                COUNT(DISTINCT a.id)::int AS apartments_count
            FROM buildings b
            LEFT JOIN apartments a ON a.building_id = b.id
            {where}
            GROUP BY b.id
            ORDER BY b.created_at ASC
            """,
            *params,
        )
        return [dict(row) for row in rows]

    async def fees_pdf(self, start_date: Optional[date] = None, end_date: Optional[date] = None) -> bytes:
        rows = await self._fees_report_rows(start_date, end_date)
        total = sum(Decimal(str(row.get("amount", 0))) for row in rows)
        collected = sum(Decimal(str(row.get("paid_amount", 0))) for row in rows)
        building = await get_default_building_config(getattr(self._payment_repo, "_conn", None))
        output = io.BytesIO()
        doc = SimpleDocTemplate(output, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        story = []
        styles = getSampleStyleSheet()
        story.extend(await self._pdf_header("Reporte Detallado de Cuotas", f"Rango: {self._date_label(None, start_date, end_date)}", width=doc.width))
        summary = Table([["Cuotas", "Emitido", "Recaudado", "Pendiente"], [str(len(rows)), self._money(total), self._money(collected), self._money(total - collected)]])
        summary.setStyle(self._table_style(8))
        story.extend([summary, Spacer(1, 0.2*inch), Paragraph("Detalle de cuotas", styles["Heading3"])])
        data = [["Período", "Depto", "Propietario", "Emitido", "Pagado", "Pendiente", "Estado"]]
        data.extend([[r.get("period", ""), r.get("apartment_code", ""), r.get("owner_name", ""), self._money(r.get("amount")), self._money(r.get("paid_amount")), self._money(r.get("pending_amount")), r.get("status", "")] for r in rows])
        table = Table(data, colWidths=[0.75*inch, 0.65*inch, 1.55*inch, 0.85*inch, 0.85*inch, 0.85*inch, 0.85*inch], repeatRows=1)
        table.setStyle(self._table_style(7))
        story.append(table)
        self._append_signature_grid(story, width=doc.width, building=building, document_tag="REPORTE-CUOTAS")
        story.extend([Spacer(1, 0.2 * inch), build_pdf_footer_bar(building, width=doc.width)])
        doc.build(story)
        return output.getvalue()

    async def fees_excel(self, start_date: Optional[date] = None, end_date: Optional[date] = None) -> bytes:
        rows = await self._fees_report_rows(start_date, end_date)
        wb = Workbook()
        ws = wb.active
        ws.title = "Cuotas"
        headers = ["Período", "Departamento", "Propietario", "Emitido", "Pagado", "Pendiente", "Estado"]
        self._style_excel_header(ws, headers)
        for row_idx, row in enumerate(rows, 2):
            values = [row.get("period", ""), row.get("apartment_code", ""), row.get("owner_name", ""), float(row.get("amount", 0)), float(row.get("paid_amount", 0)), float(row.get("pending_amount", 0)), row.get("status", "")]
            for col, value in enumerate(values, 1):
                ws.cell(row=row_idx, column=col).value = value
        for col in "ABCDEFG":
            ws.column_dimensions[col].width = 18
        output = io.BytesIO()
        wb.save(output)
        return output.getvalue()

    async def fines_pdf(self, period: Optional[str] = None, start_date: Optional[date] = None, end_date: Optional[date] = None, status: Optional[str] = None, reason: Optional[str] = None, search: Optional[str] = None) -> bytes:
        rows = await self._fines_report_rows(period, start_date, end_date, status, reason, search)
        total = sum(Decimal(str(row.get("amount", 0))) for row in rows)
        building = await get_default_building_config(getattr(self._payment_repo, "_conn", None))
        output = io.BytesIO()
        doc = SimpleDocTemplate(output, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        story = []
        styles = getSampleStyleSheet()
        story.extend(await self._pdf_header("Reporte Detallado de Multas", f"Rango: {self._date_label(period, start_date, end_date)} | Estado: {status or 'Todos'}", width=doc.width))
        summary = Table([["Multas", "Monto total"], [str(len(rows)), self._money(total)]], colWidths=[2*inch, 2*inch])
        summary.setStyle(self._table_style(8))
        story.extend([summary, Spacer(1, 0.2*inch), Paragraph("Detalle de multas", styles["Heading3"])])
        data = [["Fecha", "Depto", "Propietario", "Período", "Motivo", "Monto", "Estado"]]
        data.extend([[str(r.get("issued_at") or ""), r.get("apartment_code", ""), r.get("owner_name", ""), r.get("period", ""), r.get("reason", ""), self._money(r.get("amount")), r.get("status", "")] for r in rows])
        table = Table(data, colWidths=[0.8*inch, 0.55*inch, 1.1*inch, 0.65*inch, 1.8*inch, 0.75*inch, 0.75*inch], repeatRows=1)
        table.setStyle(self._table_style(7))
        story.append(table)
        self._append_signature_grid(story, width=doc.width, building=building, document_tag="REPORTE-MULTAS")
        story.extend([Spacer(1, 0.2 * inch), build_pdf_footer_bar(building, width=doc.width)])
        doc.build(story)
        return output.getvalue()

    async def fines_excel(self, period: Optional[str] = None, start_date: Optional[date] = None, end_date: Optional[date] = None, status: Optional[str] = None, reason: Optional[str] = None, search: Optional[str] = None) -> bytes:
        rows = await self._fines_report_rows(period, start_date, end_date, status, reason, search)
        wb = Workbook()
        ws = wb.active
        ws.title = "Multas"
        headers = ["Fecha", "Departamento", "Propietario", "Período", "Motivo", "Monto", "Estado"]
        self._style_excel_header(ws, headers)
        for row_idx, row in enumerate(rows, 2):
            values = [str(row.get("issued_at") or ""), row.get("apartment_code", ""), row.get("owner_name", ""), row.get("period", ""), row.get("reason", ""), float(row.get("amount", 0)), row.get("status", "")]
            for col, value in enumerate(values, 1):
                ws.cell(row=row_idx, column=col).value = value
        for col in "ABCDEFG":
            ws.column_dimensions[col].width = 18
        output = io.BytesIO()
        wb.save(output)
        return output.getvalue()

    async def owners_pdf(self, start_date: Optional[date] = None, end_date: Optional[date] = None, status: Optional[str] = None) -> bytes:
        rows = await self._owners_report_rows(start_date, end_date, status)
        building = await get_default_building_config(getattr(self._payment_repo, "_conn", None))
        output = io.BytesIO()
        doc = SimpleDocTemplate(output, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        story = []
        styles = getSampleStyleSheet()
        story.extend(await self._pdf_header("Reporte de Propietarios", f"Rango: {self._date_label(None, start_date, end_date)} | Estado: {status or 'Todos'}", width=doc.width))
        story.extend([Paragraph(f"Total de propietarios: {len(rows)}", styles["Heading3"]), Spacer(1, 0.15*inch)])
        data = [["Ingreso", "Propietario", "Documento", "Email", "Teléfono", "Unidades", "Estado"]]
        data.extend([[str(r.get("created_at").date() if r.get("created_at") else ""), r.get("full_name", ""), r.get("document_id", ""), r.get("email", ""), r.get("phone", ""), r.get("units") or "", r.get("status", "")] for r in rows])
        table = Table(data, colWidths=[0.7*inch, 1.25*inch, 0.85*inch, 1.35*inch, 0.8*inch, 0.9*inch, 0.65*inch], repeatRows=1)
        table.setStyle(self._table_style(7))
        story.append(table)
        self._append_signature_grid(story, width=doc.width, building=building, document_tag="REPORTE-PROPIETARIOS")
        story.extend([Spacer(1, 0.2 * inch), build_pdf_footer_bar(building, width=doc.width)])
        doc.build(story)
        return output.getvalue()

    async def owners_excel(self, start_date: Optional[date] = None, end_date: Optional[date] = None, status: Optional[str] = None) -> bytes:
        rows = await self._owners_report_rows(start_date, end_date, status)
        wb = Workbook()
        ws = wb.active
        ws.title = "Propietarios"
        headers = ["Ingreso", "Propietario", "Documento", "Email", "Teléfono", "Unidades", "Estado"]
        self._style_excel_header(ws, headers)
        for row_idx, row in enumerate(rows, 2):
            values = [str(row.get("created_at").date() if row.get("created_at") else ""), row.get("full_name", ""), row.get("document_id", ""), row.get("email", ""), row.get("phone", ""), row.get("units") or "", row.get("status", "")]
            for col, value in enumerate(values, 1):
                ws.cell(row=row_idx, column=col).value = value
        for col in "ABCDEFG":
            ws.column_dimensions[col].width = 20
        output = io.BytesIO()
        wb.save(output)
        return output.getvalue()

    async def buildings_pdf(self, start_date: Optional[date] = None, end_date: Optional[date] = None) -> bytes:
        rows = await self._buildings_report_rows(start_date, end_date)
        building = await get_default_building_config(getattr(self._payment_repo, "_conn", None))
        output = io.BytesIO()
        doc = SimpleDocTemplate(output, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        story = []
        styles = getSampleStyleSheet()
        story.extend(await self._pdf_header("Reporte de Edificios", f"Rango: {self._date_label(None, start_date, end_date)}", width=doc.width))
        story.extend([Paragraph(f"Total de edificios: {len(rows)}", styles["Heading3"]), Spacer(1, 0.15*inch)])
        data = [["Creado", "Edificio", "Dirección", "Teléfono", "Email", "Departamentos"]]
        data.extend([[str(r.get("created_at").date() if r.get("created_at") else ""), r.get("name", ""), r.get("address", ""), r.get("phone", ""), r.get("email", ""), str(r.get("apartments_count", 0))] for r in rows])
        table = Table(data, colWidths=[0.75*inch, 1.35*inch, 1.5*inch, 0.85*inch, 1.4*inch, 0.75*inch], repeatRows=1)
        table.setStyle(self._table_style(7))
        story.append(table)
        self._append_signature_grid(story, width=doc.width, building=building, document_tag="REPORTE-EDIFICIOS")
        story.extend([Spacer(1, 0.2 * inch), build_pdf_footer_bar(building, width=doc.width)])
        doc.build(story)
        return output.getvalue()

    async def buildings_excel(self, start_date: Optional[date] = None, end_date: Optional[date] = None) -> bytes:
        rows = await self._buildings_report_rows(start_date, end_date)
        wb = Workbook()
        ws = wb.active
        ws.title = "Edificios"
        headers = ["Creado", "Edificio", "Dirección", "Teléfono", "Email", "Departamentos"]
        self._style_excel_header(ws, headers)
        for row_idx, row in enumerate(rows, 2):
            values = [str(row.get("created_at").date() if row.get("created_at") else ""), row.get("name", ""), row.get("address", ""), row.get("phone", ""), row.get("email", ""), int(row.get("apartments_count", 0))]
            for col, value in enumerate(values, 1):
                ws.cell(row=row_idx, column=col).value = value
        for col in "ABCDEF":
            ws.column_dimensions[col].width = 22
        output = io.BytesIO()
        wb.save(output)
        return output.getvalue()

    async def delinquency_excel(self) -> bytes:
        owners = await self._delinquency.list_owners()
        
        wb = Workbook()
        ws = wb.active
        ws.title = "Morosidad"
        
        # Headers
        headers = ["Propietario", "Email", "Documento", "Deuda Total", "Períodos Vencidos", "Estado"]
        header_fill = PatternFill(start_color="123C7A", end_color="123C7A", fill_type="solid")
        header_font = Font(bold=True, color="FFFFFF")
        
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col)
            cell.value = header
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal='center')
        
        # Data
        for row, o in enumerate(owners, 2):
            ws.cell(row=row, column=1).value = o["owner_name"]
            ws.cell(row=row, column=2).value = o.get("email") or ""
            ws.cell(row=row, column=3).value = o["document_id"]
            ws.cell(row=row, column=4).value = float(o["deuda_total"])
            ws.cell(row=row, column=5).value = o["periodos_vencidos"]
            ws.cell(row=row, column=6).value = o["status"]
        
        # Adjust column widths
        ws.column_dimensions['A'].width = 15
        ws.column_dimensions['B'].width = 18
        ws.column_dimensions['C'].width = 12
        ws.column_dimensions['D'].width = 14
        ws.column_dimensions['E'].width = 16
        ws.column_dimensions['F'].width = 12
        
        output = io.BytesIO()
        wb.save(output)
        return output.getvalue()

    async def owner_ficha_pdf(self, owner_id: UUID) -> bytes:
        # 1. Fetch data
        conn = self._payment_repo._conn
        owner = await conn.fetchrow("SELECT * FROM owners WHERE id = $1", owner_id)
        if not owner:
            raise ValueError("Propietario no encontrado")
        owner = dict(owner)
        
        building = await get_default_building_config(conn)
        
        # Get first apartment
        apt = await conn.fetchrow(
            """
            SELECT a.* FROM apartments a
            JOIN owner_apartments oa ON a.id = oa.apartment_id
            WHERE oa.owner_id = $1
            ORDER BY oa.is_primary DESC, a.code
            LIMIT 1
            """,
            owner_id,
        )
        apt = dict(apt) if apt else {}

        # 2. Financial calculation
        total_pagado = await conn.fetchval(
            "SELECT COALESCE(SUM(amount), 0.0) FROM payments WHERE owner_id = $1 AND status = 'REGISTRADO'",
            owner_id,
        )
        last_payment_date = await conn.fetchval(
            "SELECT paid_at FROM payments WHERE owner_id = $1 AND status = 'REGISTRADO' ORDER BY paid_at DESC LIMIT 1",
            owner_id,
        )
        
        # Calculate balance
        balance_row = await conn.fetchrow(
            """
            SELECT
                COALESCE(SUM(fees_amount - payments_amount + fines_amount), 0.0) as total_balance
            FROM (
                SELECT
                    COALESCE(af.amount, 0.0) as fees_amount,
                    COALESCE(p.amount, 0.0) as payments_amount,
                    COALESCE(f.amount, 0.0) as fines_amount
                FROM apartment_fees af
                FULL OUTER JOIN payments p ON p.apartment_id = af.apartment_id AND p.period = af.period AND p.status = 'REGISTRADO'
                FULL OUTER JOIN fines f ON f.apartment_id = af.apartment_id AND f.period = f.period AND f.status = 'ACTIVA'
                JOIN owner_apartments oa ON af.apartment_id = oa.apartment_id
                WHERE oa.owner_id = $1
            ) balance_calc
            """,
            owner_id,
        )
        saldo_actual = float(balance_row["total_balance"]) if balance_row else 0.0
        
        # Current month charges and payments
        current_month = datetime.now().strftime("%Y-%m")
        pagos_mes = await conn.fetchval(
            "SELECT COALESCE(SUM(amount), 0.0) FROM payments WHERE owner_id = $1 AND period = $2 AND status = 'REGISTRADO'",
            owner_id,
            current_month,
        )
        cargos_mes = await conn.fetchval(
            """
            SELECT COALESCE(SUM(af.amount), 0.0) FROM apartment_fees af
            JOIN owner_apartments oa ON af.apartment_id = oa.apartment_id
            WHERE oa.owner_id = $1 AND af.period = $2
            """,
            owner_id,
            current_month,
        )
        saldo_anterior = saldo_actual - float(cargos_mes) + float(pagos_mes)
        
        # Recent 3 payments
        recent_payments = await conn.fetch(
            """
            SELECT paid_at, period, amount
            FROM payments
            WHERE owner_id = $1 AND status = 'REGISTRADO'
            ORDER BY paid_at DESC
            LIMIT 3
            """,
            owner_id,
        )
        recent_payments = [dict(p) for p in recent_payments]
        
        # Settings
        due_day = 5
        settings_row = await conn.fetchrow("SELECT due_day FROM settings LIMIT 1")
        if settings_row:
            due_day = settings_row["due_day"]
        
        # Next due date
        now = datetime.now()
        if now.month == 12:
            next_due = date(now.year + 1, 1, due_day)
        else:
            next_due = date(now.year, now.month + 1, due_day)

        # 3. Setup PDF document
        output = io.BytesIO()
        width = A4[0] - 1.4 * cm
        doc = SimpleDocTemplate(
            output,
            pagesize=A4,
            leftMargin=0.7 * cm,
            rightMargin=0.7 * cm,
            topMargin=0.5 * cm,
            bottomMargin=1.4 * cm,
        )
        story = []
        
        # Add QR Code widget to reportlab graphics
        def _qr_drawing(value: str, size: float = 2.0 * cm) -> Drawing:
            from reportlab.graphics.barcode import qr
            from reportlab.graphics.shapes import Drawing
            code = qr.QrCodeWidget(value)
            bounds = code.getBounds()
            drawing = Drawing(size, size, transform=[size / (bounds[2] - bounds[0]), 0, 0, size / (bounds[3] - bounds[1]), 0, 0])
            drawing.add(code)
            return drawing
            
        # Emission date and sheet number block
        emission_date = datetime.now().strftime("%d/%m/%Y")
        sheet_number = f"FTN-{datetime.now().year}-{str(owner['document_id'])[-6:].zfill(6)}"

        qr_draw = _qr_drawing(f"FICHA-{owner['id']}-{sheet_number}", size=1.8 * cm)
        story.extend(
            build_pdf_brand_header(
                "FICHA DEL COPROPIETARIO",
                f"Ficha N.°: {sheet_number}",
                building,
                width=width,
            )
        )

        header_info = Table(
            [
                [
                    qr_draw,
                    Paragraph(
                        "<font size='8' color='#123c7a'><b>DATOS DE EMISION</b></font><br/>"
                        f"<font size='8' color='#4b5563'>Fecha de emisión: {emission_date}</font><br/>"
                        f"<font size='8' color='#4b5563'><b>Ficha N.°: {sheet_number}</b></font>",
                        ParagraphStyle("FichaHeaderInfo", fontName="Helvetica", leading=11),
                    ),
                ]
            ],
            colWidths=[2.1 * cm, width - 2.1 * cm],
        )
        header_info.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#123c7a")),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d4dfef")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(header_info)
        story.append(Spacer(1, 0.08 * cm))
        
        # Helper for sections titles
        def make_section_title(title_text: str):
            t = Table(
                [[Paragraph(f"<font size='9' color='#123c7a'><b>{title_text}</b></font>", ParagraphStyle("SecTitle", fontName="Helvetica-Bold", leading=11))]],
                colWidths=[width]
            )
            t.setStyle(TableStyle([
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor("#123c7a")),
            ]))
            return t

        # SECTION 1: DATOS DEL COPROPIETARIO
        story.append(make_section_title("1. DATOS DEL COPROPIETARIO"))
        story.append(Spacer(1, 0.15 * cm))
        
        # Left side: owner info
        avatar_placeholder = Paragraph("<font size='28' color='#9ca3af'><b>👤</b></font>", ParagraphStyle("Avatar", fontName="Helvetica", alignment=1))
        
        reg_date_str = self._spanish_date(owner.get("created_at").date()) if owner.get("created_at") else "--"
        birth_date_str = self._spanish_date(owner.get("birth_date")) if owner.get("birth_date") else "--"
        
        owner_text = (
            f"<font size='10' color='#1f2937'><b>{escape(owner['full_name'])}</b></font><br/>"
            f"<font size='7.5' color='#6b7280'>Copropietario</font><br/><br/>"
            f"<font size='7.5' color='#4b5563'>✉ {escape(owner.get('email') or '--')}</font><br/>"
            f"<font size='7.5' color='#4b5563'>📞 {escape(owner.get('phone') or '--')}</font><br/>"
            f"<font size='7.5' color='#4b5563'>📇 C.I.: {escape(owner.get('document_id') or '--')}</font><br/>"
            f"<font size='7.5' color='#4b5563'>📅 Fecha de registro: {reg_date_str}</font>"
        )
        owner_info_p = Paragraph(owner_text, ParagraphStyle("OwnerInfoText", fontName="Helvetica", leading=11))
        
        # Right side: unit general info
        apt_code = apt.get("code") or "--"
        apt_tower = apt.get("tower") or "--"
        apt_floor = str(apt.get("floor") or "--")
        apt_area = f"{apt.get('area_sqm'):,.2f} m²" if apt.get("area_sqm") else "--"
        apt_quota = f"{apt.get('allocated_quota_percent'):,.2f} %" if apt.get("allocated_quota_percent") else "--"
        apt_status_label = "Al día" if saldo_actual <= 0 else "Con deuda"
        apt_status_color = "#1f8f4d" if saldo_actual <= 0 else "#c74444"
        
        unit_summary_data = [
            [Paragraph("<font size='7.5' color='#4b5563'>🏢 Departamento:</font>", ParagraphStyle("L1")), Paragraph(f"<font size='7.5' color='#1f2937'><b>{apt_code}</b></font>", ParagraphStyle("R1"))],
            [Paragraph("<font size='7.5' color='#4b5563'>🗼 Torre:</font>", ParagraphStyle("L2")), Paragraph(f"<font size='7.5' color='#1f2937'>{apt_tower}</font>", ParagraphStyle("R2"))],
            [Paragraph("<font size='7.5' color='#4b5563'>📍 Piso:</font>", ParagraphStyle("L3")), Paragraph(f"<font size='7.5' color='#1f2937'>{apt_floor}</font>", ParagraphStyle("R3"))],
            [Paragraph("<font size='7.5' color='#4b5563'>📐 Área del depto:</font>", ParagraphStyle("L4")), Paragraph(f"<font size='7.5' color='#1f2937'>{apt_area}</font>", ParagraphStyle("R4"))],
            [Paragraph("<font size='7.5' color='#4b5563'>% Porcentaje alícuota:</font>", ParagraphStyle("L5")), Paragraph(f"<font size='7.5' color='#1f2937'>{apt_quota}</font>", ParagraphStyle("R5"))],
            [Paragraph("<font size='7.5' color='#4b5563'>📊 Estado:</font>", ParagraphStyle("L6")), Paragraph(f"<font size='7.5' color='{apt_status_color}'><b>● {apt_status_label}</b></font>", ParagraphStyle("R6"))],
        ]
        
        unit_summary_table = Table(unit_summary_data, colWidths=[width * 0.22, width * 0.22])
        unit_summary_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("LINEBELOW", (0, 0), (-1, -2), 0.4, colors.HexColor("#e5e7eb")),
        ]))
        
        # Combine Left & Right
        sec1_table = Table(
            [[avatar_placeholder, owner_info_p, unit_summary_table]],
            colWidths=[1.8 * cm, width * 0.48, width * 0.44]
        )
        sec1_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("BACKGROUND", (2, 0), (2, 0), colors.HexColor("#f8fafc")),
            ("BOX", (2, 0), (2, 0), 0.5, colors.HexColor("#e5e7eb")),
        ]))
        story.append(sec1_table)
        story.append(Spacer(1, 0.12 * cm))
        
        # SECTION 2: INFORMACIÓN DEL DEPARTAMENTO
        story.append(make_section_title("2. INFORMACIÓN DEL DEPARTAMENTO"))
        story.append(Spacer(1, 0.15 * cm))
        
        # Replicating department details table (two-column key-value format without image)
        apt_bedrooms = str(apt.get("bedrooms") or "3")
        apt_bathrooms = f"{float(apt.get('bathrooms') or 2.5):g}"
        apt_parking = apt.get("parking") or "1 (P-28)"
        apt_storage = apt.get("storage") or "B-12"
        apt_acquisition = self._spanish_date(apt.get("acquisition_date")) if apt.get("acquisition_date") else "15 de junio de 2022"
        apt_use = apt.get("use_type") or "Departamento residencial"
        
        sec2_data = [
            [
                Paragraph("<font size='7.5' color='#4b5563'>Código del departamento:</font>", ParagraphStyle("K1")),
                Paragraph(f"<font size='7.5' color='#1f2937'><b>{apt_code}</b></font>", ParagraphStyle("V1")),
                Paragraph("<font size='7.5' color='#4b5563'>Bodega:</font>", ParagraphStyle("K4")),
                Paragraph(f"<font size='7.5' color='#1f2937'>{apt_storage}</font>", ParagraphStyle("V4"))
            ],
            [
                Paragraph("<font size='7.5' color='#4b5563'>Tipo de unidad:</font>", ParagraphStyle("K2")),
                Paragraph(f"<font size='7.5' color='#1f2937'>{apt_use}</font>", ParagraphStyle("V2")),
                Paragraph("<font size='7.5' color='#4b5563'>Fecha de adquisición:</font>", ParagraphStyle("K5")),
                Paragraph(f"<font size='7.5' color='#1f2937'>{apt_acquisition}</font>", ParagraphStyle("V5"))
            ],
            [
                Paragraph("<font size='7.5' color='#4b5563'>Número de habitaciones:</font>", ParagraphStyle("K3")),
                Paragraph(f"<font size='7.5' color='#1f2937'>{apt_bedrooms}</font>", ParagraphStyle("V3")),
                Paragraph("<font size='7.5' color='#4b5563'>Uso del departamento:</font>", ParagraphStyle("K6")),
                Paragraph(f"<font size='7.5' color='#1f2937'>{apt_use}</font>", ParagraphStyle("V6"))
            ],
            [
                Paragraph("<font size='7.5' color='#4b5563'>Número de baños:</font>", ParagraphStyle("K3_1")),
                Paragraph(f"<font size='7.5' color='#1f2937'>{apt_bathrooms}</font>", ParagraphStyle("V3_1")),
                Paragraph("<font size='7.5' color='#4b5563'>Estado actual:</font>", ParagraphStyle("K7")),
                Paragraph(f"<font size='7.5' color='{apt_status_color}'><b>● {apt_status_label}</b></font>", ParagraphStyle("V7"))
            ],
            [
                Paragraph("<font size='7.5' color='#4b5563'>Parqueaderos:</font>", ParagraphStyle("K3_2")),
                Paragraph(f"<font size='7.5' color='#1f2937'>{apt_parking}</font>", ParagraphStyle("V3_2")),
                Spacer(1,1), Spacer(1,1)
            ]
        ]
        sec2_table = Table(sec2_data, colWidths=[width * 0.28, width * 0.22, width * 0.28, width * 0.22])
        sec2_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("LEFTPADDING", (0, 0), (-1, -1), 1),
            ("RIGHTPADDING", (0, 0), (-1, -1), 1),
            ("LINEBELOW", (0, 0), (-1, -1), 0.2, colors.HexColor("#e5e7eb")),
        ]))
        story.append(sec2_table)
        story.append(Spacer(1, 0.12 * cm))
        
        # SECTION 3: INFORMACIÓN FINANCIERA
        story.append(make_section_title("3. INFORMACIÓN FINANCIERA"))
        story.append(Spacer(1, 0.15 * cm))
        
        # Column 1: Resumen de pagos
        last_pay_str = self._spanish_date(last_payment_date) if last_payment_date else "--"
        next_due_str = self._spanish_date(next_due)
        
        resumen_data = [
            [Paragraph("<font size='8' color='#123c7a'><b>Resumen de pagos</b></font>", ParagraphStyle("ResT"))],
            [Paragraph(f"<font size='7' color='#4b5563'>Estado actual:</font><br/><font size='8.5' color='{apt_status_color}'><b>{apt_status_label}</b></font>", ParagraphStyle("Item1"))],
            [Paragraph(f"<font size='7' color='#4b5563'>Último pago:</font><br/><font size='7.5' color='#1f2937'>{last_pay_str}</font>", ParagraphStyle("Item2"))],
            [Paragraph(f"<font size='7' color='#4b5563'>Próximo vencimiento:</font><br/><font size='7.5' color='#1f2937'>{next_due_str}</font>", ParagraphStyle("Item3"))],
            [Paragraph(f"<font size='7' color='#4b5563'>Total alícuotas pagadas:</font><br/><font size='8' color='#1f2937'><b>{self._money(total_pagado)}</b></font>", ParagraphStyle("Item4"))],
            [Paragraph(f"<font size='7' color='#4b5563'>Total en mora:</font><br/><font size='8.5' color='{apt_status_color}'><b>{self._money(saldo_actual)}</b></font>", ParagraphStyle("Item5"))],
            [Paragraph(f"<font size='6.5' color='#1f8f4d'><b>✓ El copropietario se encuentra al día con sus obligaciones.</b></font>" if saldo_actual <= 0 else f"<font size='6.5' color='#c74444'><b>⚠️ El copropietario registra saldo pendiente de pago.</b></font>", ParagraphStyle("AlertText"))]
        ]
        resumen_table = Table(resumen_data, colWidths=[width * 0.32])
        resumen_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
            ("LINEBELOW", (0, 0), (0, 0), 0.6, colors.HexColor("#123c7a")),
            ("BACKGROUND", (0, -1), (0, -1), colors.HexColor("#edf9f0") if saldo_actual <= 0 else colors.HexColor("#fdf2f2")),
            ("BOX", (0, -1), (0, -1), 0.3, colors.HexColor("#1f8f4d") if saldo_actual <= 0 else colors.HexColor("#f87171")),
        ]))
        
        # Column 2: Últimos 3 pagos registrados
        pagos_headers = [
            Paragraph("<b>Fecha</b>", ParagraphStyle("PH1", fontName="Helvetica-Bold", size=7, color="#ffffff")),
            Paragraph("<b>Concepto</b>", ParagraphStyle("PH2", fontName="Helvetica-Bold", size=7, color="#ffffff")),
            Paragraph("<b>Valor (USD)</b>", ParagraphStyle("PH3", fontName="Helvetica-Bold", size=7, color="#ffffff", align="RIGHT")),
        ]
        pagos_rows = [pagos_headers]
        
        sum_last_3 = Decimal("0.00")
        for p in recent_payments:
            pay_date = p["paid_at"].strftime("%d/%m/%Y") if isinstance(p["paid_at"], (date, datetime)) else str(p["paid_at"])
            pay_period = self._period_name(p["period"]).capitalize()
            pay_concept = f"Alícuota - {pay_period}"
            pay_amount = Decimal(str(p["amount"]))
            sum_last_3 += pay_amount
            
            pagos_rows.append([
                Paragraph(f"<font size='7' color='#374151'>{pay_date}</font>", ParagraphStyle("PD1")),
                Paragraph(f"<font size='7' color='#374151'>{pay_concept}</font>", ParagraphStyle("PD2")),
                Paragraph(f"<font size='7' color='#374151'>{self._money(pay_amount)}</font>", ParagraphStyle("PD3", align="RIGHT")),
            ])
            
        while len(pagos_rows) < 4:
            pagos_rows.append([
                Paragraph("<font size='7' color='#9ca3af'>--</font>", ParagraphStyle("PD1")),
                Paragraph("<font size='7' color='#9ca3af'>Sin registro</font>", ParagraphStyle("PD2")),
                Paragraph("<font size='7' color='#9ca3af'>$0.00</font>", ParagraphStyle("PD3", align="RIGHT")),
            ])
            
        # Total row
        pagos_rows.append([
            Paragraph("<b>Total pagado en el período</b>", ParagraphStyle("PTT", fontName="Helvetica-Bold", size=7, color="#123c7a")),
            Spacer(1,1),
            Paragraph(f"<b>{self._usd(sum_last_3)}</b>", ParagraphStyle("PTA", fontName="Helvetica-Bold", size=7, color="#123c7a", align="RIGHT")),
        ])
        
        pagos_table = Table(pagos_rows, colWidths=[width * 0.095, width * 0.135, width * 0.10])
        pagos_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#123c7a")),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("ALIGN", (2, 0), (2, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("GRID", (0, 0), (-1, -2), 0.3, colors.HexColor("#e5e7eb")),
            ("SPAN", (0, -1), (1, -1)),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#dbe7f7")),
            ("BOX", (0, -1), (-1, -1), 0.5, colors.HexColor("#123c7a")),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ]))
        
        # Column 3: Estado de cuenta actual
        fin_rows = [
            [Paragraph("<b>Concepto</b>", ParagraphStyle("FH1", fontName="Helvetica-Bold", size=7, color="#ffffff")), Paragraph("<b>Monto (USD)</b>", ParagraphStyle("FH2", fontName="Helvetica-Bold", size=7, color="#ffffff", align="RIGHT"))],
            [Paragraph("<font size='7' color='#4b5563'>Saldo anterior:</font>", ParagraphStyle("FL1")), Paragraph(f"<font size='7' color='#1f2937'>{self._money(saldo_anterior)}</font>", ParagraphStyle("FV1", align="RIGHT"))],
            [Paragraph("<font size='7' color='#4b5563'>Cargos del mes:</font>", ParagraphStyle("FL2")), Paragraph(f"<font size='7' color='#1f2937'>{self._money(cargos_mes)}</font>", ParagraphStyle("FV2", align="RIGHT"))],
            [Paragraph("<font size='7' color='#4b5563'>Pagos del mes:</font>", ParagraphStyle("FL3")), Paragraph(f"<font size='7' color='#c74444'>-{self._money(pagos_mes)}</font>", ParagraphStyle("FV3", align="RIGHT"))],
            [Paragraph("<b>Saldo actual:</b>", ParagraphStyle("FL4", fontName="Helvetica-Bold", size=7.5, color="#123c7a")), Paragraph(f"<b>{self._money(saldo_actual)}</b>", ParagraphStyle("FV4", fontName="Helvetica-Bold", size=7.5, color=apt_status_color, align="RIGHT"))]
        ]
        fin_table = Table(fin_rows, colWidths=[width * 0.18, width * 0.15])
        fin_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#123c7a")),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("GRID", (0, 0), (-1, -2), 0.3, colors.HexColor("#e5e7eb")),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#edf9f0") if saldo_actual <= 0 else colors.HexColor("#fdf2f2")),
            ("BOX", (0, -1), (-1, -1), 0.5, colors.HexColor("#1f8f4d") if saldo_actual <= 0 else colors.HexColor("#f87171")),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ]))
        
        # Combine the 3 columns into Section 3 table
        sec3_table = Table([[resumen_table, pagos_table, fin_table]], colWidths=[width * 0.34, width * 0.33, width * 0.33])
        sec3_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(sec3_table)
        story.append(Spacer(1, 0.10 * cm))
        
        # SECTION 4: CONTACTOS DE EMERGENCIA
        story.append(make_section_title("4. CONTACTOS DE EMERGENCIA"))
        story.append(Spacer(1, 0.15 * cm))
        
        # Three cards
        contact1_text = (
            f"<font size='8' color='#123c7a'><b>Contacto principal</b></font><br/><br/>"
            f"<font size='7.5' color='#1f2937'><b>{escape(owner['full_name'])}</b></font><br/>"
            f"<font size='7' color='#4b5563'>📞 {escape(owner.get('phone') or '--')}</font><br/>"
            f"<font size='7' color='#4b5563'>✉ {escape(owner.get('email') or '--')}</font>"
        )
        contact2_text = (
            f"<font size='8' color='#123c7a'><b>Contacto alterno</b></font><br/><br/>"
            f"<font size='7.5' color='#1f2937'><b>{escape(owner.get('occupant_name') or '--')}</b></font><br/>"
            f"<font size='7' color='#4b5563'>Relación: {escape(owner.get('occupant_relation') or '--')}</font><br/>"
            f"<font size='7' color='#4b5563'>📞 {escape(owner.get('occupant_phone') or '--')}</font>"
        )
        contact3_text = (
            f"<font size='8' color='#123c7a'><b>Uso exclusivo de emergencia</b></font><br/><br/>"
            f"<font size='7.5' color='#1f2937'><b>Administración</b></font><br/>"
            f"<font size='7' color='#4b5563'>📞 +593 2 398 4500</font><br/>"
            f"<font size='7' color='#4b5563'>✉ administracion@torresnetanya.com</font>"
        )
        
        c1_table = Table([[Paragraph(contact1_text, ParagraphStyle("C1T", leading=10))]], colWidths=[width * 0.32])
        c1_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#e5e7eb")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ]))
        
        c2_table = Table([[Paragraph(contact2_text, ParagraphStyle("C2T", leading=10))]], colWidths=[width * 0.32])
        c2_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#e5e7eb")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ]))
        
        c3_table = Table([[Paragraph(contact3_text, ParagraphStyle("C3T", leading=10))]], colWidths=[width * 0.32])
        c3_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#e5e7eb")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ]))
        
        sec4_table = Table([[c1_table, c2_table, c3_table]], colWidths=[width * 0.34, width * 0.33, width * 0.33])
        sec4_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(sec4_table)
        story.append(Spacer(1, 0.08 * cm))
        
        # SECTION 5: OBSERVACIONES
        story.append(make_section_title("5. OBSERVACIONES"))
        story.append(Spacer(1, 0.15 * cm))
        
        obs_box = Table(
            [[Paragraph("<font size='7.5' color='#4b5563'>Ninguna observación registrada.</font>", ParagraphStyle("ObsText"))]],
            colWidths=[width]
        )
        obs_box.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#e5e7eb")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ]))
        story.append(obs_box)
        story.append(Spacer(1, 0.14 * cm))
        
        self._append_signature_grid(story, width=width, building=building, document_tag=f"FICHA-{sheet_number}")
        story.append(Spacer(1, 0.18 * cm))
        
        def draw_footer(canvas, doc):
            canvas.saveState()
            footer = build_pdf_footer_bar(building, width=doc.width, page_text=f"Página {doc.page}")
            _, footer_height = footer.wrap(doc.width, doc.bottomMargin)
            footer.drawOn(canvas, doc.leftMargin, doc.bottomMargin - footer_height)
            canvas.restoreState()

        doc.build(story, onFirstPage=draw_footer, onLaterPages=draw_footer)
        return output.getvalue()
