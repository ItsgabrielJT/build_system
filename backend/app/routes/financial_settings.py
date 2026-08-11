from __future__ import annotations

from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator

from app.auth.dependencies import get_current_user, require_admin
from app.config.database import get_db
from app.models.schemas import _validate_period
from app.repositories.financial_settings_repository import FinancialSettingsRepository

router = APIRouter(tags=["financial-settings"])


class DueDayUpdate(BaseModel):
    due_day: int

    @field_validator("due_day")
    @classmethod
    def validate_due_day(cls, value: int) -> int:
        if value < 1 or value > 31:
            raise ValueError("El dia de vencimiento debe estar entre 1 y 31")
        return value


class InterestRateUpsert(BaseModel):
    period: str
    annual_rate_percent: Decimal
    source: Optional[str] = "Banco Central del Ecuador"

    @field_validator("period")
    @classmethod
    def validate_period(cls, value: str) -> str:
        return _validate_period(value)

    @field_validator("annual_rate_percent")
    @classmethod
    def validate_rate(cls, value: Decimal) -> Decimal:
        if value < 0:
            raise ValueError("La tasa anual no puede ser negativa")
        return value


@router.get("/financial-settings")
async def get_financial_settings(
    _user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    repo = FinancialSettingsRepository(db)
    return {
        "due_day": await repo.get_due_day(),
        "interest_rates": await repo.list_interest_rates(),
        "late_interest_start_period": "2026-08",
    }


@router.put("/financial-settings/due-day")
async def update_due_day(
    body: DueDayUpdate,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    repo = FinancialSettingsRepository(db)
    return await repo.update_due_day(body.due_day)


@router.get("/financial-settings/interest-rates")
async def list_interest_rates(
    start_period: Optional[str] = None,
    end_period: Optional[str] = None,
    _user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    for value in (start_period, end_period):
        if value is not None:
            try:
                _validate_period(value)
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=str(exc),
                ) from exc
    repo = FinancialSettingsRepository(db)
    return await repo.list_interest_rates(start_period, end_period)


@router.post("/financial-settings/interest-rates", status_code=status.HTTP_201_CREATED)
async def upsert_interest_rate(
    body: InterestRateUpsert,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    repo = FinancialSettingsRepository(db)
    return await repo.upsert_interest_rate(
        period=body.period,
        annual_rate_percent=body.annual_rate_percent,
        source=body.source,
        created_by=str(_user.get("uid") or _user.get("sub") or ""),
    )
