from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.auth.dependencies import require_admin
from app.config.database import get_db
from app.models.schemas import (
    BulkOtherChargeCreate,
    BulkOtherChargeDeleteRequest,
    OtherChargeCreate,
    OtherChargeUpdate,
)
from app.repositories.other_charge_repository import OtherChargeRepository
from app.services.other_charge_service import OtherChargeService

router = APIRouter(tags=["other-charges"])


@router.get("/other-charges/stats")
async def get_other_charge_stats(
    period: Optional[str] = None,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = OtherChargeService(OtherChargeRepository(db))
    return await service.get_stats(period or datetime.now().strftime("%Y-%m"))


@router.get("/other-charges/periods-summary")
async def get_other_charge_periods_summary(
    page: int = 1,
    page_size: int = 10,
    year: Optional[int] = None,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = OtherChargeService(OtherChargeRepository(db))
    return await service.get_periods_summary(page, page_size, year)


@router.get("/other-charges")
async def list_other_charges(
    period: Optional[str] = None,
    periodicity: Optional[str] = None,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    repo = OtherChargeRepository(db)
    if period:
        return await repo.get_by_period(period, periodicity.upper() if periodicity else None)
    return await repo.get_all()


@router.post("/other-charges", status_code=status.HTTP_201_CREATED)
async def create_other_charge(
    body: OtherChargeCreate,
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = OtherChargeService(OtherChargeRepository(db))
    return await service.create(body, created_by=user["user_id"])


@router.put("/other-charges/{charge_id}")
async def update_other_charge(
    charge_id: UUID,
    body: OtherChargeUpdate,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = OtherChargeService(OtherChargeRepository(db))
    return await service.update(charge_id, body)


@router.post("/other-charges/bulk", status_code=status.HTTP_201_CREATED)
async def bulk_upload_other_charges(
    body: BulkOtherChargeCreate,
    user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = OtherChargeService(OtherChargeRepository(db))
    return await service.bulk_upsert(body, created_by=user["user_id"])


@router.delete("/other-charges/{charge_id}", status_code=status.HTTP_200_OK)
async def delete_other_charge(
    charge_id: UUID,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = OtherChargeService(OtherChargeRepository(db))
    return await service.delete(charge_id)


@router.post("/other-charges/bulk-delete", status_code=status.HTTP_200_OK)
async def bulk_delete_other_charges(
    body: BulkOtherChargeDeleteRequest,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = OtherChargeService(OtherChargeRepository(db))
    return await service.bulk_delete(body.charge_ids)
