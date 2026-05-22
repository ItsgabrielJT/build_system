from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, status

from app.auth.dependencies import require_admin
from app.config.database import get_db
from app.models.schemas import ExpenseCreate
from app.repositories.expense_repository import ExpenseRepository
from app.services.expense_service import ExpenseService

router = APIRouter(tags=["expenses"])


@router.get("/expenses/stats/monthly")
async def get_monthly_stats(
    month: Optional[str] = None,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ExpenseService(ExpenseRepository(db))
    if not month:
        from datetime import date
        month = date.today().strftime("%Y-%m")
    return await service.get_monthly_stats(month)


@router.get("/expenses/stats/chart")
async def get_chart_stats(
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ExpenseService(ExpenseRepository(db))
    return await service.get_chart_data()


@router.get("/expenses/recent")
async def get_recent_expenses(
    limit: int = 10,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ExpenseService(ExpenseRepository(db))
    return await service.get_recent(limit)


@router.get("/expenses")
async def list_expenses(
    month: Optional[str] = None,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ExpenseService(ExpenseRepository(db))
    return await service.get_by_month(month)


@router.post("/expenses", status_code=status.HTTP_201_CREATED)
async def create_expense(
    body: ExpenseCreate,
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ExpenseService(ExpenseRepository(db))
    return await service.create(body, created_by=user["user_id"])
