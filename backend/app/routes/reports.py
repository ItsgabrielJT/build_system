from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.auth.dependencies import require_admin
from app.config.database import get_db
from app.repositories.delinquency_repository import DelinquencyRepository
from app.repositories.expense_repository import ExpenseRepository
from app.repositories.payment_repository import PaymentRepository
from app.services.delinquency_service import DelinquencyService
from app.services.report_service import ReportService

router = APIRouter(tags=["reports"])


def _csv_response(content: bytes, filename: str) -> Response:
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/reports/delinquency")
async def report_delinquency(
    period: Optional[str] = None,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ReportService(
        DelinquencyService(DelinquencyRepository(db)),
        PaymentRepository(db),
        ExpenseRepository(db),
    )
    content = await service.delinquency_csv()
    return _csv_response(content, "reporte-morosidad.csv")


@router.get("/reports/income")
async def report_income(
    period: Optional[str] = None,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ReportService(
        DelinquencyService(DelinquencyRepository(db)),
        PaymentRepository(db),
        ExpenseRepository(db),
    )
    content = await service.income_csv(period)
    return _csv_response(content, f"reporte-ingresos{'-' + period if period else ''}.csv")


@router.get("/reports/balance")
async def report_balance(
    period: Optional[str] = None,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ReportService(
        DelinquencyService(DelinquencyRepository(db)),
        PaymentRepository(db),
        ExpenseRepository(db),
    )
    content = await service.balance_csv(period)
    return _csv_response(content, f"balance{'-' + period if period else ''}.csv")
