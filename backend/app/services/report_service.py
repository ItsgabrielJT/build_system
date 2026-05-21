from __future__ import annotations

import csv
import io
from decimal import Decimal
from typing import Optional

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
