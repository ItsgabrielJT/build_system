from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

from app.auth.dependencies import require_admin, require_owner
from app.config.database import get_db
from app.models.schemas import MonthlyBalanceResponse
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


def _get_report_service(db) -> ReportService:
    return ReportService(
        DelinquencyService(DelinquencyRepository(db)),
        PaymentRepository(db),
        ExpenseRepository(db),
    )


def _validate_month_period_or_400(period: Optional[str]) -> Optional[str]:
    if period is None:
        return None
    try:
        ReportService(None, None, None)._validate_month_period(period)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return period


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
    
    service = _get_report_service(db)
    
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

    service = _get_report_service(db)
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
    
    service = _get_report_service(db)
    
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
    
    service = _get_report_service(db)
    
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


@router.get("/reports/monthly-balance", response_model=MonthlyBalanceResponse)
async def report_monthly_balance(
    period: Optional[str] = None,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    validated_period = _validate_month_period_or_400(period)
    service = _get_report_service(db)
    return await service.monthly_balance_summary(validated_period)


@router.get("/owner/monthly-balance", response_model=MonthlyBalanceResponse)
async def owner_monthly_balance(
    period: Optional[str] = None,
    format: str = "json",
    _user: dict = Depends(require_owner),
    db=Depends(get_db),
):
    if format not in ("json", "pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Format debe ser: json o pdf'
        )

    validated_period = _validate_month_period_or_400(period)
    service = _get_report_service(db)
    if format == "pdf":
        content = await service.balance_pdf(validated_period)
        filename_base = f"balance-mensual{'-' + validated_period if validated_period else ''}"
        return _pdf_response(content, f"{filename_base}.pdf")

    return await service.monthly_balance_summary(validated_period)
