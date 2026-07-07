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
        
        output = io.BytesIO()
        doc = SimpleDocTemplate(output, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        story = []
        
        styles = getSampleStyleSheet()
        story.extend(
            await self._pdf_header(
                "Reporte de Balance",
                f"Periodo: {period or 'Todos'} | Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}",
            )
        )
        
        # Table
        data = [["Concepto", "Monto"]]
        data.append(["Ingresos (pagos registrados)", f"${float(total_income):.2f}"])
        data.append(["Egresos (gastos)", f"${float(total_expenses):.2f}"])
        data.append(["Balance Neto", f"${float(balance):.2f}"])
        
        table = Table(data, colWidths=[3*inch, 2*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#123c7a')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
        ]))
        story.append(table)
        story.append(Spacer(1, 0.3*inch))
        story.append(Paragraph("Reporte generado automáticamente", styles['Normal']))
        
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
        ws.title = "Balance"
        
        # Headers
        headers = ["Concepto", "Monto"]
        header_fill = PatternFill(start_color="123C7A", end_color="123C7A", fill_type="solid")
        header_font = Font(bold=True, color="FFFFFF")
        
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col)
            cell.value = header
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal='center')
        
        # Data
        ws.cell(row=2, column=1).value = "Ingresos (pagos registrados)"
        ws.cell(row=2, column=2).value = float(total_income)
        ws.cell(row=3, column=1).value = "Egresos (gastos)"
        ws.cell(row=3, column=2).value = float(total_expenses)
        ws.cell(row=4, column=1).value = "Balance Neto"
        ws.cell(row=4, column=2).value = float(balance)
        
        # Adjust column widths
        ws.column_dimensions['A'].width = 25
        ws.column_dimensions['B'].width = 15
        
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
