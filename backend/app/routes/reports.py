from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
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


def _pdf_response(content: bytes, filename: str) -> Response:
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _excel_response(content: bytes, filename: str) -> Response:
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/reports/delinquency")
async def report_delinquency(
    format: str = "csv",
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    if format not in ("csv", "pdf", "excel"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Format debe ser: csv, pdf o excel'
        )
    
    service = ReportService(
        DelinquencyService(DelinquencyRepository(db)),
        PaymentRepository(db),
        ExpenseRepository(db),
    )
    
    if format == "csv":
        content = await service.delinquency_csv()
        return _csv_response(content, "reporte-morosidad.csv")
    elif format == "pdf":
        content = await service.delinquency_pdf()
        return _pdf_response(content, "reporte-morosidad.pdf")
    else:  # excel
        content = await service.delinquency_excel()
        return _excel_response(content, "reporte-morosidad.xlsx")


@router.get("/reports/dashboard-stats")
async def report_dashboard_stats(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="start_date no puede ser mayor que end_date",
        )

    service = ReportService(
        DelinquencyService(DelinquencyRepository(db)),
        PaymentRepository(db),
        ExpenseRepository(db),
    )
    return await service.dashboard_stats(start_date=start_date, end_date=end_date)


@router.get("/reports/income")
async def report_income(
    period: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    format: str = "csv",
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    if format not in ("csv", "pdf", "excel"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Format debe ser: csv, pdf o excel'
        )
    
    service = ReportService(
        DelinquencyService(DelinquencyRepository(db)),
        PaymentRepository(db),
        ExpenseRepository(db),
    )
    
    filename_base = f"reporte-ingresos{'-' + period if period else ''}"
    
    if format == "csv":
        content = await service.income_csv(period, start_date, end_date)
        return _csv_response(content, f"{filename_base}.csv")
    elif format == "pdf":
        content = await service.income_pdf(period, start_date, end_date)
        return _pdf_response(content, f"{filename_base}.pdf")
    else:  # excel
        content = await service.income_excel(period, start_date, end_date)
        return _excel_response(content, f"{filename_base}.xlsx")


@router.get("/reports/balance")
async def report_balance(
    period: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    format: str = "csv",
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    if format not in ("csv", "pdf", "excel"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Format debe ser: csv, pdf o excel'
        )
    
    service = ReportService(
        DelinquencyService(DelinquencyRepository(db)),
        PaymentRepository(db),
        ExpenseRepository(db),
    )
    
    filename_base = f"balance{'-' + period if period else ''}"
    
    if format == "csv":
        content = await service.balance_csv(period, start_date, end_date)
        return _csv_response(content, f"{filename_base}.csv")
    elif format == "pdf":
        content = await service.balance_pdf(period, start_date, end_date)
        return _pdf_response(content, f"{filename_base}.pdf")
    else:  # excel
        content = await service.balance_excel(period, start_date, end_date)
        return _excel_response(content, f"{filename_base}.xlsx")
