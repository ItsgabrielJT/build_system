from __future__ import annotations

from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends

from app.auth.dependencies import require_admin
from app.config.database import get_db
from app.models.schemas import IncomeCreate, IncomeUpdate
from app.repositories.income_repository import IncomeRepository
from app.services.income_service import IncomeService

router = APIRouter(tags=["incomes"])


@router.get("/incomes")
async def list_incomes(
    period: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = IncomeService(IncomeRepository(db))
    return await service.get_all(
        period=period,
        status_filter=status,
        start_date=start_date,
        end_date=end_date,
    )


@router.post("/incomes", status_code=201)
async def create_income(
    body: IncomeCreate,
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = IncomeService(IncomeRepository(db))
    return await service.create(body, created_by=user["user_id"])


@router.put("/incomes/{income_id}")
async def update_income(
    income_id: UUID,
    body: IncomeUpdate,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = IncomeService(IncomeRepository(db))
    return await service.update_status(income_id, body)
