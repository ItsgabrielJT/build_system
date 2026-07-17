from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.auth.dependencies import require_admin
from app.config.database import get_db
from app.models.schemas import ApartmentFeeCreate, ApartmentFeeUpdate, BulkFeeCreate, BulkFeeDeleteRequest
from app.repositories.apartment_fee_repository import ApartmentFeeRepository
from app.services.apartment_fee_service import ApartmentFeeService

router = APIRouter(tags=["apartment-fees"])


@router.get("/apartment-fees/stats")
async def get_fee_stats(
    period: Optional[str] = None,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ApartmentFeeService(ApartmentFeeRepository(db))
    return await service.get_stats(period or datetime.now().strftime("%Y-%m"))


@router.get("/apartment-fees/periods-summary")
async def get_periods_summary(
    page: int = 1,
    page_size: int = 10,
    year: Optional[int] = None,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ApartmentFeeService(ApartmentFeeRepository(db))
    return await service.get_periods_summary(page, page_size, year)


@router.get("/apartment-fees")
async def list_fees(
    period: Optional[str] = None,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    repo = ApartmentFeeRepository(db)
    if period:
        return await repo.get_by_period(period)
    return await repo.get_all()


@router.post("/apartment-fees", status_code=status.HTTP_201_CREATED)
async def create_fee(
    body: ApartmentFeeCreate,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ApartmentFeeService(ApartmentFeeRepository(db))
    return await service.create(body)


@router.put("/apartment-fees/{fee_id}")
async def update_fee(
    fee_id: UUID,
    body: ApartmentFeeUpdate,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ApartmentFeeService(ApartmentFeeRepository(db))
    return await service.update(fee_id, body)


@router.post("/apartment-fees/bulk", status_code=status.HTTP_201_CREATED)
async def bulk_upload_fees(
    body: BulkFeeCreate,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ApartmentFeeService(ApartmentFeeRepository(db))
    return await service.bulk_upsert(body)


@router.delete("/apartment-fees/{fee_id}", status_code=status.HTTP_200_OK)
async def delete_fee(
    fee_id: UUID,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ApartmentFeeService(ApartmentFeeRepository(db))
    return await service.delete(fee_id)


@router.post("/apartment-fees/bulk-delete", status_code=status.HTTP_200_OK)
async def bulk_delete_fees(
    body: BulkFeeDeleteRequest,
    _user: dict = Depends(require_admin),
    db=Depends(get_db),
):
    service = ApartmentFeeService(ApartmentFeeRepository(db))
    return await service.bulk_delete(body.fee_ids)
