from __future__ import annotations

import csv
import io
from datetime import datetime
from decimal import Decimal
from typing import Optional

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib import colors

from app.repositories.expense_repository import ExpenseRepository
from app.repositories.payment_repository import PaymentRepository
from app.services.delinquency_service import DelinquencyService


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

    async def income_csv(self, period: Optional[str]) -> bytes:
        payments = await self._payment_repo.get_all(period=period, status="REGISTRADO")
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

    async def balance_csv(self, period: Optional[str]) -> bytes:
        payments = await self._payment_repo.get_all(period=period, status="REGISTRADO")
        expenses = await self._expense_repo.get_by_month(period)

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

    async def income_pdf(self, period: Optional[str]) -> bytes:
        payments = await self._payment_repo.get_all(period=period, status="REGISTRADO")
        
        output = io.BytesIO()
        doc = SimpleDocTemplate(output, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        story = []
        
        # Title
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=16,
            textColor=colors.HexColor('#1f2937'),
            spaceAfter=6,
        )
        story.append(Paragraph("Reporte de Ingresos", title_style))
        story.append(Paragraph(f"Período: {period or 'Todos'} | Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles['Normal']))
        story.append(Spacer(1, 0.2*inch))
        
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
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1f2937')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
        ]))
        story.append(table)
        story.append(Spacer(1, 0.3*inch))
        story.append(Paragraph("Reporte generado automáticamente", styles['Normal']))
        
        doc.build(story)
        return output.getvalue()

    async def balance_pdf(self, period: Optional[str]) -> bytes:
        payments = await self._payment_repo.get_all(period=period, status="REGISTRADO")
        expenses = await self._expense_repo.get_by_month(period)

        total_income = sum(Decimal(str(p.get("amount", 0))) for p in payments)
        total_expenses = sum(Decimal(str(e.get("amount", 0))) for e in expenses)
        balance = total_income - total_expenses
        
        output = io.BytesIO()
        doc = SimpleDocTemplate(output, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        story = []
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=16,
            textColor=colors.HexColor('#1f2937'),
            spaceAfter=6,
        )
        story.append(Paragraph("Reporte de Balance", title_style))
        story.append(Paragraph(f"Período: {period or 'Todos'} | Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles['Normal']))
        story.append(Spacer(1, 0.2*inch))
        
        # Table
        data = [["Concepto", "Monto"]]
        data.append(["Ingresos (pagos registrados)", f"${float(total_income):.2f}"])
        data.append(["Egresos (gastos)", f"${float(total_expenses):.2f}"])
        data.append(["Balance Neto", f"${float(balance):.2f}"])
        
        table = Table(data, colWidths=[3*inch, 2*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1f2937')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
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
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=16,
            textColor=colors.HexColor('#1f2937'),
            spaceAfter=6,
        )
        story.append(Paragraph("Reporte de Morosidad", title_style))
        story.append(Paragraph(f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles['Normal']))
        story.append(Spacer(1, 0.2*inch))
        
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
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1f2937')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
        ]))
        story.append(table)
        story.append(Spacer(1, 0.3*inch))
        story.append(Paragraph("Reporte generado automáticamente", styles['Normal']))
        
        doc.build(story)
        return output.getvalue()

    # ─── EXCEL REPORTS ───────────────────────────────────────────────────────

    async def income_excel(self, period: Optional[str]) -> bytes:
        payments = await self._payment_repo.get_all(period=period, status="REGISTRADO")
        
        wb = Workbook()
        ws = wb.active
        ws.title = "Ingresos"
        
        # Headers
        headers = ["Fecha", "Propietario", "Departamento", "Período", "Monto", "Método", "Estado"]
        header_fill = PatternFill(start_color="1F2937", end_color="1F2937", fill_type="solid")
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

    async def balance_excel(self, period: Optional[str]) -> bytes:
        payments = await self._payment_repo.get_all(period=period, status="REGISTRADO")
        expenses = await self._expense_repo.get_by_month(period)

        total_income = sum(Decimal(str(p.get("amount", 0))) for p in payments)
        total_expenses = sum(Decimal(str(e.get("amount", 0))) for e in expenses)
        balance = total_income - total_expenses
        
        wb = Workbook()
        ws = wb.active
        ws.title = "Balance"
        
        # Headers
        headers = ["Concepto", "Monto"]
        header_fill = PatternFill(start_color="1F2937", end_color="1F2937", fill_type="solid")
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
        header_fill = PatternFill(start_color="1F2937", end_color="1F2937", fill_type="solid")
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
