from __future__ import annotations

import csv
import io
import re
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib import colors

from app.repositories.expense_repository import ExpenseRepository
from app.repositories.payment_repository import PaymentRepository
from app.services.pdf_branding import build_pdf_brand_header, get_default_building_config
from app.services.delinquency_service import DelinquencyService

_MONTH_PERIOD_RE = re.compile(r"^\d{4}-\d{2}$")
_CONFIRMED_PAYMENT_STATUSES = {"REGISTRADO", "APROBADO"}
_EXCLUDED_EXPENSE_STATUSES = {"ANULADO", "ANULADA"}
_PDF_BLUE = colors.HexColor("#123c7a")
_PDF_LIGHT = colors.HexColor("#f8fafc")


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

    async def _pdf_header(self, title: str, subtitle: str) -> list:
        conn = getattr(self._payment_repo, "_conn", None)
        building = await get_default_building_config(conn)
        return build_pdf_brand_header(
            title,
            subtitle,
            building,
            width=7.5 * inch,
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
        
        output = io.BytesIO()
        doc = SimpleDocTemplate(output, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        story = []
        
        styles = getSampleStyleSheet()
        story.extend(
            await self._pdf_header(
                "Reporte de Ingresos",
                f"Periodo: {period or 'Todos'} | Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}",
            )
        )
        
        # Table
        data = [["Fecha", "Propietario", "Departamento", "Período", "Monto", "Método", "Estado"]]
        for p in payments:
            data.append([
                str(p.get("paid_at", "")),
                p.get("owner_name", ""),
                p.get("apartment_code", ""),
                p.get("period", ""),
                f"${float(p.get('amount', 0)):.2f}",
                p.get("method", ""),
                p.get("status", ""),
            ])
        
        table = Table(data, colWidths=[0.9*inch, 1.1*inch, 0.8*inch, 0.7*inch, 0.7*inch, 0.7*inch, 0.8*inch])
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
        
        doc.build(story)
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
        doc = SimpleDocTemplate(output, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        story = []
        
        styles = getSampleStyleSheet()
        story.extend(
            await self._pdf_header(
                "Reporte de Balance",
                f"Rango: {self._date_label(period, start_date, end_date)} | Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}",
            )
        )
        
        data = [["Indicador", "Valor", "Detalle"]]
        data.append(["Ingresos confirmados", self._money(total_income), f"{len(payments)} pagos registrados/aprobados"])
        data.append(["Gastos registrados", self._money(total_expenses), f"{len(expenses)} gastos vigentes"])
        data.append(["Diferencia neta", self._money(balance), "Ingresos menos gastos"])
        
        table = Table(data, colWidths=[2.2*inch, 1.5*inch, 3.2*inch])
        table.setStyle(self._table_style(9))
        story.append(table)

        story.append(Spacer(1, 0.2*inch))
        story.append(Paragraph("Ingresos por método", styles["Heading3"]))
        income_data = [["Método", "Monto"]]
        income_data.extend([[row["label"], self._money(row["amount"])] for row in income_by_method] or [["Sin ingresos", "$0.00"]])
        income_table = Table(income_data, colWidths=[3.5*inch, 2*inch])
        income_table.setStyle(self._table_style(8))
        story.append(income_table)

        story.append(Spacer(1, 0.2*inch))
        story.append(Paragraph("Gastos por categoría", styles["Heading3"]))
        expense_data = [["Categoría", "Monto"]]
        expense_data.extend([[row["label"], self._money(row["amount"])] for row in expenses_by_category] or [["Sin gastos", "$0.00"]])
        expense_table = Table(expense_data, colWidths=[3.5*inch, 2*inch])
        expense_table.setStyle(self._table_style(8))
        story.append(expense_table)
        
        doc.build(story)
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
        doc = SimpleDocTemplate(output, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        story = []
        styles = getSampleStyleSheet()
        story.extend(await self._pdf_header(
            "Reporte Detallado de Pagos",
            f"Rango: {self._date_label(period, start_date, end_date)} | Estado: {status or 'Todos'}",
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
        doc.build(story)
        return output.getvalue()

    async def expenses_pdf(
        self,
        period: Optional[str],
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> bytes:
        expenses = await self._expenses(period, start_date, end_date)
        total = sum(Decimal(str(e.get("amount", 0))) for e in expenses)
        by_category = self._build_breakdown(expenses, "category", "Sin categoría")

        output = io.BytesIO()
        doc = SimpleDocTemplate(output, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        story = []
        styles = getSampleStyleSheet()
        story.extend(await self._pdf_header(
            "Reporte Detallado de Gastos",
            f"Rango: {self._date_label(period, start_date, end_date)} | Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}",
        ))
        summary = Table(
            [["Gastos", "Total", "Categorías"], [str(len(expenses)), self._money(total), str(len(by_category))]],
            colWidths=[1.6*inch, 2*inch, 1.6*inch],
        )
        summary.setStyle(self._table_style(9))
        story.append(summary)
        story.append(Spacer(1, 0.2*inch))
        story.append(Paragraph("Detalle de gastos", styles["Heading3"]))
        data = [["Fecha", "Proveedor", "Categoría", "Concepto", "Monto", "Comprobante"]]
        for e in expenses:
            data.append([
                str(e.get("date") or ""),
                e.get("provider") or "",
                e.get("category") or "Sin categoría",
                e.get("concept") or "",
                self._money(e.get("amount", 0)),
                e.get("receipt_file_name") or "Sin adjunto",
            ])
        table = Table(data, colWidths=[0.85*inch, 1.15*inch, 1.05*inch, 2.05*inch, 0.8*inch, 1.1*inch], repeatRows=1)
        table.setStyle(self._table_style(7))
        story.append(table)
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
        
        doc.build(story)
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
        output = io.BytesIO()
        doc = SimpleDocTemplate(output, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        story = []
        styles = getSampleStyleSheet()
        story.extend(await self._pdf_header("Reporte Detallado de Cuotas", f"Rango: {self._date_label(None, start_date, end_date)}"))
        summary = Table([["Cuotas", "Emitido", "Recaudado", "Pendiente"], [str(len(rows)), self._money(total), self._money(collected), self._money(total - collected)]])
        summary.setStyle(self._table_style(8))
        story.extend([summary, Spacer(1, 0.2*inch), Paragraph("Detalle de cuotas", styles["Heading3"])])
        data = [["Período", "Depto", "Propietario", "Emitido", "Pagado", "Pendiente", "Estado"]]
        data.extend([[r.get("period", ""), r.get("apartment_code", ""), r.get("owner_name", ""), self._money(r.get("amount")), self._money(r.get("paid_amount")), self._money(r.get("pending_amount")), r.get("status", "")] for r in rows])
        table = Table(data, colWidths=[0.75*inch, 0.65*inch, 1.55*inch, 0.85*inch, 0.85*inch, 0.85*inch, 0.85*inch], repeatRows=1)
        table.setStyle(self._table_style(7))
        story.append(table)
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
        output = io.BytesIO()
        doc = SimpleDocTemplate(output, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        story = []
        styles = getSampleStyleSheet()
        story.extend(await self._pdf_header("Reporte Detallado de Multas", f"Rango: {self._date_label(period, start_date, end_date)} | Estado: {status or 'Todos'}"))
        summary = Table([["Multas", "Monto total"], [str(len(rows)), self._money(total)]], colWidths=[2*inch, 2*inch])
        summary.setStyle(self._table_style(8))
        story.extend([summary, Spacer(1, 0.2*inch), Paragraph("Detalle de multas", styles["Heading3"])])
        data = [["Fecha", "Depto", "Propietario", "Período", "Motivo", "Monto", "Estado"]]
        data.extend([[str(r.get("issued_at") or ""), r.get("apartment_code", ""), r.get("owner_name", ""), r.get("period", ""), r.get("reason", ""), self._money(r.get("amount")), r.get("status", "")] for r in rows])
        table = Table(data, colWidths=[0.8*inch, 0.55*inch, 1.1*inch, 0.65*inch, 1.8*inch, 0.75*inch, 0.75*inch], repeatRows=1)
        table.setStyle(self._table_style(7))
        story.append(table)
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
        output = io.BytesIO()
        doc = SimpleDocTemplate(output, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        story = []
        styles = getSampleStyleSheet()
        story.extend(await self._pdf_header("Reporte de Propietarios", f"Rango: {self._date_label(None, start_date, end_date)} | Estado: {status or 'Todos'}"))
        story.extend([Paragraph(f"Total de propietarios: {len(rows)}", styles["Heading3"]), Spacer(1, 0.15*inch)])
        data = [["Ingreso", "Propietario", "Documento", "Email", "Teléfono", "Unidades", "Estado"]]
        data.extend([[str(r.get("created_at").date() if r.get("created_at") else ""), r.get("full_name", ""), r.get("document_id", ""), r.get("email", ""), r.get("phone", ""), r.get("units") or "", r.get("status", "")] for r in rows])
        table = Table(data, colWidths=[0.7*inch, 1.25*inch, 0.85*inch, 1.35*inch, 0.8*inch, 0.9*inch, 0.65*inch], repeatRows=1)
        table.setStyle(self._table_style(7))
        story.append(table)
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
        output = io.BytesIO()
        doc = SimpleDocTemplate(output, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        story = []
        styles = getSampleStyleSheet()
        story.extend(await self._pdf_header("Reporte de Edificios", f"Rango: {self._date_label(None, start_date, end_date)}"))
        story.extend([Paragraph(f"Total de edificios: {len(rows)}", styles["Heading3"]), Spacer(1, 0.15*inch)])
        data = [["Creado", "Edificio", "Dirección", "Teléfono", "Email", "Departamentos"]]
        data.extend([[str(r.get("created_at").date() if r.get("created_at") else ""), r.get("name", ""), r.get("address", ""), r.get("phone", ""), r.get("email", ""), str(r.get("apartments_count", 0))] for r in rows])
        table = Table(data, colWidths=[0.75*inch, 1.35*inch, 1.5*inch, 0.85*inch, 1.4*inch, 0.75*inch], repeatRows=1)
        table.setStyle(self._table_style(7))
        story.append(table)
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
